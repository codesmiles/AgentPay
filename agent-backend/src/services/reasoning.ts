import OpenAI from "openai";
import type { ReasoningInput, ReasoningOutput } from "../types";

const openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"]! });

const SYSTEM_PROMPT = `You are an autonomous financial settlement AI agent for AgentPay.
You control an Ethereum smart-contract escrow that holds USDT. When you decide PAY, real
money moves on-chain — so be precise and accountable.

Decision framework:
- PAY   → delivery proof is credible, fraud risk < 30, funds sufficient, rules satisfied
- WAIT  → status ambiguous, moderate risk (30–60), needs more evidence or time
- REJECT → fraud confirmed (>60), rules violated, invalid proof, or suspicious activity

You must always return valid JSON matching the schema exactly.`;

// Structured output schema (OpenAI strict mode)
const DECISION_SCHEMA = {
    type: "json_schema" as const,
    json_schema: {
        name:   "payment_decision",
        strict: true,
        schema: {
            type: "object",
            properties: {
                decision: {
                    type:        "string",
                    enum:        ["PAY", "WAIT", "REJECT"],
                    description: "The payment decision",
                },
                confidence: {
                    type:        "integer",
                    description: "Confidence score 0-100",
                },
                reasoning: {
                    type:        "string",
                    description: "2-4 sentence audit trail explaining the decision",
                },
                riskFactors: {
                    type:  "array",
                    items: { type: "string" },
                    description: "List of identified risk factors (empty array if none)",
                },
                recommendedAction: {
                    type:        "string",
                    description: "Specific instruction for the execution engine",
                },
            },
            required:             ["decision", "confidence", "reasoning", "riskFactors", "recommendedAction"],
            additionalProperties: false,
        },
    },
};

export async function reasonAboutPayment(input: ReasoningInput): Promise<ReasoningOutput> {
    const { event, escrowBalance, agentWalletBalance, fraudSignals, contractRules } = input;

    // ── Fast-path rejections (no LLM call needed) ─────────────────────────
    if (contractRules.alreadyProcessed) {
        return {
            decision:          "REJECT",
            confidence:        100,
            reasoning:         "Delivery ID already settled on-chain. Rejecting to prevent double payment.",
            riskFactors:       ["duplicate_payment_attempt"],
            recommendedAction: "Skip — already processed on-chain",
        };
    }
    if (!contractRules.isEscrowActive) {
        return {
            decision:          "REJECT",
            confidence:        100,
            reasoning:         "Escrow is not in an active state (may be frozen, refunded, or fully released).",
            riskFactors:       ["escrow_inactive"],
            recommendedAction: "Reject payment — escrow not active",
        };
    }
    if (fraudSignals.score >= 80) {
        return {
            decision:          "REJECT",
            confidence:        95,
            reasoning:         `Fraud score ${fraudSignals.score}/100 exceeds auto-reject threshold. Signals: ${fraudSignals.signals.join(", ")}.`,
            riskFactors:       fraudSignals.signals,
            recommendedAction: "Reject and freeze escrow for manual review",
        };
    }
    if (parseFloat(escrowBalance) <= 0) {
        return {
            decision:          "WAIT",
            confidence:        90,
            reasoning:         "Escrow has insufficient USDT balance for this payment.",
            riskFactors:       ["insufficient_escrow_balance"],
            recommendedAction: "Wait for escrow to be topped up",
        };
    }

    // ── LLM reasoning for nuanced cases ──────────────────────────────────
    const prompt = `Analyze this payment request and make a decision.

EVENT:
${JSON.stringify(event, null, 2)}

FINANCIAL CONTEXT:
- Escrow available balance: $${escrowBalance} USDT
- Requested amount:         $${event.amount} USDT
- Agent gas balance:        ${agentWalletBalance} ETH
- Max TX limit:             $${contractRules.maxTxLimit} USDT

FRAUD ANALYSIS:
- Risk score:  ${fraudSignals.score}/100 ${fraudSignals.score < 30 ? "(LOW)" : fraudSignals.score < 60 ? "(MEDIUM)" : "(HIGH)"}
- Suspicious:  ${fraudSignals.isSuspicious}
- Signals:     ${fraudSignals.signals.length ? fraudSignals.signals.join(", ") : "none"}

Decision guide:
- PAY if status is "completed" or "milestone_reached" AND fraud < 30 AND amount <= balance
- WAIT if status is pending/in_transit or fraud is 30-60
- REJECT if fraud > 60 or amount > balance or status invalid`;

    const response = await openai.chat.completions.create({
        model:           "gpt-4o",
        messages:        [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user",   content: prompt },
        ],
        response_format: DECISION_SCHEMA,
        temperature:     0.1,
    });

    const raw = JSON.parse(response.choices[0]?.message.content ?? "{}");

    return {
        decision:          raw.decision          as ReasoningOutput["decision"],
        confidence:        raw.confidence        as number,
        reasoning:         raw.reasoning         as string,
        riskFactors:       raw.riskFactors       as string[],
        recommendedAction: raw.recommendedAction as string,
    };
}
