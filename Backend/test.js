// test.js – generate a structured clinical report & treatment plan with Mistral
import 'dotenv/config';
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function main() {
  const chatResponse = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  console.log(chatResponse.choices[0].message.content);
}

// import { Mistral } from '@mistralai/mistralai';

// const apiKey = (process.env.MISTRAL_API_KEY || '').trim();
// console.log('Key length =', apiKey.length, 'starts with =', apiKey.slice(0, 6));
// if (!apiKey) throw new Error('Missing MISTRAL_API_KEY in .env');

// const client = new Mistral({ apiKey });



// ---- Demo patient case (replace with real EHR fields later) ----
const patient = {
  prefix: 'Ms',
  first_name: 'Sam',
  last_name: 'Lee',
  dob: '1985-04-11',
  sex: 'F',
  height_cm: 165,
  weight_kg: 68,
  vitals: { temp_c: 37.8, hr: 96, bp: '128/82', rr: 18, spo2: 97 },
  allergies: ['amoxicillin (rash)'],
  meds: ['salbutamol inhaler PRN'],
  pmh: ['asthma (mild persistent)', 'COVID-19 (2023, recovered)'],
  fhx: ['mother – HTN'],
  shx: ['non-smoker', 'occasional alcohol'],
  chief_complaint: 'Dry cough for 10 days, worse at night',
  history_of_present_illness:
    'Cough started after a viral URTI. No chest pain. Mild wheeze. Using salbutamol 1–2 times/day. No fever after day 3. Sleep disturbed by cough.',
  exam: ['mild expiratory wheeze bilaterally', 'no crackles', 'no accessory muscle use'],
  labs: { CRP_mg_L: 12.4, WBC_10e9_L: 8.6, eos_10e9_L: 0.5 },
  imaging: ['CXR (10-Oct-2025): clear lung fields, no consolidation'],
  red_flags_denied: ['hemoptysis', 'weight loss', 'dysphagia', 'night sweats'],
  goals: ['relieve night cough', 'prevent asthma exacerbation', 'avoid antibiotics if viral'],
  constraints: ['allergy to amoxicillin', 'prefer once-daily meds if possible'],
  locale: 'AU',
};

// ---- Prompt design: system + user (structured Markdown output) ----
const systemPrompt = `
You are an AI clinical decision support assistant for Australian general practice.

Task:
Generate a concise, structured clinical report and initial management plan based on the provided patient data.

Structure the response under these exact Markdown headings:
1. ## Summary
2. ## Differential diagnoses
3. ## Most likely diagnosis (with justification)
4. ## Red flags / criteria for escalation or referral
5. ## Recommended investigations (if indicated)
6. ## Management plan (non-pharmacological & pharmacological)
7. ## Patient education & safety-netting
8. ## References (Australian and credible)

Guidelines and standards:
- Apply RACGP, Therapeutic Guidelines (Australia), Australian Medicines Handbook, and HealthPathways.
- Include brief, evidence-based reasoning with in-text references such as:
  - "According to RACGP Asthma Handbook (2023)..."
  - "Per Australian Therapeutic Guidelines, antibiotic use is not recommended unless..."
- Use Australian English and metric units.
- Mention PBS-listed medicines and typical local dosing ranges when relevant.
- If information is missing, clearly state assumptions or uncertainty.
- Never fabricate results or imply diagnostic certainty.
- Prioritise clarity, brevity, and evidence-based reasoning.
- Keep total length between 350–550 words.

Output formatting:
- Use Markdown headings exactly as listed.
- Use bullet points for management recommendations and patient education.
- Append a confidence rating (High / Moderate / Low) at the end of the Summary section.
`;

const userPrompt = `
PATIENT DATA (JSON, STRICT)
---------------------------
${JSON.stringify(patient, null, 2)}

TASK
----
Validate that the input JSON is complete. If fields appear missing, mention which ones are absent before analysis.

INSTRUCTIONS
------------
Follow the system prompt. Generate the report using the exact Markdown headings.
`;

try {
  const chatResponse = await client.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.2, // test 0.1
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  console.log('\n===== CLINICAL REPORT (Markdown) =====\n');
  console.log(chatResponse.choices[0].message.content);
} catch (e) {
  console.error('OpenAI Error:', e);
}