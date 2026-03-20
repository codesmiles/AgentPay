import type { Queue } from "bullmq";
import { getDecisions, getStats }  from "./db/decisions";
import { agentWallet }             from "./services/wallet";
import { hashEvent }               from "./services/fraud";
import type { DeliveryEvent }      from "./types";

const CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200): Response {
    return Response.json(data, { status, headers: CORS });
}

export async function handleRoutes(req: Request, queue: Queue): Promise<Response> {
    const { pathname, searchParams } = new URL(req.url);
    const method = req.method;

    if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    // ── GET /health ───────────────────────────────────────────────────────
    if (pathname === "/health" && method === "GET") {
        const wallet = await agentWallet.getStatus().catch(() => null);
        return json({ status: "ACTIVE", timestamp: new Date().toISOString(), wallet });
    }

    // ── GET /agent/status ─────────────────────────────────────────────────
    if (pathname === "/agent/status" && method === "GET") {
        const [wallet, stats, queueDepth] = await Promise.all([
            agentWallet.getStatus(),
            getStats(),
            queue.count(),
        ]);
        return json({
            agent: {
                status:   "AUTONOMOUS",
                contract: process.env["CONTRACT_ADDRESS"] ?? "not set",
                wallet,
                queue:    { depth: queueDepth },
            },
            statistics: stats,
        });
    }

    // ── GET /agent/decisions ──────────────────────────────────────────────
    if (pathname === "/agent/decisions" && method === "GET") {
        const limit  = Math.min(Number(searchParams.get("limit")  ?? 50), 200);
        const offset = Number(searchParams.get("offset") ?? 0);
        return json({ decisions: getDecisions(limit, offset), stats: getStats() });
    }

    // ── POST /webhook/delivery ────────────────────────────────────────────
    if (pathname === "/webhook/delivery" && method === "POST") {
        return enqueueEvent(req, queue, "delivery");
    }

    // ── POST /webhook/milestone ───────────────────────────────────────────
    if (pathname === "/webhook/milestone" && method === "POST") {
        return enqueueEvent(req, queue, "milestone");
    }

    // ── POST /oracle/input  (manual override) ─────────────────────────────
    if (pathname === "/oracle/input" && method === "POST") {
        return enqueueEvent(req, queue, "oracle");
    }

    // ── GET /demo/setup ───────────────────────────────────────────────────
    if (pathname === "/demo/setup" && method === "GET") {
        return json({
            message: "AgentPay demo — copy these curl commands",
            step1_delivery: {
                curl: `curl -X POST http://localhost:3001/webhook/delivery -H 'Content-Type: application/json' -d '${JSON.stringify({
                    deliveryId: `del-${Date.now()}`,
                    escrowId:   "escrow-demo-001",
                    amount:     "50.00",
                    recipient:  agentWallet.address,
                    status:     "completed",
                    metadata:   { courier: "FastShip Co.", route: "NYC→LA", proof: "https://proof.example.com/001" },
                })}'`,
            },
            step2_milestone: {
                curl: `curl -X POST http://localhost:3001/webhook/milestone -H 'Content-Type: application/json' -d '${JSON.stringify({
                    deliveryId: `ms-${Date.now()}`,
                    escrowId:   "escrow-milestone-001",
                    amount:     "0",
                    recipient:  agentWallet.address,
                    status:     "milestone_reached",
                })}'`,
            },
            step3_decisions: "curl http://localhost:3001/agent/decisions",
        });
    }

    return new Response("Not Found", { status: 404, headers: CORS });
}

// ── Shared enqueue logic ──────────────────────────────────────────────────

async function enqueueEvent(req: Request, queue: Queue, eventType: DeliveryEvent["eventType"]): Promise<Response> {
    let body: Partial<DeliveryEvent>;
    try {
        body = await req.json() as Partial<DeliveryEvent>;
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "parse error";
        return json({ error: "Invalid JSON body", detail: msg }, 400);
    }

    if (!body.deliveryId || !body.escrowId || !body.recipient) {
        return json({ error: "Missing required fields: deliveryId, escrowId, recipient" }, 400);
    }

    const event: DeliveryEvent = {
        deliveryId:      body.deliveryId,
        escrowId:        body.escrowId,
        amount:          body.amount      ?? "0",
        recipient:       body.recipient,
        status:          body.status      ?? (eventType === "milestone" ? "milestone_reached" : "completed"),
        eventType,
        milestoneIndex:  body.milestoneIndex,
        splitRecipients: body.splitRecipients,
        metadata:        body.metadata,
    };

    const eventHash = hashEvent(event);

    // Idempotent — BullMQ deduplicates by jobId
    const job = await queue.add("process-payment", { ...event, eventHash }, {
        jobId:           eventHash,
        removeOnComplete: false,
        removeOnFail:     false,
    });

    return json({
        success:   true,
        jobId:     job.id,
        eventHash,
        message:   "Event queued — agent is reasoning autonomously",
    }, 202);
}
