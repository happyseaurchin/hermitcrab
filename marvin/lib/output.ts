/**
 * output.ts — Output parsing and write routing.
 *
 * Port of mobius-2 kernel.py lines 612-690.
 */

import { parseStar, writeAt, type Block } from './bsp.js';

export interface MagiOutput {
  writes: Record<string, any>;
  status: string;
  note: string;
  function: any;
}

/** Parse LLM output JSON. Return structured output. */
export function parseOutput(text: string): MagiOutput {
  // Strip markdown fences
  let cleaned = text.trim()
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/```\s*$/m, '')
    .trim();

  try {
    return normalise(JSON.parse(cleaned));
  } catch { /* continue */ }

  // Try to find JSON object in text
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return normalise(JSON.parse(match[0]));
    } catch { /* continue */ }
  }

  // Fallback — treat full text as conversational response
  return { writes: {}, status: 'continue', note: text.slice(0, 2000), function: null };
}

function normalise(obj: any): MagiOutput {
  return {
    writes: obj.writes && typeof obj.writes === 'object' ? obj.writes : {},
    status: obj.status || 'continue',
    note: obj.note || '',
    function: obj.function ?? null,
  };
}

/** Validate a function config has valid structure. */
export function validateFunctionConfig(config: any): boolean {
  if (!config || typeof config !== 'object') return false;
  for (const key of Object.keys(config)) {
    if (key === '_') continue;
    if (!/^\d$/.test(key)) return false;
  }
  return true;
}

/**
 * Route writes from LLM output to shell blocks.
 * Returns the status string.
 */
export function routeOutput(
  output: MagiOutput,
  shellBlocks: Record<string, Block>,
): string {
  const MUTABLE = new Set(['conversation', 'history', 'conditions', 'purpose']);

  for (const [ref, value] of Object.entries(output.writes)) {
    const [blockName, address] = parseStar(ref);
    if (!blockName) continue;
    if (!MUTABLE.has(blockName)) continue; // skip writes to read-only blocks
    if (!shellBlocks[blockName]) shellBlocks[blockName] = { _: blockName };
    writeAt(shellBlocks[blockName], address, value);
  }

  return output.status;
}
