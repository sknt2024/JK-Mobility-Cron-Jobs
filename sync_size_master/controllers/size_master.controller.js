import axios from "axios";
import http from "http";
import https from "https";
import SyncLog from "../models/sync_log.model.js";
import SizeMaster from "../models/size_master.model.js";
import Product from "../models/product.model.js";

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
 */
async function robustGet(url, opts = {}, logger = console) {
    const {
        retries = 3,
        timeoutMs = process.env.SAP_REQUEST_TIMEOUT_MS ? parseInt(process.env.SAP_REQUEST_TIMEOUT_MS, 10) : 45000,
        initialDelayMs = 1000,
        auth,
        validateStatus
    } = opts;

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
            logger.warn(`robustGet: attempt ${attempt} failed code=${err.code || "N/A"} msg=${err.message} timeMs=${elapsed}`);

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

    logger.error("robustGet: all retries failed", { error: lastErr && lastErr.message, config: redactConfigForLog(lastErr && lastErr.config) });
    throw lastErr;
}

/**
 * Main exported function - syncs size master data from SAP
 */
export const syncSizeMaster = async () => {
    const syncLogEntry = await SyncLog.create({
        action: "sync_size_master",
        initiatedBy: null,
    });

    const logger = {
        info: (...args) => console.info("[syncSizeMaster]", ...args),
        warn: (...args) => console.warn("[syncSizeMaster]", ...args),
        error: (...args) => console.error("[syncSizeMaster]", ...args),
    };

    const auth = {
        username: process.env.SAP_USERNAME,
        password: process.env.SAP_PASSWORD,
    };

    try {
        logger.info("Fetching size master data from SAP");

        const sapUrl = `${process.env.SAP_API_URL}/ZAWS_JKCONNECT_SRV/SizeMstSet`;
        const sapData = await robustGet(sapUrl, { auth }, logger);

        if (!sapData?.data?.d?.results) {
            throw new Error("Invalid response from SAP SizeMstSet endpoint");
        }

        const data = sapData.data.d.results;
        logger.info(`SAP Data Received: ${data.length} records`);

        const promises = [];

        data.forEach((val, index) => {
            // Update size master collection
            promises.push(
                SizeMaster.findOneAndUpdate(
                    { ZsizeCd: val.ZsizeCd },
                    {
                        $set: {
                            ZsizeCd: val.ZsizeCd,
                            Ydesc: val.Desc1,
                            CatCode: val.CatCode,
                        },
                    },
                    {
                        new: true,
                        upsert: true,
                    }
                )
            );

            // Update products with matching size code and category
            promises.push(
                Product.updateMany(
                    {
                        $and: [{ prodSize: val.ZsizeCd }, { Catcode: val.CatCode }],
                    },
                    {
                        $set: { tyreSize: val.Desc1.trim() },
                    },
                    { new: true }
                )
            );

            if ((index + 1) % 100 === 0) {
                logger.info(`Queued updates for ${index + 1}/${data.length} size records`);
            }
        });

        logger.info(`Executing ${promises.length} database operations`);
        const results = await Promise.all(promises);

        // Count how many products were updated
        let productsUpdated = 0;
        for (let i = 1; i < results.length; i += 2) {
            productsUpdated += results[i].modifiedCount || 0;
        }

        await SyncLog.findByIdAndUpdate(syncLogEntry._id, {
            $set: {
                status: "successful",
                meta: {
                    totalSizes: data.length,
                    productsUpdated,
                }
            },
        });

        logger.info(`Sync completed. Processed ${data.length} sizes, updated ${productsUpdated} products`);

    } catch (err) {
        logger.error("Sync failed:", err.message);

        await SyncLog.findByIdAndUpdate(syncLogEntry._id, {
            $set: { status: "failed", errorMessages: err.message },
        });

        throw err;
    }
};
