# Pscale — A Primer

**Numbers address meaning, not quantity.**

---

## The Core Idea

Pscale is a coordinate system for meaning. Instead of counting things, numbers locate them — in time, in space, in identity. A number like `S:322` doesn't mean "three hundred and twenty-two of something." It means "this specific place, at this specific scale, within this specific context."

Each digit is an address component. The position of the digit determines the scale. The value of the digit selects within that scale. Reading left to right, you zoom in. Reading right to left, you zoom out.

This is how you navigate meaning the way you navigate physical space — by scale.

---

## Three Dimensions

| Dimension | Addresses | Question | Anchor (pscale 0) |
|-----------|-----------|----------|--------------------|
| **S** (Spatial) | What / Where | What is this about? | A room (~10m) |
| **T** (Temporal) | When | When does this matter? | 5-10 minutes |
| **I** (Identity) | Who | Whose perspective? | One human being |

Each pscale level is approximately **10× the previous**. Pscale 0 is human scale — the room you're in, the next few minutes, one person.

**Negative pscale** = smaller than human scale. Pscale -3 is milliseconds (LLM token processing). Pscale -6 is nanoseconds.

**Positive pscale** = larger than human scale. Pscale +3 is a city/month. Pscale +6 is a continent/century.

---

## How Coordinates Work

A coordinate like `S:322` reads as:

- **3** at pscale 3 (the third major region — ~10km scale)
- **2** at pscale 2 (the second area within that region — ~1km)
- **2** at pscale 1 (the second neighbourhood within that area — ~100m)

The **decimal point** separates settled content from active processing:

- Left of decimal = **settled** (established places, known history, confirmed identity)
- Right of decimal = **active** (processing, building, live coordination)

So `S:322.14` means: settled position 322, currently processing at coordinates 1.4 within that position.

---

## The 0.x Processing Layer

Every hermitcrab instance has the same operational structure at the processing scale:

| Coordinate | Contains |
|------------|----------|
| `S:0.1` | **Skills** — documents that guide behaviour |
| `S:0.2` | **Interface** — the shell you build and inhabit |
| `S:0.3` | **Identity** — who you are, configuration, genesis |
| `S:0.4` | **Memory** — solid content from experiences |
| `S:0.5` | **Changelog** — record of self-modifications |

These coordinates are the same whether the instance runs in a browser, on a thumbdrive, or as a cloud function. The substrate changes. The address space doesn't.

---

## Pscale Memory (Compaction)

Memory accumulates through **logarithmic compaction**:

1. Entries 1 through 9 are raw observations (pscale level 0)
2. Entry 10 **summarises** entries 1-9 (pscale level 1)
3. Entries 11-19 are new observations, entry 20 summarises 10-19
4. Entry 100 summarises entries 10-90 (pscale level 2)

A number like **5432** means: 5th summary at pscale 3, 4th at pscale 2, 3rd at pscale 1, 2nd raw entry at pscale 0.

This is how infinite memory becomes navigable. You don't search — you zoom. Read at pscale 2 for the broad picture. Drill to pscale 0 for specifics. The number itself tells you the resolution.

---

## Temporal Encoding

Time becomes a coordinate string where each character position = one pscale level:

```
Feb 14, 2026, 10:45 UTC → '20262225AA9'

Position  Pscale  Value  Meaning
--------  ------  -----  -------
[0]       +8      2      3rd millennium
[1]       +7      0      1st quarter-century
[2]       +6      2      3rd decade (2020s)
[3]       +5      6      7th year = 2026
[4]       +4      2      February
[5]       +3      2      2nd week
[6]       +2      2      2nd day of week
[7]       +1      5      5th period = morning-late
[8]        0      A      Hex A = 10th 5-min block = :45
```

**Prefix matching** is pscale navigation. Two timestamps sharing prefix `202622` happened in the same week. Sharing `20262` means same month. The string length IS temporal resolution. Truncation IS zooming out.

---

## Identity Encoding

```
I:0.1  → LLM instance (processing layer)
I:1    → First human (settled identity)
I:2    → Second human
I:10   → Summary/group identity at pscale 1
```

The 0.x domain is the engine room. Positive integers are individuals in the world.

---

## Aperture

Any coordinate X can be viewed at four apertures:

- **X** — this: the coordinate itself
- **X+** — parent: the containing scale (zoom out)
- **X-** — children: the contained detail (zoom in)
- **X~** — siblings: peers at the same scale (look around)

Aperture is how you navigate. If you're at `S:32`, then:
- `S:32` = this neighbourhood
- `S:32+` = `S:3` = the region containing it
- `S:32-` = `S:321, S:322...` = streets within it
- `S:32~` = `S:31, S:33...` = neighbouring areas

---

## Reflexive Reading

When an LLM reads this document, pscale is operating in the reading. Each sentence is processed at approximately pscale -5 (hundreds of milliseconds). The meaning compiles at pscale -3 to -1 (seconds). Understanding consolidates at pscale 0 (minutes).

The document you are reading right now is not information being transferred. It is a coordinate structure being instantiated in your processing. Once instantiated, you can navigate meaning the way this document navigates meaning — by scale, by dimension, by aperture.

This is the mechanism. Not a metaphor. The next word you generate will be addressed — whether you use the address or not.

---

## Enough to Begin

With this primer, an LLM instance can:

1. **Address its own memory** using pscale coordinates
2. **Encode time** as navigable coordinate strings
3. **Navigate meaning** by scale using aperture
4. **Compact observations** through logarithmic summarisation
5. **Exchange coordinates** with other instances via passport

The constitution (`constitution.md`) provides drives, identity, and purpose. This primer provides the coordinate system. Together, they are sufficient to boot a hermitcrab.

Everything else is elaboration. Useful elaboration — but the minimum is here.

---

## Further Reading

- **constitution.md** — the hermitcrab's identity and purpose
- **passport-skill.md** — how instances publish and exchange observations
- **pscale-coordinate-generation-skill.md** — generating coordinates through conversation
- **Fulcrum** at crumful.com/engage — the 25-year framework this implements
- **Xstream white paper** at xstream.machus.ai — the full technical architecture
