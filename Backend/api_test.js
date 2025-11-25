// api_test.js
import fs from "fs";

// config
const BASE = "http://localhost:8000";

async function main() {
  // login
  console.log(" Logging in...");

  const loginRes = await fetch(`${BASE}/login_user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "fong.jamesk@gmail.com",
      password: "password"
    })
  });

  const loginJson = await loginRes.json();
  if (!loginRes.ok) {
    console.error(" Login failed:", loginJson);
    return;
  }

  const token = loginJson.token;
  console.log(" Logged in. Token acquired.");

  // send raw ehr text for parsing
  console.log(" Sending EHR text to /api/ehr/parse ...");

  // Load EHR.txt or any sample EHR
  const ehrText = fs.readFileSync("EHR.txt", "utf8");

  const parseRes = await fetch(`${BASE}/api/ehr/parse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      ehr_text: ehrText,
      patient_id: 1
    })
  });

  const parseJson = await parseRes.json();
  if (!parseRes.ok) {
    console.error(` API test failed: /api/ehr/parse returned`, parseJson);
    return;
  }

  console.log(" EHR parsed and saved:", parseJson);

  const ehrId = parseJson.ehr_id;

  // Run FULL PANEL REPORT including FAISS RAG
  console.log(" Running panel from EHR...");

  const panelRes = await fetch(`${BASE}/api/reports/panel-from-ehr`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      ehr_id: ehrId
    })
  });

  const panelJson = await panelRes.json();

  if (!panelRes.ok) {
    console.error(" Panel failed:", panelJson);
    return;
  }

  console.log("=======================================");
  console.log(" FULL PANEL RESULTS");
  console.log("=======================================");
  console.dir(panelJson, { depth: 6 });

  // test FAISS alone
  console.log("\n🔍 Testing FAISS RAG engine directly...");

  const ragRes = await fetch(`${BASE}/api/rag/test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      query: "community acquired pneumonia management",
      top_k: 5
    })
  });

  const ragJson = await ragRes.json();

  if (!ragRes.ok) {
    console.error(" Direct RAG test failed:", ragJson);
  } else {
    console.log("=======================================");
    console.log(" Direct RAG Results (FAISS)");
    console.log("=======================================");
    console.dir(ragJson, { depth: 5 });
  }

  console.log("\n🎉 All tests completed.");
}

main().catch(err => { 
  console.error(" API test failed:", err);
});