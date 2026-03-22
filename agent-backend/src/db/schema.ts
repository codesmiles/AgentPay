import { Database } from "bun:sqlite";

let db: Database | null = null;

export function getDb(): Database {
    if (db) return db;

    const dbPath = process.env["DB_PATH"] ?? "agentpay.db";
    db = new Database(dbPath, { create: true });

    // WAL mode: allows concurrent reads while writing
    db.run("PRAGMA journal_mode = WAL;");
    db.run("PRAGMA foreign_keys = ON;");
    db.run("PRAGMA synchronous = NORMAL;");

    initSchema(db);
    return db;
}

function initSchema(db: Database) {
    // ── Decision ledger ───────────────────────────────────────────────────
    db.run(`
        CREATE TABLE IF NOT EXISTS decisions (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            event_hash           TEXT    UNIQUE NOT NULL,
            escrow_id            TEXT    NOT NULL,
            delivery_id          TEXT    NOT NULL,
            event_type           TEXT    NOT NULL,
            decision             TEXT    NOT NULL CHECK(decision IN ('PAY','WAIT','REJECT')),
            confidence           INTEGER NOT NULL,
            reasoning            TEXT    NOT NULL,
            risk_factors         TEXT    NOT NULL DEFAULT '[]',
            risk_score           INTEGER NOT NULL DEFAULT 0,
            amount               TEXT    NOT NULL,
            recipient            TEXT    NOT NULL,
            tx_hash              TEXT,
            block_number         INTEGER,
            agent_wallet_balance TEXT    NOT NULL DEFAULT '0',
            retry_count          INTEGER NOT NULL DEFAULT 0,
            scheduled_retry_at   TEXT,
            timestamp            TEXT    NOT NULL DEFAULT (datetime('now'))
        )
    `);

    // ── Indexes ───────────────────────────────────────────────────────────
    db.run(`CREATE INDEX IF NOT EXISTS idx_dec_ts       ON decisions(timestamp DESC)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_dec_delivery ON decisions(delivery_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_dec_escrow   ON decisions(escrow_id)`);
    // Partial index for scheduler — only WAIT rows needing retry
    db.run(`
        CREATE INDEX IF NOT EXISTS idx_dec_wait
        ON decisions(scheduled_retry_at)
        WHERE decision = 'WAIT' AND tx_hash IS NULL
    `);
}
