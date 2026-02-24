#!/usr/bin/env node
/**
 * Test: pure block migration verification
 * Verifies that bsp() works correctly with migrated pure blocks
 * (no place field, no tree["0"] wrapper, zero-stripping, pscale from decimal)
 */

const fs = require('fs');
const path = require('path');

const BLOCKS_DIR = path.join(__dirname, '..', 'blocks');
const DOCS_DIR = path.join(__dirname, '..', 'docs', 'living');

// --- Inline the bsp function from kernel.js ---

function bsp(block, spindle, point) {
  const blk = typeof block === 'string' ? loadBlock(block) : block;
  if (!blk || !blk.tree) return { mode: 'block', tree: {} };

  if (spindle === undefined || spindle === null) {
    return { mode: 'block', tree: blk.tree };
  }

  const str = typeof spindle === 'number' ? spindle.toFixed(10) : String(spindle);
  const parts = str.split('.');
  const intStr = parts[0] || '0';
  const fracStr = (parts[1] || '').replace(/0+$/, '');

  const isDelineation = intStr === '0';
  const walkDigits = isDelineation
    ? fracStr.split('').filter(c => c.length > 0)
    : (intStr + fracStr).split('');

  const hasPscale = isDelineation || fracStr.length > 0;
  const digitsBefore = isDelineation ? 0 : (hasPscale ? intStr.length : -1);

  const nodes = [];
  let node = blk.tree;

  const rootText = (typeof node === 'object' && node !== null && typeof node['_'] === 'string')
    ? node['_'] : null;
  if (rootText !== null) {
    nodes.push({ pscale: hasPscale ? digitsBefore : null, text: rootText });
  }

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

  if (point !== undefined && point !== null) {
    const target = nodes.find(n => n.pscale === point);
    if (target) return { mode: 'point', text: target.text, pscale: target.pscale };
    const last = nodes[nodes.length - 1];
    return { mode: 'point', text: last.text, pscale: last.pscale };
  }

  return { mode: 'spindle', nodes };
}

// --- Block loader ---

function loadBlock(name) {
  // Try blocks/ first, then docs/living/
  const paths = [
    path.join(BLOCKS_DIR, name + '.json'),
    path.join(DOCS_DIR, name + '.json'),
    path.join(__dirname, '..', 'lib', name + '.json')
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  }
  return null;
}

// --- Test infrastructure ---

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.log(`  ❌ ${message}`);
  }
}

function assertEq(actual, expected, message) {
  if (actual === expected) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.log(`  ❌ ${message}`);
    console.log(`     Expected: ${JSON.stringify(expected)}`);
    console.log(`     Actual:   ${JSON.stringify(actual)}`);
  }
}

// ============================================================
// TEST 1: All blocks are pure (no place, no tree["0"] wrapper)
// ============================================================

console.log('\n=== TEST 1: All blocks are pure format ===');

const allBlockPaths = [];
for (const dir of [BLOCKS_DIR, DOCS_DIR]) {
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.json')) allBlockPaths.push(path.join(dir, f));
    }
  }
}
// Also check lib/bsp-spec.json
const bspSpecPath = path.join(__dirname, '..', 'lib', 'bsp-spec.json');
if (fs.existsSync(bspSpecPath)) allBlockPaths.push(bspSpecPath);

for (const p of allBlockPaths) {
  const name = path.basename(p, '.json');
  const block = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert(!block.hasOwnProperty('place'), `${name}: no place field`);
  assert(block.hasOwnProperty('tree'), `${name}: has tree field`);
  assert(!block.tree.hasOwnProperty('0'), `${name}: tree has no "0" wrapper`);
  assert(typeof block.tree._ === 'string' || typeof block.tree === 'object', `${name}: tree._ exists or tree is object`);
}

// ============================================================
// TEST 2: Block mode — returns full tree
// ============================================================

console.log('\n=== TEST 2: Block mode ===');

const touchstone = loadBlock('touchstone');
const result1 = bsp(touchstone);
assertEq(result1.mode, 'block', 'touchstone block mode');
assert(result1.tree._ !== undefined, 'touchstone tree has root summary');
assert(result1.tree['1'] !== undefined, 'touchstone tree has section 1');
assert(result1.tree['7'] !== undefined, 'touchstone tree has section 7');

const constitution = loadBlock('constitution');
const result2 = bsp(constitution);
assertEq(result2.mode, 'block', 'constitution block mode');
assert(result2.tree._ !== undefined, 'constitution tree has root summary');

// ============================================================
// TEST 3: Delineation spindle — 0.21
// ============================================================

console.log('\n=== TEST 3: Delineation spindle (0.21) ===');

const s1 = bsp(touchstone, 0.21);
assertEq(s1.mode, 'spindle', 'touchstone 0.21 is spindle mode');
assertEq(s1.nodes.length, 3, 'touchstone 0.21 has 3 nodes (root + 2 walked)');
assertEq(s1.nodes[0].pscale, 0, 'root is pscale 0');
assertEq(s1.nodes[1].pscale, -1, 'section 2 is pscale -1');
assertEq(s1.nodes[1].digit, '2', 'walked digit 2');
assertEq(s1.nodes[2].pscale, -2, 'subsection 1 is pscale -2');
assertEq(s1.nodes[2].digit, '1', 'walked digit 1');
assert(s1.nodes[0].text.includes('Pscale blocks'), 'root mentions Pscale blocks');
assert(s1.nodes[1].text.includes('bsp'), 'section 2 is about bsp/reading');

// ============================================================
// TEST 4: Bare 0 — delineation, root only
// ============================================================

console.log('\n=== TEST 4: Bare 0 (root only) ===');

const s2 = bsp(constitution, 0);
assertEq(s2.mode, 'spindle', 'constitution 0 is spindle mode');
assertEq(s2.nodes.length, 1, 'bare 0 returns only root');
assertEq(s2.nodes[0].pscale, 0, 'root is pscale 0');
assert(s2.nodes[0].text.includes('constitution'), 'root text mentions constitution');

// ============================================================
// TEST 5: Deeper delineation — 0.642 (connection → combination → multiplicative)
// ============================================================

console.log('\n=== TEST 5: Deep delineation (0.642) ===');

const s3 = bsp(touchstone, 0.642);
assertEq(s3.mode, 'spindle', 'touchstone 0.642 is spindle');
assertEq(s3.nodes.length, 4, '0.642 has 4 nodes (root + 3 walked)');
assertEq(s3.nodes[0].pscale, 0, 'root is pscale 0');
assertEq(s3.nodes[1].pscale, -1, 'section 6 is pscale -1');
assertEq(s3.nodes[1].digit, '6', 'walked digit 6');
assert(s3.nodes[1].text.includes('coupling') || s3.nodes[1].text.includes('relate'), 'section 6 is about connection');
assertEq(s3.nodes[2].pscale, -2, 'subsection 4 is pscale -2');
assertEq(s3.nodes[2].digit, '4', 'walked digit 4');
assertEq(s3.nodes[3].pscale, -3, 'sub-subsection 2 is pscale -3');
assertEq(s3.nodes[3].digit, '2', 'walked digit 2');

// Also test 0.842 — stops at 2 walked (8.4 is a leaf, so "2" doesn't exist)
const s3b = bsp(touchstone, 0.842);
assertEq(s3b.nodes.length, 3, '0.842 stops at 3 nodes (8.4 is a leaf, no child 2)');

// ============================================================
// TEST 6: Point mode — extract single node
// ============================================================

console.log('\n=== TEST 6: Point mode ===');

const p1 = bsp(touchstone, 0.21, -2);
assertEq(p1.mode, 'point', 'touchstone 0.21 -2 is point mode');
assertEq(p1.pscale, -2, 'point pscale is -2');
assert(typeof p1.text === 'string', 'point text is a string');

const p2 = bsp(touchstone, 0.21, 0);
assertEq(p2.mode, 'point', 'touchstone 0.21 pscale 0 is point mode');
assertEq(p2.pscale, 0, 'returns root at pscale 0');
assert(p2.text.includes('Pscale blocks'), 'pscale 0 returns root text');

// ============================================================
// TEST 7: Tuning fork spindle — 0.74
// ============================================================

console.log('\n=== TEST 7: Tuning fork spindle (0.74) ===');

const s4 = bsp(touchstone, 0.74);
assertEq(s4.mode, 'spindle', 'touchstone 0.74 is spindle');
assertEq(s4.nodes.length, 3, '0.74 has 3 nodes');
assertEq(s4.nodes[1].digit, '7', 'walked section 7 (tuning fork)');
assert(s4.nodes[1].text.includes('tuning'), 'section 7 is about tuning');
assertEq(s4.nodes[2].digit, '4', 'walked subsection 4');

// ============================================================
// TEST 8: Wake block — 0.1 (light state)
// ============================================================

console.log('\n=== TEST 8: Wake spindle (0.1) ===');

const wake = loadBlock('wake');
const s5 = bsp(wake, 0.1);
assertEq(s5.mode, 'spindle', 'wake 0.1 is spindle');
assertEq(s5.nodes.length, 2, 'wake 0.1 has 2 nodes (root + light)');
assertEq(s5.nodes[0].pscale, 0, 'root is pscale 0');
assertEq(s5.nodes[1].pscale, -1, 'section 1 is pscale -1');
assert(s5.nodes[1].text.toLowerCase().includes('light') || s5.nodes[1].text.toLowerCase().includes('haiku'), 'section 1 is about light state');

// ============================================================
// TEST 9: bsp-spec works as a pure block
// ============================================================

console.log('\n=== TEST 9: bsp-spec pure block ===');

const bspSpec = loadBlock('bsp-spec');
assert(bspSpec !== null, 'bsp-spec loaded');
const s6 = bsp(bspSpec, 0.1);
assertEq(s6.mode, 'spindle', 'bsp-spec 0.1 is spindle');
assertEq(s6.nodes.length, 2, 'bsp-spec 0.1 has root + section 1');
assert(s6.nodes[0].text.includes('BSP'), 'bsp-spec root mentions BSP');
assert(s6.nodes[1].text.includes('block') || s6.nodes[1].text.includes('Nested'), 'section 1 is about the format');

// ============================================================
// TEST 10: Edge cases
// ============================================================

console.log('\n=== TEST 10: Edge cases ===');

// Non-existent path
const s7 = bsp(touchstone, 0.99);
assert(s7.nodes.length >= 1, 'non-existent deep path still has root');
assert(s7.nodes[s7.nodes.length - 1].digit === '9' || s7.nodes.length === 1, 'stops at last found node');

// Single digit
const s8 = bsp(touchstone, 0.3);
assertEq(s8.nodes.length, 2, '0.3 has root + section 3');
assertEq(s8.nodes[1].digit, '3', 'walked digit 3');

// Verify 0.1 from number doesn't have floating point issues
const s9 = bsp(touchstone, 0.1);
assertEq(s9.nodes.length, 2, '0.1 has root + section 1');
assertEq(s9.nodes[1].digit, '1', '0.1 correctly walks digit 1');

// Verify 0.10 same as 0.1 (trailing zero stripped)
const s10 = bsp(touchstone, 0.10);
assertEq(s10.nodes.length, 2, '0.10 same as 0.1 (trailing zero stripped)');

// ============================================================
// TEST 11: shell.json embedded blocks are pure
// ============================================================

console.log('\n=== TEST 11: shell.json embedded blocks ===');

const shellPath = path.join(__dirname, '..', 'g1', 'shell.json');
if (fs.existsSync(shellPath)) {
  const shell = JSON.parse(fs.readFileSync(shellPath, 'utf8'));
  const blocks = shell.blocks || {};
  for (const [name, block] of Object.entries(blocks)) {
    assert(!block.hasOwnProperty('place'), `shell ${name}: no place field`);
    assert(block.hasOwnProperty('tree'), `shell ${name}: has tree`);
    assert(!block.tree.hasOwnProperty('0'), `shell ${name}: no tree["0"] wrapper`);
  }
} else {
  console.log('  ⚠️ shell.json not found, skipping');
}

// ============================================================
// TEST 12: Wake prompt instruction path (simulates getPromptInstructions)
// ============================================================

console.log('\n=== TEST 12: Wake prompt instruction path ===');

{
  const wake = loadBlock('wake');
  // getPromptInstructions reads wake.tree['9'][tier] for instructions
  const node9 = wake.tree?.['9'];
  assert(node9 !== undefined, 'wake.tree["9"] exists');
  assert(typeof node9._ === 'string', 'wake.tree["9"]._ is a string summary');

  // Light tier (1)
  const light = node9?.['1'];
  assert(light !== undefined, 'light tier instructions node exists');
  assert(typeof light['1'] === 'string', 'light tier has instruction 1');
  assertEq(light['1'], 'constitution 0', 'light tier instruction 1 is "constitution 0"');

  // Present tier (2)
  const present = node9?.['2'];
  assert(present !== undefined, 'present tier instructions node exists');
  assert(typeof present['1'] === 'string', 'present tier has instruction 1');

  // Deep tier (3)
  const deep = node9?.['3'];
  assert(deep !== undefined, 'deep tier instructions node exists');
  assertEq(deep['1'], 'touchstone', 'deep tier instruction 1 is "touchstone" (block mode)');

  // getTierParams reads wake.tree['9'][tier + 3] for params
  const lightParams = node9?.['4'];
  assert(lightParams !== undefined, 'light tier params node exists');
  assert(typeof lightParams['1'] === 'string', 'light tier has model param');
  assert(lightParams['1'].startsWith('model'), 'light tier param 1 is model');

  const presentParams = node9?.['5'];
  assert(presentParams !== undefined, 'present tier params node exists');
}

// ============================================================
// SUMMARY
// ============================================================

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('⚠️  SOME TESTS FAILED');
  process.exit(1);
} else {
  console.log('✅ ALL TESTS PASSED');
}
