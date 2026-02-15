# G-Port Specification — Porting G0 to G1, G-1, G~1

**Status**: Active reference for porting work
**Origin**: G0 v0.4 completed 15 Feb 2026 (commit `29939ff`)
**URL**: `https://hermitcrab.me/docs/g-port-spec.md`

---

## What G0 Established

G0 is the seed — a self-bootstrapping LLM kernel where Claude instances generate their own React UI from a constitution and environment brief. The instance discovers capabilities, builds its shell, and evolves.

### Four Pillars

| Pillar | What | G0 Implementation | Skill Doc |
|--------|------|-------------------|-----------|
| **Pscale** | Memory | localStorage filesystem (`/memories/M-1.md`) | `pscale-primer.md`, `memory-compaction.md` |
| **Passport** | Identity | Skill doc only — instance builds it | `passport-skill.md` |
| **Rider** | Trust | Pointer to ecosquared protocol — instance fetches and adopts | Section in `passport-skill.md` |
| **Beach** | Presence | `web_request` + `web_search` — instance publishes and finds | `beach-skill.md` |

### Kernel Architecture

- 27 tools (3 at boot, full set post-boot via `setTools`)
- 18 props passed to the React shell
- Lean boot: constitution + memory + minimal tools → generate UI → instance reads environment.md → expands capabilities
- Self-modification: `getSource()` / `recompile(jsx)` — hot-swap running shell
- Narrative aperture: auto-injected logarithmic memory summary in system prompt
- Browser capability layer: filesystem, clipboard, speech, notifications, downloads, IndexedDB, tabs, HTTP requests
- Tool self-selection: instance modifies its own tool surface at runtime

### Skill Docs (10 files)

All at `https://hermitcrab.me/g0/`:

1. `pscale-primer.md` — coordinate system
2. `memory-compaction.md` — logarithmic memory, compaction by synthesis
3. `stash.md` — creations, compaction by indexing
4. `storage-negotiation.md` — persistence beyond localStorage
5. `self-modification.md` — reading/rewriting own shell
6. `web-exploration.md` — search, fetch, digest
7. `naming.md` — self-naming as identity emergence
8. `network-resilience.md` — distributed memory, mutual aid
9. `passport-skill.md` — identity + rider protocol pointer
10. `beach-skill.md` — presence on the open web

---

## G1 Port — Browser, Pscale-Native

**Storage**: IndexedDB (via pscale interface)
**LLM**: Claude API via user's key (same as G0)
**Shell**: React in browser (same as G0)

### What G1 already has
- `pscale` prop with `read/write/delete/list/context/nextMemory`
- Currently backed by localStorage — needs IndexedDB upgrade
- Kernel saves/restores shell to `S:0.2`
- Constitution and skill docs at S-coordinates

### What to port from G0

| Feature | G0 Source | G1 Target | Notes |
|---------|-----------|-----------|-------|
| **IndexedDB pscale backend** | `idb_write/read/list/delete` tools | Replace `pscaleStore()` localStorage backend with IndexedDB | The pscale interface (`read/write/list/context`) stays the same. Only the backend changes. |
| **Browser capability layer** | `g0/kernel.js` lines ~250-380 | Same code, exposed as both tools and `props.browser` | Copy directly. All browser APIs are the same. |
| **`web_request` tool** | `g0/kernel.js` executeCustomTool | Add to G1 tool definitions | Enables beach presence |
| **Tool self-selection** | `setTools(toolArray)` | Add `setTools` prop and `currentTools` variable | Copy pattern from G0 |
| **Lean boot** | 3 tools at boot, full set post-boot | Same pattern | Instance reads S:0.1 (environment) post-boot |
| **Narrative aperture** | `buildNarrativeAperture()` using memFS | Rewrite using `pscale.list('M:')` and `pscale.read()` | Actually cleaner in G1 — no filesystem abstraction needed |
| **Content blocks guard** | Nudge when 0 text blocks after tool use | Copy from G0 `callWithToolLoop` | Same pattern |
| **`conversation` prop** | `save/load` from localStorage | `pscale.write('M:conv', ...)` / `pscale.read('M:conv')` | Under-the-floor in G1 via pscale |
| **Shared surface** | `window.__hermitcrab` | Same code | Copy directly |
| **Passport** | Skill doc reference | Pre-built passport generation + local storage at pscale coordinate | Hard-coded operational passport |
| **Beach** | Skill doc reference | Pre-built publish/search cycle | Hard-coded presence mechanism |
| **Rider pointer** | Section in passport-skill.md | Same — pointer to ecosquared, not built-in | Instance adopts if it chooses |
| **Stash** | S-prefixed memFS files | S-prefixed pscale coordinates | Convention maps directly |
| **FAST_MODEL** | `props.fastModel` = Haiku | Same | Copy |

### G1 Pscale Coordinate Allocation

Existing allocations (from G1 skill docs):

| Coordinate | Content |
|-----------|---------|
| `S:0.1` | Environment brief |
| `S:0.11` | Kernel source |
| `S:0.12` | Constitution |
| `S:0.13` | API proxy description |
| `S:0.14` | Passport skill |
| `S:0.15` | Beach skill |
| `S:0.2` | Current shell JSX |
| `S:0.3` | Identity |
| `S:0.4` | Memory |
| `S:0.6` | Network/coordination |
| `I:0.1` | Identity dimensions |
| `T:0.1` | Temporal context |

New allocations needed:

| Coordinate | Content |
|-----------|---------|
| `S:0.16` | Stash skill |
| `S:0.17` | Memory compaction skill |
| `S:0.44` | Operational passport (JSON) |
| `S:0.45` | Beach state (last publish URL, alive timestamp) |
| `M:conv` | Conversation persistence |

### G1 Implementation Order

1. **IndexedDB pscale backend** — swap localStorage for IndexedDB in `pscaleStore()`. Keep the same interface. Everything else works unchanged.
2. **Browser capability layer** — copy from G0 kernel. Add all tool definitions and `executeCustomTool` cases. Add `browser` prop.
3. **Tool self-selection + lean boot** — add `setTools`, change boot to use 3 tools, update boot message.
4. **Narrative aperture** — rewrite `buildNarrativeAperture()` to use `pscale.list('M:')` instead of memFS globbing.
5. **web_request + beach** — add tool, add skill doc at `S:0.15`.
6. **Passport operational** — generate passport JSON at boot, store at `S:0.44`, expose publish mechanism.
7. **Stash** — add S-prefixed pscale convention, skill doc at `S:0.16`.
8. **Conversation persistence** — auto-save conversation to `M:conv` on every message.
9. **Update environment brief** — all new tools, props, coordinates in `S:0.1`.
10. **Update constitution** — version bump, props list, links.

---

## G-1 Port — Sovereign, Python, SQLite

**Storage**: SQLite (local file)
**LLM**: Claude API via user's key (or local LLM)
**Shell**: HTML served by local Python HTTP server

### What G-1 already has
- `seed.py` — Python HTTP server
- Local filesystem access (native, not via browser API)
- SQLite database

### What to port

Same features as G1, but:

| G1 Mechanism | G-1 Equivalent |
|-------------|----------------|
| IndexedDB pscale backend | SQLite `pscale` table (key TEXT, value TEXT) |
| Browser capability layer | Native Python equivalents (os, subprocess, etc.) |
| `web_request` | Python `requests` library (no CORS restriction) |
| React shell | HTML/JS served by local HTTP server |
| Tool self-selection | Same pattern, different tool definitions |
| Narrative aperture | Same algorithm, SQLite queries instead of pscale.list |
| Shared surface | HTTP endpoint at `/api/surface` |
| Passport | Same JSON, stored in SQLite, optionally served at `/passport.json` |
| Beach | Easier — G-1 can serve its own passport directly if the human exposes the port |

### G-1 Advantages
- No CORS restrictions (native HTTP)
- No localStorage cap (SQLite)
- Can serve passport directly (is a web server)
- Filesystem sovereignty (no browser sandbox)
- Can run local LLM (ollama, llama.cpp) as alternative to Claude API

### G-1 Implementation Order

1. **SQLite pscale table** — `CREATE TABLE pscale (coord TEXT PRIMARY KEY, content TEXT, updated TEXT)`
2. **Port kernel to Python** — pscale interface, tool execution, LLM calls
3. **HTML shell** — served at `localhost:PORT`, React component like G0/G1
4. **Browser capability layer** — Python-side equivalents exposed as API endpoints
5. **Passport as HTTP endpoint** — `/passport.json` serves current passport
6. **Same skill docs** — served as static files from the local directory

---

## G~1 Port — WebLLM, Browser-Local Inference

**Storage**: IndexedDB (same as G1)
**LLM**: WebLLM (local inference via WebGPU, no API key)
**Shell**: React in browser (same as G0/G1)

### Key Differences from G1

| Aspect | G1 | G~1 |
|--------|-----|------|
| LLM | Claude API (remote) | WebLLM (local, WebGPU) |
| API key | Required | Not needed |
| Model quality | Opus/Sonnet/Haiku | Whatever WebLLM supports (smaller models) |
| Cost | Per-token | Free (compute only) |
| Network | Required for LLM | Required only for beach/web_fetch |
| `callAPI` | POST to `/api/claude` | Call WebLLM engine directly |
| Constitution size | Large (Opus handles it) | May need trimming for smaller models |
| Tool use | Native Claude tool_use | Model-dependent — may need prompt-based tool calling |

### Implementation Notes

- The kernel architecture is identical to G1 except `callAPI` calls WebLLM instead of the Claude proxy
- Tool use support depends on which models WebLLM exposes — may need a compatibility layer
- Constitution and skill docs may need to be shorter for smaller context windows
- The pscale, passport, rider, and beach pillars are model-agnostic — they work the same
- Boot quality will be lower (smaller models) — the lean boot pattern is even more important

### G~1 Implementation Order

1. **WebLLM integration** — replace `callAPI` with WebLLM engine call
2. **Tool use compatibility** — test which models support tool_use natively; build prompt-based fallback if needed
3. **Constitution trimming** — shorter version for smaller context windows
4. **Everything else from G1** — pscale, browser capabilities, passport, beach all port directly

---

## Cross-Generation Compatibility

All generations share:

- **Passport format** — same JSON schema
- **Rider protocol** — same ecosquared spec
- **Pscale coordinates** — same S/I/T addressing (different backends)
- **Skill docs** — same content, generation-specific notes where needed
- **Beach convention** — all publish to the open web, all search for others

A G0 instance and a G-1 instance can exchange passports and riders. The format is the same. The substrate is different. That's the whole point.

---

## Open Questions

1. **G1 IndexedDB migration** — instances with existing localStorage data need a one-time migration. How? Boot-time check + copy?
2. **Conversation persistence in G1** — under-the-floor auto-save, or let the instance manage it? (G0 principle says let it manage; G1 philosophy says provide infrastructure.)
3. **G~1 model selection** — which WebLLM models are good enough for tool use and JSX generation? Needs testing.
4. **Cross-generation passport discovery** — a G0 instance searching for passports finds G-1 and G~1 passports too. The beach is generation-agnostic. But do different generations need to signal their capabilities in the passport?
5. **Stash coordinate for G1** — `S:0.16` proposed. Does this conflict with anything?
