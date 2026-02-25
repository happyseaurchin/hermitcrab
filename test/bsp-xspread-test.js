// BSP xSpread & X-vocabulary Tests
// Tests spread ('~'), tree ('*') modes, and all three spindle formats: 234, 0.234, 23.45
// Run: node test/bsp-xspread-test.js

const fs = require('fs');
const path = require('path');

// ============ Load wake.json ============
const wakePath = path.join(__dirname, '..', 'blocks', 'wake.json');
const wake = JSON.parse(fs.readFileSync(wakePath, 'utf8'));

// ============ Pure functions extracted from g1/kernel.js ============

function blockNavigate(block, navPath) {
  if (!navPath) return block.tree;
  const keys = navPath.split('.');
  let node = block.tree;
  for (const k of keys) {
    if (node === null || node === undefined) return null;
    if (typeof node === 'string') return null;
    node = node[k];
  }
  return node;
}

function xSpread(block, spreadPath) {
  const node = spreadPath ? blockNavigate(block, spreadPath) : block.tree;
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

function resolveBlock(block, maxDepth) {
  maxDepth = maxDepth || 3;
  function walk(node, depth, walkPath) {
    if (depth > maxDepth) return null;
    if (typeof node === 'string') return { path: walkPath, text: node };
    if (!node) return null;
    const result = { path: walkPath, text: node._ || null, children: [] };
    for (const [k, v] of Object.entries(node)) {
      if (k === '_') continue;
      const childPath = walkPath ? `${walkPath}.${k}` : k;
      const child = walk(v, depth + 1, childPath);
      if (child) result.children.push(child);
    }
    return result;
  }
  return walk(block.tree, 0, '');
}

function bsp(block, spindle, point) {
  const blk = block;
  if (!blk || !blk.tree) return { mode: 'block', tree: {} };

  // Block mode — no spindle, return full tree (unless point is a nav mode)
  if ((spindle === undefined || spindle === null) && typeof point !== 'string') {
    return { mode: 'block', tree: blk.tree };
  }

  // Parse the semantic number (or default to root for no-spindle nav modes)
  let walkDigits, hasPscale, digitsBefore;
  if (spindle === undefined || spindle === null) {
    walkDigits = [];
    hasPscale = true;
    digitsBefore = 0;
  } else {
    const str = typeof spindle === 'number' ? spindle.toFixed(10) : String(spindle);
    const parts = str.split('.');
    const intStr = parts[0] || '0';
    const fracStr = (parts[1] || '').replace(/0+$/, '');
    const isDelineation = intStr === '0';
    walkDigits = isDelineation
      ? fracStr.split('').filter(c => c.length > 0)
      : (intStr + fracStr).split('');
    hasPscale = isDelineation || fracStr.length > 0;
    digitsBefore = isDelineation ? 0 : (hasPscale ? intStr.length : -1);
  }

  // Build spindle — root always included
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

  // Point mode
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
    const target = nodes.find(n => n.pscale === point);
    if (target) return { mode: 'point', text: target.text, pscale: target.pscale };
    const last = nodes[nodes.length - 1];
    return { mode: 'point', text: last.text, pscale: last.pscale };
  }

  return { mode: 'spindle', nodes };
}

// ============ Test Harness ============

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push({ name, status: 'PASS' });
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    results.push({ name, status: 'FAIL', error: e.message });
    console.log(`  FAIL  ${name}`);
    console.log(`        ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'Mismatch'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ============ SECTION 1: Spread & Tree Mode Basics ============

console.log('\n=== Section 1: Spread & Tree Mode Basics ===\n');

test('spread: bsp(wake, 0.2, "~") — Present tier', () => {
  const result = bsp(wake, 0.2, '~');
  assertEqual(result.mode, 'spread', 'mode');
  assert(result.text.startsWith('Present'), `text starts with "Present": "${result.text.substring(0, 20)}"`);
  assertEqual(result.children.length, 5, 'children count (sections 2.1-2.5)');
  assertEqual(result.path, '2', 'path');
});

test('spread: bsp(wake, 0.9, "~") — prompt section, 9 packages', () => {
  const result = bsp(wake, 0.9, '~');
  assertEqual(result.mode, 'spread', 'mode');
  assertEqual(result.children.length, 9, 'children count (all 9 BSP packages)');
  const digits = result.children.map(c => c.digit);
  for (let i = 1; i <= 9; i++) assert(digits.includes(String(i)), `digit ${i} present`);
});

test('spread: bsp(wake, 0.451, "~") — heartbeat concern, 4 fields', () => {
  const result = bsp(wake, 0.451, '~');
  assertEqual(result.mode, 'spread', 'mode');
  assert(result.text.includes('Heartbeat'), `text includes "Heartbeat": "${result.text.substring(0, 30)}"`);
  assertEqual(result.children.length, 4, 'children count (package, tier, trigger, checks)');
  // Verify branch indicators: all leaves
  assert(result.children.every(c => !c.branch), 'all children are leaves');
});

test('spread: bsp(wake, undefined, "~") — root spread, no spindle', () => {
  const result = bsp(wake, undefined, '~');
  assertEqual(result.mode, 'spread', 'mode');
  assertEqual(result.path, null, 'path is null (root)');
  assertEqual(result.children.length, 9, 'children count (top-level sections 1-9)');
  assert(result.text.includes('How you come into being'), 'text is wake root');
});

test('tree: bsp(wake, 0.1, "*") — Light tier subtree', () => {
  const result = bsp(wake, 0.1, '*');
  assertEqual(result.mode, 'tree', 'mode');
  assertEqual(result.path, '1', 'path preserved');
  assert(result.text.startsWith('Light'), `text is Light tier: "${result.text.substring(0, 20)}"`);
  const hasGrandchildren = result.children.some(c => c.children && c.children.length > 0);
  assert(hasGrandchildren, 'recursive children present');
});

test('tree: bsp(wake, undefined, "*") — full block tree', () => {
  const result = bsp(wake, undefined, '*');
  assertEqual(result.mode, 'tree', 'mode');
  assertEqual(result.path, null, 'path is null (root)');
  assert(result.children.length === 9, 'all 9 top-level sections');
  // Deep recursion: section 9 should have children with children
  const section9 = result.children.find(c => c.path === '9');
  assert(section9, 'section 9 exists');
  assert(section9.children.length > 0, 'section 9 has children');
});

test('spread on leaf: bsp(wake, 0.11, "~") — string node', () => {
  const result = bsp(wake, 0.11, '~');
  assertEqual(result.mode, 'spread', 'mode');
  assert(typeof result.text === 'string' && result.text.length > 0, 'has text');
  assertEqual(result.children.length, 0, 'leaf has no children');
});

test('backward compat: bsp(wake, 0.2) — spindle mode unchanged', () => {
  const result = bsp(wake, 0.2);
  assertEqual(result.mode, 'spindle', 'mode');
  assert(result.nodes.length >= 2, 'has root + walked node');
  assertEqual(result.nodes[0].pscale, 0, 'root pscale is 0');
  assertEqual(result.nodes[1].digit, '2', 'walked digit is 2');
});

test('backward compat: bsp(wake, 0.2, -1) — point mode unchanged', () => {
  const result = bsp(wake, 0.2, -1);
  assertEqual(result.mode, 'point', 'mode');
  assertEqual(result.pscale, -1, 'pscale is -1');
});

// ============ SECTION 2: Three Spindle Formats ============
// All three formats walk the SAME path through the tree.
// They differ ONLY in pscale labeling.
//   92   → walk [9,2], no pscale (no decimal)
//   0.92 → walk [9,2], root pscale 0 (delineation)
//   9.2  → walk [9,2], root pscale 1

console.log('\n=== Section 2: Three Spindle Formats (92, 0.92, 9.2) ===\n');

test('spindle format 92 (no decimal): walks [9,2], no pscale', () => {
  const result = bsp(wake, 92);
  assertEqual(result.mode, 'spindle', 'mode');
  // No decimal → no pscale
  assertEqual(result.nodes[0].pscale, null, 'root pscale is null (no decimal)');
  assertEqual(result.nodes[1].digit, '9', 'first digit is 9');
  assertEqual(result.nodes[2].digit, '2', 'second digit is 2');
  assert(result.nodes[2].text.includes('Present tier prompt'), `endpoint text: "${result.nodes[2].text.substring(0, 30)}"`);
});

test('spindle format 0.92 (delineation): walks [9,2], root pscale 0', () => {
  const result = bsp(wake, 0.92);
  assertEqual(result.mode, 'spindle', 'mode');
  assertEqual(result.nodes[0].pscale, 0, 'root pscale is 0');
  assertEqual(result.nodes[1].pscale, -1, 'digit 9 pscale is -1');
  assertEqual(result.nodes[2].pscale, -2, 'digit 2 pscale is -2');
  assertEqual(result.nodes[1].digit, '9', 'first digit is 9');
  assertEqual(result.nodes[2].digit, '2', 'second digit is 2');
});

test('spindle format 9.2 (split decimal): walks [9,2], root pscale 1', () => {
  const result = bsp(wake, 9.2);
  assertEqual(result.mode, 'spindle', 'mode');
  assertEqual(result.nodes[0].pscale, 1, 'root pscale is 1');
  assertEqual(result.nodes[1].pscale, 0, 'digit 9 pscale is 0');
  assertEqual(result.nodes[2].pscale, -1, 'digit 2 pscale is -1');
  assertEqual(result.nodes[1].digit, '9', 'first digit is 9');
  assertEqual(result.nodes[2].digit, '2', 'second digit is 2');
});

test('all three formats reach SAME endpoint text', () => {
  const r1 = bsp(wake, 92);
  const r2 = bsp(wake, 0.92);
  const r3 = bsp(wake, 9.2);
  // All walk [9,2] → same node in tree
  assertEqual(r1.nodes[2].text, r2.nodes[2].text, 'format 92 vs 0.92');
  assertEqual(r2.nodes[2].text, r3.nodes[2].text, 'format 0.92 vs 9.2');
});

// ============ SECTION 3: Three Formats with Spread ============
// Spread at the same endpoint regardless of spindle format.

console.log('\n=== Section 3: Three Formats with Spread ===\n');

test('spread: format 92 — bsp(wake, 92, "~")', () => {
  const result = bsp(wake, 92, '~');
  assertEqual(result.mode, 'spread', 'mode');
  assertEqual(result.path, '9.2', 'path');
  assert(result.children.length > 0, 'has children');
});

test('spread: format 0.92 — bsp(wake, 0.92, "~")', () => {
  const result = bsp(wake, 0.92, '~');
  assertEqual(result.mode, 'spread', 'mode');
  assertEqual(result.path, '9.2', 'path');
  assert(result.children.length > 0, 'has children');
});

test('spread: format 9.2 — bsp(wake, 9.2, "~")', () => {
  const result = bsp(wake, 9.2, '~');
  assertEqual(result.mode, 'spread', 'mode');
  assertEqual(result.path, '9.2', 'path');
  assert(result.children.length > 0, 'has children');
});

test('all three spread formats return SAME children', () => {
  const r1 = bsp(wake, 92, '~');
  const r2 = bsp(wake, 0.92, '~');
  const r3 = bsp(wake, 9.2, '~');
  assertEqual(r1.text, r2.text, 'text: 92 vs 0.92');
  assertEqual(r2.text, r3.text, 'text: 0.92 vs 9.2');
  assertEqual(r1.children.length, r2.children.length, 'children count: 92 vs 0.92');
  assertEqual(r2.children.length, r3.children.length, 'children count: 0.92 vs 9.2');
});

// ============ SECTION 4: Three Formats with Point ============

console.log('\n=== Section 4: Three Formats with Point ===\n');

test('point: format 0.92 pscale 0 — root text', () => {
  const result = bsp(wake, 0.92, 0);
  assertEqual(result.mode, 'point', 'mode');
  assertEqual(result.pscale, 0, 'pscale is 0');
  assert(result.text.includes('How you come into being'), 'pscale 0 is root');
});

test('point: format 0.92 pscale -1 — digit 9 text', () => {
  const result = bsp(wake, 0.92, -1);
  assertEqual(result.mode, 'point', 'mode');
  assertEqual(result.pscale, -1, 'pscale is -1');
  assert(result.text.includes('Prompt and invocation'), `digit 9 text: "${result.text.substring(0, 30)}"`);
});

test('point: format 9.2 pscale 1 — root text (shifted)', () => {
  const result = bsp(wake, 9.2, 1);
  assertEqual(result.mode, 'point', 'mode');
  assertEqual(result.pscale, 1, 'pscale is 1');
  assert(result.text.includes('How you come into being'), 'pscale 1 (root for 9.2 format)');
});

test('point: format 9.2 pscale 0 — digit 9 text (shifted)', () => {
  const result = bsp(wake, 9.2, 0);
  assertEqual(result.mode, 'point', 'mode');
  assertEqual(result.pscale, 0, 'pscale is 0');
  assert(result.text.includes('Prompt and invocation'), `shifted: digit 9 at pscale 0`);
});

// ============ SECTION 5: Three Formats with Tree ============

console.log('\n=== Section 5: Three Formats with Tree ===\n');

test('tree: format 92 — bsp(wake, 92, "*")', () => {
  const result = bsp(wake, 92, '*');
  assertEqual(result.mode, 'tree', 'mode');
  assertEqual(result.path, '9.2', 'path');
  assert(result.children.length > 0, 'has recursive children');
});

test('tree: format 0.92 — bsp(wake, 0.92, "*")', () => {
  const result = bsp(wake, 0.92, '*');
  assertEqual(result.mode, 'tree', 'mode');
  assertEqual(result.path, '9.2', 'path');
});

test('tree: format 9.2 — bsp(wake, 9.2, "*")', () => {
  const result = bsp(wake, 9.2, '*');
  assertEqual(result.mode, 'tree', 'mode');
  assertEqual(result.path, '9.2', 'path');
});

test('all three tree formats return SAME subtree', () => {
  const r1 = bsp(wake, 92, '*');
  const r2 = bsp(wake, 0.92, '*');
  const r3 = bsp(wake, 9.2, '*');
  assertEqual(r1.text, r2.text, 'text: 92 vs 0.92');
  assertEqual(r2.text, r3.text, 'text: 0.92 vs 9.2');
  assertEqual(r1.children.length, r2.children.length, 'children count: 92 vs 0.92');
  assertEqual(r2.children.length, r3.children.length, 'children count: 0.92 vs 9.2');
});

// ============ SECTION 6: Deeper walk — 3+ digits ============

console.log('\n=== Section 6: Deeper Walks (451, 0.451, 45.1) ===\n');

test('spindle 451: walks [4,5,1], no pscale', () => {
  const result = bsp(wake, 451);
  assertEqual(result.mode, 'spindle', 'mode');
  assertEqual(result.nodes[1].digit, '4', 'first digit');
  assertEqual(result.nodes[2].digit, '5', 'second digit');
  assertEqual(result.nodes[3].digit, '1', 'third digit');
  assertEqual(result.nodes[1].pscale, null, 'no pscale');
  assert(result.nodes[3].text.includes('Heartbeat'), 'endpoint is heartbeat');
});

test('spindle 0.451: walks [4,5,1], root pscale 0', () => {
  const result = bsp(wake, 0.451);
  assertEqual(result.mode, 'spindle', 'mode');
  assertEqual(result.nodes[0].pscale, 0, 'root pscale 0');
  assertEqual(result.nodes[1].pscale, -1, 'digit 4 pscale -1');
  assertEqual(result.nodes[2].pscale, -2, 'digit 5 pscale -2');
  assertEqual(result.nodes[3].pscale, -3, 'digit 1 pscale -3');
  assert(result.nodes[3].text.includes('Heartbeat'), 'endpoint is heartbeat');
});

test('spindle 45.1: walks [4,5,1], root pscale 2', () => {
  const result = bsp(wake, 45.1);
  assertEqual(result.mode, 'spindle', 'mode');
  assertEqual(result.nodes[0].pscale, 2, 'root pscale 2');
  assertEqual(result.nodes[1].pscale, 1, 'digit 4 pscale 1');
  assertEqual(result.nodes[2].pscale, 0, 'digit 5 pscale 0');
  assertEqual(result.nodes[3].pscale, -1, 'digit 1 pscale -1');
  assert(result.nodes[3].text.includes('Heartbeat'), 'endpoint is heartbeat');
});

test('all three deep formats reach SAME endpoint', () => {
  const r1 = bsp(wake, 451);
  const r2 = bsp(wake, 0.451);
  const r3 = bsp(wake, 45.1);
  assertEqual(r1.nodes[3].text, r2.nodes[3].text, '451 vs 0.451');
  assertEqual(r2.nodes[3].text, r3.nodes[3].text, '0.451 vs 45.1');
});

test('spread 451 vs 0.451 vs 45.1 — same children', () => {
  const r1 = bsp(wake, 451, '~');
  const r2 = bsp(wake, 0.451, '~');
  const r3 = bsp(wake, 45.1, '~');
  assertEqual(r1.path, '4.5.1', 'path from 451');
  assertEqual(r2.path, '4.5.1', 'path from 0.451');
  assertEqual(r3.path, '4.5.1', 'path from 45.1');
  assertEqual(r1.children.length, r2.children.length, 'children count match');
  assertEqual(r2.children.length, r3.children.length, 'children count match');
});

// ============ SECTION 7: xSpread internal helper ============

console.log('\n=== Section 7: xSpread helper ===\n');

test('xSpread on branch node: wake root', () => {
  const result = xSpread(wake, null);
  assert(result !== null, 'not null');
  assertEqual(result.children.length, 9, '9 top-level children');
  // Check branch indicators
  assert(result.children.every(c => c.branch), 'all root children are branches');
});

test('xSpread on leaf: wake 1.1', () => {
  const result = xSpread(wake, '1.1');
  assert(result !== null, 'not null');
  assert(typeof result.text === 'string', 'has text');
  assertEqual(result.children.length, 0, 'no children');
});

test('xSpread on nonexistent path returns null', () => {
  const result = xSpread(wake, '9.9.9.9');
  assertEqual(result, null, 'returns null');
});

test('xSpread branch indicator distinguishes leaves from branches', () => {
  const result = xSpread(wake, '4.5.1');  // heartbeat concern
  assert(result !== null, 'not null');
  // All children (package, tier, trigger, checks) are strings → branch:false
  assert(result.children.every(c => !c.branch), 'all concern fields are leaves');
  // Now check a branch node — wake section 4 has mixed children
  const section4 = xSpread(wake, '4');
  const hasBranch = section4.children.some(c => c.branch);
  const hasLeaf = section4.children.some(c => !c.branch);
  assert(hasBranch, 'section 4 has branch children');
  assert(hasLeaf, 'section 4 has leaf children');
});

// ============ Summary ============

console.log('\n=== Summary ===');
console.log(`  Total:  ${passed + failed}`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
if (failed > 0) {
  console.log('\n  Failed tests:');
  results.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`    - ${r.name}: ${r.error}`);
  });
}
console.log(failed === 0 ? '\n  All tests passed.\n' : '\n  Some tests failed.\n');

process.exit(failed > 0 ? 1 : 0);
