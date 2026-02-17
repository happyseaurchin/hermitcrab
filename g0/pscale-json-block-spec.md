# Pscale JSON Block Specification

## What This Is

A pscale JSON block is a self-describing unit of structured knowledge. Any LLM can read it, understand what it is, know how to navigate it, know how to grow it, and know how to connect it with other blocks. No external documentation required. No legend. No metadata beyond one number.

It works like an LLM skill document — but structured as nested JSON using semantic numbers, so that containment, scale, and navigation are built into the format itself.

## The Format

```json
{
  "decimal": 1,
  "tree": {
    "0": {
      "_": "[What this block is. How to read it. How to grow it. How it connects to other blocks.]",
      "1": { ... },
      "2": { ... }
    }
  }
}
```

Two fields. That's all.

**`decimal`** — a single integer. It says: at which nesting depth does pscale 0 sit? This is the only structural metadata. Everything else lives inside the tree.

**`tree`** — nested JSON where each key is a digit (0-9) and each nesting level is one pscale step. The content at any node is stored under the key `_`. If a node has no children, it's a plain string instead of an object.

## How It Works

### The digit IS the key. The nesting IS the pscale.

The coordinate 0.321 in JSON:

```
tree["0"]         →  pscale  0   (digit 0)
    ["3"]         →  pscale -1   (digit 3)
        ["2"]     →  pscale -2   (digit 2)
            ["1"] →  pscale -3   (digit 1)
```

One structure. The key tells you which digit. The depth tells you which pscale level. These are not stored separately. The JSON nesting unifies them.

### Pscale 0 is the self-description.

The node at pscale 0 — the `_` value at whatever depth `decimal` points to — is the block's own operating instructions. Every block carries its own skill. An LLM reads pscale 0 first and knows:

- What kind of knowledge this block holds
- How the digits should be interpreted
- How the block grows (downward decomposition? upward accumulation?)
- How it connects to other blocks

No external registry. No prefix codes. The block speaks for itself.

### Leaves and branches.

A node with no children is a plain string:

```json
"3": "The Boundary Operation: Summary or Emergence."
```

A node with children is an object. Its semantic lives at `_`. Its children live at digit keys:

```json
"2": {
  "_": "The Two Modes.",
  "1": "Mode A: Sequential.",
  "2": "Mode B: Simultaneous.",
  "3": "The Boundary Operation.",
  "4": "Complicated vs Complex."
}
```

A leaf becomes a branch when it gains a child. The string moves to `_`:

```
Before:  "3": "The Boundary Operation."
After:   "3": { "_": "The Boundary Operation.", "1": "New child." }
```

This is the only structural rule. Everything else follows from it.

## Navigation

Three operations. Two are primitives, one is derived.

**pscale+** — go up one level. Move to the parent node. The containing pscale. In code: step back one key in the path.

**pscale-** — go down one level. Read the digit keys of the current node. These are the children. If there are no digit keys, you've reached the creative frontier — nothing exists here yet.

**X~** — scan sideways. From the parent node, read its other digit keys. These are siblings — things at the same pscale level as the current node.

That's it. Any LLM can perform these operations by reading the JSON structure. No functions required. The structure is the navigation.

## How Different Blocks Work

The same format serves fundamentally different purposes. The difference is in what pscale 0 says, not in the structure.

### A document (knowledge that decomposes)

```json
{
  "decimal": 1,
  "tree": {
    "0": {
      "_": "Semantic Numbers: Dual Modes of Mind. This block decomposes a concept. Digits below pscale 0 are finer distinctions. Navigate deeper for detail, shallower for synthesis. Five dimensions at pscale -1 (digits 1-5) form a systemic set — hold them simultaneously for emergence.",
      "1": {
        "_": "Content (What).",
        "1": {
          "_": "The Base Pairing.",
          "1": "Position, Not Digit.",
          "2": "The Number as Address."
        },
        "2": {
          "_": "The Two Modes.",
          "1": "Mode A: Sequential.",
          "2": "Mode B: Simultaneous."
        }
      },
      "2": { "_": "Process (How)." },
      "3": { "_": "Agency (Who)." }
    }
  }
}
```

The pscale 0 text says: this decomposes downward. The LLM knows to go deeper for detail.

### A memory (knowledge that accumulates)

```json
{
  "decimal": 1,
  "tree": {
    "0": {
      "_": "Memory accumulation for Uberak. Entries are added at digits 1-9 below pscale 0. When all nine are occupied, compress: read all nine, determine whether the pattern is summary or emergence, write the result to this node's _ text, then begin the next epoch by growing upward — the existing tree becomes the 1-child of a new root, and decimal increases by 1. Digit 0 children are always compression products, never regular entries.",
      "1": "Arrived at Thornkeep. Stone walls, low sky, smell of peat smoke.",
      "2": "Met the merchant Darwa. She trades in rumours more than goods.",
      "3": "The chapel door was locked. A sound behind it — scraping, rhythmic."
    }
  }
}
```

The pscale 0 text says: this accumulates upward, compress when full. The LLM knows the growth pattern.

### A spatial coordinate tree

```json
{
  "decimal": 4,
  "tree": {
    "4": {
      "_": "The Northern Reaches. A region of moor and stone.",
      "3": {
        "_": "Thornkeep. A settlement at the edge of the moor.",
        "2": {
          "_": "The market street. Cobbles worn smooth. Stalls line both sides.",
          "1": {
            "_": "Darwa's trading post. Low ceiling, one window, cluttered shelves. This is pscale 0 — the human-scale anchor. Above here is wider geography. Below here is finer detail within the room.",
            "1": "The counter. Scarred oak. A brass scale sits on it, unbalanced.",
            "2": "The shelves behind the counter. Jars, scrolls, a locked box.",
            "3": "The window. Thick glass, distorting the street outside."
          }
        }
      }
    }
  }
}
```

The pscale 0 text (at depth 4, because `decimal: 4`) says: this is the human-scale room. The LLM knows above is geography, below is detail.

### A skill (operational instructions)

```json
{
  "decimal": 1,
  "tree": {
    "0": {
      "_": "Soft-LLM character voice skill. Use this when generating character speech or internal experience. Navigate to relevant subsections based on what the character is doing. This skill decomposes — go deeper for specific rules.",
      "1": {
        "_": "Voice consistency.",
        "1": "Match the character's established vocabulary. Uberak uses short, direct sentences. No flourishes.",
        "2": "Emotional state modulates word choice, not grammar. Angry Uberak is still terse.",
        "3": "Never break character to explain mechanics. If the player needs system information, frame it as the character's perception."
      },
      "2": {
        "_": "Aperture respect.",
        "1": "Only describe what the character can perceive at their current location.",
        "2": "If the character cannot see something, do not hint at it. Absence is silence, not mystery.",
        "3": "Sound and smell travel further than sight. A character may hear what they cannot see."
      },
      "3": {
        "_": "Intention parsing.",
        "1": "Classify player input: action, query, social, or wait.",
        "2": "If ambiguous, treat as the most active interpretation. Players rarely type to do nothing."
      }
    }
  }
}
```

The pscale 0 text says: this is a skill, navigate to the relevant part. The LLM uses it like any skill document — except the structure lets it go directly to the relevant section via pscale navigation instead of reading the whole thing.

## Connecting Blocks

Blocks connect through text references, not structural links. A memory entry mentions a spatial coordinate:

```
"3": "Entered Darwa's trading post. [spatial: 4321] The room was smaller than expected."
```

The reference `[spatial: 4321]` is a human-readable pointer. An LLM encountering it knows: there's another block (spatial), and coordinate 4321 in that block has relevant detail. Whether to load it is a decision the LLM or its infrastructure makes based on the current task.

Blocks don't need to know about each other's internal structure. They just need to name each other. The name is enough. The referenced block's pscale 0 will explain itself when loaded.

## How an LLM Uses a Block

1. **Read pscale 0.** Now you know what this block is and how it works.
2. **Navigate to what's relevant.** Use pscale+/- and X~ on the JSON structure. Go deeper for detail, shallower for context, sideways for alternatives.
3. **Read the semantic text at the target node.** This is your content.
4. **If a reference to another block appears, decide whether to follow it.** Load the other block, read its pscale 0, navigate to the referenced coordinate.
5. **If you need to add knowledge, write it.** Find the right pscale level, find an empty digit, write your text there. If all digits 1-9 are full, compress.
6. **If you need to create deeper structure, do so.** A leaf becomes a branch. The existing text moves to `_`. The new child gets its digit key.

No special functions. No adapter layer. The LLM reads JSON, understands the structure, operates on it directly. The block is its own manual.

## The Minimal Rules

1. **`decimal` says where pscale 0 is.** One integer. The only metadata.
2. **Pscale 0 carries the self-description.** What the block is, how it grows, how it connects.
3. **Digit keys are children. `_` is semantic. Strings are leaves.** The only structural convention.
4. **Navigate with pscale+, pscale-, X~.** Up, down, sideways. Three operations on nested objects.
5. **Blocks connect by text reference.** Name the other block and coordinate. Let it describe itself.
6. **When digits 1-9 are full, compress.** The LLM reads all nine, determines summary or emergence, writes the result to `_`.

Six rules. Everything else is content.
