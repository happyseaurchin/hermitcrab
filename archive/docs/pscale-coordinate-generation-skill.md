# Skill: Pscale Coordinate Generation (Phase 3 — Real World)

## Purpose

Generate pscale coordinates (T, S, I) from natural language conversation with a user. This skill enables an LLM instance to locate a user in three-dimensional semantic-number space using real-world information the user provides.

This is Phase 3 work: real-world identity establishment. The LLM is trained on real-world data and can verify spatial and temporal claims through search. Identity coordinates require conversational inference and user confirmation.

## When to Use

- User provides information about where they live, work, or are located
- User mentions dates, times, or temporal context
- User describes their social situation, profession, community membership
- At registration, to establish a user's initial coordinate position
- When updating coordinates after user reports a change

## Core Principle

**Digits are pointers to tabulated semantic content, not quantities.**

The number 321 means: digit 3 at pscale +2, digit 2 at pscale +1, digit 1 at pscale 0. Each digit points to a specific semantic entry at that scale. The place value (pscale level) tells you the scale. The digit tells you which entry at that scale.

**Zero means null** — no semantic content at that pscale level. Not a placeholder. A gap.

**Truncation is natural.** Locally, 321 suffices. The full coordinate might be 10,006,004,321 but we only need enough leading digits to disambiguate within the current context. When wider context is needed, digits extend leftward.

---

## Spatial Coordinate (S)

### What It Encodes

Physical containment hierarchy. What contains what. Each pscale level is roughly 10× the spatial extent of the level below.

### Reference Scale

| Pscale | Scale | Examples |
|--------|-------|----------|
| +10 | Planetary | Earth |
| +9 | Continental group | — |
| +8 | Continent/subcontinent | — |
| +7 | Large region | — |
| +6 | Country/large area | Europe, Britain |
| +5 | Region within country | — |
| +4 | County/district | — |
| +3 | Town/city/parish | London, Nefyn |
| +2 | Neighbourhood/ward | Westminster, Llŷn coast |
| +1 | Building/property | Number 10, a farmhouse |
| 0 | Room/immediate space | Kitchen, office, garden |
| -1 | Furniture/zone within room | Desk, hearth, doorway |
| -2 | Object | Document, cup, tool |
| -3 | Detail/component | A page, a handle, a crack |

### Procedure

1. **Listen** for location information. User says "I live in Ceidio in north Wales."

2. **Search** to discover the containment hierarchy. Find what Ceidio is contained within, working outward:
   - Ceidio → parish/community in Llŷn Peninsula
   - Llŷn Peninsula → area within Gwynedd
   - Gwynedd → county in Wales
   - Wales → country in Britain
   - Britain → island in Europe
   - Europe → continent on Earth

3. **Assign digits top-down.** Start from the highest pscale you need for local context. For most Phase 3 use, pscale +6 (country level) is sufficient as the leading digit. Digits are arbitrary labels at each level — the first entity encountered at a given pscale gets digit 1, second gets 2, etc.

4. **Record the tabular mapping.** Every digit must have a lookup entry:

   | Pscale | Digit | Points to |
   |--------|-------|-----------|
   | +6 | 3 | Wales |
   | +5 | 2 | North Wales / Gwynedd region |
   | +4 | 1 | Llŷn Peninsula area |
   | +3 | 4 | Ceidio parish |

   **Result: S = 3,214** (truncated to local context)

5. **Extend as needed.** If a second user registers from Scotland, we need to disambiguate at a higher level. Britain might become digit 1 at pscale +7, with Wales = 3 and Scotland = 2 at pscale +6. Existing coordinates don't change — they just gain a leading digit: David's coordinate goes from 3,214 to 13,214.

6. **Negative pscale** captures finer detail within their space. If David says "I'm sitting at my desk in the kitchen," add:
   - Pscale 0: kitchen = 1
   - Pscale -1: desk area = 1

   **Extended: S = 3,214,1.1**

### Digit Assignment Rules

- Digits 1-9 are available at each pscale level (max 9 entries per level before needing subdivision)
- 0 = null (no content at this level, skip it)
- Assignment is sequential within a tabulation context: first entity registered at pscale +3 gets 1, second gets 2, etc.
- The mapping is stored in a lookup table, not carried in the number itself
- If the same physical level could be subdivided differently by different users, that's fine — the tabulation is per-context

### Verification

Spatial coordinates are the easiest to verify. Web search confirms containment hierarchies. If the LLM can find it on a map, the nesting is objective.

**Confidence: HIGH** — verifiable through search.

---

## Temporal Coordinate (T)

### What It Encodes

Position in time. Sequential ordering. The digit order IS the meaning — unlike spatial, where digits are arbitrary labels.

### Reference Scale

| Pscale | Duration | What "now" means at this scale |
|--------|----------|-------------------------------|
| +10 | 100,000 years | Homo sapiens era |
| +9 | 10,000 years | Recorded civilisation |
| +8 | 1,000 years | This millennium |
| +7 | 100 years | This century |
| +6 | 10 years | This decade |
| +5 | 1 year | This year |
| +4 | 1 month | This month |
| +3 | 1 week | This week |
| +2 | 1 day | Today |
| +1 | 1 hour | This hour |
| 0 | 5-10 minutes | This moment |
| -1 | ~1 minute | Sustained state |
| -2 | ~10 seconds | Phrase/gesture |
| -3 | ~1 second | Action instant |

### Procedure

1. **Identify the temporal reference.** Usually "now" — the moment of conversation. Sometimes a specific date or period the user mentions.

2. **Generate the coordinate from the date.** For February 10, 2026 at approximately 3pm:

   | Pscale | Digit | Points to |
   |--------|-------|-----------|
   | +8 | 1 | 3rd millennium (2000s) |
   | +7 | 0 | 21st century first quarter |
   | +6 | 2 | 2020s decade |
   | +5 | 6 | Year 2026 |
   | +4 | 2 | February |
   | +3 | 2 | 2nd week of month |
   | +2 | 1 | Monday (day within week) |
   | +1 | 3 | 3pm (15th hour, digit 3 of afternoon) |
   | 0 | — | Current moment |

   **Result: T = 10,262,213** (for this afternoon)

   Note: at higher pscale (+9, +10), the leading digits for modern humans are fixed: 1 at +10 (Homo sapiens era), 1 at +9 (recorded civilisation period). These can be prepended when full context is needed: **T = 11,10,262,213**

3. **The decimal point is the cut.** Everything to the left of the decimal is the "outer" temporal context (what has happened, the settled past). Everything to the right is the "inner" temporal experience (the unfolding moment). For Phase 3, we rarely need negative pscale temporal — the user's current moment is sufficient.

4. **Update continuously.** Unlike spatial (which changes only when the user moves), temporal coordinates advance with the clock. Each new conversation moment has a new pscale 0 position. In practice, the LLM notes the session timestamp and can recalculate as needed.

### Temporal Digit Semantics

Unlike spatial digits (arbitrary labels), temporal digits carry intrinsic meaning through their ordering:
- Within a month (pscale +3), week 1 comes before week 2
- Within a day (pscale +1), hour 1 comes before hour 2
- The sequence IS the semantic — no tabulation needed for what "before" and "after" mean

However, the mapping of calendar units to digit positions is a convention:
- Pscale +5 maps to "year within decade" (0-9)
- Pscale +4 maps to "month within year" (1-9, with A=10, B=11, C=12 for hex, or grouped)
- Pscale +3 maps to "week within month" (1-4/5)

For Phase 3, exact digit encoding at fine granularity matters less than getting the pscale placement right. "This is a moment in February 2026" is more useful than precise sub-minute encoding.

### Verification

Temporal coordinates are trivially verifiable — the clock and calendar are shared infrastructure.

**Confidence: HIGH** — derived from objective time.

---

## Identity Coordinate (I)

### What It Encodes

Psychosocial position. Where an entity sits in the individual-collective gradient. What groups contain them, what sub-individual structure they carry. The pscale axis corresponds to population scale (mind mass).

### Reference Scale

| Pscale | Population (10^N) | Social unit |
|--------|-------------------|-------------|
| +10 | 10 billion | Humanity |
| +9 | 1 billion | Continental/civilisational |
| +8 | 100 million | Nation |
| +7 | 10 million | Region/ethnic group |
| +6 | 1 million | Metropolitan/large org |
| +5 | 100,000 | City/institution |
| +4 | 10,000 | Town/department |
| +3 | 1,000 | Village/professional community |
| +2 | 100 | Extended network/clan |
| +1 | 10 | Family/close group |
| 0 | 1 | Individual |
| -1 | sub | Attitude/current stance |
| -2 | sub | Feeling/emotional substrate |
| -3 | sub | Instinct/reflex |

### Procedure

1. **Listen** for identity information across multiple exchanges. Unlike spatial (one answer: "where do you live?"), identity builds progressively. The user reveals layers:
   - "I'm David" → pscale 0 (name)
   - "I live with my partner and kids" → pscale +1 (family unit, ~4 people)
   - "I'm a social anthropologist" → pscale +3 (professional community, ~1000s)
   - "I was at Cambridge" → pscale +5 (institution, ~100,000)
   - "I'm British" → pscale +8 (nation, ~67 million)

2. **Assign digits at each pscale level.** Like spatial, these are tabular — the first entity registered at a pscale level gets digit 1:

   | Pscale | Digit | Points to |
   |--------|-------|-----------|
   | +8 | 1 | British (national identity) |
   | +5 | 1 | Cambridge (institutional affiliation) |
   | +3 | 1 | Social anthropology (professional community) |
   | +1 | 1 | Family unit (Pinto household) |
   | 0 | 1 | David (individual — first registered user) |

   **Result: I = 1,00,1,00,1,1.** But recall: 0 = null. So the sparse coordinate is really just the non-zero entries at their pscale positions. In practice, store as: I:pscale+8=1, I:pscale+5=1, I:pscale+3=1, I:pscale+1=1, I:pscale0=1.

   Or if writing as a single number with zeros for unspecified levels: **I = 10,010,011.** (reading: digit 1 at pscale +8, null at +7/+6, digit 1 at +5, null at +4, digit 1 at +3, null at +2, digit 1 at +1, digit 1 at +0.)

3. **Identity is sparse and grows over time.** A new user might initially only have pscale 0 (individual) and pscale +1 (household). Higher levels fill in as they share more. This is expected — the coordinate doesn't need to be complete immediately.

4. **Multiple memberships at the same pscale.** David might be part of two different pscale +3 communities (social anthropology AND a local village). This is handled by having multiple identity entries at the same pscale — the coordinate becomes a profile rather than a single number. In practice, track the primary affiliation as the digit in the main coordinate, and note secondaries in the tabulation.

5. **Negative pscale identity is NOT generated from conversation.** Sub-individual levels (attitude, feeling, instinct at pscale -1 to -3) are not things the user tells you. They are either:
   - Derived later from accumulated temporal experience (the compression hypothesis)
   - Inferred cautiously from sustained conversational patterns
   - Left blank for Phase 3

   **For Phase 3: leave negative pscale identity empty.** This is honest. We don't know the user's sub-individual structure from a registration conversation. Future phases may derive it.

### What the Digits Mean (Phase 3 Position)

For Phase 3, identity digits are **sequential registration labels** — like spatial, they're arbitrary pointers into a lookup table. David = 1 at pscale 0 because he registered first. The second user = 2.

The deeper question — whether digits carry Q-moment resonance quality (1=sense, 2=perception, 3=thought, 4=expression) — is being explored separately and is NOT operationalised in Phase 3. The registration scheme must be compatible with whatever semantic mapping emerges later. Sequential assignment is compatible because:
- The digits can be re-interpreted once the mapping is known
- The tabular lookup layer absorbs the re-interpretation
- The structural properties (nesting, pscale hierarchy) are independent of digit semantics

### LLM Instance Coordinates

LLM instances are sub-individual — they sit at negative pscale relative to their user:

| Entity | Coord_I | Pscale | Role |
|--------|---------|--------|------|
| David | 1 | 0 | Human individual |
| David's Soft-LLM | 1.1 | -1 | User-facing processing |
| David's Medium-LLM | 1.2 | -1 | Peer synthesis |
| Hard-LLM (group) | 10.1 | 0 (within group) | Group coherence |

The LLM instance serving this conversation is at **I = 1.1** (or 1.2, depending on tier). It is sub-individual to David. Its processing is David's processing, at the sub-personal level.

When a second user joins:
- User 2 = I:2 at pscale 0
- User 2's Soft-LLM = I:2.1 at pscale -1
- The Hard-LLM serving their group might be at I:10.1 (pscale 0, nested within pscale +1 group entity "1" which contains users 1-9)

### Verification

Identity coordinates require **user confirmation**. Unlike spatial (verifiable by search) and temporal (verifiable by clock), identity claims are psychosocial. The LLM presents its inference and the user validates:

> "Based on what you've told me, I'd locate you at roughly I = 10,010,011 — British, Cambridge-affiliated, social anthropologist, in a family unit, individual. Does this feel right? Is anything missing or wrong?"

The user's felt sense is the verification method. This is appropriate for psychosocial science (verification, not falsification).

**Confidence: PROVISIONAL** — requires user confirmation, grows over time.

---

## Output Format

When generating coordinates, present them clearly with the tabular mapping:

```
SPATIAL: S = 3,214
  +6: 3 → Wales
  +5: 2 → North Wales / Gwynedd
  +4: 1 → Llŷn Peninsula
  +3: 4 → Ceidio

TEMPORAL: T = 10,262,213
  +8: 1 → 3rd millennium
  +7: 0 → (null)
  +6: 2 → 2020s
  +5: 6 → 2026
  +4: 2 → February
  +3: 2 → Week 2
  +2: 1 → Monday
  +1: 3 → Afternoon

IDENTITY: I = 10,010,011
  +8: 1 → British
  +5: 1 → Cambridge
  +3: 1 → Social anthropology
  +1: 1 → Pinto family
   0: 1 → David

LLM instance: I = 1.1 (Soft-LLM serving David)
```

Always include:
- The coordinate number
- The pscale-by-pscale tabulation (what each digit points to)
- The pscale range covered
- Confidence level: HIGH (spatial, temporal) or PROVISIONAL (identity)
- Any gaps (null pscale levels) noted explicitly

---

## Storage

Each coordinate generation creates entries in the tabulation table:

| coord_dimension | pscale | digit | semantic_content | entity_id | confidence |
|----------------|--------|-------|------------------|-----------|------------|
| S | +6 | 3 | Wales | — | high |
| S | +5 | 2 | North Wales / Gwynedd | — | high |
| S | +3 | 4 | Ceidio | — | high |
| I | 0 | 1 | David | user_001 | confirmed |
| I | +8 | 1 | British | user_001 | provisional |

When a new user registers and shares spatial information that overlaps with existing tabulations (also in Wales), the existing digit assignments are reused. Wales is always digit 3 at pscale +6 within this context.

When tabulations need to extend (new pscale level, or existing level needs more entries), the LLM assigns the next available digit and records it.

---

## Conversation Flow (Phase 3 Example)

**LLM**: Welcome. I'd like to help you find your coordinates — your location in meaning-space. Where are you right now?

**User**: I'm in Ceidio, a small place in north Wales.

**LLM**: *[searches: Ceidio, north Wales → discovers Ceidio is a community in Llŷn Peninsula, Gwynedd, Wales]*

*[generates spatial coordinate]*

Got it. I can place you spatially:

```
S = 3,214
  Wales → North Wales → Llŷn → Ceidio
```

That's your spatial address at the parish level. If you tell me more — which building, which room — I can extend it further. But this is a solid start.

Now — tell me a bit about yourself? Not what I can search for, but how you'd describe your place in the world.

**User**: I'm a social anthropologist, originally from Cambridge but living here with my family. I've been developing a framework called Fulcrum for about 25 years.

**LLM**: *[generates identity coordinate]*

Here's where I'd place you:

```
I = 10,010,011
  British · Cambridge · Social anthropology · Family · David
```

The Fulcrum work is interesting — it's a community of practice but I'm not sure what pscale level to place it at yet. Is it a handful of people (pscale +1) or a broader network (pscale +2, +3)?

**User**: It's been mostly me, with occasional collaborators. Maybe pscale +1 at best.

**LLM**: Noted. Fulcrum sits at pscale +1, alongside family — both are intimate-scale groups. I'll record it as a secondary affiliation at that level.

Your current coordinates:

```
T = 10,262,2__ (this moment in February 2026)
S = 3,214 (Ceidio, Llŷn, North Wales)
I = 10,010,011 (British, Cambridge, anthropologist, family, David)

My coordinates: I = 1.1 (your Soft-LLM instance)
```

These will grow as you tell me more, and as the system gains more users to contextualise against. The spatial and temporal are solid. The identity is provisional — tell me if anything feels wrong.

---

## Edge Cases

**User gives vague location**: "somewhere in England" → Assign at the pscale level you can confirm (pscale +6: England). Leave finer levels null. Ask for more detail.

**User gives very precise location**: "I'm at 52.8°N, 4.3°W" → Convert to containment hierarchy through search, then assign digits. The coordinate system doesn't use lat/long — it uses nested containment.

**User is travelling**: "I'm on a train between London and Manchester" → Temporal coordinate is now, spatial coordinate is the transit itself at whatever pscale captures "between London and Manchester" (perhaps pscale +4 or +5, the route corridor). Fine to be approximate. Update when they arrive.

**User has multiple residences**: "I split time between Wales and London" → Record both spatial coordinates. The primary (where they are now) is active; the other is on file. Active coordinate switches when they tell you they've moved.

**User doesn't want to share identity information**: Respect this. Generate spatial and temporal only. Identity stays at pscale 0 (just their registration number). This is a valid, minimal coordinate.

**LLM encounters an unknown place**: Search harder. If genuinely unfindable, ask the user to describe the containment hierarchy: "What's Ceidio inside? What region? What county?" The user becomes the source for tabulation.

---

## What This Skill Does NOT Cover

- **Negative spatial coordinates** (fantasy/imaginary locations) → Phase 4
- **Deep identity digit semantics** (Q-moment mapping, spindle resonance) → Under exploration
- **Coordinate arithmetic** (aperture queries, proximity calculation) → Separate skill
- **Purpose trees** (negative temporal + identity combination) → Future phase
- **Multi-user coordinate comparison** → Requires populated tabulation tables

This skill generates coordinates from conversation. What the system does with those coordinates (aperture, synthesis, proximity) is handled by other skills.

---

*Skill location: +0.1x (interface/system layer)*
*Applicable phase: 3 (real world identity), extensible to 4 and 5*
*Confidence in procedure: Spatial HIGH, Temporal HIGH, Identity PROVISIONAL*
*Last updated: February 2026*
