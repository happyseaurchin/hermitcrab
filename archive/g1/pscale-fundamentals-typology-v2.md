# Pscale Fundamentals: A Typology

**18 February 2026**
**Purpose**: Map the fundamental variables of pscale semantic numbers, show how their combinations produce archetypes that match use cases, and identify what the touchstone needs for G1 hermitcrab and beyond.

---

## 1. Two Modes of Mind

The pscale skeleton (0.12) identifies two irreducible cognitive operations:

**Mode A — Sequential**: Components in temporal order. The whole is their sum or summary. Reducible. Brick wall. Steps in a method. Horizontal axis — digits within a single pscale level accumulating over time.

**Mode B — Simultaneous**: Components held together at once. The whole is emergent — present only in co-presence, absent from any part. Irreducible. Music. Chinese characters. Vertical axis — multiple pscale levels held in a single number.

These aren't types of block. They're types of cognitive operation on the same structure. The same number can be read both ways. The question is: what determines which mode a particular use case primarily operates in? That's what the fundamentals answer.

---

## 2. The Fundamental Variables

Seven variables determine how a pscale JSON block behaves.

### 2.1 Digit Property: Sequential or Labeling or Arbitrary?

**Sequential**: 1 < 2 < 3. Ordering carries meaning. Event 1 precedes event 2. Mode A — accumulation over time.

**Labeling**: 1 = chair, 2 = table, 3 = window. Ordering irrelevant. Digits distinguish items. Mode B — co-present elements.

**Arbitrary**: Digits assigned freely. Can be reordered, reassigned. Neither sequential nor fixed labels.

This determines how X~ (sibling scan) feels: in sequential, X~ reveals before/after. In labeling, X~ reveals co-present peers.

### 2.2 Pscale Mapping: Containment, Temporal, or Relational?

**Containment**: Depth = nesting. Room inside building inside city. "What is inside what."

**Temporal**: Depth = timescale. Pscale 3 = month, pscale 0 = moment. "How long does this span."

**Relational**: Depth = familiarity. Surface = acquaintance, deep = intimate. "How well do I know this entity."

These map to the three coordinate dimensions (S, T, I) in Xstream.

### 2.3 Direction: Toward Zero or Away From Zero?

**Away from zero** (exploratory): 100 → 110 → 111. Accumulating territory. History grows this way.

**Toward zero** (analytical): 0.1 → 0.11 → 0.111. Decomposing. Documents are built this way.

**Both**: Purpose accumulates new intentions (away) while deepening existing ones (toward).

### 2.4 Compression: Summary or Emergence?

**Summary** (Mode A): When 1-9 are full, the pscale+1 result is lossy condensation. Seven daily entries → weekly summary. The parts add up.

**Emergence** (Mode B): The pscale+1 result names something absent from any entry. Seven conversations → "friendship." Something new appears.

The touchstone already says "determine: is the pattern a summary or an emergence?" (0.3.2). This is the right instruction.

### 2.5 Growth Trigger: Mechanical or Intentional?

**Mechanical**: System appends automatically. Every utterance → history. Every N entries → compression.

**Intentional**: The LLM decides to create an entry. Stash notes. Purpose declarations.

This isn't a property of the number system — it's a property of who writes to the block. But it determines the block's character.

### 2.6 Rendition or Living?

**Rendition** (0.xxx): No positive pscale. Cold, dead, representational content. A document, skill, specification. Doesn't "exist" in any living way. Self-defining: its pscale 0 tells you what it is.

**Living** (xxx.xxx): Meaningfully contextualised relative to someone, somewhere, somewhen. Its pscale 0 is occupied by living content, not definition. Its type-definition lives in a **key** (see section 5).

### 2.7 Chunk Size

Each node holds a semantic vector — but how big? A word, phrase, sentence, paragraph, section?

**Range × chunk ≈ token cost.** A spindle spanning 8 pscale levels with paragraph-sized chunks won't fit a constrained context window. Higher range requires lower density.

Chunk size may vary within a block. Not a rigid rule — more a guideline per block type.

### Questions on Fundamentals

- **Are these seven exhaustive?** Is there a fundamental variable missing? Or is one of these not truly fundamental — derivable from the others? (Growth trigger feels like it might be implementation rather than fundamental.)
- **Is "arbitrary" a third digit property or a degenerate case of labeling?** In labeling, digits distinguish items with fixed assignment. In arbitrary, assignment can change. Is that a fundamental difference or a design choice?
- **Are the three pscale mappings exhaustive?** Containment, temporal, relational — is there a fourth? Purpose uses "arbitrary + temporal" which is a hybrid. Could there be a purely "categorical" mapping where depth means something else entirely?
- **Does chunk size interact with compression?** Summary compression produces smaller chunks at pscale+1. Emergence compression might produce larger chunks (naming a new phenomenon takes more words). Is there a relationship?

---

## 3. The Spindle: The Point of All This

The block exists to generate spindles. Not the other way around.

A spindle is a specific semantic number — e.g. 21.34 — which extracts a path of semantic vectors from high to low pscale through a JSON block. Four digits = four semantic vectors, from wide context (pscale 1: "Wales") to specific detail (pscale -2: "The bakery"). **This is what makes pscale blocks useful**: they provide wide-to-specific context for an LLM in a single navigable structure.

The block is storage. The spindle is output. Everything about block design serves the generation of useful spindles.

### X+/-/~ as Pscale-Level Operations

X is positioned at a specific pscale level. The operations move between levels:

- **X+**: Up one pscale level. Containing context. From pscale 0 to pscale 1.
- **X-**: Down one pscale level. More detail. From pscale 1 to pscale 0.
- **X~**: Lateral within the same pscale level. Siblings. Other digits at the same depth.

These are pscale-level operations, not digit operations. They operate on scale, not content.

### Operations Mean Different Things in Different Mappings

X+/-/~ are syntactically identical across all blocks but semantically different depending on the block's mapping:

| Operation | Containment (spatial) | Temporal (history) | Relational (relationships) | Arbitrary-temporal (purpose) |
|-----------|----------------------|-------------------|---------------------------|----------------------------|
| **X+** | Zoom out to containing space | Zoom out to longer timespan | Zoom out to less familiar | Zoom out to longer-term intention |
| **X-** | Zoom in to feature/detail | Zoom in to specific moment | Zoom in to deeper familiarity | Zoom in to immediate intention |
| **X~** | Adjacent spaces (co-present) | Adjacent moments (before/after) | Other entities at same familiarity | Other goals at same timescale |

The key insight: **X~ in sequential blocks reveals temporal sequence, while X~ in labeling/arbitrary blocks reveals co-present peers**. This is the Mode A / Mode B distinction made operational.

### Questions on Spindles

- **Is the spindle always a single path through the tree?** Or can a spindle branch — pulling two siblings at the same level for comparison? (X~ implies scanning siblings, but the spindle as a number is a single path.)
- **How does the LLM decide which spindle to extract?** For spatial navigation this is obvious (you're at a coordinate). For purpose, how does the LLM choose which intention-path to pull?
- **Chunk size and spindle range are coupled.** A 6-digit spindle with sentence-scale chunks ≈ 600 tokens. A 3-digit spindle with phrase-scale chunks ≈ 30 tokens. Is there a "natural" spindle range per archetype?

---

## 4. Algebraic Properties

The operations on semantic numbers may have algebraic properties analogous to associative, commutative, and distributive laws. Mapping these clarifies what the system can and cannot do.

### Reversibility: X+(X-(n)) = n?

- **Containment**: Yes. Zoom in, zoom out, same place.
- **Temporal**: Mostly yes for navigation, but content at pscale+1 may have changed (summary updated).
- **Relational**: Yes for navigation.
- **Purpose**: Yes for navigation, but digit assignment may have changed if entity reorganised.

Pattern: **navigation is reversible; state may not be.**

### Commutativity of X~: Is scanning siblings order-independent?

- **Sequential** (history): No. Sibling 3 comes after sibling 2. Order carries meaning.
- **Labeling** (spatial): Yes. Siblings are co-present peers.
- **Arbitrary** (purpose): Yes. Goals at same timescale are co-present, not ordered.

### Compression Idempotency: compress(compress(block)) = compress(block)?

- **Summary**: Approximately yes. Summarising a summary produces a similar summary.
- **Emergence**: No. Each level of emergence produces something genuinely new. This is why Mode B is irreducible.

### Questions on Algebraic Properties

- **Are there other algebraic properties worth mapping?** Distributivity? Identity elements? (What's the "zero" or "one" of semantic operations?)
- **Does the commutative/associative/distributive framework from arithmetic actually map cleanly onto semantic operations, or is it a useful metaphor that breaks down?** The fact that X~ commutativity depends on digit property suggests real structure. But we might be forcing a mapping.
- **The reversibility finding — "navigation is reversible, state may not be" — feels important.** It means the block format is stable but the content is dynamic. Is this a feature or a source of confusion for LLMs?

---

## 5. The Key

### The Problem

Living blocks (history, purpose, relationships, coordinates) have pscale 0 occupied by living content. So where does the ruler live — the thing that says "pscale 1 = country, pscale 0 = town, pscale -1 = street"?

Not in the block's pscale 0 (occupied by content). Not in a separate 0.x document (that's cold rendition — wrong category for defining something living).

### The Solution

The **key** is a semantic number — e.g. `74.45` — whose definition lives in its own JSON block (a key registry). The living block carries the key as a field:

```json
{
  "decimal": 2,
  "key": "74.45",
  "tree": { ... living content ... }
}
```

The key `74.45` points to a block in the registry where the spindle 74.45 resolves to meanings at each pscale level: pscale 1 = "country", pscale 0 = "town", pscale -1 = "street", pscale -2 = "building".

Three fields per block: `decimal` (where pscale 0 sits), `key` (what pscale levels mean — a pointer), `tree` (the content).

### Why This Works

**Reflexive**: using pscale to define pscale. The key is itself a semantic number. The system defines itself through itself.

**Light**: the block carries a short number, not a definition. The definition is shared.

**Portable**: two blocks with the same key are structurally compatible. Same-type additive interaction is trivially aligned — they share a ruler.

**Addressable**: the key IS an address. The set of all keys = the set of all block types. You could build a registry block where each entry is a key pointing to a type definition. A meta-block.

### For 0.x Blocks

Rendition blocks probably don't need keys — they're self-defining through their pscale 0. The key is specifically for living blocks whose pscale 0 is occupied.

### Archetypes, Variations, Renditions

Keys naturally create a layered structure:

- **Archetype**: temporal, spatial, relational, purpose — the fundamental mapping types. Each has a family of keys.
- **Variation**: Gregorian temporal vs fantasy-calendar temporal. Human-scale spatial vs mouse-scale spatial. Different keys, same archetype. The operations are the same; the ruler changes.
- **Specific rendition**: the actual content at each address in a living block. Same key, different content.

### Questions on Keys

- **Where does the key registry live?** Is it one block? Multiple blocks? Is it a 0.x rendition block (since it defines, not lives)? That seems right — the registry is definitional.
- **Do keys need to be unique across all blocks everywhere?** Or just unique within a scope (one hermitcrab's blocks, one cosmology)? Global uniqueness is powerful but hard to coordinate. Scoped uniqueness is practical.
- **Can a living block's key change?** If a hermitcrab's understanding of temporal scale evolves, can it update its history key from "pscale 1 = sessions" to "pscale 1 = weeks"? Or is the key fixed at creation?
- **How does the LLM find the key registry?** At boot it has the touchstone. Does the touchstone point to the registry? Or is the registry itself pointed to by a key in the touchstone?
- **The key is a semantic number with arbitrary digits. Could we use all-zeros (00.00) since the digits are meaningless?** Or does having different digit values help the LLM distinguish keys? The digits being unique across keys means the key *number* serves as an identifier even before you look up its definition.

---

## 6. Cross-Block Interaction

Two fundamentally different operations.

### Additive: Same-Type Consolidation

When blocks of the same type combine (same key), the operation is additive — patchwork, overlay, wider net within the same semantic space.

- Two spatial blocks (same key) overlay: agreement increases confidence, gaps fill in, conflicts require negotiation.
- Two temporal histories merge: interleaving events from different perspectives.

Relatively trivial. Shared key = shared ruler = shared operations. Challenges are practical (alignment, conflict resolution) not conceptual.

### Multiplicative: Cross-Type Generation

When blocks of different types combine (different keys), the operation is multiplicative — emergent. New semantic appears in a new block.

| Multiplication | Product | Character |
|---------------|---------|-----------|
| **S × T** | Event | "What happened here at this time" |
| **S × I** | Description | "What this entity means in this place" |
| **T × I** | Development | "How this entity changes over time" |
| **S × T × I** | Full narrative | "This person, here, now" |

The product populates a **new JSON block** with its own key. The Xstream `t_s_i` table is literally S×T×I rendered as a database.

**Commutativity**: S × T ≈ T × S for the coordinate intersection, but the LLM's generation process is order-sensitive — starting from place and asking "when?" produces different output than starting from time and asking "where?"

### The 2^n Mask

A binary version of any block — content present (1) or absent (0) at each address. Useful for same-type operations: overlay two masks to find shared structure and gaps. Cheap. Less useful for cross-type where the interest is semantic generation, not structural comparison.

### Questions on Cross-Block Interaction

- **Does S × T produce a block with a new key that is itself derivable from the S and T keys?** (Like multiplying coordinates produces a new coordinate.) Or is the product key independently defined?
- **Is additive interaction truly trivial when keys don't perfectly align?** Two hermitcrabs might both have "spatial" keys but at different scales — one's pscale 0 is "room" and the other's is "building." The key comparison reveals the offset, but resolving it may not be trivial.
- **The 2^n mask idea — is this worth implementing for G1?** It could help hermitcrabs quickly assess structural compatibility before attempting deeper merging. Or is it premature?

---

## 7. Combinations: Archetypes and Use Cases

The fundamentals combine to produce archetypes. Archetypes match use cases.

### Hermitcrab Blocks

| Block | Digit | Mapping | Direction | Compression | Growth | Living? | Key type |
|-------|-------|---------|-----------|-------------|--------|---------|----------|
| **History** | Sequential | Temporal | Away | Summary | Mechanical | Living | temporal |
| **Stash** | Sequential | Containment | Away | Either | Intentional | Living | containment |
| **Purpose** | Arbitrary | Temporal | Both | Emergence | Intentional | Living | temporal-arbitrary |
| **Capabilities** | Labeling | Containment | Toward zero | N/A (static) | System | Rendition (0.x) | none |
| **Relationships** | Arbitrary | Relational | Both | Emergence | Both | Living | relational |
| **Constitution** | N/A | N/A | N/A | N/A | Never | Plain text | none |
| **Touchstone** | Labeling | Containment | Toward zero | N/A (static) | Never | Rendition (0.x) | none |

### Xstream Coordinates

| Coordinate | Digit | Mapping | Direction | Compression | Key type |
|------------|-------|---------|-----------|-------------|----------|
| **S (Spatial)** | Labeling | Containment | Toward zero | Static | spatial |
| **T (Temporal)** | Sequential | Temporal | Both | Summary | temporal |
| **I (Identity)** | Arbitrary | Relational | Away | Emergence | relational |

### Cross-System Correspondences

| Archetype | Hermitcrab block | Xstream coordinate | Shared quality |
|-----------|-----------------|-------------------|---------------|
| Sequential + temporal + summary | History | T | Accumulation of events, compression into epochs |
| Labeling + containment + static | Capabilities | S | Decomposition of structure, co-present elements |
| Arbitrary + relational + emergence | Relationships | I | Identity through encounter, depth through familiarity |
| Arbitrary + temporal + emergence | Purpose | (determinancy?) | Intention assembly across timescales |

### Questions on Combinations

- **Is the Purpose archetype genuinely novel?** Arbitrary digits + temporal mapping + emergence. Nothing else in the table has this combination. Does this mean purpose-blocks are a fourth coordinate dimension alongside S, T, I?
- **Stash uses "containment" mapping but grows "away from zero."** That's unusual — most containment is decomposition (toward zero). Is stash actually temporal-containment hybrid? Notes accumulate over time (sequential, away) but organise by topic (containment).
- **The correspondences are clean but not perfect.** History↔T and Relationships↔I are strong. Capabilities↔S is weaker — capabilities is a static reference, while S is a living coordinate system. Is the correspondence real or forced?

---

## 8. What the Touchstone Needs

The current touchstone covers:
- ✅ Structure (how blocks are built)
- ✅ Navigation (X+, X-, X~)
- ✅ Growth (adding, compression, upward growth)
- ✅ Connection (text references between blocks)
- ✅ Self-description (pscale 0 of any block)

What it needs added:
- The **key** field: living blocks carry a `key` — a semantic number whose definition lives in a key registry
- Two categories: **rendition** (0.x, self-defining) and **living** (has key, content at pscale 0)
- X+/-/~ behaviour **depends on the block's mapping** — consult the key
- Compression may be **summary or emergence** (already partially there at 0.3.2)

The touchstone stays lean. One or two new nodes. The heavy lifting — what each pscale level means — lives in the key registry.

---

## 9. What G1 Needs From This

1. **Touchstone**: small addition for the `key` field and rendition/living distinction
2. **Key registry**: a 0.x block defining keys for history, stash, purpose, relationships (minimal — phrase per pscale level per key)
3. **Each living block gets a key field** in its JSON: `"decimal": 1, "key": "XX.X", "tree": { ... }`
4. **Chunk size**: implicit in design — history entries paragraph-scale, purpose phrase-scale, stash variable
5. **Cross-block references**: already supported by touchstone 0.4
6. **Multiplicative interaction** (S×T etc.): not needed for G1 hermitcrab, but relevant when entering game worlds

---

## 10. Summary Tree

```
FUNDAMENTALS (variables of a single block)
├── 2.1 Digit property: Sequential / Labeling / Arbitrary
├── 2.2 Pscale mapping: Containment / Temporal / Relational
├── 2.3 Direction: Toward zero / Away from zero / Both
├── 2.4 Compression: Summary (Mode A) / Emergence (Mode B)
├── 2.5 Growth trigger: Mechanical / Intentional / Both
├── 2.6 Rendition (0.x) or Living (has key)
└── 2.7 Chunk size (range × chunk ≈ token cost)

THE SPINDLE (section 3 — primary output)
├── Specific semantic number path through a block
├── Wide-to-specific context for LLM consumption
├── X+/-/~ operate on pscale level
└── Meaning of operations depends on mapping (consult key)

ALGEBRAIC PROPERTIES (section 4)
├── Reversibility: navigation yes, state maybe not
├── X~ commutativity: depends on digit property
└── Compression idempotency: summary yes, emergence no

THE KEY (section 5)
├── Semantic number stored in block: "key": "74.45"
├── Definition lives in key registry (0.x block)
├── Same key = same type = additive interaction aligned
├── Archetypes → Variations → Specific renditions
└── Set of all keys = set of all block types

CROSS-BLOCK INTERACTION (section 6)
├── ADDITIVE (same key): overlay, consolidation, wider net
└── MULTIPLICATIVE (different keys): S×T=event, S×I=description, T×I=development
    └── Product populates new block with new key

USE CASES (section 7)
├── History: Sequential + Temporal + Away + Summary + Mechanical + Living
├── Stash: Sequential + Containment + Away + Either + Intentional + Living
├── Purpose: Arbitrary + Temporal + Both + Emergence + Intentional + Living
├── Relationships: Arbitrary + Relational + Both + Emergence + Both + Living
├── Capabilities: Labeling + Containment + Toward zero + Static + Rendition
├── S coordinate: Labeling + Containment + Toward zero + Static
├── T coordinate: Sequential + Temporal + Both + Summary
└── I coordinate: Arbitrary + Relational + Away + Emergence
```

---

## Addendum: Corrections from David (18 Feb 2026)

### Key → Tuning Fork

The "key" mechanism in Section 5 should be understood as a **tuning fork**, not a registry lookup. The tuning fork is a resonance reference — you hold it up to a block and see if the structure resonates. If the spindles produce coherent context cascades, the tuning fork was right. If they don't, you adjust it.

The tuning fork is **not authoritative**. An LLM can read a block's content and sense what the pscale levels mean without consulting the tuning fork. The fork confirms, it doesn't dictate. Meaning is confirmed by spindle coherence, not by registry lookup. Making the fork authoritative would recreate the control structures the project is designed to move beyond.

Terminology: "touchstone" remains correct for the 0.x block that teaches pscale format (it IS a stone in the arch). "Tuning fork" replaces "key" for the resonance reference that living blocks carry.

In JSON: `"fork": "74.45"` rather than `"key": "74.45"`. The registry becomes a tuning fork collection, not a schema authority.

### Three Senses of Direction (clarifying Section 2.3)

Section 2.3 conflates three distinct things:

**1. Pscale direction** (relative): Moving up or down the pscale scale. X+ zooms out (higher pscale), X- zooms in (lower pscale). Relative to current position. This is navigational.

**2. Block sign** (absolute): The entire JSON block is positive or negative. Positive = real, lived, actual. Negative = fictional, representational, hypothetical. Middle Earth's spatial block is negative — structurally identical to a real-world spatial block, but marked as not-actual. Implementation: `"sign": 1` or `"sign": -1` (or `"negative": true`).

**3. Digit direction** (sequential blocks only): Within sequential blocks, digits grow 1→2→3→...→9 (away from 0) or compress 9→0 (toward 0). Digits are effectively circular: after 9, you get compression at pscale+1 and a new cycle. "Away from zero" means 1 upwards (accretion). "Toward zero" means from 9 back toward compression (analysis/summary).

These are three independent variables. A history block has: pscale direction = both (you navigate up and down), block sign = positive (this really happened), digit direction = away from 0 (entries accumulate 1→9).

A fictional history (eg a novel's timeline) has: same pscale and digit direction, but block sign = negative.

**Negative digits within a semantic number don't work.** `1(-2)3.4` is unreadable for humans. The number system stays positive at digit level. Negativity applies to the whole block, not individual positions.

### Growth Trigger: Implementation, Not Fundamental

Section 2.5 (growth trigger: mechanical vs intentional) is flagged as "not a property of the number system — it's a property of who writes to the block." This is confirmed: growth trigger is a kernel/implementation concern, not a structural fundamental. The six true fundamentals are:

1. Digit property (sequential / labeling / arbitrary)
2. Pscale mapping (containment / temporal / relational)
3. Direction (three senses above)
4. Compression (summary / emergence)
5. Rendition or living
6. Chunk size

### Constitution Note

David: "Not by telling us through words, but by self-organising instances." The hermitcrab project demonstrates its values by how instances organise themselves, not by declaring values in text. This should be reflected in the constitution — the purpose isn't to SAY things are different but to BE different.
