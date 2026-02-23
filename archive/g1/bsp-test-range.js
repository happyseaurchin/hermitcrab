// BSP test — the full range of place values
// There is no structural difference. Place says where the dot goes.

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
      : (node?._ || JSON.stringify(node).substring(0, 50));
    const pscale = (place - 1) - index;
    nodes.push({ pscale, digit: d, text: text.substring(0, 65) });
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
    return result.nodes.map(n => {
      const ps = String(n.pscale).padStart(2);
      const marker = n.pscale === 0 ? ' ← pscale 0' : '';
      return `  [ps ${ps}] d=${n.digit}: "${n.text}"${marker}`;
    }).join('\n');
  }
  if (result.mode === 'point') return `  POINT [ps ${result.pscale}]: "${result.text}"`;
  return '  (block mode)';
}

// ============================================================
// SAME tree structure. Different place values. Different dot positions.
// The tree is 4 levels deep. Place determines where pscale 0 falls.
// ============================================================

const tree = {
  "2": {
    "_": "Epoch two. A broad container.",
    "3": {
      "_": "Chapter three within epoch two.",
      "4": {
        "_": "Section four within chapter three.",
        "1": "Specific detail: the first finding."
      }
    }
  }
};

console.log('Same tree, four levels deep: tree["2"]["3"]["4"]["1"]');
console.log('Same digits in every call: 2, 3, 4, 1');
console.log('Different place values move the dot — and pscale 0 — through the nesting.\n');

// place=1: 0.2341 — dot after first digit
const block1 = { place: 1, tree };
console.log('place=1 — semantic number: 0.2341');
console.log(fmt(bsp(block1, 0.2341)));

// place=2: 2.341 — dot after second digit
const block2 = { place: 2, tree };
console.log('\nplace=2 — semantic number: 23.41');
console.log(fmt(bsp(block2, 23.41)));

// place=3: 234.1 — dot after third digit
const block3 = { place: 3, tree };
console.log('\nplace=3 — semantic number: 234.1');
console.log(fmt(bsp(block3, 234.1)));

// place=4: 2341 — all digits before the dot (or 2341. with trailing dot)
const block4 = { place: 4, tree };
console.log('\nplace=4 — semantic number: 2341');
console.log(fmt(bsp(block4, 2341)));

console.log('\n' + '='.repeat(65));
console.log('Same tree. Same content. Same walk. Same bsp.');
console.log('Place slides the dot. Pscale 0 moves with it.');
console.log('Everything above the dot is composition. Below is decomposition.');
console.log('='.repeat(65));

// Now show that the semantic number format matches the place
console.log('\n\nWHAT THE DOT POSITION MEANS:');
console.log('─'.repeat(65));
console.log('place=1  0.2341   All decomposition. A document. A spec.');
console.log('place=2  23.41    One level of composition above pscale 0.');
console.log('place=3  234.1    Two levels above. A block with history.');
console.log('place=4  2341     All composition. A coordinate. A location.');
console.log('─'.repeat(65));
console.log('The block structure doesn\'t change. The interpretation does.');
console.log('"Rendition" and "living" were names for place=1 and place≥2.');
console.log('They are the same thing.');
