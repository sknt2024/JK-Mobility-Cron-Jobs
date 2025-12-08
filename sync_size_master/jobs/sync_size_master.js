import { syncSizeMaster } from '../controllers/size_master.controller.js';

let running = false;

export async function runSyncSizeMaster() {
    const startAt = new Date();
    if (running) {
        console.warn(`[${startAt.toISOString()}] syncSizeMaster: previous run still in progress — skipping this invocation.`);
        return;
    }

    running = true;
    console.log(`[${startAt.toISOString()}] syncSizeMaster: started`);
    try {
        await syncSizeMaster();
        const endAt = new Date();
        console.log(`[${endAt.toISOString()}] syncSizeMaster: completed in ${(endAt - startAt) / 1000}s`);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] syncSizeMaster: failed`, err);
        // TODO: emit metric / push to monitoring or trigger alert (e.g., POST to webhook)
        // rethrow if you want process to crash and be restarted by orchestrator
    } finally {
        running = false;
    }
}
