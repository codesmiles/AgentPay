import { createHash } from "node:crypto";
import type { DeliveryEvent, FraudSignals } from "../types";

// Simulated fraud address blacklist (production: fetch from threat-intel service)
const BLACKLISTED_ADDRESSES = new Set([
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000001",
]);

// In-memory rate tracking per recipient (production: use Redis with TTL)
const deliveryLog = new Map<string, number[]>();

export function analyzeFraudSignals(event: DeliveryEvent): FraudSignals {
    const signals: string[] = [];
    let score = 0;

    const recipient = (event.recipient ?? "").toLowerCase();
    const amount    = Number.parseFloat(event.amount ?? "0");

    // 1. Blacklisted address
    if (BLACKLISTED_ADDRESSES.has(recipient)) {
        signals.push("recipient_on_fraud_blacklist");
        score += 100;
    }

    // 2. Zero-address recipient
    if (!event.recipient || event.recipient === "0x0000000000000000000000000000000000000000") {
        signals.push("zero_address_recipient");
        score += 100;
    }

    // 3. Missing required fields
    if (!event.deliveryId || !event.escrowId) {
        signals.push("missing_required_identifiers");
        score += 60;
    }

    // 4. Invalid delivery ID format (must be 8–64 alphanumeric/dash/underscore chars)
    if (!/^[a-zA-Z0-9\-_]{4,64}$/.test(event.deliveryId ?? "")) {
        signals.push("invalid_delivery_id_format");
        score += 20;
    }

    // 5. Invalid status for payment
    const validStatuses = ["completed", "milestone_reached"];
    if (!validStatuses.includes(event.status ?? "")) {
        signals.push(`invalid_status_for_payment:${event.status}`);
        score += 45;
    }

    // 6. Unreasonably large amount
    if (amount > 9_000) {
        signals.push(`large_amount:${amount}_usdt`);
        score += 25;
    }

    // 7. Suspiciously round amount (e.g. exactly 5000.00) over threshold
    if (amount >= 100 && amount % 100 === 0) {
        signals.push("round_number_amount");
        score += 8;
    }

    // 8. High-frequency rate limiting per recipient
    const now        = Date.now();
    const history    = deliveryLog.get(recipient) ?? [];
    const last60s    = history.filter(t => now - t < 60_000);
    const last24h    = history.filter(t => now - t < 86_400_000);

    if (last60s.length >= 3) {
        signals.push("high_frequency_same_recipient_60s");
        score += 40;
    }
    if (last24h.length >= 20) {
        signals.push("exceeds_daily_delivery_limit");
        score += 30;
    }

    // Update log (keep only last 24h)
    deliveryLog.set(recipient, [...last24h, now]);

    const cappedScore = Math.min(score, 100);
    return {
        isSuspicious: cappedScore > 30,
        score:        cappedScore,
        signals,
    };
}

/** Canonical SHA-256 of the event's identifying fields — used as idempotency key */
export function hashEvent(event: DeliveryEvent): string {
    const canonical = JSON.stringify({
        deliveryId: event.deliveryId,
        escrowId:   event.escrowId,
        amount:     event.amount,
        recipient:  event.recipient,
        eventType:  event.eventType,
    });
    return createHash("sha256").update(canonical).digest("hex");
}
