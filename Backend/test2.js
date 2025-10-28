// test2.js — Vision + Patient Summary Report Generator
//
// node test2.js --file ./images/chest_xray.jpg
//
// Requires .env with MISTRAL_API_KEY=...

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import process from 'process';
import { Mistral } from '@mistralai/mistralai';

const apiKey = (process.env.MISTRAL_API_KEY || '').trim();
if (!apiKey) {
  console.error('Missing MISTRAL_API_KEY in .env');
  process.exit(1);
}

// Choose model (vision-capable)
const MODEL = process.env.MISTRAL_VISION_MODEL || 'pixtral-large-latest';

// ---------- CLI args ----------
const args = process.argv.slice(2);
let localFile = './images/chest_xray.jpg'; // default test image
let userPrompt = 'Patient presents with mild fever, cough, and shortness of breath.';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file' && args[i + 1]) localFile = args[++i];
  else if (args[i] === '--prompt' && args[i + 1]) userPrompt = args[++i];
}

// ---------- Random Patient Generator ----------
function randPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function randomPatient() {
  const firstNames = ['Alex','Jamie','Morgan','Taylor','Jordan','Riley','Casey','Avery'];
  const lastNames  = ['Wong','Patel','Nguyen','Smith','Brown','Martin','Singh','Lee'];
  const sex = randPick(['M','F']);
  const age = randInt(25, 82);
  const height = randInt(155, 190);
  const weight = randInt(50, 110);
  const vitals = {
    HR: randInt(60, 105),
    RR: randInt(12, 24),
    BP: `${randInt(100, 145)}/${randInt(60, 95)}`,
    TempC: (36 + Math.random() * 2).toFixed(1),
    SpO2: randInt(91, 99)
  };

  return {
    full_name: `${randPick(firstNames)} ${randPick(lastNames)}`,
    age,
    sex,
    dob: `${new Date().getFullYear() - age}-0${randInt(1,9)}-${String(randInt(1,28)).padStart(2,'0')}`,
    phone: `04${randInt(10000000, 99999999)}`,
    address: `${randInt(1,99)} Example St, Sydney NSW`,
    vitals,
    height_cm: height,
    weight_kg: weight,
    symptoms: randPick([
      'Dry cough and fatigue for 5 days',
      'Fever, pleuritic chest pain and breathlessness',
      'Productive cough with green sputum',
      'Chest tightness with mild wheezing' 
    ]),
    history: randPick([
      'Type 2 diabetes, on metformin',
      'Hypertension, no recent travel',
      'Asthma in childhood, no inhaler use recently',
      'Smoker (10 pack-years), quit 3 years ago'
    ]),
    medications: randPick([
      'Metformin 500 mg BD',
      'Ramipril 5 mg OD',
      'No regular medications'
    ]),
    allergies: randPick([
      'None known',
      'Penicillin – rash',
      'NKDA'
    ])
  };
}

// ---------- Image Handling ----------
function buildImageChunk() {
  const abs = path.resolve(localFile);
  if (!fs.existsSync(abs)) throw new Error(`Local file not found: ${abs}`);
  const ext = path.extname(abs).toLowerCase();
  const mime =
    ext === '.png' ? 'image/png' :
    ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
    'application/octet-stream';
  const b64 = fs.readFileSync(abs, { encoding: 'base64' });
  return { type: 'image_url', imageUrl: { url: `data:${mime};base64,${b64}` } };
}

// ---------- Prompts ----------
const systemPrompt = `You are an evidence-based clinical assistant.
Always start with a "Patient Summary" (key demographics, vitals, main symptoms, and risk factors).
Then analyse the attached medical image:
- Identify the image and body region.
- Compare findings against normal anatomy.
- Reason toward the most likely diagnosis and 2–4 differentials.
- Propose an initial management / treatment plan (stepwise).
- List 3–5 reputable sources as "Suggested References" (e.g., NICE, WHO, CDC, UpToDate, RACGP).
Keep total response concise (<1000 words) and formatted in Markdown headings.`;

function buildUserPrompt(patient, extraPrompt) {
  return `## Patient Information
${JSON.stringify(patient, null, 2)}

## Clinical Question
${extraPrompt}

Please analyse the image in context of this patient's presentation.`;
}

// ---------- Main ----------
async function main() {
  console.log('Model:', MODEL);
  const patient = randomPatient();
  const imgChunk = buildImageChunk();
  const client = new Mistral({ apiKey });

  const userContent = buildUserPrompt(patient, userPrompt);

  try {
    const resp = await client.chat.complete({
      model: MODEL,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userContent },
            imgChunk
          ]
        }
      ]
    });

    const out = resp.choices?.[0]?.message?.content ?? '(no content)';
    console.log('\n================ PATIENT REPORT ================\n');
    console.log(out);
    console.log('\n================================================\n');

  } catch (e) {
    console.error('Mistral error:', e?.statusCode || '', e?.body || e);
  }
}

main();