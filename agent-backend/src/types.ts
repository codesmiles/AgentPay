// ── Core domain types for AgentPay ───────────────────────────────────────

export type EventType      = 'delivery' | 'milestone' | 'oracle';
export type PaymentDecision = 'PAY' | 'WAIT' | 'REJECT';

export interface SplitRecipient {
    address: string;
    amount:  string; // human-readable USDT, e.g. "25.00"
}

export interface DeliveryEvent {
    deliveryId:       string;
    escrowId:         string;
    amount:           string; // human-readable USDT, e.g. "100.00"
    recipient:        string; // ETH address of the payee
    status:           string; // 'completed' | 'milestone_reached' | 'pending' | etc.
    eventType:        EventType;
    eventHash?:       string;
    milestoneIndex?:  number;
    splitRecipients?: SplitRecipient[];
    isRetry?:         boolean;
    retryCount?:      number;
    originalEventHash?: string;
    metadata?:        Record<string, unknown>;
}

export interface FraudSignals {
    isSuspicious: boolean;
    score:        number;   // 0-100, higher = riskier
    signals:      string[];
}

export interface ReasoningInput {
    event:              DeliveryEvent;
    escrowBalance:      string; // available USDT in escrow
    agentWalletBalance: string; // agent ETH for gas
    fraudSignals:       FraudSignals;
    contractRules: {
        maxTxLimit:       string;
        isEscrowActive:   boolean;
        alreadyProcessed: boolean;
    };
}

export interface ReasoningOutput {
    decision:          PaymentDecision;
    confidence:        number;   // 0-100
    reasoning:         string;
    riskFactors:       string[];
    recommendedAction: string;
}

export interface DecisionRecord {
    id?:                number;
    eventHash:          string;
    escrowId:           string;
    deliveryId:         string;
    eventType:          EventType;
    decision:           PaymentDecision;
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
    scheduledRetryAt?:  string;
    timestamp:          string;
}

export interface EscrowState {
    escrowId:            string;
    depositor:           string;
    recipient:           string;
    totalAmount:         string;
    releasedAmount:      string;
    availableBalance:    string;
    milestoneCount:      number;
    milestonesCompleted: number;
    paymentType:         number; // 0=Full, 1=Milestone, 2=Split
    status:              number; // 0=Active, 1=Partial, 2=Released, 3=Refunded, 4=Frozen
}
