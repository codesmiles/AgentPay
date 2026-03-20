import { getDb } from "./schema";
import type { DecisionRecord } from "../types";

// ── Write ─────────────────────────────────────────────────────────────────

export function saveDecision(record: Omit<DecisionRecord, "id">): number {
    const db = getDb();
    const result = db.run(
        `INSERT OR REPLACE INTO decisions
            (event_hash, escrow_id, delivery_id, event_type, decision, confidence,
             reasoning, risk_factors, risk_score, amount, recipient,
             tx_hash, block_number, agent_wallet_balance, retry_count,
             scheduled_retry_at, timestamp)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
        [
            record.eventHash,
            record.escrowId,
            record.deliveryId,
            record.eventType,
            record.decision,
            record.confidence,
            record.reasoning,
            JSON.stringify(record.riskFactors),
            record.riskScore,
            record.amount,
            record.recipient,
            record.txHash          ?? null,
            record.blockNumber     ?? null,
            record.agentWalletBalance,
            record.retryCount,
            record.scheduledRetryAt ?? null,
        ]
    );
    return Number(result.lastInsertRowid);
}

export function updateDecisionTx(eventHash: string, txHash: string, blockNumber: number) {
    getDb().run(
        `UPDATE decisions SET tx_hash = ?, block_number = ? WHERE event_hash = ?`,
        [txHash, blockNumber, eventHash]
    );
}

export function updateDecisionRetry(eventHash: string, retryCount: number, scheduledAt: string) {
    getDb().run(
        `UPDATE decisions SET retry_count = ?, scheduled_retry_at = ? WHERE event_hash = ?`,
        [retryCount, scheduledAt, eventHash]
    );
}

// ── Read ──────────────────────────────────────────────────────────────────

export function getDecisions(limit = 50, offset = 0): DecisionRecord[] {
    const rows = getDb()
        .query(`SELECT * FROM decisions ORDER BY timestamp DESC LIMIT ? OFFSET ?`)
        .all(limit, offset) as Record<string, unknown>[];
    return rows.map(deserialize);
}

export function getPendingWaits(): DecisionRecord[] {
    const now  = new Date().toISOString();
    const rows = getDb()
        .query(`
            SELECT * FROM decisions
            WHERE  decision = 'WAIT'
            AND    tx_hash IS NULL
            AND    retry_count < 5
            AND    (scheduled_retry_at IS NULL OR scheduled_retry_at <= ?)
            ORDER  BY timestamp ASC
        `)
        .all(now) as Record<string, unknown>[];
    return rows.map(deserialize);
}

export function getDecisionByHash(eventHash: string): DecisionRecord | null {
    const row = getDb()
        .query(`SELECT * FROM decisions WHERE event_hash = ?`)
        .get(eventHash) as Record<string, unknown> | null;
    return row ? deserialize(row) : null;
}

export function getStats() {
    return getDb().query(`
        SELECT
            COUNT(*)                                                          AS total,
            SUM(CASE WHEN decision = 'PAY'    THEN 1 ELSE 0 END)            AS paid,
            SUM(CASE WHEN decision = 'WAIT'   THEN 1 ELSE 0 END)            AS waiting,
            SUM(CASE WHEN decision = 'REJECT' THEN 1 ELSE 0 END)            AS rejected,
            SUM(CASE WHEN tx_hash IS NOT NULL THEN CAST(amount AS REAL) ELSE 0 END) AS total_settled_usdt
        FROM decisions
    `).get() as {
        total: number;
        paid: number;
        waiting: number;
        rejected: number;
        total_settled_usdt: number;
    };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function deserialize(row: Record<string, unknown>): DecisionRecord {
    return {
        id:                 row.id                  as number,
        eventHash:          row.event_hash          as string,
        escrowId:           row.escrow_id           as string,
        deliveryId:         row.delivery_id         as string,
        eventType:          row.event_type          as DecisionRecord["eventType"],
        decision:           row.decision            as DecisionRecord["decision"],
        confidence:         row.confidence          as number,
        reasoning:          row.reasoning           as string,
        riskFactors:        JSON.parse((row.risk_factors as string) || "[]"),
        riskScore:          row.risk_score          as number,
        amount:             row.amount              as string,
        recipient:          row.recipient           as string,
        txHash:             (row.tx_hash            as string) ?? undefined,
        blockNumber:        (row.block_number       as number) ?? undefined,
        agentWalletBalance: row.agent_wallet_balance as string,
        retryCount:         row.retry_count         as number,
        scheduledRetryAt:   (row.scheduled_retry_at as string) ?? undefined,
        timestamp:          row.timestamp           as string,
    };
}
