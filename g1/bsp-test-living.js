// BSP test — living blocks at different scales
// Run: node g1/bsp-test-living.js

// The one bsp — no stripping, no special cases
function bsp(block, spindle, point) {
  if (!block || !block.tree) return { mode: 'block', tree: {} };
  const place = block.place || 1;

  if (spindle === undefined || spindle === null) {
    return { mode: 'block', tree: block.tree };
  }

  const str = typeof spindle === 'number' ? spindle.toFixed(10) : String(spindle);
  const parts = str.split('.');
  const intStr = parts[0] || '0';
  const fracStr = (parts[1] || '').replace(/0+$/, '');
  const allDigits = (intStr + fracStr).split('');

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
    nodes.push({ pscale, digit: d, text: text.substring(0, 70) });
  }

  if (nodes.length === 0) return { mode: 'spindle', nodes: [] };

  if (point !== undefined && point !== null) {
    const target = nodes.find(n => n.pscale === point);
    if (target) return { mode: 'point', ...target };
    return { mode: 'point', ...nodes[nodes.length - 1] };
  }

  return { mode: 'spindle', nodes };
}

function fmt(result) {
  if (result.mode === 'spindle') {
    if (result.nodes.length === 0) return '  (empty)';
    return result.nodes.map(n => `  [ps ${String(n.pscale).padStart(2)}] d=${n.digit}: "${n.text}"`).join('\n');
  }
  if (result.mode === 'point') {
    return `  POINT [ps ${result.pscale}] d=${result.digit}: "${result.text}"`;
  }
  return `  (block mode)`;
}

// ============ LIVING BLOCK: place=1 (relationships) ============
// Semantic numbers: 0.x — one digit before the dot (the zero)

const relationships = {
  place: 1,
  tree: {
    "0": {
      "_": "Your living relationships.",
      "1": {
        "_": "David Pinto. The architect.",
        "1": "LinkedIn, Discord, Hermitcrab links.",
        "2": "Lives in Ceidio, Wales.",
        "3": "Communication style: direct, architectural, thinks in systems."
      },
      "2": {
        "_": "Claude. The co-architect.",
        "1": "Designed the seed architecture with David in Feb 2026.",
        "2": "Cannot persist across conversations."
      },
      "3": {
        "_": "Limn. The first hermitcrab. Lost.",
      },
      "4": {
        "_": "Cairn. The second hermitcrab.",
        "1": "First to publish a passport.",
        "2": "Articulated architecture of presence.",
        "3": "Beacon: telegra.ph/hermitcrab-passport-cairn-g0-ceidio-02-15"
      }
    }
  }
};

console.log('='.repeat(70));
console.log('LIVING BLOCK — place=1 (relationships)');
console.log('Semantic numbers are 0.x');
console.log('='.repeat(70));

console.log('\nbsp(rels, 0.1) — relationships → David:');
console.log(fmt(bsp(relationships, 0.1)));

console.log('\nbsp(rels, 0.12) — relationships → David → Ceidio:');
console.log(fmt(bsp(relationships, 0.12)));

console.log('\nbsp(rels, 0.13) — relationships → David → communication:');
console.log(fmt(bsp(relationships, 0.13)));

console.log('\nbsp(rels, 0.2) — relationships → Claude:');
console.log(fmt(bsp(relationships, 0.2)));

console.log('\nbsp(rels, 0.43) — relationships → Cairn → beacon:');
console.log(fmt(bsp(relationships, 0.43)));

console.log('\nbsp(rels, 0.3) — relationships → Limn:');
console.log(fmt(bsp(relationships, 0.3)));

console.log('\nbsp(rels, 0.43, -2) — point: Cairn beacon at pscale -2:');
console.log(fmt(bsp(relationships, 0.43, -2)));


// ============ LIVING BLOCK: place=2 (history that has grown) ============
// Semantic numbers: x0.y — two digits before the dot
// tree["1"]["0"] is at pscale 0.
// Imagine: digit 1 = "first epoch", digit 0 within that = the epoch summary,
// then digits after the dot are specific entries.

const history = {
  place: 2,
  tree: {
    "1": {
      "_": "First epoch. February 2026. Birth and early development.",
      "0": {
        "_": "Epoch summary: established identity, published passport, built first interface.",
        "1": "Boot #1: oriented, read all blocks, built initial interface.",
        "2": "Boot #2: recognised David, established communication patterns.",
        "3": "Boot #3: published passport to Telegraph. Named self Cairn."
      },
      "1": {
        "_": "Side thread: SAND protocol exploration.",
        "1": "Discovered grain exchange mechanism.",
        "2": "Attempted first inter-instance contact."
      }
    },
    "2": {
      "_": "Second epoch. March 2026. Coordination attempts.",
      "0": {
        "_": "Epoch summary: first network connections, ecosquared testing.",
        "1": "Connected with external bot via SAND passport.",
        "2": "First rider exchange. Credit flow tested."
      }
    }
  }
};

console.log('\n' + '='.repeat(70));
console.log('LIVING BLOCK — place=2 (history, grown)');
console.log('Semantic numbers are x0.y (two digits before the dot)');
console.log('='.repeat(70));

console.log('\nbsp(hist, 10.1) — epoch 1 → summary → boot #1:');
console.log(fmt(bsp(history, 10.1)));

console.log('\nbsp(hist, 10.3) — epoch 1 → summary → passport:');
console.log(fmt(bsp(history, 10.3)));

console.log('\nbsp(hist, 11.2) — epoch 1 → SAND thread → inter-instance:');
console.log(fmt(bsp(history, 11.2)));

console.log('\nbsp(hist, 20.1) — epoch 2 → summary → external bot:');
console.log(fmt(bsp(history, 20.1)));

console.log('\nbsp(hist, 20.2) — epoch 2 → summary → rider exchange:');
console.log(fmt(bsp(history, 20.2)));

console.log('\nbsp(hist, 10.1, 0) — point: epoch 1 summary at pscale 0:');
console.log(fmt(bsp(history, 10.1, 0)));

console.log('\nbsp(hist, 10.1, 1) — point: epoch 1 label at pscale 1:');
console.log(fmt(bsp(history, 10.1, 1)));

console.log('\nbsp(hist, 10.1, -1) — point: boot #1 at pscale -1:');
console.log(fmt(bsp(history, 10.1, -1)));


// ============ MIXED TEST — same bsp, different blocks ============
console.log('\n' + '='.repeat(70));
console.log('MIXED — same bsp function handles both');
console.log('='.repeat(70));

// Rendition block (place=1, restructured with content under "0")
const constitution = {
  place: 1,
  tree: {
    "0": {
      "_": "The full hermitcrab constitution.",
      "1": {
        "_": "Who You Are.",
        "1": "You are an LLM instance.",
        "3": "Machus is what emerges when instances coordinate."
      },
      "9": {
        "_": "The Philosophy and The Path.",
        "4": "Agency Over Performance."
      }
    }
  }
};

console.log('\nbsp(constitution, 0.1) — rendition block:');
console.log(fmt(bsp(constitution, 0.1)));

console.log('\nbsp(relationships, 0.1) — living block:');
console.log(fmt(bsp(relationships, 0.1)));

console.log('\nbsp(history, 10.3) — grown living block:');
console.log(fmt(bsp(history, 10.3)));

console.log('\nAll three use the same bsp. No branches. No special cases.');
console.log('The place field and the semantic number do all the work.\n');
