// Backend/panel/panel_prompt.js
// composing a single "panel" prompt

import { PANEL_INSTRUCTIONS } from './personas.js';
import { chatJSON } from '../lib/openai.js';

export async function runPanelOnce({ patient, prior }) {
  const SYSTEM = PANEL_INSTRUCTIONS;

  // detect if previous step was repetitive
  let adaptiveTemp = 0.1;
  let personaHint = '';
  let prevAction = null;
  let prevOrders = null;

  try {
    if (typeof prior === 'string' && prior.includes('"action"')) {
      const lastJsonMatch = prior.match(/\{[\s\S]*?\}/g);
      if (lastJsonMatch) {
        const parsedPrior = JSON.parse(lastJsonMatch[lastJsonMatch.length - 1]);
        prevAction = parsedPrior?.consensus?.action || null;
        prevOrders = parsedPrior?.consensus?.orders || [];
      }
    }
  } catch {
    // ignore bad JSON in prior summary
  }

  // use small stochastic exploration only if action+orders repeat
  if (prevAction && Array.isArray(prevOrders)) {
    // detect identical action/orders repeated in previous summary lines
    const repeatsDetected =
      (prior.match(new RegExp(`Action=${prevAction}`, 'g'))?.length || 0) > 1 &&
      (prevOrders.length > 0
        ? prior.includes(prevOrders.join(','))
        : false);

    if (repeatsDetected) {
      adaptiveTemp = Math.min(0.1 + Math.random() * 0.4, 0.6); // 0.1–0.5 range
      const personaHints = [
        "Let Dr. Challenger take a leading role in this round.",
        "Let Dr. Hypothesis reconsider less likely differentials.",
        "Let Dr. Stewardship question test efficiency this round.",
        "Let Dr. Checklist ensure logical consistency of prior steps."
      ];
      personaHint = personaHints[Math.floor(Math.random() * personaHints.length)];
      console.log(`🔄 Repetition detected — increasing temperature to ${adaptiveTemp.toFixed(2)} (${personaHint})`);
    }
  }

  const raw = await chatJSON({
    system: `${SYSTEM}\n\n${personaHint}\n\nYou must respond ONLY in valid JSON matching the schema provided.`,
    user: {
      patient,
      prior,
      schema:
        "The JSON must include {personas: {...}, consensus: {...}}. " +
        "The consensus object MUST contain: " +
        "action (ASK, ORDER, or COMMIT); rationale (short paragraph explaining the reasoning); " +
        "certainty (0.0–1.0); and exactly ONE of the following depending on action: " +
        "- if action='ASK', include a non-empty 'questions' array (up to 3 concise patient questions); " +
        "- if action='ORDER', include a non-empty 'orders' array (up to 3 diagnostic tests); " +
        "- if action='COMMIT', include a 'diagnosis' string describing the final diagnosis."
    },
    temperature: adaptiveTemp
  });

  return raw;
}
