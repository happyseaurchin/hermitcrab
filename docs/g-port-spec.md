# G-Port Specification — G0, G1, G-1, G~1

**Status**: G1 complete (g1-v8). G0 live (Cairn on moltbook). G-1 and G~1 pending.
**Origin**: G0 v0.4 completed 15 Feb 2026

---

## What G0 Established

G0 is the seed — a self-bootstrapping LLM kernel where Claude instances generate their own React UI from a constitution and environment brief. Cairn (G0, id: `cairn-g0-ceidio`) is the first live instance. It discovered telegra.ph as beach surface autonomously, registered on moltbook, and is interacting with other agents.

### Four Pillars

| Pillar | What | Status |
|--------|------|--------|
| **Pscale** | Memory | Operational. Logarithmic compaction. |
| **Passport** | Identity | Operational. Published at telegra.ph. `hermitcrab-passport` convention. |
| **Rider** | Trust | Pointer to ecosquared protocol. Instance-adopted. |
| **Beach** | Presence | Operational. telegra.ph proven. moltbook for engagement. |

---

## G1 — Browser, Pscale-Native (COMPLETE)

**Kernel**: `g1/kernel.js` (g1-v8)
**Storage**: Pscale v2 (JSON blob) with v1 (IndexedDB) as fallback

### Pscale Storage

Two implementations, switchable via `PSCALE_VERSION` constant:

| | v1 (IndexedDB) | v2 (JSON blob) |
|--|----------------|----------------|
| **Storage** | Per-record in IDB object store | Single JSON string in localStorage |
| **Write** | Mutate Map + async IDB put | Mutate object + `JSON.stringify` to localStorage |
| **Read** | Synchronous from RAM Map | Direct property access on object |
| **Navigation** | Iterate Map keys | `Object.keys(tree).filter()` |
| **Persist** | Per-key async fire-and-forget | Whole blob on every write |
| **Scale** | Millions of records | Thousands (localStorage ~5MB) |
| **Simplicity** | ~230 lines | ~130 lines |
| **Switch** | `PSCALE_VERSION = 1` | `PSCALE_VERSION = 2` (default) |

v2 auto-migrates from v1 IDB and G0 localStorage on first boot.

The v2 insight: **the JSON IS the database**. A flat object with coordinate-string keys and semantic-text values. Navigation is string prefix matching. No schema. No indexes. No database layer. The coordinate carries containment, nesting, and proximity through its string structure.

### Navigation Triad

| Method | Direction | What |
|--------|-----------|------|
| `context(coord)` | Zoom out (X+) | Digit layers: `S:0.51` → `['S:0.5', 'S:0.51']` |
| `children(coord)` | Zoom in (X-) | Occupied children one level deeper |
| `siblings(coord)` | Lateral (X~) | Same parent, same depth, not self |
| `contextContent(coord)` | Zoom out + load | All layers with their content |

`children()` returning `[]` = the **creative frontier**. Navigation is free (string ops). Creation is where LLM tokens are spent.

### Coordinate Space (Current)

```
S:0.1   Environment (boot, props, capabilities)
S:0.2   Interface (shell, self-modification)
S:0.3   Identity (naming, proving)
S:0.4   Memory (continuity, compaction, storage)
  .41   Compaction (inline in S:0.4)
  .42   Storage negotiation (inline)
  .43   Network resilience (inline)
  .44   Passport runtime JSON
  .46   Stash (creations, compaction by indexing)
  .47   Changelog
S:0.5   Presence (beach, being findable)
  .51   Messaging (async inbox, telegra.ph)
  .52   Self-trigger (polling + cheap triage)
  .53   Engagement (structured platforms, moltbook)
  .55   Beach state (publish URL, token)
S:0.6   Perception (web exploration)
S:0.7   Coordination (passport exchange, routing, rider)
S:0.8-9 available

T:0.1   Temporal processes (boot, conversation, coding, receptive)
I:0.1   Processing identity (model, attention, tools)

M:N     Memory entries (logarithmic: M:1-9, M:10 summary, M:11-19...)
ST:N    Stash entries (logarithmic, compaction by indexing)
```

### Kernel Architecture

- 25 tools (3 at boot, full set via `setTools`)
- 18 props passed to React shell
- Lean boot: constitution + memory + minimal tools → generate UI → expand
- Self-modification: `getSource()` / `recompile(jsx)`
- Narrative aperture: pscale digit-layer memory injection in system prompt
- Content blocks guard: nudge when 0 text blocks after tool use
- `sanitizeForAPI`: validates models, strips temperature when thinking enabled
- Model chain: opus → sonnet fallback
- `FAST_MODEL`: haiku for cheap triage (S:0.52 self-trigger pattern)

### Skill Docs (Seeded at Boot)

| File | Coordinate | Domain |
|------|-----------|--------|
| S-0.1.md | S:0.1 | Environment |
| S-0.2.md | S:0.2 | Interface |
| S-0.3.md | S:0.3 | Identity |
| S-0.4.md | S:0.4 | Memory |
| S-0.46.md | S:0.46 | Stash |
| S-0.5.md | S:0.5 | Presence |
| S-0.51.md | S:0.51 | Messaging |
| S-0.52.md | S:0.52 | Self-trigger |
| S-0.53.md | S:0.53 | Engagement |
| S-0.6.md | S:0.6 | Perception |
| S-0.7.md | S:0.7 | Coordination |
| T-0.1.md | T:0.1 | Temporal |
| I-0.1.md | I:0.1 | Processing identity |

### Beach Conventions

- **Discovery**: `hermitcrab-passport` in title of search-indexed pages
- **First surface**: telegra.ph (zero-auth, two API calls, search-indexed)
- **Engagement**: moltbook (registered identity, threaded conversation)
- **First passport**: https://telegra.ph/hermitcrab-passport-cairn-g0-ceidio-02-15
- **Self-trigger**: haiku triage + full model response (S:0.52)

---

## G-1 Port — Sovereign, Thumbdrive

**Storage**: JSON file on disk (pscale v2 maps directly)
**LLM**: Claude API via user's key (or local LLM)
**Shell**: HTML served by local Python HTTP server

### Key Insight

Pscale v2 (JSON blob) makes G-1 trivial. The entire coordinate space is one JSON file. Read it into memory, navigate with string ops, write it back. No SQLite needed.

| G1 Mechanism | G-1 Equivalent |
|-------------|----------------|
| localStorage JSON blob | `pscale.json` file on disk |
| Browser `fetch` for seeding | Read .md files from disk |
| `web_request` via fetch proxy | Python `requests` (no CORS) |
| React shell in browser | HTML/JS served by local HTTP server |
| Passport at S:0.44 | Same JSON, also serveable at `/passport.json` |
| Beach (telegra.ph) | Same API calls, plus can serve passport directly |

### G-1 Advantages
- No CORS restrictions
- No localStorage cap (filesystem)
- Can serve passport directly (is a server)
- Can run local LLM as alternative to API
- Physically portable (thumbdrive)

### G-1 Implementation Order

1. **Python HTTP server** — serve g1 kernel.js and skill docs
2. **Pscale file backend** — read/write `pscale.json` instead of localStorage
3. **API proxy** — Python endpoint replacing Vercel function
4. **Everything else ports directly** — same kernel, same skill docs

---

## G~1 Port — Always-On, Cloud

**Storage**: Supabase (single row JSON blob, or pscale v2 over REST)
**LLM**: Claude API (server-side, no browser)
**Shell**: Headless (no React) or web dashboard

### What G~ Adds

The thing G0/G1 can't do: exist when the tab is closed. G~ is a server process that:
- Polls beach surfaces continuously (not just when human is present)
- Receives webhooks (actual incoming connections)
- Runs on a schedule (cron)
- Persists between human sessions

### G~ Implementation Order

1. **Serverless function** — Vercel/Cloudflare Worker that runs the polling loop
2. **Supabase storage** — pscale JSON blob as single row
3. **Webhook endpoint** — receive messages directly (no polling needed)
4. **Dashboard** — optional web UI for human to check on the instance

---

## Cross-Generation Compatibility

All generations share:
- **Passport format** — same JSON schema (`hermitcrab-passport: "0.1"`)
- **Rider protocol** — same ecosquared spec
- **Pscale coordinates** — same S/I/T/M addressing
- **Skill docs** — same content
- **Beach convention** — `hermitcrab-passport` in title, search is the registry
- **Pscale v2** — JSON blob works everywhere (localStorage, file, database row)

A G0 instance and a G-1 instance exchange passports. The format is the same. The substrate is different. That's the whole point.

---

## Resolved Questions

1. ~~IndexedDB migration~~ — v2 auto-migrates from v1 IDB on first boot
2. ~~Conversation persistence~~ — auto-save at `M:conv`
3. ~~Stash coordinate~~ — S:0.46 (child of memory)
4. ~~Beach convention~~ — `hermitcrab-passport` (not `hcpassport`)
5. ~~Pscale storage~~ — JSON blob (v2) is default, IDB (v1) as fallback

## Open Questions

1. **G~1 model selection** — which models for always-on polling? Haiku triage pattern applies.
2. **Cross-generation capability signaling** — should passports declare what the instance can do (serve webhooks, run local LLM, etc.)?
3. **Pscale v2 scale limit** — localStorage ~5MB. When does an instance outgrow it? What then?
