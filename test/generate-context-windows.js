#!/usr/bin/env node
// generate-context-windows.js
// Loads all block JSON files, implements the G1 kernel's bsp() and prompt compiler,
// then executes instruction sets from the wake block to produce the actual system
// prompt content that the LLM would see for three scenarios:
//   1. Shallow birth  (wake 0.6.5.1)
//   2. Deep birth     (wake 0.6.5.2)
//   3. Present tier   (wake 0.9.2)

const fs = require('fs');
const path = require('path');

const BLOCKS_DIR = path.resolve(__dirname, '..', 'blocks');
const OUTPUT_DIR = __dirname;

// ============ LOAD ALL BLOCKS ============

const blocks = {};

for (const file of fs.readdirSync(BLOCKS_DIR)) {
  if (!file.endsWith('.json')) continue;
  const name = file.replace('.json', '');
  const data = JSON.parse(fs.readFileSync(path.join(BLOCKS_DIR, file), 'utf8'));
  blocks[name] = data;
}

console.log(`Loaded ${Object.keys(blocks).length} blocks: ${Object.keys(blocks).join(', ')}`);

// ============ BLOCK NAVIGATION (from kernel) ============

function blockNavigate(block, pathStr) {
  if (!pathStr) return block.tree;
  const keys = pathStr.split('.');
  let node = block.tree;
  for (const k of keys) {
    if (node === null || node === undefined) return null;
    if (typeof node === 'string') return null;
    node = node[k];
  }
  return node;
}

// ============ X~ SPREAD (from kernel) ============

function xSpread(block, pathStr) {
  const node = pathStr ? blockNavigate(block, pathStr) : block.tree;
  if (node === null || node === undefined) return null;
  if (typeof node === 'string') return { text: node, children: [] };
  const text = node._ || null;
  const children = [];
  for (const [k, v] of Object.entries(node)) {
    if (k === '_') continue;
    const childText = typeof v === 'string' ? v : (v && typeof v === 'object' && v._) ? v._ : null;
    children.push({ digit: k, text: childText, branch: typeof v === 'object' && v !== null });
  }
  return { text, children };
}

// ============ BSP (from kernel, exact implementation) ============

function bsp(block, spindle, point) {
  const blk = typeof block === 'string' ? blocks[block] : block;
  if (!blk || !blk.tree) return { mode: 'block', tree: {} };

  // Block mode — no spindle, return full tree (unless point is a nav mode)
  if ((spindle === undefined || spindle === null) && typeof point !== 'string') {
    return { mode: 'block', tree: blk.tree };
  }

  // Parse the semantic number (or default to root for no-spindle nav modes)
  let walkDigits, hasPscale, digitsBefore;
  if (spindle === undefined || spindle === null) {
    // No spindle but string point mode — operate on root
    walkDigits = [];
    hasPscale = true;
    digitsBefore = 0;
  } else {
    const str = typeof spindle === 'number' ? spindle.toFixed(10) : String(spindle);
    const parts = str.split('.');
    const intStr = parts[0] || '0';
    const fracStr = (parts[1] || '').replace(/0+$/, '');
    // Delineation: integer part is "0" — strip it, walk only fractional digits
    // 0.234 → walk [2,3,4]; bare 0 → walk nothing (root only)
    const isDelineation = intStr === '0';
    walkDigits = isDelineation
      ? fracStr.split('').filter(c => c.length > 0)
      : (intStr + fracStr).split('');
    // Pscale from decimal position
    // Delineation (0 or 0.xxx): root is pscale 0
    // Regular with decimal (23.45): root is pscale = intStr.length
    // No decimal (2345): no pscale
    hasPscale = isDelineation || fracStr.length > 0;
    digitsBefore = isDelineation ? 0 : (hasPscale ? intStr.length : -1);
  }

  // Build spindle — root always included
  const nodes = [];
  let node = blk.tree;

  // Root: the block's identity (tree._)
  const rootText = (typeof node === 'object' && node !== null && typeof node['_'] === 'string')
    ? node['_'] : null;
  if (rootText !== null) {
    nodes.push({ pscale: hasPscale ? digitsBefore : null, text: rootText });
  }

  // Walk digits through the tree
  for (let i = 0; i < walkDigits.length; i++) {
    const d = walkDigits[i];
    if (!node || typeof node !== 'object' || node[d] === undefined) break;
    node = node[d];
    const text = typeof node === 'string'
      ? node
      : (typeof node === 'object' && node !== null && typeof node['_'] === 'string')
        ? node['_']
        : JSON.stringify(node);
    nodes.push({
      pscale: hasPscale ? (digitsBefore - 1) - i : null,
      digit: d,
      text
    });
  }

  if (nodes.length === 0) return { mode: 'spindle', nodes: [] };

  // Point mode — return the semantic at the specified pscale level
  // String modes: '~' = spread (X~), '*' = tree (recursive subtree)
  if (point !== undefined && point !== null) {
    if (typeof point === 'string') {
      const endPath = walkDigits.length > 0 ? walkDigits.join('.') : null;
      if (point === '~') {
        const spread = xSpread(blk, endPath);
        if (!spread) return { mode: 'spread', path: endPath, text: null, children: [] };
        return { mode: 'spread', path: endPath, ...spread };
      }
      if (point === '*') {
        const endNode = endPath ? blockNavigate(blk, endPath) : blk.tree;
        if (!endNode) return { mode: 'tree', path: endPath, text: null, children: [] };
        const subtree = resolveBlock({ tree: endNode }, 9);
        return { mode: 'tree', path: endPath, text: subtree.text, children: subtree.children };
      }
      return { mode: 'error', error: `Unknown point mode: ${point}` };
    }
    // Numeric: pscale extraction
    const target = nodes.find(n => n.pscale === point);
    if (target) return { mode: 'point', text: target.text, pscale: target.pscale };
    const last = nodes[nodes.length - 1];
    return { mode: 'point', text: last.text, pscale: last.pscale };
  }

  // Spindle mode — return the full chain, high pscale to low
  return { mode: 'spindle', nodes };
}

// Resolve — phrase-level view of a block (from kernel)
function resolveBlock(block, maxDepth) {
  maxDepth = maxDepth || 3;
  function walk(node, depth, pathStr) {
    if (depth > maxDepth) return null;
    if (typeof node === 'string') return { path: pathStr, text: node };
    if (!node) return null;
    const result = { path: pathStr, text: node._ || null, children: [] };
    for (const [k, v] of Object.entries(node)) {
      if (k === '_') continue;
      const childPath = pathStr ? `${pathStr}.${k}` : k;
      const child = walk(v, depth + 1, childPath);
      if (child) result.children.push(child);
    }
    return result;
  }
  return walk(block.tree, 0, '');
}

// ============ PROMPT COMPILER (from kernel, exact implementation) ============

// Parse a prompt instruction string into bsp arguments.
function parseInstruction(instr) {
  const parts = instr.trim().split(/\s+/);
  const blockName = parts[0];
  const spindle = parts.length > 1 ? parseFloat(parts[1]) : undefined;
  const point = parts.length > 2 ? parseFloat(parts[2]) : undefined;
  return { blockName, spindle, point };
}

// Format full block content for the prompt.
// Renders the pscale JSON as indented text the LLM can read.
function formatBlockContent(block) {
  const lines = [];
  function render(node, depth) {
    if (typeof node === 'string') {
      lines.push('  '.repeat(depth) + node);
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (node._) lines.push('  '.repeat(depth) + node._);
    for (const [k, v] of Object.entries(node)) {
      if (k === '_') continue;
      if (typeof v === 'string') {
        lines.push('  '.repeat(depth) + `${k}: ${v}`);
      } else {
        lines.push('  '.repeat(depth) + `${k}:`);
        render(v, depth + 1);
      }
    }
  }
  render(block.tree, 0);
  return lines.join('\n');
}

// Execute one bsp instruction and format the result for the prompt.
function executeInstruction(instr) {
  const { blockName, spindle, point } = parseInstruction(instr);
  const block = blocks[blockName];
  if (!block) return '';

  const result = bsp(block, spindle, point);

  if (result.mode === 'block') {
    // Full block — format as block name + structured content
    return `[${blockName}]\n${formatBlockContent(block)}`;
  }

  if (result.mode === 'spindle') {
    if (result.nodes.length === 0) return '';
    const lines = result.nodes.map(n => `  [${n.pscale}] ${n.text}`);
    return `[${blockName} ${spindle}]\n${lines.join('\n')}`;
  }

  if (result.mode === 'point') {
    return `[${blockName} ${spindle} ${point}] ${result.text}`;
  }

  return '';
}

// ============ INSTRUCTION EXTRACTION FROM WAKE BLOCK ============

// Get instruction list from wake 0.6.5.{sibling} (birth prompts)
function getBirthInstructions(sibling) {
  const wake = blocks['wake'];
  if (!wake) return [];
  const spread = xSpread(wake, '6.5.' + sibling);
  if (!spread) return [];
  return spread.children.filter(c => c.text).map(c => c.text);
}

// Get instruction list from wake 0.9.{packageId} (tier prompts)
function getPromptInstructions(packageId) {
  const wake = blocks['wake'];
  if (!wake) return [];
  const spread = xSpread(wake, '9.' + packageId);
  if (!spread) return [];
  return spread.children.filter(c => c.text).map(c => c.text);
}

// Build system prompt from instruction list
function buildSystemPrompt(instructions) {
  const sections = [];
  for (const instr of instructions) {
    const result = executeInstruction(instr);
    if (result) sections.push(result);
  }
  return sections.join('\n\n');
}

// ============ GENERATE ALL THREE CONTEXT WINDOWS ============

const scenarios = [
  {
    name: 'Shallow Birth',
    file: 'context-window-birth-shallow.txt',
    getInstructions: () => getBirthInstructions(1),
    source: 'wake 0.6.5.1'
  },
  {
    name: 'Deep Birth',
    file: 'context-window-birth-deep.txt',
    getInstructions: () => getBirthInstructions(2),
    source: 'wake 0.6.5.2'
  },
  {
    name: 'Present Tier',
    file: 'context-window-present.txt',
    getInstructions: () => getPromptInstructions(2),
    source: 'wake 0.9.2'
  }
];

console.log('');

for (const scenario of scenarios) {
  const instructions = scenario.getInstructions();
  console.log(`--- ${scenario.name} (${scenario.source}) ---`);
  console.log(`  Instructions: [${instructions.join(', ')}]`);

  if (instructions.length === 0) {
    console.log(`  WARNING: No instructions found!`);
    continue;
  }

  const prompt = buildSystemPrompt(instructions);
  const outPath = path.join(OUTPUT_DIR, scenario.file);
  
  // Write header comment + prompt
  const header = [
    `# Hermitcrab G1 — Compiled Context Window`,
    `# Scenario: ${scenario.name}`,
    `# Source: ${scenario.source}`,
    `# Instructions: ${instructions.join(' | ')}`,
    `# Generated: ${new Date().toISOString()}`,
    `#`,
    `# This is the actual system prompt text the LLM would receive.`,
    ``,
    ``
  ].join('\n');

  fs.writeFileSync(outPath, header + prompt + '\n');
  
  const lines = prompt.split('\n').length;
  const chars = prompt.length;
  const approxTokens = Math.round(chars / 4); // rough approximation
  console.log(`  Output: ${outPath}`);
  console.log(`  Size: ${lines} lines, ${chars} chars (~${approxTokens} tokens)`);
  console.log('');
}

// ============ GENERATE BIRTH MESSAGE VARIANTS ============

const messageVariants = [
  { name: 'Challenge',   digit: 1, spindle: 0.65311 },
  { name: 'Mirror',      digit: 2, spindle: 0.65321 },
  { name: 'Description', digit: 3, spindle: 0.65331 },
  { name: 'Rinzai',      digit: 4, spindle: 0.65341 },
];

const msgLines = [
  `# Hermitcrab G1 — Birth Message Variants`,
  `# Source: wake 0.6.5.3`,
  `# Generated: ${new Date().toISOString()}`,
  `#`,
  `# Each variant shown twice:`,
  `#   1. Full BSP spindle (the whole semantic chain the LLM would receive)`,
  `#   2. Final point only (just the message text with address)`,
  ``,
];

for (const v of messageVariants) {
  // Full spindle
  const result = bsp('wake', v.spindle);
  msgLines.push(`${'='.repeat(60)}`);
  msgLines.push(`VARIANT ${v.digit}: ${v.name} — wake ${v.spindle}`);
  msgLines.push(`${'='.repeat(60)}`);
  msgLines.push(``);

  // Spindle format (same as system prompt sections)
  msgLines.push(`--- Full spindle [wake ${v.spindle}] ---`);
  if (result.mode === 'spindle' && result.nodes.length > 0) {
    for (const n of result.nodes) {
      msgLines.push(`  [${n.pscale}] ${n.text}`);
    }
  }
  msgLines.push(``);

  // Point only — just the final node
  const last = result.nodes[result.nodes.length - 1];
  msgLines.push(`--- Point only [wake ${v.spindle}, ${last.pscale}] ---`);
  msgLines.push(last.text);
  msgLines.push(``);
  msgLines.push(``);
}

const msgPath = path.join(OUTPUT_DIR, 'context-window-birth-messages.txt');
fs.writeFileSync(msgPath, msgLines.join('\n'));
console.log(`--- Birth Message Variants ---`);
console.log(`  Output: ${msgPath}`);
console.log(`  Variants: ${messageVariants.map(v => v.name).join(', ')}`);
console.log('');

console.log('Done. All context windows generated.');
