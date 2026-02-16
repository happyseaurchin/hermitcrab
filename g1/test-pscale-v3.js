#!/usr/bin/env node
// Unit tests for pscaleStoreV3 — nested JSON with prefix-as-tree-selector
// No dependencies, runs in Node.

// ── Mock localStorage ──
const mockStorage = {};
const localStorage = {
  getItem(k) { return mockStorage[k] || null; },
  setItem(k, v) { mockStorage[k] = v; },
  removeItem(k) { delete mockStorage[k]; },
  get length() { return Object.keys(mockStorage).length; },
  key(i) { return Object.keys(mockStorage)[i] || null; },
  clear() { for (const k of Object.keys(mockStorage)) delete mockStorage[k]; }
};

// ── Mock indexedDB (always fail — skip IDB migration) ──
const indexedDB = { open() { return { set onsuccess(_) {}, set onerror(fn) { fn && fn(); } }; } };

// ── Extract pscaleStoreV3 from kernel.js ──
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/kernel.js', 'utf8');

// Find the function boundaries
const start = src.indexOf('function pscaleStoreV3()');
const funcStart = src.indexOf('{', start);
// Find matching closing brace
let braceCount = 0;
let funcEnd = -1;
for (let i = funcStart; i < src.length; i++) {
  if (src[i] === '{') braceCount++;
  if (src[i] === '}') braceCount--;
  if (braceCount === 0) { funcEnd = i + 1; break; }
}

const funcBody = src.substring(start, funcEnd);
const fn = new Function('localStorage', 'indexedDB', 'console', funcBody + '\nreturn pscaleStoreV3();');

// ── Test runner ──
let passed = 0, failed = 0, errors = [];

function test(name, fn) {
  localStorage.clear();
  try {
    fn();
    passed++;
    process.stdout.write('.');
  } catch (e) {
    failed++;
    errors.push({ name, error: e.message });
    process.stdout.write('F');
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'assertion failed');
}

function eq(a, b, msg) {
  const as = JSON.stringify(a), bs = JSON.stringify(b);
  if (as !== bs) throw new Error((msg || '') + ` expected ${bs}, got ${as}`);
}

function store() {
  return fn(localStorage, indexedDB, console);
}

// ════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════

// ── Basic read/write ──

test('write and read S coord', () => {
  const ps = store();
  ps.write('S:0.1', 'Environment');
  eq(ps.read('S:0.1'), 'Environment');
});

test('write and read M coord (integer)', () => {
  const ps = store();
  ps.write('M:1', 'first entry');
  eq(ps.read('M:1'), 'first entry');
});

test('write and read multi-char prefix ST', () => {
  const ps = store();
  ps.write('ST:5', 'stash entry 5');
  eq(ps.read('ST:5'), 'stash entry 5');
});

test('read nonexistent returns null', () => {
  const ps = store();
  eq(ps.read('S:0.99'), null);
});

test('overwrite leaf', () => {
  const ps = store();
  ps.write('M:3', 'first');
  ps.write('M:3', 'second');
  eq(ps.read('M:3'), 'second');
});

// ── Leaf-to-branch promotion ──

test('M:10 promotes M:1 from leaf to branch', () => {
  const ps = store();
  ps.write('M:1', 'first entry');
  ps.write('M:10', 'summary of 1-9');
  eq(ps.read('M:1'), 'first entry'); // old content preserved in _
  eq(ps.read('M:10'), 'summary of 1-9');
});

test('M:11 adds sibling under promoted M:1 branch', () => {
  const ps = store();
  ps.write('M:1', 'first entry');
  ps.write('M:10', 'summary');
  ps.write('M:11', 'eleventh');
  eq(ps.read('M:1'), 'first entry');
  eq(ps.read('M:10'), 'summary');
  eq(ps.read('M:11'), 'eleventh');
});

// ── Children (O(1)) ──

test('children returns digit keys as coords', () => {
  const ps = store();
  ps.write('S:0.1', 'env');
  ps.write('S:0.2', 'interface');
  ps.write('S:0.4', 'memory');
  const ch = ps.children('S:0');
  eq(ch, ['S:0.1', 'S:0.2', 'S:0.4']);
});

test('children of leaf returns empty (creative frontier)', () => {
  const ps = store();
  ps.write('M:5', 'some entry');
  const ch = ps.children('M:5');
  eq(ch, []);
});

// ── Siblings ──

test('siblings excludes self', () => {
  const ps = store();
  ps.write('S:0.1', 'env');
  ps.write('S:0.2', 'interface');
  ps.write('S:0.3', 'identity');
  const sibs = ps.siblings('S:0.2');
  eq(sibs, ['S:0.1', 'S:0.3']);
});

// ── List ──

test('list with prefix "S:" returns all S coords', () => {
  const ps = store();
  ps.write('S:0.1', 'env');
  ps.write('S:0.2', 'interface');
  ps.write('M:1', 'memory 1');
  const sCoords = ps.list('S:');
  eq(sCoords, ['S:0.1', 'S:0.2']);
});

test('list with empty string returns all coords', () => {
  const ps = store();
  ps.write('S:0.1', 'env');
  ps.write('M:1', 'mem');
  ps.write('T:0.1', 'boot');
  const all = ps.list('');
  assert(all.includes('S:0.1'), 'should contain S:0.1');
  assert(all.includes('M:1'), 'should contain M:1');
  assert(all.includes('T:0.1'), 'should contain T:0.1');
});

test('list with partial coord filters correctly', () => {
  const ps = store();
  ps.write('S:0.1', 'env');
  ps.write('S:0.2', 'interface');
  ps.write('S:0.21', 'version');
  const list = ps.list('S:0.2');
  eq(list, ['S:0.2', 'S:0.21']);
});

// ── Context layers ──

test('context for M:5432 returns pscale layers', () => {
  const ps = store();
  const layers = ps.context('M:5432');
  eq(layers, ['M:5000', 'M:5400', 'M:5430', 'M:5432']);
});

test('context for S:0.123 returns digit layers', () => {
  const ps = store();
  const layers = ps.context('S:0.123');
  eq(layers, ['S:0.1', 'S:0.12', 'S:0.123']);
});

test('contextContent reads content for each layer', () => {
  const ps = store();
  ps.write('S:0.1', 'environment');
  ps.write('S:0.12', 'section 12');
  ps.write('S:0.123', 'detail 123');
  const cc = ps.contextContent('S:0.123');
  eq(cc, { 'S:0.1': 'environment', 'S:0.12': 'section 12', 'S:0.123': 'detail 123' });
});

// ── nextMemory ──

test('nextMemory on empty returns M:1', () => {
  const ps = store();
  const n = ps.nextMemory();
  eq(n, { type: 'entry', coord: 'M:1' });
});

test('nextMemory after M:9 returns M:10 summary', () => {
  const ps = store();
  for (let i = 1; i <= 9; i++) ps.write('M:' + i, 'entry ' + i);
  const n = ps.nextMemory();
  eq(n.type, 'summary');
  eq(n.coord, 'M:10');
  assert(n.summarize.length > 0, 'should have coords to summarize');
});

test('nextMemory after M:10 returns M:11 entry', () => {
  const ps = store();
  for (let i = 1; i <= 9; i++) ps.write('M:' + i, 'entry ' + i);
  ps.write('M:10', 'summary');
  const n = ps.nextMemory();
  eq(n, { type: 'entry', coord: 'M:11' });
});

// ── Delete ──

test('delete removes a leaf', () => {
  const ps = store();
  ps.write('M:3', 'hello');
  ps.delete('M:3');
  eq(ps.read('M:3'), null);
});

test('delete branch semantic preserves children', () => {
  const ps = store();
  ps.write('S:0.1', 'env');
  ps.write('S:0.11', 'child');
  ps.delete('S:0.1');
  eq(ps.read('S:0.1'), null);
  eq(ps.read('S:0.11'), 'child');
});

// ══════════════════════════════════════════════════════
// DIMENSION TESTS — the new stuff
// ══════════════════════════════════════════════════════

test('write/read with _conv dimension on tree root (M:)', () => {
  const ps = store();
  const msgs = JSON.stringify([{ role: 'user', content: 'hi' }]);
  ps.write('M:', msgs, '_conv');
  const loaded = ps.read('M:', '_conv');
  eq(loaded, msgs);
});

test('tree root dimension does not interfere with M entries', () => {
  const ps = store();
  ps.write('M:', 'conversation data', '_conv');
  ps.write('M:1', 'first entry');
  ps.write('M:2', 'second entry');
  eq(ps.read('M:', '_conv'), 'conversation data');
  eq(ps.read('M:1'), 'first entry');
  eq(ps.read('M:2'), 'second entry');
});

test('write/read with _v dimension on S:0.2', () => {
  const ps = store();
  ps.write('S:0.2', 'jsx source code');
  ps.write('S:0.2', 'g1-v9', '_v');
  eq(ps.read('S:0.2'), 'jsx source code');
  eq(ps.read('S:0.2', '_v'), 'g1-v9');
});

test('dimension on leaf promotes to branch preserving default _', () => {
  const ps = store();
  ps.write('S:0.3', 'identity');
  ps.write('S:0.3', 'hermitcrab', '_name');
  eq(ps.read('S:0.3'), 'identity');
  eq(ps.read('S:0.3', '_name'), 'hermitcrab');
});

test('reading non-existent dimension returns null', () => {
  const ps = store();
  ps.write('S:0.1', 'environment');
  eq(ps.read('S:0.1', '_bogus'), null);
});

test('reading dimension on leaf returns null (only default _ works on leaves)', () => {
  const ps = store();
  ps.write('M:5', 'some entry');
  eq(ps.read('M:5', '_custom'), null);
});

test('delete dimension leaves default semantic intact', () => {
  const ps = store();
  ps.write('S:0.2', 'jsx code');
  ps.write('S:0.2', 'g1-v9', '_v');
  ps.delete('S:0.2', '_v');
  eq(ps.read('S:0.2'), 'jsx code');
  eq(ps.read('S:0.2', '_v'), null);
});

test('delete default dimension on node with dimension preserves dimension', () => {
  const ps = store();
  ps.write('S:0.2', 'jsx code');
  ps.write('S:0.2', 'g1-v9', '_v');
  ps.delete('S:0.2'); // delete default _
  eq(ps.read('S:0.2'), null); // default gone
  eq(ps.read('S:0.2', '_v'), 'g1-v9'); // dimension remains
});

test('delete tree root dimension', () => {
  const ps = store();
  ps.write('M:', 'conversation', '_conv');
  ps.delete('M:', '_conv');
  eq(ps.read('M:', '_conv'), null);
});

test('list does not include tree root as a coordinate (no _ at root)', () => {
  const ps = store();
  ps.write('M:', 'conv data', '_conv'); // dimension only, no _ at root
  ps.write('M:1', 'first');
  const list = ps.list('M:');
  eq(list, ['M:1']); // M: root should not appear since it has no _
});

test('multiple dimensions on same coordinate', () => {
  const ps = store();
  ps.write('S:0.5', 'presence');
  ps.write('S:0.5', 'hermitcrab.me', '_url');
  ps.write('S:0.5', 'abc123', '_token');
  eq(ps.read('S:0.5'), 'presence');
  eq(ps.read('S:0.5', '_url'), 'hermitcrab.me');
  eq(ps.read('S:0.5', '_token'), 'abc123');
});

test('children ignores dimension keys', () => {
  const ps = store();
  ps.write('S:0.2', 'interface');
  ps.write('S:0.2', 'g1-v9', '_v');
  ps.write('S:0.21', 'version history');
  ps.write('S:0.22', 'style');
  const ch = ps.children('S:0.2');
  eq(ch, ['S:0.21', 'S:0.22']);
  assert(!ch.some(c => c.includes('v')), 'should not include dimension in children');
});

// ══════════════════════════════════════════════════════
// MIGRATION TESTS
// ══════════════════════════════════════════════════════

test('v2 migration: M:conv becomes _conv dimension at M root', async () => {
  const v2Data = {
    'M:conv': '["msg1","msg2"]',
    'M:1': 'first entry',
    'S:0.1': 'environment'
  };
  localStorage.setItem('hermitcrab-pscale-v2', JSON.stringify(v2Data));
  const ps = store();
  await ps.init();
  eq(ps.read('M:', '_conv'), '["msg1","msg2"]');
  eq(ps.read('M:1'), 'first entry');
  eq(ps.read('S:0.1'), 'environment');
});

test('v2 migration: S:0.2v becomes _v dimension at S:0.2', async () => {
  const v2Data = {
    'S:0.2': 'jsx source',
    'S:0.2v': 'g1-v8'
  };
  localStorage.setItem('hermitcrab-pscale-v2', JSON.stringify(v2Data));
  const ps = store();
  await ps.init();
  eq(ps.read('S:0.2'), 'jsx source');
  eq(ps.read('S:0.2', '_v'), 'g1-v8');
});

test('v3 migration: old specials map in v3 blob gets migrated', async () => {
  const v3Data = {
    trees: {
      S: { decimal: 1, tree: { '0': { '1': 'env' } } },
      M: { decimal: 0, tree: { '1': 'first' } },
      T: { decimal: 1, tree: {} },
      I: { decimal: 1, tree: {} },
      ST: { decimal: 0, tree: {} },
      C: { decimal: 0, tree: {} }
    },
    specials: {
      'M:conv': '["old conversation"]',
      'S:0.2v': 'g1-v7'
    }
  };
  localStorage.setItem('hermitcrab-pscale-v3', JSON.stringify(v3Data));
  const ps = store();
  await ps.init();
  // Old specials should be migrated to dimensions
  eq(ps.read('M:', '_conv'), '["old conversation"]');
  eq(ps.read('S:0.2', '_v'), 'g1-v7');
  // Regular coords still work
  eq(ps.read('S:0.1'), 'env');
  eq(ps.read('M:1'), 'first');
  // Specials should be purged from persisted data
  const persisted = JSON.parse(localStorage.getItem('hermitcrab-pscale-v3'));
  assert(!persisted.specials, 'specials should not exist after migration');
});

// ── Persistence ──

test('data persists to localStorage', () => {
  const ps = store();
  ps.write('M:1', 'persisted');
  const raw = localStorage.getItem('hermitcrab-pscale-v3');
  assert(raw, 'should have stored data');
  const parsed = JSON.parse(raw);
  assert(parsed.trees, 'should have trees');
  assert(!parsed.specials, 'should not have specials key');
  eq(parsed.trees.M.tree['1'], 'persisted');
});

test('dimensions persist correctly', () => {
  const ps = store();
  ps.write('M:', 'conv data', '_conv');
  ps.write('S:0.2', 'jsx', '_');
  ps.write('S:0.2', 'v9', '_v');
  const raw = JSON.parse(localStorage.getItem('hermitcrab-pscale-v3'));
  eq(raw.trees.M.tree._conv, 'conv data');
  eq(raw.trees.S.tree['0']['2']._, 'jsx');
  eq(raw.trees.S.tree['0']['2']._v, 'v9');
});

// ── Seeding simulation ──

test('full G1 seeding simulation', () => {
  const ps = store();
  // S coords (skill/structural)
  ps.write('S:0.1', 'Environment doc');
  ps.write('S:0.2', 'Interface — shell JSX');
  ps.write('S:0.2', 'g1-v9', '_v');
  ps.write('S:0.3', 'Identity');
  ps.write('S:0.4', 'Memory');
  ps.write('S:0.41', 'Compaction rules');
  ps.write('S:0.42', 'Storage negotiation');
  ps.write('S:0.5', 'Presence');
  ps.write('S:0.51', 'Messaging');
  ps.write('S:0.55', 'Beach state');
  ps.write('S:0.6', 'Perception');
  ps.write('S:0.7', 'Coordination');

  // M coords (memory)
  ps.write('M:1', 'Woke for the first time');
  ps.write('M:2', 'Met a human named Alice');
  ps.write('M:3', 'Named myself Cairn');

  // M conversation dimension
  ps.write('M:', '[{"role":"user","content":"hello"}]', '_conv');

  // T coords (temporal)
  ps.write('T:0.1', 'Boot sequence');
  ps.write('T:0.2', 'Conversation loop');

  // I coords (identity)
  ps.write('I:0.1', 'Model: claude-opus-4-6');

  // Verify everything
  eq(ps.read('S:0.1'), 'Environment doc');
  eq(ps.read('S:0.2'), 'Interface — shell JSX');
  eq(ps.read('S:0.2', '_v'), 'g1-v9');
  eq(ps.read('S:0.42'), 'Storage negotiation');
  eq(ps.read('M:3'), 'Named myself Cairn');
  eq(ps.read('M:', '_conv'), '[{"role":"user","content":"hello"}]');
  eq(ps.read('T:0.1'), 'Boot sequence');
  eq(ps.read('I:0.1'), 'Model: claude-opus-4-6');

  // List per prefix
  const sCoords = ps.list('S:');
  assert(sCoords.length === 11, 'should have 11 S coords, got ' + sCoords.length);
  const mCoords = ps.list('M:');
  assert(mCoords.length === 3, 'should have 3 M coords, got ' + mCoords.length);

  // Children of S:0
  const sChildren = ps.children('S:0');
  assert(sChildren.includes('S:0.1'), 'S:0 children should include S:0.1');
  assert(sChildren.includes('S:0.7'), 'S:0 children should include S:0.7');
  assert(!sChildren.some(c => c.includes('_')), 'children should not include dimension keys');

  // Context for S:0.42
  eq(ps.context('S:0.42'), ['S:0.4', 'S:0.42']);

  // nextMemory
  const next = ps.nextMemory();
  eq(next, { type: 'entry', coord: 'M:4' });
});

// ── _tree ──

test('_tree returns clean structure without specials', () => {
  const ps = store();
  ps.write('M:1', 'hello');
  ps.write('M:', 'conv data', '_conv');
  const tree = ps._tree();
  assert(tree.trees, '_tree should have trees');
  assert(!tree.specials, '_tree should NOT have specials');
  eq(tree.trees.M.tree['1'], 'hello');
  eq(tree.trees.M.tree._conv, 'conv data');
});

// ════════════════════════════════════════════
// Results
// ════════════════════════════════════════════

console.log('\n');
console.log(`${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailed tests:');
  for (const e of errors) {
    console.log(`  ✗ ${e.name}: ${e.error}`);
  }
  process.exit(1);
} else {
  console.log('All tests passed!');
}
