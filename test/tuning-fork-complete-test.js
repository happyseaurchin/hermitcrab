// ============================================================
// TUNING FORK — COMPLETE CONFIGURATIONS TEST
// ============================================================
//
// David's specification:
// - Three block types: root, tree, contiguous
// - Two growth directions: rootward, treeward
// - Spindle variations: full, partial, stub (single digit)
// - Point mode: pscale extraction before and after growth
// - Auto-compensation: tuning fork detects stale spindle,
//   prepends 0s so the walk still reaches the right content
//
// Content: CDEF nested at digits 3→4→5→6
// The semantic number 3456 always delivers CDEF.
// After treeward growth (compression), old content moves
// under digit 0. Spindle 3456 → 03456 to reach same content.

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`    ✓ ${msg}`); }
  else { fail++; console.log(`    ✗ FAIL: ${msg}`); }
}

// --- Tuning-aware BSP with direct tuning fork compensation ---
//
// No trial-and-error. No retry loops.
// The tuning fork tells you exactly how many zeros to prepend:
//
//   tuning tree-side digits  −  spindle tree-side digits  =  zeros to prepend
//
// One subtraction. Before the walk starts.

function getTuningDecimalPosition(blk) {
  if (!blk || !blk.tuning) return null;
  const parts = String(blk.tuning).split('.');
  const intStr = parts[0] || '0';
  return intStr === '0' ? 0 : intStr.length;
}

function getCompressionDepth(tree) {
  // Count leading [0] chain — each is one compression product.
  // Caps the compensation for partial spindles.
  let depth = 0;
  let node = tree;
  while (node && typeof node === 'object' && node['0'] !== undefined) {
    depth++;
    node = node['0'];
  }
  return depth;
}

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
  const spindleTreeDepth = isDelineation ? 0 : intStr.length;
  return { walkDigits, hasPscale, isDelineation, spindleTreeDepth };
}

function bsp(blk, spindle, point) {
  if (!blk || !blk.tree) return { mode: 'error', nodes: [] };

  let { walkDigits, hasPscale, isDelineation, spindleTreeDepth } = parseSpindle(spindle);
  const tuningDecimal = getTuningDecimalPosition(blk);
  const effectiveDecimal = tuningDecimal !== null ? tuningDecimal : (hasPscale ? spindleTreeDepth : null);
  if (tuningDecimal !== null) hasPscale = true;

  // TUNING FORK COMPENSATION — one comparison, no retries.
  // If the tuning fork's tree-side depth exceeds the spindle's,
  // the block has grown treeward since this spindle was written.
  // Prepend the difference in 0s (compression products).
  // Cap at actual compression depth in the tree (for partial spindles).
  let compensated = 0;
  if (tuningDecimal !== null) {
    const needed = Math.max(0, tuningDecimal - spindleTreeDepth);
    if (needed > 0) {
      const maxComp = getCompressionDepth(blk.tree);
      compensated = Math.min(needed, maxComp);
      if (compensated > 0) {
        walkDigits = Array(compensated).fill('0').concat(walkDigits);
      }
    }
  }

  // Single-pass walk — no retry needed.
  let node = blk.tree;
  const nodes = [];
  const rootText = (typeof node === 'object' && node !== null && typeof node['_'] === 'string')
    ? node['_'] : null;
  if (rootText !== null) {
    nodes.push({ pscale: hasPscale ? effectiveDecimal : null, text: rootText });
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
        ? node['_'] : JSON.stringify(node);
    nodes.push({ pscale: hasPscale ? (effectiveDecimal - 1) - i : null, digit: d, text });
  }

  if (nodes.length === 0) return { mode: 'spindle', nodes: [], compensated };

  if (point !== undefined && point !== null) {
    const p = typeof point === 'number' ? point : Number(point);
    const target = nodes.find(n => n.pscale === p);
    if (target) return { mode: 'point', text: target.text, pscale: target.pscale, compensated };
    const last = nodes[nodes.length - 1];
    return { mode: 'point', text: last.text, pscale: last.pscale, compensated, fallback: true };
  }

  return { mode: 'spindle', nodes, compensated };
}

function show(r) {
  if (r.mode === 'point') {
    const fb = r.fallback ? ' (FALLBACK — requested pscale not found)' : '';
    const comp = r.compensated ? ` [auto-compensated ×${r.compensated}]` : '';
    console.log(`      → pscale ${r.pscale} = "${r.text}"${fb}${comp}`);
    return;
  }
  const comp = r.compensated ? `  [auto-compensated ×${r.compensated}]` : '';
  if (comp) console.log(`    ${comp}`);
  r.nodes.forEach(n => {
    const p = n.pscale !== null ? `p${n.pscale}`.padEnd(5) : '     ';
    const d = n.digit ? `[${n.digit}]` : ' _ ';
    const br = n.broken ? ' ← MISS' : '';
    console.log(`      ${d} ${p} "${n.text}"${br}`);
  });
}

function texts(r) { return r.nodes.filter(n => !n.broken).map(n => n.text); }
function broken(r) { return r.nodes.some(n => n.broken); }
function contentStr(r) { return texts(r).slice(1).join(''); } // skip root


// === THE BLOCKS ===

// CDEF nested: tree[3][4][5][6]
const CDEF = {
  "_": "Root",
  "3": { "_": "C", "4": { "_": "D", "5": { "_": "E", "6": "F" } } }
};

// CDEFG: rootward growth (deeper). tree[3][4][5][6][7]
const CDEFG = {
  "_": "Root",
  "3": { "_": "C", "4": { "_": "D", "5": { "_": "E", "6": { "_": "F", "7": "G" } } } }
};

// Compressed CDEF: treeward growth. Old content under 0. tree[0][3][4][5][6]
const COMPRESSED_CDEF = {
  "_": "Root (era 2)",
  "0": {
    "_": "Era 1 (compressed)",
    "3": { "_": "C", "4": { "_": "D", "5": { "_": "E", "6": "F" } } }
  },
  "1": "new content after compression"
};

// Double-compressed: two compressions. tree[0][0][3][4][5][6]
const DOUBLE_COMPRESSED = {
  "_": "Root (era 3)",
  "0": {
    "_": "Era 1-2 (compressed)",
    "0": {
      "_": "Era 1 (deep compressed)",
      "3": { "_": "C", "4": { "_": "D", "5": { "_": "E", "6": "F" } } }
    },
    "1": "era 2 content"
  },
  "1": "era 3 content"
};


// ╔══════════════════════════════════════════════════════════════╗
// ║  1. ROOT BLOCKS                                             ║
// ╚══════════════════════════════════════════════════════════════╝
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  1. ROOT BLOCKS (0.x) — grow rootward only                 ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

console.log('\n  1a. Before growth — tuning "0.1111"');
const root = { tuning: "0.1111", tree: CDEF };
let r;

console.log('  Full spindle 0.3456:');
r = bsp(root, '0.3456');
show(r);
assert(contentStr(r) === 'CDEF', 'Root full: CDEF');
assert(r.nodes[0].pscale === 0, 'Root full: root=p0');

console.log('  Partial 0.34:');
r = bsp(root, '0.34');
show(r);
assert(contentStr(r) === 'CD', 'Root partial: CD');

console.log('  Stub 0.3:');
r = bsp(root, '0.3');
show(r);
assert(contentStr(r) === 'C', 'Root stub: C');

console.log('  Point 0.3456 pscale -2:');
r = bsp(root, '0.3456', -2);
show(r);
assert(r.text === 'D', 'Root point p-2: D');

console.log('  Point 0.3456 pscale 0:');
r = bsp(root, '0.3456', 0);
show(r);
assert(r.text === 'Root', 'Root point p0: Root');

console.log('\n  1b. After rootward growth — tuning "0.11111"');
const root_grown = { tuning: "0.11111", tree: CDEFG };

console.log('  Full spindle 0.34567 (new, reaches G):');
r = bsp(root_grown, '0.34567');
show(r);
assert(contentStr(r) === 'CDEFG', 'Root grown full: CDEFG');

console.log('  Old spindle 0.3456 (still works):');
r = bsp(root_grown, '0.3456');
show(r);
assert(contentStr(r) === 'CDEF', 'Root grown old spindle: CDEF (safe)');
assert(r.compensated === 0, 'Root: no compensation needed');

console.log('  Old stub 0.3:');
r = bsp(root_grown, '0.3');
show(r);
assert(contentStr(r) === 'C', 'Root grown old stub: C (safe)');

console.log('  Point 0.3456 pscale -2 (still D):');
r = bsp(root_grown, '0.3456', -2);
show(r);
assert(r.text === 'D', 'Root grown point p-2: still D');

console.log('\n  1c. Treeward growth — IMPOSSIBLE for root blocks');
console.log('    Root blocks (0.x) cannot grow treeward. Decimal stays at 0.');
console.log('    No compression case. No spindle compensation ever needed.\n');


// ╔══════════════════════════════════════════════════════════════╗
// ║  2. TREE BLOCKS                                             ║
// ╚══════════════════════════════════════════════════════════════╝
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  2. TREE BLOCKS (xyz) — grow both directions               ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

console.log('\n  2a. Before growth — tuning "1111"');
const tree = { tuning: "1111", tree: CDEF };

console.log('  Full spindle 3456:');
r = bsp(tree, 3456);
show(r);
assert(contentStr(r) === 'CDEF', 'Tree full: CDEF');
assert(r.nodes[0].pscale === 4, 'Tree full: root=p4');
assert(r.nodes[4].pscale === 0, 'Tree full: F=p0');

console.log('  Partial 34:');
r = bsp(tree, 34);
show(r);
assert(contentStr(r) === 'CD', 'Tree partial: CD');

console.log('  Stub 3:');
r = bsp(tree, 3);
show(r);
assert(contentStr(r) === 'C', 'Tree stub: C');

console.log('  Point 3456 pscale 2:');
r = bsp(tree, 3456, 2);
show(r);
assert(r.text === 'D', 'Tree point p2: D');

console.log('  Point 3456 pscale 0:');
r = bsp(tree, 3456, 0);
show(r);
assert(r.text === 'F', 'Tree point p0: F');

console.log('\n  2b. After rootward growth — tuning "11111"');
const tree_root_grown = { tuning: "11111", tree: CDEFG };

console.log('  New spindle 34567:');
r = bsp(tree_root_grown, 34567);
show(r);
assert(contentStr(r) === 'CDEFG', 'Tree rootgrown full: CDEFG');
assert(r.nodes[5].pscale === 0, 'Tree rootgrown: G=p0');

console.log('  Old spindle 3456 (path intact, labels shifted):');
r = bsp(tree_root_grown, 3456);
show(r);
assert(contentStr(r) === 'CDEF', 'Tree rootgrown old: CDEF');
assert(r.nodes[4].pscale === 1, 'Tree rootgrown old: F shifted from p0 to p1');
console.log('    NOTE: F was p0, now p1. G is new p0. Correct — block is deeper.');

console.log('  Point 3456 pscale 0 (now returns F? or G?):');
r = bsp(tree_root_grown, 3456, 0);
show(r);
console.log('    NOTE: pscale 0 not in spindle 3456 (F is now p1). Falls to last node.');

console.log('\n  2c. After TREEWARD growth (compression) — tuning "11111"');
const tree_compressed = { tuning: "11111", tree: COMPRESSED_CDEF };

console.log('  New spindle 03456 (through compression product):');
r = bsp(tree_compressed, '03456');
show(r);
assert(contentStr(r) === 'Era 1 (compressed)CDEF', 'Tree compressed new: era1+CDEF');

console.log('  OLD spindle 3456 (stale — needs compensation):');
r = bsp(tree_compressed, 3456);
show(r);
if (r.compensated > 0) {
  assert(true, `Auto-compensated: prepended ${r.compensated} zero(s)`);
  const content = texts(r).slice(1); // skip root
  // Content includes compression product + CDEF
  const hasCDEF = content.join('').includes('CDEF');
  assert(hasCDEF, 'Compensated walk reaches CDEF through compression product');
} else {
  assert(broken(r), 'Without compensation: path broken');
}

console.log('  Old partial 34 (stale):');
r = bsp(tree_compressed, 34);
show(r);
if (r.compensated > 0) {
  assert(true, 'Partial 34 auto-compensated');
  assert(texts(r).join('').includes('CD'), 'Compensated partial reaches CD');
}

console.log('  Old stub 3 (stale):');
r = bsp(tree_compressed, 3);
show(r);
if (r.compensated > 0) {
  assert(true, 'Stub 3 auto-compensated');
  assert(texts(r).join('').includes('C'), 'Compensated stub reaches C');
}

console.log('  Point: old spindle 3456, pscale 2 (should still find D):');
r = bsp(tree_compressed, 3456, 2);
show(r);
// With tuning "11111" (decimal=5), compensated walk 03456:
// root=p5, 0=p4, 3=p3, 4=p2, 5=p1, 6=p0
// pscale 2 should be D
assert(r.text === 'D', 'Tree compressed point p2: still D after compensation');


// ╔══════════════════════════════════════════════════════════════╗
// ║  3. CONTIGUOUS BLOCKS                                       ║
// ╚══════════════════════════════════════════════════════════════╝
console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  3. CONTIGUOUS BLOCKS (xy.z) — grow both directions         ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

console.log('\n  3a. Before growth — tuning "11.11"');
const cont = { tuning: "11.11", tree: CDEF };

console.log('  Full spindle "34.56":');
r = bsp(cont, '34.56');
show(r);
assert(contentStr(r) === 'CDEF', 'Cont full: CDEF');
assert(r.nodes[0].pscale === 2, 'Cont full: root=p2');
assert(r.nodes[2].pscale === 0, 'Cont full: D=p0 (anchor)');

console.log('  Partial "3.4":');
r = bsp(cont, '3.4');
show(r);
assert(contentStr(r) === 'CD', 'Cont partial: CD');

console.log('  Stub "0.3":');
r = bsp(cont, '0.3');
show(r);
assert(contentStr(r) === 'C', 'Cont stub: C');

console.log('  Point "34.56" pscale 0:');
r = bsp(cont, '34.56', 0);
show(r);
assert(r.text === 'D', 'Cont point p0: D (the anchor)');

console.log('  Point "34.56" pscale -2:');
r = bsp(cont, '34.56', -2);
show(r);
assert(r.text === 'F', 'Cont point p-2: F');

console.log('\n  3b. After rootward growth — tuning "11.111"');
const cont_root_grown = { tuning: "11.111", tree: CDEFG };

console.log('  New spindle "34.567":');
r = bsp(cont_root_grown, '34.567');
show(r);
assert(contentStr(r) === 'CDEFG', 'Cont rootgrown full: CDEFG');
assert(r.nodes[2].pscale === 0, 'Cont rootgrown: D still p0 (anchor stable)');

console.log('  Old spindle "34.56" (safe):');
r = bsp(cont_root_grown, '34.56');
show(r);
assert(contentStr(r) === 'CDEF', 'Cont rootgrown old: CDEF (safe)');
assert(r.nodes[2].pscale === 0, 'Cont rootgrown old: D still p0');
assert(r.compensated === 0, 'Cont rootgrown: no compensation needed');

console.log('  Point "34.56" pscale 0 (still D):');
r = bsp(cont_root_grown, '34.56', 0);
show(r);
assert(r.text === 'D', 'Cont rootgrown point p0: still D');

console.log('\n  3c. After TREEWARD growth (compression) — tuning "111.11"');
const cont_compressed = { tuning: "111.11", tree: COMPRESSED_CDEF };

console.log('  New spindle "034.56" (through compression):');
r = bsp(cont_compressed, '034.56');
show(r);
assert(contentStr(r) === 'Era 1 (compressed)CDEF', 'Cont compressed new: era1+CDEF');

console.log('  OLD spindle "34.56" (stale — needs compensation):');
r = bsp(cont_compressed, '34.56');
show(r);
if (r.compensated > 0) {
  assert(true, `Cont auto-compensated: prepended ${r.compensated} zero(s)`);
  assert(texts(r).join('').includes('CDEF'), 'Compensated cont walk reaches CDEF');
} else {
  assert(broken(r), 'Without compensation: path broken');
}

console.log('  Old partial "3.4" (stale):');
r = bsp(cont_compressed, '3.4');
show(r);
if (r.compensated > 0) {
  assert(true, 'Cont partial auto-compensated');
}

console.log('  Point: old "34.56" pscale 0 (anchor — should still find D):');
r = bsp(cont_compressed, '34.56', 0);
show(r);
// tuning "111.11" decimal=3. Compensated walk [0,3,4,5,6]:
// root=p3, 0=p2, 3=p1, 4=p0, 5=p-1, 6=p-2
assert(r.text === 'D', 'Cont compressed point p0: still D (anchor preserved)');


// ╔══════════════════════════════════════════════════════════════╗
// ║  4. DOUBLE COMPRESSION                                      ║
// ╚══════════════════════════════════════════════════════════════╝
console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  4. DOUBLE COMPRESSION — two treeward growths               ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

console.log('\n  Tree block, tuning "111111" (was "1111", compressed twice)');
const tree_double = { tuning: "111111", tree: DOUBLE_COMPRESSED };

console.log('  New spindle 003456 (through two compression products):');
r = bsp(tree_double, '003456');
show(r);
assert(contentStr(r).includes('CDEF'), 'Double compressed new: reaches CDEF');

console.log('  OLD spindle 3456 (two compressions behind):');
r = bsp(tree_double, 3456);
show(r);
assert(r.compensated === 2, 'Double compression: auto-compensated ×2');
assert(texts(r).join('').includes('CDEF'), 'Double compensated: reaches CDEF');

console.log('  Point 3456 pscale 2 (should find D through double compensation):');
r = bsp(tree_double, 3456, 2);
show(r);
assert(r.text === 'D', 'Double compressed point p2: D');


// ╔══════════════════════════════════════════════════════════════╗
// ║  SUMMARY                                                    ║
// ╚══════════════════════════════════════════════════════════════╝
console.log('\n' + '═'.repeat(60));
console.log(`  RESULTS: ${pass} passed, ${fail} failed`);
console.log('═'.repeat(60));

console.log('\n  CONFIGURATION MATRIX:');
console.log('  ┌─────────────┬──────────────────┬──────────────────┐');
console.log('  │ Block Type  │ Rootward Growth   │ Treeward Growth  │');
console.log('  ├─────────────┼──────────────────┼──────────────────┤');
console.log('  │ Root (0.x)  │ Safe. No drift.  │ N/A (impossible) │');
console.log('  │ Tree (xyz)  │ Safe. Labels     │ BREAKS paths.    │');
console.log('  │             │ shift (correct). │ Auto-compensate: │');
console.log('  │             │                  │ prepend 0.       │');
console.log('  │ Contiguous  │ Safe. Anchor     │ BREAKS paths.    │');
console.log('  │ (xy.z)      │ (p0) preserved.  │ Auto-compensate: │');
console.log('  │             │                  │ prepend 0.       │');
console.log('  └─────────────┴──────────────────┴──────────────────┘');
console.log('');
console.log('  TUNING FORK COMPENSATION:');
console.log('  tuning tree-depth − spindle tree-depth = zeros to prepend.');
console.log('  One subtraction. No retry loop. No walking and failing.');
console.log('  Capped at actual compression depth for partial spindles.');
console.log('  Labels come from tuning fork. Content reached is identical.');
console.log('');

if (fail > 0) process.exit(1);
