import axios from "axios";
import http from "http";
import https from "https";
import SyncLog from "../models/sync_log.model.js";
import Territory from "../models/territory.model.js";

/**
 * Zone code to zone name mapping
 */
const zoneMap = {
    NZ: "North Zone",
    SZ: "South Zone",
    EZ: "East Zone",
    WZ: "West Zone",
    CZ: "Central Zone",
    TZ: "South Zone-2",
    O: "Other",
};

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
 * Main exported function - syncs territories data from SAP
 */
export const syncTerritoriesMaster = async () => {
    const syncLogEntry = await SyncLog.create({
        action: "sync_territories_master",
        initiatedBy: null,
    });

    const logger = {
        info: (...args) => console.info("[syncTerritoriesMaster]", ...args),
        warn: (...args) => console.warn("[syncTerritoriesMaster]", ...args),
        error: (...args) => console.error("[syncTerritoriesMaster]", ...args),
    };

    const auth = {
        username: process.env.SAP_USERNAME,
        password: process.env.SAP_PASSWORD,
    };

    try {
        logger.info("Fetching territory and region data from SAP");

        // Fetch both plant attributes and region master data in parallel
        const [territoryResponse, regionResponse] = await Promise.all([
            robustGet(`${process.env.SAP_API_URL}/ZSKU_MANF_SRV/PlantAttributeSet`, { auth }, logger),
            robustGet(`${process.env.SAP_API_URL}/ZAWS_JKCONNECT_SRV/MsfaRegionMstDtlSet`, { auth }, logger),
        ]);

        if (!territoryResponse?.data?.d?.results || !regionResponse?.data?.d?.results) {
            throw new Error("Invalid response from SAP territory/region endpoints");
        }

        const territoryData = territoryResponse.data.d.results;
        const regionData = regionResponse.data.d.results;

        logger.info(`Fetched ${territoryData.length} territory records and ${regionData.length} region records`);

        // Build region code to name and zone mappings
        const regionCodeToNameMap = {};
        const regionCodeToZoneMap = {};

        regionData.forEach((region) => {
            regionCodeToNameMap[region.Region] = region.Name;
            regionCodeToZoneMap[region.Region] = region.PZone;
        });

        logger.info(`Built mappings for ${Object.keys(regionCodeToNameMap).length} regions`);

        // Build bulk write operations
        const bulkWriteOperations = territoryData.map((d, index) => {
            const regionName = regionCodeToNameMap[d.Region] || "";
            const zoneCode = regionCodeToZoneMap[d.Region] || "";
            const zoneName = zoneMap[zoneCode] ?? zoneCode;

            if ((index + 1) % 50 === 0) {
                logger.info(`Processing territory ${index + 1}/${territoryData.length}`);
            }

            return {
                updateOne: {
                    filter: { depoCode: d.Werk },
                    update: {
                        $set: {
                            regionCode: d.Region,
                            regionName: regionName,
                            zoneCode: zoneCode,
                            zoneName: zoneName,
                            depoCode: d.Werk,
                        },
                    },
                    upsert: true,
                },
            };
        });

        logger.info(`Executing bulk write for ${bulkWriteOperations.length} territories`);
        const bulkResult = await Territory.bulkWrite(bulkWriteOperations);

        logger.info("Bulk write completed", {
            insertedCount: bulkResult.nInserted ?? bulkResult.insertedCount ?? 0,
            matchedCount: bulkResult.nMatched ?? bulkResult.matchedCount ?? 0,
            modifiedCount: bulkResult.nModified ?? bulkResult.modifiedCount ?? 0,
            upsertedCount: (bulkResult.upsertedCount ?? 0) + (bulkResult.nUpserted ?? 0),
        });

        await SyncLog.findByIdAndUpdate(syncLogEntry._id, {
            $set: {
                status: "successful",
                meta: {
                    totalTerritories: territoryData.length,
                    totalRegions: regionData.length,
                    bulkResult: {
                        inserted: bulkResult.nInserted ?? bulkResult.insertedCount ?? 0,
                        modified: bulkResult.nModified ?? bulkResult.modifiedCount ?? 0,
                        upserted: (bulkResult.upsertedCount ?? 0) + (bulkResult.nUpserted ?? 0),
                    }
                }
            },
        });

        logger.info("Sync completed successfully");

    } catch (err) {
        logger.error("Sync failed:", err.message);

        await SyncLog.findByIdAndUpdate(syncLogEntry._id, {
            $set: { status: "failed", errorMessages: err.message },
        });

        throw err;
    }
};
