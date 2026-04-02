#!/usr/bin/env node
// BSP CLI — Block · Spindle · Point
// Thin CLI wrapper around the canonical bsp.js implementation.
// Seven modes, same keywords as bsp.py. No legacy * or ~ syntax.
//
// Usage:
//   bsp <block> [spindle] [point] [fn] [--full]
//
// Modes:
//   bsp wake                         → dir: full block tree
//   bsp wake ref                     → ref: block named, zero tokens
//   bsp wake 0.1211111               → spindle: wide-to-specific chain
//   bsp wake 0.1211111 -3            → point: single pscale level
//   bsp wake 0.12 ring               → ring: siblings at terminal point
//   bsp wake 0.12 dir                → dir: subtree from endpoint down
//   bsp concerns _ 5 disc            → disc: all nodes at pscale 5, block-wide
//
// Block can be a file path or a name (searches blocks/ directory).
// Use _ for null spindle (required for disc without a spindle).

import { bsp, bspRegister } from './bsp.js';
import fs from 'fs';
import path from 'path';

// ── Block loading ──

function loadBlock(nameOrPath) {
  if (fs.existsSync(nameOrPath)) {
    return JSON.parse(fs.readFileSync(nameOrPath, 'utf8'));
  }
  const candidates = [
    path.join('blocks', nameOrPath + '.json'),
    path.join('blocks', nameOrPath),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  return null;
}

// Register block loader so bsp() can resolve names
bspRegister(loadBlock);

// ── View selector ──

function blockView(block, view) {
  if (view === 'skeleton' && block.skeleton) return { ...block, tree: block.skeleton };
  if (view === 'mask' && block.mask) return { ...block, tree: block.mask };
  return block;
}

// ── Arg parsing ──

function parseArgs(argv) {
  const opts = { full: false, view: null };
  const positional = [];
  let i = 0;
  while (i < argv.length) {
    if (argv[i] === '--full') { opts.full = true; i++; }
    else if (argv[i] === '-h' || argv[i] === '--help') { opts.help = true; i++; }
    else { positional.push(argv[i]); i++; }
  }
  opts.blockName = positional[0];
  // Detect view selector (skeleton/mask) as second positional, shift remaining
  let argOffset = 1;
  if (positional[1] === 'skeleton' || positional[1] === 'mask') {
    opts.view = positional[1];
    argOffset = 2;
  }
  opts.arg2 = positional[argOffset];
  opts.arg3 = positional[argOffset + 1];
  opts.arg4 = positional[argOffset + 2];
  return opts;
}

function resolveArgs(opts) {
  // Parse the positional args into bsp(block, spindle, point, fn)
  let spindle, point, fn;

  if (opts.arg2 !== undefined) {
    if (opts.arg2 === 'ref') {
      spindle = 'ref';
    } else if (opts.arg2 === '_') {
      spindle = null; // explicit null spindle (for disc mode)
    } else if (opts.arg2 === 'ring' || opts.arg2 === 'dir') {
      console.error(`ERROR: '${opts.arg2}' requires a spindle. Usage: bsp ${opts.blockName} <spindle> ${opts.arg2}`);
      process.exit(1);
    } else {
      spindle = parseFloat(opts.arg2);
      if (isNaN(spindle)) {
        console.error(`ERROR: Invalid spindle '${opts.arg2}'. Must be a semantic number, 'ref', or '_' for null.`);
        process.exit(1);
      }
    }
  }

  if (opts.arg3 !== undefined) {
    if (opts.arg3 === 'ring' || opts.arg3 === 'dir') {
      point = opts.arg3;
    } else if (opts.arg3 === 'disc') {
      console.error("ERROR: disc requires a pscale level. Usage: bsp <block> <spindle> <pscale> disc");
      process.exit(1);
    } else {
      point = parseFloat(opts.arg3);
      if (isNaN(point)) {
        console.error(`ERROR: Invalid point '${opts.arg3}'. Must be a pscale number, 'ring', or 'dir'.`);
        process.exit(1);
      }
    }
  }

  if (opts.arg4 !== undefined) {
    if (opts.arg4 === 'disc') {
      fn = 'disc';
    } else {
      console.error(`ERROR: Unknown 4th argument '${opts.arg4}'. Only 'disc' is valid.`);
      process.exit(1);
    }
  }

  return { spindle, point, fn };
}

// ── Output formatting ──

function trunc(text, max) {
  if (!max || !text || text.length <= max) return text;
  return text.slice(0, max - 1) + '\u2026';
}

function formatDir(tree, indent, maxDepth) {
  indent = indent || 0;
  maxDepth = maxDepth || 3;
  const lines = [];
  if (typeof tree === 'string') {
    lines.push('  '.repeat(indent) + trunc(tree, 120));
    return lines;
  }
  if (!tree || typeof tree !== 'object') return lines;
  const digits = Object.keys(tree).filter(k => k !== '_').sort();
  for (const k of digits) {
    const child = tree[k];
    const text = typeof child === 'string' ? child : (child && child._) ? child._ : null;
    const marker = (typeof child === 'object' && child !== null) ? '\u25ba' : '\u2022';
    lines.push(`${'  '.repeat(indent)}${k}: ${marker} ${trunc(text || '(empty)', 100)}`);
    if (indent < maxDepth && typeof child === 'object' && child !== null) {
      lines.push(...formatDir(child, indent + 1, maxDepth));
    }
  }
  return lines;
}

function formatResult(result, opts) {
  const tw = opts.full ? 0 : 200;

  switch (result.mode) {
    case 'ref':
      return `[${opts.blockName}] ref (zero tokens)`;

    case 'dir': {
      if (result.subtree !== undefined) {
        // Dir-subtree mode
        return `[${opts.blockName} dir-subtree]\n${JSON.stringify(result.subtree, null, 2)}`;
      }
      // Full dir mode
      const tree = result.tree;
      const lines = [];
      if (tree._) lines.push(trunc(tree._, 120));
      lines.push(...formatDir(tree));
      return lines.join('\n');
    }

    case 'spindle': {
      const lines = [];
      for (const n of result.nodes) {
        const ps = n.pscale !== null ? (n.pscale >= 0 ? `+${n.pscale}` : `${n.pscale}`) : '?';
        const digit = n.digit ? `[${n.digit}]` : '   ';
        lines.push(`  ps:${ps.padStart(3)}  ${digit.padEnd(4)} ${trunc(n.text, tw)}`);
      }
      return lines.join('\n');
    }

    case 'point': {
      const ps = result.pscale !== null ? (result.pscale >= 0 ? `+${result.pscale}` : `${result.pscale}`) : '?';
      return `  ps:${ps}  ${result.text}`;
    }

    case 'ring': {
      const lines = [];
      for (const s of (result.siblings || [])) {
        const marker = s.branch ? '\u25ba +' : '\u2022';
        lines.push(`  ${s.digit}: ${trunc(s.text || '(empty)', tw)} ${marker}`);
      }
      return lines.join('\n');
    }

    case 'disc': {
      const ps = result.pscale;
      const lines = [`pscale ${ps}:`];
      for (const n of (result.nodes || [])) {
        lines.push(`  [${n.path}] ${trunc(n.text || '(no text)', tw)}`);
      }
      return lines.join('\n');
    }

    case 'error':
      return `ERROR: ${result.error}`;

    default:
      return JSON.stringify(result, null, 2);
  }
}

// ── CLI ──

const opts = parseArgs(process.argv.slice(2));

if (!opts.blockName || opts.help) {
  console.log(`BSP \u2014 Block \u00b7 Spindle \u00b7 Point

Usage: bsp <block> [skeleton|mask] [spindle] [point] [fn] [--full]

Seven modes:
  bsp wake                     dir       \u2014 full block tree
  bsp wake ref                 ref       \u2014 block named, zero tokens
  bsp wake 0.1211111           spindle   \u2014 wide-to-specific chain
  bsp wake 0.1211111 -3        point     \u2014 single pscale level
  bsp wake 0.12 ring           ring      \u2014 siblings at terminal point
  bsp wake 0.12 dir            dir       \u2014 subtree from endpoint down
  bsp concerns _ 5 disc        disc      \u2014 all nodes at pscale 5

Views (swap tree before BSP navigates):
  bsp horizon skeleton         dir       \u2014 skeleton labels
  bsp horizon mask 0.11        spindle   \u2014 mask values along path

Use _ for null spindle (disc with no walk).
Use --full to disable text truncation.`);
  process.exit(0);
}

let blk = loadBlock(opts.blockName);
if (!blk) { console.error(`Block not found: ${opts.blockName}`); process.exit(1); }

// Apply view selector — swap tree before BSP sees it
if (opts.view) {
  const viewed = blockView(blk, opts.view);
  if (viewed === blk) { console.error(`No ${opts.view} on block '${opts.blockName}'`); process.exit(1); }
  blk = viewed;
}

const { spindle, point, fn } = resolveArgs(opts);
const result = bsp(blk, spindle, point, fn);
console.log(formatResult(result, opts));
