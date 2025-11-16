// run_demo.js
// run a test of the multi-agent flow, pulling from the database

import 'dotenv/config';
import { pool } from './lib/db.js';
import { startFlow, stepFlow } from './panel/orchestrator.js';

const [row] = await pool.query(`SELECT ehr_id FROM ehr_inputs ORDER BY ehr_id DESC LIMIT 1`); // chooses the newest EHR
const ehrId = row[0].ehr_id;
const { flowId } = await startFlow({ ehrId, patientJson: {} });

let step = 1;
let done = false;
let stagnantCount = 0;
let lastCertainty = 0;

// track highest certainty result
// need to add support for tracking results with matching certainty, then comparing those matching results at the end.
let bestCertainty = 0;
let bestConsensus = null;

while (!done) {
  const out = await stepFlow({ flowId, stepIndex: step });

  console.log(`\nSTEP ${step}: ${out.consensus.action}`);
  console.dir(out.consensus, { depth: 4 });

  const currentCertainty = out.consensus.certainty ?? 0;

  // track best result so far
  if (currentCertainty > bestCertainty) {
    bestCertainty = currentCertainty;
    bestConsensus = out.consensus;
  }

  // detect stagnant certainty
  if (Math.abs(currentCertainty - lastCertainty) < 1e-3) {
    stagnantCount++;
  } else {
    stagnantCount = 0;
  }
  lastCertainty = currentCertainty;

  // stopping conditions
  if (
    stagnantCount >= 5 ||     // same certainty for x steps
    step >= 20 ||             // step limit
    currentCertainty >= 0.8   // certainty threshold
  ) {
    done = true;

    // print highest certainty result when done
    console.log("\n=== HIGHEST CERTAINTY REACHED ===");
    console.log(`Certainty: ${bestCertainty}`);
    console.dir(bestConsensus, { depth: 4 });
    console.log("=================================\n");
  }

  if (!done) step++;
}

console.log('\nFlow complete:', flowId);
process.exit();
