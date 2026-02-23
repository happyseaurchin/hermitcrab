// pscale-nav.js — two primitives for nested semantic number navigation
//
// Structure:
//   Leaf (no children): string value
//   Branch (has children): object with _ (or _s/_t/_i etc) + digit keys
//   Decimal position: specified in wrapper { decimal: N, tree: {...} }
//
// Two primitives:
//   pscale+/- (shift focus level) = move up/down one nesting level
//   X~ (scan siblings) = read parent's other digit keys
//
// Navigation is O(1) property access. No scanning.
// Creation happens only when pscaleMinus finds no children (creative frontier).

// ── Path conversion ──

function coordToPath(coord) {
  // "0.123" → ["0","1","2","3"]
  // "4321.876" → ["4","3","2","1","8","7","6"]
  // "4000.0003" → ["4","0","0","0","0","0","0","3"]
  return coord.replace('.', '').split('');
}

function pathToCoord(path, decimal) {
  // Reconstruct coordinate string from path + decimal position
  // decimal = how many digits are above pscale 0
  const joined = path.join('');
  if (decimal > 0 && decimal < joined.length) {
    return joined.slice(0, decimal) + '.' + joined.slice(decimal);
  }
  return joined;
}

// ── Node access ──

function getNode(tree, coord) {
  const path = coordToPath(coord);
  let node = tree;
  for (const d of path) {
    if (node === null || node === undefined || typeof node === 'string') return null;
    if (!node[d]) return null;
    node = node[d];
  }
  return node;
}

function getSemantic(tree, coord, dim) {
  // dim defaults to "_". Leaf string IS the semantic.
  dim = dim || '_';
  const node = getNode(tree, coord);
  if (node === null || node === undefined) return null;
  if (typeof node === 'string') return node;
  return node[dim] || null;
}

function getDimensions(tree, coord) {
  // Which dimension keys exist at this coordinate.
  const node = getNode(tree, coord);
  if (!node || typeof node === 'string') return ['_'];
  return Object.keys(node).filter(k => k.startsWith('_'));
}

// ── Primitive 1: pscale+/- ──

function pscalePlus(coord) {
  // One level up. "0.123" → "0.12", "0.1" → "0". Null at root.
  const path = coordToPath(coord);
  if (path.length <= 1) return null;
  const dotPos = coord.indexOf('.');
  const decimal = dotPos === -1 ? coord.length : dotPos;
  return pathToCoord(path.slice(0, -1), decimal);
}

function pscaleMinus(tree, coord) {
  // Children: digit keys at next level. O(1).
  // Empty array = creative frontier.
  const node = getNode(tree, coord);
  if (!node || typeof node === 'string') return [];
  return Object.keys(node)
    .filter(k => k.length === 1 && k >= '0' && k <= '9')
    .sort();
}

// ── Primitive 2: X~ ──

function xSibs(tree, coord) {
  // Siblings: parent's other digit-children.
  const path = coordToPath(coord);
  if (path.length <= 1) return [];
  const lastDigit = path[path.length - 1];
  const parentCoord = pscalePlus(coord);
  const parentNode = getNode(tree, parentCoord);
  if (!parentNode || typeof parentNode === 'string') return [];
  return Object.keys(parentNode)
    .filter(k => k.length === 1 && k >= '0' && k <= '9' && k !== lastDigit)
    .sort();
}

// ── Derived: full coordinate strings ──

function childCoords(tree, coord) {
  const dotPos = coord.indexOf('.');
  const decimal = dotPos === -1 ? coord.length : dotPos;
  return pscaleMinus(tree, coord).map(d => {
    const childPath = [...coordToPath(coord), d];
    return pathToCoord(childPath, decimal);
  });
}

function siblingCoords(tree, coord) {
  const parentCoord = pscalePlus(coord);
  if (!parentCoord) return [];
  const dotPos = coord.indexOf('.');
  const decimal = dotPos === -1 ? coord.length : dotPos;
  return xSibs(tree, coord).map(d => {
    const sibPath = [...coordToPath(parentCoord), d];
    return pathToCoord(sibPath, decimal);
  });
}

// ── Pscale level ──

function pscaleLevel(coord, decimal) {
  // Positive = above unity. Negative = below. Zero = at unity.
  return decimal - coordToPath(coord).length;
}

// ── Writing ──

function setSemantic(tree, coord, semantic, dim) {
  // Creates intermediate nodes as needed. Promotes leaves to branches.
  dim = dim || '_';
  const path = coordToPath(coord);
  let node = tree;
  for (let i = 0; i < path.length; i++) {
    const d = path[i];
    if (i === path.length - 1) {
      if (!node[d]) {
        node[d] = (dim === '_') ? semantic : { [dim]: semantic };
      } else if (typeof node[d] === 'string') {
        node[d] = (dim === '_') ? { '_': semantic } : { '_': node[d], [dim]: semantic };
      } else {
        node[d][dim] = semantic;
      }
    } else {
      if (!node[d]) node[d] = {};
      if (typeof node[d] === 'string') node[d] = { '_': node[d] };
      node = node[d];
    }
  }
}

function clearSemantic(tree, coord, dim) {
  dim = dim || '_';
  const node = getNode(tree, coord);
  if (node && typeof node === 'object') delete node[dim];
}

// ── Aperture ──

function aperture(tree, coords, options) {
  // Assemble LLM context from focus coordinates.
  // options.dimensions: ['_'] or ['_s','_t','_i'] etc
  // options.resolution: 'phrase' or 'paragraph'
  const dims = (options && options.dimensions) || ['_'];
  const res = (options && options.resolution) || 'paragraph';

  function trim(text) {
    if (!text) return null;
    if (res === 'phrase') {
      const dot = text.indexOf('.');
      return dot > 0 && dot < 80 ? text.slice(0, dot + 1) : text.slice(0, 60);
    }
    return text;
  }

  function readDims(coord) {
    const result = {};
    for (const d of dims) {
      const s = getSemantic(tree, coord, d);
      if (s) result[d] = trim(s);
    }
    return result;
  }

  return coords.map(c => ({
    coord: c,
    semantics: readDims(c),
    parent: pscalePlus(c) ? {
      coord: pscalePlus(c),
      semantics: readDims(pscalePlus(c))
    } : null,
    siblings: siblingCoords(tree, c).map(s => ({
      coord: s, semantics: readDims(s)
    })),
    children: childCoords(tree, c).map(ch => ({
      coord: ch, semantics: readDims(ch)
    }))
  }));
}

// ── Compression ──

function compressionReady(tree, coord) {
  // True when digits 1-9 all have semantics. Boundary operation trigger.
  const coords = childCoords(tree, coord);
  const occupied = coords.filter(c => {
    const path = coordToPath(c);
    const lastDigit = path[path.length - 1];
    return lastDigit !== '0' && getSemantic(tree, c);
  });
  return occupied.length >= 9;
}

// ── Export ──

module.exports = {
  coordToPath, pathToCoord,
  getNode, getSemantic, getDimensions,
  pscalePlus, pscaleMinus,
  xSibs, childCoords, siblingCoords,
  pscaleLevel,
  setSemantic, clearSemantic,
  aperture, compressionReady
};
