import { ethers } from "ethers";

const USDT_ABI = [
    "function balanceOf(address) view returns (uint256)",
];

export class AgentWallet {
    readonly provider: ethers.JsonRpcProvider;
    private readonly wallet: ethers.Wallet;
    private readonly managedSigner: ethers.NonceManager;
    private usdtContract: ethers.Contract | null = null;

    constructor() {
        this.provider = new ethers.JsonRpcProvider(
            process.env["RPC_URL"] ?? "http://127.0.0.1:8545"
        );
        this.wallet = new ethers.Wallet(process.env["PRIVATE_KEY"]!, this.provider);
        this.managedSigner = new ethers.NonceManager(this.wallet);

        if (process.env["USDT_ADDRESS"]) {
            this.usdtContract = new ethers.Contract(
                process.env["USDT_ADDRESS"],
                USDT_ABI,
                this.provider
            );
        }
    }

    get address(): string { return this.wallet.address; }
    get signer():  ethers.NonceManager { return this.managedSigner; }

    async getEthBalance(): Promise<string> {
        const bal = await this.provider.getBalance(this.wallet.address);
        return ethers.formatEther(bal);
    }

    async getUsdtBalance(): Promise<string> {
        if (!this.usdtContract) return "0";
        const bal = await this.usdtContract["balanceOf"](this.wallet.address) as bigint;
        return ethers.formatUnits(bal, 6);
    }

    async getContractUsdtBalance(): Promise<string> {
        if (!this.usdtContract || !process.env["CONTRACT_ADDRESS"]) return "0";
        const bal = await this.usdtContract["balanceOf"](process.env["CONTRACT_ADDRESS"]) as bigint;
        return ethers.formatUnits(bal, 6);
    }

    async isLowOnGas(thresholdEth = "0.01"): Promise<boolean> {
        const bal = await this.provider.getBalance(this.wallet.address);
        return bal < ethers.parseEther(thresholdEth);
    }

    async getStatus() {
        const [ethBalance, usdtBalance, lowGas, network] = await Promise.all([
            this.getEthBalance(),
            this.getUsdtBalance(),
            this.isLowOnGas(),
            this.provider.getNetwork(),
        ]);
        return {
            address:    this.wallet.address,
            ethBalance,
            usdtBalance,
            lowGas,
            network:    network.name,
            chainId:    Number(network.chainId),
        };
    }
}

// Singleton — shared across the process
export const agentWallet = new AgentWallet();
