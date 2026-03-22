import WDK from "@tetherto/wdk";
import WalletManagerEvm from "@tetherto/wdk-wallet-evm";
import { ethers } from "ethers";

const USDT_ABI = [
    "function balanceOf(address) view returns (uint256)",
];

export class WDKAgentWallet {
    private readonly wdk: WDK;
    private readonly seedPhrase: string;
    private readonly rpcUrl: string;
    private accountPromise: Promise<any> | null = null;

    constructor() {
        this.seedPhrase = process.env.WDK_SEED_PHRASE || WDK.getRandomSeedPhrase();
        this.rpcUrl = process.env["RPC_URL"] ?? "http://127.0.0.1:8545";

        this.wdk = new WDK(this.seedPhrase).registerWallet("ethereum", WalletManagerEvm, {
            provider: this.rpcUrl,
        });
    }

    private async getAccount() {
        this.accountPromise ??= this.wdk.getAccount("ethereum", 0);
        return this.accountPromise;
    }

    async getAddress(): Promise<string> {
        const account = await this.getAccount();
        return await account.getAddress();
    }

    getProvider(): ethers.JsonRpcProvider {
        return new ethers.JsonRpcProvider(this.rpcUrl);
    }

    async getSigner() {
        return await this.getAccount();
    }

    get wdkInstance(): WDK {
        return this.wdk;
    }

    async getEthBalance(): Promise<string> {
        try {
            const account = await this.getAccount();
            const balance = await account.getBalance();
            return ethers.formatEther(balance);
        } catch (error) {
            console.error("Error getting ETH balance:", error);
            return "0";
        }
    }

    async getUsdtBalance(): Promise<string> {
        if (!process.env["USDT_ADDRESS"]) return "0";

        try {
            const provider = this.getProvider();
            const address = await this.getAddress();
            const contract = new ethers.Contract(process.env["USDT_ADDRESS"], USDT_ABI, provider);
            const bal = await contract["balanceOf"](address) as bigint;
            return ethers.formatUnits(bal, 6);
        } catch (error) {
            console.error("Error getting USDT balance:", error);
            return "0";
        }
    }

    async getContractUsdtBalance(): Promise<string> {
        if (!process.env["USDT_ADDRESS"] || !process.env["CONTRACT_ADDRESS"]) return "0";

        try {
            const provider = this.getProvider();
            const contract = new ethers.Contract(process.env["USDT_ADDRESS"], USDT_ABI, provider);
            const bal = await contract["balanceOf"](process.env["CONTRACT_ADDRESS"]) as bigint;
            return ethers.formatUnits(bal, 6);
        } catch (error) {
            console.error("Error getting contract USDT balance:", error);
            return "0";
        }
    }

    async isLowOnGas(thresholdEth = "0.01"): Promise<boolean> {
        const balance = await this.getEthBalance();
        const threshold = ethers.parseEther(thresholdEth);
        return ethers.parseEther(balance) < threshold;
    }

    async sendUsdt(recipient: string, amount: string): Promise<string> {
        if (!process.env["USDT_ADDRESS"]) {
            throw new Error("USDT contract not initialized");
        }

        try {
            const account = await this.getAccount();
            const amountWei = ethers.parseUnits(amount, 6);
            const tx = await account.transfer({
                token: process.env["USDT_ADDRESS"],
                recipient,
                amount: amountWei,
            });
            return tx.hash;
        } catch (error) {
            console.error("Error sending USDT:", error);
            throw error;
        }
    }

    async approveUsdt(spender: string, amount: string): Promise<string> {
        if (!process.env["USDT_ADDRESS"]) {
            throw new Error("USDT contract not initialized");
        }

        try {
            const account = await this.getAccount();
            const amountWei = ethers.parseUnits(amount, 6);
            const tx = await account.approve({
                token: process.env["USDT_ADDRESS"],
                spender,
                amount: amountWei,
            });
            return tx.hash;
        } catch (error) {
            console.error("Error approving USDT:", error);
            throw error;
        }
    }

    async getStatus() {
        try {
            const account = await this.getAccount();
            const provider = this.getProvider();
            const address = await account.getAddress();
            const network = await provider.getNetwork();
            const [ethBalance, usdtBalance, lowGas] = await Promise.all([
                this.getEthBalance(),
                this.getUsdtBalance(),
                this.isLowOnGas(),
            ]);

            return {
                address,
                ethBalance,
                usdtBalance,
                lowGas,
                network: network.name,
                chainId: Number(network.chainId),
                seedPhraseGenerated: !process.env.WDK_SEED_PHRASE,
                walletType: "WDK-MultiChain",
            };
        } catch (error) {
            console.error("Error getting wallet status:", error);
            return {
                address: "unknown",
                ethBalance: "0",
                usdtBalance: "0",
                lowGas: true,
                network: "unknown",
                chainId: 0,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    async getSupportedChains(): Promise<string[]> {
        return ["ethereum"];
    }

    getSeedPhrase(): string {
        return this.seedPhrase;
    }
}

export const wdkAgentWallet = new WDKAgentWallet();
