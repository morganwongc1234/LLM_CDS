// Backend/lib/ehr_parser.js
import { chatJSON } from './openai.js';

const SYSTEM_PROMPT = `
You are an AI assistant that converts raw EHR clinical notes into a structured json object.

IMPORTANT JSON REQUIREMENTS:
- The response MUST be valid json.
- You MUST output a json object and nothing else.
- The content of your reply must contain ONLY json.
- The word "json" is intentionally included here many times to satisfy the OpenAI response_format rules.

RETURN STRICT JSON WITH EXACTLY THESE KEYS:
{
  "prefix": string|null,
  "first_name": string|null,
  "last_name": string|null,
  "dob": string|null,
  "sex": string|null,
  "height_cm": number|null,
  "weight_kg": number|null,
  "vitals": object|null,
  "allergies": array,
  "meds": array,
  "pmh": array,
  "fhx": array,
  "shx": array,
  "chief_complaint": string|null,
  "history_of_present_illness": string|null,
  "exam": array,
  "labs": object|null,
  "imaging": array,
  "red_flags_denied": array,
  "goals": array,
  "constraints": array,
  "locale": string|null
}

RULES:
- If information is missing, set json fields to null or [].
- Never hallucinate details that are not present in the input.
- The response MUST be raw json only.
`;

export async function parseEhrToSnapshot(ehrText, overrides = {}) {
  const userPrompt = `
IMPORTANT:
Return ONLY json.
Your output must be valid json.
Convert the following EHR text into structured json.

EHR TEXT:
${ehrText}
`;

  // Call OpenAI through chatJSON wrapper
const raw = await chatJSON({
  system: SYSTEM_PROMPT,
  user: userPrompt,
  temperature: 0.1
});


  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("EHR parser: model returned invalid JSON:", raw);
    throw new Error("EHR parser: invalid JSON from model");
  }

  // Normalize snapshot
  return {
    prefix: parsed.prefix ?? null,
    first_name: parsed.first_name ?? null,
    last_name: parsed.last_name ?? null,
    dob: parsed.dob ?? null,
    sex: parsed.sex ?? null,
    height_cm: parsed.height_cm ?? null,
    weight_kg: parsed.weight_kg ?? null,
    vitals: parsed.vitals ?? null,
    allergies: parsed.allergies ?? [],
    meds: parsed.meds ?? [],
    pmh: parsed.pmh ?? [],
    fhx: parsed.fhx ?? [],
    shx: parsed.shx ?? [],
    chief_complaint: parsed.chief_complaint ?? null,
    history_of_present_illness: parsed.history_of_present_illness ?? null,
    exam: parsed.exam ?? [],
    labs: parsed.labs ?? null,
    imaging: parsed.imaging ?? [],
    red_flags_denied: parsed.red_flags_denied ?? [],
    goals: parsed.goals ?? [],
    constraints: parsed.constraints ?? [],
    locale: overrides.locale ?? parsed.locale ?? "AU"
  };
}

export function snapshotToEhrDbFields(snapshot, rawEhrText) {
  return {
    labs_json: snapshot.labs ?? null,
    symptoms_json: snapshot,
    history_text:
      snapshot.history_of_present_illness?.toString().slice(0, 4000) ??
      rawEhrText.slice(0, 4000)
  };
}
