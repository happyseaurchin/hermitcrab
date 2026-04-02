/**
 * compile.ts — Context compilation pipeline.
 *
 * Port of mobius-2 kernel.py lines 228-347.
 * Follows star references in function config, loads target blocks via BSP,
 * builds system prompt and message for the LLM.
 */

import { bsp, underscoreText, parseStar, isValidMode, type Block, type BspMode } from './bsp.js';

export type BlockLoader = (name: string) => Block;

export interface CompiledBranch {
  desc: string;
  ref: string | null;
  mode: BspMode;
  content: any;
  blockName: string;
}

export interface CompilationResult {
  system: string;
  message: string;
  compiled: Record<string, CompiledBranch>;
}

/** Format BSP output as readable string. */
function formatContent(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((text, i) => `${'  '.repeat(i)}> ${text}`).join('\n');
  }
  if (content && typeof content === 'object') {
    return JSON.stringify(content, null, 2);
  }
  return String(content);
}

/**
 * Compile context from function config + starstone + block loader.
 *
 * The function config is the engagement concern's aperture — it specifies
 * which blocks to compile and in which BSP mode.
 */
export function compileContext(
  fnConfig: Block,
  starstone: Block,
  loadBlock: BlockLoader,
): CompilationResult {
  const compiled: Record<string, CompiledBranch> = {};

  // Walk each numbered branch of the function config
  for (const key of Object.keys(fnConfig).filter(k => /^\d$/.test(k)).sort()) {
    const branch = fnConfig[key];
    if (!branch || typeof branch !== 'object') continue;

    // Extract description and star ref from hidden directory
    let desc = '';
    let starRef: string | null = null;
    if ('_' in branch && branch._ && typeof branch._ === 'object') {
      const us = branch._;
      [desc] = underscoreText(us);
      starRef = us['1'] ?? null; // first star reference
    }

    // Extract BSP mode from branch key "1"
    const modeVal = branch['1'];
    const mode: BspMode = (typeof modeVal === 'string' && isValidMode(modeVal)) ? modeVal : 'spindle';

    if (!starRef) {
      compiled[key] = { desc, ref: null, mode, content: '', blockName: '' };
      continue;
    }

    const [blockName, address] = parseStar(starRef);
    if (!blockName) continue;

    const target = loadBlock(blockName);
    const content = bsp(target, address, mode);
    compiled[key] = { desc, ref: starRef, mode, content, blockName };
  }

  // ── Build system prompt ──

  const systemParts: string[] = [];

  // Starstone (constant)
  systemParts.push('=== STARSTONE ===');
  systemParts.push(formatContent(bsp(starstone, '_', 'dir')));

  // Identity (if any branch references it)
  for (const info of Object.values(compiled)) {
    if (info.blockName === 'identity') {
      systemParts.push('\n=== IDENTITY ===');
      systemParts.push(formatContent(info.content));
      break;
    }
  }

  // Function config (the LLM sees its own aperture)
  systemParts.push('\n=== FUNCTION ===');
  systemParts.push(JSON.stringify(fnConfig, null, 2));

  // Mirror with PCT preamble
  systemParts.push('\n=== MIRROR ===');
  systemParts.push(
    'Purpose is your reference signal \u2014 what should be. ' +
    'Conditions is your perceptual signal \u2014 what is. ' +
    'The gap between them is your task. ' +
    'Your writes close the gap. ' +
    'Your function modifications reshape what the next instance perceives.'
  );
  systemParts.push('\nYour context was compiled from these references:');
  for (const key of Object.keys(compiled).sort()) {
    const info = compiled[key];
    systemParts.push(`  Branch ${key}: ${info.ref ?? 'none'} (${info.mode}) \u2192 ${info.desc.slice(0, 60)}`);
  }

  // Output contract
  systemParts.push('\n=== OUTPUT CONTRACT ===');
  systemParts.push(
    'Return JSON (or JSON inside ```json fences):\n' +
    '{\n' +
    '  "writes": {"blockname:address": "content to write"},\n' +
    '  "status": "continue | complete | escalate",\n' +
    '  "note": "Your full conversational response to the human. This is what they will read.",\n' +
    '  "function": null\n' +
    '}\n' +
    'Set "function" to a replacement function config to reshape your next aperture, or null/omit to keep it.\n' +
    '"writes" keys use star reference format: "blockname:address". Writing to a new block name creates it.\n' +
    '"status": continue = conversation ongoing. complete = conversation concluded. escalate = need broader scope.\n' +
    'IMPORTANT: The "note" field is your response to the human. Write your full answer there \u2014 not a summary, the actual response they should read.'
  );

  // ── Build message (compiled currents) ──

  const messageParts: string[] = [];
  const sectionLabels: Record<string, string> = {
    purpose: 'PURPOSE', conditions: 'CONDITIONS', history: 'HISTORY',
    conversation: 'CONVERSATION', identity: 'IDENTITY',
  };

  for (const key of Object.keys(compiled).sort()) {
    const info = compiled[key];
    const bname = info.blockName;
    const label = sectionLabels[bname] ?? (bname ? bname.toUpperCase() : `BRANCH ${key}`);
    if (bname === 'identity') continue; // already in system prompt
    const content = info.content;
    if (content && (typeof content === 'string' ? content.length > 0 : true)) {
      messageParts.push(`=== ${label} ===`);
      messageParts.push(formatContent(content));
    }
  }

  return {
    system: systemParts.join('\n'),
    message: messageParts.join('\n'),
    compiled,
  };
}
