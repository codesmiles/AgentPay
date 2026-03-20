"use client";

import { useEffect, useState, useCallback } from "react";

const API = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";
const POLL_MS = 4_000;

// ── Types ─────────────────────────────────────────────────────────────────

interface Decision {
    id:                 number;
    eventHash:          string;
    escrowId:           string;
    deliveryId:         string;
    eventType:          string;
    decision:           "PAY" | "WAIT" | "REJECT";
    confidence:         number;
    reasoning:          string;
    riskFactors:        string[];
    riskScore:          number;
    amount:             string;
    recipient:          string;
    txHash?:            string;
    blockNumber?:       number;
    agentWalletBalance: string;
    retryCount:         number;
    timestamp:          string;
}

interface Stats {
    total:              number;
    paid:               number;
    waiting:            number;
    rejected:           number;
    total_settled_usdt: number;
}

interface AgentStatus {
    status:   string;
    contract: string;
    wallet: {
        address:    string;
        ethBalance: string;
        usdtBalance:string;
        lowGas:     boolean;
        network:    string;
    };
    queue: { depth: number };
}

// ── Styles ────────────────────────────────────────────────────────────────

const S = {
    header: {
        background:  "linear-gradient(135deg,#0d1117 0%,#161b22 100%)",
        borderBottom:"1px solid #30363d",
        padding:     "20px 32px",
        display:     "flex",
        alignItems:  "center",
        gap:         16,
    } as React.CSSProperties,

    card: (color = "#30363d"): React.CSSProperties => ({
        background:   "#0d1117",
        border:       `1px solid ${color}`,
        borderRadius: 10,
        padding:      "18px 22px",
    }),

    badge: (d: "PAY" | "WAIT" | "REJECT"): React.CSSProperties => {
        const map = {
            PAY:    { bg: "#0f2a1d", color: "#3fb950", border: "#238636" },
            WAIT:   { bg: "#1f1d0d", color: "#d29922", border: "#9e6a03" },
            REJECT: { bg: "#2a0f0f", color: "#f85149", border: "#da3633" },
        };
        const c = map[d];
        return {
            background:   c.bg,
            color:        c.color,
            border:       `1px solid ${c.border}`,
            borderRadius: 6,
            padding:      "2px 10px",
            fontSize:     12,
            fontWeight:   700,
            letterSpacing:1,
        };
    },
} as const;

// ── Components ────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
    return (
        <div style={{ ...S.card(color), textAlign: "center", minWidth: 130 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 11, color: "#8b949e", marginTop: 4, letterSpacing: 1 }}>{label}</div>
        </div>
    );
}

function ConfidenceBar({ pct }: { pct: number }) {
    const color = pct >= 80 ? "#3fb950" : pct >= 50 ? "#d29922" : "#f85149";
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: 6, background: "#21262d", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width .4s" }} />
            </div>
            <span style={{ fontSize: 11, color, minWidth: 32 }}>{pct}%</span>
        </div>
    );
}

function DecisionRow({ d }: { d: Decision }) {
    const [expanded, setExpanded] = useState(false);
    const ts = new Date(d.timestamp).toLocaleTimeString();

    return (
        <div style={{ ...S.card(), marginBottom: 10, cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={S.badge(d.decision)}>{d.decision}</span>

                <span style={{ color: "#58a6ff", fontSize: 13 }}>{d.deliveryId}</span>
                <span style={{ color: "#8b949e", fontSize: 12 }}>escrow: {d.escrowId}</span>

                <span style={{ marginLeft: "auto", color: "#3fb950", fontWeight: 700 }}>
                    ${d.amount} USDT
                </span>
                <span style={{ color: "#8b949e", fontSize: 11 }}>{ts}</span>
                <span style={{ color: "#8b949e", fontSize: 11 }}>{expanded ? "▲" : "▼"}</span>
            </div>

            <div style={{ marginTop: 8 }}>
                <ConfidenceBar pct={d.confidence} />
            </div>

            {expanded && (
                <div style={{ marginTop: 14, fontSize: 13, lineHeight: 1.7 }}>
                    <div style={{ color: "#c9d1d9", marginBottom: 8 }}>
                        <span style={{ color: "#8b949e" }}>Reasoning: </span>{d.reasoning}
                    </div>

                    {d.riskFactors.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                            <span style={{ color: "#8b949e" }}>Risk factors: </span>
                            {d.riskFactors.map(r => (
                                <span key={r} style={{ background: "#2a0f0f", color: "#f85149", borderRadius: 4, padding: "1px 7px", marginRight: 5, fontSize: 11 }}>
                                    {r}
                                </span>
                            ))}
                        </div>
                    )}

                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", color: "#8b949e", fontSize: 12 }}>
                        <span>Risk score: <span style={{ color: "#d29922" }}>{d.riskScore}/100</span></span>
                        <span>Recipient: <span style={{ color: "#58a6ff" }}>{d.recipient.slice(0, 10)}…</span></span>
                        <span>Gas: {d.agentWalletBalance} ETH</span>
                        {d.retryCount > 0 && <span>Retries: {d.retryCount}</span>}
                    </div>

                    {d.txHash && (
                        <div style={{ marginTop: 10, padding: "8px 12px", background: "#0f2a1d", borderRadius: 6, fontSize: 12 }}>
                            ✅ <span style={{ color: "#8b949e" }}>TX: </span>
                            <span style={{ color: "#3fb950", fontFamily: "monospace" }}>{d.txHash}</span>
                            {d.blockNumber && <span style={{ color: "#8b949e" }}> · block {d.blockNumber}</span>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function Dashboard() {
    const [decisions, setDecisions] = useState<Decision[]>([]);
    const [stats,     setStats]     = useState<Stats | null>(null);
    const [agent,     setAgent]     = useState<AgentStatus | null>(null);
    const [lastPoll,  setLastPoll]  = useState<string>("");
    const [filter,    setFilter]    = useState<"ALL" | "PAY" | "WAIT" | "REJECT">("ALL");

    const fetchData = useCallback(async () => {
        try {
            const [decRes, statusRes] = await Promise.all([
                fetch(`${API}/agent/decisions?limit=100`),
                fetch(`${API}/agent/status`),
            ]);
            if (decRes.ok) {
                const body = await decRes.json() as { decisions: Decision[]; stats: Stats };
                setDecisions(body.decisions);
                setStats(body.stats);
            }
            if (statusRes.ok) {
                const body = await statusRes.json() as { agent: AgentStatus };
                setAgent(body.agent);
            }
            setLastPoll(new Date().toLocaleTimeString());
        } catch { /* API offline */ }
    }, []);

    useEffect(() => {
        void fetchData();
        const t = setInterval(() => { void fetchData(); }, POLL_MS);
        return () => clearInterval(t);
    }, [fetchData]);

    const shown = filter === "ALL" ? decisions : decisions.filter(d => d.decision === filter);

    return (
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px 40px" }}>

            {/* Header */}
            <div style={S.header}>
                <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#58a6ff,#3fb950)", borderRadius: 8 }} />
                <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#e6edf3" }}>AgentPay</div>
                    <div style={{ fontSize: 11, color: "#8b949e" }}>Autonomous USDT Settlement Agent</div>
                </div>
                <div style={{ marginLeft: "auto", fontSize: 11, color: "#8b949e" }}>
                    {agent ? (
                        <span style={{ color: "#3fb950" }}>● {agent.status}</span>
                    ) : (
                        <span style={{ color: "#f85149" }}>● OFFLINE</span>
                    )}
                    {lastPoll && <span style={{ marginLeft: 10 }}>last poll {lastPoll}</span>}
                </div>
            </div>

            <div style={{ padding: "24px 0" }}>

                {/* Agent wallet status */}
                {agent?.wallet && (
                    <div style={{ ...S.card("#30363d"), marginBottom: 20, fontSize: 13 }}>
                        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
                            <div>
                                <span style={{ color: "#8b949e" }}>Agent wallet </span>
                                <span style={{ color: "#58a6ff" }}>{agent.wallet.address.slice(0, 8)}…{agent.wallet.address.slice(-6)}</span>
                            </div>
                            <div><span style={{ color: "#8b949e" }}>ETH </span><span style={{ color: agent.wallet.lowGas ? "#f85149" : "#3fb950" }}>{agent.wallet.ethBalance}</span></div>
                            <div><span style={{ color: "#8b949e" }}>USDT </span><span style={{ color: "#c9d1d9" }}>{agent.wallet.usdtBalance}</span></div>
                            <div><span style={{ color: "#8b949e" }}>Network </span><span style={{ color: "#d29922" }}>{agent.wallet.network}</span></div>
                            <div><span style={{ color: "#8b949e" }}>Queue depth </span><span style={{ color: "#c9d1d9" }}>{agent.queue.depth}</span></div>
                        </div>
                    </div>
                )}

                {/* Stats */}
                {stats && (
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
                        <StatCard label="TOTAL DECISIONS"   value={stats.total}                                           color="#58a6ff" />
                        <StatCard label="PAID"              value={stats.paid}                                            color="#3fb950" />
                        <StatCard label="WAITING"           value={stats.waiting}                                         color="#d29922" />
                        <StatCard label="REJECTED"          value={stats.rejected}                                        color="#f85149" />
                        <StatCard label="USDT SETTLED"      value={`$${(stats.total_settled_usdt ?? 0).toFixed(2)}`}     color="#3fb950" />
                    </div>
                )}

                {/* Filter bar */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    {(["ALL","PAY","WAIT","REJECT"] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)} style={{
                            background:   filter === f ? "#21262d" : "transparent",
                            border:       `1px solid ${filter === f ? "#58a6ff" : "#30363d"}`,
                            color:        filter === f ? "#58a6ff" : "#8b949e",
                            borderRadius: 6, padding: "4px 14px", cursor: "pointer", fontSize: 12,
                        }}>{f}</button>
                    ))}
                    <span style={{ marginLeft: "auto", color: "#8b949e", fontSize: 12, alignSelf: "center" }}>
                        {shown.length} decision{shown.length !== 1 ? "s" : ""}
                    </span>
                </div>

                {/* Decision feed */}
                {shown.length === 0 ? (
                    <div style={{ ...S.card(), textAlign: "center", color: "#8b949e", padding: 40 }}>
                        No decisions yet — trigger a webhook to see the agent reason in real time.
                        <div style={{ marginTop: 12, fontSize: 12 }}>
                            <code style={{ color: "#58a6ff" }}>curl -X GET {API}/demo/setup</code>
                        </div>
                    </div>
                ) : (
                    shown.map(d => <DecisionRow key={d.id} d={d} />)
                )}
            </div>
        </div>
    );
}
