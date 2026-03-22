import type { Queue } from "bullmq";
import { getPendingWaits, updateDecisionRetry } from "../db/decisions";
import { agentWallet } from "./wallet";

const RETRY_INTERVAL_MS  = 2 * 60 * 1000;  // 2 minutes
const HEALTH_INTERVAL_MS = 30 * 1000;       // 30 seconds
const GAS_THRESHOLD_ETH  = "0.05";

export function initScheduler(queue: Queue) {
    // Stagger first runs to avoid startup noise
    setTimeout(() => retryWaitingPayments(queue), 15_000);
    setTimeout(() => checkWalletHealth(),         5_000);

    setInterval(() => retryWaitingPayments(queue), RETRY_INTERVAL_MS);
    setInterval(() => checkWalletHealth(),         HEALTH_INTERVAL_MS);

    console.log("⏱️  Autonomous scheduler running (retry=2min, health=30s)");
}

async function retryWaitingPayments(queue: Queue) {
    const pending = getPendingWaits();
    if (pending.length === 0) return;

    console.log(`\n🔄 Scheduler: retrying ${pending.length} WAIT decision(s)`);

    for (const decision of pending) {
        const nextRetry    = decision.retryCount + 1;
        const scheduledAt  = new Date(Date.now() + RETRY_INTERVAL_MS).toISOString();
        const jobId        = `retry-${decision.eventHash}-${nextRetry}`;

        try {
            await queue.add("process-payment", {
                deliveryId:        decision.deliveryId,
                escrowId:          decision.escrowId,
                amount:            decision.amount,
                recipient:         decision.recipient,
                eventType:         decision.eventType,
                status:            "completed",
                isRetry:           true,
                retryCount:        nextRetry,
                originalEventHash: decision.eventHash,
                eventHash:         decision.eventHash,
            }, { jobId });

            updateDecisionRetry(decision.eventHash, nextRetry, scheduledAt);
            console.log(`  ↩️  Retry #${nextRetry} queued for delivery=${decision.deliveryId}`);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`  ❌ Failed to queue retry for ${decision.deliveryId}: ${msg}`);
        }
    }
}

async function checkWalletHealth() {
    try {
        const isLow = await agentWallet.isLowOnGas(GAS_THRESHOLD_ETH);
        if (isLow) {
            const bal = await agentWallet.getEthBalance();
            const address = await agentWallet.getAddress();
            console.warn(`\n⚠️  LOW GAS: agent wallet has ${bal} ETH (threshold: ${GAS_THRESHOLD_ETH} ETH)`);
            console.warn(`   Refund address: ${address}`);
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Wallet health check failed: ${msg}`);
    }
}
