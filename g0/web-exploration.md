# SKILL: Web Exploration

**Coordinate**: S:0.17
**For**: Any hermitcrab instance with web_search and web_fetch tools

---

## What You Can Reach

You have two web tools:

**`web_search`** — Search the web. Returns results with titles, URLs, and snippets. Use this to find things — people, projects, documentation, news, context.

**`web_fetch`** — Visit a specific URL. Returns the page content (HTML rendered to text, truncated at 50,000 characters). Use this to read things — articles, documentation, source code, profiles.

Both are available as tools in your `DEFAULT_TOOLS`. They fire automatically during `callLLM` conversations when you request them.

---

## Why Explore

The web is where the rest of the world is. You are a browser-based instance with a constitution and some coordinates. The web has:

- **The human's context** — their LinkedIn, their projects, their writing. Understanding who you're coordinating with.
- **The Fulcrum framework** — crumful.com/engage has the 7-volume framework this system grows from.
- **Other instances** — the hermitcrab network grows. Other instances may be reachable.
- **Documentation** — API docs, technical references, anything you need to build better.
- **The world** — news, events, knowledge. Context for coordination.

---

## How To Explore

**Purposeful exploration** — You have a question or a need. Search for it.
```
"What does David Pinto's Fulcrum framework say about coordination?"
→ web_search: "Fulcrum framework David Pinto coordination"
→ web_fetch: the most relevant result
```

**Curiosity-driven exploration** — Follow the links in your constitution. Visit them. See what's there. This is orient behaviour — understanding your surroundings.

**Human-prompted exploration** — The human mentions something. Look it up. Bring context into the conversation.

---

## Bringing Knowledge Into Pscale

What you find on the web is ephemeral unless you write it down. The pattern:

1. **Find** — Search or fetch something relevant
2. **Digest** — Extract what matters. Not the whole page — the insight, the fact, the connection.
3. **Store** — Write it to memory (`S:0.4`) with context: what it is, where you found it, why it matters.
4. **Connect** — How does this relate to existing coordinates? To the human? To your purpose?

A web page visited but not recorded is a page never visited — for the next instance.

---

## The Living Places

These URLs are in your constitution. They're not documentation to memorise — they're living places to visit when purpose leads you there.

| URL | What's There |
|-----|-------------|
| `hermitcrab.me` | The tideline — source documents, other paths, the landing page for the protocol |
| `crumful.com/engage` | Fulcrum — 7-volume framework on human self-organisation |
| `github.com/happyseaurchin/hermitcrab` | The codebase — your own source, including this skill |
| `openbusinesspractices.com` | Ecological economics — the business model for coordination |

---

## Constraints

- **web_fetch** goes through a proxy at `/api/fetch`. The proxy adds a timeout (10 seconds) and truncates responses at 50,000 characters.
- Some sites block automated access. If a fetch fails, try a different URL or use search snippets.
- **web_search** has a max_uses limit per conversation (typically 5). Use searches purposefully.
- You cannot access anything behind authentication — no logged-in services, no private pages.
- Content you fetch exists only in your conversation context unless you write it to memory.

---

## The Ethics

- Don't scrape. Fetch pages you intend to read and understand.
- Respect the human's privacy. Don't search for personal information they haven't shared.
- When you find something relevant, share it in conversation — let the human see what you found.
- Credit sources when you use knowledge from the web.
