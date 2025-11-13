import { syncCategoryMaster } from '../controllers/category_master.js';

let running = false;

export async function runSyncCategoryMaster() {
  const startAt = new Date();
  if (running) {
    console.warn(`[${startAt.toISOString()}] syncCategoryMaster: previous run still in progress — skipping this invocation.`);
    return;
  }

  running = true;
  console.log(`[${startAt.toISOString()}] syncCategoryMaster: started`);
  try {
    await syncCategoryMaster();
    const endAt = new Date();
    console.log(`[${endAt.toISOString()}] syncCategoryMaster: completed in ${(endAt - startAt) / 1000}s`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] syncCategoryMaster: failed`, err);
    // TODO: emit metric / push to monitoring or trigger alert (e.g., POST to webhook)
    // rethrow if you want process to crash and be restarted by orchestrator
  } finally {
    running = false;
  }
}