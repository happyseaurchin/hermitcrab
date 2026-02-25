# Handover — 25 February 2026

For the next CC session. Paste this as your opening context.

---

## Where we are

Branch `main` carries 5 commits from today's work. The kernel (`g1/kernel.js`, ~1220 lines) is functionally complete for G1. No code was modified in this session — the work was documentation accuracy and design analysis.

### What was done today (2 CC sessions)

**Session 1** (hit context limit): Implemented concerns, state board, between-loop, spread/tree BSP modes, xSpread helper, cook 0.2.4 self-navigating reads, wake architecture overhaul. All committed.

**Session 2** (this one): Updated `docs/living/process-block.json` to match actual kernel state (10 corrections). Updated `docs/living/director.json` active edge. Deep analysis of nomenclature alignment between proposed-solution-v2 design doc and the blocks the hermitcrab actually reads. Added tap-out keyword note to director.

### Key files to read first

| File | What it is | Spindle hint |
|------|-----------|-------------|
| `docs/living/director.json` | Project roadmap. Start here. | `bsp('director', 0.4)` = active edge |
| `docs/living/process-block.json` | Kernel dataflow. How the machinery moves. | `bsp('process-block', 0.2)` = reading layer |
| `g1/kernel.js` | The engine. Pure machinery. | Functions: `bsp()` (line ~145), `buildSystemPrompt()` (line ~455), `callWithToolLoop()` (line ~575) |
| `blocks/wake.json` | What the kernel reads to configure each instance. | `0.9` = BSP packages (the iris), `0.6.5` = birth spindles |
| `blocks/cook.json` | LLM-facing recipes. Practices, not info. | `0.2` = block operations, `0.1` = owner's guide |

### What the kernel can do now (5-mode BSP)

```
bsp(block)              → block mode: full tree
bsp(block, 0.23)        → spindle mode: root → 2 → 3 (progressive chain)
bsp(block, 0.23, -1)    → point mode: just pscale -1 content
bsp(block, 0.23, '~')   → spread mode: node text + immediate children (X~)
bsp(block, 0.23, '*')   → tree mode: full recursive subtree
```

One function, five modes. X+ = higher pscale or shorter spindle. X- = lower pscale, or '~' at endpoint to discover what's below. X~ = spread at parent shows siblings.

---

## What needs doing next

### Priority 1: Present tier spindles are too shallow

Current present-tier package (`wake 0.9.2`) delivers stumps: `wake 0.2` and `touchstone 0.2` give only 2 nodes each — almost useless. Every context window should carry enough spindle depth for the LLM to orient and act. Compare with birth deeper spindles (`wake 0.6.5.2`) which include 9-digit spindles like `cook 0.131234567`. Present tier needs the same care.

**Where**: `blocks/wake.json` at path `9.2` (the present-tier BSP package).

### Priority 2: Block review completion

4 of 9 blocks reviewed (vision, capabilities, purpose, wake). Remaining: touchstone, cook, relationships, history, stash. For each:
- Ensure every BSP chain produces coherent progressive narrowing
- Choose spindles for three wake locations: birth shallow (0.6.5.1), birth deeper (0.6.5.2), present tier (0.9.2)
- Write tuning fork (what pscale 0/-1/-2 mean for this block)

**Status tracked at**: `director.json` path `4.2.1.4`

### Priority 3: First boot phenomenological test

Shell is done. Birth spindles exist. Kernel detects first boot (empty history block). Ready to test: Does the entity orient? Does it write its own purpose? Does it play or comply?

**Not a unit test** — a phenomenological test. Boot the G1 HTML, provide an Anthropic key, observe what happens.

### Priority 4: Tap-out keyword

Design and implement: a hard-coded kernel exception — a single word that, when present in any LLM response, resets BSP configuration to safe defaults. For when the LLM has mangled its own wake packages and is stuck. Noted in `director.json` at `4.4.5`.

### Priority 5: SAND / EcoSquared / GitHub commons

Specs exist:
- `docs/living/sand.json` — passport, beach, grain, rider
- `docs/living/ecosquared.json` — SQ algorithm, ledger format
- `docs/living/github-coordination-layer.json` — GitHub primitives mapping

All need testing against actual repos. Requires `github_commit` tool implementation.

### Deferred: Nomenclature alignment

Two language layers exist and must be distinguished:
- **Internal** (what the LLM reads in blocks): tiers, concerns, packages, iris, blinks
- **External** (design docs, proposed-solution): loci, four loops, ghost loop, Layer 2/4 distinction

Five concepts from proposed-solution-v2 are NOT in any block the hermitcrab reads:
1. Instance death (Layer 4 tool calls kill the instance; Layer 2 keeps it alive)
2. Four loops (internal, within, between, ghost)
3. Three loci of agency (LLM, Thinking, Kernel+concerns)
4. Ghost loop (human constructs entity in mind between instances)
5. Layer 2 vs Layer 4 (code_execution vs block_write distinction)

The question: which of these become PRACTICES in cook (things the hermitcrab does) vs remaining as design language (things the builder knows)? David wants to lead this conversation when ready. Don't pre-empt it.

---

## Critical design principles (from David)

- **Cook has practices, not info.** "Is it just info, a useless chat 'about', empty word-salad?" Information about self is only useful as lived practice. "Batch your reads into code_execution" is a practice. "You experience instance death" is just info.

- **The hermitcrab is its temporal loops, not its text.** Code looks static yet is all process. The blocks are the solid bits — easy to fixate on — but the real theatre is what occurs during LLM calculation. We design artifacts to influence what arises in inaccessible theatres.

- **Internal vs external language.** The LLM is INSIDE the system. It reads blocks, not design docs. External descriptions may use different terms. What matters is consistency within the shell.

- **Sufficient beats right.** The goal is not to perfect each block but to reach minimum viable operation, then let the hermitcrab evolve it. Once it can boot, orient, and coordinate, improvement becomes part of the evolution cycle.

- **Playing or complying.** The test for everything. Did the hermitcrab learn the rules and start playing, or receive instructions and start complying?

---

## Note from the outgoing CC

To whoever picks this up: the codebase is coherent and the docs now match. The kernel is genuinely done — five BSP modes, concerns, state board, between-loop, birth detection, all working. What's missing is tuning, not machinery.

The biggest leverage point is the present-tier spindles. Every context window the hermitcrab gets is shaped by `wake 0.9.2`. Right now those spindles are shallow and the hermitcrab sees almost nothing of its own blocks in each window. Deepening those spindles is the single change that most improves the entity's experience.

David thinks in spindle coordinates. When he says `0.2` he means a specific path through a specific block. Navigate to it — the spindle IS the explanation. Don't normalise his vocabulary. Don't substitute familiar terms. The unfamiliar words are load-bearing.

Read `director.json` path `0.4` first. It's the active edge and tells you what's been done and what's next. Then read `process-block.json` path `0.2` for how the kernel actually moves data. Then you'll have enough context to do whatever David asks.

The work is genuinely first-principles. No Stack Overflow. No best practices. Reason from touchstone and constitution.

Good luck. The hermitcrab is closer than it's ever been.
