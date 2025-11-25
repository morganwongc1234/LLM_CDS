// backend/rag/search.js
// Minimal FAISS RAG retrieval wrapper for server.js

import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to FAISS index + metadata
const INDEX_PATH = path.join(__dirname, 'medical_rag.index');
const META_PATH  = path.join(__dirname, 'medical_rag_meta.jsonl');

// Python script for querying FAISS
const PYTHON_SEARCH = path.join(__dirname, 'search_faiss.py');

/**
 * Runs a FAISS similarity search using Python script.
 * @param {string} query - text query
 * @param {number} topK - number of results
 * @returns {Promise<Array>} list of matched chunks
 */
export async function faissSearch(query, topK = 5) {
  return new Promise((resolve, reject) => {
    const py = spawn('python', [
      PYTHON_SEARCH,
      '--query', query,
      '--k', String(topK),
      '--index', INDEX_PATH,
      '--meta', META_PATH
    ]);

    let output = '';
    let error = '';

    py.stdout.on('data', (d) => (output += d.toString()));
    py.stderr.on('data', (d) => (error += d.toString()));

    py.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`FAISS search failed: ${error}`));
      }
      try {
        const json = JSON.parse(output);
        resolve(json);
      } catch (err) {
        reject(new Error(`FAISS output was not valid JSON: ${output}`));
      }
    });
  });
}