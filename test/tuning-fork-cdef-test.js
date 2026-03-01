// ============================================================
// TUNING FORK — CDEF EXHAUSTIVE TEST
// ============================================================
//
// David's test: content CDEF mapped to digits 3456.
// Trace every spindle format through the same content.
// Then test growth in both directions.
//
// The question: does tuning interfere with semantic pull?

let pass = 0, fail = 0, warn = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.log(`  ✗ FAIL: ${msg}`); }
}
function note(msg) { console.log(`  → ${msg}`); }
function warning(msg) { warn++; console.log(`  ⚠ WARNING: ${msg}`); }

// --- BSP (kernel-identical, tuning-aware) ---

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
    const spindleDecimal = isDelineation ? 0 : (hasPscale ? intStr.length : -1);
    const tuningDecimal = getTuningDecimalPosition(blk);
    digitsBefore = tuningDecimal !== null ? tuningDecimal : spindleDecimal;
    if (tuningDecimal !== null) hasPscale = true;
  }

  const nodes = [];
  let node = blk.tree;

  const rootText = (typeof node === 'object' && node !== null && typeof node['_'] === 'string')
    ? node['_'] : null;
  if (rootText !== null) {
    nodes.push({ pscale: hasPscale ? digitsBefore : null, text: rootText, source: 'root' });
  }

  for (let i = 0; i < walkDigits.length; i++) {
    const d = walkDigits[i];
    if (!node || typeof node !== 'object' || node[d] === undefined) {
      nodes.push({ pscale: null, digit: d, text: '(MISS)', broken: true });
      break;
    }
    node = node[d];
    const text = typeof node === 'string'
      ? node
      : (typeof node === 'object' && node !== null && typeof node['_'] === 'string')
        ? node['_']
        : JSON.stringify(node);
    nodes.push({
      pscale: hasPscale ? (digitsBefore - 1) - i : null,
      digit: d,
      text,
      source: 'walk'
    });
  }

  if (nodes.length === 0) return { mode: 'spindle', nodes: [] };

  if (point !== undefined && point !== null) {
    const p = typeof point === 'string' ? Number(point) : point;
    const target = nodes.find(n => n.pscale === p);
    if (target) return { mode: 'point', text: target.text, pscale: target.pscale };
    const last = nodes[nodes.length - 1];
    return { mode: 'point', text: last.text, pscale: last.pscale, note: `pscale ${p} not found, returned last` };
  }

  return { mode: 'spindle', nodes };
}

function showSpindle(result) {
  if (result.mode === 'point') {
    console.log(`    → point: pscale ${result.pscale} = "${result.text}"${result.note ? ' (' + result.note + ')' : ''}`);
    return;
  }
  result.nodes.forEach(n => {
    const label = n.pscale !== null ? `pscale ${n.pscale}` : '(no label)';
    const digit = n.digit ? `[${n.digit}]` : ' _ ';
    const broken = n.broken ? ' ← BROKEN' : '';
    console.log(`    ${digit} ${label.padEnd(12)} "${n.text}"${broken}`);
  });
}

function getTexts(result) {
  return result.nodes.filter(n => !n.broken).map(n => n.text);
}
function hasBroken(result) {
  return result.nodes.some(n => n.broken);
}


// ================================================================
// THE BLOCK: CDEF at digits 3→4→5→6
// ================================================================
// Nested: tree.3._ = C, tree.3.4._ = D, tree.3.4.5._ = E, tree.3.4.5.6 = F

const CDEF_TREE = {
  "_": "Root",
  "3": {
    "_": "C",
    "4": {
      "_": "D",
      "5": {
        "_": "E",
        "6": "F"
      }
    }
  }
};


// ================================================================
// PART 1: ROOT BLOCK — tuning "0.1111"
// ================================================================
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  PART 1: ROOT BLOCK — tuning "0.1111"                      ║');
console.log('║  CDEF at digits 3456, decimal at position 0                ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

const root_block = { tuning: "0.1111", tree: CDEF_TREE };

console.log('  --- 1a: Spindle 0.3456 (delineation, the natural form) ---');
let r = bsp(root_block, '0.3456');
showSpindle(r);
assert(!hasBroken(r), '0.3456: path intact');
assert(getTexts(r).join('') === 'RootCDEF', '0.3456: delivers Root+CDEF');
assert(r.nodes[0].pscale === 0, '0.3456: root = pscale 0');
assert(r.nodes[4].pscale === -4, '0.3456: F = pscale -4');

console.log('\n  --- 1b: Spindle 3456 (whole number, no decimal) ---');
r = bsp(root_block, 3456);
showSpindle(r);
assert(!hasBroken(r), '3456: path intact');
assert(getTexts(r).join('') === 'RootCDEF', '3456: delivers Root+CDEF');
note('Tuning override: hasPscale forced true, digitsBefore=0 from tuning');
assert(r.nodes[0].pscale === 0, '3456: root = pscale 0 (from tuning, not spindle)');
assert(r.nodes[4].pscale === -4, '3456: F = pscale -4');

console.log('\n  --- 1c: Spindle 6 (just the last digit) ---');
r = bsp(root_block, 6);
showSpindle(r);
assert(hasBroken(r), '6: path BROKEN — tree[6] does not exist');
note('Content is at tree[3][4][5][6]. You cannot skip digits 3,4,5.');
note('This is not a tuning problem — it is a structural fact.');
note('Spindle 6 asks for tree[6]. The tree has no child 6 at root.');

console.log('\n  --- 1d: Spindle 56 (last two digits) ---');
r = bsp(root_block, 56);
showSpindle(r);
assert(hasBroken(r), '56: path BROKEN — tree[5] does not exist');
note('Same issue. Content nests 3→4→5→6. Cannot enter at 5.');

console.log('\n  --- 1e: Spindle 0.34 (partial walk, first two) ---');
r = bsp(root_block, '0.34');
showSpindle(r);
assert(!hasBroken(r), '0.34: path intact');
assert(getTexts(r).join('') === 'RootCD', '0.34: delivers Root+CD (stops at D)');
assert(r.nodes[0].pscale === 0, '0.34: root = pscale 0');
assert(r.nodes[2].pscale === -2, '0.34: D = pscale -2');
note('Short spindle = broad view. Stops early, labels still correct.');

console.log('\n  --- 1f: Spindle 0.3 (just first digit) ---');
r = bsp(root_block, '0.3');
showSpindle(r);
assert(!hasBroken(r), '0.3: path intact');
assert(getTexts(r).join('') === 'RootC', '0.3: delivers Root+C');

console.log('\n  --- 1g: Point mode — 0.3456 pscale -2 (should be D) ---');
r = bsp(root_block, '0.3456', -2);
showSpindle(r);
assert(r.text === 'D', 'Point -2 on root block: D');

console.log('\n  --- 1h: Point mode — 0.3456 pscale -4 (should be F) ---');
r = bsp(root_block, '0.3456', -4);
showSpindle(r);
assert(r.text === 'F', 'Point -4 on root block: F');

console.log('\n  --- 1i: Spindle "3.456" on ROOT block (decimal mismatch) ---');
r = bsp(root_block, '3.456');
showSpindle(r);
assert(!hasBroken(r), '3.456: path intact (walk digits same: 3,4,5,6)');
note('Walk digits [3,4,5,6] same as 0.3456. Content reached is CDEF.');
note('BUT: labels come from tuning "0.1111" (decimal=0), NOT from spindle "3.456" (decimal=1).');
assert(r.nodes[0].pscale === 0, '3.456 on root block: root STILL pscale 0 (tuning wins)');
assert(r.nodes[1].pscale === -1, '3.456 on root block: C = pscale -1 (tuning wins)');
note('This is the tuning fork doing its job: spindle says decimal=1, tuning says decimal=0.');
note('Tuning wins. Same content, correct labels regardless of spindle format.');


// ================================================================
// PART 2: TREE BLOCK — tuning "1111"
// ================================================================
console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  PART 2: TREE BLOCK — tuning "1111"                        ║');
console.log('║  CDEF at digits 3456, decimal at position 4                ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

const tree_block = { tuning: "1111", tree: CDEF_TREE };

console.log('  --- 2a: Spindle 3456 (whole number, natural for tree blocks) ---');
r = bsp(tree_block, 3456);
showSpindle(r);
assert(!hasBroken(r), '3456: path intact');
assert(getTexts(r).join('') === 'RootCDEF', '3456: delivers Root+CDEF');
assert(r.nodes[0].pscale === 4, '3456: root = pscale 4 (from tuning "1111")');
assert(r.nodes[1].pscale === 3, '3456: C = pscale 3');
assert(r.nodes[2].pscale === 2, '3456: D = pscale 2');
assert(r.nodes[3].pscale === 1, '3456: E = pscale 1');
assert(r.nodes[4].pscale === 0, '3456: F = pscale 0');

console.log('\n  --- 2b: Spindle 0.3456 (delineation on tree block) ---');
r = bsp(tree_block, '0.3456');
showSpindle(r);
assert(!hasBroken(r), '0.3456: path intact (walk digits same)');
note('Walk: strip leading 0, walk [3,4,5,6]. Same content.');
note('Labels: tuning "1111" says decimal=4. Root=pscale 4.');
assert(r.nodes[0].pscale === 4, '0.3456 on tree block: root = pscale 4 (tuning wins over spindle)');
note('Without tuning, 0.3456 would give root=pscale 0. Tuning corrects this.');

console.log('\n  --- 2c: Spindle 34 (partial, two digits) ---');
r = bsp(tree_block, 34);
showSpindle(r);
assert(!hasBroken(r), '34: path intact');
assert(getTexts(r).join('') === 'RootCD', '34: delivers Root+CD');
assert(r.nodes[0].pscale === 4, '34: root = pscale 4');
assert(r.nodes[2].pscale === 2, '34: D = pscale 2');
note('Short spindle gives broad view. Labels from tuning, not spindle length.');

console.log('\n  --- 2d: Point mode — 3456 pscale 2 (should be D) ---');
r = bsp(tree_block, 3456, 2);
showSpindle(r);
assert(r.text === 'D', 'Point pscale 2 on tree block: D');

console.log('\n  --- 2e: Point mode — 3456 pscale 0 (should be F) ---');
r = bsp(tree_block, 3456, 0);
showSpindle(r);
assert(r.text === 'F', 'Point pscale 0 on tree block: F');


// ================================================================
// PART 3: CONTIGUOUS BLOCK — tuning "11.11"
// ================================================================
console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  PART 3: CONTIGUOUS BLOCK — tuning "11.11"                 ║');
console.log('║  CDEF at digits 3456, decimal at position 2                ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

const contiguous_block = { tuning: "11.11", tree: CDEF_TREE };

console.log('  --- 3a: Spindle "34.56" (natural contiguous form) ---');
r = bsp(contiguous_block, '34.56');
showSpindle(r);
assert(!hasBroken(r), '34.56: path intact');
assert(getTexts(r).join('') === 'RootCDEF', '34.56: delivers Root+CDEF');
assert(r.nodes[0].pscale === 2, '34.56: root = pscale 2 (from tuning)');
assert(r.nodes[1].pscale === 1, '34.56: C = pscale 1');
assert(r.nodes[2].pscale === 0, '34.56: D = pscale 0 ← the anchor');
assert(r.nodes[3].pscale === -1, '34.56: E = pscale -1');
assert(r.nodes[4].pscale === -2, '34.56: F = pscale -2');

console.log('\n  --- 3b: Spindle "3.456" (different decimal position) ---');
r = bsp(contiguous_block, '3.456');
showSpindle(r);
assert(!hasBroken(r), '3.456: path intact (walk digits same)');
note('Walk: [3,4,5,6]. Same content reached.');
note('Labels: tuning "11.11" says decimal=2. Tuning wins over spindle "3.456" (decimal=1).');
assert(r.nodes[0].pscale === 2, '3.456 on contiguous: root = pscale 2 (tuning, not 1)');
assert(r.nodes[2].pscale === 0, '3.456 on contiguous: D still pscale 0');

console.log('\n  --- 3c: Spindle "3.45" (partial, three digits) ---');
r = bsp(contiguous_block, '3.45');
showSpindle(r);
assert(!hasBroken(r), '3.45: path intact');
assert(getTexts(r).join('') === 'RootCDE', '3.45: delivers Root+CDE');
assert(r.nodes[0].pscale === 2, '3.45: root = pscale 2');
assert(r.nodes[3].pscale === -1, '3.45: E = pscale -1');
note('Stops at E. Did not reach F. Labels still correct from tuning.');

console.log('\n  --- 3d: Spindle "3.4" (two digits, stops at D) ---');
r = bsp(contiguous_block, '3.4');
showSpindle(r);
assert(!hasBroken(r), '3.4: path intact');
assert(getTexts(r).join('') === 'RootCD', '3.4: delivers Root+CD');
assert(r.nodes[0].pscale === 2, '3.4: root = pscale 2');
assert(r.nodes[2].pscale === 0, '3.4: D = pscale 0');
note('Short spindle on contiguous block: correct labels, partial content.');
note('Tuning does NOT interfere — it only sets the label origin.');

console.log('\n  --- 3e: Point mode — "34.56" pscale 0 (should be D) ---');
r = bsp(contiguous_block, '34.56', 0);
showSpindle(r);
assert(r.text === 'D', 'Point pscale 0 on contiguous: D');

console.log('\n  --- 3f: Point mode — "34.56" pscale -1 (should be E) ---');
r = bsp(contiguous_block, '34.56', -1);
showSpindle(r);
assert(r.text === 'E', 'Point pscale -1 on contiguous: E');


// ================================================================
// PART 4: THE DANGEROUS QUESTION — short spindles + tuning mismatch
// ================================================================
console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  PART 4: DOES TUNING INTERFERE?                            ║');
console.log('║  Short spindles, mismatched formats, edge cases             ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

console.log('  --- 4a: Same walk digits, three different tunings ---');
console.log('  All walk [3,4,5,6] → all reach CDEF. Only labels differ.\n');

const tunings = [
  { tuning: "0.1111", label: "root (0.1111)" },
  { tuning: "1111",   label: "tree (1111)" },
  { tuning: "11.11",  label: "contiguous (11.11)" },
];

tunings.forEach(t => {
  const blk = { tuning: t.tuning, tree: CDEF_TREE };
  const r = bsp(blk, '0.3456');
  const labels = r.nodes.map(n => n.pscale);
  const texts = getTexts(r).join('');
  console.log(`  ${t.label.padEnd(25)} → ${texts}  labels: [${labels.join(', ')}]`);
  assert(texts === 'RootCDEF', `${t.label}: same content regardless of tuning`);
});
note('Content identical. Labels differ. This is correct — tuning describes structure, not content.\n');

console.log('  --- 4b: What happens with NO tuning? ---');
const no_tuning_block = { tree: CDEF_TREE };

console.log('  Spindle 0.3456 (no tuning):');
r = bsp(no_tuning_block, '0.3456');
showSpindle(r);
assert(r.nodes[0].pscale === 0, 'No tuning + 0.3456: root = pscale 0 (from spindle)');

console.log('  Spindle 3456 (no tuning):');
r = bsp(no_tuning_block, 3456);
showSpindle(r);
assert(r.nodes[0].pscale === null, 'No tuning + 3456: no labels (no decimal in spindle, no tuning)');
note('Without tuning, whole-number spindles have no pscale labels. Expected behaviour.');

console.log('\n  --- 4c: Spindle walks MORE digits than tuning capacity ---');
// Tuning says 2 levels ("0.11") but spindle walks 4
const shallow_tuning = { tuning: "0.11", tree: CDEF_TREE };
r = bsp(shallow_tuning, '0.3456');
showSpindle(r);
assert(!hasBroken(r), 'Over-capacity: path still intact (walk is structural, not tuning-limited)');
assert(r.nodes[4].pscale === -4, 'Over-capacity: labels extend past tuning capacity');
warning('Tuning says 2 levels but spindle walked 4. Tuning is stale — block has grown.');
note('BSP does not enforce capacity. It walks what exists. Tuning capacity is advisory.');
note('This is where tuningStale(fork, block) from the spec would flag a problem.');


// ================================================================
// PART 5: GROWTH — rootward (CDEF → CDEFG)
// ================================================================
console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  PART 5: ROOT GROWTH — CDEF → CDEFG                        ║');
console.log('║  New content G added at deeper level. Root-side growth.     ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

const CDEFG_TREE = {
  "_": "Root",
  "3": {
    "_": "C",
    "4": {
      "_": "D",
      "5": {
        "_": "E",
        "6": {
          "_": "F",
          "7": "G"   // NEW — deeper
        }
      }
    }
  }
};

console.log('  Root growth: tree.3.4.5.6 was leaf "F", now has child 7="G".');
console.log('  This is ROOT-SIDE growth (deeper, not broader).\n');

console.log('  --- 5a: Root block "0.1111" → "0.11111" ---');
const root_grown = { tuning: "0.11111", tree: CDEFG_TREE };
r = bsp(root_grown, '0.34567');
showSpindle(r);
assert(!hasBroken(r), 'Root growth: path intact');
assert(getTexts(r).join('') === 'RootCDEFG', 'Root growth: delivers CDEFG');
assert(r.nodes[0].pscale === 0, 'Root growth: root still pscale 0');
assert(r.nodes[5].pscale === -5, 'Root growth: G = pscale -5');

console.log('\n  Old spindle 0.3456 on grown block:');
r = bsp(root_grown, '0.3456');
showSpindle(r);
assert(!hasBroken(r), 'Old spindle still works (root growth is safe)');
assert(getTexts(r).join('') === 'RootCDEF', 'Old spindle: still delivers CDEF (stops before G)');
note('Root growth NEVER breaks old spindles. No updating needed.');
note('Tuning changed 0.1111 → 0.11111 (capacity grew). Labels unaffected — decimal still 0.\n');

console.log('  --- 5b: Tree block "1111" → "11111" ---');
const tree_grown = { tuning: "11111", tree: CDEFG_TREE };
r = bsp(tree_grown, 34567);
showSpindle(r);
assert(!hasBroken(r), 'Tree block root growth: path intact');
assert(r.nodes[0].pscale === 5, 'Tree root growth: root = pscale 5 (was 4)');
assert(r.nodes[5].pscale === 0, 'Tree root growth: G = pscale 0');

console.log('\n  Old spindle 3456 on grown tree block:');
r = bsp(tree_grown, 3456);
showSpindle(r);
assert(!hasBroken(r), 'Old spindle 3456: path intact');
note('Walk digits [3,4,5,6] still valid. Content unchanged.');
assert(r.nodes[0].pscale === 5, 'Old spindle on grown tree: root shifted to pscale 5');
assert(r.nodes[4].pscale === 1, 'Old spindle on grown tree: F shifted from pscale 0 to pscale 1');
warning('F was pscale 0, now pscale 1. LABEL DRIFT — but from root growth on tree block.');
note('This is because tuning "11111" has decimal at 5, not 4.');
note('The semantic MEANING of F changed: it was the finest grain (pscale 0),');
note('now G is finer (pscale 0) and F is pscale 1.');
note('This is CORRECT semantic shift — the block genuinely has more depth now.');

console.log('\n  --- 5c: Contiguous "11.11" → "11.111" (root-side growth) ---');
const cont_root_grown = { tuning: "11.111", tree: CDEFG_TREE };
r = bsp(cont_root_grown, '34.567');
showSpindle(r);
assert(!hasBroken(r), 'Contiguous root growth: path intact');
assert(r.nodes[0].pscale === 2, 'Contiguous root growth: root still pscale 2');
assert(r.nodes[2].pscale === 0, 'Contiguous root growth: D still pscale 0');
assert(r.nodes[5].pscale === -3, 'Contiguous root growth: G = pscale -3');

console.log('\n  Old spindle "34.56" on grown contiguous block:');
r = bsp(cont_root_grown, '34.56');
showSpindle(r);
assert(!hasBroken(r), 'Old contiguous spindle: path intact');
assert(r.nodes[2].pscale === 0, 'D still pscale 0 (root growth does not shift positive side)');
note('Root-side growth on contiguous: old spindles safe. Tuning grew by one root digit.');


// ================================================================
// PART 6: GROWTH — treeward (CDEF → BCDEF)
// ================================================================
console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  PART 6: TREE GROWTH — CDEF → BCDEF                        ║');
console.log('║  New content B wraps existing structure. Tree-side growth.  ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

const BCDEF_TREE = {
  "_": "Root-new",
  "2": {                 // NEW — broader, wraps old content
    "_": "B",
    "3": {               // Old root moved here
      "_": "C",
      "4": {
        "_": "D",
        "5": {
          "_": "E",
          "6": "F"
        }
      }
    }
  }
};

console.log('  Tree growth: old content (3→4→5→6) now lives under new digit 2.');
console.log('  Old tree.3 is now tree.2.3. Structure wrapped.\n');

console.log('  --- 6a: Root block — IMPOSSIBLE. Root blocks grow rootward only. ---');
note('Root blocks (0.x) add depth, never breadth. Tree growth does not apply.\n');

console.log('  --- 6b: Tree block "1111" → "11111" (tree growth) ---');
const tree_tree_grown = { tuning: "11111", tree: BCDEF_TREE };

console.log('  New spindle 23456 on grown block:');
r = bsp(tree_tree_grown, 23456);
showSpindle(r);
assert(!hasBroken(r), 'New spindle 23456: path intact');
assert(getTexts(r).join('') === 'Root-newBCDEF', '23456: delivers Root-new+BCDEF');
assert(r.nodes[0].pscale === 5, 'Tree grown: root = pscale 5');
assert(r.nodes[1].pscale === 4, 'Tree grown: B = pscale 4');
assert(r.nodes[5].pscale === 0, 'Tree grown: F = pscale 0');

console.log('\n  OLD spindle 3456 on grown block:');
r = bsp(tree_tree_grown, 3456);
showSpindle(r);
assert(hasBroken(r), 'OLD spindle 3456: PATH BROKEN — tree[3] no longer exists at root');
note('Content moved from tree[3] to tree[2][3]. Old walk [3,...] hits nothing.');
note('This is the PATH BREAKING problem. Tuning-aware BSP cannot fix this.');
note('Fix: update spindle 3456 → 23456 (prepend the new wrapper digit).\n');

console.log('  --- 6c: Contiguous "11.11" → "111.11" (tree-side growth) ---');
const cont_tree_grown = { tuning: "111.11", tree: BCDEF_TREE };

console.log('  New spindle "234.56" on grown contiguous:');
r = bsp(cont_tree_grown, '234.56');
showSpindle(r);
assert(!hasBroken(r), 'New spindle 234.56: path intact');
assert(r.nodes[0].pscale === 3, 'Contiguous tree growth: root = pscale 3');
assert(r.nodes[1].pscale === 2, 'B = pscale 2');
assert(r.nodes[3].pscale === 0, 'D = pscale 0 (anchor preserved)');
assert(r.nodes[5].pscale === -2, 'F = pscale -2');

console.log('\n  OLD spindle "34.56" on grown contiguous:');
r = bsp(cont_tree_grown, '34.56');
showSpindle(r);
assert(hasBroken(r), 'OLD spindle 34.56: PATH BROKEN — tree[3] moved to tree[2][3]');
note('Tree-side growth on contiguous: old spindles break. Same as tree blocks.');
note('Tuning changed "11.11" → "111.11" (one tree digit gained).');
note('Old spindle "34.56" must become "234.56".\n');


// ================================================================
// PART 7: TUNING CHANGE SUMMARY
// ================================================================
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  PART 7: TUNING CHANGE TABLE                               ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

console.log('  CDEF → CDEFG (rootward growth, adding G deeper):');
console.log('    "0.1111"  → "0.11111"    (root: capacity +1, decimal unchanged)');
console.log('    "1111"    → "11111"       (tree: capacity +1, decimal shifts +1)');
console.log('    "11.11"   → "11.111"      (cont: root capacity +1, decimal unchanged)');
console.log('    Spindles: ALL SAFE. No path breaks. No updating needed.\n');

console.log('  CDEF → BCDEF (treeward growth, adding B broader):');
console.log('    "0.1111"  → N/A           (root blocks cannot grow treeward)');
console.log('    "1111"    → "11111"        (tree: capacity +1, decimal shifts +1)');
console.log('    "11.11"   → "111.11"       (cont: tree capacity +1, decimal shifts +1)');
console.log('    Spindles: BROKEN on tree/contiguous. Must prepend new digit.\n');

console.log('  KEY INSIGHT:');
console.log('    Root growth: tuning gains a digit AFTER decimal → no label shift');
console.log('    Tree growth: tuning gains a digit BEFORE decimal → labels shift');
console.log('    Only tree growth breaks paths. Only tree growth shifts labels.');
console.log('    The asymmetry is structural, not arbitrary.\n');

console.log('  ⚠ SUBTLE CASE (tree block root growth):');
console.log('    Tree "1111" → "11111": decimal moves from 4 to 5.');
console.log('    Old F was pscale 0, now pscale 1. G is new pscale 0.');
console.log('    Path intact, but semantic meaning of pscale levels shifted.');
console.log('    This is CORRECT — the block has genuinely more depth.');
console.log('    But any code that hardcodes "pscale 0 = X" will get the new X.\n');


// ================================================================
// SUMMARY
// ================================================================
console.log('═'.repeat(60));
console.log(`  RESULTS: ${pass} passed, ${fail} failed, ${warn} warnings`);
console.log('═'.repeat(60));
if (fail > 0) {
  console.log('\n  FAILURES DETECTED. Review above.');
  process.exit(1);
}
console.log('\n  DOES TUNING INTERFERE WITH SEMANTIC PULL?');
console.log('  No. Tuning only affects LABELS (pscale numbers).');
console.log('  Walk digits always come from spindle. Content always from tree.');
console.log('  Tuning cannot redirect a walk, block a path, or hide content.');
console.log('  It can only change what pscale number is printed next to each node.');
console.log('');
console.log('  THE REAL DANGER (David\'s concern):');
console.log('  A stale tuning gives WRONG LABELS silently.');
console.log('  BSP returns correct content with incorrect pscale numbers.');
console.log('  Point mode (bsp(block, spindle, pscale)) then extracts the WRONG node.');
console.log('  An LLM receiving wrong pscale labels reasons about the wrong level.');
console.log('  The response looks fine but is semantically displaced.');
console.log('  This is the invisible corruption. Only detectable by:');
console.log('    1. tuningStale() check (compare tuning capacity vs actual depth)');
console.log('    2. LLM noticing content doesn\'t match expected pscale semantics');
console.log('');
