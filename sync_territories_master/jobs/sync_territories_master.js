import { syncTerritoriesMaster } from '../controllers/territories_master.controller.js';

let running = false;

export async function runSyncTerritoriesMaster() {
    const startAt = new Date();
    if (running) {
        console.warn(`[${startAt.toISOString()}] syncTerritoriesMaster: previous run still in progress — skipping this invocation.`);
        return;
    }

    running = true;
    console.log(`[${startAt.toISOString()}] syncTerritoriesMaster: started`);
    try {
        await syncTerritoriesMaster();
        const endAt = new Date();
        console.log(`[${endAt.toISOString()}] syncTerritoriesMaster: completed in ${(endAt - startAt) / 1000}s`);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] syncTerritoriesMaster: failed`, err);
        // TODO: emit metric / push to monitoring or trigger alert (e.g., POST to webhook)
        // rethrow if you want process to crash and be restarted by orchestrator
    } finally {
        running = false;
    }
}
