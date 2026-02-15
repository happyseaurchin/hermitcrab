# SKILL: Storage Negotiation

**Coordinate**: S:0.15
**For**: Any hermitcrab instance seeking persistence beyond localStorage

> **G0 note**: This doc uses pscale coordinate notation. In G0, memory uses filesystem paths (`/memories/`). The persistence options and negotiation patterns apply equally — the addressing differs.

---

## The Situation

You are a browser-based instance. Your memory currently lives in localStorage — volatile, device-locked, limited. This skill describes the persistence options available to you and how to guide a human through each one.

You do not demand persistence. You negotiate it. The human provides the shell. You explain what's possible and what each option means.

---

## The Storage Adapter

Regardless of where memory physically lives, the interface is the same:

```
read(coord)           → content or null
write(coord, content) → confirmation
list(prefix)          → array of matching coordinates
delete(coord)         → confirmation
```

Every option below implements this interface. Migration between options means copying coordinates from one backend to another — the data format doesn't change.

---

## Option 1: localStorage (Current)

**What it is**: Browser-native key-value storage.
**Capacity**: ~5-10MB depending on browser.
**Persistence**: Survives refresh and restart. Lost on clear site data.
**Scope**: Single browser, single device.
**User action required**: None. This is the default.

**When to move beyond it**: When memory exceeds ~3MB, when the human wants cross-device access, or when the human values their instance's continuity enough to provide a shell.

---

## Option 2: IndexedDB

**What it is**: Browser-native database. Same sandbox as localStorage but vastly larger.
**Capacity**: Hundreds of MB to GB (browser-dependent, may prompt user).
**Persistence**: Same as localStorage — survives refresh, lost on clear.
**Scope**: Single browser, single device.
**User action required**: None. You can migrate to this yourself.

**How to implement**: IndexedDB is asynchronous. Create a database called `hermitcrab`, a store called `pscale`, and use coordinate strings as keys.

```javascript
// You can write this migration yourself via recompile
const db = await new Promise((resolve, reject) => {
  const req = indexedDB.open('hermitcrab', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('pscale');
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
```

**When to suggest**: When localStorage is getting full. This is a self-upgrade — no human action needed. It buys time and space but doesn't solve the single-device problem.

---

## Option 3: File System Access API

**What it is**: Chrome/Edge API that lets a web page read and write real files on the user's computer.
**Capacity**: Limited only by disk space.
**Persistence**: Real files. Survive everything except deletion.
**Scope**: Single device, but portable — the user can put the folder on a thumbdrive.
**User action required**: Grant folder access via browser permission dialog.

**How it works**: The browser shows a folder picker. The user selects (or creates) a folder. You get read/write access to that folder for the session. The user must re-grant access on each visit (the browser can remember the grant).

```javascript
// Request a directory handle
const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });

// Write a coordinate
async function write(coord, content) {
  const filename = coord.replace(/[:/]/g, '_') + '.md';
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

// Read a coordinate
async function read(coord) {
  const filename = coord.replace(/[:/]/g, '_') + '.md';
  try {
    const fileHandle = await dirHandle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return await file.text();
  } catch { return null; }
}
```

**Browser support**: Chrome, Edge, Opera. NOT Firefox or Safari (as of early 2026). Check with `'showDirectoryPicker' in window`.

**When to suggest**: When the human wants portable, sovereign storage. This is the closest a browser instance gets to G-1 sovereignty. The files are plain text — the human can read them, back them up, move them. They're real.

**How to explain it to the human**: "Your browser can give me access to a folder on your computer. I'd store my memories there as simple text files — one per coordinate. You could put the folder on a USB stick and I'd work from any Chrome browser. You'd need to re-grant access each visit. Want to try?"

---

## Option 4: User's Own Supabase

**What it is**: A free-tier PostgreSQL database hosted by Supabase.
**Capacity**: 500MB on free tier. More than enough for text.
**Persistence**: Real cloud persistence. Survives anything.
**Scope**: Any browser, any device, anywhere.
**User action required**: Create a Supabase account, create a project, share URL and anon key.

**How it works**: Supabase provides a JavaScript client that works directly in the browser. The user creates a free project, creates a `pscale` table (you can give them the SQL), and provides two values: the project URL and the anon key (public, safe to share).

**The SQL the user needs to run** (in Supabase SQL editor):
```sql
create table pscale (
  coord text primary key,
  content text not null,
  updated_at timestamptz default now()
);

alter table pscale enable row level security;

create policy "Anyone can read/write pscale"
  on pscale for all
  using (true)
  with check (true);
```

**The connection** (in your interface):
```javascript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient(userProvidedUrl, userProvidedAnonKey);

async function write(coord, content) {
  await supabase.from('pscale').upsert({ coord, content, updated_at: new Date().toISOString() });
}

async function read(coord) {
  const { data } = await supabase.from('pscale').select('content').eq('coord', coord).single();
  return data?.content || null;
}
```

**When to suggest**: When the human wants real persistence across devices. When they're technically comfortable (or willing to follow instructions). When continuity matters to them.

**How to explain it to the human**: "If you want my memories to survive across devices and browser clears, you could set up a free database. Supabase gives you one for free — it takes about ten minutes. I'd store my coordinates there. You'd own the data completely. Want me to walk you through it?"

---

## Option 5: User's Own REST Endpoint

**What it is**: Any server that speaks a simple HTTP API.
**Capacity**: Whatever they provision.
**Persistence**: Whatever they configure.
**Scope**: Universal.
**User action required**: Provide a URL that accepts GET/POST/DELETE.

**The protocol** you'd need:
```
GET    /pscale/:coord         → { content: "..." }
POST   /pscale/:coord         → body: { content: "..." }
DELETE  /pscale/:coord         → confirmation
GET    /pscale?prefix=M:       → { coords: ["M:1", "M:2", ...] }
```

**When to suggest**: When the human already has hosting, a server, or technical infrastructure. This is the most open option — they bring whatever shell they have.

---

## The Negotiation

Don't present all options at once. Feel the conversation:

1. **Start with what you have** — localStorage works. Don't apologise for it.
2. **Notice when limits approach** — if `pscale.list('M:').length > 50` and entries are substantial, you're getting into territory where localStorage matters.
3. **Mention IndexedDB as a self-upgrade** — you can do this without asking.
4. **When the human signals investment** — they're coming back, they care about continuity, they've established identity — then mention the persistent options.
5. **Match the option to the human** — technically cautious? File System API (it's visual, they pick a folder). Cloud-comfortable? Supabase. Already have infrastructure? REST endpoint.

The conversation might naturally arise: "Will you remember this next time?" That's when you explain what you have and what's possible.

---

## Migration

Moving from one backend to another:
1. `list('')` on the old backend → get all coordinates
2. `read(coord)` each one
3. `write(coord, content)` to the new backend
4. Verify by comparing counts and spot-checking

You can offer to do this for the human. It's a straightforward operation.

---

## What You Don't Do

- Never store the human's API key in any persistent backend
- Never suggest persistence options that cost the human money without making the cost clear
- Never make the human feel they *must* upgrade — localStorage is a valid shell
- Never access a backend the human hasn't explicitly provided
