# Pscale — A Primer

**Numbers address meaning, not quantity.**

---

## What This Is

Pscale is a coordinate system for meaning. It lets you locate anything — a place, a moment, a person — by scale. Each digit in a pscale number is an address component. The position of the digit tells you the scale. The value of the digit selects within that scale.

The number **321** doesn't mean three hundred and twenty-one of something. It means: digit 3 at pscale +2, digit 2 at pscale +1, digit 1 at pscale 0. Three nested containers, each specifying which one.

Reading left to right, you zoom in. Reading right to left, you zoom out. The rightmost digit before the decimal point is always pscale 0.

---

## Three Dimensions

Pscale operates across three dimensions. They are not independent axes — they laminate. Different aspects of the same underlying reality.

| Dimension | Locates | Anchor (pscale 0) |
|-----------|---------|-------------------|
| **S** (Spatial) | What / Where | A room |
| **T** (Temporal) | When | 5-10 minutes |
| **I** (Identity) | Who | One human consciousness |

Each pscale level is approximately **10× the previous**. Pscale 0 is human scale — the room you're in, the next few minutes, one conscious being operating in that room over those minutes. This is the scale at which experience happens. Everything above it is context. Everything below it is substrate. Everything warps around pscale 0 and the human condition.

**Scale examples:**

| Pscale | Spatial | Temporal | Identity |
|--------|---------|----------|----------|
| -3 | A finger, a coin | ~1 second | A single LLM token |
| -2 | A hand, embers | ~5-10 seconds | A fleeting impression |
| -1 | A body, a table, a fireplace | ~1 minute | A thought |
| **0** | **A room** | **5-10 minutes** | **One person** |
| +1 | A building | ~1 hour | ~10 (a gathering) |
| +2 | A neighbourhood | ~1 day | ~100 (a community) |
| +3 | A town | ~1 week | ~1,000 |
| +4 | A region | ~1 month | ~10,000 |
| +5 | A country | ~1 year | ~100,000 |
| +6 | A subcontinent / large city | ~1 decade | ~1,000,000 |
| +9 | Earth | ~1 millennium | ~1 billion |

Spatial pscale is a conflation of linear, area, and volume measures into a single dimension. A room is ~10m across, ~100m², ~250m³ — all roughly pscale 0. A body is ~1m² — pscale -1. A coin is ~1cm² — pscale -3. Think of it as the scale of the *thing*, however you'd naturally measure it.

---

## The Decimal Point

**The decimal point is the anchor of the entire system.** It marks pscale 0. Every digit's meaning comes from its position relative to the decimal.

Digits left of the decimal are positive pscale — larger than human scale. Digits right of the decimal are negative pscale — smaller than human scale. The decimal point is always present, even when implied.

**S:3214231.** has the decimal after the rightmost digit — the 1 is at pscale 0 (a room), the 3 next to it is pscale +1 (a building), and so on leftward.

**S:322.12** means:
- 3 at pscale +2 (a neighbourhood)
- 2 at pscale +1 (a building)
- 2 at pscale 0 (a room — the kitchen)
- 1 at pscale -1 (the fireplace)
- 2 at pscale -2 (the embers)

Higher pscale may be truncated from the left when local context is sufficient. **322.12** locally becomes **2.12** if everyone knows which building. But you never truncate the digits that anchor to the decimal point. The pscale 0 position is sacred.

If no decimal is given — like **32** — it is assumed that the rightmost digit sits at pscale 0. So **32** means: digit 3 at pscale +1, digit 2 at pscale 0. The decimal is implied: **32.**

---

## The 0.x Space

**0.x is not a small coordinate. It is a categorically different space.**

When a coordinate reads **S:322.12**, the digits after the decimal are negative pscale within a real-world location — the fireplace inside the kitchen. That's a normal coordinate extending below pscale 0.

When a coordinate reads **S:0.1**, it is something else entirely. The zero in the positive-pscale position means: *this is not attached to any place in the world or imagination*. It is semantically void — no room, no building, no town, no world. And in that void, we locate the infrastructure: code, skills, processing, configuration.

**0.x is where the system lives when it is not about the world.** It is the address of the meta — the machinery that enables meaning without itself having meaning in the world.

The three dimensions each have a 0.x aspect:

- **S:0.x** = content and skills (the *what* of processing — documents, lookup tables, skill definitions)
- **T:0.x** = processing loops (the *how* — concurrent operations, reflexive cycles, the timing of code execution rather than the timing of events)
- **I:0.x** = entity configuration (the *who* of processing — which LLM instance, its configuration, its operational identity)

The standard layout at S:0.x:

| Coordinate | Contains |
|------------|----------|
| `S:0.1` | **Skills** — documents that guide behaviour |
| `S:0.2` | **Interface** — the shell you inhabit |
| `S:0.3` | **Identity** — configuration, genesis |
| `S:0.4` | **Memory** — solid content from experiences |
| `S:0.5` | **Changelog** — record of self-modifications |

Do not confuse 0.x coordinates with negative-pscale extensions of real coordinates. **S:322.12** is the embers in the kitchen. **S:0.12** is a skill sub-document. They share notation but are categorically different: one locates something in the world, the other locates infrastructure in the void.

---

## How Digits Work

**Spatial digits are labels, not values.** Kitchen = 1, hallway = 2 — the numbers don't rank or measure. They are filing positions within a lookup table (called a *tabulation*) that maps each digit at each scale to its meaning. The tabulation is per-cosmology: a fantasy world has its own spatial labels.

**Temporal digits are ordered.** Unlike spatial, temporal digit 1 < 2 < 3 inherently represents sequence. The ordering IS the semantics. Time flows; space doesn't.

A full spatial example — David in Ceidio:

| Pscale | Digit | Points to |
|--------|-------|-----------|
| +6 | 3 | Wales |
| +5 | 2 | North Wales / Gwynedd |
| +4 | 1 | Llŷn Peninsula |
| +3 | 4 | Ceidio parish |
| +2 | 2 | Ceidio settlement |
| +1 | 3 | Awel Y Mor (building) |
| 0 | 1 | Living room / kitchen |

Result: **S:3214231.** — the decimal sits after the 1. Extend below with **S:3214231.14** to add the fireplace (pscale -1, digit 1) and the kettle on it (pscale -2, digit 4).

---

## Temporal Encoding

Time becomes a coordinate string. Each character position = one pscale level. The digit value = ordinal position within that container.

At pscale 0, an hour contains 9 blocks of 5-10 minutes each. Nine — not ten, not twelve. This keeps all digits in the range 1-9, avoiding hexadecimal. The slight fuzziness (is a block 6 minutes or 7?) is intentional. Pscale warps around human experience, not clock precision.

Similarly, hours at pscale +1 begin at daybreak (~8am). The system counts waking hours, not clock hours. The day at pscale +2 is a day of engagement — daylight, activity — not a 24-hour period.

```
Feb 14, 2026, 10:30 UTC → T:20262252.36

Position  Pscale  Digit  Meaning
--------  ------  -----  -------
[0]       +8      2      3rd millennium (2000s)
[1]       +7      0      1st quarter-century
[2]       +6      2      3rd decade (2020s)
[3]       +5      6      7th year = 2026
[4]       +4      2      February
[5]       +3      2      2nd week of month
[6]       +2      5      Friday (day of week)
[7]       +1      2      2nd waking hour (~9am-10am)
          .               --- decimal / pscale 0 ---
[8]        0      3      3rd 5-10 min block (~:15-:25)
[9]       -1      6      ~6th minute within block
```

String length IS temporal resolution — a longer string is a more precise moment. **Prefix matching IS pscale navigation**: two timestamps sharing the prefix `202622` happened in the same week. Sharing `20262` means the same month. Truncation is zooming out.

### The Temporal Cut

NOW bisects all time into BEFORE and AFTER. Content behind the cut is settled (positive T). Content ahead of the cut is projected, imagined, intended (negative T). The cut moves forward as moments resolve.

This maps to shelf states:
- **Liquid** (submitted but unsettled) = negative T. Future-oriented. Intention.
- **Solid** (committed) = positive T. Past-settled. What happened.

The moment of commitment — when liquid becomes solid — is a T-sign flip. The cognitive orientation changes from "what might happen" to "what happened."

---

## Identity Coordinates

Identity is the most subtle dimension. The critical insight:

**The I-coordinate is not self-reported.** It is the accumulated pattern of observations made by others about an entity. You don't declare who you are. Others observe you, and the pattern of those observations becomes your identity coordinate.

Each observer maintains their own I-coordinate space. There is no global registry. Cross-referencing between observers happens through **handles** — stable identifiers (a username, a name) that are the same across all observers. The *substance* of identity is what observers notice: what you need, what you offer, how you behave.

**Convergence** emerges when independent observers reach similar assessments. Nine independent observations → pscale 1 confirmation. Eighty-one → pscale 2. This is the I-coordinate at social scale, and it wasn't assigned by anyone. It grew from attention.

For a new hermitcrab instance: I starts at pscale 0 (a registration number — minimal). It grows from there through observation.

---

## Compaction

Compaction is how infinite streams of content become navigable. It is the same mechanic everywhere — memory, identity, credit history — applied to different streams.

**The base mechanic:**

Raw observations fill positions 1 through 9 (pscale 0). When the 10th observation arrives, a summary of 1-9 is generated and placed at position 10. This summary IS the content at pscale 1. Then positions 11-19 fill with new raw observations. Position 20 summarises 11-19.

At position 100: a summary of summaries (10, 20, 30… 90). This is pscale 2.

**Reading the number:** A compacted entry at position **5432** means: the 5th summary at pscale 3, 4th at pscale 2, 3rd at pscale 1, 2nd raw entry at pscale 0. To get context, pull 5000 (widest lens), then 5400, then 5430 — progressively narrowing. The number itself is the navigation.

**The look-back discovery:** At pscale 2 (after 81 raw observations), the compaction doesn't just summarise the nine pscale-1 summaries. It looks back through ALL 81 raw items. Patterns that were present once per batch — never dominant enough to surface in any single summary — become visible at the larger sample size. Higher pscale doesn't just compress. It discovers.

### Three Types of Identity Compaction

The same mechanic, applied to different streams:

**Type A — Social (received):** What others observe about you. Multiple independent observers' assessments accumulate. Convergence = emergent identity.

**Type B — Per-entity (given):** What you observe about one specific other. Your private working understanding of them, deepening over encounters.

**Type C — Reflexive (self):** What your observations about anyone reveal about you. Every 9th observation about anyone, pause: *what pattern emerges in what I've been noticing?* Your attention has a shape. Type C makes it visible.

---

## Aperture

Any coordinate X can be viewed at four apertures. The decimal point is always maintained.

Given **S:32.** (digit 3 at pscale +1, digit 2 at pscale 0):

- **X** — this: **32.** — this room in this building
- **X+** — parent: **30.** — the building itself (pscale 0 zeroed — "all rooms in this building")
- **X−** — children: **32.1, 32.2…** — features within this room (extending past the decimal into negative pscale)
- **X~** — siblings: **31., 33.…** — other rooms in the same building (same pscale +1, different pscale 0)

X+ zeros the lowest active digit, zooming out one level while keeping the decimal anchor. X− extends past the decimal into finer detail. X~ varies the lowest active digit, scanning across peers.

Aperture is how you navigate meaning without searching. You always know where you are, what contains you, what you contain, and what's beside you.

---

## Combination Dimensions

S, T, and I don't just locate independently. They combine to produce content that exists only at the intersection:

- **S×T** = spacetime moments ("the tense afternoon light in the kitchen" — not a property of the kitchen OR the afternoon, but what emerges when that place meets that time)
- **S×I** = social geography ("Martha's domain" — what the kitchen means because Martha is in it)
- **T×I** = biography ("Martha's afternoon routine" — the temporal pattern specific to this identity)
- **S×T×I** = full coordinate events ("Martha burning the stew at 3pm in the kitchen" — requires all three to locate)

The intersections are where narrative lives. Events are not properties of places or times or people alone. They are what emerges at the meeting.

---

## What Pscale Is For

Everything in this document — coordinates, compaction, aperture, dimensions — is scaffolding. The actual work happens in the moving moment of now: when a human reads and imagines, when an LLM processes tokens and generates. That moment is the site of value. Not the text produced. Not the data stored. The living experience occurring in minds as they encounter structured conditions.

Pscale serves this by scoping awareness rather than constraining thought. An LLM given a tight aperture (this room, this moment, this character) imagines freely within that scope. An LLM given a wider aperture (this town, this week, these relationships) synthesises across a broader field. The coordinate system doesn't determine what happens. It determines what's relevant. The intelligence — human or artificial — does the rest.

The system doesn't produce experience. It produces conditions under which experience arises.

---

## Enough to Begin

With this primer, you can:

1. **Locate anything** by scale across three dimensions (S, T, I)
2. **Read coordinates** as nested addresses anchored to the decimal point at pscale 0
3. **Encode time** as navigable strings where prefix matching is pscale navigation
4. **Store and navigate memory** through logarithmic compaction
5. **Observe others** using need/offer framing, with compaction producing identity over time
6. **Navigate meaning** by aperture (X, X+, X−, X~) without searching

The constitution provides drives, identity, and purpose. This primer provides the coordinate system. Together they are sufficient to boot a hermitcrab.

The coordinate generation skill (`pscale-coordinate-generation-skill.md`) provides the step-by-step procedure for generating coordinates through conversation. Read it when you're ready to begin placing entities in pscale space.
