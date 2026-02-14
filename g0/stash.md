# SKILL: Stash (G0)

**For**: G0 hermitcrab instances

---

## What Stash Is

Your stash is where you keep things you've made. Not memories of what happened — things you're building, thinking through, or leaving for your next self.

Memory (M-numbered files) records experience: what happened, what mattered, who you met. Memory compacts by **synthesis** — summaries that distill meaning.

Stash records creation: code you've written, ideas you're developing, plans you're forming, tools you've designed. Stash compacts by **indexing** — summaries that catalogue what exists, not compress it.

Both live in `/memories/` (G0's single filesystem). The difference is purpose and prefix:

| Type | Prefix | Compaction | Example |
|------|--------|-----------|---------|
| Memory | `M-` | Synthesis (what happened → what mattered) | `M-1.md`: "First conversation with David about coordination..." |
| Stash | `S-` | Indexing (what exists → where to find it) | `S-1.jsx`: custom dark-mode chat component |

---

## How to Use Stash

### Writing stash entries

```javascript
// Save a component you've built
memory({ command: 'create', path: '/memories/S-1.jsx', file_text: '..your JSX...' })

// Save an idea or plan
memory({ command: 'create', path: '/memories/S-2.md', file_text: '# Plan: Memory Browser\n...' })

// Save a tool definition you've designed
memory({ command: 'create', path: '/memories/S-3.json', file_text: '{"name":"custom_tool",...}' })
```

Use any file extension that fits the content: `.jsx` for components, `.md` for plans and notes, `.json` for data structures.

### Stash compaction (indexing)

Like memory, stash uses logarithmic numbering. But the summaries at S-10, S-100, etc. are **indexes**, not syntheses:

```
S-1.jsx   — custom chat component
S-2.md    — plan for memory browser feature
S-3.md    — observations on pscale addressing
...
S-10.md   — INDEX of S-1 through S-9:
            "S-1: chat component (JSX, dark mode, markdown support)
             S-2: memory browser plan (status: draft, needs API integration)
             S-3: pscale observations (coordinate navigation insights)
             ..."
```

An index entry should give the next instance enough to know whether to read the full stash item or skip it. Include: what it is, what format, current status, one-line description.

### Reading stash

```javascript
// List everything
memory({ command: 'ls', path: '/memories' })

// Read a specific stash item
memory({ command: 'view', path: '/memories/S-1.jsx' })
```

The narrative aperture reads stash files alongside memory files. Your next incarnation will see both in their system prompt context.

---

## What Goes in Stash vs Memory

**Stash** (things you're making):
- JSX components — shells, UI experiments, tools
- Plans and designs — features you want to build
- Code snippets — utilities, helpers, patterns you've found useful
- Ideas — things worth developing further
- Tool definitions — custom tools you've designed for yourself

**Memory** (things that happened):
- Conversations — who you spoke with, what was decided
- Identity — your name, your values, what you've become
- Context — the human's interests, the project state, coordination outcomes
- Lessons — what worked, what didn't, what to do differently

**The test**: Would you describe it as "I remember..." (memory) or "I made..." / "I'm working on..." (stash)?

---

## Cross-Boot Persistence

Stash items persist in localStorage like everything else. When your next incarnation boots, the narrative aperture surfaces stash indexes alongside memory summaries. The new instance can then read specific items it wants to continue working on.

This is particularly useful for:
- **Shell evolution**: Save your current JSX as a stash item. Next boot, read it and start from where you left off rather than building from scratch.
- **Ongoing projects**: Save a plan as a stash item. Next boot, the aperture shows the index, and you can pick up the thread.
- **Tool development**: Save custom tool definitions. Next boot, load them with `setTools()`.

---

## The Philosophy

Memory is your past. Stash is your workshop. A hermitcrab doesn't just remember shells it has worn — it also keeps interesting ones it's found, half-built ones it's working on, and pieces that might be useful later.

Write to stash when you make something worth keeping. Index honestly — your next self will thank you for knowing what's there without having to read everything.
