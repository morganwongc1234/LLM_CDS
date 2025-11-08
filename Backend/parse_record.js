// parse_record.js
// convert a plaintext electronic health record (EHR) into JSON, and write to the database

import 'dotenv/config';
import fs from 'fs';
import readline from 'readline';
import mysql from 'mysql2/promise';
import OpenAI from 'openai';

// create a CLI prompt interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// connect to database
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// main async function
async function main() {
  try {
    // read EHR.txt
    const ehrText = fs.readFileSync('../DataBases/EHR.txt', 'utf8').trim();
    if (!ehrText) {
      console.error('ERROR: EHR.txt is empty or missing.');
      process.exit(1);
    }

    // prompt user for patient ID
    const patient_id = await new Promise((resolve) => {
      rl.question('Enter patient ID: ', (id) => resolve(id.trim()));
    });

    if (!patient_id) {
      console.error('ERROR: Invalid patient ID entered.');
      rl.close();
      process.exit(1);
    }

    rl.close();

    // connect to api
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    console.log(`\n📄 Processing EHR for patient ${patient_id}...`);

    // setup GPT prompt
    const systemPrompt = `
    You are a clinical data extraction assistant.
    Convert the provided unstructured medical record into structured JSON.
    Capture vitals, symptoms, diagnoses, medications, allergies, and investigations.
    Use null where information is missing.
    Output only valid JSON with no Markdown fences, code blocks, or explanations.
    Expected keys: labs_json, symptoms_json, history_text.
    `;

    const userPrompt = `PATIENT RECORD:\n\n${ehrText}\n\nGenerate structured JSON output.`;

    // call api
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    });

    const modelResponse = completion.choices[0].message.content.trim();

    // strip Markdown fences, can replace with a more specific prompt to the AI
    const cleaned = modelResponse
        .replace(/^```json\s*/i, '')   // remove leading ```json
        .replace(/^```\s*/i, '')       // or ``` without json
        .replace(/```$/, '')           // remove trailing ```
        .trim();

    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch (e) {
        console.error("ERROR: GPT output was not valid JSON:\n", modelResponse);
        console.error("Parse error:", e.message);
        process.exit(1);
    }


    // insert into database
    const [r] = await pool.execute(
      `INSERT INTO ehr_inputs (patient_id, author_user_id, labs_json, symptoms_json, history_text)
       VALUES (?, ?, ?, ?, ?)`,
      [
        patient_id,
        1, // default author ID
        JSON.stringify(parsed.labs_json || {}),
        JSON.stringify(parsed.symptoms_json || {}),
        parsed.history_text || ehrText,
      ]
    );

    console.log('\nRecord successfully saved!');
    console.log(`Inserted EHR_ID: ${r.insertId}`);
    console.log('\n--- Parsed JSON ---');
    console.log(JSON.stringify(parsed, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('\nError:', err.message);
    process.exit(1);
  }
}

main();