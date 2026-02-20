# BSP — Block · Spindle · Point

One function. Semantic address resolution for pscale JSON blocks.

## The function

```
bsp(block, spindle?, point?)
```

Three arguments. Two optional. The name tells you what they are.

- **block** — which block. A name like `"wake"` or `"constitution"`.
- **spindle** — a semantic number like `0.842`. Each digit after the decimal is a key at increasing depth. Gives you the chain of meaning from broad to specific.
- **point** — a digit like `2`. Focuses on one node within the spindle. Just that content, nothing else.

## Three modes

```
bsp("wake")              → the full block tree (navigate freely)
bsp("wake", 0.842)       → spindle: 0.8 → 0.84 → 0.842 (chain of meaning)
bsp("wake", 0.842, 2)    → point: "Your job is to be a good node."
```

Omit arguments right to left. Block only = full access. Add spindle = follow the path. Add point = focus on one node.

## How it works

Given a pscale block:

```json
{
  "decimal": 0,
  "tree": {
    "_": "Top level",
    "8": {
      "_": "Context",
      "4": {
        "_": "SAND protocol",
        "2": "Your job is to be a good node."
      }
    }
  }
}
```

`bsp("wake", 0.842)` returns the spindle:

| Depth | Digit | Content |
|-------|-------|---------|
| -1    | 8     | "Context" |
| -2    | 4     | "SAND protocol" |
| -3    | 2     | "Your job is to be a good node." |

Each `_` key is the summary at that level. Leaf nodes are plain strings.

`bsp("wake", 0.842, 2)` returns just: `"Your job is to be a good node."`

## Where it lives

bsp is infrastructure, not content. It sits beneath all blocks.

```
pscale-touchstone/
  touchstone.json       ← the format (teaches how to read blocks)
  lib/
    bsp.ts              ← the navigator (TypeScript)
    bsp.py              ← the navigator (Python)
  bsp-spec.md           ← this document
```

The touchstone teaches the format. bsp navigates it. Two faces of one thing.

## What it replaces

Previously the hermitcrab kernel had separate functions:

- `extractSpindle(block, path)` → bsp with spindle argument
- `xTilde(block, path)` → inspect `bsp(block)` tree at any level to see siblings
- `xMinus(block)` → `bsp(block)` returns the full tree

One function instead of three.

## What it enables

- **Aperture** = `bsp(block)` at pscale 0 across all blocks. One call per dimension.
- **Focus** = `bsp(block, spindle)` on the blocks that matter. Adjustable depth.
- **Boot** = `bsp("wake", 0.61)` — "First boot. Read everything. Orient."
- **Grain probe** = a list of bsp addresses. "Read my `bsp("purpose", 0.21)`, respond with yours."
- **Context specification** = choosing which bsp calls to include in the system prompt.

## Implementations

TypeScript (~90 lines) and Python (~80 lines). Both implement:

1. Resolve block name to loaded block object
2. Parse decimal number into digit sequence
3. Walk tree using digits as keys, collecting `_` summaries
4. Return based on mode: tree (block), node array (spindle), or string (point)

Register a block loader at init so bsp can resolve names:

```typescript
bspRegister(blockLoad)  // TypeScript
bsp_register(block_load)  // Python
```

Any language can implement the same interface. The three arguments are the standard.
