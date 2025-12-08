import dotenv from "dotenv";
import mongoose from "mongoose";
import axios from "axios";
import { runSyncCustomerFleetMaster } from "./jobs/sync_customer_fleet_master.js";

dotenv.config();

// ------------------------------------------------------------------
// ENV CHECK
// ------------------------------------------------------------------
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("MONGO_URI is not set in environment (check .env). Exiting.");
  process.exit(1);
}

const mongooseOpts = {
  serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || "5000", 10),
};

// ------------------------------------------------------------------
// OUTBOUND IP CHECK (using Axios)
// ------------------------------------------------------------------
async function printOutboundIp() {
  try {
    const response = await axios.get("https://api.ipify.org?format=json", {
      timeout: 5000,
      validateStatus: () => true
    });

    if (!response?.data?.ip) {
      console.warn("⚠️ Could not determine outbound IP:", response.data);
      return;
    }

    console.log(`🔎 Outbound IP: ${response.data.ip}`);
  } catch (err) {
    console.warn("⚠️ Failed to fetch outbound IP:", err.message || err);
  }
}

async function connectWithRetry(maxRetries = 5) {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt += 1;
    try {
      console.log(`[db] attempt ${attempt} connecting to MongoDB...`);
      await mongoose.connect(MONGO_URI, mongooseOpts);
      console.log("[db] connected to MongoDB");
      return;
    } catch (err) {
      console.error(`[db] connection attempt ${attempt} failed:`, err.message || err);
      if (attempt >= maxRetries) throw err;
      const backoffMs = Math.min(30000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 200);
      console.log(`[db] retrying in ${backoffMs}ms...`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
}

// ------------------------------------------------------------------
// DISCONNECT HANDLING
// ------------------------------------------------------------------
function isIgnorableDisconnectError(err) {
  if (!err) return false;
  const name = err.name || "";
  const msg = (err && (err.message || err.toString())) || "";

  // Known ignorable driver shutdown messages
  if (
    name === "MongoClientClosedError" ||
    name === "MongoPoolClosedError" ||
    /PoolClosedError|MongoClientClosedError|Attempted to check out a connection from closed connection pool/.test(msg)
  ) {
    return true;
  }

  // Some versions of the driver surface a ResetPool label or a "Socket connection establishment was cancelled" message
  if (err.errorLabel === "ResetPool") return true;
  if (/Socket connection establishment was cancelled/.test(msg)) return true;

  return false;
}

async function safeDisconnect() {
  try {
    // If no active connection, nothing to do
    if (mongoose.connection.readyState === 0) {
      console.log("[db] mongoose already disconnected");
      return;
    }

    // Give a tiny grace period for pending callbacks / promises to settle.
    // This helps avoid racing the driver's internal connect/handshake logic.
    await new Promise((r) => setTimeout(r, 60)); // 50-200ms is usually sufficient

    // Attempt graceful disconnect; catch any driver errors below
    await mongoose.disconnect();
    console.log("[db] disconnected from MongoDB");
  } catch (err) {
    // If the error is a known, ignorable shutdown race, warn and swallow.
    if (isIgnorableDisconnectError(err)) {
      console.warn("[db] Ignored known shutdown race error while disconnecting:", err && (err.message || err));
      return;
    }

    // For unexpected errors, log a full stack for debugging but do not let it become uncaught.
    console.error("[db] Unexpected error while disconnecting:", err && (err.stack || err.message || String(err)));
    // Do not re-throw to avoid crashing the process because we're already shutting down
  }
}

// ----------------------------
// MAIN EXECUTION FUNCTION
// ----------------------------
async function runMain() {
  await printOutboundIp();
  await connectWithRetry();
  await runSyncCustomerFleetMaster();
  await safeDisconnect();
  return { status: "ok" };
}

// ----------------------------
// LAMBDA HANDLER
// ----------------------------
export const handler = async (event, context) => {
  console.log("Lambda invocation started");

  try {
    const output = await runMain();
    return {
      statusCode: 200,
      body: JSON.stringify(output),
    };
  } catch (err) {
    console.error("Lambda failed:", err?.message || err);
    await safeDisconnect();
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

// ----------------------------
// LOCAL EXECUTION
// ----------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      console.log("Running locally...");
      await runMain();
      console.log("Completed");
      process.exit(0);
    } catch (err) {
      console.error("Local failed:", err);
      process.exit(1);
    }
  })();
}