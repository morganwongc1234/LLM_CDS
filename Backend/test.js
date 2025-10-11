// test.js – generate a structured clinical report & treatment plan with Mistral
import 'dotenv/config';
import { Mistral } from '@mistralai/mistralai';

const apiKey = (process.env.MISTRAL_API_KEY || '').trim();
console.log('Key length =', apiKey.length, 'starts with =', apiKey.slice(0, 6));
if (!apiKey) throw new Error('Missing MISTRAL_API_KEY in .env');

const client = new Mistral({ apiKey });

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
You are a careful, evidence-aware clinical decision support assistant.
Produce a concise, structured Markdown report using the following headings exactly:
1) Summary
2) Differential diagnosis
3) Most likely diagnosis (with justification)
4) Red flags / when to escalate
5) Investigations (only if needed)
6) Management plan (non-pharmacological & pharmacological)
7) Patient education & safety-netting
8) References (short, credible)

Rules:
- Be specific to the patient data provided. Do not hallucinate unavailable results.
- If information is insufficient, state what is missing and how it changes certainty.
- Use Australian primary-care context if locale=AU (drug names, dosing ranges, PBS availability when relevant).
- Respect allergies and constraints.
- Keep within 350–550 words. Use bullet lists where clearer.
`;

const userPrompt = `
PATIENT
-------
Name: ${patient.prefix ? patient.prefix + ' ' : ''}${patient.first_name} ${patient.last_name} (DOB ${patient.dob}, Sex ${patient.sex})
Height/Weight: ${patient.height_cm} cm / ${patient.weight_kg} kg
Vitals: T ${patient.vitals.temp_c}°C, HR ${patient.vitals.hr}/min, BP ${patient.vitals.bp}, RR ${patient.vitals.rr}/min, SpO2 ${patient.vitals.spo2}%
Allergies: ${patient.allergies.join('; ') || 'none recorded'}
Current meds: ${patient.meds.join('; ') || 'none recorded'}
PMH: ${patient.pmh.join('; ') || '—'}
FHx: ${patient.fhx.join('; ') || '—'}
SHx: ${patient.shx.join('; ') || '—'}

PRESENTATION
------------
Chief complaint: ${patient.chief_complaint}
HPI: ${patient.history_of_present_illness}
Examination: ${patient.exam.join('; ') || '—'}
Labs: CRP ${patient.labs.CRP_mg_L} mg/L; WBC ${patient.labs.WBC_10e9_L} ×10^9/L; Eos ${patient.labs.eos_10e9_L} ×10^9/L
Imaging: ${patient.imaging.join('; ') || '—'}
Red flags denied: ${patient.red_flags_denied.join('; ') || '—'}

GOALS & CONSTRAINTS
--------------------
Patient goals: ${patient.goals.join('; ')}
Constraints: ${patient.constraints.join('; ')}
Locale: ${patient.locale}

TASK
----
Generate the report and an initial treatment plan according to the rules.
`;

try {
  const chatResponse = await client.chat.complete({
    model: 'mistral-small-latest',      // smaller model for dev; upgrade later if needed
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    // temperature: 0.2, // uncomment if the SDK supports it; default is fine for now
  });

  console.log('\n===== CLINICAL REPORT (Markdown) =====\n');
  console.log(chatResponse.choices[0].message.content);
} catch (e) {
  console.error('Mistral error:', e);
}