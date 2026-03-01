// ============================================================
// TUNING FORK — KERNEL INTEGRATION TEST
// ============================================================
//
// Tests that the actual kernel BSP function (with tuning-awareness)
// returns correct pscale labels from block.tuning, not from spindle.
//
// Uses the same getTuningDecimalPosition + bsp logic as g1/kernel.js.

const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  \u2713 ${msg}`); }
  else { fail++; console.log(`  \u2717 FAIL: ${msg}`); }
}

// --- Extract the kernel BSP function (standalone, same logic) ---

function getTuningDecimalPosition(blk) {
  if (!blk || !blk.tuning) return null;
  const parts = String(blk.tuning).split('.');
  const intStr = parts[0] || '0';
  return intStr === '0' ? 0 : intStr.length;
}

function bsp(block, spindle, point) {
  const blk = typeof block === 'object' ? block : null;
  if (!blk || !blk.tree) return { mode: 'block', tree: {} };

  if ((spindle === undefined || spindle === null) && typeof point !== 'string') {
    return { mode: 'block', tree: blk.tree };
  }

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
    // TUNING-AWARE: labels from tuning, walk from spindle
    const spindleDecimal = isDelineation ? 0 : (hasPscale ? intStr.length : -1);
    const tuningDecimal = getTuningDecimalPosition(blk);
    digitsBefore = tuningDecimal !== null ? tuningDecimal : spindleDecimal;
    if (tuningDecimal !== null) hasPscale = true; // tuning fork is label authority
  }

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
    nodes.push({ pscale: hasPscale ? (digitsBefore - 1) - i : null, digit: d, text });
  }

  if (nodes.length === 0) return { mode: 'spindle', nodes: [] };

  if (point !== undefined && point !== null) {
    if (typeof point === 'number') {
      const target = nodes.find(n => n.pscale === point);
      if (target) return { mode: 'point', text: target.text, pscale: target.pscale };
      const last = nodes[nodes.length - 1];
      return { mode: 'point', text: last.text, pscale: last.pscale };
    }
  }

  return { mode: 'spindle', nodes };
}

// --- Load actual blocks ---
const blocksDir = path.join(__dirname, '..', 'blocks');

function loadBlock(name) {
  return JSON.parse(fs.readFileSync(path.join(blocksDir, name + '.json'), 'utf8'));
}


// ================================================================
// TEST 1: All blocks have tuning fields
// ================================================================
console.log('=== TEST 1: All blocks declare tuning ===\n');

const blockNames = ['wake', 'touchstone', 'purpose', 'capabilities', 'vision',
                     'history', 'relationships', 'stash', 'cook'];

blockNames.forEach(name => {
  const blk = loadBlock(name);
  assert(blk.tuning !== undefined, `${name} has tuning field: "${blk.tuning}"`);
});


// ================================================================
// TEST 2: Root blocks — tuning decimal is 0
// ================================================================
console.log('\n=== TEST 2: Root blocks have decimal position 0 ===\n');

const rootBlocks = ['wake', 'touchstone', 'capabilities', 'vision',
                    'relationships', 'stash', 'cook'];

// History is a tree block (no decimal), not root
const historyBlk = loadBlock('history');
const historyPos = getTuningDecimalPosition(historyBlk);
assert(historyPos === 1, `history: tuning "${historyBlk.tuning}" → decimal position ${historyPos} (tree block)`);
console.log(`  ✓ history is tree block: tuning "${historyBlk.tuning}" → decimal position ${historyPos}`);

rootBlocks.forEach(name => {
  const blk = loadBlock(name);
  const pos = getTuningDecimalPosition(blk);
  assert(pos === 0, `${name}: tuning "${blk.tuning}" → decimal position ${pos}`);
});


// ================================================================
// TEST 3: Purpose — contiguous, decimal position matches tuning
// ================================================================
console.log('\n=== TEST 3: Purpose block is contiguous ===\n');

const purpose = loadBlock('purpose');
const purposePos = getTuningDecimalPosition(purpose);
assert(purposePos === 1, `purpose: tuning "${purpose.tuning}" → decimal position ${purposePos} (1 positive level, current depth)`);


// ================================================================
// TEST 4: BSP on root blocks — pscale 0 at root
// ================================================================
console.log('\n=== TEST 4: BSP on root blocks returns pscale 0 at root ===\n');

rootBlocks.forEach(name => {
  const blk = loadBlock(name);
  const result = bsp(blk, 0);
  if (result.nodes && result.nodes.length > 0) {
    assert(result.nodes[0].pscale === 0, `${name}: root node pscale = ${result.nodes[0].pscale}`);
  } else {
    assert(false, `${name}: no nodes returned`);
  }
});


// ================================================================
// TEST 5: BSP on purpose — pscale 9 at root (contiguous)
// ================================================================
console.log('\n=== TEST 5: BSP on purpose — root is pscale 1 ===\n');

const purposeResult = bsp(purpose, '0.1');
assert(purposeResult.nodes[0].pscale === 1, `purpose root: pscale ${purposeResult.nodes[0].pscale}`);
assert(purposeResult.nodes[1].pscale === 0, `purpose digit 1: pscale ${purposeResult.nodes[1].pscale}`);


// ================================================================
// TEST 6: Tuning overrides spindle decimal position
// ================================================================
console.log('\n=== TEST 6: Tuning overrides spindle decimal position ===\n');

// Simulate: a block with tuning "11.111" (contiguous, 2 tree + 3 root)
// accessed with a spindle "0.23" (delineation, would say root=pscale 0)
// Tuning should override: root = pscale 2
const contiguousBlock = {
  tuning: "11.111",
  tree: {
    "_": "test block",
    "2": { "_": "section 2", "3": "detail 3" }
  }
};

const withTuning = bsp(contiguousBlock, '0.23');
assert(withTuning.nodes[0].pscale === 2, `Tuning override: root pscale = ${withTuning.nodes[0].pscale} (should be 2, not 0)`);
assert(withTuning.nodes[1].pscale === 1, `Tuning override: digit 2 pscale = ${withTuning.nodes[1].pscale}`);
assert(withTuning.nodes[2].pscale === 0, `Tuning override: digit 3 pscale = ${withTuning.nodes[2].pscale}`);

// Same block WITHOUT tuning — should fall back to spindle (root = pscale 0)
const noTuningBlock = {
  tree: contiguousBlock.tree
};
const withoutTuning = bsp(noTuningBlock, '0.23');
assert(withoutTuning.nodes[0].pscale === 0, `No tuning fallback: root pscale = ${withoutTuning.nodes[0].pscale} (spindle says 0)`);


// ================================================================
// TEST 7: Drift scenario — block grows, old spindle gets correct labels
// ================================================================
console.log('\n=== TEST 7: Drift scenario — tree growth, tuning prevents mislabelling ===\n');

// Block BEFORE growth: contiguous "11.111" (2+3)
const beforeGrowth = {
  tuning: "11.111",
  tree: {
    "_": "overview",
    "2": { "_": "team A", "3": { "_": "project X", "4": "task alpha" } }
  }
};

// Spindle written at this time
const oldSpindle = '23.4';
const beforeResult = bsp(beforeGrowth, oldSpindle);
console.log('  Before growth (23.4 on "11.111"):');
beforeResult.nodes.forEach(n => console.log(`    pscale ${n.pscale}: "${n.text.substring(0, 60)}"`));

assert(beforeResult.nodes[0].pscale === 2, 'Before: root = pscale 2');
assert(beforeResult.nodes[1].pscale === 1, 'Before: digit 2 = pscale 1');
assert(beforeResult.nodes[2].pscale === 0, 'Before: digit 3 = pscale 0');
assert(beforeResult.nodes[3].pscale === -1, 'Before: digit 4 = pscale -1');

// Block AFTER tree-side growth: "111.111" (3+3) — gained one tree level
const afterGrowth = {
  tuning: "111.111",
  tree: {
    "_": "organisation",
    "1": {
      "_": "overview",
      "2": { "_": "team A", "3": { "_": "project X", "4": "task alpha" } }
    }
  }
};

// Same old spindle — walks tree[2][3][4], but tree[2] doesn't exist at root!
// Path breaks. This is the compression problem (needs spindle update).
const brokenResult = bsp(afterGrowth, oldSpindle);
const pathBroken = brokenResult.nodes.length < 4;
assert(pathBroken, 'After growth: old spindle path breaks (content moved)');

// Fixed spindle: prepend 1 (content is under tree[1] now)
const fixedSpindle = '123.4';
const fixedResult = bsp(afterGrowth, fixedSpindle);
console.log('\n  After growth (123.4 on "111.111"):');
fixedResult.nodes.forEach(n => console.log(`    pscale ${n.pscale}: "${n.text.substring(0, 60)}"`));

assert(fixedResult.nodes[0].pscale === 3, 'After: root = pscale 3 (from tuning, not spindle)');
assert(fixedResult.nodes[3].pscale === 0, 'After: old pscale-0 content still at pscale 0');
assert(fixedResult.nodes[4].pscale === -1, 'After: old pscale-1 content still at pscale -1');


// ================================================================
// TEST 8: Whole-number spindle on tree block — tuning enables labels
// ================================================================
console.log('\n=== TEST 8: Tree block with whole-number spindle gets labels from tuning ===\n');

const treeBlock = {
  tuning: "111",
  tree: {
    "_": "history",
    "3": { "_": "month 3", "2": { "_": "week 2", "1": "day 1" } }
  }
};

// Whole-number spindle (no decimal) — current BSP gives NO labels
const noLabelResult = bsp({ tree: treeBlock.tree }, 321);
assert(noLabelResult.nodes[0].pscale === null, 'Without tuning: whole-number spindle has no pscale labels');

// Same spindle with tuning — gets labels
const withLabelResult = bsp(treeBlock, 321);
assert(withLabelResult.nodes[0].pscale === 3, 'With tuning: root = pscale 3');
assert(withLabelResult.nodes[1].pscale === 2, 'With tuning: digit 3 = pscale 2');
assert(withLabelResult.nodes[2].pscale === 1, 'With tuning: digit 2 = pscale 1');
assert(withLabelResult.nodes[3].pscale === 0, 'With tuning: digit 1 = pscale 0');


// ================================================================
// TEST 9: Load tuning-fork-spec.json itself — verify it's a valid block
// ================================================================
console.log('\n=== TEST 9: tuning-fork-spec.json is a valid pscale block ===\n');

const specPath = path.join(__dirname, '..', 'lib', 'tuning-fork-spec.json');
if (fs.existsSync(specPath)) {
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  assert(spec.tuning !== undefined, `tuning-fork-spec has tuning: "${spec.tuning}"`);
  assert(spec.tree !== undefined, 'tuning-fork-spec has tree');

  const specResult = bsp(spec, '0.1');
  assert(specResult.nodes.length >= 2, 'BSP 0.1 on spec returns root + section 1');
  assert(specResult.nodes[0].pscale === 0, 'Spec root at pscale 0 (root block)');
  console.log(`  Spec 0.1: "${specResult.nodes[1].text.substring(0, 80)}..."`);
} else {
  console.log('  (tuning-fork-spec.json not found — skipping)');
}


// ================================================================
// SUMMARY
// ================================================================
console.log('\n' + '='.repeat(55));
console.log(`  RESULTS: ${pass} passed, ${fail} failed`);
console.log('='.repeat(55));
if (fail > 0) process.exit(1);
