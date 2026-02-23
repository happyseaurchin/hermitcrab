# Pscale v3 Proposal: Nested JSON with Prefix-as-Tree-Selector

## The Problem

Hermitcrab uses prefixed coordinates: `S:0.1`, `M:5432`, `T:0.1`, `I:0.1`. The nested JSON format (validated, working, 164 coordinates tested) uses pure numeric paths: `0.123`. How do these meet?

## The Proposal

**Prefixes become tree selectors. Pure numeric paths operate within each tree.**

```json
{
  "S": { "decimal": 1, "tree": { "0": { "_": "Skill/structural knowledge", "1": { "_": "Environment", "1": "kernel source..." }, "2": { "_": "Interface" }, "4": { "_": "Memory knowledge", "1": "Compaction rules...", "2": "Storage negotiation..." }, "5": { "_": "Presence", "1": "Messaging...", "2": "Self-trigger..." } }}},
  "M": { "decimal": 0, "tree": { "1": "First memory entry", "2": "Second entry", "3": "Third entry" }},
  "T": { "decimal": 1, "tree": { "0": { "1": "Temporal processes" }}},
  "I": { "decimal": 1, "tree": { "0": { "1": "Processing identity" }}}
}
```

### What the prefix does

The prefix selects which tree you're in. It is NOT part of the numeric coordinate. It tells the LLM "this is structural knowledge" (S) vs "this is a memory entry" (M) vs "this is temporal" (T) vs "this is identity" (I).

The LLM sees `S:0.4` and knows: structural knowledge, memory subsection. It sees `M:5` and knows: fifth memory entry. The prefix is a cognitive shortcut — a cheap character that saves the LLM from having to infer the coordinate space from context.

### What the number does

The number after the prefix is a pure pscale path. Each digit is a JSON key. Each nesting level is one pscale step. Navigation is O(1) property access.

`S:0.42` means: in the S tree, walk `0` → `4` → `2`. Three property lookups. No string scanning.

### What the underscore keys do

Dimensional keys (`_s`, `_t`, `_i`, `_m`, `_k`, `_d`) are facets of the SAME coordinate. They are not separate addresses — they are different inhabitants of one address.

The room at spatial coordinate 321:
```json
{ "1": {
    "_s": "the room — low ceiling, one window",
    "_t": "late afternoon, shadows lengthening",
    "_i": "the merchant, counting coins",
    "_m": "she remembers the debt from last season",
    "_k": "trade skill: active",
    "_d": "settled (determinancy: 2)"
}}
```

Same place. Six descriptions. The aperture function selects which dimensions to include in the LLM's context window.

### Prefix vs dimension: the distinction

| | Prefix (S, M, T, I) | Dimension (_s, _t, _i, _m, _k, _d) |
|---|---|---|
| **What** | Selects which tree | Selects which facet of a node |
| **Level** | Top-level: separate coordinate spaces | Node-level: same coordinate, different content |
| **Growth** | Each tree grows independently | Dimensions added per-node as needed |
| **Example** | S:0.4 and M:5 are different addresses | _s and _t at coordinate 321 are different views of the same address |

These are two different kinds of multiplicity. Prefixes separate spaces. Dimensions separate facets within a space.

## Why this works

### 1. Each tree has its own decimal

S tree: `decimal: 1` — coordinates are `0.x` form (skill knowledge decomposes below unity).

M tree: `decimal: 0` — coordinates are positive integers (memories accumulate upward: 1, 2, ... 10, 11, ... 100).

T tree: `decimal: 1` — temporal coordinates in `0.x` form.

This is important. Memory coordinates grow upward (M:1 → M:10 → M:100). Skill coordinates decompose downward (S:0.1 → S:0.12 → S:0.123). They have fundamentally different growth patterns. Separate trees with separate decimals honour this.

### 2. Each tree grows independently

When memory hits M:10 (summary of M:1-9), the M tree wraps its existing content:

```
Before: M.tree = { "1": "first", "2": "second", ..., "9": "ninth" }

Compression happens. M:10 = summary of 1-9.

After:  M.tree = { "1": { "_": "summary of epoch 1", "0": { "_": "summary of 1-9", "1": "first", "2": "second", ..., "9": "ninth" }}}
        M.decimal goes from 0 to 1.
```

Wait — this needs examination. Let me work through it carefully.

### 3. The M tree growth problem (and resolution)

With `decimal: 0`, memory entries M:1 through M:9 are:

```json
{ "1": "first", "2": "second", ..., "9": "ninth" }
```

These are at depth 1, pscale level = `decimal - depth` = `0 - 1` = `-1`. That's below unity. But M:1 through M:9 are supposed to be pscale level 0 entries.

**Fix**: M tree should have `decimal: 1` too, with entries nested under a root key:

```json
M: { "decimal": 1, "tree": {
  "0": {
    "1": "first entry",
    "2": "second entry",
    ...
    "9": "ninth entry"
  }
}}
```

Now M:0.1 through M:0.9 are depth 2, pscale level = `1 - 2` = `-1`. Still wrong for "level 0 entries."

**Actually**: the pscale level calculation (`decimal - pathDepth`) is about where the decimal point sits, not about the semantic importance of the entry. M:1 in the flat system is just "first memory entry." The number 1 is an index, not a pscale level. The compaction pattern (M:10 = summary of M:1-9) uses the DIGIT STRUCTURE to trigger compression, not the pscale level formula.

So for memory, the question is simpler: can nested JSON handle the pattern `1, 2, ..., 9, 10(summary), 11, 12, ..., 19, 20(summary), ..., 100(summary)`?

In nested form:
```json
M: { "decimal": 0, "tree": {
  "1": "first entry",
  "2": "second entry",
  ...
  "9": "ninth entry"
}}
```

When M:10 arrives (summary), we need digit path `["1","0"]`. But `"1"` is already a leaf string ("first entry"). The leaf-to-branch promotion handles this:

```json
M: { "decimal": 0, "tree": {
  "1": {
    "_": "first entry",
    "0": "summary of entries 1-9"
  },
  "2": "second entry",
  ...
  "9": "ninth entry"
}}
```

Then M:11 is `["1","1"]`:
```json
  "1": {
    "_": "first entry",
    "0": "summary of entries 1-9",
    "1": "eleventh entry"
  }
```

And M:19 is `["1","9"]`, M:20 is `["2","0"]` (promotes "2" from leaf to branch), etc.

This works. The first entry at "1" becomes the parent of its own decade. Its original content moves to `_`. The summary at M:10 lives at `["1"]["0"]` — the zero child of the "1" branch. M:100 would be `["1"]["0"]["0"]` — deeper nesting as compression deepens.

**The structural meaning**: M:1's original content ("first entry") becomes the `_` of the branch that contains entries 10-19 and their summary. The first entry contextualises the decade it spawned. This is accidental but elegant — the earliest experience becomes the context for the experiences that follow.

### 4. Upward growth remains one operation

If a new prefix is needed (say `E:` for emotional state), it's just a new top-level key:

```json
{
  "S": { ... },
  "M": { ... },
  "E": { "decimal": 1, "tree": {} }
}
```

Within any tree, upward growth is still moving one subtree. Between trees, there's nothing to move — they're independent.

### 5. The adapter interface stays the same

```javascript
read("S:0.42")    // → split at ":", select S tree, walk path 0→4→2, return _
write("M:15", t)  // → split at ":", select M tree, walk path 1→5, set semantic
list("S:")        // → walk S tree, collect all coordinate paths, prepend "S:"
children("S:0.4") // → split at ":", select S tree, walk to 0→4, return digit keys
context("M:5432") // → split at ":", walk M tree layers: 5→54→543→5432
```

The prefix is parsed once at the adapter boundary. Everything inside is pure nested navigation. The LLM never needs to know about the internal structure — it just uses coordinate strings as before.

## What changes from current G1

| Current (v1/v2) | Proposed (v3) |
|---|---|
| Flat keys: `"S:0.42"` | Nested path: `S.tree["0"]["4"]["2"]` |
| Children: scan all keys for prefix match, O(n) | Children: read digit keys of node, O(1) |
| Context: string slicing to build parent coords | Context: walk up the tree |
| Upward growth: rename every key | Upward growth: move one subtree |
| One flat namespace | One tree per prefix |
| Dimensions not supported | Dimensions via underscore keys |

## What doesn't change

- Coordinate strings the LLM sees (`S:0.42`, `M:15`)
- The adapter interface (`read`, `write`, `list`, `delete`, `context`, `children`, `siblings`)
- The seeding process (same skill docs, same coordinates)
- The memory compaction pattern (M:10 = summary of M:1-9)
- The boot flow

## The conversion

Flat-to-nested is mechanical:
1. Group coordinates by prefix
2. For each prefix, create a tree
3. For each coordinate, strip prefix, split digits, insert into tree

Nested-to-flat is mechanical:
1. Walk each tree, collect all paths
2. Prepend prefix to each path

Lossless both ways. An instance can migrate at any time.

## Questions for validation

1. Does the M tree growth pattern (leaf-to-branch promotion at M:10, M:20, M:100) preserve the compaction semantics correctly?
2. Is prefix-as-tree-selector the right separation, or should prefixes map to dimensions instead?
3. The `decimal` per tree — is this necessary, or can it be inferred from the coordinate patterns?
4. When the LLM reads a nested JSON tree directly (not through the adapter), is the structure legible? Does it help or hinder comprehension?
5. For hermitcrab specifically: the S tree has coordinates like S:0.1, S:0.42, S:0.531. The M tree has M:1, M:10, M:153. The T tree has T:0.1. Are there cases where a coordinate needs to live in multiple trees?

## Reference

- `docs/pscale-nested/pscale-nested.json` — 164-coordinate nested JSON (validated)
- `docs/pscale-nested/pscale-nav-nested.js` — navigation functions (validated, one bug fixed)
- `docs/pscale-nested/pscale-nested-skill.md` — format specification
