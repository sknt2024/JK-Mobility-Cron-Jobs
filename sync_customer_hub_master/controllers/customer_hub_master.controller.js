import axios from "axios";
import http from "http";
import https from "https";
import SyncLog from "../models/sync_log.model.js";
import customerHubModel from "../models/customerHub.model.js";

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
 * Main exported function - syncs customer hub data from SAP
 */
export const syncCustomerHubMaster = async () => {
    const syncLogEntry = await SyncLog.create({
        action: "sync_customer_hub_master",
        initiatedBy: null,
    });

    const logger = {
        info: (...args) => console.info("[syncCustomerHubMaster]", ...args),
        warn: (...args) => console.warn("[syncCustomerHubMaster]", ...args),
        error: (...args) => console.error("[syncCustomerHubMaster]", ...args),
    };

    const auth = {
        username: process.env.SAP_USERNAME,
        password: process.env.SAP_PASSWORD,
    };

    try {
        // Step 1: Fetch hub master data
        logger.info("Fetching hub master data from SAP");
        const hubMasterUrl = `${process.env.SAP_API_URL}/ZAWS_JKCONNECT_SRV/FltHubMstSet`;
        const response = await robustGet(hubMasterUrl, { auth }, logger);

        if (!response?.data?.d?.results) {
            throw new Error("Invalid response from SAP FltHubMstSet");
        }

        const hubData = response.data.d.results;
        logger.info(`Fetched ${hubData.length} hub records`);

        // Step 2: Update hub basic info
        const promises = [];
        const fleets = [];

        hubData.forEach((hub) => {
            if (fleets.indexOf(hub.Kunnr) === -1) {
                fleets.push(hub.Kunnr);
            }
            promises.push(
                customerHubModel.findOneAndUpdate(
                    { hubCode: hub.HubCode },
                    {
                        $set: {
                            hubCode: hub.HubCode,
                            hubName: hub.HubName,
                            fleetCode: hub.Kunnr,
                        },
                    },
                    { upsert: true, new: true }
                )
            );
        });

        const allResolvedData = await Promise.all(promises);
        logger.info(`Updated ${allResolvedData.length} hub records`);

        // Step 3: Fetch and update ship-to-party details for each hub
        let index = 0;
        for (const data of allResolvedData) {
            index++;
            logger.info(`Processing ship-to-party for hub ${index}/${allResolvedData.length}: ${data.hubCode}`);

            try {
                // First attempt: filter by fleet code
                const shipToPartyUrl = `${process.env.SAP_API_URL}/ZAWS_JKCONNECT_SRV/ShipToPartySet?$filter=Kunnr eq '${data.fleetCode}'&$format=json`;
                const shipToPartyResponse = await robustGet(shipToPartyUrl, { auth }, logger);

                const SAPShipToPartyData = shipToPartyResponse?.data?.d?.results || [];
                const SAPShipToPartyDataOfHub = SAPShipToPartyData.filter(
                    (entity) =>
                        entity.Kunn2 === data.hubCode &&
                        entity.Vkorg === "1000" &&
                        entity.Spart === "20" &&
                        entity.Vtweg === "10"
                );

                if (SAPShipToPartyDataOfHub?.length) {
                    for (const shipToPartyEntity of SAPShipToPartyDataOfHub) {
                        const {
                            Kunn2: hubCode,
                            Shpvkbur: depoCode,
                            Kunn2City: city,
                            Kunn2Pincode: pinCode,
                            Kunn2Address: address,
                        } = shipToPartyEntity;

                        await customerHubModel.findOneAndUpdate(
                            { hubCode: hubCode },
                            {
                                $set: {
                                    pinCode,
                                    address,
                                    city,
                                    depoCode,
                                },
                            },
                            { upsert: true, new: true }
                        );
                    }
                    logger.info(`Updated ship-to-party details for hub: ${data.hubCode}`);
                } else {
                    // Second attempt: filter by hub code directly
                    logger.info(`No ship-to-party found with fleet filter, trying hub code filter for: ${data.hubCode}`);
                    const shipToParty2Url = `${process.env.SAP_API_URL}/ZAWS_JKCONNECT_SRV/ShipToPartySet?$filter=Kunnr eq '${data.hubCode}'&$format=json`;
                    const shipToParty2Response = await robustGet(shipToParty2Url, { auth }, logger);

                    const SAPShipToParty2Data = shipToParty2Response?.data?.d?.results || [];
                    const SAPShipToParty2DataOfHub = SAPShipToParty2Data.filter(
                        (entity) =>
                            entity.Kunn2 === data.hubCode &&
                            entity.Vkorg === "1000" &&
                            entity.Spart === "20" &&
                            entity.Vtweg === "10"
                    );

                    if (SAPShipToParty2DataOfHub?.length) {
                        for (const shipToParty2Entity of SAPShipToParty2DataOfHub) {
                            const {
                                Kunn2: hubCode,
                                Shpvkbur: depoCode,
                                Kunn2City: city,
                                Kunn2Pincode: pinCode,
                                Kunn2Address: address,
                            } = shipToParty2Entity;

                            await customerHubModel.findOneAndUpdate(
                                { hubCode: hubCode },
                                {
                                    $set: {
                                        pinCode,
                                        address,
                                        city,
                                        depoCode,
                                    },
                                },
                                { upsert: true, new: true }
                            );
                        }
                        logger.info(`Updated ship-to-party details (2nd attempt) for hub: ${data.hubCode}`);
                    } else {
                        logger.warn(`No ship-to-party data found for hub: ${data.hubCode}`);
                    }
                }
            } catch (hubError) {
                logger.error(`Error processing ship-to-party for hub ${data.hubCode}:`, hubError.message);
                // Continue processing other hubs
            }
        }

        await SyncLog.findByIdAndUpdate(syncLogEntry._id, {
            $set: { status: "successful", meta: { totalHubs: allResolvedData.length } },
        });

        logger.info(`Sync completed successfully. Processed ${allResolvedData.length} hubs`);

    } catch (err) {
        logger.error("Sync failed:", err.message);

        await SyncLog.findByIdAndUpdate(syncLogEntry._id, {
            $set: { status: "failed", errorMessages: err.message },
        });

        throw err;
    }
};
