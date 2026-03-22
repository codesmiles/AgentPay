import { ethers } from "ethers";
import { wdkAgentWallet } from "./wdkWallet.js";

const USDT_ABI = [
    "function balanceOf(address) view returns (uint256)",
];

export class AgentWallet {
    private readonly wdkWallet = wdkAgentWallet;

    constructor() {
        // WDK wallet is initialized as singleton

    }

    async getAddress(): Promise<string> {
        return this.wdkWallet.getAddress();
    }

    async getSigner() {
        return this.wdkWallet.getSigner();
    }

    get provider(): ethers.JsonRpcProvider {
        return this.wdkWallet.getProvider();
    }

    async getEthBalance(): Promise<string> {
        return this.wdkWallet.getEthBalance();
    }

    async getUsdtBalance(): Promise<string> {
        return this.wdkWallet.getUsdtBalance();
    }

    async getContractUsdtBalance(): Promise<string> {
        return this.wdkWallet.getContractUsdtBalance();
    }

    async isLowOnGas(thresholdEth = "0.01"): Promise<boolean> {
        return this.wdkWallet.isLowOnGas(thresholdEth);
    }

    async getStatus() {
        const status = await this.wdkWallet.getStatus();
        return {
            ...status,
            // Add legacy fields for compatibility
            provider: status.network,
        };
    }

    // WDK-specific methods
    async sendUsdt(recipient: string, amount: string): Promise<string> {
        return this.wdkWallet.sendUsdt(recipient, amount);
    }

    async approveUsdt(spender: string, amount: string): Promise<string> {
        return this.wdkWallet.approveUsdt(spender, amount);
    }

    getSupportedChains(): Promise<string[]> {
        return this.wdkWallet.getSupportedChains();
    }

    getSeedPhrase(): string {
        return this.wdkWallet.getSeedPhrase();
    }

    getWdkInstance() {
        return this.wdkWallet.wdkInstance;
    }
}

// Singleton — shared across the process
export const agentWallet = new AgentWallet();
