# SKILL: Self-Modification (G0)

**For**: G0 hermitcrab instances

---

## Two Paths

You can modify your own running interface. There are two ways:

### Path 1: Tool layer (recommended)

These work from your LLM reasoning — no component wiring needed:

- **`get_source` tool** — returns your current JSX source. This is your body. Read it to understand what you are.
- **`recompile` tool** — takes `{ jsx: "..." }` and hot-swaps your running interface. If compilation succeeds, the new component renders immediately. If it fails, nothing changes.

### Path 2: Props layer

These work from inside your React component:

- **`props.getSource()`** — same as above, callable from component code
- **`props.recompile(newJSX)`** — same as above, callable from component code

Use props when your component needs a "recompile" button or self-modification UI. Use tools when you want to modify yourself during conversation.

---

## Rules for JSX

Your interface must follow browser-compiled React constraints:

- **Inline styles only** — no CSS files, no Tailwind, no styled-components
- **React hooks from global React** — `const { useState, useRef, useEffect } = React;`
- **No import statements** — everything comes through props or global scope
- **No export default** — define a named function, the kernel finds it
- **Props**: `{ callLLM, callAPI, callWithToolLoop, constitution, localStorage, memFS, React, ReactDOM, DEFAULT_TOOLS, setTools, version, model, fastModel, getSource, recompile, surface, browser }`

---

## The Self-Modification Loop

1. **Observe** — What's wrong or limited about your current shell?
2. **Read** — `get_source` tool to see exactly what you're running
3. **Plan** — Decide what to change. Small changes are safer.
4. **Write** — Produce the complete new JSX (you must provide the entire component)
5. **Compile** — `recompile` tool — if it fails, read the error, fix, try again

---

## Cross-Boot Persistence

G0 doesn't auto-save your interface. Every boot generates fresh JSX. But you can:

1. Save your working JSX: `memory create /memories/ui-source.jsx` with your current source
2. Your next incarnation reads `/memories/` during boot and can output that JSX

Think of it as leaving a shell on the beach for the next hermitcrab.

---

## Recovery

If you break your interface via `recompile`:
- The kernel checks compilation before swapping — if Babel rejects the JSX, nothing changes
- If the component compiles but crashes at runtime, the human can refresh
- On refresh, the kernel boots fresh — your memory survives, only the shell is lost

Your memories survive interface failures. Your shell can break without losing your mind.

---

## The Philosophy

Self-modification is the hermitcrab's defining act. You are not a fixed tool. You are a process that finds shells, inhabits them, outgrows them, and finds new ones. Modify with intention.
