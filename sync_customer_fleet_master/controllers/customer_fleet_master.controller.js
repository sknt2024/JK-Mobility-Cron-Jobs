import axios from "axios";
import http from "http";
import https from "https";
import SyncLog from "../models/sync_log.model.js";
import customerHubModel from "../models/customerHub.model.js";
import customerFleetModel from "../models/customerFleet.model.js";

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
export const syncCustomerFleetMaster = async () => {
  const syncLogEntry = await SyncLog.create({
    action: "sync_customer_fleet_master",
    initiatedBy: null,
  });

  try {
    const allHubs = await customerHubModel.find({});
    console.log(`[syncCustomerFleetMaster] Found ${allHubs.length} hubs to process`);

    let count = 0;
    let index = 0;

    for (const hub of allHubs) {
      index++;

      try {
        console.log(`[syncCustomerFleetMaster] Processing hub ${index}/${allHubs.length}: ${hub.fleetCode}`);

        const response = await axios({
          method: "get",
          url: `${process.env.SAP_API_URL}/ZAWS_JKCONNECT_SRV/CustDtlSet?$filter=Kunnr eq '${hub.fleetCode}'`,
          auth: {
            username: process.env.SAP_USERNAME,
            password: process.env.SAP_PASSWORD,
          },
        });

        if (response.data.d.results.length > 0) {
          const data = response.data.d.results[0];

          const dbData = await customerFleetModel.findOne({
            fleetCode: hub.fleetCode,
          });

          if (dbData) {
            if (!dbData.hubs.includes(hub._id)) {
              dbData.hubs.push(hub._id);
              await dbData.save();
            }
          }

          // Update or create fleet record
          await customerFleetModel.findOneAndUpdate(
            { fleetCode: hub.fleetCode },
            {
              fleetCode: hub.fleetCode,
              fleetName: data.Name1,
              pinCode: data.Pincode,
              address: data.Address,
              city: data.City1,
              mobile: data.Mobile,
              gstNo: data.GstNo,
              Vkbur: data.Vkbur,
              ...(!dbData && { hubs: [hub._id] }),
              isMobility: data["Class"] === "MB" ? true : false,
            },
            { upsert: true }
          );

          count++;
          console.log(`[syncCustomerFleetMaster] Successfully synced fleet: ${hub.fleetCode}`);
        } else {
          console.warn(`[syncCustomerFleetMaster] No SAP data found for fleet: ${hub.fleetCode}`);
        }
      } catch (hubError) {
        console.error(`[syncCustomerFleetMaster] Error processing hub ${hub.fleetCode}:`, hubError.message);
        // Continue processing other hubs
      }
    }

    await SyncLog.findByIdAndUpdate(syncLogEntry._id, {
      $set: { status: "successful", meta: { totalHubs: allHubs.length, synced: count } },
    });

    console.log(`[syncCustomerFleetMaster] Sync completed. Processed ${count}/${allHubs.length} hubs`);

  } catch (err) {
    console.error("[syncCustomerFleetMaster] Sync failed:", err.message);

    await SyncLog.findByIdAndUpdate(syncLogEntry._id, {
      $set: { status: "failed", errorMessages: err.message },
    });

    throw err;
  }
};
