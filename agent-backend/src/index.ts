import express from 'express';
import { Queue } from "bullmq";
import routes from "./routes";
import { getDb } from "./db/schema";

const REDIS = {
    host: process.env["REDIS_HOST"] ?? "127.0.0.1",
    port: Number(process.env["REDIS_PORT"] ?? 6379),
};

// Initialize SQLite decision ledger
getDb();
console.log("📦 Decision ledger ready (SQLite/WAL)");

// Payment queue — the worker process consumes this
const paymentQueue = new Queue("payments", { connection: REDIS });

// Express app
const app = express();

// Store queue in app locals for routes to access
app.locals.queue = paymentQueue;

// Use routes
app.use('/', routes);

// Start server
const port = process.env.PORT ?? 3001;
app.listen(port, () => {
    console.log(`🚀 AgentPay API live at http://localhost:${port}`);
    console.log(`🔑 Agent wallet : ${process.env["PRIVATE_KEY"]?.length ? "✅ set" : "❌ MISSING"}`);
    console.log("agent wallet:", process.env["PRIVATE_KEY"])
    console.log(`🧠 OpenAI key   : ${process.env["OPENAI_API_KEY"]?.length ? "✅ set" : "❌ MISSING"}`);
    console.log(`🧠 GEMINI key   : ${process.env["GEMINI_API_KEY"]?.length ? "✅ set" : "❌ MISSING"}`);
    console.log(`⛓️  Contract     : ${process.env["CONTRACT_ADDRESS"] ?? "❌ MISSING"}`);
    console.log(`📮 USDT token   : ${process.env["USDT_ADDRESS"] ?? "❌ MISSING"}`);
});
