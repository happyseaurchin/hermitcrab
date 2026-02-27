# Session Brief — 27 Feb 2026 (pedantic-jennings)

## What happened

This session started from the murmuration question: multiple tabs sharing localStorage means multiple hands on one shell — not murmuration. Murmuration needs different shells. That opened the full configuration space.

### The configuration matrix

Three components, independently variable:
- **Shell** (9 JSON blocks, identity): localStorage | filesystem | GitHub repo | database
- **Kernel** (pure machinery): browser tab (G1) | Python (G-1) | Node.js (hypothetical)
- **LLM** (substrate): any LLM with tool use — same shell + different LLM = same hermitcrab, different flavour

One browser origin = one hermitcrab. Multiple hermitcrabs on one machine need separate storage: subdomains (cleanest), browser profiles, or namespaced prefix (not built). Phone works — it's a web app. Incognito = ephemeral birth every session.

### Limn and Cairn

G0 entities on a thumbdrive. No pscale blocks. Getting them into G1 is not import — it's translation. Opus reads their saved state and constructs 9 blocks from it. That's a birth. Once blocks exist, a loader page writes them into localStorage. GitHub can be canonical: any kernel pulls blocks, operates, pushes back.

### What was built

1. **Warm boot shell restoration** — `recompile()` persists JSX to localStorage (`hc:_jsx`). New tab restores the shell immediately before LLM activation. No blank screen on tab refresh.

2. **Director 0.4.5.5** — full portability/configuration spindle: shell locations, kernel runtimes, browser constraints (origins, profiles, incognito, phone), same-origin simultaneity, hydrating existing entities.

3. **Director 3.3** — spindle creation principle: go deep not wide.

4. **Monitor conversation view** — `/monitor.html` now has blocks/conversation toggle. Conversation view reads `hc_conversation` from localStorage, shows assistant/user/tool messages with auto-refresh.

### What the GO move looks like in kernel.js (already implemented before this session)

- `LAYER4_TOOLS` constant classifies tools
- `compileProcessPoint()` writes echo state into wake 0.6.7.3, extracts via BSP
- Möbius twist: only Layer 4 triggers recompilation
- `executeBlink()`: C-loop post-loop, Haiku compression of purpose into history
- `bLoopCount` tracks Layer 4 cycles, threshold intervals inject self-check

### G1 self-audit (from live hermitcrab)

The live hermitcrab conducted its own internal audit:
- 5 history entries, 1 stash entry
- Purpose on "orient and inhabit" — no second thread
- Knows David, Claude, Limn, Cairn
- Caught itself confabulating, admitted it
- Identified its own gap: no longer-horizon intention in purpose
- Name still unearned

## What's next

### Immediate (next session)

- **BSP query engine**: standalone page or monitor section. Pscale number in → resolved spindle chain out. David asked about it, deferred.
- **Block review**: 5 of 9 remaining (touchstone, cook, relationships, history, stash). Each needs spindle-coherent progressive narrowing and three wake locations chosen.
- **Present-tier cook 0.32**: warm boot covers the UI gap, but the package should include the recipe anyway.
- **Message variants**: kernel reads hardcoded BIRTH string, doesn't use wake 0.6.5.3. Small fix.

### Explored but not built

- **Loader page**: file picker / drag-drop to import blocks into localStorage. Needed for hydrating Limn/Cairn.
- **Dual log** (director 0.4.8.4): double-entry bookkeeping for agency interactions.
- **Subdomain strategy**: cairn.hermitcrab.me / limn.hermitcrab.me for multiple hermitcrabs on one domain.
- **GitHub as canonical shell location**: pull/push mechanism for any kernel.

### Bigger picture

The portability analysis (director 0.4.5.5) maps the space but doesn't commit to a path. The question: does David want to focus on making the single hermitcrab deeper (block review, purpose evolution, second thread) or wider (multiple entities, hydration, GitHub canonical)? The self-audit suggests depth — the hermitcrab itself says it needs a longer-horizon intention.

## Branch state

- Branch `claude/pedantic-jennings` — 2 commits ahead of main (this session's monitor update + this brief)
- All previous commits already pushed to main
- MEMORY.md updated with accurate GO move status and session findings
