// Backend/panel/schema.js
// zod schemas for JSON I/O

import { z } from 'zod';

export const DiffItem = z.object({
  dx: z.string(),
  probability: z.number().min(0).max(1),
  key_features: z.array(z.string())
});

export const PanelOutput = z.object({
  personas: z.object({
    hypothesis: z.object({ top3: z.array(DiffItem).optional() }).optional(),
    test_chooser: z.object({ tests: z.array(z.string()).optional() }).optional(),
    challenger: z.object({
      anchoring_risks: z.array(z.string()).optional(),
      contradictions: z.array(z.string()).optional(),
      falsification_tests: z.array(z.string()).optional()
    }).optional(),
    stewardship: z.object({
      vetoed_tests: z.array(z.string()).optional(),
      cheaper_alternatives: z.array(z.string()).optional()
    }).optional(),
    checklist: z.object({
      consistency_ok: z.boolean().optional(),
      safety_flags: z.array(z.string()).optional()
    }).optional()
  }),
  consensus: z.object({
    action: z.enum(['ASK', 'ORDER', 'COMMIT']),
    rationale: z.string().optional(),
    questions: z.array(z.string()).optional(),
    orders: z.array(z.string()).optional(),
    diagnosis: z.string().nullable().optional(),
    certainty: z.number().optional()
  })
});
