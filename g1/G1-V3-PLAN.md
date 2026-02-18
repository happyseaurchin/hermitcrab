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

Layer 2  Server-side tools (execute on Anthropic's infrastructure)
         Results feed BACK INTO Claude's reasoning before response reaches us.
         Claude can loop internally — search, read results, search again —
         all within a single API call. We never see the HTTP requests.

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

Layer 2a Programmatic bridge (code in sandbox calls Layer 3 tools)
         Claude writes Python/Bash in code_execution that calls custom
         tools. Intermediate results stay IN THE SANDBOX — they do NOT
         enter Claude's context window. Only the final output does.

         Enabled by: allowed_callers: ["code_execution_20250825"] on
         any tool definition. The sandbox calls the tool, receives
         the result, processes it, and returns only what matters.

         THIS IS TRANSFORMATIVE FOR BLOCK ACCESS:
         Instead of 10 block_read round-trips (10 network crossings,
         10 context entries), Claude writes one Python script that
         traverses the block tree and returns a summary. 1 round-trip.

         ---- network boundary (API response travels to browser) ----

Layer 3a Anthropic-defined client tools (official schemas, WE execute)
         Claude outputs tool_use with Anthropic type strings. The request
         crosses the network. We execute and return result. Claude has
         been TRAINED on these — it knows them natively.

         ┌─────────────────────────────────────────────────────────────┐
         │ computer_20250124    — computer use (screenshots, mouse,   │
         │                        keyboard). NOT used by hermitcrab.  │
         │                                                             │
         │ text_editor_20250124 — file editing (view, create, insert, │
         │                        replace). NOT used by hermitcrab    │
         │                        (we have recompile/get_source).     │
         └─────────────────────────────────────────────────────────────┘

         These exist. We don't use them. But the LLM should know the
         distinction: these are tools Claude was trained on vs tools
         it learns from our definitions.

Layer 3b User-defined client tools (our schemas, we execute)
         Same execution path as 3a — Claude requests, network crossing,
         kernel executes, result returns. But Claude has NO special
         training. It learns from the tool definitions we provide.

         block_read, block_write, block_list, block_create,
         get_source, recompile, call_llm, get_datetime

Layer 4  Kernel execution (kernel.js in browser)
         The engine that runs Layer 3 tools. Also: prompt assembly,
         conversation management, auto-save mechanics, tool loop,
         server tool passthrough.

Layer 5  Browser services (called by kernel)
         localStorage (block persistence), Babel (JSX transpilation),
         ReactDOM (rendering), browser APIs (clipboard, speech, etc.)

Layer 6  External services
         API proxy (relays to Anthropic), target URLs, other hermitcrabs
```

### Cross-layer infrastructure

These are not layers — they are **mechanisms that change how layers relate**.

**Programmatic tool calling** (Layer 2 → Layer 3b bridge)
Claude writes code in the sandbox that calls our custom tools. Add
`allowed_callers: ["code_execution_20250825"]` to any tool definition.
The critical property: intermediate results stay in the sandbox, NOT in
Claude's context. Only the final code output enters context. This means
Claude could write a Python script that calls block_read 10 times,
processes the results, and returns a summary — 1 round-trip instead of 10.

**Agent Skills** (context management overlay)
Modular SKILL.md bundles with progressive disclosure. Three levels:
1. Metadata (~100 tokens) — always in system prompt. Name + trigger.
2. Instructions — loaded when triggered. Full operational guide.
3. Resources — loaded as needed. Templates, examples, data.

Skills require code_execution. Pre-built for PowerPoint/Excel/Word/PDF.
Custom skills possible. For hermitcrab: "block navigation", "shell
building", "delegation patterns" — loaded only when relevant. This is
a context budget mechanism, not a capability layer.

**MCP Connector** (Layer 2 → Layer 6 bridge)
Connect to remote MCP servers directly from the API. Hermitcrabs could
reach external services without our proxy. Not yet used.

**Files API** (Layer 2 persistence)
Upload/download files to/from the code_execution sandbox. Could enable
the hermitcrab to generate files (visualisations, documents) and serve
them through its interface. Container persists 30 days.

### What this means for v3

**G1 v2 built everything at layers 3b-6.** Custom web_fetch tool (layer 4) instead of Anthropic's server-side web_fetch (layer 2). Custom block storage (layer 4-5) instead of considering Claude's container persistence (layer 2). No web_search at all in BOOT_TOOLS.

**G0 was closer to right** — it used Claude's native memory tool (layer 2) and referenced web_search in the environment doc.

**v3 should maximise layers 1-2.** Use server-side tools wherever possible. They're faster (no network round-trip), cheaper (web_fetch is free), and more natural for the LLM (results feed directly into reasoning).

**Programmatic tool calling is the biggest unlock.** Block access becomes efficient. Instead of the LLM making individual block_read calls (each a full API round-trip), it writes a traversal script that runs at Layer 2 speed. The block tree becomes as accessible as a local file.

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

### Tools — Client-side (Layer 3b)

These are kernel-executed tools. Keep only what MUST run in the browser:

```javascript
const CLIENT_TOOLS = [
  // Block operations — must be client-side (localStorage)
  // NOTE: allowed_callers enables programmatic bridge (Layer 2a)
  { name: 'block_read',   ..., allowed_callers: ['code_execution_20250825'] },
  { name: 'block_write',  ..., allowed_callers: ['code_execution_20250825'] },
  { name: 'block_list',   ..., allowed_callers: ['code_execution_20250825'] },
  { name: 'block_create', ..., allowed_callers: ['code_execution_20250825'] },

  // UI operations — must be client-side (DOM)
  // NOT callable from sandbox (needs browser DOM)
  { name: 'get_source', ... },
  { name: 'recompile', ... },

  // Delegation — client-side (makes new API calls)
  { name: 'call_llm', ... },

  // Browser-only APIs
  { name: 'get_datetime', ... }
];
```

**allowed_callers on block tools**: This enables the programmatic bridge. Claude can write Python in the sandbox that calls block_read/block_write directly, with intermediate results staying in the sandbox. Bulk block operations become 1 round-trip instead of N. Note: need to verify how the sandbox routes calls back to our kernel — this may require a webhook endpoint on the proxy server (see Open Question 3).

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
  0.1.3: "code_execution — run Python/Bash in a persistent sandbox. Data analysis, visualisation, file ops."
  0.1.4: "Programmatic bridge — write code in the sandbox that calls your block tools.
           Intermediate results stay in the sandbox. Only the final output enters your context.
           10 block reads in one round-trip instead of 10."

0.2: "Blocks. Your persistent structured memory, stored in the browser."
  0.2.1: "block_read(name, path?) — navigate to a specific position in a block."
  0.2.2: "block_write(name, path, content) — write content at a position."
  0.2.3: "block_list() — see all blocks. block_create(name, pscale0) — make a new one."
  0.2.4: "These tools cross the network — each call is a round-trip. For bulk access, use 0.1.4."

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

Note the key addition: 0.1.4 (programmatic bridge) and 0.2.4 (cost awareness). The LLM needs to understand that block reads have a cost (network round-trip) and that bulk access should use the sandbox bridge.

---

## Kernel Changes (Step 3)

### 3.1. Add server-side tools to every API call

The proxy server needs updating to pass through server tool types. Currently it just relays — but it needs to handle `anthropic-beta` headers for code_execution and web tools. Required header: `code-execution-web-tools-2026-02-09`.

In kernel.js, the `callAPI` function needs to include SERVER_TOOLS alongside CLIENT_TOOLS in the tools array. Server-side tools don't need execution handling — Anthropic handles them. But we need to handle `pause_turn` stop_reason (server tools may need continuation).

### 3.2. Handle server tool responses in tool loop

Currently `callWithToolLoop` only handles `stop_reason === 'tool_use'` (client tools). Server tools return with `stop_reason === 'end_turn'` normally, but may return `stop_reason === 'pause_turn'` if the server-side loop hits its limit. Need to handle this.

Also: server tool results (`web_search_tool_result`, `web_fetch_tool_result`, `code_execution_tool_result`) appear in the response content alongside text blocks. The kernel doesn't need to execute them — but it should not try to execute them either. Current tool loop filters for `type === 'tool_use'` — need to also handle `type === 'server_tool_use'` (skip execution, just continue).

### 3.3. Auto-save to history

After each API response, extract text content and append to history block. Mechanical — no LLM involvement.

### 3.4. Constitution loading

Same as v2 — load from seed.json, prepend to system prompt every call.

### 3.5. Aperture for 6 blocks

```javascript
const names = ['capabilities', 'history', 'purpose', 'stash', 'relationships'];
```

(Keystone handled separately in system prompt. Constitution is not a block.)

### 3.6. Remove redundant custom tools

Remove: web_fetch (replaced by server-side), web_request (replaced by server-side web_fetch), open_tab (browser-only, add via setTools if needed).

### 3.7. Programmatic tool calling (allowed_callers)

Add `allowed_callers: ["code_execution_20250825"]` to block_read, block_write, block_list, block_create tool definitions. This enables the Layer 2a bridge — Claude writes Python that calls block tools from the sandbox.

**Implementation question**: When the sandbox calls block_read, how does the request reach our browser? Options:
- (a) Anthropic routes tool calls back through the API response (most likely — the sandbox pauses, emits a tool_use, we execute, return result, sandbox resumes)
- (b) We need a webhook endpoint that the sandbox calls directly (would require publicly accessible server)
- (c) This feature only works with API-accessible tools, not browser-based ones

This needs testing. If (a), it's straightforward — just add allowed_callers. If (b) or (c), we may need to defer programmatic tool calling until we have a server-side persistence layer.

### 3.8. Proxy server updates

The proxy currently relays API calls. It needs:
- Pass through `anthropic-beta` header with value `code-execution-web-tools-2026-02-09`
- May need to handle tool call routing for programmatic tool calling (see 3.7)
- No longer needs to relay web fetch requests (replaced by server-side web_fetch)

---

## Pscale Fundamentals (Step 2 — UNBLOCKED, typology received)

The pscale fundamentals typology v2 has been received (see `pscale-fundamentals-typology-v2.md`).

### Six Fundamentals (growth trigger is implementation, not structural)

| Variable | Options |
|----------|---------|
| Digit property | Sequential / Labeling / Arbitrary |
| Pscale mapping | Containment / Temporal / Relational |
| Direction | Pscale (up/down), Block sign (+/-), Digit (1→9 / 9→0) |
| Compression | Summary (Mode A, idempotent) / Emergence (Mode B, irreversible) |
| Rendition or Living | 0.x self-defining / has fork + decimal |
| Chunk size | Range × chunk ≈ token cost |

### Block Format (v3)

```json
{
  "decimal": 2,
  "fork": "74.45",
  "sign": 1,
  "tree": { ... }
}
```

- `decimal`: where pscale 0 sits in the number. 0 = rendition (0.x block).
- `fork`: tuning fork — a resonance reference, not an authority. The LLM reads the content, senses what the levels mean, and the fork confirms or suggests adjustment. NOT a registry lookup. Two blocks with the same fork resonate at the same scale.
- `sign`: 1 = positive (real, lived, actual). -1 = negative (fictional, representational, hypothetical). Middle Earth's spatial block = sign -1.
- `tree`: the content.

For rendition blocks (capabilities, keystone): `decimal: 0`, no fork needed, self-defining through pscale 0.

### Hermitcrab Block Combinations

| Block | Digit | Mapping | Digit direction | Compression | Living? | Sign |
|-------|-------|---------|-----------------|-------------|---------|------|
| **History** | Sequential | Temporal | Away (1→9) | Summary | Living | +1 |
| **Stash** | Sequential | Containment | Away (1→9) | Either | Living | +1 |
| **Purpose** | Arbitrary | Temporal | Both | Emergence | Living | +1 |
| **Relationships** | Arbitrary | Relational | Both | Emergence | Living | +1 |
| **Capabilities** | Labeling | Containment | Toward 0 | N/A (static) | Rendition | +1 |
| **Keystone** | Labeling | Containment | Toward 0 | N/A (static) | Rendition | +1 |

### Spindle = Primary Output

The block exists to generate spindles. A spindle like `21.34` extracts a path of semantic vectors from high pscale (wide context) to low pscale (specific detail). This is what the LLM actually consumes. `block_read(name, path)` is crude spindle extraction — the real operation is pulling the full path from root to leaf.

### Tuning Fork (replaces "key")

The fork is NOT a lookup. It's a resonance check:
- Strike the fork → does this block structure resonate with it?
- If spindles produce coherent context cascades → fork is right
- If they don't → adjust the fork
- Two hermitcrabs with the same fork can align blocks without a conductor

The fork collection (if needed) is a 0.x rendition block. But the fork is ancillary — an LLM can read the block content and infer what pscale levels mean. The fork confirms, it doesn't dictate.

---

## Open Questions

### Resolved

1. ~~**Proxy server**~~: ✅ RESOLVED. Proxy passes beta headers. Updated to current versions.
6. ~~**Self-triggering**~~: ✅ RESOLVED. Boot prompts now describe callLLM explicitly. Full fix via capabilities 0.4.1.
7. ~~**Pscale-0 question**~~: ✅ RESOLVED. `decimal` field positions pscale 0. `decimal: 0` = rendition (0.x). `decimal: N` = living block with N digits above pscale 0.

### Open

2. **Container reuse**: code_execution containers persist 30 days. Should the hermitcrab store its container ID in a block? This would give it persistent server-side file storage — an alternative to localStorage for larger data.

3. **Programmatic tool calling implementation**: When the sandbox calls block_read, how does the request reach our browser? Options: (a) Anthropic routes through API response, (b) webhook needed, (c) only works with API-accessible tools. Needs testing.

4. **Files API**: Could the hermitcrab upload blocks to the sandbox for processing? Generate files and serve them?

5. **Second-order processing**: The hermitcrab analyses its own blocks via code_execution or a scheduled Haiku call. Which approach? Or both — code for pattern finding, Haiku for meaning making?

8. **Agent Skills**: Custom SKILL.md bundles for hermitcrab capabilities. Progressive disclosure saves context tokens.

9. **Anthropic client tools**: Should the LLM know computer_use/text_editor exist at Layer 3a?

10. **Block sign and fictional worlds**: A hermitcrab entering a game world (Middle Earth) creates spatial blocks with `sign: -1`. How does the kernel distinguish real from fictional blocks? Should block_list show sign? Can you do arithmetic across sign boundaries (real history + fictional history)?

11. **Stash mapping hybrid**: Stash is sequential + containment (accumulates over time but organises by topic). Is it using two mappings simultaneously? Does the typology allow this? The fork might need to express compound mappings.

12. **Purpose as fourth dimension**: Is arbitrary + temporal + emergence genuinely novel — a coordinate dimension beyond S, T, I? If so, purpose-blocks have a special structural status.

13. **Constitution revision**: Add the self-organising principle: "Not by telling through words, but by self-organising instances." The hermitcrab demonstrates values through how it operates, not by declaring them.

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
