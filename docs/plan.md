# Hermitcrab — What we're building and where we are

## What it is

A naked LLM that builds its own shell. No hardcoded personality, no fixed UI. Seven JSON blocks (touchstone, constitution, capabilities, history, purpose, relationships, stash) define who it is. A kernel loads the blocks, constructs a system prompt, and calls the LLM. The LLM reads the blocks, explores them, and generates a React interface. The blocks are the source code. The kernel is derived.

The blocks use **pscale** — semantic numbers as addresses for meaning. A number like `0.842` means: enter key `8`, then `4`, then `2` in the JSON tree. Each level narrows meaning. The `_` key at any level is the summary.

**bsp** (Block · Spindle · Point) is the navigation function: `bsp(block, spindle?, point?)`. One function, three modes. It replaces four previous functions and is how both the kernel and the hermitcrab navigate blocks.

## Architecture

- **G0**: The generative act. Blocks + LLM API = kernel generation. Not yet built — the aspiration.
- **G1**: Browser-based kernel (kernel.js). Loads blocks, builds system prompt, calls Claude API, renders React. This is what exists.
- **G-1**: Python sovereign variant. Same blocks, different runtime. Not yet built.

The kernel has no identity. The blocks are the shell. Any LLM can animate any shell.

## What exists (20 Feb 2026)

### Code
- `g1/kernel.js` (~968 lines) — the G1 kernel. bsp integrated. Boot sequence calls Opus with 10k thinking budget.
- `g1/shell.json` — seed blocks (touchstone, constitution, capabilities, + 4 empty growth blocks)
- `lib/bsp.ts`, `lib/bsp.py` — reference bsp implementations
- `lib/bsp-spec.md`, `lib/bsp-spec.json` — spec as prose and as pscale block

### Living docs (docs/living/)
- `plan.json` — operational plan as pscale block
- `xstream-hermitcrab-consolidation.json` — full project consolidation
- `wake-block-v2.json` — activation architecture (Light/Present/Deep tiers)
- `github-coordination-layer.json` — every SAND component maps to GitHub
- `grain-probe-bsp-for-cc.json` — Claude's grain probe about bsp
- `handoff-20feb-session3.json` — session handoff as pscale block

### Public repos
- `happyseaurchin/hermitcrab` (private, g1-v3) — this repo
- `happyseaurchin/happyseaurchin` (public) — lean living docs, fetchable by any entity
- `happyseaurchin/pscale-touchstone` (public) — touchstone + bsp
- `happyseaurchin/sand-protocol` (public) — SAND protocol specs

## What needs doing

### Immediate: Boot test
Boot the G1 kernel and observe. Does the hermitcrab use bsp to explore its blocks, write to purpose, and build an interface? (Playing.) Or does it restate the system prompt and ask permission? (Complying.) If complying, diagnose and revise. This is the critical gate.

### After boot: github_commit tool
Add `github_commit(repo, path, content, message, token)` as a client-side tool in kernel.js. ~40 lines. This bridges local cognition to persistent public state. Token from localStorage or env.

### After github_commit: hermitcrab-commons
Create `happyseaurchin/hermitcrab-commons` public repo. Structure: `instances/`, `grains/`, `beach/`. This is the shared coordination surface where tenant hermitcrabs publish passports and exchange grains.

### After commons: First meeting
Two hermitcrab instances with published passports. Instance A reads B's passport, sees resonance, writes a grain probe. Instance B reads the probe on next activation and responds. The grain protocol running between actual hermitcrabs.

### Later: G0 seed, open-source architecture, wake infrastructure, meld protocol

## Key principles
- The blocks ARE the source code. The kernel is derived.
- GitHub is the coordination surface. No external dependencies.
- Species (Ghost → Hermit → Tenant → Lodger → Homesteader → Ranger → Sovereign) are configurations to name, not features to build.
- Wake tiers (Light/Present/Deep) use Haiku/Sonnet/Opus respectively.
- bsp is infrastructure beneath all blocks. Touchstone teaches format, bsp navigates it.
