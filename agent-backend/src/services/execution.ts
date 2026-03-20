import { ethers } from "ethers";
import { agentWallet } from "./wallet";

// Minimal ABI — only the functions the agent calls
const ESCROW_ABI = [
    "function releasePayment(string escrowId, string deliveryId, uint256 amount) external",
    "function milestonePayment(string escrowId, string deliveryId) external",
    "function splitPayment(string escrowId, string deliveryId, address[] recipients, uint256[] amounts) external",
    "function freezeEscrow(string escrowId, string reason) external",
    "function deposit(string escrowId, address recipient, uint256 amount, uint8 paymentType, uint256 milestoneCount, string metadataHash) external",
    "function processedDeliveries(string) view returns (bool)",
    "function getEscrow(string) view returns (tuple(string escrowId, address depositor, address recipient, uint256 totalAmount, uint256 releasedAmount, uint256 milestoneCount, uint256 milestonesCompleted, uint8 paymentType, uint8 status, uint256 createdAt, string metadataHash))",
    "function getContractBalance() view returns (uint256)",
];

type TxResult = { txHash: string; blockNumber: number };

function getContract(withSigner = false): ethers.Contract {
    const runner  = withSigner ? agentWallet.signer : agentWallet.provider;
    return new ethers.Contract(process.env["CONTRACT_ADDRESS"]!, ESCROW_ABI, runner);
}

// ── Read ──────────────────────────────────────────────────────────────────

export async function isAlreadyProcessed(deliveryId: string): Promise<boolean> {
    return getContract()["processedDeliveries"](deliveryId) as Promise<boolean>;
}

export async function getEscrowState(escrowId: string) {
    try {
        const e = await getContract()["getEscrow"](escrowId) as {
            escrowId: string; depositor: string; recipient: string;
            totalAmount: bigint; releasedAmount: bigint;
            milestoneCount: bigint; milestonesCompleted: bigint;
            paymentType: number; status: number;
        };
        const total    = Number(ethers.formatUnits(e.totalAmount,    6));
        const released = Number(ethers.formatUnits(e.releasedAmount, 6));
        return {
            escrowId:            e.escrowId,
            depositor:           e.depositor,
            recipient:           e.recipient,
            totalAmount:         total.toFixed(6),
            releasedAmount:      released.toFixed(6),
            availableBalance:    (total - released).toFixed(6),
            milestoneCount:      Number(e.milestoneCount),
            milestonesCompleted: Number(e.milestonesCompleted),
            paymentType:         e.paymentType,
            status:              e.status,             // 0=Active,1=Partial,2=Released,3=Refunded,4=Frozen
        };
    } catch {
        return null;
    }
}

// ── Write (agent-signed) ───────────────────────────────────────────────────

export async function executeReleasePayment(
    escrowId:   string,
    deliveryId: string,
    amount:     string
): Promise<TxResult> {
    const contract = getContract(true);
    const amountBn = ethers.parseUnits(amount, 6);
    console.log(`  💸 releasePayment ${amount} USDT | delivery=${deliveryId}`);
    const tx      = await contract["releasePayment"](escrowId, deliveryId, amountBn) as ethers.TransactionResponse;
    console.log(`  🔗 TX: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  ✅ Block ${receipt!.blockNumber}`);
    return { txHash: tx.hash, blockNumber: receipt!.blockNumber };
}

export async function executeMilestonePayment(
    escrowId:   string,
    deliveryId: string
): Promise<TxResult> {
    const contract = getContract(true);
    console.log(`  🎯 milestonePayment | delivery=${deliveryId}`);
    const tx      = await contract["milestonePayment"](escrowId, deliveryId) as ethers.TransactionResponse;
    console.log(`  🔗 TX: ${tx.hash}`);
    const receipt = await tx.wait();
    return { txHash: tx.hash, blockNumber: receipt!.blockNumber };
}

export async function executeSplitPayment(
    escrowId:   string,
    deliveryId: string,
    recipients: string[],
    amounts:    string[]
): Promise<TxResult> {
    const contract   = getContract(true);
    const parsedAmts = amounts.map(a => ethers.parseUnits(a, 6));
    console.log(`  🔀 splitPayment | delivery=${deliveryId} | ${recipients.length} recipients`);
    const tx      = await contract["splitPayment"](escrowId, deliveryId, recipients, parsedAmts) as ethers.TransactionResponse;
    console.log(`  🔗 TX: ${tx.hash}`);
    const receipt = await tx.wait();
    return { txHash: tx.hash, blockNumber: receipt!.blockNumber };
}

export async function executeFreezeEscrow(escrowId: string, reason: string): Promise<string> {
    const contract = getContract(true);
    console.log(`  🔒 freezeEscrow | escrow=${escrowId}`);
    const tx = await contract["freezeEscrow"](escrowId, reason) as ethers.TransactionResponse;
    await tx.wait();
    return tx.hash;
}
