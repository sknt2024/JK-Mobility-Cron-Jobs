// pattern_master.controller.js (replace your current file)
import ZAWS_JC_SRV_PATMST from "../models/ZAWS_JC_SRV_PAT_MST.js";
import axios from "axios";
import http from "http";
import https from "https";
import SyncLog from "../models/sync_log.model.js";

/**
 * Utility: sleep
 */
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Redact axios config for safe logging
 */
function redactConfigForLog(cfg = {}) {
  const copy = { ...cfg };
  if (copy.headers) {
    copy.headers = { ...copy.headers };
    if (copy.headers.Authorization) copy.headers.Authorization = "REDACTED";
  }
  if (copy.auth) copy.auth = { username: "REDACTED", password: "REDACTED" };
  if (copy.url) copy.url = copy.url.replace(/\/\/.*@/, "//REDACTED@"); // just in case
  return copy;
}

/**
 * Robust GET with retries + exponential backoff
 * - url: full endpoint
 * - opts: { retries, timeoutMs, initialDelayMs, auth, validateStatus }
 */
async function robustGet(url, opts = {}, logger = console) {
  const {
    retries = 3,
    timeoutMs = process.env.SAP_REQUEST_TIMEOUT_MS ? parseInt(process.env.SAP_REQUEST_TIMEOUT_MS, 10) : 45000,
    initialDelayMs = 1000,
    auth,
    validateStatus
  } = opts;

  // KeepAlive agents (reused across retries)
  const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 10 });
  const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });

  const instance = axios.create({
    timeout: timeoutMs,
    httpAgent,
    httpsAgent,
    headers: { Accept: "application/json, text/plain, */*" },
  });

  let attempt = 0;
  let lastErr;

  while (attempt < retries) {
    attempt += 1;
    const start = Date.now();
    try {
      logger.info(`robustGet: attempt ${attempt} -> ${url}`);
      const response = await instance.get(url, {
        auth,
        validateStatus: typeof validateStatus === "function" ? validateStatus : undefined,
      });

      const elapsed = Date.now() - start;
      logger.info(`robustGet: success (attempt ${attempt}) status=${response.status} timeMs=${elapsed}`);
      return response;
    } catch (err) {
      const elapsed = Date.now() - start;
      lastErr = err;
      // Error code examples: ECONNABORTED, ETIMEDOUT, ECONNREFUSED etc.
      logger.warn(`robustGet: attempt ${attempt} failed code=${err.code || "N/A"} msg=${err.message} timeMs=${elapsed}`);

      // If a client error (4xx) came back with response, treat as non-retryable
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        logger.error("robustGet: non-retryable response status", { status: err.response.status });
        throw err;
      }

      if (attempt < retries) {
        const backoff = initialDelayMs * Math.pow(2, attempt - 1);
        logger.info(`robustGet: backing off ${backoff}ms before next retry`);
        await wait(backoff);
      }
    }
  }

  // all retries exhausted
  logger.error("robustGet: all retries failed", { error: lastErr && lastErr.message, config: redactConfigForLog(lastErr && lastErr.config) });
  throw lastErr;
}

/**
 * Main exported function
 */
export const syncPatternMaster = async () => {
  // Create log entry
  const syncLogEntry = await SyncLog.create({
    action: "sync_pattern_master",
    initiatedBy: null,
    meta: {},
  });

  const logger = {
    info: (...args) => console.info("[syncPatternMaster]", ...args),
    warn: (...args) => console.warn("[syncPatternMaster]", ...args),
    error: (...args) => console.error("[syncPatternMaster]", ...args),
  };

  const sapBase = process.env.SAP_API_URL;
  if (!sapBase) {
    const err = new Error("SAP_API_URL not configured");
    await SyncLog.findByIdAndUpdate(syncLogEntry._id, { $set: { status: "failed", error: err.message } });
    throw err;
  }

  const url = `${sapBase.replace(/\/$/, "")}/ZAWS_JKCONNECT_SRV/PatMstSet`;

  const auth = {
    username: process.env.SAP_USERNAME,
    password: process.env.SAP_PASSWORD,
  };

  const startAll = Date.now();

  try {
    const response = await robustGet(url, {
      retries: process.env.SAP_RETRIES ? parseInt(process.env.SAP_RETRIES, 10) : 3,
      timeoutMs: process.env.SAP_REQUEST_TIMEOUT_MS ? parseInt(process.env.SAP_REQUEST_TIMEOUT_MS, 10) : 45000,
      initialDelayMs: process.env.SAP_BACKOFF_INITIAL_MS ? parseInt(process.env.SAP_BACKOFF_INITIAL_MS, 10) : 1000,
      auth,
      validateStatus: () => true,
    }, logger);

    // validate shape like your original code
    if (!response || !response.data || !response.data.d || !Array.isArray(response.data.d.results)) {
      const err = new Error("SAP returned invalid response shape");
      // update log
      await SyncLog.findByIdAndUpdate(syncLogEntry._id, { $set: { status: "failed", error: err.message } });
      throw err;
    }

    const records = response.data.d.results;
    logger.info(`syncPatternMaster: fetched ${records.length} records`);

    // If there are no records, just mark successful
    if (records.length === 0) {
      await SyncLog.findByIdAndUpdate(syncLogEntry._id, { $set: { status: "successful", meta: { fetched: 0, durationMs: Date.now() - startAll } } });
      return;
    }

    // Build bulkWrite operations in batches to avoid huge payload in memory if large dataset
    const BATCH_SIZE = process.env.SYNC_BULK_BATCH_SIZE ? parseInt(process.env.SYNC_BULK_BATCH_SIZE, 10) : 500;
    let totalProcessed = 0;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      const bulkOps = batch.map((value) => {
        // Build filter for upsert (keep same fields you used earlier)
        const filter = { PatCode: value.PatCode, CatCode: value.CatCode };
        // Upsert replacement/update
        return {
          updateOne: {
            filter,
            update: { $set: { ...value } },
            upsert: true,
          },
        };
      });

      if (bulkOps.length > 0) {
        try {
          const res = await ZAWS_JC_SRV_PATMST.bulkWrite(bulkOps, { ordered: false });
          // bulkWrite result contains nUpserted / nModified etc depending on driver version
          logger.info(`syncPatternMaster: batch ${i / BATCH_SIZE + 1} bulkWrite result:`, {
            insertedCount: res.nInserted ?? res.insertedCount ?? 0,
            matchedCount: res.nMatched ?? res.matchedCount ?? 0,
            modifiedCount: res.nModified ?? res.modifiedCount ?? 0,
            upsertedCount: (res.upsertedCount ?? 0) + (res.nUpserted ?? 0),
          });
        } catch (bulkErr) {
          // Log but continue — ordered:false prevents complete stop for some errors
          logger.warn("syncPatternMaster: bulkWrite error for batch, continuing", bulkErr.message || bulkErr);
        }
      }

      totalProcessed += batch.length;
    }

    const duration = Date.now() - startAll;
    // update log success
    await SyncLog.findByIdAndUpdate(syncLogEntry._id, {
      $set: {
        status: "successful",
        error: null,
        meta: { fetched: records.length, processed: totalProcessed, durationMs: duration },
      },
    });

    logger.info(`syncPatternMaster: completed processed=${totalProcessed} durationMs=${duration}`);
    return; // success

  } catch (error) {
    const message = (error && error.message) || String(error);
    logger.error("syncPatternMaster error:", message);

    await SyncLog.findByIdAndUpdate(syncLogEntry._id, {
      $set: { status: "failed", error: message, meta: { durationMs: Date.now() - startAll } },
    });

    // rethrow so upstream application logic can handle retry/failure counting
    throw error;
  }
};
