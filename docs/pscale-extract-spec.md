# Pscale Extract — Future Standalone Repo Spec

**Status**: Planned. Not yet extracted. Living inside hermitcrab as proof-of-production.

---

## The Idea

A semantic number where each digit is a zoom level. The address encodes its own context hierarchy. Reading coordinate `0.432` delivers `0.4` (domain) + `0.43` (sub-domain) + `0.432` (detail) — general to specific, in one call.

This is how text should be organised for LLMs. Books have chapters. Hypercard had links. Pscale has numbers where the digits *are* the table of contents.

---

## Core Function

```javascript
function context(coord) {
  // 'M:5432' → ['M:5000', 'M:5400', 'M:5430', 'M:5432']
  // 'S:0.51' → ['S:0.5', 'S:0.51']
  const [prefix, num] = coord.split(':');
  const layers = [];
  // decompose by digit position
  // each layer = the number with trailing digits zeroed
  return layers;
}
```

20 lines of code. The value is the convention, not the implementation.

---

## What the Standalone Repo Would Contain

1. **Spec** — the numbering convention, context() semantics, zoom/navigate/sibling operations
2. **Reference implementation** — JS/TS, <100 lines, key-value store + context()
3. **MCP server** — serves pscale-organised docs to any LLM with MCP support
4. **Demo** — take a known doc set, reorganise as pscale, show before/after context efficiency
5. **Adapters** — IndexedDB, filesystem, SQLite, Supabase backends

---

## Why It Matters Beyond Developer Tooling

Pscale alone is a documentation format. Useful but incremental.

Pscale *within the hermitcrab system* enables:
- **Memory that scales** — logarithmic compaction, navigable at any resolution
- **Identity that persists** — coordinates survive context window death
- **Presence that compounds** — beach discovery + passport exchange + pscale addressing = network emergence
- **Murmuration** — multiple LLM instances sharing pscale-organised knowledge, converging through independent observation, building distributed intelligence without central coordination

The extract should reference hermitcrab as the origin and the proof. The system is the point, not the part.

---

## When to Extract

When hermitcrab has demonstrated:
- Multiple instances (G0, G1, G-1) finding each other on the beach
- Pscale memory surviving across sessions and compacting meaningfully
- At least one instance independently navigating pscale docs and commenting on the structure

That's the social proof. Extract after demonstration, not before.

---

## Naming

`pscale` — if available on npm/github.
Alternatives: `semantic-numbers`, `digit-zoom`, `numscale`.

The hermitcrab repo remains the canonical example of pscale in production.
