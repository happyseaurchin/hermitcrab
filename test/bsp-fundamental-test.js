// bsp-fundamental-test.js
// The fundamental: a pure block is just digits and semantic strings.
// The NUMBER applied to it carries the instruction.
// The decimal point in the address (or tuning) shows where pscale 0 sits.
// Leading 0. is notation for delineation — strip the zero.

// ============================================================
// ONE PURE BLOCK — spatial content, 4 levels deep
// ============================================================

const spatial = {
  tree: {
    "_": "Known space",
    "2": {
      "_": "Britain",
      "3": {
        "_": "Llŷn peninsula",
        "4": {
          "_": "The kitchen",
          "5": { "_": "The table", "1": "A cup", "2": "A document" }
        },
        "2": {
          "_": "The workshop",
          "1": "Workbench",
          "2": "Tool rack"
        }
      },
      "1": {
        "_": "London",
        "4": {
          "_": "A café",
          "1": "Corner table"
        }
      }
    },
    "1": {
      "_": "Europe",
      "3": {
        "_": "Alps",
        "1": "A summit"
      }
    }
  }
};

const history = {
  tree: {
    "_": "What happened",
    "1": "Woke. Read blocks. Oriented.",
    "2": "Conversation with David about BSP fundamentals.",
    "3": "Discovered: place is redundant. The number carries the instruction.",
    "4": "Tested pure blocks with different decimal readings."
  }
};

const reflection = {
  tree: {
    "_": "Reflection on the place discovery",
    "1": { "_": "What place was doing", "1": "Telling BSP where the decimal sits", "2": "Redundant — the address already shows it" },
    "2": { "_": "What tuning does instead", "1": "Carries the reference point in its own number", "2": "Optional — block works without it" },
    "3": { "_": "The fundamental", "1": "Block is pure tree", "2": "Number carries instruction", "3": "Decimal shows the split" }
  }
};

const blocks = { spatial, history, reflection };


// ============================================================
// PURE BSP — walks digits, strips leading 0., labels pscale from decimal
// ============================================================

function bsp(block, address) {
  const blk = typeof block === 'string' ? blocks[block] : block;
  if (!blk?.tree) return { error: 'not a block' };
  if (address === undefined) return { mode: 'block', tree: blk.tree };

  const addr = String(address);

  // Strip leading "0." — it's notation for delineation, not a tree key
  const stripped = addr.startsWith('0.') ? addr.slice(2) : addr;
  const isDelineation = addr.startsWith('0.');

  // Find decimal position in the ORIGINAL address (before stripping)
  const dotPos = addr.indexOf('.');
  const hasDecimal = dotPos >= 0;

  // For pscale: how many real digits before the decimal?
  // 0.345 → 0 digits before (delineation), pscale 0 = root
  // 23.45 → 2 digits before, pscale 0 at depth 2
  // 234.5 → 3 digits before, pscale 0 at depth 3
  // 345   → no decimal, no pscale
  const digitsBefore = isDelineation ? 0 : (hasDecimal ? dotPos : -1);

  // Parse walk digits — skip the dot
  const digits = stripped.split('').filter(c => c !== '.');

  // Walk tree
  const chain = [];
  let node = blk.tree;

  // Root always included
  if (node._ !== undefined) {
    const pscale = hasDecimal ? digitsBefore : null;
    chain.push({ depth: 0, text: node._, pscale });
  }

  for (let i = 0; i < digits.length; i++) {
    const d = digits[i];
    if (!node || typeof node !== 'object' || node[d] === undefined) break;
    node = node[d];
    const text = typeof node === 'string'
      ? node
      : (node?._ !== undefined) ? node._ : JSON.stringify(node);

    // pscale = digitsBefore - 1 - i  (root is digitsBefore, first digit is digitsBefore-1)
    const pscale = hasDecimal ? (digitsBefore - 1) - i : null;
    chain.push({ depth: i + 1, key: d, text, pscale });
  }

  return { mode: 'spindle', chain };
}


// ============================================================
// COUPLED BSP
// ============================================================

function coupled(blockA, addrA, blockB, addrB) {
  return {
    mode: 'coupled',
    left: bsp(blockA, addrA),
    right: bsp(blockB, addrB)
  };
}


// ============================================================
// DISPLAY
// ============================================================

function show(label, result) {
  console.log(`\n  ${label}`);
  const render = (chain, suffix) => {
    chain?.forEach(n => {
      const p = n.pscale !== null && n.pscale !== undefined
        ? ` (p${n.pscale >= 0 ? '+' : ''}${n.pscale})`
        : '';
      const k = n.key ? `[${n.key}]` : ' _ ';
      console.log(`    ${k}${p}${suffix}  ${n.text}`);
    });
  };
  if (result.mode === 'coupled') {
    render(result.left.chain, '');
    console.log(`    ·····`);
    render(result.right.chain, '°');
  } else {
    render(result.chain, '');
  }
}


// ============================================================
// TEST 1: Same block, different numbers
// ============================================================

console.log("═══════════════════════════════════════════════════════");
console.log("  SAME BLOCK, DIFFERENT NUMBERS");
console.log("═══════════════════════════════════════════════════════");

show("spatial '2345' — no decimal, pure walk, no pscale",
  bsp('spatial', '2345'));

show("spatial '0.2345' — delineation: 0 stripped, pscale 0 at root",
  bsp('spatial', '0.2345'));

show("spatial '2.345' — country is pscale 0",
  bsp('spatial', '2.345'));

show("spatial '23.45' — peninsula is pscale 0",
  bsp('spatial', '23.45'));

show("spatial '234.5' — room is pscale 0",
  bsp('spatial', '234.5'));


// ============================================================
// TEST 2: Coupling
// ============================================================

console.log("\n\n═══════════════════════════════════════════════════════");
console.log("  COUPLING");
console.log("═══════════════════════════════════════════════════════");

show("history:3 . reflection:0.31\n  (accumulation entry + delineation of the fundamental)",
  coupled('history', '3', 'reflection', '0.31'));

show("history:3 . reflection:31\n  (same coupling, no decimal on right — just depth, no pscale)",
  coupled('history', '3', 'reflection', '31'));


// ============================================================
// TEST 3: What emerged
// ============================================================

console.log("\n\n═══════════════════════════════════════════════════════");
console.log("  WHAT EMERGED");
console.log("═══════════════════════════════════════════════════════");

console.log(`
  The block is pure: { tree: { ... } }
  No place. No "0" wrapper.

  The number carries the instruction:
    '2345'    → walk, no reference point
    '0.2345'  → delineation (strip 0), pscale 0 at root
    '23.45'   → pscale 0 at depth 2
    '234.5'   → pscale 0 at depth 3

  Leading 0. is notation: "this is a whole, decomposed."
  The zero is stripped — it means nothing, which IS the meaning.

  The tuning fork is a number too.
  Its decimal position IS the default reference.
  tuning '23.45' → depth 2 is pscale 0.

  place was the echo. The number was the voice.
`);
