// ============================================================
// TUNING FORK TEST — Semantic Drift and Its Resolution
// ============================================================
//
// Demonstrates three things:
//   1. Root blocks (0.x) are immune to pscale drift
//   2. Tree and contiguous blocks suffer semantic drift when the tree side grows
//   3. A tuning-fork-aware BSP resolves drift by reading the block's tuning field
//
// Three block types:
//   Root      — 0.x spindles, only negative pscale, never drifts
//   Tree      — whole-number spindles (xyz), only positive pscale
//   Contiguous — decimal-embedded spindles (xy.z), both positive and negative
//
// The tuning field: a semantic number on the block (e.g. "111.111") whose
// decimal position is the authority on where pscale 0 sits. BSP reads this
// instead of trusting the spindle's decimal position.
//
// Field name: "tuning" (not "fork" — fork has too many code connotations)

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.log(`  ✗ FAIL: ${msg}`); }
}

// ============ CURRENT BSP (spindle-derived labels) ============
// Replicates the parsing logic from g1/kernel.js

function parseSpindle(spindle) {
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
  return { walkDigits, digitsBefore, hasPscale };
}

function bspCurrentLabels(block, spindle) {
  const { walkDigits, digitsBefore, hasPscale } = parseSpindle(spindle);
  let node = block.tree;
  const nodes = [];
  const rootText = typeof node === 'object' && node._ ? node._ : null;
  if (rootText) nodes.push({ pscale: hasPscale ? digitsBefore : null, text: rootText, source: 'root' });
  for (let i = 0; i < walkDigits.length; i++) {
    const d = walkDigits[i];
    if (!node || typeof node !== 'object' || node[d] === undefined) break;
    node = node[d];
    const text = typeof node === 'string' ? node : (node && node._ ? node._ : JSON.stringify(node));
    nodes.push({
      pscale: hasPscale ? (digitsBefore - 1) - i : null,
      digit: d,
      text
    });
  }
  return nodes;
}

// ============ TUNING-FORK-AWARE BSP (block-derived labels) ============

function getTuningDecimalPosition(block) {
  if (!block.tuning) return null;
  const str = String(block.tuning);
  const parts = str.split('.');
  const intStr = parts[0] || '0';
  if (intStr === '0') return 0; // root/delineation block
  return intStr.length;         // count of digits before decimal
}

function bspTuningLabels(block, spindle) {
  const { walkDigits, digitsBefore, hasPscale } = parseSpindle(spindle);
  const tuningDecimal = getTuningDecimalPosition(block);

  // If block has tuning, use it. Otherwise fall back to spindle-derived labels.
  const effectiveDecimal = tuningDecimal !== null ? tuningDecimal : (hasPscale ? digitsBefore : null);
  const hasLabels = effectiveDecimal !== null;

  let node = block.tree;
  const nodes = [];
  const rootText = typeof node === 'object' && node._ ? node._ : null;
  if (rootText) nodes.push({ pscale: hasLabels ? effectiveDecimal : null, text: rootText, source: 'root' });
  for (let i = 0; i < walkDigits.length; i++) {
    const d = walkDigits[i];
    if (!node || typeof node !== 'object' || node[d] === undefined) break;
    node = node[d];
    const text = typeof node === 'string' ? node : (node && node._ ? node._ : JSON.stringify(node));
    nodes.push({
      pscale: hasLabels ? (effectiveDecimal - 1) - i : null,
      digit: d,
      text
    });
  }
  return nodes;
}

// Helper: get content at a specific pscale level from node list
function getPscale(nodes, level) {
  const match = nodes.find(n => n.pscale === level);
  return match ? match.text : null;
}


// ================================================================
// TEST 1: ROOT BLOCKS — IMMUNE TO DRIFT
// ================================================================
console.log('\n═══ TEST 1: Root blocks (0.x) — immune to drift ═══');
console.log('Root blocks grow by adding depth (negative pscale). Pscale 0 stays at root. No drift.\n');

const rootBlock = {
  tuning: "0.111",
  tree: {
    "_": "spatial reference — containment",
    "3": {
      "_": "the building",
      "4": "room 4A"
    }
  }
};

// Spindle at Time 1: 0.34
const root_t1 = bspCurrentLabels(rootBlock, '0.34');
assert(getPscale(root_t1, 0) === 'spatial reference — containment', 'Root block: pscale 0 = root text');
assert(getPscale(root_t1, -1) === 'the building', 'Root block: pscale -1 = building');
assert(getPscale(root_t1, -2) === 'room 4A', 'Root block: pscale -2 = room');

// Block grows DEEPER (root growth): add a detail under room 4A
const rootBlockGrown = {
  tuning: "0.1111",
  tree: {
    "_": "spatial reference — containment",
    "3": {
      "_": "the building",
      "4": {
        "_": "room 4A",
        "5": "the desk by the window"
      }
    }
  }
};

// Old spindle 0.34 on grown block — still correct!
const root_t2_old = bspCurrentLabels(rootBlockGrown, '0.34');
assert(getPscale(root_t2_old, 0) === 'spatial reference — containment', 'After root growth: pscale 0 unchanged');
assert(getPscale(root_t2_old, -1) === 'the building', 'After root growth: pscale -1 unchanged');
assert(getPscale(root_t2_old, -2) === 'room 4A', 'After root growth: pscale -2 unchanged');

// New deeper spindle 0.345 extends without affecting old labels
const root_t2_new = bspCurrentLabels(rootBlockGrown, '0.345');
assert(getPscale(root_t2_new, -3) === 'the desk by the window', 'New depth: pscale -3 = desk');
assert(getPscale(root_t2_new, 0) === 'spatial reference — containment', 'New depth: pscale 0 still = root');

console.log('  → Root blocks: growth only extends negative pscale. Pscale 0 never moves. No drift.\n');


// ================================================================
// TEST 2: CONTIGUOUS BLOCK — TREE GROWTH CAUSES SEMANTIC DRIFT
// ================================================================
console.log('═══ TEST 2: Contiguous block — tree growth causes drift ═══');
console.log('When tree side grows (positive pscale), old spindles label wrong.\n');

// Time 1: A purpose block with 2 tree levels, 2 root levels
// Tuning: 11.11 (2 digits before decimal)
const contiguousBlock_t1 = {
  tuning: "11.11",
  tree: {
    "_": "purpose workbench",          // pscale 2 (root)
    "2": {
      "_": "coordinate with others",   // pscale 1
      "3": {
        "_": "establish SAND protocol", // pscale 0  ← this is THE reference scale
        "4": {
          "_": "publish passport",      // pscale -1
          "5": "write passport JSON"    // pscale -2
        }
      }
    }
  }
};

// "Correct" spindle at Time 1: 23.45
const cont_t1 = bspCurrentLabels(contiguousBlock_t1, '23.45');
assert(getPscale(cont_t1, 0) === 'establish SAND protocol', 'T1: pscale 0 = SAND (the reference scale)');
assert(getPscale(cont_t1, 2) === 'purpose workbench', 'T1: pscale 2 = root');
assert(getPscale(cont_t1, -1) === 'publish passport', 'T1: pscale -1 = passport');

// Time 2: Block grows outward — new broader tree level added
// The LLM adds a life-purpose level above "purpose workbench"
// Tree restructures: old root becomes a branch of a wider structure
const contiguousBlock_t2 = {
  tuning: "111.11",  // Updated: now 3 digits before decimal
  tree: {
    "_": "life direction",              // pscale 3 (new root)
    "1": {
      "_": "purpose workbench",         // pscale 2 (was root)
      "2": {
        "_": "coordinate with others",  // pscale 1
        "3": {
          "_": "establish SAND protocol", // pscale 0  ← STILL the reference scale
          "4": {
            "_": "publish passport",    // pscale -1
            "5": "write passport JSON"  // pscale -2
          }
        }
      }
    }
  }
};

// "Correct" spindle at Time 2: 123.45
const cont_t2_correct = bspCurrentLabels(contiguousBlock_t2, '123.45');
assert(getPscale(cont_t2_correct, 0) === 'establish SAND protocol', 'T2 correct: pscale 0 = SAND');
assert(getPscale(cont_t2_correct, 3) === 'life direction', 'T2 correct: pscale 3 = new root');

// OLD spindle 23.45 on the GROWN block — SEMANTIC DRIFT
// The path tree[2][3][4][5] doesn't exist anymore! Content moved to tree[1][2][3][4][5].
// But let's test the labeling issue on the SAME content that IS reachable.
// Old spindle 23.45 walks tree[2][3] — tree[2] doesn't exist in the new structure.
// So let's test with a block where old paths still exist (sibling growth, not parent wrapping):

// More realistic scenario: the block grows a NEW branch at the top level
// Old content stays in place, but a new higher-pscale branch appears
const contiguousBlock_t2_sibling = {
  tuning: "111.11",  // Updated: now 3 before decimal (block is "bigger")
  tree: {
    "_": "purpose workbench",          // root — same as before
    "1": "life direction — long-term", // NEW: broader context added
    "2": {
      "_": "coordinate with others",   // same content, same path
      "3": {
        "_": "establish SAND protocol", // same content, same path
        "4": {
          "_": "publish passport",      // same content, same path
          "5": "write passport JSON"    // same content, same path
        }
      }
    }
  }
};

// Old spindle 23.45 on grown block — LABELS ARE WRONG
const cont_drift = bspCurrentLabels(contiguousBlock_t2_sibling, '23.45');
console.log('  Old spindle 23.45 on grown block (current BSP):');
cont_drift.forEach(n => console.log(`    pscale ${n.pscale}: "${n.text}"`));

assert(getPscale(cont_drift, 0) === 'establish SAND protocol',
  'DRIFT CHECK: BSP says pscale 0 = SAND');
// This LOOKS right... but is it? The block's tuning now says 111.11 (3 before decimal).
// The CORRECT pscale for "establish SAND" is now 1 (not 0), because the block grew.
// "pscale 0" should now point to "publish passport" (one level deeper in significance).

// Wait — the tuning says where pscale 0 IS. With tuning 111.11, pscale 0 is at depth 3
// from root. SAND is at depth 2. So SAND should be pscale 1, not pscale 0.

// Let's verify with tuning-aware BSP:
const cont_fixed = bspTuningLabels(contiguousBlock_t2_sibling, '23.45');
console.log('\n  Old spindle 23.45 on grown block (tuning-aware BSP):');
cont_fixed.forEach(n => console.log(`    pscale ${n.pscale}: "${n.text}"`));

assert(getPscale(cont_fixed, 0) !== getPscale(cont_drift, 0) ||
       cont_fixed.find(n => n.text === 'establish SAND protocol')?.pscale !== 0,
  'Tuning-aware labels DIFFER from spindle-derived labels');

// The key test: same spindle, same walk, different labels
const sandNodeCurrent = cont_drift.find(n => n.text === 'establish SAND protocol');
const sandNodeTuning = cont_fixed.find(n => n.text === 'establish SAND protocol');
console.log(`\n  "establish SAND protocol":`);
console.log(`    Current BSP label:  pscale ${sandNodeCurrent?.pscale}`);
console.log(`    Tuning-aware label: pscale ${sandNodeTuning?.pscale}`);
assert(sandNodeCurrent?.pscale === 0, 'Current BSP: SAND at pscale 0 (stale)');
assert(sandNodeTuning?.pscale === 1, 'Tuning-aware: SAND at pscale 1 (correct after growth)');


// ================================================================
// TEST 3: CONTIGUOUS BLOCK — ROOT GROWTH IS SAFE
// ================================================================
console.log('\n═══ TEST 3: Contiguous block — root growth is safe ═══');
console.log('When root side grows (negative pscale), labels are unaffected.\n');

// Same block as T1, but grows a level DEEPER
const contiguousBlock_rootGrown = {
  tuning: "11.111",  // Still 2 before decimal — root growth only extends after decimal
  tree: {
    "_": "purpose workbench",
    "2": {
      "_": "coordinate with others",
      "3": {
        "_": "establish SAND protocol",
        "4": {
          "_": "publish passport",
          "5": {
            "_": "write passport JSON",
            "6": "encode as base64, POST to GitHub API"  // NEW: deeper detail
          }
        }
      }
    }
  }
};

// Old spindle 23.45 — labels unchanged
const cont_rootGrown = bspCurrentLabels(contiguousBlock_rootGrown, '23.45');
assert(getPscale(cont_rootGrown, 0) === 'establish SAND protocol', 'Root growth: pscale 0 unchanged');
assert(getPscale(cont_rootGrown, -1) === 'publish passport', 'Root growth: pscale -1 unchanged');
assert(getPscale(cont_rootGrown, -2) === 'write passport JSON', 'Root growth: pscale -2 unchanged');

// New deeper spindle 23.456 extends without drift
const cont_rootGrown_new = bspCurrentLabels(contiguousBlock_rootGrown, '23.456');
assert(getPscale(cont_rootGrown_new, -3) === 'encode as base64, POST to GitHub API', 'Root growth: pscale -3 = new detail');
assert(getPscale(cont_rootGrown_new, 0) === 'establish SAND protocol', 'Root growth: pscale 0 still correct');

console.log('  → Root growth: safe. Only extends negative pscale. No label shift.\n');


// ================================================================
// TEST 4: TREE BLOCK — DRIFT AND TUNING FIX
// ================================================================
console.log('═══ TEST 4: Tree block (whole-number spindles) ═══');
console.log('Whole-number spindles (no decimal) have no pscale labels in current BSP.\n');

const treeBlock = {
  tuning: "11",  // 2 tree levels — even tree blocks should declare tuning
  tree: {
    "_": "history",
    "2": {
      "_": "week 2 summary",
      "3": "met David, discussed SAND"
    }
  }
};

// Whole-number spindle: no labels in current BSP
const tree_whole = bspCurrentLabels(treeBlock, 23);
const wholeHasLabels = tree_whole.some(n => n.pscale !== null);
assert(!wholeHasLabels, 'Current BSP: whole-number spindle 23 → no pscale labels');

// With decimal: has labels
const tree_decimal = bspCurrentLabels(treeBlock, '2.3');
assert(getPscale(tree_decimal, 0) === 'week 2 summary', 'Current BSP: 2.3 → pscale 0 = week 2');

// Tuning-aware BSP: even whole-number spindle gets labels from block tuning
const tree_tuning_whole = bspTuningLabels(treeBlock, 23);
const tuningHasLabels = tree_tuning_whole.some(n => n.pscale !== null);
assert(tuningHasLabels, 'Tuning-aware: whole-number spindle 23 → GETS pscale labels from tuning');
assert(getPscale(tree_tuning_whole, 2) === 'history', 'Tuning-aware: root = pscale 2 (from tuning "11", 2 before decimal)');
assert(getPscale(tree_tuning_whole, 1) === 'week 2 summary', 'Tuning-aware: digit 2 = pscale 1');
assert(getPscale(tree_tuning_whole, 0) === 'met David, discussed SAND', 'Tuning-aware: digit 3 = pscale 0 (leaf)');

console.log('  → Tuning-aware BSP gives labels even to whole-number spindles.\n');


// ================================================================
// TEST 5: THE FULL DRIFT SCENARIO
// ================================================================
console.log('═══ TEST 5: Full drift scenario — spindle stored in wake ═══');
console.log('A spindle is written into wake at Time 1. Block grows at Time 2.');
console.log('At Time 3, the kernel uses the stale spindle. What happens?\n');

// Purpose block at Time 1 — small, 2 positive levels
const purpose_t1 = {
  tuning: "11.111",
  tree: {
    "_": "purpose workbench",             // pscale 2
    "1": {
      "_": "orient and inhabit shell",    // pscale 1
      "1": {
        "_": "build interface",           // pscale 0  ← reference scale
        "1": "read blocks first",         // pscale -1
        "2": "write first purpose entry"  // pscale -1 (sibling)
      }
    }
  }
};

// At Time 1, the LLM writes a wake instruction: "purpose 11.1"
// This means: spindle 11.1 into the purpose block
// pscale 0 = "build interface" (correct at Time 1)
const wake_spindle = '11.1';  // stored in wake
const purpose_t1_result = bspCurrentLabels(purpose_t1, wake_spindle);
assert(getPscale(purpose_t1_result, 0) === 'build interface',
  'Time 1: wake spindle 11.1 → pscale 0 = "build interface" ✓');

// Time 2: purpose grows. LLM adds life-scale objectives.
// The block now has 3 positive levels. Tuning updates to 111.111.
const purpose_t2 = {
  tuning: "111.111",
  tree: {
    "_": "purpose workbench",             // pscale 3
    "1": {
      "_": "orient and inhabit shell",    // pscale 2
      "1": {
        "_": "build interface",           // pscale 1  ← shifted! was 0, now 1
        "1": "read blocks first",         // pscale 0  ← THIS is now pscale 0
        "2": "write first purpose entry"  // pscale 0 (sibling)
      }
    },
    "2": "long-term: contribute to commons"  // new content at the broader level
  }
};

// Time 3: kernel loads the STALE wake spindle "purpose 11.1" against the GROWN block
console.log('  Time 3: kernel uses stale wake spindle on grown block...');

// WITHOUT tuning fork awareness:
const stale_result = bspCurrentLabels(purpose_t2, wake_spindle);
console.log('  Current BSP (spindle-derived labels):');
stale_result.forEach(n => console.log(`    pscale ${n.pscale}: "${n.text}"`));

const stale_pscale0 = getPscale(stale_result, 0);
assert(stale_pscale0 === 'build interface',
  'DRIFT: Current BSP says pscale 0 = "build interface" (STALE — was correct at T1, wrong at T2)');

// WITH tuning fork awareness:
const tuning_result = bspTuningLabels(purpose_t2, wake_spindle);
console.log('\n  Tuning-aware BSP (block-derived labels):');
tuning_result.forEach(n => console.log(`    pscale ${n.pscale}: "${n.text}"`));

const tuning_pscale0 = getPscale(tuning_result, 0);
assert(tuning_pscale0 === 'read blocks first',
  'FIXED: Tuning-aware BSP says pscale 0 = "read blocks first" (CORRECT for T2)');

// The walk is IDENTICAL — same content reached
const stale_texts = stale_result.filter(n => n.digit).map(n => n.text);
const tuning_texts = tuning_result.filter(n => n.digit).map(n => n.text);
assert(stale_texts.join('|') === tuning_texts.join('|'),
  'Walk is identical — same content reached by both');

// But the MEANING is different
assert(stale_pscale0 !== tuning_pscale0,
  'Semantic meaning differs: "pscale 0" points to different content!');

console.log('\n  → This is the drift. Same spindle, same walk, same content reached.');
console.log('  → But "pscale 0" means different things. The semantic number is broken.');
console.log('  → The tuning fork fixes it: labels come from the BLOCK, not the spindle.\n');


// ================================================================
// TEST 6: DELINEATION SPINDLE ON A CONTIGUOUS BLOCK
// ================================================================
console.log('═══ TEST 6: Delineation spindle (0.x) on a contiguous block ═══');
console.log('What happens when someone uses 0.x notation on a block with tree levels?\n');

// Same grown purpose block from Test 5 (tuning 111.111)
// Someone writes spindle 0.111 (delineation — treating root as pscale 0)
const delin_on_contiguous = bspCurrentLabels(purpose_t2, '0.111');
console.log('  Spindle 0.111 on contiguous block (current BSP):');
delin_on_contiguous.forEach(n => console.log(`    pscale ${n.pscale}: "${n.text}"`));
assert(getPscale(delin_on_contiguous, 0) === 'purpose workbench',
  'Current BSP: 0.111 says pscale 0 = root (WRONG for contiguous block)');

const delin_tuning = bspTuningLabels(purpose_t2, '0.111');
console.log('\n  Spindle 0.111 on contiguous block (tuning-aware BSP):');
delin_tuning.forEach(n => console.log(`    pscale ${n.pscale}: "${n.text}"`));
assert(getPscale(delin_tuning, 3) === 'purpose workbench',
  'Tuning-aware: root correctly labeled pscale 3');
assert(getPscale(delin_tuning, 0) === 'read blocks first',
  'Tuning-aware: pscale 0 = correct content regardless of spindle notation');

console.log('\n  → Tuning-aware BSP normalises ALL spindle notations against the block.\n');


// ================================================================
// TEST 7: VERIFY DIRECTION OF DRIFT
// ================================================================
console.log('═══ TEST 7: Drift direction — only tree growth, never root growth ═══\n');

const block_base = {
  tuning: "11.11",
  tree: {
    "_": "A",
    "2": { "_": "B", "3": { "_": "C", "4": "D" } }
  }
};

const spindle = '23.4';
const base_labels = bspCurrentLabels(block_base, spindle);
const base_p0 = getPscale(base_labels, 0);

// Root growth: 11.11 → 11.111 (add depth)
const block_rootGrow = {
  tuning: "11.111",
  tree: {
    "_": "A",
    "2": { "_": "B", "3": { "_": "C", "4": { "_": "D", "5": "E" } } }
  }
};
const rootGrow_labels = bspCurrentLabels(block_rootGrow, spindle);
const rootGrow_p0 = getPscale(rootGrow_labels, 0);
assert(base_p0 === rootGrow_p0,
  `Root growth: pscale 0 unchanged ("${base_p0}" → "${rootGrow_p0}")`);

// Tree growth: 11.11 → 111.11 (add breadth above)
const block_treeGrow = {
  tuning: "111.11",
  tree: {
    "_": "A",
    "1": "new broader context",
    "2": { "_": "B", "3": { "_": "C", "4": "D" } }
  }
};

// Current BSP: still says pscale 0 = "C" (from spindle 23.4)
const treeGrow_current = bspCurrentLabels(block_treeGrow, spindle);
const treeGrow_p0_current = getPscale(treeGrow_current, 0);
assert(treeGrow_p0_current === base_p0,
  `Tree growth + current BSP: pscale 0 UNCHANGED = "${treeGrow_p0_current}" (STALE!)`);

// Tuning-aware BSP: correctly shifts labels
const treeGrow_tuning = bspTuningLabels(block_treeGrow, spindle);
const treeGrow_p0_tuning = getPscale(treeGrow_tuning, 0);
assert(treeGrow_p0_tuning !== base_p0,
  `Tree growth + tuning BSP: pscale 0 SHIFTED = "${treeGrow_p0_tuning}" (CORRECT!)`);
assert(treeGrow_p0_tuning === 'D',
  `Tree growth + tuning BSP: pscale 0 = "D" (one level deeper, matching new tuning)`);

console.log('\n  → Root growth: no drift (same labels).');
console.log('  → Tree growth without tuning: drift (stale labels).');
console.log('  → Tree growth with tuning: fixed (correct labels).\n');


// ================================================================
// TEST 8: TUNING FIELD FORMAT
// ================================================================
console.log('═══ TEST 8: Tuning field format and parsing ═══\n');

// The tuning field is a semantic number. Its decimal position is what matters.
// The digits themselves encode capacity (how many pscale levels the block supports).

assert(getTuningDecimalPosition({ tuning: "0.111" }) === 0, '"0.111" → decimal position 0 (root block)');
assert(getTuningDecimalPosition({ tuning: "1.11" }) === 1, '"1.11" → decimal position 1');
assert(getTuningDecimalPosition({ tuning: "11.11" }) === 2, '"11.11" → decimal position 2');
assert(getTuningDecimalPosition({ tuning: "111.111" }) === 3, '"111.111" → decimal position 3');
assert(getTuningDecimalPosition({ tuning: "111111111.111" }) === 9, '"111111111.111" → decimal position 9 (purpose)');
assert(getTuningDecimalPosition({ tuning: "11" }) === 2, '"11" → decimal position 2 (tree-only, no root)');
assert(getTuningDecimalPosition({}) === null, 'No tuning field → null (fall back to spindle)');

console.log('  → Tuning field parsed correctly. Decimal position from digit count.\n');


// ================================================================
// SUMMARY
// ================================================================
console.log('═══════════════════════════════════════════════════════');
console.log(`  RESULTS: ${pass} passed, ${fail} failed`);
console.log('═══════════════════════════════════════════════════════');
console.log('');
console.log('FINDINGS:');
console.log('  1. Root blocks (0.x) never drift — growth extends negative pscale only');
console.log('  2. Tree and contiguous blocks drift when tree side grows:');
console.log('     old spindles give WRONG pscale labels (same walk, wrong meaning)');
console.log('  3. The tuning field on the block fixes drift:');
console.log('     BSP reads block.tuning for pscale labels instead of the spindle');
console.log('  4. Walk digits always come from the spindle — navigation is unaffected');
console.log('  5. Labels always come from the tuning — semantics are correct');
console.log('  6. Tuning-aware BSP also gives labels to whole-number spindles');
console.log('     (which currently get no labels at all)');
console.log('');
console.log('IMPLEMENTATION:');
console.log('  Field name: "tuning" (not "fork", "decimal", or "place")');
console.log('  Format: semantic number (e.g. "111.111") where decimal position');
console.log('  encodes where pscale 0 sits. Digits encode capacity.');
console.log('  BSP change: ~5 lines — read block.tuning, use its decimal position');
console.log('  for pscale labels instead of the spindle\'s decimal position.');
console.log('');
console.log('RULE: When a block grows outward (tuning gains digits before decimal),');
console.log('  update the tuning field. All existing spindles automatically get');
console.log('  correct labels because BSP reads the block, not the spindle.');
console.log('  Stale spindles in wake, cook, or other references need NO updating.');
console.log('');
