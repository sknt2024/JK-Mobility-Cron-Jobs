import { syncTyreTubbingMappingMaster } from '../controllers/tyre_tubbing_mapping_master.controller.js';

let running = false;

export async function runSyncTyreTubbingMappingMaster() {
    const startAt = new Date();
    if (running) {
        console.warn(`[${startAt.toISOString()}] syncTyreTubbingMappingMaster: previous run still in progress — skipping this invocation.`);
        return;
    }

    running = true;
    console.log(`[${startAt.toISOString()}] syncTyreTubbingMappingMaster: started`);
    try {
        await syncTyreTubbingMappingMaster();
        const endAt = new Date();
        console.log(`[${endAt.toISOString()}] syncTyreTubbingMappingMaster: completed in ${(endAt - startAt) / 1000}s`);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] syncTyreTubbingMappingMaster: failed`, err);
        // TODO: emit metric / push to monitoring or trigger alert (e.g., POST to webhook)
        // rethrow if you want process to crash and be restarted by orchestrator
    } finally {
        running = false;
    }
}
