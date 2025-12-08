// index.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import { runSyncProductMaster } from "./jobs/syncProductMaster.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("MONGO_URI is not set in environment (check .env). Exiting.");
  process.exit(1);
}

// Mongoose connection options
const mongooseOpts = {
  // short serverSelectionTimeout so connect() fails fast when DB unreachable
  serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || "5000", 10),
  // socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS || "45000", 10),
  // useUnifiedTopology is automatic in modern mongoose; keep defaults for node 18+
  // you may add authSource, replicaSet, etc. if needed
};

async function connectWithRetry(maxRetries = 5) {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt += 1;
    try {
      console.log(`[db] attempt ${attempt} connecting to MongoDB...`);
      // Optionally disable buffering so operations fail fast if not connected:
      // mongoose.set("bufferCommands", false);
      await mongoose.connect(MONGO_URI, mongooseOpts);
      console.log("[db] connected to MongoDB");
      return;
    } catch (err) {
      console.error(`[db] connection attempt ${attempt} failed:`, err.message || err);
      if (attempt >= maxRetries) {
        throw err;
      }
      // Exponential backoff with jitter
      const backoffMs = Math.min(30000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 200);
      console.log(`[db] retrying in ${backoffMs}ms...`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
}

async function main() {
  console.log(`Starting sync-product-master | NODE_ENV=${process.env.NODE_ENV || "dev"}`);

  try {
    await connectWithRetry(parseInt(process.env.MONGO_CONNECT_MAX_RETRIES || "5", 10));

    // Optional: ensure mongoose connected state
    if (mongoose.connection.readyState !== 1) {
      throw new Error("mongoose did not reach connected state after connect()");
    }

    // Run the job
    await runSyncProductMaster();

    console.log("✅ Sync completed successfully");
    // Close DB connection gracefully
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Sync failed:", err);
    // Try to close connection if open
    try {
      await mongoose.disconnect();
    } catch (e) {
      console.warn("Error while disconnecting mongoose:", e.message || e);
    }
    process.exit(1);
  }
}

// handle signals gracefully
process.on("SIGINT", async () => {
  console.log("SIGINT received — shutting down");
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(0);
});
process.on("SIGTERM", async () => {
  console.log("SIGTERM received — shutting down");
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(0);
});

main();
