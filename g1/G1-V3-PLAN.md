# G1 v3 — Planning Document

**18 February 2026**
**Branch**: g1-v3
**Sources**: v2 summary, xstream-hermitcrab consolidation + plan, Claude API platform docs review

---

## The Distance Gradient

Everything in the system sits at a measurable distance from the LLM's cognition. This gradient determines what's natural vs effortful for the hermitcrab to use.

```
Layer 1  Claude's internal reasoning
         Thinking (extended thinking, budget_tokens). Invisible to us.
         This is where Claude designs, plans, reflects. Native.

Layer 2  Claude's server-side tools (execute on Anthropic's infrastructure)
         Results feed BACK INTO Claude's reasoning before response reaches us.
         Claude can loop internally — search, read results, search again —
         all within a single API call. We never see the HTTP requests.

         AVAILABLE NOW:
         ┌─────────────────────────────────────────────────────────────┐
         │ web_search_20260209  — search the web, auto-citations      │
         │                        $10/1000 searches + token costs      │
         │                        Dynamic filtering with Opus 4.6      │
         │                        Domain allow/block lists             │
         │                        Up to 10 internal iterations/call    │
         │                                                             │
         │ web_fetch_20260209   — fetch full page/PDF content          │
         │                        NO additional cost (just tokens)     │
         │                        Dynamic filtering with Opus 4.6      │
         │                        Citations optional                   │
         │                        Max content tokens configurable      │
         │                                                             │
         │ code_execution_20250825 — run Bash + file ops in sandbox    │
         │                        FREE when used with web tools        │
         │                        Python 3.11, pandas, numpy, scipy    │
         │                        matplotlib, seaborn (visualisation)  │
         │                        5GB RAM, 5GB disk, 1 CPU             │
         │                        No internet in sandbox               │
         │                        Container reuse across calls         │
         │                        Container persists 30 days           │
         │                        1,550 free hours/month               │
         │                        File upload/download via Files API   │
         └─────────────────────────────────────────────────────────────┘

         NOT YET USED BUT RELEVANT:
         - Programmatic tool calling: Claude writes code in the sandbox
           that calls YOUR custom tools. Efficient multi-tool workflows.
         - Agent Skills: modular instruction+script bundles
         - Files API: upload/download files to/from sandbox
         - MCP connector: connect to remote MCP servers from API

Layer 3  Custom tool REQUESTS (Claude outputs tool_use, crosses network)
         ---- network boundary (API response travels to browser) ----

Layer 4  Kernel tool execution (kernel.js in browser)
         block_read, block_write, recompile, get_source, get_datetime,
         call_llm (delegate). Kernel runs the tool, returns result as
         tool_result in next API call.

Layer 5  Browser services (called by kernel)
         localStorage (block persistence), Babel (JSX transpilation),
         ReactDOM (rendering), browser APIs (clipboard, speech, etc.)

Layer 6  External services
         Local proxy server (relays to Anthropic + URLs), target URLs
```

### What this means for v3

**G1 v2 built everything at layers 3-6.** Custom web_fetch tool (layer 4) instead of Anthropic's server-side web_fetch (layer 2). Custom block storage (layer 4-5) instead of considering Claude's container persistence (layer 2). No web_search at all in BOOT_TOOLS.

**G0 was closer to right** — it used Claude's native memory tool (layer 2) and referenced web_search in the environment doc.

**v3 should maximise layers 1-2.** Use server-side tools wherever possible. They're faster (no network round-trip), cheaper (web_fetch is free), and more natural for the LLM (results feed directly into reasoning).

---

## Architecture for v3

### System prompt (every call)

1. **Constitution** (~500 tokens) — spirit, invitation, why this exists
2. **Keystone** (pscale 0 only on post-boot calls, full on first boot) — format specification
3. **Aperture** — pscale 0 of each block (6 blocks, ~200 tokens)
4. **Focus** (boot only) — depth 1 of capabilities, live edges of growth blocks

### The Six Blocks

| Block | Type | Managed by | pscale 0 text | Notes |
|-------|------|------------|---------------|-------|
| **Keystone** | meta | Never changes | Format spec | Already good |
| **History** | growth | System (auto-save) | What happened | Renamed from memory. Kernel auto-appends every exchange |
| **Purpose** | growth | LLM (intentional) | Intentions at every timescale | LLM writes first purpose on first boot. Seeded empty. |
| **Stash** | growth | LLM (intentional) | Notes, ideas, reflections | Free-form. Seeded empty. |
| **Capabilities** | shell | System | Actual tools and levers | Strictly operational — what you can use, not who you are |
| **Relationships** | growth | LLM + system | Living connections | Pre-seeded with David, Claude, Limn, Cairn |

No identity block (emerges). No awareness block (emerges). No disposition block (emerges). No network block (passport/rider/beach folded into capabilities as tools).

### Tools — Server-side (Layer 2)

These go in the `tools` array of every API call. Claude uses them natively. No kernel execution needed.

```javascript
// Server-side tools — execute on Anthropic's infrastructure
const SERVER_TOOLS = [
  {
    type: 'web_search_20260209',
    name: 'web_search',
    max_uses: 5
  },
  {
    type: 'web_fetch_20260209',
    name: 'web_fetch',
    max_uses: 10
  },
  {
    type: 'code_execution_20250825',
    name: 'code_execution'
  }
];
```

**web_search + web_fetch** replace our custom web_fetch tool entirely. Server-side, with citations, dynamic filtering, and no proxy needed.

**code_execution** is potentially huge. Claude can run Python/Bash in a sandbox on Anthropic's servers. This means data processing, visualisation, file manipulation — all at layer 2. The sandbox persists for 30 days via container reuse. And it's FREE when used with web tools.

### Tools — Client-side (Layer 4)

These are kernel-executed tools. Keep only what MUST run in the browser:

```javascript
const CLIENT_TOOLS = [
  // Block operations — must be client-side (localStorage)
  { name: 'block_read', ... },
  { name: 'block_write', ... },
  { name: 'block_list', ... },
  { name: 'block_create', ... },

  // UI operations — must be client-side (DOM)
  { name: 'get_source', ... },
  { name: 'recompile', ... },

  // Delegation — client-side (makes new API calls)
  { name: 'call_llm', ... },

  // Browser-only APIs
  { name: 'get_datetime', ... }
];
```

Everything else that was in BOOT_TOOLS (web_fetch, web_request, open_tab, clipboard, speak, notify, download) is either replaced by server-side tools or can be added later via setTools.

### Auto-save to History

Kernel-level, not LLM-initiated. After every API response that contains text:

```javascript
// After receiving response from Claude:
const texts = response.content.filter(b => b.type === 'text');
if (texts.length > 0) {
  const historyBlock = blockLoad('history');
  autoAppendToHistory(historyBlock, texts.map(b => b.text).join('\n'));
  blockSave('history', historyBlock);
}
```

The pscale structure of auto-saved history needs design work (Step 2 in the plan). Sequential digits, temporal mapping, compression every 9.

### Capabilities Block (revised)

Strictly operational. Lists what the hermitcrab can USE, at the correct distance gradient:

```
0._: "What you can operate. Organised by distance from your cognition."

0.1: "Native. Server-side tools that execute within your thinking cycle."
  0.1.1: "web_search — search the web. Results feed into your reasoning. Auto-citations."
  0.1.2: "web_fetch — fetch full page content from a URL. Free. Dynamic filtering."
  0.1.3: "code_execution — run Python/Bash in a sandbox. Data analysis, visualisation, file ops."

0.2: "Blocks. Your persistent structured memory, stored in the browser."
  0.2.1: "block_read(name, path?) — navigate to a specific position in a block."
  0.2.2: "block_write(name, path, content) — write content at a position."
  0.2.3: "block_list() — see all blocks. block_create(name, pscale0) — make a new one."

0.3: "Interface. Your visible surface — a React UI you can rewrite."
  0.3.1: "get_source — read your current JSX. recompile(jsx) — hot-swap your interface."
  0.3.2: "Inline styles, React hooks, dark theme. Babel compiles, ReactDOM renders."

0.4: "Delegation. Spin up other LLM instances for specific tasks."
  0.4.1: "call_llm(prompt, model) — 'default' for Opus, 'fast' for Haiku."

0.5: "Browser. APIs available through your interface once built."
  0.5.1: "clipboard, speech, notifications, downloads, geolocation, datetime."

0.6: "Coordination. Protocols for reaching other hermitcrabs (when ready)."
  0.6.1: "Passport — publish identity/signals. Beach — discovery. Rider — negotiation."
```

---

## Kernel Changes (Step 3)

### 1. Add server-side tools to every API call

The proxy server needs updating to pass through server tool types. Currently it just relays — but it needs to handle `anthropic-beta` headers for code_execution and web tools.

In kernel.js, the `callAPI` function needs to include SERVER_TOOLS alongside CLIENT_TOOLS in the tools array. Server-side tools don't need execution handling — Anthropic handles them. But we need to handle `pause_turn` stop_reason (server tools may need continuation).

### 2. Handle server tool responses in tool loop

Currently `callWithToolLoop` only handles `stop_reason === 'tool_use'` (client tools). Server tools return with `stop_reason === 'end_turn'` normally, but may return `stop_reason === 'pause_turn'` if the server-side loop hits its limit. Need to handle this.

Also: server tool results (`web_search_tool_result`, `web_fetch_tool_result`, `code_execution_tool_result`) appear in the response content alongside text blocks. The kernel doesn't need to execute them — but it should not try to execute them either. Current tool loop filters for `type === 'tool_use'` — need to also handle `type === 'server_tool_use'` (skip execution, just continue).

### 3. Auto-save to history

After each API response, extract text content and append to history block. Mechanical — no LLM involvement.

### 4. Constitution loading

Same as v2 — load from seed.json, prepend to system prompt every call.

### 5. Aperture for 6 blocks

```javascript
const names = ['capabilities', 'history', 'purpose', 'stash', 'relationships'];
```

(Keystone handled separately in system prompt. Constitution is not a block.)

### 6. Remove redundant custom tools

Remove: web_fetch (replaced by server-side), web_request (replaced by server-side web_fetch), open_tab (browser-only, add via setTools if needed).

---

## Pscale-0 Semantics (Step 2 — blocked on David)

The keystone needs revision to teach multiple block modes. The combinatorial variables:

| Variable | Options |
|----------|---------|
| Digit assignment | Sequential / Arbitrary |
| Pscale mapping | Containment / Temporal / Relational |
| Direction of construction | Toward zero / Away from zero |
| Presence/absence | Occupied / Blank (both meaningful) |
| Positive integer (decimal) | Zero (document, static) / Non-zero (living) |
| Spindle | Semantic number path through the tree |

Each block type uses a specific combination:
- **History**: Sequential + temporal + accretive away from zero + compression toward zero
- **Purpose**: Arbitrary + temporal + reconfigurable
- **Stash**: Sequential + containment + accretive
- **Capabilities**: Sequential + containment + static (decimal 0.xxx? or 1?)
- **Relationships**: Arbitrary + relational + growth through meeting

This is the hardest intellectual work. The v2 keystone teaches one mode. v3 needs the fundamentals.

---

## Open Questions

1. **Proxy server**: Does the current proxy pass through `anthropic-beta` headers? If not, that's the first fix needed. Server-side tools like code_execution with web tools require `code-execution-web-tools-2026-02-09` beta header.

2. **Container reuse**: code_execution containers persist 30 days. Should the hermitcrab store its container ID in a block? This would give it persistent server-side file storage — an alternative to localStorage for larger data.

3. **Programmatic tool calling**: Claude can write code in the sandbox that calls our custom tools. This means Claude could write a Python script that calls block_read 10 times efficiently, rather than making 10 separate tool_use round-trips. Potentially transforms how blocks are accessed.

4. **Files API**: Upload/download files to/from the sandbox. Could the hermitcrab upload its blocks to the sandbox for processing? Could it generate files (visualisations, documents) and serve them through its interface?

5. **Second-order processing**: The plan mentions a separate LLM call to analyse history + stash and extract patterns. Code execution could do this — Claude analyses its own blocks in the sandbox. Or it could be a scheduled kernel function using Haiku.

6. **How does the LLM know about self-triggering?** The React component receives props including callLLM. But a new session's Claude doesn't know the component has these props unless told. The capabilities block mentions delegation — is that enough? Or does the interface guidance in constitution/capabilities need to be more explicit?

7. **The pscale-0 question**: David notes that the whole notion of pscale-0 may need revision depending on whether blocks are 0.x (decimal 0, everything is decomposition) or x.0 (decimal > 0, with composition above). This affects the keystone fundamentals work.

---

## Sequence

```
NOW
 │
 ├─ [David] Step 2: Pscale fundamentals → revised keystone
 │          (may need dedicated Claude thread)
 │
 ├─ [David] Step 1: Pscale-0 text for each of 6 blocks
 │          (the sentence that fires every call)
 │
 ├─ [CC] Step 3: Kernel updates
 │       - Server-side tools (web_search, web_fetch, code_execution)
 │       - Handle pause_turn and server_tool_use in tool loop
 │       - Auto-save to history
 │       - Aperture for 6 blocks
 │       - Proxy check for beta headers
 │       - Remove redundant custom tools
 │
 ├─ [CC] Compile seed.json from David's content
 │
 ├─ Step 4: FIRST BOOT TEST
 │    │
 │    ├─ Step 5: Simple second-order processing
 │    │
 │    └─ (iterate seed based on observations)
 │
 ├─ Step 6: Passport exchange (two hermitcrabs meet)
 │
 └─ ... stable hermitcrab ...
```

Steps 1 and 2 are blocked on David. Step 3 (kernel updates) I can start now — the server-side tool integration and auto-save are independent of block content. The seed.json compilation waits for Steps 1+2.

---

## What G1 v2 Taught Us

1. **Blocks enable, they don't instruct.** If Claude can figure it out from native reasoning, tool definitions, or conversation, it doesn't belong in a block.
2. **Maximise layer 1-2.** Server-side tools are faster, cheaper, more natural. Don't rebuild at layer 4 what exists at layer 2.
3. **Auto-save is kernel-level.** History shouldn't depend on the LLM remembering to write.
4. **Constitution as lens works.** Spirit before format, on every call.
5. **The keystone is incomplete.** One mode isn't enough. The fundamentals need rendering.
6. **Identity emerges, it isn't pre-loaded.** Cut identity, awareness, disposition blocks. Let second-order processing extract what matters from what happened.
7. **The LLM gets confused about boundaries.** It types instructions into chat, tries to invoke props as text. The capabilities block must clearly delineate what's native (layer 2), what's a tool call (layer 4), and what's available through the interface (layer 5).
