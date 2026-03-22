import { defineConfig } from "hardhat/config";
import { config as dotenvConfig } from "dotenv";

// Load environment variables
const dotenvConfigResult = dotenvConfig();
if (dotenvConfigResult.error) {
  throw dotenvConfigResult.error;
}

export default defineConfig({
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    localhost: {
      type: "http",
      // RPC_URL env var is set by docker-compose to http://blockchain-node:8545;
      // locally it defaults to the Hardhat node on 127.0.0.1
      url: process.env["RPC_URL"] ?? "http://127.0.0.1:8545",
      chainId: 1337,
    },
    hardhat: {
      type: "edr-simulated",
      chainId: 1337,
    },
    // Add Sepolia for testnet deployment:
    // sepolia: {
    //   url: process.env.SEPOLIA_RPC_URL || "",
    //   accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    // },
  },
  paths: {
    sources: "./contracts",
    artifacts: "./.hardhat-state/artifacts",
    cache: "./.hardhat-state/cache",
  }
});
