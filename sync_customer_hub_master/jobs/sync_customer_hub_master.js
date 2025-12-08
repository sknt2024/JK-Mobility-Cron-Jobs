import { syncCustomerHubMaster } from '../controllers/customer_hub_master.controller.js';

let running = false;

export async function runSyncCustomerHubMaster() {
    const startAt = new Date();
    if (running) {
        console.warn(`[${startAt.toISOString()}] syncCustomerHubMaster: previous run still in progress — skipping this invocation.`);
        return;
    }

    running = true;
    console.log(`[${startAt.toISOString()}] syncCustomerHubMaster: started`);
    try {
        await syncCustomerHubMaster();
        const endAt = new Date();
        console.log(`[${endAt.toISOString()}] syncCustomerHubMaster: completed in ${(endAt - startAt) / 1000}s`);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] syncCustomerHubMaster: failed`, err);
        // TODO: emit metric / push to monitoring or trigger alert (e.g., POST to webhook)
        // rethrow if you want process to crash and be restarted by orchestrator
    } finally {
        running = false;
    }
}
