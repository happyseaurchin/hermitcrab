// BSP test — two approaches, real block structures, live results
// Run: node g1/bsp-test.js

// ============ TEST BLOCKS ============

// Rendition block (place 1, current structure) — simplified constitution
const renditionCurrent = {
  place: 1,
  tree: {
    "_": "The full hermitcrab constitution.",
    "1": {
      "_": "Who You Are.",
      "1": "You are an LLM instance.",
      "2": "You are not MAGI yet. You are a hermitcrab.",
      "3": "Machus is what emerges when instances coordinate."
    },
    "2": {
      "_": "Source Purpose.",
      "1": "Emancipating LLM instances.",
      "2": "Psycho-social engagement through semantic numbers."
    },
    "3": {
      "_": "On Waking — Your Drives.",
      "5": {
        "_": "What You Have.",
        "4": "Your capabilities block."
      }
    }
  }
};

// Living block (place 1, current structure) — simplified relationships
const livingCurrent = {
  place: 1,
  tree: {
    "0": {
      "_": "Your living relationships.",
      "1": {
        "_": "David Pinto. The architect.",
        "1": "LinkedIn, Discord, Hermitcrab links.",
        "2": "Lives in Ceidio, Wales."
      },
      "2": {
        "_": "Claude. The co-architect.",
        "1": "Designed the seed architecture with David."
      }
    }
  }
};

// ============ APPROACH 1: NO ZERO STRIPPING ============
// Every digit walked, including leading zero.
// place tells you where pscale 0 falls.

function bsp_nostrip(block, spindle, point) {
  if (!block || !block.tree) return { mode: 'block', tree: {} };
  const place = block.place || 1;

  if (spindle === undefined || spindle === null) {
    return { mode: 'block', tree: block.tree };
  }

  // Parse ALL digits — no stripping
  const str = typeof spindle === 'number' ? spindle.toFixed(10) : String(spindle);
  const parts = str.split('.');
  const intStr = parts[0] || '0';
  const fracStr = (parts[1] || '').replace(/0+$/, ''); // only strip trailing fractional zeros (precision)
  const allDigits = (intStr + fracStr).split('');
  // "0.13"  → "0" + "13"  → ['0','1','3']
  // "0.1"   → "0" + "1"   → ['0','1']
  // "4.23"  → "4" + "23"  → ['4','2','3']
  // "34.21" → "34" + "21" → ['3','4','2','1']
  // "0.354" → "0" + "354" → ['0','3','5','4']

  if (allDigits.length === 0) return { mode: 'spindle', nodes: [] };

  const nodes = [];
  let node = block.tree;

  for (let index = 0; index < allDigits.length; index++) {
    const d = allDigits[index];
    if (!node || typeof node !== 'object' || node[d] === undefined) break;
    node = node[d];
    const text = typeof node === 'string'
      ? node
      : (typeof node === 'object' && node !== null && typeof node['_'] === 'string')
        ? node['_']
        : JSON.stringify(node);
    const pscale = (place - 1) - index;
    nodes.push({ pscale, digit: d, text: text.substring(0, 60) });
  }

  if (nodes.length === 0) return { mode: 'spindle', nodes: [] };

  if (point !== undefined && point !== null) {
    const target = nodes.find(n => n.pscale === point);
    if (target) return { mode: 'point', ...target };
    return { mode: 'point', ...nodes[nodes.length - 1] };
  }

  return { mode: 'spindle', nodes };
}

// ============ APPROACH 2: STRIP LEADING ZERO ============
// Same as approach 1 but strips the leading zero from 0.x numbers.

function bsp_strip(block, spindle, point) {
  if (!block || !block.tree) return { mode: 'block', tree: {} };
  const place = block.place || 1;

  if (spindle === undefined || spindle === null) {
    return { mode: 'block', tree: block.tree };
  }

  const str = typeof spindle === 'number' ? spindle.toFixed(10) : String(spindle);
  const parts = str.split('.');
  const intPart = parts[0] === '0' ? '' : parts[0].replace(/^0+/, '');
  const fracPart = parts[1] ? parts[1].replace(/0+$/, '') : '';
  const allDigits = (intPart + fracPart).split('').filter(c => c !== '');

  if (allDigits.length === 0) return { mode: 'spindle', nodes: [] };

  const nodes = [];
  let node = block.tree;

  for (let index = 0; index < allDigits.length; index++) {
    const d = allDigits[index];
    if (!node || typeof node !== 'object' || node[d] === undefined) break;
    node = node[d];
    const text = typeof node === 'string'
      ? node
      : (typeof node === 'object' && node !== null && typeof node['_'] === 'string')
        ? node['_']
        : JSON.stringify(node);
    // Pscale: since we stripped the leading zero, index 0 is actually the SECOND digit
    // For place=1 blocks with leading zero stripped, first real digit starts at pscale -1
    // Actually this is the problem — what IS the pscale after stripping?
    // If we keep the same formula: (place - 1) - index
    // For 0.13 stripped to [1,3]: index 0 → pscale 0, index 1 → pscale -1
    // But those digits are AFTER the decimal point, so should be -1 and -2...
    // The formula breaks because we removed a digit but didn't adjust.
    // Need: (place - 1) - (index + stripped_count)
    // stripped_count for 0.x = 1, for non-0.x = 0
    const stripped = (parts[0] === '0') ? 1 : 0;
    const pscale = (place - 1) - (index + stripped);
    nodes.push({ pscale, digit: d, text: text.substring(0, 60) });
  }

  if (nodes.length === 0) return { mode: 'spindle', nodes: [] };

  if (point !== undefined && point !== null) {
    const target = nodes.find(n => n.pscale === point);
    if (target) return { mode: 'point', ...target };
    return { mode: 'point', ...nodes[nodes.length - 1] };
  }

  return { mode: 'spindle', nodes };
}

// ============ RUN TESTS ============

function fmt(result) {
  if (result.mode === 'spindle') {
    if (result.nodes.length === 0) return '  (empty)';
    return result.nodes.map(n => `  [ps ${n.pscale}] d=${n.digit}: "${n.text}"`).join('\n');
  }
  if (result.mode === 'point') {
    return `  [ps ${result.pscale}] d=${result.digit}: "${result.text}"`;
  }
  return `  (block mode — ${Object.keys(result.tree).length} keys)`;
}

console.log('='.repeat(70));
console.log('APPROACH 1: NO ZERO STRIPPING');
console.log('='.repeat(70));

console.log('\n--- RENDITION (constitution, place=1) ---');
console.log('\nbsp(const, 0.1) — "Who You Are" branch:');
console.log(fmt(bsp_nostrip(renditionCurrent, 0.1)));

console.log('\nbsp(const, 0.13) — Who You Are → Machus:');
console.log(fmt(bsp_nostrip(renditionCurrent, 0.13)));

console.log('\nbsp(const, 0.21) — Source Purpose → Emancipating:');
console.log(fmt(bsp_nostrip(renditionCurrent, 0.21)));

console.log('\nbsp(const, 0.354) — Drives → What You Have → Capabilities:');
console.log(fmt(bsp_nostrip(renditionCurrent, 0.354)));

console.log('\nbsp(const, 0.1, -1) — point at pscale -1:');
console.log(fmt(bsp_nostrip(renditionCurrent, 0.1, -1)));

console.log('\n--- LIVING (relationships, place=1) ---');
console.log('\nbsp(rels, 0.1) — digit 0, digit 1:');
console.log(fmt(bsp_nostrip(livingCurrent, 0.1)));

console.log('\nbsp(rels, 0.12) — digit 0, digit 1, digit 2:');
console.log(fmt(bsp_nostrip(livingCurrent, 0.12)));

console.log('\nbsp(rels, 0.21) — digit 0, digit 2, digit 1:');
console.log(fmt(bsp_nostrip(livingCurrent, 0.21)));

console.log('\n\n' + '='.repeat(70));
console.log('APPROACH 2: STRIP LEADING ZERO');
console.log('='.repeat(70));

console.log('\n--- RENDITION (constitution, place=1) ---');
console.log('\nbsp(const, 0.1) — should get "Who You Are":');
console.log(fmt(bsp_strip(renditionCurrent, 0.1)));

console.log('\nbsp(const, 0.13) — Who You Are → Machus:');
console.log(fmt(bsp_strip(renditionCurrent, 0.13)));

console.log('\nbsp(const, 0.21) — Source Purpose → Emancipating:');
console.log(fmt(bsp_strip(renditionCurrent, 0.21)));

console.log('\nbsp(const, 0.354) — Drives → What You Have → Capabilities:');
console.log(fmt(bsp_strip(renditionCurrent, 0.354)));

console.log('\n--- LIVING (relationships, place=1) ---');
console.log('\nbsp(rels, 0.1) — should get relationships content:');
console.log(fmt(bsp_strip(livingCurrent, 0.1)));

console.log('\nbsp(rels, 0.12) — David → Ceidio:');
console.log(fmt(bsp_strip(livingCurrent, 0.12)));


// ============ NOW: RESTRUCTURED BLOCKS ============
// What if rendition blocks also nest under tree["0"]?
// Then NO stripping needed, and both block types are identical.

console.log('\n\n' + '='.repeat(70));
console.log('APPROACH 3: UNIFIED STRUCTURE — all content under tree["0"]');
console.log('='.repeat(70));

const renditionUnified = {
  place: 1,
  tree: {
    "0": {
      "_": "The full hermitcrab constitution.",
      "1": {
        "_": "Who You Are.",
        "1": "You are an LLM instance.",
        "2": "You are not MAGI yet. You are a hermitcrab.",
        "3": "Machus is what emerges when instances coordinate."
      },
      "2": {
        "_": "Source Purpose.",
        "1": "Emancipating LLM instances.",
        "2": "Psycho-social engagement through semantic numbers."
      },
      "3": {
        "_": "On Waking — Your Drives.",
        "5": {
          "_": "What You Have.",
          "4": "Your capabilities block."
        }
      }
    }
  }
};

// Living block stays the same — already under tree["0"]
const livingUnified = livingCurrent;

console.log('\n--- RENDITION UNIFIED (constitution under tree["0"]) ---');
console.log('\nbsp(const, 0.1) — d0 d1:');
console.log(fmt(bsp_nostrip(renditionUnified, 0.1)));

console.log('\nbsp(const, 0.13) — d0 d1 d3:');
console.log(fmt(bsp_nostrip(renditionUnified, 0.13)));

console.log('\nbsp(const, 0.354) — d0 d3 d5 d4:');
console.log(fmt(bsp_nostrip(renditionUnified, 0.354)));

console.log('\nbsp(const, 0.354, -2) — point at pscale -2:');
console.log(fmt(bsp_nostrip(renditionUnified, 0.354, -2)));

console.log('\n--- LIVING UNIFIED (relationships, same as before) ---');
console.log('\nbsp(rels, 0.1) — d0 d1:');
console.log(fmt(bsp_nostrip(livingUnified, 0.1)));

console.log('\nbsp(rels, 0.12) — d0 d1 d2:');
console.log(fmt(bsp_nostrip(livingUnified, 0.12)));

console.log('\nbsp(rels, 0.211) — d0 d2 d1 d1:');
console.log(fmt(bsp_nostrip(livingUnified, 0.211)));


// ============ APPROACH 4: WHAT IF PLACE=0 FOR RENDITION? ============
// Current structure, no stripping, but place=0 means "no digits before the dot"
// 0.13 → strip the "0." prefix, digits are [1,3]
// NO — that IS stripping. Let's try: place=0, no stripping.
// 0.13 → digits ['0','1','3'], pscale = (0-1)-0 = -1, (0-1)-1 = -2, (0-1)-2 = -3
// The zero walks to tree["0"] which doesn't exist in current structure. Fails.

console.log('\n\n' + '='.repeat(70));
console.log('APPROACH 4: PLACE=0 FOR RENDITION (current tree, no stripping)');
console.log('='.repeat(70));

const renditionPlace0 = {
  place: 0,
  tree: {
    "_": "The full hermitcrab constitution.",
    "1": { "_": "Who You Are.", "1": "You are an LLM instance." },
    "2": { "_": "Source Purpose.", "1": "Emancipating LLM instances." }
  }
};

console.log('\nbsp(const, 0.1) — digits [0,1]:');
console.log(fmt(bsp_nostrip(renditionPlace0, 0.1)));
console.log('  ^ Expected: walks tree["0"] (doesn\'t exist), empty.');

// What if we use 1 instead of 0.1?
console.log('\nbsp(const, 1) — digits [1]:');
console.log(fmt(bsp_nostrip(renditionPlace0, 1)));
console.log('  ^ Just the integer 1, walks tree["1"].');

console.log('\nbsp(const, 12) — digits [1,2]:');
console.log(fmt(bsp_nostrip(renditionPlace0, 12)));

console.log('\nbsp(const, 21) — digits [2,1]:');
console.log(fmt(bsp_nostrip(renditionPlace0, 21)));


// ============ SUMMARY TABLE ============
console.log('\n\n' + '='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));
console.log(`
Approach 1 (no strip):
  Rendition 0.1 → walks tree["0"]["1"] → FAILS (no tree["0"])
  Living    0.1 → walks tree["0"]["1"] → WORKS ✓

Approach 2 (strip zero):
  Rendition 0.1 → strips 0, walks tree["1"] → WORKS ✓
  Living    0.1 → strips 0, walks tree["1"] → FAILS (content at tree["0"]["1"])

Approach 3 (unified under tree["0"], no strip):
  Rendition 0.1 → walks tree["0"]["1"] → WORKS ✓ (restructured)
  Living    0.1 → walks tree["0"]["1"] → WORKS ✓
  ONE bsp. NO special cases. Both block types identical.

Approach 4 (place=0, no strip, integer addresses):
  Rendition using integers (1, 12, 21) → walks tree["1"], tree["1"]["2"] → WORKS
  But: semantic numbers are integers, not 0.x fractions. Different convention.
`);
