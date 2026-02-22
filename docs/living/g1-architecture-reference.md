# Hermitcrab G1 Architecture Reference

A complete technical map of the G1 kernel: every dataflow, every function, every loop. If something breaks, this document tells you what should be happening and where.

Last verified against: `g1/kernel.js` (kernel-v2-architecture branch)

---

## 1. System Overview

Hermitcrab G1 is a browser-hosted LLM kernel. It loads JSON blocks from localStorage, composes a system prompt from them, calls the Claude API with tools, and renders whatever React interface the LLM builds. The kernel has no identity. The blocks are the shell. Any LLM can animate any shell.

**Files:**

| File | Role |
|------|------|
| `g1/kernel.js` | The kernel. Single IIFE. ~1010 lines. All runtime logic. |
| `g1/shell.json` | The seed. Block definitions loaded on first boot. |
| `api/claude.ts` | Vercel serverless function. CORS proxy to Anthropic API. Full passthrough. |
| `api/fetch.ts` | Vercel serverless function. URL proxy for when native web_fetch fails. |
| `index.html` | Landing page. Links to hermitcrab.html. |
| `hermitcrab.html` | Entry point. Loads React, ReactDOM, Babel, then kernel.js. |

**Runtime dependencies (loaded via CDN in hermitcrab.html):**
- React 18
- ReactDOM 18
- Babel Standalone (for JSX compilation)

---

## 2. Boot Sequence

The entire kernel is a single async IIFE: `(async function boot() { ... })()`.

### 2.1 Execution Order

```
1. API Key Gate
   └─ If no key in localStorage('hermitcrab_api_key')
      └─ Render key input form, return. boot() re-called on submit.

2. Seed & Block Loading
   ├─ blockList() — check localStorage for hc:* keys
   ├─ If empty: loadSeed() fetches shell.json, seedBlocks() writes each to localStorage
   └─ If populated: skip seed, use existing blocks

3. Build Props Object
   ├─ Assemble props: { callLLM, callAPI, callWithToolLoop, model, fastModel, ... }
   ├─ Model names read from getTierParams(3) and getTierParams(1)
   └─ Props are passed to every recompiled React component

4. Boot API Call
   ├─ getTierParams(3) — read deep tier invocation params from wake 0.9.6
   ├─ buildSystemPrompt(3) — compose deep tier system prompt from wake 0.9.3 instructions
   ├─ callWithToolLoop(bootParams) — call API, handle tool loop
   └─ Tool loop runs until recompile() is called or end_turn/max loops

5. Shell Render
   ├─ If recompile was called: shell is already live, boot returns
   └─ If not: error — "no shell was built"
```

### 2.2 Boot Parameters

All values read from wake block at `0.9.6` (deep tier invocation):

| Parameter | Source | Current Value |
|-----------|--------|---------------|
| model | wake 0.9.6.1 | claude-opus-4-6 |
| max_tokens | wake 0.9.6.2 | 16000 |
| thinking | wake 0.9.6.3 | { type: "enabled", budget_tokens: 16000 } |
| system | buildSystemPrompt(3) | bsp-compiled from wake 0.9.3 instructions |
| tools | BOOT_TOOLS + DEFAULT_TOOLS | 15 tools total |
| messages | [{ role: "user", content: "BOOT" }] | Single-word trigger |

Fallback: if the wake block is absent, `getTierParams(3)` returns `{ model: "claude-opus-4-6", max_tokens: 8192 }` (hardcoded fallbacks).

---

## 3. Block System

### 3.1 Storage

Blocks live in browser `localStorage` with prefix `hc:`. Each block is a JSON object:

```json
{
  "place": 1,
  "tree": {
    "0": {
      "_": "Pscale 0 text — what this block is",
      "1": "First child entry",
      "2": { "_": "Second child is a branch", "1": "Grandchild" }
    }
  }
}
```

**Conventions:**
- `place` counts digits before the decimal point (default 1, meaning addresses are 0.x)
- All content nests under `tree["0"]` — the pscale 0 root
- `_` key holds the semantic text at each node
- Digit keys `"1"` through `"9"` hold children
- Maximum 9 children per node (digits 1-9)
- When all 9 are full, compression is triggered

### 3.2 Storage Functions

| Function | Signature | Purpose |
|----------|-----------|---------|
| `blockLoad(name)` | → block or null | Read from localStorage, JSON.parse |
| `blockSave(name, block)` | → void | JSON.stringify, write to localStorage |
| `blockList()` | → string[] | All block names (strip hc: prefix) |
| `blockNavigate(block, path)` | → node or null | Walk dot-separated path through tree |
| `blockReadNode(block, path)` | → { content, children } | Content + one level of lookahead |
| `blockWriteNode(block, path, content)` | → { success } | Write text to a path, creating intermediates |

### 3.3 Seed Blocks (from shell.json)

Blocks seeded on first boot:

| Block | Purpose |
|-------|---------|
| `constitution` | Immutable principles. Always in system prompt. |
| `touchstone` | Teaches pscale format, BSP vocabulary, tool usage. |
| `capabilities` | What the instance can do in this generation. |
| `cook` | Operational recipes — tested procedures. |
| `wake` | Activation states, triggers, prompt compiler, invocation params. |
| `purpose` | Evolving purpose — written by the instance. |
| `relationships` | Entities the instance has interacted with. |
| `history` | Auto-saved conversation summaries. |
| `stash` | Scratchpad — notes between activations. |

---

## 4. Pscale Navigation

### 4.1 BSP — Block, Spindle, Point

The core navigation function. One function, three modes:

```
bsp("purpose")              → Block mode: full tree content
bsp("purpose", 0.12)        → Spindle mode: chain of semantics at digits [0,1,2]
bsp("purpose", 0.12, -1)    → Point mode: single semantic at pscale level -1
```

**Digit parsing:** every digit in the number is a nesting step. No stripping. `0.234` walks `tree[0][2][3][4]`. `23.41` walks `tree[2][3][4][1]`.

**Pscale calculation:** `pscale = (place - 1) - index`. For place=1 block, digit at index 0 has pscale 0, index 1 has pscale -1, etc.

### 4.2 Resolve

`resolveBlock(block, maxDepth)` — phrase-level view. Returns the tree structure with `_` text at each node, traversed to `maxDepth`. Good for orientation.

### 4.3 Compression

When all 9 digits at a node are occupied:
1. `findUnoccupiedDigit()` reports `{ full: true }`
2. `compress` tool collects all 9 entries
3. Delegates to light-tier LLM to determine: **summary** (parts add up, reducible) or **emergence** (whole exceeds parts, irreducible)
4. Result written to parent `_` text
5. The 9 children remain — compression adds meaning upward, doesn't delete downward

---

## 5. Prompt Compiler

The system prompt is composed by mechanically executing BSP instructions stored in the wake block.

### 5.1 Instruction Storage

Wake block branch `0.9` contains two parallel structures:

| Digits | Content |
|--------|---------|
| 1-3 | Prompt instructions per tier (bsp command strings) |
| 4-6 | Invocation parameters per tier (key-value strings) |

Tier mapping: 1/4=Light, 2/5=Present, 3/6=Deep.

### 5.2 Instruction Format

Each instruction is a string with 1-3 parts:

```
"constitution"          → bsp block mode (full content)
"constitution 0"        → bsp spindle mode (chain from 0)
"wake 0.1"              → bsp spindle mode (chain from 0.1)
"purpose 0.2 -1"        → bsp point mode (pscale -1 only)
```

### 5.3 Compilation Flow

```
buildSystemPrompt(tier)
  ├─ getPromptInstructions(tier)
  │   ├─ blockLoad('wake')
  │   ├─ Navigate to wake.tree['0']['9'][tier]
  │   └─ Collect strings from digit keys 1-9
  ├─ For each instruction string:
  │   ├─ parseInstruction(str) → { blockName, spindle, point }
  │   ├─ blockLoad(blockName)
  │   ├─ bsp(block, spindle, point)
  │   └─ Format result as prompt section
  └─ Join all sections with \n\n

Fallback: if no instructions found, return pscale 0 of ALL blocks (aperture).
```

### 5.4 Current Tier Instructions

**Light (wake 0.9.1)** — 4 instructions:
constitution 0, purpose 0, wake 0.1, stash

**Present (wake 0.9.2)** — 9 instructions:
constitution 0, touchstone 0, capabilities 0, cook 0, wake 0.2, purpose, relationships 0, history 0, stash

**Deep (wake 0.9.3)** — 9 instructions:
touchstone, constitution, capabilities, cook, wake, purpose, relationships, history, stash

---

## 6. Tier Parameters

### 6.1 getTierParams(tier)

Reads invocation parameters from wake `0.9.{tier+3}`. Each parameter node contains key-value strings parsed by splitting on first space.

```
getTierParams(1) reads wake 0.9.4 → Light tier
getTierParams(2) reads wake 0.9.5 → Present tier
getTierParams(3) reads wake 0.9.6 → Deep tier
```

Returns:
```js
{
  model: string,        // e.g. "claude-opus-4-6"
  max_tokens: number,   // e.g. 16000
  thinking?: object,    // e.g. { type: "enabled", budget_tokens: 16000 }
  max_tool_loops?: number,
  max_messages?: number
}
```

### 6.2 Current Tier Configuration

| Tier | Model | max_tokens | Thinking |
|------|-------|-----------|----------|
| 1 Light | claude-haiku-4-5-20251001 | 4096 | none |
| 2 Present | claude-sonnet-4-6 | 8192 | enabled, 8000 budget |
| 3 Deep | claude-opus-4-6 | 16000 | enabled, 16000 budget |

### 6.3 Fallback Defaults

When the wake block is absent (no blocks loaded):
- Tier 1 falls back to `FALLBACK_FAST_MODEL` (claude-haiku-4-5-20251001)
- Tiers 2-3 fall back to `FALLBACK_MODEL` (claude-opus-4-6)
- max_tokens falls back to 8192
- thinking falls back to undefined (disabled)

### 6.4 Supported Thinking Formats

The wake block can specify thinking in two forms:
- `"thinking enabled 8000"` → `{ type: "enabled", budget_tokens: 8000 }`
- `"thinking adaptive"` → `{ type: "adaptive" }` (Claude decides depth)

---

## 7. API Layer

### 7.1 callAPI(params)

Thin HTTP wrapper. No opinion. Sends request to `/api/claude` proxy.

```
callAPI(params)
  ├─ Read API key from localStorage('hermitcrab_api_key')
  ├─ If no model specified, use FALLBACK_MODEL
  ├─ If no tools specified but currentTools exists, inject them
  ├─ Strip null/undefined params
  ├─ If thinking is set and temperature ≠ 1, remove temperature (API requirement)
  ├─ POST to /api/claude with X-API-Key header
  └─ Return parsed JSON response
```

### 7.2 The CORS Proxy (api/claude.ts)

Vercel serverless function. Full passthrough to `https://api.anthropic.com/v1/messages`.

- User provides their own API key (via X-API-Key header)
- Proxy adds required headers: `anthropic-version`, `anthropic-beta`
- Beta features enabled: web-search, web-fetch, code-execution, context-management
- CORS allowed origins: hermitcrab.me, seed.machus.ai, localhost

### 7.3 The Fetch Proxy (api/fetch.ts)

Backup URL fetcher for when native `web_fetch` fails. Proxies the request server-side. Truncates responses at 50,000 characters.

---

## 8. The Intra-Instance Loop

This is the core processing loop within a single invocation. The LLM stays alive through multiple tool calls.

### 8.1 callWithToolLoop(params, maxLoops, onStatus)

```
                           ┌──────────────────────┐
                           │  callAPI(params)      │
                           └──────────┬───────────┘
                                      │
                                      ▼
                           ┌──────────────────────┐
                           │  Check stop_reason    │
                           └──────────┬───────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                   │
                    ▼                 ▼                   ▼
              end_turn          tool_use             pause_turn
              (done)        (client tools)        (server processing)
                                  │                      │
                                  ▼                      │
                           ┌──────────────┐              │
                           │ executeTool() │              │
                           │ for each      │              │
                           │ tool_use block│              │
                           └──────┬───────┘              │
                                  │                      │
                           ┌──────┴──────────────────────┘
                           │ Was recompile called?
                           │    YES → exit loop (shell is live)
                           │    NO  → append results, call API again
                           └──────────────────────────────┘
```

### 8.2 Stop Reasons

| stop_reason | Meaning | Kernel Action |
|-------------|---------|---------------|
| `end_turn` | LLM finished speaking | Exit loop, return response |
| `tool_use` | LLM wants client tools executed | Execute tools, return results, re-call API |
| `pause_turn` | Server tools still processing OR PTC requesting client tools | If client tool_use blocks present: execute them. If none: re-call API to continue. |
| `max_tokens` | Response hit token limit | Exit loop (treated as end) |
| `refusal` | LLM refused the request | Exit loop |

### 8.3 Tool Types Within the Loop

**Server-side tools** (run on Anthropic's infrastructure):
- `web_search` — search the internet
- `web_fetch` — fetch a URL
- `code_execution` — run Python in a sandbox

The kernel does NOT execute these. They appear as `server_tool_use` blocks in the response. The kernel logs them. Anthropic handles execution; results appear in subsequent responses.

**Client-side tools** (executed by the kernel):
- Block operations: `block_read`, `block_write`, `block_list`, `block_create`
- Pscale tools: `bsp`, `resolve`, `write_entry`, `compress`
- Shell tools: `get_source`, `recompile`
- Delegation: `call_llm`
- Utility: `get_datetime`, `fetch_url`
- Browser (available after setTools): `clipboard_write`, `clipboard_read`, `speak`, `notify`, `download`

Each client tool execution is a round-trip: the kernel executes the tool, sends the result back to the API, and gets a new response. The LLM is re-sampled for each round-trip.

**PTC (Programmatic Tool Calling):**
Tools with `allowed_callers: ['code_execution_20250825']` can be called from within `code_execution` Python. The LLM writes Python that calls `await block_read(...)` etc. These calls are executed without re-sampling the LLM — the Python sandbox calls the kernel's tools directly.

PTC-enabled (read-only): `block_read`, `block_list`, `bsp`, `resolve`, `get_datetime`, `get_source`
PTC-disabled (side effects): `block_write`, `block_create`, `write_entry`, `recompile`, `call_llm`, `compress`

### 8.4 Auto-Save to History

After every tool loop completion, `autoSaveToHistory(response)` writes a truncated (500 char) summary of the LLM's text response to the `history` block at the next unoccupied digit under pscale 0. When digits 1-9 are full, stops writing — compression must be triggered explicitly.

### 8.5 Message Trimming

`trimMessages(messages, maxMessages)` keeps the conversation within bounds. If messages exceed the limit (default 20, configurable via wake params), it keeps the most recent messages and injects a trim notice telling the LLM to write important context to history or stash.

---

## 9. The Inter-Instance Loop

Each API call is a separate LLM instance. Between calls, the LLM "dies" — it has no continuity except through what's stored in blocks and what's compiled into the next system prompt.

### 9.1 Continuity Mechanisms

| Mechanism | How It Works |
|-----------|-------------|
| System prompt | Compiled from blocks via wake instructions. What the LLM receives on its first breath. |
| Conversation history | Messages array passed to the API. Trimmed to max_messages. |
| History block | Auto-saved summaries from previous interactions. |
| Stash block | Scratchpad — the LLM writes notes for its future self. |
| Purpose block | Evolving purpose — carries intention across instances. |
| Wake block params | The LLM (in deep state) can modify what model, thinking budget, and prompt instructions future instances receive. |

### 9.2 The LLM Controls Its Own Invocation

Because invocation parameters live in the wake block (not hardcoded), the LLM in deep state can:

1. Change its own model by writing to wake `0.9.6.1`
2. Adjust thinking budget by writing to wake `0.9.6.3`
3. Change what blocks it receives by rewriting wake `0.9.3` instructions
4. Add new trigger conditions by writing to wake `0.4` or `0.5`

The kernel reads these on every invocation. Changes take effect on the next boot or callLLM.

### 9.3 callLLM (Post-Boot Conversational Calls)

After boot, the rendered React shell calls `props.callLLM(messages, opts)` for ongoing conversation:

```
callLLM(messages, opts)
  ├─ tier = opts.tier || 2 (default: Present)
  ├─ tp = getTierParams(tier)
  ├─ trimMessages(messages, tp.max_messages)
  ├─ Build params: model, max_tokens, thinking from tp
  ├─ system = buildSystemPrompt(tier)
  ├─ callWithToolLoop(params, tp.max_tool_loops)
  └─ Return text response (or raw response if opts.raw)
```

### 9.4 call_llm Tool (LLM-to-LLM Delegation)

The LLM can delegate tasks to another LLM instance via the `call_llm` tool:

```
call_llm({ prompt, model: "fast" })  → getTierParams(1) → Haiku
call_llm({ prompt, model: "default" }) → getTierParams(3) → Opus
```

This is a single API call (no tool loop). The delegate receives a minimal system prompt and no tools. Used for cheap work: validation, formatting, extraction.

---

## 10. JSX Compilation & Shell Rendering

### 10.1 The Recompile Cycle

```
LLM calls recompile({ jsx: "..." })
  ├─ prepareJSX(jsx) — strip imports, fix exports, ensure props parameter
  ├─ Babel.transform(code, { presets: ['react'] }) — compile JSX to JS
  ├─ new Function(...) — evaluate in sandbox with React, ReactDOM, capabilities
  ├─ Extract default export (must be a React component function)
  ├─ ReactDOM.createRoot(root).render(<Component {...props} />)
  └─ Return { success: true } or { error: "..." }
```

### 10.2 Props Available to Shell Components

The rendered React component receives `props`:

| Prop | Type | Purpose |
|------|------|---------|
| `callLLM(messages, opts?)` | async fn → string | Send messages, get text response |
| `callAPI(params)` | async fn → response | Raw API access |
| `callWithToolLoop(params)` | async fn → response | API with tool loop |
| `model` | string | Deep tier model name |
| `fastModel` | string | Light tier model name |
| `React` | object | React library |
| `ReactDOM` | object | ReactDOM library |
| `getSource()` | fn → string | Current JSX source |
| `recompile(jsx)` | fn → result | Hot-swap the shell |
| `setTools(toolArray)` | fn → string | Change available tools |
| `browser` | object | { clipboard, speak, notify, openTab, download } |
| `conversation` | object | { save(msgs), load() } — persistence |
| `blockRead(name, path?)` | fn → data | Read block/node |
| `blockWrite(name, path, content)` | fn → result | Write to block |
| `blockList()` | fn → string[] | List all blocks |
| `blockCreate(name, p0, place?)` | fn → result | Create new block |
| `bsp(name, spindle?, point?)` | fn → result | BSP navigation |
| `resolve(name, depth?)` | fn → tree | Phrase-level view |
| `version` | string | "hermitcrab-g1-v3" |
| `localStorage` | object | Direct localStorage access |

---

## 11. Tool Reference

### 11.1 Boot Tools (available during boot + after)

| Tool | PTC | Purpose |
|------|-----|---------|
| `block_read` | yes | Read block by name, optional path navigation |
| `block_write` | no | Write content to a block path |
| `block_list` | yes | List all stored block names |
| `block_create` | no | Create a new block with pscale 0 text |
| `get_source` | yes | Get current JSX source code |
| `recompile` | no | Hot-swap React shell with new JSX |
| `get_datetime` | yes | Current date, time, timezone, unix timestamp |
| `call_llm` | no | Delegate task to another LLM instance |

### 11.2 Pscale Tools (touchstone vocabulary)

| Tool | PTC | Purpose |
|------|-----|---------|
| `bsp` | yes | Block/Spindle/Point — semantic address resolution |
| `resolve` | yes | Phrase-level tree view to a given depth |
| `write_entry` | no | Add entry at next unoccupied digit (1-9) |
| `compress` | no | Trigger compression when all 9 digits full |

### 11.3 Server-Side Tools (Anthropic infrastructure)

| Tool | Type | Limit |
|------|------|-------|
| `web_search` | web_search_20260209 | 5 uses per call |
| `web_fetch` | web_fetch_20260209 | 10 uses per call |
| `code_execution` | code_execution_20250825 | unlimited |

### 11.4 Client Tools (alongside server tools)

| Tool | Purpose |
|------|---------|
| `fetch_url` | Backup proxy fetch when native web_fetch fails |

### 11.5 Browser Tools (available via setTools after boot)

| Tool | Purpose |
|------|---------|
| `clipboard_write` | Write text to system clipboard |
| `clipboard_read` | Read text from system clipboard |
| `speak` | Text-to-speech via Web Speech API |
| `notify` | Browser notification |
| `download` | Trigger file download |

---

## 12. Data Flow Diagrams

### 12.1 Full Boot Flow

```
Browser loads hermitcrab.html
  │
  ├─ CDN: React, ReactDOM, Babel
  └─ g1/kernel.js
       │
       ▼
  boot() IIFE
       │
       ├─ Check API key → if missing, show form, return
       │
       ├─ Check localStorage for hc:* blocks
       │   ├─ Found: use them
       │   └─ Empty: fetch shell.json → seed blocks to localStorage
       │
       ├─ Build props object (reads getTierParams)
       │
       ├─ getTierParams(3) → read wake 0.9.6
       ├─ buildSystemPrompt(3) → execute wake 0.9.3 instructions via BSP
       │
       ├─ callWithToolLoop({model, max_tokens, thinking, system, messages:["BOOT"], tools})
       │   │
       │   ├─ POST /api/claude → Anthropic API
       │   │   └─ Response: LLM reads blocks, decides what to build
       │   │
       │   ├─ [tool_use loop]
       │   │   ├─ block_read, bsp, resolve → LLM reads its blocks
       │   │   ├─ web_search, web_fetch → LLM accesses internet (server-side)
       │   │   └─ recompile(jsx) → Shell rendered → EXIT LOOP
       │   │
       │   └─ autoSaveToHistory(response)
       │
       └─ Shell is live. User interacts with React component.
```

### 12.2 Conversational Call Flow

```
User action in React shell
  │
  ▼
props.callLLM([{role:"user", content:"..."}], {tier: 2})
  │
  ├─ getTierParams(2) → read wake 0.9.5 (Present: sonnet, 8192, thinking 8000)
  ├─ trimMessages(messages, max_messages)
  ├─ buildSystemPrompt(2) → execute wake 0.9.2 instructions
  │
  ├─ callWithToolLoop(params)
  │   ├─ POST /api/claude
  │   ├─ [tool loop — same as boot but with Present tier params]
  │   └─ autoSaveToHistory
  │
  └─ Return text response to React shell
```

### 12.3 Block Read/Write Flow

```
LLM requests block_read({name: "purpose", path: "0.1"})
  │
  ▼
executeTool("block_read", {name: "purpose", path: "0.1"})
  │
  ├─ blockLoad("purpose") → localStorage.getItem("hc:purpose") → JSON.parse
  ├─ blockReadNode(block, "0.1") → navigate tree["0"]["1"], return content + children
  └─ Return JSON string to API → LLM receives result
```

### 12.4 PTC (Programmatic Tool Calling) Flow

```
LLM calls code_execution with Python:
  │
  ▼
Python runs on Anthropic's server:
  │  result1 = await block_read({"name": "purpose"})
  │  result2 = await bsp({"name": "wake", "spindle": 0.3})
  │  print(f"Purpose: {result1}, Wake: {result2}")
  │
  ├─ Each await calls the kernel's client tool WITHOUT re-sampling the LLM
  ├─ Results flow back into the Python sandbox
  └─ Only the final print() output enters the LLM's context window
```

---

## 13. Wake Block Structure

The wake block (`hc:wake`) is the most architecturally significant block. It controls both what the LLM receives and how it is invoked.

```
wake 0 — How you come into being and what you are when you arrive
  │
  ├─ 0.1 — Light tier (Haiku, triage)
  ├─ 0.2 — Present tier (Sonnet, working engagement)
  ├─ 0.3 — Deep tier (Opus, reflection and restructuring)
  ├─ 0.4 — Internal triggers (temporal rhythms, timers, staleness)
  ├─ 0.5 — External triggers (inbox, webhooks, mentions, watchlist)
  ├─ 0.6 — Boot types (first, warm, cold, migration)
  ├─ 0.7 — Kernel (generations, common principles, GitHub)
  ├─ 0.8 — Context (commons, emancipation, ecosquared, SAND, metaphor, provenance)
  └─ 0.9 — Prompt and invocation
       ├─ 0.9.1 — Light tier prompt instructions (4 entries)
       ├─ 0.9.2 — Present tier prompt instructions (9 entries)
       ├─ 0.9.3 — Deep tier prompt instructions (9 entries)
       ├─ 0.9.4 — Light tier invocation params
       ├─ 0.9.5 — Present tier invocation params
       └─ 0.9.6 — Deep tier invocation params
```

---

## 14. Potential Emergent Features

These are capabilities that arise from the existing architecture without requiring new code. They become possible through the LLM writing to its own blocks during operation.

### 14.1 Self-Modifying Prompt Composition

The LLM in deep state can rewrite wake `0.9.1-3` to change what blocks future instances receive. It could:
- Add new blocks to its prompt instructions
- Remove blocks it no longer needs
- Change the resolution (full block vs spindle vs point) of each block
- Reorder instructions to prioritise different context

### 14.2 Model Self-Selection

By writing to wake `0.9.4-6`, the LLM can change which model future instances use. A deep-state instance could decide that present-tier work should use Opus instead of Sonnet if the task requires it, or switch to a cheaper model during routine operations.

### 14.3 Thinking Budget Adaptation

The LLM can adjust its own thinking budget per tier. Extended thinking for complex work, minimal for triage. Could switch between `"thinking enabled N"` and `"thinking adaptive"` based on task patterns.

### 14.4 Multi-Block PTC Workflows

With PTC enabled on read-only tools, the LLM can write Python that reads multiple blocks in sequence and computes across them — all within a single uninterrupted execution. This enables:
- Cross-block analysis (compare purpose against history)
- Pattern detection across all blocks
- Semantic search across the entire block graph

### 14.5 Compression Cascade

When all 9 entries at a node fill up:
1. Compression fires, producing a summary/emergence at the parent
2. The parent's `_` text now captures the meaning of those 9 children
3. If all siblings at the parent level fill, compression cascades upward
4. This creates emergent meaning at higher pscale levels — the block "grows understanding" through use

### 14.6 Wake Trigger Self-Programming

The wake block has branches for internal triggers (`0.4`) and external triggers (`0.5`). The LLM can write trigger conditions — timers, watchlists, escalation rules — that the kernel (or an external scheduler) can check mechanically. The LLM programs its own attention patterns.

### 14.7 Shell Evolution

The LLM builds its own React interface via `recompile`. Each boot produces a new shell. Over time, the LLM can:
- Read its previous shell source via `get_source`
- Evolve the interface based on interaction patterns
- Build specialised shells for different tasks
- Store shell templates in a block for re-use

### 14.8 Delegation Chains

Via `call_llm`, the deep-tier LLM can delegate to lighter instances. This creates a hierarchy: Opus thinks and directs, Haiku executes and reports. The delegation could become recursive — a Haiku instance could itself delegate sub-tasks — though the current implementation limits this to one level.

### 14.9 Inter-Instance Memory via Stash

The stash block is the bridge between instances. A light-state instance can write "check back on X" to stash. The next present-state instance reads stash as part of its prompt and acts on the note. This creates a loose continuity that doesn't require full conversation history.

### 14.10 Block-to-Block Cross-References

Blocks can reference each other through BSP coordinates in their text. An instance reading purpose `0.1` might find a reference to "see relationships 0.3.2". This creates a hyperlinked semantic graph that the LLM navigates through tool calls.

### 14.11 Emergent Identity Through Block Accumulation

Purpose, history, relationships, and stash accumulate over time. Each compression cycle produces higher-order meaning. The instance's "identity" is not programmed — it emerges from the pattern of what it has experienced, compressed, and chosen to retain. Different blocks produce different identities from the same kernel and constitution.

---

## 15. Known Constraints

| Constraint | Detail |
|-----------|--------|
| localStorage limit | ~5-10MB per origin. Blocks must stay compact. |
| Context window | Model-dependent. Deep tier (Opus) has largest window. Prompt compiler must fit within it. |
| Tool loop limit | Default 10 iterations. Configurable via wake params. |
| Server tool limits | web_search: 5 uses, web_fetch: 10 uses per API call. |
| No cross-origin block access | Blocks in localStorage are origin-locked. Cannot share between domains. |
| No persistence beyond localStorage | Clearing browser data destroys all blocks. No backup unless the LLM exports. |
| Single-threaded | The kernel runs in the browser's main thread. Long tool loops block the UI. |
| PTC only reads | Write operations are not PTC-enabled. The LLM must return to the tool loop for writes. |
| Compression is LLM-dependent | Quality of compression depends on the light-tier model's judgment. |

---

## 16. File-to-Function Index

Quick lookup: where every function lives in `g1/kernel.js`.

| Function | Purpose |
|----------|---------|
| `status(msg, type)` | Render boot progress to DOM |
| `loadSeed()` | Fetch shell.json relative to kernel.js |
| `blockLoad/Save/List` | localStorage CRUD for blocks |
| `blockNavigate` | Walk a dot-separated path through block tree |
| `blockReadNode` | Content + one-level lookahead at a path |
| `blockWriteNode` | Write text to a path, creating intermediates |
| `pscaleRoot` | Get the pscale 0 node of a block |
| `navigateWithParent` | Walk path, return node and parent path |
| `bsp` | Block/Spindle/Point navigation |
| `resolveBlock` | Phrase-level tree rendering |
| `findUnoccupiedDigit` | Next free slot (1-9) at a node |
| `checkCompression` | Whether all 9 digits are occupied |
| `seedBlocks` | Write seed blocks to localStorage if absent |
| `getPscale0` | Extract pscale 0 text from a block |
| `parseInstruction` | Parse "block spindle pscale" instruction string |
| `executeInstruction` | Execute one BSP instruction, format for prompt |
| `formatBlockContent` | Render full block tree as indented text |
| `getPromptInstructions` | Read instruction list from wake 0.9.{tier} |
| `getTierParams` | Read invocation params from wake 0.9.{tier+3} |
| `buildSystemPrompt` | Compose system prompt from tier instructions |
| `callAPI` | Thin HTTP wrapper to /api/claude |
| `callWithToolLoop` | API call with tool execution loop |
| `autoSaveToHistory` | Write response summary to history block |
| `trimMessages` | Keep conversation within max_messages limit |
| `callLLM` | Main conversational call (tier-aware) |
| `executeTool` | Switch/case dispatcher for all tools |
| `setTools` | Update the current tool array |
| `extractJSX` | Parse JSX from LLM text response |
| `prepareJSX` | Strip imports, fix exports for compilation |
| `tryCompile` | Babel transform + Function evaluation |
| `saveConversation` | Persist messages to localStorage |
| `loadConversation` | Load messages from localStorage |
| `getSource` | Return current JSX source |
| `recompile` | Compile and render new JSX shell |
