import hre from "hardhat";
import { ethers } from "ethers";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Helpers ───────────────────────────────────────────────────────────────
function updateEnv(filePath: string, updates: Record<string, string>) {
    let content = "";
    try { content = fs.readFileSync(filePath, "utf8"); } catch { content = ""; }
    for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*`, "m");
        content = regex.exec(content)
            ? content.replace(regex, `${key}=${value}`)
            : content + `\n${key}=${value}`;
    }
    fs.writeFileSync(filePath, content.trim() + "\n");
    console.log(`  📝 ${path.basename(filePath)}`);
}

async function deployContract(
    name: string,
    wallet: ethers.Wallet,
    args: unknown[]
): Promise<ethers.Contract> {
    const artifact = await hre.artifacts.readArtifact(name);
    const factory  = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();
    return contract;
}

// ── Main ──────────────────────────────────────────────────────────────────
const privateKey = process.env.PRIVATE_KEY
    ?? "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";

const provider = new ethers.JsonRpcProvider(rpcUrl);
const deployer = new ethers.Wallet(privateKey, provider);
const ethBalance = await provider.getBalance(deployer.address);

console.log("━".repeat(55));
console.log("🚀 AgentPay Deployment");
console.log("━".repeat(55));
console.log(`Deployer:    ${deployer.address}`);
console.log(`ETH balance: ${ethers.formatEther(ethBalance)} ETH`);
console.log("");

// 1. Deploy MockUSDT
console.log("📦 [1/2] Deploying MockUSDT...");
const mockUsdt   = await deployContract("MockUSDT", deployer, [deployer.address]);
const usdtAddress = await mockUsdt.getAddress();
const usdtAbi    = ["function balanceOf(address) view returns (uint256)",
                     "function approve(address,uint256) returns (bool)"];
const usdtContract = new ethers.Contract(usdtAddress, usdtAbi, deployer);
const usdtBalance  = await usdtContract.balanceOf(deployer.address);
console.log(`  ✅ MockUSDT:       ${usdtAddress}`);
console.log(`  💰 Deployer USDT:  ${ethers.formatUnits(usdtBalance as bigint, 6)} mUSDT`);

// 2. Deploy AgentPayEscrow
console.log("\n📦 [2/2] Deploying AgentPayEscrow...");
const escrow        = await deployContract("AgentPayEscrow", deployer, [usdtAddress, deployer.address]);
const escrowAddress = await escrow.getAddress();
console.log(`  ✅ AgentPayEscrow: ${escrowAddress}`);

// 3. Seed demo escrow (10,000 mUSDT)
console.log("\n💸 Seeding demo escrow (10,000 mUSDT)...");
const seedAmount = ethers.parseUnits("10000", 6);
await (await usdtContract.approve(escrowAddress, seedAmount)).wait();

const escrowAbi = ["function deposit(string,address,uint256,uint8,uint256,string) external"];
const escrowContract = new ethers.Contract(escrowAddress, escrowAbi, deployer);
await (await escrowContract.deposit(
    "escrow-demo-001",
    deployer.address,   // recipient = agent wallet for demo
    seedAmount,
    0,                  // PaymentType.Full
    0,
    "ipfs://agentpay-demo"
)).wait();
console.log(`  ✅ Demo escrow funded: escrow-demo-001  (10,000 mUSDT)`);

// 4. Sync addresses — Docker shared volume (primary) + local .env files (fallback)
console.log("\n🔗 Syncing addresses...");

// Docker mode: write to shared volume so agent-api/worker entrypoint.sh can source it
const sharedDir = "/shared";
if (fs.existsSync(sharedDir)) {
    const sharedEnv = `CONTRACT_ADDRESS=${escrowAddress}\nUSDT_ADDRESS=${usdtAddress}\n`;
    fs.writeFileSync(path.join(sharedDir, "contracts.env"), sharedEnv);
    console.log(`  📋 /shared/contracts.env  (Docker shared volume)`);
}

// Local dev mode: update the .env files in the repo
const backendEnvPath  = path.join(__dirname, "../../agent-backend/.env");
const frontendEnvPath = path.join(__dirname, "../../dashboard/.env");

updateEnv(backendEnvPath, {
    RPC_URL:          rpcUrl,
    PRIVATE_KEY:      privateKey,
    CONTRACT_ADDRESS: escrowAddress,
    USDT_ADDRESS:     usdtAddress,
    REDIS_HOST:       process.env.REDIS_HOST ?? "127.0.0.1",
    REDIS_PORT:       process.env.REDIS_PORT ?? "6379",
});
updateEnv(frontendEnvPath, {
    NEXT_PUBLIC_API_URL:          "http://localhost:3001",
    NEXT_PUBLIC_CONTRACT_ADDRESS: escrowAddress,
    NEXT_PUBLIC_USDT_ADDRESS:     usdtAddress,
});

console.log("\n" + "━".repeat(55));
console.log("🎉 Deployment complete!");
console.log("━".repeat(55));
console.log(`MockUSDT:        ${usdtAddress}`);
console.log(`AgentPayEscrow:  ${escrowAddress}`);
console.log(`Demo escrow ID:  escrow-demo-001`);
console.log("\nNext → trigger the agent:");
console.log(`  curl -X POST http://localhost:3001/webhook/delivery \\`);
console.log(`    -H 'Content-Type: application/json' \\`);
console.log(`    -d '{"deliveryId":"del-001","escrowId":"escrow-demo-001","amount":"50.00","recipient":"${deployer.address}","status":"completed"}'`);
