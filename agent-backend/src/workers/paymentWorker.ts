import { Worker, type Job } from "bullmq";
import { reasonAboutPayment }   from "../services/reasoning";
import { analyzeFraudSignals }  from "../services/fraud";
import { agentWallet }          from "../services/wallet";
import { initScheduler }        from "../services/scheduler";
import {
    isAlreadyProcessed,
    getEscrowState,
    executeReleasePayment,
    executeMilestonePayment,
    executeSplitPayment,
    executeFreezeEscrow,
} from "../services/execution";
import { saveDecision, updateDecisionTx } from "../db/decisions";
import { getDb }                from "../db/schema";
import { Queue }                from "bullmq";
import type { DeliveryEvent, ReasoningInput } from "../types";

const REDIS = {
    host: process.env["REDIS_HOST"] ?? "127.0.0.1",
    port: Number(process.env["REDIS_PORT"] ?? 6379),
};

// ── Init DB + scheduler (worker is the autonomous process) ────────────────
getDb();
const paymentQueue = new Queue("payments", { connection: REDIS });
initScheduler(paymentQueue);

// ── Worker ────────────────────────────────────────────────────────────────
const worker = new Worker(
    "payments",
    async (job: Job) => {
        const data       = job.data as DeliveryEvent & { eventHash: string };
        const { deliveryId, escrowId, amount, recipient, eventType, eventHash } = data;
        const SEP        = "═".repeat(58);

        console.log(`\n${SEP}`);
        console.log(`🤖 [Job ${job.id}] ${eventType?.toUpperCase()} event`);
        console.log(`   delivery=${deliveryId}  escrow=${escrowId}`);
        console.log(`   amount=$${amount} USDT  recipient=${recipient}`);
        if (data.isRetry) console.log(`   ↩️  Retry #${data.retryCount}`);

        // ── ① On-chain idempotency check ─────────────────────────────────
        const alreadyDone = await isAlreadyProcessed(deliveryId);
        if (alreadyDone) {
            console.log(`⚠️  SKIP: ${deliveryId} already settled on-chain`);
            return { status: "skipped", reason: "already_settled_on_chain" };
        }

        // ── ② Fetch escrow state ─────────────────────────────────────────
        const escrow         = await getEscrowState(escrowId);
        const escrowBalance  = escrow?.availableBalance ?? "0";
        const isEscrowActive = escrow ? escrow.status <= 1 : false;

        // ── ③ Fraud analysis ─────────────────────────────────────────────
        const fraud = analyzeFraudSignals(data);
        const fraudSuffix = fraud.signals.length ? `  signals=[${fraud.signals.join(",")}]` : "";
        console.log(`\n🔍 Fraud: score=${fraud.score}/100${fraudSuffix}`);

        // ── ④ Agent wallet gas ───────────────────────────────────────────
        const ethBalance = await agentWallet.getEthBalance();

        // ── ⑤ AI Reasoning ───────────────────────────────────────────────
        console.log(`\n🧠 Reasoning...`);
        const input: ReasoningInput = {
            event:              data,
            escrowBalance,
            agentWalletBalance: ethBalance,
            fraudSignals:       fraud,
            contractRules: {
                maxTxLimit:       "10000",
                isEscrowActive,
                alreadyProcessed: false,
            },
        };
        const reasoning = await reasonAboutPayment(input);

        const badges: Record<string, string> = { PAY: "✅ PAY", WAIT: "⏳ WAIT", REJECT: "❌ REJECT" };
        const badge = badges[reasoning.decision] ?? reasoning.decision;
        console.log(`\n${badge}  confidence=${reasoning.confidence}%`);
        console.log(`   ${reasoning.reasoning}`);

        // ── ⑥ Persist to decision ledger ─────────────────────────────────
        saveDecision({
            eventHash,
            escrowId,
            deliveryId,
            eventType:          (eventType ?? "delivery"),
            decision:           reasoning.decision,
            confidence:         reasoning.confidence,
            reasoning:          reasoning.reasoning,
            riskFactors:        reasoning.riskFactors,
            riskScore:          fraud.score,
            amount,
            recipient,
            agentWalletBalance: ethBalance,
            retryCount:         data.retryCount ?? 0,
            scheduledRetryAt:   reasoning.decision === "WAIT"
                ? new Date(Date.now() + 2 * 60 * 1000).toISOString()
                : undefined,
            timestamp:          new Date().toISOString(),
        });

        // ── ⑦ Execute ────────────────────────────────────────────────────
        return executeDecision({ data, reasoning, fraud, escrowId, deliveryId, amount, recipient, eventHash });
    },
    { connection: REDIS, concurrency: 1 }
);

worker.on("completed", (job, result: { status: string }) =>
    console.log(`\n✔️  Job ${job.id} → ${result.status}`)
);
worker.on("failed", (job, err) =>
    console.error(`\n✖️  Job ${job?.id} failed: ${err.message}`)
);

console.log(`⚙️  Payment Worker listening  (concurrency=1, nonce-safe)`);

// ── Extracted execution helper (keeps worker callback under complexity limit) ──

interface ExecParams {
    data:       DeliveryEvent & { eventHash: string };
    reasoning:  { decision: string; reasoning: string; recommendedAction: string };
    fraud:      { score: number; signals: string[] };
    escrowId:   string;
    deliveryId: string;
    amount:     string;
    recipient:  string;
    eventHash:  string;
}

async function executeDecision(p: ExecParams): Promise<Record<string, unknown>> {
    if (p.reasoning.decision === "PAY") {
        const tx = await routeExecution(p);
        updateDecisionTx(p.eventHash, tx.txHash, tx.blockNumber);
        console.log(`\n💸 SETTLED  $${p.amount} USDT → ${p.recipient}`);
        console.log(`   TX: ${tx.txHash}  block=${tx.blockNumber}`);
        return { status: "success", txHash: tx.txHash, blockNumber: tx.blockNumber };
    }

    if (p.reasoning.decision === "WAIT") {
        console.log(`\n⏳ Retry in 2 min — ${p.reasoning.recommendedAction}`);
        return { status: "waiting", reason: p.reasoning.reasoning };
    }

    // REJECT
    if (p.fraud.score > 70) {
        console.log(`\n🔒 Freezing escrow ${p.escrowId} (fraud=${p.fraud.score})`);
        await executeFreezeEscrow(p.escrowId, p.fraud.signals.join("; ")).catch(
            (e: unknown) => console.error("freeze failed:", e instanceof Error ? e.message : e)
        );
    }
    console.log(`\n❌ REJECTED: ${p.reasoning.reasoning}`);
    return { status: "rejected", reason: p.reasoning.reasoning };
}

async function routeExecution(p: ExecParams): Promise<{ txHash: string; blockNumber: number }> {
    if (p.data.eventType === "milestone") {
        return executeMilestonePayment(p.escrowId, p.deliveryId);
    }
    if (p.data.splitRecipients?.length) {
        const addresses = p.data.splitRecipients.map(r => r.address);
        const amounts   = p.data.splitRecipients.map(r => r.amount);
        return executeSplitPayment(p.escrowId, p.deliveryId, addresses, amounts);
    }
    return executeReleasePayment(p.escrowId, p.deliveryId, p.amount);
}
