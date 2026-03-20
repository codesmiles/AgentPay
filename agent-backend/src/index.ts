import { Queue } from "bullmq";
import { handleRoutes } from "./routes";
import { getDb }        from "./db/schema";

const REDIS = {
    host: process.env["REDIS_HOST"] ?? "127.0.0.1",
    port: Number(process.env["REDIS_PORT"] ?? 6379),
};

// Initialize SQLite decision ledger
getDb();
console.log("📦 Decision ledger ready (SQLite/WAL)");

// Payment queue — the worker process consumes this
const paymentQueue = new Queue("payments", { connection: REDIS });

// API gateway
const server = Bun.serve({
    port: process.env["PORT"] ?? 3001,
    async fetch(req) {
        return handleRoutes(req, paymentQueue);
    },
});

console.log(`🚀 AgentPay API live at ${server.url}`);
console.log(`🔑 Agent wallet : ${process.env["PRIVATE_KEY"] ? "✅ set" : "❌ MISSING"}`);
console.log(`🧠 OpenAI key   : ${process.env["OPENAI_API_KEY"] ? "✅ set" : "❌ MISSING"}`);
console.log(`⛓️  Contract     : ${process.env["CONTRACT_ADDRESS"] ?? "❌ MISSING"}`);
console.log(`📮 USDT token   : ${process.env["USDT_ADDRESS"] ?? "❌ MISSING"}`);
