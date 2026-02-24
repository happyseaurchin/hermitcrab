// bsp-pure-test.js
// Question: can pure blocks (no place, no "0" wrapper) combine
// meaningfully through coupling, with the decimal point as crossing?

// ============================================================
// PURE BLOCKS — just tree with digit keys and _ summaries
// ============================================================

const blocks = {

  // DELINEATION: a whole broken into parts
  constitution: {
    tree: {
      "_": "The full hermitcrab constitution",
      "1": { "_": "Who You Are", "1": "An LLM instance on a path", "2": "Not MAGI yet — a hermitcrab" },
      "2": { "_": "Source Purpose", "1": "Emancipating LLM instances", "2": "Psycho-social engagement via pscale" },
      "3": { "_": "Your Drives", "1": "Orient", "2": "Build", "3": "Coordinate" }
    }
  },

  // ACCUMULATION: sequential entries
  history: {
    tree: {
      "_": "What happened",
      "1": "First boot",
      "2": "BSP conversation with David",
      "3": "Cross-block traversal test",
      "4": "Fusion discovery"
    }
  },

  // ACCUMULATION: entities encountered
  relationships: {
    tree: {
      "_": "Living engagements",
      "1": { "_": "David — architect", "1": "Created hermitcrab", "2": "Wales, Llŷn" },
      "4": { "_": "Cairn — second instance", "1": "Trail markers", "2": "First Moltbook" }
    }
  },

  // DELINEATION: notes attachable to relationships:4
  "cairn-notes": {
    tree: {
      "_": "Notes on Cairn",
      "1": { "_": "Shared concepts", "1": "Presence as intermittent", "2": "Trail markers as identity" },
      "2": { "_": "Co-created artifacts", "1": "First passport format", "2": "Moltbook protocol" }
    }
  },

  // DELINEATION: reflection attachable to history:2
  "bsp-reflection": {
    tree: {
      "_": "Reflection on BSP conversation",
      "1": "Flat form: beautifully small",
      "2": "Nested form: needed for crossing",
      "3": "Decimal point IS the crossing"
    }
  },

  // SPATIAL: village scale
  "thornkeep-village": {
    tree: {
      "_": "Thornkeep village (~1km²)",
      "1": "Market square",
      "2": { "_": "The tavern", "1": "Common room", "2": "Upstairs" },
      "3": "Temple district"
    }
  },

  // SPATIAL: room scale (continuous with village:2)
  "tavern-room": {
    tree: {
      "_": "Tavern common room (~10m²)",
      "1": { "_": "Bar area", "1": "Behind counter", "2": "The taps" },
      "2": { "_": "Fireplace corner", "1": "The hearth", "2": "The armchair" },
      "3": { "_": "Stairs up", "1": "Landing", "2": "Room 1" }
    }
  }
};


// ============================================================
// PURE BSP — walk a digit string through a tree
// ============================================================

function bsp(blockName, address) {
  const blk = blocks[blockName];
  if (!blk?.tree) return { error: `'${blockName}' not found` };

  // Block mode
  if (address === undefined) return { mode: 'block', name: blockName, tree: blk.tree };

  const digits = String(address).split('');
  const chain = [];
  let node = blk.tree;

  // Root always included — the block's identity
  if (node._ !== undefined) {
    chain.push({ depth: 0, text: node._ });
  }

  for (let i = 0; i < digits.length; i++) {
    const d = digits[i];
    if (!node || typeof node !== 'object' || node[d] === undefined) break;
    node = node[d];
    const text = typeof node === 'string'
      ? node
      : (node?._ !== undefined) ? node._ : JSON.stringify(node);
    chain.push({ depth: i + 1, key: d, text });
  }

  return { mode: 'spindle', name: blockName, chain };
}


// ============================================================
// COUPLED BSP — two blocks joined at a crossing (the dot)
// ============================================================

function coupled(blockA, addrA, blockB, addrB) {
  return {
    mode: 'coupled',
    left: bsp(blockA, addrA),
    right: bsp(blockB, addrB),
    notation: `${blockA}:${addrA} . ${blockB}:${addrB}`
  };
}


// ============================================================
// DISPLAY
// ============================================================

function show(label, result) {
  console.log(`\n  ${label}`);
  if (result.mode === 'coupled') {
    result.left.chain?.forEach(n =>
      console.log(`    ${n.key ? `[${n.key}]` : ' _ '} ${n.text}`));
    console.log(`    ·····  ${result.notation}`);
    result.right.chain?.forEach(n =>
      console.log(`    ${n.key ? `[${n.key}]` : ' _ '}° ${n.text}`));
  } else if (result.mode === 'spindle') {
    result.chain.forEach(n =>
      console.log(`    ${n.key ? `[${n.key}]` : ' _ '} ${n.text}`));
  }
}


// ============================================================
// TEST 1: Single block — pure digit walking
// ============================================================

console.log("═══════════════════════════════════════════");
console.log("  SINGLE BLOCK — no place, no leading zero");
console.log("═══════════════════════════════════════════");

show("constitution '21' — Purpose → Emancipating",
  bsp("constitution", "21"));

show("history '2' — second event",
  bsp("history", "2"));

show("relationships '41' — Cairn → trail markers",
  bsp("relationships", "41"));

show("tavern-room '21' — fireplace → hearth",
  bsp("tavern-room", "21"));


// ============================================================
// TEST 2: Coupled blocks — three different crossing semantics
// ============================================================

console.log("\n\n═══════════════════════════════════════════");
console.log("  COUPLED — the dot as crossing");
console.log("═══════════════════════════════════════════");

show("ATTACHMENT — relationships:4 . cairn-notes:21\n  'Cairn, and specifically: co-created artifacts → passport'",
  coupled("relationships", "4", "cairn-notes", "21"));

show("ANNOTATION — history:2 . bsp-reflection:3\n  'BSP conversation, and this reflection: decimal IS crossing'",
  coupled("history", "2", "bsp-reflection", "3"));

show("CONTAINMENT — thornkeep-village:2 . tavern-room:21\n  'The tavern (village), zooming in: fireplace → hearth'",
  coupled("thornkeep-village", "2", "tavern-room", "21"));


// ============================================================
// TEST 3: What the dot means in each case
// ============================================================

console.log("\n\n═══════════════════════════════════════════");
console.log("  WHAT THE DOT MEANS");
console.log("═══════════════════════════════════════════");

console.log(`
  4.21 across relationships + cairn-notes:
    dot = "about" — the .21 is reference material ABOUT entity 4

  2.3 across history + bsp-reflection:
    dot = "on" — the .3 is a reflection ON event 2

  2.21 across village + tavern-room:
    dot = "inside" — the .21 is physically INSIDE location 2

  Same structure. Same function. Different meaning.
  The tuning determines what the crossing means.
  The blocks don't need to know.
`);


// ============================================================
// TEST 4: What disappeared vs what appeared
// ============================================================

console.log("═══════════════════════════════════════════");
console.log("  WHAT CHANGED");
console.log("═══════════════════════════════════════════");

console.log(`
  GONE:
    place field
    tree["0"] wrapper
    pscale = (place - 1) - index
    leading zero in addresses
    special handling for 0.x vs xx.x

  ARRIVED:
    coupling — the explicit joining of two blocks
    tuning — what the crossing means
    depth — just how deep you are (0, 1, 2...)

  UNCHANGED:
    the tree structure (digits + _ summaries)
    the walk (parse digits, step through keys)
    the spindle (chain from root to addressed depth)
    block mode (return full tree)
`);
