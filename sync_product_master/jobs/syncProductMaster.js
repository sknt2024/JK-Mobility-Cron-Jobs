import { syncProductMaster } from '../controllers/product.controller.js';

let running = false;

export async function runSyncProductMaster() {
  const startAt = new Date();
  if (running) {
    console.warn(`[${startAt.toISOString()}] syncProductMaster: previous run still in progress — skipping this invocation.`);
    return;
  }

  running = true;
  console.log(`[${startAt.toISOString()}] syncProductMaster: started`);
  try {
    await syncProductMaster();
    const endAt = new Date();
    console.log(`[${endAt.toISOString()}] syncProductMaster: completed in ${(endAt - startAt) / 1000}s`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] syncProductMaster: failed`, err);
    // TODO: emit metric / push to monitoring or trigger alert (e.g., POST to webhook)
    // rethrow if you want process to crash and be restarted by orchestrator
  } finally {
    running = false;
  }
}