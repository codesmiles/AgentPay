import { Worker } from "bullmq";
import { ethers } from "ethers";
import { reasonAboutPayment } from "../services/reasoning";
import { Database } from "bun:sqlite";

const db = new Database("agent_memory.sqlite");
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS!, ABI, wallet);

export const agentWorker = new Worker("agent-tasks", async (job) => {
    const { deliveryId, amount, recipient, metadata } = job.data;

    // 1. Hard Rules Check (Deterministic)
    if (amount > 100) return { status: "REJECTED", reason: "Over Limit" };

    // 2. AI Reasoning (Probabilistic)
    const analysis = await reasonAboutPayment(metadata, "Max $100 per tx, only 'completed' status allowed.");

    // 3. Update Memory
    db.run("INSERT INTO logs (deliveryId, reasoning, decision) VALUES (?, ?, ?)",
        [deliveryId, analysis.reason, analysis.decision]);

    if (analysis.decision === "PAY" && analysis.confidence > 0.8) {
        // 4. Onchain Settlement
        const tx = await contract.releasePayment(deliveryId, recipient, ethers.parseUnits(amount.toString(), 6));
        await tx.wait();

        db.run("UPDATE logs SET txHash = ? WHERE deliveryId = ?", [tx.hash, deliveryId]);
        return { status: "PAID", tx: tx.hash };
    }

    return { status: "HELD", reason: analysis.reason };
}, { connection: redisConfig });