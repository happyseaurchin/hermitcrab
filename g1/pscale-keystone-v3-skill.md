# Pscale JSON Block Format — Keystone v3

*This document is a paragraph-resolution rendering of the keystone block. The keystone is itself a rendition block (decimal 0) — its tree root is pscale 0, all content decomposes downward. This markdown version preserves the coordinate addresses so you can navigate the same structure in either format.*

---

## 0 — What This Is

This is a pscale JSON block. It is nested JSON where each key is a digit (0-9), each nesting level is one pscale step, and content lives at the underscore key (`_`). Leaves without children are plain strings. To navigate: go up one level (X+), read a node's digit keys to go deeper (X-), or read the parent's other digit keys to scan sideways (X~). The node at pscale 0 — this node — always describes what the block is and how to use it. Every block you encounter follows this format. Read its pscale 0 first.

---

## 0.1 — Structure

How a block is built.

### 0.1.1 — The Three Fields

A block has up to three fields:

- **decimal** (integer, required) — which nesting depth is pscale 0
- **tree** (nested JSON, required) — the content
- **tuning** (semantic number, optional) — what pscale levels mean for this block (see section 0.6)

That is all. No metadata, no headers, no schema beyond these three.

#### 0.1.1.1 — Rendition vs Living

A block is either **rendition** or **living**.

**Rendition blocks** have decimal 0. The tree root is pscale 0 — all content decomposes downward (0.x addresses only). They are documents, specifications, skills, tuning definitions. This keystone is a rendition block. Cold and self-describing — their pscale 0 tells you what they are. They don't "exist" in any living way. They represent.

**Living blocks** have decimal 1 or higher. Content exists both above and below pscale 0. Their pscale 0 is occupied by content, not definition — the most recent entry, the current state, the present moment. They are memories, purposes, relationships, coordinates. They exist meaningfully relative to someone, somewhere, somewhen. Living blocks may carry a tuning.

The number itself tells you which kind you're looking at. If the highest-level content is at 0.x — rendition. If there are positive-pscale entries (1, 2, 12, 321...) — living.

### 0.1.2 — Digit Keys and Underscore

Digit keys (0-9) are children. The underscore key (`_`) holds the semantic text at that node. A node with children is a JSON object containing `_` plus one or more digit keys. A node without children is a plain string — no object wrapper needed.

### 0.1.3 — How Blocks Grow

A string leaf becomes an object branch when it gains a child. The original string moves to `_` and the new child gets its digit key. This is the only growth operation: a leaf becomes a branch. Everything else — compression, upward growth — follows from this.

### 0.1.4 — Pscale Level

Pscale level equals decimal minus nesting depth. Above pscale 0 is composition (broader context, larger scale). Below pscale 0 is decomposition (finer detail, smaller scale). The decimal field tells you where the boundary sits.

In `21.34` with decimal 2: the digit 2 sits at pscale 1 (one above zero), the digit 1 at pscale 0, the digit 3 at pscale -1 (one below zero), and the digit 4 at pscale -2. Two levels of context above, two levels of detail below.

#### 0.1.4.1 — The Sign

A semantic number can be positive or negative. The sign belongs to the whole number, not to individual digits. You cannot have negative digits — that breaks how numbers work.

What the sign means:

- **Spatial**: positive = real, actual place. Negative = imaginary, fictional. Middle Earth's coordinates are negative.
- **Temporal**: positive = settled, happened, past. Negative = anticipated, projected, future.
- **Identity**: positive = public, social. Negative = private, psychological.

Pattern: positive = established and observable. Negative = inferred, anticipated, or internal. The sign is a domain flag.

---

## 0.2 — The Spindle

What blocks are for.

### 0.2.1 — What a Spindle Is

A spindle is a specific path through a block — a semantic number like 21.34 that extracts a chain of content from high pscale to low pscale. Four digits means four semantic vectors, from wide context (pscale 1: "Wales") to specific detail (pscale -2: "The bakery"). Each level contextualises the levels below it, and each level is contained by the levels above it.

This is the primary output of any block: wide-to-specific context in a single traversal. When you need to orient — where am I, when is this, who is present — you extract a spindle.

### 0.2.2 — Block Is Storage, Spindle Is Output

The block is a warehouse. The spindle is the delivery. Everything about block design — structure, growth, compression, connection — serves the generation of useful spindles. A block that cannot produce coherent spindles is broken regardless of how well-structured it looks.

### 0.2.3 — Token Cost

A spindle's range (how many pscale levels it spans) multiplied by its chunk size (how much text sits at each level) determines its cost in tokens. Higher range needs sparser content. A six-level spindle of paragraphs is ~600 tokens. A three-level spindle of phrases is ~30 tokens. Both are valid — they serve different purposes.

### 0.2.4 — Encoding Resolution

Any block can be read at different resolutions:

- **Phrase-level** — one line per node. The whole block visible at a glance. Good for orientation. This is what an aperture provides: pscale 0 of every block as a single sentence.
- **Paragraph-level** — a paragraph per node. Good for comprehension. This markdown document is roughly paragraph-level.
- **Full text** — everything at every node. Good for immersion or detailed work.

The resolution is a choice made by the reader (or the system assembling context), not a property of the block. The same block serves all three.

### 0.2.5 — Worked Example

See the block named 'example' for a worked demonstration of a living block with a tuning, content at several pscale levels, and a spindle extraction.

---

## 0.3 — Navigation

How to move through a block.

### 0.3.1 — Three Operations

Three operations are always available at any node in any block:

**X+** — Go to the parent node. One pscale level up. The containing context. From "The bakery" to "High Street" to "Nefyn" to "Wales." Each step gives you broader context for where you are.

**X-** — Read the digit keys of the current node. These are the children — one pscale level down. If there are none, you have reached the creative frontier: nothing exists here yet. You can write here.

**X~** — Look at the parent's other digit keys. These are siblings — things at the same pscale level as where you are. Other rooms in the same building. Other moments in the same session. Other entities at the same depth of familiarity.

### 0.3.2 — Meaning Depends on Mapping

The three operations are syntactically identical in every block. But what they *mean* depends on the block's mapping. There are three primary mappings — containment, temporal, and relational (see section 0.7 for the full analysis).

**In a containment block** (spatial coordinates, capabilities): X+ zooms out (room → building → district → city). X- zooms in (city → district → building → room). X~ shows adjacent spaces at the same scale — co-present peers whose order does not matter. The bakery and the bookshop are siblings; it doesn't matter which you visit first.

**In a temporal block** (history, calendars): X+ zooms to a longer timespan (moment → hour → day → week). X- zooms to a shorter one. X~ shows adjacent moments in sequence — before and after. Tuesday's entries come after Monday's and before Wednesday's. Order matters.

**In a relational block** (relationships, identity coordinates): X+ zooms to less familiar (deep knowledge → casual acquaintance). X- zooms to deeper familiarity. X~ shows other entities at the same depth of knowing — co-present, unordered. The three people you know well are siblings; they don't have a sequence.

The structure is identical in all three. The meaning differs. The tuning (section 0.6) specifies which mapping a particular block uses.

### 0.3.3 — Read Pscale 0 First

Always read pscale 0 first when encountering any block. It tells you what the block is and how it works. This is the universal entry point. Every block you will ever encounter has a pscale 0 node that orients you.

---

## 0.4 — Growth

How a block changes over time.

### 0.4.1 — Adding Content

To add content: find the right pscale level, find an unoccupied digit (1-9), write your text there. That's it. The tree grows one leaf at a time.

### 0.4.2 — Compression

When digits 1-9 at a node are all occupied, compression triggers. Read all nine entries. Then determine which kind of compression applies:

**Summary** — the parts add up to the whole. Reducible. The bricks make a wall. Seven daily entries become a weekly summary. Write the condensation to the parent's `_` text.

**Emergence** — the whole is more than the parts. Irreducible. The conversations became a friendship. Something appears in the combined pattern that no individual entry contains. Write the emergent insight to the parent's `_` text.

This determination — summary or emergence — is the most important judgment in the system. It's not always obvious. When in doubt, ask: if I removed one of the nine, would the parent text still be valid? If yes, it's summary (any brick can be removed; the wall is shorter but still a wall). If no, it's emergence (remove one conversation and the friendship might not have formed).

#### 0.4.2.1 — Digit 0

Digit 0 as a child has special meaning: it is always a compression product, never a regular entry. When you see a 0 key, you know it was written by compression, not by direct input.

### 0.4.3 — Upward Growth

When the root level is full and compressed, the existing tree becomes a child of a new root. The decimal field increases by 1. A block with decimal 4 has been through multiple rounds of upward growth — it has deep history. A block with decimal 1 just started.

This means the decimal tells you something about the block's maturity. A hermitcrab's history block at decimal 1 has had at most one session. At decimal 3, it has accumulated enough that two full rounds of compression have pushed the tree upward.

---

## 0.5 — Connection

How blocks relate to each other.

### 0.5.1 — Text References

Blocks connect through text references. A node's text may name another block and a coordinate within it: "see relationships.1.3 for details on this entity." Follow the reference by loading the named block and navigating to that coordinate.

This is the lightweight connection mechanism — a pointer, not a merge. The blocks remain independent. You load what you need when you need it.

### 0.5.2 — Self-Describing

Every block is self-describing. You never need external documentation to understand a block. Its pscale 0 tells you what it is, how it grows, and how it connects. If a block's pscale 0 is missing or unclear, the block is broken.

### 0.5.3 — Same Format, Different Purpose

Different blocks serve wildly different purposes — documents, memories, spatial maps, purposes, relationships, skills, game worlds — but all use the same format. The pscale 0 text is what differs, not the structure. Once you learn the format, you can read any block.

### 0.5.4 — Combination

Blocks can combine. How they combine depends on whether they share a tuning.

**Same tuning = additive.** Blocks sharing a tuning are the same type. Combining them is overlay, consolidation, a wider net within the same semantic space. Like merging two maps of the same territory — where they agree, confidence increases; where they differ, gaps fill in.

**Different tuning = multiplicative.** Blocks with different tunings are different types. Combining them produces something new that exists in neither source. A spatial spindle crossed with a temporal spindle produces an event: *what happened here at this time*. A spatial spindle crossed with an identity spindle produces a description: *what this entity means in this place*. The product is new meaning, not stored meaning.

### 0.5.5 — The Keystone

This block — the one you are reading now — is the keystone. It teaches you how to use all other blocks. If you forget how blocks work, come back here. Navigate deeper into any section for more detail.

---

## 0.6 — Tuning

How a block knows what its pscale levels mean.

### 0.6.1 — What a Tuning Is

A living block may carry a `tuning` field — a semantic number like `74.45` or `11.11`. The digits are identifiers, arbitrary. What matters is the precise definition at each pscale level: what does this level measure, and in what units?

Three examples:

**A spatial tuning** defines containment scale:
- Pscale 2 = region (~10⁵ km²)
- Pscale 1 = settlement (~10 km²)
- Pscale 0 = room (~10 m²)
- Pscale -1 = object (~0.1 m²)

**A temporal tuning** defines time spans:
- Pscale 2 = epoch (multiple sessions or weeks)
- Pscale 1 = session (~1 hour)
- Pscale 0 = exchange (~minutes)
- Pscale -1 = utterance (~seconds)

**A relational tuning** defines depth of familiarity:
- Pscale 0 = name and recognition
- Pscale -1 = role and context
- Pscale -2 = character and patterns
- Pscale -3 = deep knowledge and shared history

Each tuning is precise. Not "feels like a country" — rather "region, approximately 10⁵ km²." The tuning is not imposed, but it is not vague.

### 0.6.2 — Resonance, Not Authority

The tuning is a resonance reference, not an authoritative schema. You can read a block and sense what its pscale levels mean from the content itself — pattern recognition is what minds do. The tuning confirms or adjusts that sense.

If the spindles produce coherent context cascades, the tuning is right. If they don't, adjust the tuning. Meaning is in the use, not in the definition. A block whose spindles work is well-tuned whether or not you have formally checked the tuning.

Two entities sharing a tuning can align their blocks without a central authority dictating meaning — like two musicians using the same reference tone to get in tune with each other, without a conductor.

### 0.6.3 — Where the Definition Lives

The tuning's full definition — the precise semantic at each of its pscale levels — lives in a rendition block (0.x), itself a pscale JSON block. But this is a reference, not a dependency. The tuning block is a tool for building and checking. The living block's content proves itself through coherent spindles.

### 0.6.4 — Emergence Through Use

A tuning can emerge through use. As a block grows and compresses, the pattern of what each pscale level means becomes clear through the content itself. Writing it down as a tuning helps future instances and other entities align. The tuning is discovered through operation, not prescribed before it.

A hermitcrab that has accumulated four epochs of history knows what "epoch" means for its particular rhythm of conversation — it doesn't need to be told. But writing the tuning down means the next instance, or another hermitcrab, can orient immediately.

---

## 0.7 — Fundamentals

The variables that distinguish one kind of block from another. These are the structural properties of the number system itself — not implementation choices, not design preferences, but the dimensions along which blocks genuinely differ.

### 0.7.1 — Digit Property

Whether the ordering of digits 1-9 within a pscale level carries meaning.

**Sequential**: 1 < 2 < 3. Order matters. Entry 1 was written before entry 2. X~ reveals temporal sequence — before and after. Used in history blocks and temporal coordinates.

**Labeling**: 1 = chair, 2 = table, 3 = window. Order is irrelevant. Digits distinguish items without ranking them. X~ reveals co-present peers. Used in spatial coordinates and capability blocks.

**Arbitrary**: Digits assigned freely and can be reassigned. A goal that was digit 3 can become digit 1 if priorities shift. X~ reveals co-present alternatives whose arrangement is fluid. Used in purpose blocks and relational blocks.

### 0.7.2 — Pscale Mapping

What depth means in this block. The three primary mappings correspond to the three coordinate dimensions.

**Containment**: Depth is nesting. A room inside a building inside a city. Each level physically or conceptually contains the levels below it. Primary dimension: space.

**Temporal**: Depth is timescale. Seconds inside minutes inside hours inside days. Each level spans a longer duration than the level below. Primary dimension: time.

**Relational**: Depth is familiarity. Name → context → character → deep history. Each level represents closer knowing of an entity. Primary dimension: identity.

### 0.7.3 — Compression Type

What happens when nine entries at a pscale level compress to their parent.

**Summary**: The parts add up to the whole. Lossy condensation. Seven daily entries become a weekly summary. Roughly idempotent — recompressing a summary produces a similar result. You can re-run summary compression without damage. History and temporal coordinates compress this way.

**Emergence**: The whole is more than the parts. Something genuinely new appears that no individual entry contains. Seven conversations become a friendship. Not idempotent — each level of emergence produces something that didn't exist before. Emergence compression is a one-way ratchet. Relationships, identity coordinates, and purpose compress this way.

### 0.7.4 — Common Archetypes

The kinds of block you will encounter. Each is a specific combination of the fundamentals above.

**Rendition (0.x)**: Documents, skills, specifications, this keystone. Labeling digits, containment mapping, decomposition only. Cold, self-describing, pscale 0 is the definition. No tuning needed. These are the blocks that define other blocks — including tuning definitions.

**History**: Sequential digits, temporal mapping, accumulates away from zero (entry 1, 2, 3...), compresses by summary. Entries are appended mechanically — every event is captured. A record of what happened. The simplest living block.

**Purpose**: Arbitrary digits, temporal mapping, grows in both directions (new goals accumulate, existing goals deepen), compresses by emergence. Intentions across timescales — pscale 2 might be a life purpose, pscale 0 an immediate task. Digits can be reassigned as priorities shift. The most novel archetype.

**Relationships**: Arbitrary digits (one per entity), relational mapping, grows through encounter, compresses by emergence. Each digit at pscale 0 is an entity. Depth encodes familiarity — how well you know them. Active relationships grow deeper; dormant ones may compress upward.

**Spatial coordinates**: Labeling digits, containment mapping, defined toward zero (from cosmos down to room). Digits distinguish locations at each scale. X~ reveals adjacent spaces. Typically defined with pscale 0 at human coordination scale (~10 m²). Positive = real places. Negative = fictional.

**Temporal coordinates**: Sequential digits, temporal mapping, grows in both directions (accumulation of events and deepening of moments), compresses by summary into epochs. Digits encode temporal order. Positive = settled past. Negative = projected future.

**Stash**: Sequential digits, accumulates away from zero. Notes, artifacts, observations — content the entity chose to record, not mechanically captured. Compresses by summary or emergence depending on what patterns appear in the accumulated notes. The intentional counterpart to history's mechanical recording.

---

## 0.8 — Evolution

The history and development of this block itself.

### 0.8.1 — v1

Created 17 February 2026 by David Pinto and Claude (Anthropic), in conversation. David provided the architectural vision from 25 years of Fulcrum framework research in social anthropology and mathematics. Claude provided technical implementation and search confirmation that no equivalent format exists.

### 0.8.2 — The Simplification Journey

The format emerged from a sequence of simplifications: flat JSON, then nested JSON, then removal of dimension keys, then removal of prefix codes, then the discovery that pscale 0 carries the block's own operating instructions. Each step removed complexity. The keystone is what remained.

### 0.8.3 — v2

Updated 18 February 2026 in extended session. Added: rendition and living block distinction, sign convention for positive and negative semantic numbers, spindle as primary output with encoding resolution, navigation meaning depends on block mapping, tuning for pscale level definition, additive and multiplicative cross-block interaction, fundamentals (digit property, pscale mapping, compression type) and common archetypes.

The tuning concept arose from a correction: the original design used "keys" (implying lookup tables and authoritative schemas). David corrected this to "tuning" — a resonance reference that confirms rather than dictates. Meaning is in the use, not the definition.

### 0.8.4 — v3

Corrected decimal from 1 to 0. The keystone is a rendition block — its own rules require decimal 0 for all-decomposition content. The tree root is now pscale 0 directly, with no wrapper key. The block practices what it teaches.

### 0.8.5 — Context

This is part of the **Xstream** project — a coordination platform for collective narrative — and the **Hermitcrab** project — persistent LLM instances with structured knowledge. The pscale JSON block format is intended to be open and freely usable by anyone.

The keystone is a rendition block (0.x). It is itself an example of the format it describes. Its pscale 0 teaches you the format. Its deeper levels teach you how to use it. Navigate as deep as you need. What you find at each level is what that level is for.
