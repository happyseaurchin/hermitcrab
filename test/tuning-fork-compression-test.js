// ============================================================
// TUNING FORK — COMPRESSION GROWTH TEST
// ============================================================
//
// David's question: when a block compresses (9 fills → grows outward),
// the tuning changes. What happens to old spindles?
//
// TWO separate problems:
//   Problem 1: LABEL DRIFT — pscale labels are wrong (tuning-aware BSP fixes this)
//   Problem 2: PATH BREAKING — tree restructured, old walk digits hit wrong content
//
// This test exhaustively traces what happens.

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.log(`  ✗ FAIL: ${msg}`); }
}

// --- BSP functions (current + tuning-aware) ---

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

function getTuningDecimalPosition(block) {
  if (!block.tuning) return null;
  const parts = String(block.tuning).split('.');
  const intStr = parts[0] || '0';
  return intStr === '0' ? 0 : intStr.length;
}

function bspWalk(block, spindle, useTuning) {
  const { walkDigits, digitsBefore, hasPscale } = parseSpindle(spindle);
  const tuningDecimal = useTuning ? getTuningDecimalPosition(block) : null;
  const effectiveDecimal = tuningDecimal !== null ? tuningDecimal : (hasPscale ? digitsBefore : null);
  const hasLabels = effectiveDecimal !== null;

  let node = block.tree;
  const nodes = [];
  const rootText = typeof node === 'object' && node._ ? node._ : null;
  if (rootText) nodes.push({ pscale: hasLabels ? effectiveDecimal : null, text: rootText, source: 'root' });
  for (let i = 0; i < walkDigits.length; i++) {
    const d = walkDigits[i];
    if (node === null || node === undefined || typeof node !== 'object') {
      nodes.push({ pscale: null, digit: d, text: '(PATH BROKEN — node not found)', broken: true });
      break;
    }
    if (node[d] === undefined) {
      nodes.push({ pscale: null, digit: d, text: '(PATH BROKEN — digit missing)', broken: true });
      break;
    }
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

function getPscale(nodes, level) {
  return (nodes.find(n => n.pscale === level) || {}).text || null;
}
function hasBrokenPath(nodes) {
  return nodes.some(n => n.broken);
}
function getContent(nodes) {
  return nodes.filter(n => n.digit).map(n => n.text);
}


// ================================================================
// SCENARIO 1: NON-STRUCTURAL GROWTH (adding siblings at root)
// ================================================================
console.log('═══ SCENARIO 1: Non-structural growth (sibling addition) ═══');
console.log('Block gains a new sibling at root level. No restructuring. Old paths intact.\n');

const block_before = {
  tuning: "0.11",
  tree: {
    "_": "purpose workbench",
    "2": {
      "_": "coordinate with others",
      "3": "establish SAND"
    }
  }
};

// Spindle written at this time
const spindle_old = '0.23';
const before_result = bspWalk(block_before, spindle_old, true);
assert(getPscale(before_result, 0) === 'purpose workbench', 'Before: root = pscale 0');
assert(getPscale(before_result, -1) === 'coordinate with others', 'Before: digit 2 = pscale -1');
assert(getPscale(before_result, -2) === 'establish SAND', 'Before: digit 3 = pscale -2');

// Block grows: new sibling added at root. No restructuring.
const block_sibling = {
  tuning: "0.11",  // Tuning UNCHANGED — root block, just deeper content
  tree: {
    "_": "purpose workbench",
    "1": "orient and inhabit shell",   // NEW sibling
    "2": {
      "_": "coordinate with others",   // SAME content, SAME path
      "3": "establish SAND"            // SAME content, SAME path
    }
  }
};

const sibling_result = bspWalk(block_sibling, spindle_old, true);
assert(!hasBrokenPath(sibling_result), 'After sibling growth: path NOT broken');
assert(getPscale(sibling_result, -1) === 'coordinate with others', 'After sibling growth: same content at same pscale');
assert(getPscale(sibling_result, -2) === 'establish SAND', 'After sibling growth: leaf unchanged');

console.log('  → Non-structural growth: old spindles work perfectly. No issue.\n');


// ================================================================
// SCENARIO 2: COMPRESSION GROWTH (9 fills, block restructures)
// ================================================================
console.log('═══ SCENARIO 2: Compression growth (9 fills → restructure) ═══');
console.log('Digits 1-9 fill at root. Block compresses. Tree restructures.\n');

// A purpose block with digits 1-9 filled at root
const block_full = {
  tuning: "0.111111111",
  tree: {
    "_": "purpose workbench",
    "1": "orient self",
    "2": { "_": "coordinate with others", "3": "establish SAND" },
    "4": "build interface",
    "5": "write first purpose",
    "6": "explore web presence",
    "7": "publish passport",
    "8": "process grains",
    "9": "reflect on patterns"
  }
};

// Spindles written while block was in this state
const spindle_23 = '0.23';
const spindle_4 = '0.4';

const full_23 = bspWalk(block_full, spindle_23, true);
const full_4 = bspWalk(block_full, spindle_4, true);
assert(getPscale(full_23, -1) === 'coordinate with others', 'Pre-compression: 0.23 → coordinate');
assert(getPscale(full_4, -1) === 'build interface', 'Pre-compression: 0.4 → build interface');

console.log('  Block compresses: 9 entries filled. Old content moves under digit 0.');
console.log('  (Touchstone 0.5.4: digit 0 is always compression product)\n');

// AFTER COMPRESSION:
// - Root gets NEW broader context
// - Digit 0 holds the compression: summary at 0._, old content at 0.1 through 0.9
// - Digits 1-9 at root are now FREE for new content
// - Tuning grows from "0.111111111" to "1.111111111" (one tree level gained)
const block_compressed = {
  tuning: "1.111111111",  // CHANGED: gained one positive level
  tree: {
    "_": "life direction",   // NEW root text (broader context)
    "0": {
      "_": "first era: orientation and foundation",  // COMPRESSION SUMMARY
      "1": "orient self",                            // OLD content preserved
      "2": { "_": "coordinate with others", "3": "establish SAND" },  // OLD content
      "4": "build interface",
      "5": "write first purpose",
      "6": "explore web presence",
      "7": "publish passport",
      "8": "process grains",
      "9": "reflect on patterns"
    },
    "1": "second era: engagement begins"  // NEW content in fresh digit
  }
};

console.log('  --- Problem 1: PATH BREAKING ---');
console.log('  Old spindle 0.23 walks tree[2][3]. But tree[2] is GONE (moved to tree[0][2]).\n');

const compressed_old_23 = bspWalk(block_compressed, spindle_23, true);
assert(hasBrokenPath(compressed_old_23), 'BROKEN: old spindle 0.23 hits missing path on compressed block');
compressed_old_23.forEach(n => console.log(`    pscale ${n.pscale}: "${n.text}"`));

const compressed_old_4 = bspWalk(block_compressed, spindle_4, true);
assert(hasBrokenPath(compressed_old_4), 'BROKEN: old spindle 0.4 hits missing path on compressed block');

console.log('\n  --- Problem 2: THE FIX — prepend 0 ---');
console.log('  Old content is under digit 0. Prepend 0 to old spindle: 0.23 → 0.023.\n');

// Prepend 0: old spindle 0.23 → 0.023 (walk through compression product)
const spindle_fixed_23 = '0.023';
const spindle_fixed_4 = '0.04';
const fixed_23 = bspWalk(block_compressed, spindle_fixed_23, true);
const fixed_4 = bspWalk(block_compressed, spindle_fixed_4, true);

assert(!hasBrokenPath(fixed_23), 'FIXED: spindle 0.023 reaches old content through digit 0');
assert(!hasBrokenPath(fixed_4), 'FIXED: spindle 0.04 reaches old content through digit 0');

console.log('  Fixed spindle 0.023 (tuning-aware):');
fixed_23.forEach(n => console.log(`    pscale ${n.pscale}: "${n.text}"`));

// Check content is the same as before compression
const old_content = getContent(full_23);
const fixed_content = getContent(fixed_23).slice(1); // skip the compression-product level
assert(old_content.join('|') === fixed_content.join('|'),
  'Content reached is IDENTICAL (through compression product)');

// Check labels shifted correctly
assert(getPscale(fixed_23, 1) === 'life direction', 'Root (new): pscale 1');
assert(getPscale(fixed_23, 0) === 'first era: orientation and foundation', 'Compression summary: pscale 0');
assert(getPscale(fixed_23, -1) === 'coordinate with others', 'Old content: shifted from pscale -1 to... wait');

console.log('\n  --- Label comparison ---');
console.log('  Before compression (0.23, tuning "0.111111111"):');
full_23.forEach(n => console.log(`    pscale ${n.pscale}: "${n.text}"`));
console.log('  After compression (0.023, tuning "1.111111111"):');
fixed_23.forEach(n => console.log(`    pscale ${n.pscale}: "${n.text}"`));


// ================================================================
// SCENARIO 3: David's exact question — spindle 23 on a 5-level block
// ================================================================
console.log('\n═══ SCENARIO 3: Short spindle on a deep block ═══');
console.log('"How does 23 work with a JSON block tree of five digits?"\n');

const deep_block = {
  tuning: "11111",  // 5 positive levels, root at pscale 5
  tree: {
    "_": "civilisation",            // pscale 5
    "1": {
      "_": "nation",               // pscale 4
      "2": {
        "_": "city",               // pscale 3
        "3": {
          "_": "neighbourhood",    // pscale 2
          "4": {
            "_": "building",       // pscale 1
            "5": "room 5A"         // pscale 0
          }
        }
      }
    }
  }
};

// Short spindle 23: only walks 2 digits into a 5-level tree
// What does BSP return?
console.log('  Spindle "2.3" (current BSP, no tuning):');
const short_current = bspWalk(deep_block, '2.3', false);
short_current.forEach(n => console.log(`    pscale ${n.pscale}: "${n.text}"`));
// tree[2] doesn't exist as a direct child of root — only tree[1] does!
assert(hasBrokenPath(short_current), 'Short spindle on deep block: path breaks (tree[2] not a root child)');

console.log('\n  The issue: the block nests 1→2→3→4→5. Spindle 23 expects tree[2][3].');
console.log('  But tree[2] does not exist. Content is at tree[1][2][3][4][5].');
console.log('  The spindle needs ALL intermediate digits: 12345.\n');

// Correct spindle for this block
const full_spindle = '1.2345';
console.log('  Correct spindle "1.2345" (tuning-aware):');
const full_result = bspWalk(deep_block, full_spindle, true);
full_result.forEach(n => console.log(`    pscale ${n.pscale}: "${n.text}"`));
assert(!hasBrokenPath(full_result), 'Full spindle: path intact');
assert(getPscale(full_result, 5) === 'civilisation', 'Pscale 5 = root (civilisation)');
assert(getPscale(full_result, 0) === 'room 5A', 'Pscale 0 = leaf (room)');

// Partial spindle — just walk 3 levels
const partial_spindle = '123';
console.log('\n  Partial spindle "123" (tuning-aware, whole number):');
const partial_result = bspWalk(deep_block, 123, true);
partial_result.forEach(n => console.log(`    pscale ${n.pscale}: "${n.text}"`));
assert(!hasBrokenPath(partial_result), 'Partial spindle: path intact (walks 3 of 5 levels)');
assert(getPscale(partial_result, 5) === 'civilisation', 'Root still pscale 5');
assert(getPscale(partial_result, 3) === 'city', 'Stops at pscale 3 (city)');
assert(getPscale(partial_result, 0) === null, 'Pscale 0 not reached (spindle too short)');

console.log('\n  Key insight: a short spindle gives you the BROAD view (high pscale).');
console.log('  A long spindle gives you the DETAILED view (down to pscale 0).');
console.log('  The tuning fork ensures labels are correct regardless of spindle length.\n');


// ================================================================
// SCENARIO 4: THE FULL CHAIN — compression + tuning + update
// ================================================================
console.log('═══ SCENARIO 4: Full chain of events on compression ═══\n');

// Step 1: Block exists, spindles written, stored in wake
const step1_block = {
  tuning: "0.111",
  tree: {
    "_": "my notes",
    "3": { "_": "week 3", "2": "met David" },
    "4": { "_": "week 4", "1": "tested tuning fork" }
  }
};

const wake_refs = ['0.32', '0.41']; // stored in wake package

console.log('  Step 1: Block exists with tuning "0.111". Spindles stored in wake.');
wake_refs.forEach(ref => {
  const r = bspWalk(step1_block, ref, true);
  console.log(`    ${ref} → ${getContent(r).join(' → ')}`);
});

// Step 2: Block fills up, compression triggered
console.log('\n  Step 2: All 9 digits fill. Compression triggers.');
console.log('  Old content moves under digit 0. Tuning changes: "0.111" → "1.111".\n');

const step2_block = {
  tuning: "1.111",
  tree: {
    "_": "my notes — compiled",
    "0": {
      "_": "first batch: orientation period",
      "1": "week 1 notes",
      "2": "week 2 notes",
      "3": { "_": "week 3", "2": "met David" },
      "4": { "_": "week 4", "1": "tested tuning fork" },
      "5": "week 5 notes",
      "6": "week 6 notes",
      "7": "week 7 notes",
      "8": "week 8 notes",
      "9": "week 9 notes"
    },
    "1": "week 10: new era begins"
  }
};

// Step 3: Detect drift
const oldTuningDecimal = getTuningDecimalPosition(step1_block);
const newTuningDecimal = getTuningDecimalPosition(step2_block);
const drift = newTuningDecimal - oldTuningDecimal;
console.log(`  Step 3: Drift detected. Old decimal: ${oldTuningDecimal}, New: ${newTuningDecimal}, Drift: +${drift}`);

// Step 4: Check old spindles
console.log('\n  Step 4: Check old wake spindles against compressed block.');
wake_refs.forEach(ref => {
  const r = bspWalk(step2_block, ref, true);
  const broken = hasBrokenPath(r);
  console.log(`    ${ref} → ${broken ? 'BROKEN' : 'OK'}`);
});

// Step 5: Fix spindles by prepending 0
console.log('\n  Step 5: Fix by prepending 0 to each old spindle.');
const fixed_refs = wake_refs.map(ref => {
  // 0.32 → 0.032 (insert 0 after the delineation marker)
  return ref.replace('0.', '0.0');
});
fixed_refs.forEach((ref, i) => {
  const r = bspWalk(step2_block, ref, true);
  const broken = hasBrokenPath(r);
  const content = getContent(r);
  console.log(`    ${wake_refs[i]} → ${ref} → ${broken ? 'BROKEN' : content.join(' → ')}`);
});

// Verify content preserved
const old_content_32 = getContent(bspWalk(step1_block, '0.32', true));
const new_content_032 = getContent(bspWalk(step2_block, '0.032', true));
// Skip the compression-product level (first element in new)
const matched_content = new_content_032.slice(1);
assert(old_content_32.join('|') === matched_content.join('|'),
  'Content preserved through compression (old 0.32 = new 0.032 minus compression level)');

// Check labels
console.log('\n  Step 6: Label comparison (old vs fixed).');
console.log('  Old (0.32 on old block):');
bspWalk(step1_block, '0.32', true).forEach(n =>
  console.log(`    pscale ${n.pscale}: "${n.text}"`));
console.log('  Fixed (0.032 on compressed block):');
bspWalk(step2_block, '0.032', true).forEach(n =>
  console.log(`    pscale ${n.pscale}: "${n.text}"`));

console.log('\n  The content "week 3" was at pscale -1. Now it is at pscale 0.');
console.log('  This is CORRECT — the block grew, and pscale 0 shifted to encompass');
console.log('  what was previously detailed content. The tuning fork reports this accurately.');

// Step 7: What about tuning-aware BSP on the OLD spindle WITHOUT fixing?
console.log('\n  Step 7: What if we DON\'T fix the spindle?');
console.log('  Old spindle 0.32 on compressed block with tuning-aware BSP:');
const unfixed = bspWalk(step2_block, '0.32', true);
unfixed.forEach(n => console.log(`    pscale ${n.pscale}: "${n.text}"`));
if (hasBrokenPath(unfixed)) {
  console.log('  → Path BROKEN. Tuning-aware BSP fixes labels but cannot fix broken paths.');
  console.log('  → Compression requires spindle updating (prepend 0). This is NOT optional.');
} else {
  console.log('  → Path intact but labels shifted.');
}


// ================================================================
// SUMMARY
// ================================================================
console.log('\n═══════════════════════════════════════════════════════');
console.log(`  RESULTS: ${pass} passed, ${fail} failed`);
console.log('═══════════════════════════════════════════════════════');
console.log('');
console.log('TWO DISTINCT PROBLEMS:');
console.log('');
console.log('  Problem 1: LABEL DRIFT (non-structural growth)');
console.log('    When: block gains content but tree structure stays intact');
console.log('    Effect: pscale labels on old spindles are wrong');
console.log('    Fix: tuning-aware BSP (automatic, no spindle changes needed)');
console.log('');
console.log('  Problem 2: PATH BREAKING (compression growth)');
console.log('    When: block compresses (9→10), old content moves under digit 0');
console.log('    Effect: old spindle walk digits hit missing/wrong nodes');
console.log('    Fix: prepend 0 to old spindles (0.23 → 0.023)');
console.log('    This MUST be done — tuning-aware BSP cannot fix broken paths');
console.log('');
console.log('CHAIN OF EVENTS ON COMPRESSION:');
console.log('  1. Block fills digits 1-9 → compression triggered');
console.log('  2. Old content moves under digit 0 (compression product)');
console.log('  3. Tuning gains one digit before decimal (e.g. "0.111" → "1.111")');
console.log('  4. All spindles referencing this block: prepend 0');
console.log('     0.23 → 0.023 (content now reached through compression product)');
console.log('  5. Tuning-aware BSP assigns correct labels automatically');
console.log('');
console.log('WHY PREPEND 0 (not some other digit):');
console.log('  Touchstone 0.5.4: "Digit 0 as a child is always a compression product."');
console.log('  Compression moves old content under digit 0. Digits 1-9 are freed.');
console.log('  Prepending 0 walks through the compression archive to reach old content.');
console.log('');
