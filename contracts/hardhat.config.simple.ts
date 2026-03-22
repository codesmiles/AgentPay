import { defineConfig } from "hardhat/config";
import { config as dotenvConfig } from "dotenv";

dotenvConfig();

export default defineConfig({
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainId: 1337,
    },
    localhost: {
      type: "http",
      url: process.env.RPC_URL ?? "http://127.0.0.1:8545",
      chainId: 1337,
    },
  },
  paths: {
    sources: "./contracts",
    artifacts: "./.hardhat-state/artifacts",
    cache: "./.hardhat-state/cache",
  }
});
