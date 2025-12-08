import { syncPatternMaster } from '../controllers/pattern_master.controller.js';

let running = false;

export async function runSyncPatternMaster() {
  const startAt = new Date();
  if (running) {
    console.warn(`[${startAt.toISOString()}] syncPatternMaster: previous run still in progress — skipping this invocation.`);
    return;
  }

  running = true;
  console.log(`[${startAt.toISOString()}] syncPatternMaster: started`);
  try {
    await syncPatternMaster();
    const endAt = new Date();
    console.log(`[${endAt.toISOString()}] syncPatternMaster: completed in ${(endAt - startAt) / 1000}s`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] syncPatternMaster: failed`, err);
    // TODO: emit metric / push to monitoring or trigger alert (e.g., POST to webhook)
    // rethrow if you want process to crash and be restarted by orchestrator
  } finally {
    running = false;
  }
}