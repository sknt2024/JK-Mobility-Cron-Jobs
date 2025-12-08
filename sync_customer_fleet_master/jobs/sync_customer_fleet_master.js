import { syncCustomerFleetMaster } from '../controllers/customer_fleet_master.controller.js';

let running = false;

export async function runSyncCustomerFleetMaster() {
  const startAt = new Date();
  if (running) {
    console.warn(`[${startAt.toISOString()}] syncCustomerFleetMaster: previous run still in progress — skipping this invocation.`);
    return;
  }

  running = true;
  console.log(`[${startAt.toISOString()}] syncCustomerFleetMaster: started`);
  try {
    await syncCustomerFleetMaster();
    const endAt = new Date();
    console.log(`[${endAt.toISOString()}] syncCustomerFleetMaster: completed in ${(endAt - startAt) / 1000}s`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] syncCustomerFleetMaster: failed`, err);
    // TODO: emit metric / push to monitoring or trigger alert (e.g., POST to webhook)
    // rethrow if you want process to crash and be restarted by orchestrator
  } finally {
    running = false;
  }
}