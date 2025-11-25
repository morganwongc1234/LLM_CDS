// Backend/lib/openai.js

import OpenAI from 'openai';

export const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

export const EMBEDDING_MODEL =
  process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-large';

export const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function chatJSON({ system, user, temperature = 0.1 }) {
  const res = await client.chat.completions.create({
    model: MODEL,
    temperature,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: typeof user === 'string' ? user : JSON.stringify(user)
      }
    ]
  });

  return res.choices[0]?.message?.content ?? '{}';
}

export async function embedText(input) {
  const res = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input
  });

  // If input is an array of strings, return array of vectors
  if (Array.isArray(input)) {
    return res.data.map(d => d.embedding);
  }

  // If single string, return single vector
  return res.data[0].embedding;
}
