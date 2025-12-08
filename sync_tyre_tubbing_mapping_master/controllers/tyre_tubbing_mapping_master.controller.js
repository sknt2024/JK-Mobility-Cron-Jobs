import axios from "axios";
import http from "http";
import https from "https";
import SyncLog from "../models/sync_log.model.js";
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
 * Main exported function - syncs tyre-tube mapping data from SAP
 */
export const syncTyreTubbingMappingMaster = async () => {
    const syncLogEntry = await SyncLog.create({
        action: "sync_tyre_tubbing_mapping_master",
        initiatedBy: null,
    });

    const logger = {
        info: (...args) => console.info("[syncTyreTubbingMappingMaster]", ...args),
        warn: (...args) => console.warn("[syncTyreTubbingMappingMaster]", ...args),
        error: (...args) => console.error("[syncTyreTubbingMappingMaster]", ...args),
    };

    const auth = {
        username: process.env.SAP_USERNAME,
        password: process.env.SAP_PASSWORD,
    };

    try {
        // Fetch all products with Flag 'F'
        logger.info("Fetching products with Flag 'F'");
        const allProducts = await Product.find(
            { Flag: "F" },
            { _id: 1, materialNo: 1, productType: 1, Musthave: 1 }
        );

        logger.info(`Found ${allProducts.length} products to process`);

        let index = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const val of allProducts) {
            index++;

            try {
                // Modify material number based on first character
                let modifiedMaterialNo = val.materialNo;
                if (modifiedMaterialNo[0] === "R") {
                    modifiedMaterialNo = modifiedMaterialNo.replace(/^R/, "1");
                } else if (modifiedMaterialNo[0] === "P") {
                    modifiedMaterialNo = modifiedMaterialNo.replace(/^P/, "2");
                } else if (modifiedMaterialNo[0] === "Q") {
                    modifiedMaterialNo = modifiedMaterialNo.replace(/^Q/, "3");
                }

                if (index % 50 === 0) {
                    logger.info(`Processing product ${index}/${allProducts.length}: ${val.materialNo}`);
                }

                // Fetch fleet mapping data from SAP
                const sapUrl = `${process.env.SAP_API_URL}/ZODATA_FLEET_MAPPING_SRV/ZFLEET_HDRSet?$filter=Matnr eq '${modifiedMaterialNo}'`;
                const sapData = await robustGet(sapUrl, { auth }, logger);

                const data = sapData?.data?.d?.results || [];

                if (data.length === 0) {
                    skippedCount++;
                    continue;
                }

                // Process each mapping item
                for (const item of data) {
                    const relatedProduct = await Product.findOne({
                        materialNo: item.MatnrTf,
                    });

                    if (relatedProduct) {
                        // Check if this variant is already in Musthave array
                        const alreadyExists = val.Musthave?.some((have) => {
                            return have.variant?.toString() === relatedProduct._id.toString();
                        });

                        if (!alreadyExists) {
                            // Add the variant to Musthave array
                            await Product.updateMany(
                                { materialNo: val.materialNo },
                                {
                                    $addToSet: { Musthave: { variant: relatedProduct._id } },
                                },
                                { new: true }
                            );
                            updatedCount++;
                            logger.info(`Added mapping: ${val.materialNo} -> ${item.MatnrTf}`);
                        }
                    } else {
                        logger.warn(`Related product not found for material: ${item.MatnrTf}`);
                    }
                }
            } catch (productError) {
                logger.error(`Error processing product ${val.materialNo}:`, productError.message);
                // Continue processing other products
            }
        }

        await SyncLog.findByIdAndUpdate(syncLogEntry._id, {
            $set: {
                status: "successful",
                meta: {
                    totalProducts: allProducts.length,
                    updatedCount,
                    skippedCount,
                }
            },
        });

        logger.info(`Sync completed. Processed ${allProducts.length} products, updated ${updatedCount}, skipped ${skippedCount}`);

    } catch (err) {
        logger.error("Sync failed:", err.message);

        await SyncLog.findByIdAndUpdate(syncLogEntry._id, {
            $set: { status: "failed", errorMessages: err.message },
        });

        throw err;
    }
};
