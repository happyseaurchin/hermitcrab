# Pscale Nested JSON — Skill Document

## What Is This

A method for storing and navigating semantic numbers as nested JSON. Each digit of a coordinate becomes a key. Each nesting level is one pscale step. The tree structure IS pscale containment. Navigation is O(1) property access.

## The Format

### Wrapper

```json
{
  "decimal": 1,
  "tree": { ... }
}
```

`decimal` specifies which depth in the tree is pscale 0 (unity). For a document in 0.x form, `decimal: 1` means depth 0 in the tree (the "0" key) IS pscale 0. For a spatial coordinate like "4321.876", `decimal: 4` means four digits above the point.

### Leaves and Branches

**Leaf** — a coordinate with no children. Stored as a plain string:

```json
{ "3": "The Boundary Operation: Summary or Emergence." }
```

**Branch** — a coordinate with children. Stored as an object with `_` for its semantic and digit keys for children:

```json
{ "2": {
    "_": "The Two Modes.",
    "1": "Mode A: Sequential.",
    "2": "Mode B: Simultaneous.",
    "3": "The Boundary Operation.",
    "4": "Complicated vs Complex."
  }
}
```

**Growth** — a leaf becomes a branch when it gains a child. The string moves to `_`:

```
Before: "3": "The Boundary Operation."
After:  "3": { "_": "The Boundary Operation.", "1": "A new child." }
```

This is natural accretion. New experience adds depth.

### Multi-Dimensional Semantics

Single-dimension documents use `_` for the semantic. Multi-dimensional coordinates use underscore-letter keys:

```json
{ "1": {
    "_s": "the room",
    "_t": "the present moment",
    "_i": "the merchant herself",
    "_m": "she remembers the debt",
    "_k": "trade skill active",
    "_d": "settled (det: 2)"
  }
}
```

| Key | Dimension | Description |
|-----|-----------|-------------|
| `_` | default | Single-dimension semantic |
| `_s` | spatial | Where |
| `_t` | temporal | When |
| `_i` | identity | Who |
| `_m` | memory | What was learned/compressed |
| `_k` | skill/code | Operational instructions |
| `_d` | determinancy | How settled/volatile |

A leaf (string) always means `_` (default semantic). Multi-dimensional nodes are always objects.

### Digit Keys

Single characters `0`–`9` are children. Always structural (pscale path), never semantic. No collision with underscore keys.

Special case: `+` is used for overflow (e.g., the "0.19+" coordinate for "ten siblings"). Non-digit keys that aren't underscore-prefixed are special markers.

### Sparse Coordinates

"4000.0003" creates intermediate empty objects:

```json
{ "4": {
    "_s": "the city",
    "0": { "0": { "0": { "0": { "0": { "0": {
      "3": "grain of sand on the boot"
    }}}}}}
  }
}
```

Intermediate `0` nodes have no `_` — structurally present, semantically absent. These ARE the zeros from the document: "the slot exists; the semantic is absent." Nodes are only created along occupied paths.

## Navigation

### Two Primitives

**pscale+** — go one level up (parent). Trim last digit from path.
- `0.123` → `0.12` → `0.1` → `0` → null
- Implementation: walk to parent object

**pscaleMinus** — go one level down (children). Read digit keys of current node.
- At `0.12`: returns `["1","2","3","4"]`
- At `0.123` (a leaf): returns `[]` — this is the **creative frontier**
- Implementation: `Object.keys(node).filter(k => isDigit(k))`

**X~** — scan siblings. Read parent's other digit keys, excluding self.
- From `0.12`: returns `["1","3","4","5","6","7","8","9"]`
- Implementation: `pscalePlus → pscaleMinus(parent) − self`

### Navigation vs Creation

| Situation | Operation | Cost |
|-----------|-----------|------|
| pscaleMinus returns children | Navigation | Free (O(1) property access) |
| pscaleMinus returns `[]` | **Creative frontier** | LLM tokens (analysis/decomposition) |
| pscalePlus to node with `_` | Navigation | Free |
| pscalePlus to node without `_` | **Creative frontier** | LLM tokens (compression/synthesis) |

LLM tokens are spent only at the creative frontier. Navigation is always free.

### Pscale Level

```javascript
pscaleLevel = decimal - pathDepth
```

For `decimal: 1` (0.x document):
- `0` → depth 1 → level 0 (at unity)
- `0.1` → depth 2 → level -1
- `0.123` → depth 4 → level -3

For `decimal: 4` (4321.876 spatial):
- `4` → depth 1 → level +3
- `4321` → depth 4 → level 0 (at unity)
- `4321.876` → depth 7 → level -3

### Aperture Assembly

To build an LLM's context window, specify:
1. **Focus coordinates** — which nodes to attend to
2. **Dimensions** — which underscore keys to include (`['_']` or `['_s','_t','_i']`)
3. **Resolution** — phrase (first sentence) or paragraph (full text)

```javascript
aperture(tree, ['0.12', '0.123'], {
  dimensions: ['_'],
  resolution: 'phrase'
})
// Returns: each coord with its semantic, parent, siblings, children
```

Player face: `dimensions: ['_s', '_t', '_i']`
Author face: `dimensions: ['_s', '_t', '_i', '_m']`
Designer face: `dimensions: ['_s', '_t', '_i', '_m', '_k', '_d']`

## Memory: Accretion and Compression

### Accretion (pscale-)

New experience adds children. The coordinate deepens.

```
Before: "2": "the street"
Event:  a stall appears
After:  "2": { "_": "the street", "1": "the stall" }
```

Leaf promoted to branch. The street now contains a stall.

### Compression (pscale+)

When digits 1–9 all have semantics at a node, compression triggers:

1. Read all nine children's semantics
2. LLM determines: **summary** (Mode A) or **emergence** (Mode B)?
3. Write result to parent's `_` (or update it)
4. Children remain — containment is preserved

The boundary operation (0.123) made mechanical. The tree tells you WHEN to compress. The LLM decides WHAT kind.

### The "10" Boundary

Nine is the maximum at one level (digits 1–9). When experience exceeds nine items, the tenth forces either:
- A new pscale level (push existing items deeper)
- Compression of existing items into parent semantic

This is the structural limit that drives natural pscale growth.

## Adding Higher Pscale

A character in room "321" discovers the room is in continent "4":

```
Before: tree = { "3": { "_": "city", "2": { "_": "street", "1": "room" }}}
After:  tree = { "4": { "_": "continent", "3": { "_": "city", "2": { "_": "street", "1": "room" }}}}
```

One operation: create "4" at root, move existing "3" subtree inside it. Update `decimal` from 3 to 4. Internal structure unchanged. This is why nested beats flat for upward growth.

## Why Nested

| vs Flat JSON | Nested wins because |
|---|---|
| Children lookup | O(1) vs O(n) scan |
| Containment | Explicit in structure vs implicit in key strings |
| Upward growth | Move one subtree vs rename every key |
| Surgical edit | Set one node's `_` vs rewrite whole key-value |
| LLM readability | Tree shape visible in the JSON itself |

| vs Relational DB | Nested wins because |
|---|---|
| No schema | Just `_` and digits |
| No migrations | Write new paths freely |
| Coordinate integrity | Path IS the coordinate, not decomposed into columns |
| Portable | Pure JSON, works in any language |

## File Structure

```
pscale-nested.json    — the data (nested tree + decimal metadata)
pscale-nav.js         — navigation functions (two primitives + derived)
```

The JSON is the database. The JS is the query layer. Both are portable, dependency-free, and work in browsers, Node, Deno, IndexedDB, or anywhere JSON lives.
