import OpenAI from 'openai';
import { ethers } from 'ethers';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Setup a read-only provider to check the contract state
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "http://127.0.0.1:8545");
const ABI = ["function processedDeliveries(string) public view returns (bool)"];
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS!, ABI, provider);

export async function evaluatePayment(eventData: any) {
    const { deliveryId, amount } = eventData;

    // 1. Blockchain Guardrail: Check for Double Payment (Ethers)
    // We check the contract's mapping before even calling the AI to save API credits
    const alreadyPaid = await contract.processedDeliveries(deliveryId);
    if (alreadyPaid) {
        return { shouldPay: false, reason: "On-chain record shows this ID is already settled." };
    }

    // 2. Blockchain Guardrail: Check Escrow Balance (Ethers)
    const balance = await provider.getBalance(process.env.CONTRACT_ADDRESS!);
    const amountInWei = ethers.parseEther(amount.toString());

    if (balance < amountInWei) {
        return { shouldPay: false, reason: `Insufficient contract balance. Needs ${amount} ETH.` };
    }

    // 3. Business Logic Constraints
    if (eventData.status !== 'completed') {
        return { shouldPay: false, reason: "Delivery status is not 'completed'." };
    }

    if (amount > 50) {
        return { shouldPay: false, reason: "Amount exceeds the $50 autonomous threshold." };
    }

    // 4. AI Reasoning (The "Judgment")
    const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
            { role: "system", content: "You are a financial controller AI. Analyze delivery data and decide if payment is earned. Be strict about delivery evidence." },
            { role: "user", content: `Context: ${JSON.stringify(eventData)}. Should we pay? Return JSON: {reason: string, approved: boolean}` }
        ],
        response_format: { type: "json_object" }
    });

    const decision = JSON.parse(completion.choices[0]?.message.content || "{}");

    return {
        shouldPay: decision.approved,
        reason: decision.reason || "AI failed to provide a reason."
    };
}