// Backend/rag/search_faiss.js
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { embedText } from "../lib/openai.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Adjust if you need python3
const PYTHON = "python";

export async function ragSearchFaiss(query, topK = 5) {
  // 1. Embed query using OpenAI
  const embedding = await embedText(query);

  // 2. Prepare FAISS query payload
  const script = path.join(__dirname, "faiss_query.py");
  const payload = JSON.stringify({ embedding, top_k: topK });

  // 3. Run Python FAISS inference
  const result = spawnSync(PYTHON, [script], {
    input: payload,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024 // 50MB safety
  });

  if (result.error) {
    console.error("❌ FAISS spawn error:", result.error);
    throw result.error;
  }

  if (result.status !== 0) {
    console.error("❌ Python exit code:", result.status);
    console.error(result.stderr);
    throw new Error("FAISS query failed");
  }

  try {
    return JSON.parse(result.stdout);
  } catch (err) {
    console.error("❌ Failed to parse FAISS output:", err);
    console.log("RAW:", result.stdout);
    throw err;
  }
}