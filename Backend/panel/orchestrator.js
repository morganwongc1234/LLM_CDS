// state machine: ASK / ORDER / COMMIT

import { v4 as uuid } from 'uuid';
import { pool } from '../lib/db.js';
import { PanelOutput } from './schema.js';
import { runPanelOnce } from './panel_prompt.js';
import { ZodError } from "zod";

const MAX_STEPS = 31; // consider increasing the step limit if it struggles with complex cases
const COMMIT_THRESHOLD = 0.8;

// ensure value is always an array
function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') return [val];
  return [];
}

export async function startFlow({ ehrId, patientJson }) {
  const flowId = uuid();
  await pool.query(
    `INSERT INTO llm_flows (flow_id, ehr_id) VALUES (?,?)`,
    [flowId, ehrId]
  );
  return { flowId };
}

export async function stepFlow({ flowId, stepIndex }) {
  const [[f]] = await pool.query(
    `SELECT ehr_id FROM llm_flows WHERE flow_id=?`, [flowId]
  );
  if (!f) throw new Error('flow not found');

  const [[ehr]] = await pool.query(
    `SELECT symptoms_json, labs_json, history_text FROM ehr_inputs WHERE ehr_id=?`, [f.ehr_id]
  );

  function safeParse(value) {
  try {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'object') return value;        // already JSON
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.startsWith('[') || trimmed.startsWith('{')
        ? JSON.parse(trimmed)
        : [trimmed];
    }
    return [];
  } catch (err) {
    console.warn('Failed to parse JSON:', value, err.message);
    return [];
  }
}

const patient = {
  complaints: safeParse(ehr.symptoms_json),
  labs: safeParse(ehr.labs_json),
  history: ehr.history_text ? [ehr.history_text] : []
};

// After fetching prior steps from DB
const [prior] = await pool.query(
  `SELECT step_index, action, questions_json, orders_json, diagnosis_json, certainty, panel_json 
     FROM panel_turns WHERE flow_id=? ORDER BY step_index ASC`,
  [flowId]
);

// reasoning summary memory
let reasoningSummary = '';
if (prior.length > 0) {
  reasoningSummary = prior.map(p => {
    const diag = p.diagnosis_json ? JSON.stringify(p.diagnosis_json) : 'none';
    const orders = p.orders_json ? JSON.stringify(p.orders_json) : 'none';
    const qs = p.questions_json ? JSON.stringify(p.questions_json) : 'none';
    return `Step ${p.step_index}: Action=${p.action}, Certainty=${p.certainty}.
    Questions=${qs}, Orders=${orders}, Diagnosis=${diag}.`;
  }).join('\n');
} else {
  reasoningSummary = 'No prior reasoning available.';
}

// reflective meta prompt
const reflection = `
You are continuing a multi-step diagnostic panel reasoning process.
Below is a concise summary of prior reasoning steps.

${reasoningSummary}

Reflect before deciding:
- Remember, prior tests have not been performed. Consider whether any *proposed* tests would be redundant if actually done.
- Do differential probabilities remain logically consistent with the existing information (no new data)?
- Is certainty justified by reasoning so far?
- If there are contradictions, correct them in this step.
Then produce the next panel output, as always, in strict JSON.
`;

// call model with memory context
const raw = await runPanelOnce({ patient, prior: reflection });

// print raw output vertically for readability 
try {
  const parsedRaw = JSON.parse(raw);
  console.log("\n--- RAW MODEL OUTPUT ---");
  console.log(JSON.stringify(parsedRaw, null, 2));
  console.log("-------------------------\n");
} catch {
  console.log("\n--- RAW MODEL OUTPUT (unparsed) ---\n", raw, "\n-------------------------\n");
}

function normalizeModelOutput(json) {
  if (!json || typeof json !== "object") return json;

  const personas = json.personas || {};
  const consensus = json.consensus || {};

  // normalize doctor names -> schema keys
  const norm = {
    personas: {
      hypothesis: personas["Dr. Hypothesis"] || personas.hypothesis || {},
      test_chooser: personas["Dr. Test-Chooser"] || personas.test_chooser || {},
      challenger: personas["Dr. Challenger"] || personas.challenger || {},
      stewardship: personas["Dr. Stewardship"] || personas.stewardship || {},
      checklist: personas["Dr. Checklist"] || personas.checklist || {},
    },
    consensus: {
        action: consensus.ACTION || consensus.action || "ASK",
        rationale: consensus.rationale || "No rationale provided.",
        questions: consensus.questions || consensus.questions_json || [],
        orders: consensus.orders || consensus.orders_json || consensus.tests || [],
        diagnosis: consensus.diagnosis || consensus.diagnosis_json || null,
        certainty: Number(consensus.certainty) || 0.5,
    },
  };

    function toArray(val) {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') return [val];
        return [];
    }

  return norm;
}

let parsed;
try {
    const json = JSON.parse(raw);
    const normalized = normalizeModelOutput(json);

    // Normalize challenger arrays that sometimes arrive as strings
    if (normalized.personas?.challenger) {
        normalized.personas.challenger.contradictions = toArray(normalized.personas.challenger.contradictions);
        normalized.personas.challenger.falsification_tests = toArray(normalized.personas.challenger.falsification_tests);
    }

    parsed = PanelOutput.parse(normalized);
} catch (err) {
  if (err instanceof SyntaxError) {
    console.error("ERROR: Model returned invalid JSON:", raw);
  } else if (err instanceof ZodError) {
    console.error("ERROR: Zod schema validation failed:", err.errors);
  } else {
    console.error("ERROR: Unexpected error:", err);
  }

  // Fallback so your script continues instead of crashing
  parsed = {
    personas: {
      hypothesis: { top3: [] },
      test_chooser: { tests: [] },
      challenger: { anchoring_risks: [], contradictions: [], falsification_tests: [] },
      stewardship: { vetoed_tests: [], cheaper_alternatives: [] },
      checklist: { consistency_ok: true, safety_flags: [] }
    },
    consensus: { action: "ASK", questions: ["Could you clarify your symptoms?"], rationale: "Fallback default" }
  };
}

  // apply stewardship veto
  const veto = parsed.personas.stewardship.vetoed_tests || [];
  const finalOrders = (parsed.consensus.orders || []).filter(t => !veto.includes(t));

    // Ensure rationale always exists
    let rationale = parsed.consensus?.rationale;
    if (!rationale || rationale.trim() === "") {
    // Build a sensible default rationale from persona context
    const reasons = [];
    if (parsed.personas?.hypothesis?.differential?.length)
        reasons.push("based on the current leading differentials");
    if (parsed.personas?.test_chooser?.proposed_tests?.length || parsed.personas?.test_chooser?.tests?.length)
        reasons.push("tests were chosen to clarify diagnostic uncertainty");
    if (parsed.personas?.stewardship?.vetoed_tests?.length)
        reasons.push("low-yield or costly tests were excluded");
    if (parsed.consensus?.action === "COMMIT")
        reasons.push("the panel reached consensus with sufficient certainty for diagnosis");
    rationale = `This decision was made ${reasons.join(", ")}.`;
    }

    const consensus = {
    ...parsed.consensus,
    orders: finalOrders,
    rationale
    };


    await pool.query(
        `INSERT INTO panel_turns 
        (flow_id, step_index, panel_json, action, questions_json, orders_json, diagnosis_json, certainty, rationale)
        VALUES (?,?,?,?,?,?,?,?,?)`,
        [
            flowId, 
            stepIndex, 
            JSON.stringify(parsed),
            consensus.action,
            consensus.action === 'ASK' ? JSON.stringify(consensus.questions) : null,
            consensus.action === 'ORDER' ? JSON.stringify(finalOrders) : null,
            consensus.action === 'COMMIT' ? JSON.stringify({ diagnosis: consensus.diagnosis }) : null,
            consensus.certainty ?? null,
            consensus.rationale || "No rationale provided."
        ]
    );


  // also store final Markdown if commit
  if (consensus.action==='COMMIT' && (consensus.certainty??0)>=COMMIT_THRESHOLD) {
    await pool.query(
      `INSERT INTO llm_reports (ehr_id, task_type, model_name, output_md)
       SELECT ehr_id, 'diagnosis', ?, ? FROM llm_flows WHERE flow_id=?`,
      [process.env.OPENAI_MODEL, `**Diagnosis:** ${consensus.diagnosis}\n\n${consensus.rationale}`, flowId]
    );
    await pool.query(`UPDATE llm_flows SET status='ok', finished_at=NOW() WHERE flow_id=?`, [flowId]);
  }

  const done = (consensus.action==='COMMIT' && (consensus.certainty??0)>=COMMIT_THRESHOLD)
               || stepIndex+1>=MAX_STEPS;

  return { flowId, stepIndex, consensus, done };
}
