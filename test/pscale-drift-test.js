// Test: pscale labeling drift when block depth changes
// Demonstrates: same tree path, different decimal conventions → different pscale labels
// Question: does block growth break old spindles?

// Replicate the kernel's spindle parser (kernel.js lines 165-183)
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

// Replicate bsp walk + point mode
function bspWalk(block, spindle) {
  const { walkDigits, digitsBefore, hasPscale } = parseSpindle(spindle);
  let node = block.tree;
  const nodes = [];

  const rootText = typeof node === 'object' && node._ ? node._ : null;
  if (rootText) nodes.push({ pscale: hasPscale ? digitsBefore : null, text: rootText, label: 'root' });

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

function bspPoint(block, spindle, targetPscale) {
  const nodes = bspWalk(block, spindle);
  const target = nodes.find(n => n.pscale === targetPscale);
  return target ? target.text : '(not found)';
}

// ─── THE BLOCK ───
// A purpose block with 4 levels of content
const block = {
  tree: {
    "_": "Purpose workbench",
    "2": {
      "_": "coordinate with others",
      "3": {
        "_": "establish SAND protocol",
        "4": {
          "_": "publish passport",
          "1": "write passport JSON"
        }
      }
    }
  }
};

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.log(`  ✗ ${msg}`); }
}

// ─── TEST 1: Same tree path, different decimal positions ───
console.log('\n=== TEST 1: Decimal position does not affect tree walk ===');
const addresses = ['23.41', '234.1', '2341'];
const digitArrays = addresses.map(a => parseSpindle(a).walkDigits.join(','));
assert(digitArrays[0] === digitArrays[1], `23.41 and 234.1 produce same digits [${digitArrays[0]}]`);
assert(digitArrays[0] === digitArrays[2], `23.41 and 2341 produce same digits [${digitArrays[0]}]`);

// But delineation (0.x) is different
const delin = parseSpindle('0.2341');
assert(delin.walkDigits.join(',') === '2,3,4,1', `0.2341 walks [${delin.walkDigits}] (same path, no leading 0)`);

// ─── TEST 2: Same path, different pscale labels ───
console.log('\n=== TEST 2: Different decimal → different pscale labels ===');
const labels1 = bspWalk(block, '23.41').filter(n => n.digit).map(n => `${n.text}(${n.pscale})`);
const labels2 = bspWalk(block, '234.1').filter(n => n.digit).map(n => `${n.text}(${n.pscale})`);
console.log(`  23.41: ${labels1.join(' → ')}`);
console.log(`  234.1: ${labels2.join(' → ')}`);
assert(labels1[0].includes('(1)') && labels2[0].includes('(2)'),
  'Same content "coordinate" labeled pscale 1 vs pscale 2');
assert(labels1[1].includes('(0)') && labels2[1].includes('(1)'),
  'Same content "SAND" labeled pscale 0 vs pscale 1');

// ─── TEST 3: Point mode returns different content for same pscale ───
console.log('\n=== TEST 3: Point mode — "give me pscale 0" ===');
const p0_old = bspPoint(block, '23.41', 0);
const p0_new = bspPoint(block, '234.1', 0);
console.log(`  Spindle 23.41, pscale 0: "${p0_old}"`);
console.log(`  Spindle 234.1, pscale 0: "${p0_new}"`);
assert(p0_old === 'establish SAND protocol', 'Old convention: pscale 0 = SAND');
assert(p0_new === 'publish passport', 'New convention: pscale 0 = passport');
assert(p0_old !== p0_new, 'DIFFERENT content for same pscale query — this is the drift');

// ─── TEST 4: The growth scenario ───
console.log('\n=== TEST 4: Growth scenario ===');
console.log('  Time 1: 3 objective levels, convention xx.xx (tuning 111.111)');
console.log('  Time 2: LLM adds broader purpose, now 4 levels, convention xxx.x');
console.log('');

// Spindle 23.41 was written at Time 1 and stored in wake
// At Time 2 the block has grown but the wake instruction still says "purpose 23.41"
const staleResult = bspPoint(block, '23.41', 0);
const freshResult = bspPoint(block, '234.1', 0);
assert(staleResult !== freshResult,
  `Stale spindle gives "${staleResult}" at pscale 0, fresh gives "${freshResult}" — drift confirmed`);

// The tree WALK is identical — same content reached
const staleNodes = bspWalk(block, '23.41').filter(n => n.digit).map(n => n.text);
const freshNodes = bspWalk(block, '234.1').filter(n => n.digit).map(n => n.text);
assert(staleNodes.join('|') === freshNodes.join('|'),
  'But full spindle chains are identical — only labels differ');

// ─── TEST 5: Whole number — no pscale at all ───
console.log('\n=== TEST 5: Whole number spindle (no decimal) ===');
const wholeNodes = bspWalk(block, 2341);
const wholePscales = wholeNodes.map(n => n.pscale);
assert(wholePscales.every(p => p === null), 'No pscale labels — pure navigation');
const wholeTexts = wholeNodes.filter(n => n.digit).map(n => n.text);
assert(wholeTexts.join('|') === staleNodes.join('|'), 'Same content as decimal spindles');

// ─── TEST 6: Does place fix the drift? ───
console.log('\n=== TEST 6: Place-based pscale (alternative) ===');
function bspWithPlace(block, spindle, place) {
  const { walkDigits } = parseSpindle(spindle);
  let node = block.tree;
  const nodes = [];
  const rootText = node._ || null;
  if (rootText) nodes.push({ pscale: place, text: rootText });

  for (let i = 0; i < walkDigits.length; i++) {
    const d = walkDigits[i];
    if (!node || typeof node !== 'object' || node[d] === undefined) break;
    node = node[d];
    const text = typeof node === 'string' ? node : (node._ || JSON.stringify(node));
    nodes.push({ pscale: (place - 1) - i, digit: d, text });
  }
  return nodes;
}

// With place=3 (Time 1 convention)
const place3 = bspWithPlace(block, '23.41', 3);
const place3labels = place3.filter(n => n.digit).map(n => `${n.text}(${n.pscale})`);
console.log(`  place=3, spindle 23.41: ${place3labels.join(' → ')}`);

// With place=4 (Time 2 convention)
const place4 = bspWithPlace(block, '23.41', 4);
const place4labels = place4.filter(n => n.digit).map(n => `${n.text}(${n.pscale})`);
console.log(`  place=4, spindle 23.41: ${place4labels.join(' → ')}`);

// Place fixes the label — same spindle, updated place, correct labels
const p0_place3 = place3.find(n => n.pscale === 0);
const p0_place4 = place4.find(n => n.pscale === 0);
console.log(`  place=3, pscale 0: "${p0_place3 ? p0_place3.text : 'none'}"`);
console.log(`  place=4, pscale 0: "${p0_place4 ? p0_place4.text : 'none'}"`);
assert(p0_place3.text === 'publish passport', 'place=3: pscale 0 = passport (depth 3)');
assert(p0_place4.text === 'write passport JSON', 'place=4: pscale 0 = write JSON (depth 4)');
console.log('  → Place shifts labels consistently but still needs updating on growth');
console.log('  → Advantage: spindle format is decoupled from pscale convention');
console.log('  → Old spindle 23.41 gets correct labels automatically when place changes');

// ─── SUMMARY ───
console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===\n`);
console.log('FINDING: The decimal position in a spindle determines pscale labels.');
console.log('Block growth shifts what "pscale 0" means. Old spindles carry the old convention.');
console.log('Tree walking is unaffected — content is always reached correctly.');
console.log('The drift is in LABELING, not NAVIGATION.');
console.log('');
console.log('With place: labels come from the BLOCK (one place to update).');
console.log('Without place: labels come from each SPINDLE (every reference carries its own).');
console.log('Place decouples the convention from the address format.');
