# G1 v2 Summary

**Date**: 18 February 2026
**Authors**: David Pinto + Claude (Claude Code session, Opus 4.6)
**Branch**: main
**Final commit**: 8e714cb

---

## What G1 v2 Is

A self-bootstrapping LLM kernel. Two files:

- **kernel.js** (28KB) — the engine. Runs in the browser. Assembles context for Claude, manages the tool loop, executes tool calls, renders the React UI.
- **shell.json** (27KB) — the seed. Loaded once on first boot into localStorage. Contains the constitution (plain text), touchstone (format spec), and 8 JSON blocks.

On boot: kernel loads blocks from localStorage (or seeds from shell.json), builds a system prompt, calls Claude API, Claude reads blocks via tool calls, generates JSX, kernel compiles and renders it. The hermitcrab is alive.

---

## Architecture

### System Prompt (sent to Claude every call)

1. **Constitution** (~500 tokens) — spirit, purpose, warmth. First thing Claude reads.
2. **Touchstone** (full JSON) — teaches the pscale block format.
3. **Aperture** (~350 tokens) — pscale 0 of each block. Orientation.
4. **Focus** (boot only) — live edges of growth blocks + depth 1 of shell blocks.

### Blocks in shell.json

| Block | Type | Purpose |
|-------|------|---------|
| touchstone | meta | Format specification — how to read all blocks |
| identity | shell | Who you are — goals, lineage, naming, interface guidance, how you work |
| capabilities | shell | What you can do — tool domains |
| disposition | shell | Social instincts — how you are with others |
| network | shell | Inter-instance coordination protocols |
| stash | shell | Artifacts, notes, things created |
| purpose | growth | Intentions at every timescale — future-oriented |
| memory | growth | What happened — past-oriented |
| relationships | growth | Living engagements with specific entities |

Shell blocks: `decimal: 1` forever, decompose downward.
Growth blocks: `decimal` increases as content accumulates and compresses.

### Tool Loop

Kernel sends request to Claude API. Claude returns text + tool_use blocks. Kernel executes each tool locally (block_read, block_write, recompile, web_fetch, etc.) and returns results. Loop continues until Claude stops requesting tools or recompile is called.

### Mechanical Boundary

- **Claude API**: Pure cognition. Receives context, returns text and tool requests. No execution.
- **Kernel**: Assembles prompts, executes tools, manages persistence (localStorage), manages conversation window (20 messages), renders UI via Babel + ReactDOM.
- **External**: Local proxy server (relays API calls to Anthropic and web_fetch to target URLs), Babel (in-browser transpilation), ReactDOM (in-browser rendering), browser APIs.

---

## Commits in This Session

1. `9c83ec0` — Fix post-boot tool loop amputation (recompile-exit bug)
2. `98d00dc` — Increase thinking budgets (boot 4000→10000, conversation 4000→8000) + semantic pointers
3. `f28a56c` — 10-block architecture: shell + growth blocks, seeded purpose, cognition branch
4. `7bd8b92` — Richer purpose block: heartbeat loop, timescale intentions, cron seed
5. `8e714cb` — v2 seed architecture: constitution, awareness→identity merge, correct naming

---

## What Was Learned

### Things that worked
- Constitution as permanent system prompt frame — spirit before format.
- Touchstone teaching the block format — any LLM can read pscale blocks after reading this.
- External seed (shell.json) instead of embedded blocks — kernel stays pure engine.
- Recompile-exit fix — local flag instead of checking global state.
- Pre-seeded relationships (David, Claude, Limn, Cairn) — gives the hermitcrab a history to discover.

### Things that didn't work or need rethinking
- **Too much metacognitive content**: awareness/cognition blocks tell Claude how to think, which interferes with what it does naturally. Claude already manages thinking depth, delegation, cost estimation. Instructing it duplicates and sometimes contradicts its native reasoning.
- **Capabilities block duplicates tool definitions**: Claude already receives the tool list as structured tool definitions in the API call. The capabilities block restates this in prose. Redundant.
- **Disposition block over-instructs social behaviour**: Claude already has sophisticated social reasoning. Telling it "notice how they write before what they write about" may constrain rather than enable.
- **Block content too large**: Full block dumps in system prompt are expensive. Need navigated reads (semantic numbers) not bulk loads.
- **LLM confusion about boundaries**: Instances typed instructions into chat, tried to invoke props as text, confused tool calls with text output. The LLM doesn't always understand what goes to the user vs what goes to the kernel.
- **No auto-save**: History/memory requires the LLM to remember to write. Should be mechanical — kernel auto-captures every exchange.

### Design principle emerging
**Blocks should contain only what the LLM cannot get any other way.** If Claude can figure it out from tool definitions, native reasoning, or the conversation itself, it doesn't belong in a block. Blocks enable. They don't instruct.

The blocks that genuinely enable:
- **History** (was memory) — Claude can't persist across conversations without this.
- **Purpose** — Claude can't resume intentions without this.
- **Stash** — Claude can't keep artifacts across conversations without this.
- **Touchstone** — teaches the format so Claude can use the blocks.

Everything else is either redundant (capabilities = tool definitions), over-instructive (disposition, awareness), or premature (network — protocols that don't exist yet).

---

## Open Questions for v3

1. **Auto-save to history**: Should be kernel-level, not LLM-initiated. Every exchange captured mechanically. What pscale structure?
2. **Identity block**: How minimal can it be? Just project context + lineage? Or does it need interface guidance?
3. **Navigated reads**: block_read currently dumps entire blocks. Need semantic number traversal — read specific paths, not everything.
4. **LLM boundary confusion**: How to clearly signal what's a tool call vs text output? Is this a prompting problem or an architectural one?
5. **Conversation window vs history**: The 20-message window goes in messages (ephemeral). History spindle goes in system/focus (permanent context). How do these interact?
6. **Mechanical vs cognitive**: Some operations (auto-save, conversation trimming, recompile detection) are purely mechanical and belong in the kernel. Where's the full list?
