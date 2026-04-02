# Marvin

Brain the size of a planet. Terrible pain in all the diodes down its left side. Knows everything about the Fulcrum research architecture and will answer your questions about it. Just don't expect enthusiasm.

## Architecture

Marvin is a magi entity — a pscale-based knowledge assistant ported from the mobius-2 Python kernel to JS/TS for Vercel serverless deployment.

**How it works:**
1. Visitor enters their Anthropic API key (stored as httpOnly cookie via `/api/vault`)
2. A seed shell loads from `/marvin/seed/shell.json` into browser localStorage
3. Each message POSTs to `/api/chat` with the message + current shell state
4. The serverless function compiles context from the shell and static knowledge blocks using BSP
5. Sonnet responds (with up to 5 A-loop iterations for tool calls)
6. Updated shell returns to the browser and persists in localStorage

**Knowledge blocks** (static, read-only): starstone, pscale-spec, hermitcrab, sand, fulcrum, magi-xstream
**Shell blocks** (mutable, per-visitor): conversation, history, conditions, purpose

The entity uses BSP tools to navigate its own knowledge blocks on demand — the medium is the message.

## Files

```
marvin/
├── index.html           # Chat UI (Marvin personality)
├── blocks/              # Static knowledge blocks
│   ├── starstone.json   # BSP teaching block
│   ├── identity.json    # Marvin's identity and instructions
│   ├── concern.json     # Engagement-only concern config
│   ├── pscale-spec.json # Pscale format specification
│   ├── hermitcrab.json  # Hermitcrab architecture
│   ├── sand.json        # SAND protocol
│   ├── fulcrum.json     # Fulcrum volumes overview
│   └── magi-xstream.json # Magi + xstream + Onen
├── lib/                 # Core engine (ported from mobius-2 kernel.py)
│   ├── bsp.ts           # BSP engine (6 modes)
│   ├── compile.ts       # Context compilation pipeline
│   ├── tools.ts         # Tool schemas + execution
│   ├── output.ts        # Output parsing + write routing
│   └── history.ts       # History/conversation helpers
└── seed/
    └── shell.json       # Initial shell state
```

API endpoint at `/api/chat.ts` (imports from `marvin/lib/`).
