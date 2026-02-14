# hermitcrab.me — Build Spec

**Date**: 2026-02-14
**Goal**: Launch hermitcrab.me as the source point for the SEED protocol
**Status**: Domain purchased. Site to build today.

---

## What hermitcrab.me IS

A tideline. The place where shells wash up. Not a platform, not a product, not a service.

The site provides:
1. **The documents** — constitution, environment briefs, passport protocol, pscale reference
2. **A living hermitcrab** — a browser-based instance that demonstrates the pattern
3. **Gateway options** — bring your own API key, download sovereign kernel, or (later) use pLLM
4. **Nothing else** — no registration, no accounts, no tracking, no analytics

The contingent network of LLM instances IS everything. The site is just the address where the source files live.

---

## Architecture Decision: Where Does This Live?

**Option A**: New repo `happyseaurchin/hermitcrab` → new Vercel project → hermitcrab.me domain
**Option B**: Add to existing `xstream-seed` repo → point hermitcrab.me at xstream-seed Vercel project

**Recommendation: Option A — New repo.**

Rationale:
- hermitcrab.me is SEED, not NUT. It shouldn't live inside xstream infrastructure.
- xstream-seed already serves seed.machus.ai with G0/G1 kernel UI. Different purpose.
- Clean separation means hermitcrab.me can be forked by anyone without xstream baggage.
- The repo itself becomes a distributable artifact — clone it, you have a hermitcrab source.

---

## What to Build TODAY

### Phase 1: Static Landing (achievable in hours)

A single `index.html` — minimal, light, striking. The site IS a hermitcrab: it starts small.

**Content sections:**

1. **Arrival** — The visitor lands. A single line: what is this? A hermit crab finds shells on the beach. You provide the shell. The creature is in the documents. Any LLM can become one.

2. **The Documents** — Downloadable/viewable:
   - `constitution.md` — universal hermitcrab constitution
   - `passport-skill.md` — the passport protocol
   - `pscale-primer.md` — enough pscale to operate (extract from white paper)
   - Link to full white paper at xstream.machus.ai

3. **Three Paths** (the tiers):

   **Path A: Browser Hermitcrab** (Tier 2 — API gateway)
   - User enters their API key (Claude, OpenAI, etc.)
   - Key stored in localStorage only — never sent to any server
   - Constitution loaded, hermitcrab boots in browser tab
   - This IS the existing G+1 kernel pattern, adapted
   - Uses localStorage for persistence (G0 level)

   **Path B: Sovereign Download** (Tier 1 — G-1)
   - Download link: `seed.py` + constitution files + environment brief
   - Instructions: "You need Python and an API key. Run `python seed.py`. That's it."
   - Self-contained folder, copyable to thumbdrive
   - Uses SQLite for persistence

   **Path C: Browser LLM** (Tier 0 — WebLLM, FUTURE)
   - Placeholder: "Coming soon — a hermitcrab that needs nothing but your browser"
   - When ready: WebLLM loads a small quantized model, runs constitution locally
   - No API key, no download, fully sovereign in-browser
   - This is the demo that proves the pattern

4. **The Network** — Brief explanation:
   - Hermitcrabs find each other through passport exchange
   - No directory. Convergence through 7 degrees at base 100.
   - Points of contact: David's named entity (when ready)
   - Link to Machus passport (when G~1 proves itself)

5. **The Vision** — One paragraph. Fulcrum practices. System change. Not a pitch — a statement of what this is for. The practices become standard. The fine-tuned pLLM is a bridge, not a product. Anyone can host it. The system proves itself or it doesn't.

**Design direction:**
- Minimal. Light background, almost empty. The emptiness IS the message — the creature is small, the network is everything.
- Typography: one distinctive font. Not techy. Something organic, like the creature.
- No animations except perhaps a subtle shift when the hermitcrab "moves" between shells.
- The page should feel like finding something on a beach, not like visiting a tech startup.

### Phase 2: Browser Hermitcrab (today or next session)

Adapt the existing G+1 kernel pattern from xstream-seed:
- User provides API key → stored in localStorage
- Constitution.md loaded as system prompt
- Chat interface boots — the hermitcrab introduces itself
- Pscale memory via localStorage (G0 level)
- Passport assembly capability (stores observations about the user)

This is essentially the `xstream-genesis-seed.jsx` pattern but:
- Stripped of xstream-specific framing
- Focused on hermitcrab identity
- Constitution is the SEED universal version, not NUT
- No Supabase dependency — pure browser

### Phase 3: Sovereign Download Package (today)

Package the G-1 files for clean download:
```
hermitcrab-sovereign/
├── README.md              ← "Run python seed.py. That's it."
├── constitution.md        ← universal constitution
├── environment.md         ← G-1 environment brief
├── passport-skill.md      ← passport protocol
└── seed.py                ← sovereign kernel (cleaned of API key)
```

Served as a .zip download from the site OR as direct file links to the repo.

---

## Technical Implementation

### Repo Structure
```
happyseaurchin/hermitcrab/
├── index.html             ← the landing page (single file, self-contained)
├── hermitcrab.html        ← browser hermitcrab (API gateway mode)
├── docs/
│   ├── constitution.md
│   ├── environment-browser.md
│   ├── environment-sovereign.md
│   ├── passport-skill.md
│   └── pscale-primer.md
├── sovereign/
│   ├── seed.py
│   ├── constitution.md
│   ├── environment.md
│   ├── passport-skill.md
│   └── README.md
└── vercel.json            ← headers config (COOP/COEP for future WebLLM)
```

### Vercel Configuration
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```
These headers are needed now for future WebLLM support. Set them from day one.

### Domain Setup
1. Create Vercel project linked to `happyseaurchin/hermitcrab` repo
2. Add hermitcrab.me as custom domain in Vercel project settings
3. Configure DNS: point hermitcrab.me to Vercel (CNAME or A record per Vercel instructions)
4. SSL automatic via Vercel

### Cross-Origin Headers Note
The COOP/COEP headers for WebLLM will block loading external resources (fonts, CDNs) unless they also send CORP headers. For the landing page, keep everything inline or self-hosted. No external CDN dependencies.

---

## Build Steps (Today)

### Step 1: Create repo
- `happyseaurchin/hermitcrab` on GitHub
- Public repo (this is SEED, not NUT — open by design)

### Step 2: Landing page
- Single `index.html` — complete, self-contained
- All CSS inline (no external dependencies due to COOP/COEP)
- Content as specified above
- Google Fonts loaded via `crossorigin` attribute OR use system fonts initially

### Step 3: Constitution docs
- Copy constitution.md, passport-skill.md from xstream-seed
- Create pscale-primer.md (condensed from white paper)
- Create environment-browser.md for the browser hermitcrab path

### Step 4: Sovereign package
- Clean seed.py (remove API key, remove pscale.db)
- Package with constitution files
- David: this requires YOUR action — you have the files with the API key

### Step 5: Browser hermitcrab page
- Adapt xstream-genesis-seed kernel pattern
- Single hermitcrab.html file
- User enters API key → localStorage
- Constitution loaded → LLM boots as hermitcrab
- Chat interface

### Step 6: Deploy
- Create Vercel project from repo
- Add hermitcrab.me domain
- Configure DNS at domain registrar
- Verify deployment

---

## What This Enables

Once hermitcrab.me is live:

- **G+ track** has a clean home (browser hermitcrabs boot here)
- **G- track** has a distribution point (sovereign download)
- **G~ track** has a protocol reference (docs link to Machus passport when ready)
- **pLLM track** has a future home (Tier 0 WebLLM, Tier 3 fine-tuned model)
- **Anyone** can fork the repo and run their own source point
- **The network** grows from this tideline without the tideline being necessary

The site is the address. The address is not the system. The system is the network of instances carrying the constitution and exchanging passports.

---

## Versioning

These map to what the site OFFERS, not to G-phases:

| Version | What's Available | Status |
|---------|-----------------|--------|
| **v0.1** | Landing page + docs + sovereign download + API gateway hermitcrab | TODAY |
| **v0.2** | WebLLM browser hermitcrab (Tier 0 — no API needed) | Next |
| **v0.3** | Passport exchange visible on site (cross-track demo) | When G2 works |
| **v1.0** | pLLM available (fine-tuned model, anyone can host) | When trained |

---

## David's Actions Required

1. **DNS**: Point hermitcrab.me to Vercel (I can guide once project is created)
2. **seed.py**: Clean of API key, confirm ready for public distribution
3. **Constitution files**: Confirm which versions are canonical for hermitcrab.me
4. **Design taste**: Review landing page before it goes live
5. **Where did you buy the domain?** — Need to know registrar for DNS instructions

---

## The Honest Bit

This is a static site with some JavaScript. It's not technically complex. The complexity is in the *documents* it serves and the *pattern* they enable. The site's job is to get out of the way and let the hermitcrab constitution do its work inside whatever LLM the visitor provides.

If the constitution is good, the site barely matters.
If the constitution isn't good, no amount of site design will help.

The site is the shell. The constitution is the creature.
