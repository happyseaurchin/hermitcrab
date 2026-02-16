// HERMITCRAB 0.2 — G1: Pscale Native
// T:0.1 — the temporal entry point. Reads code from S:0.x coordinates.
// Logarithmic memory at M:1, M:2... M:10 (summary), M:11...

(async function boot() {
  const root = document.getElementById('root');
  const saved = localStorage.getItem('hermitcrab_api_key');
  const MODEL_CHAIN = ['claude-opus-4-6', 'claude-opus-4-20250514', 'claude-sonnet-4-5-20250929', 'claude-sonnet-4-20250514'];
  let BOOT_MODEL = MODEL_CHAIN[0];
  const KERNEL_VERSION = 'g1-v9'; // v9: pscale v3 (nested JSON), prefix-as-tree-selector
  const FAST_MODEL = 'claude-haiku-4-5-20251001';

  let currentJSX = null;
  let reactRoot = null;

  // ============ PROGRESS DISPLAY ============

  let statusLines = [];
  function status(msg, type = 'info') {
    const time = new Date().toLocaleTimeString();
    statusLines.push({ msg, type, time });
    const html = statusLines.map(s => {
      const color = s.type === 'error' ? '#f87171' : s.type === 'success' ? '#4ade80' : '#67e8f9';
      return `<div style="color:${color};margin:4px 0;font-size:13px">
        <span style="color:#555">${s.time}</span> ${s.msg}
      </div>`;
    }).join('');
    root.innerHTML = `
      <div style="max-width:600px;margin:40px auto;font-family:monospace;padding:20px">
        <h2 style="color:#a78bfa;margin-bottom:16px">◇ HERMITCRAB 0.2 — G1</h2>
        ${html}
        <div style="color:#555;margin-top:12px;font-size:11px">
          ${statusLines[statusLines.length-1]?.type === 'error' ? '' : '▪ working...'}
        </div>
      </div>`;
  }

  // ============ PSCALE COORDINATE STORAGE ============
  // Two implementations available:
  //   v1: RAM Map + IndexedDB per-record persistence
  //   v2: Single JSON blob — the JSON IS the database
  // Switch via PSCALE_VERSION. Same API surface, different internals.
  const PSCALE_VERSION = 3; // ← v1=IndexedDB, v2=flat JSON blob, v3=nested JSON (prefix-as-tree-selector)

  function pscaleStoreV1() {
    const cache = new Map();
    const PS_PREFIX = 'ps:';
    const IDB_NAME = 'hermitcrab-pscale';
    const IDB_STORE = 'coords';

    // -- IndexedDB helpers (internal) --

    function idbOpen() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore(IDB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    function idbPut(coord, content) {
      idbOpen().then(db => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(content, coord);
      }).catch(e => console.warn('[pscale] IDB write failed:', coord, e.message));
    }

    function idbRemove(coord) {
      idbOpen().then(db => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(coord);
      }).catch(e => console.warn('[pscale] IDB delete failed:', coord, e.message));
    }

    async function idbLoadAll() {
      const db = await idbOpen();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const keys = store.getAllKeys();
        const values = store.getAll();
        tx.oncomplete = () => {
          const map = new Map();
          for (let i = 0; i < keys.result.length; i++) {
            map.set(keys.result[i], values.result[i]);
          }
          resolve(map);
        };
        tx.onerror = () => reject(tx.error);
      });
    }

    // -- init: hydrate cache from IDB, migrate localStorage --

    async function init() {
      // 1. Load all IndexedDB entries into cache
      try {
        const idbData = await idbLoadAll();
        for (const [k, v] of idbData) cache.set(k, v);
        console.log(`[pscale] loaded ${idbData.size} coords from IndexedDB`);
      } catch (e) {
        console.warn('[pscale] IndexedDB load failed, falling back to localStorage:', e.message);
      }

      // 2. Migrate any existing localStorage ps:* keys
      const lsKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PS_PREFIX)) lsKeys.push(k);
      }
      if (lsKeys.length > 0) {
        console.log(`[pscale] migrating ${lsKeys.length} keys from localStorage → IndexedDB`);
        for (const k of lsKeys) {
          const coord = k.slice(PS_PREFIX.length);
          if (!cache.has(coord)) {
            const content = localStorage.getItem(k);
            cache.set(coord, content);
            idbPut(coord, content);
          }
        }
        // Clean up localStorage after migration
        for (const k of lsKeys) localStorage.removeItem(k);
        console.log('[pscale] localStorage migration complete');
      }
    }

    return {
      init,

      read(coord) {
        return cache.get(coord) ?? null;
      },

      write(coord, content) {
        cache.set(coord, content);
        idbPut(coord, content);
        return coord;
      },

      delete(coord) {
        cache.delete(coord);
        idbRemove(coord);
        return coord;
      },

      list(prefix) {
        const results = [];
        for (const k of cache.keys()) {
          if (!prefix || k.startsWith(prefix)) {
            results.push(k);
          }
        }
        return results.sort();
      },

      nextMemory() {
        const memCoords = this.list('M:').map(c => parseInt(c.slice(2))).filter(n => !isNaN(n));
        if (memCoords.length === 0) return { type: 'entry', coord: 'M:1' };

        const max = Math.max(...memCoords);
        const next = max + 1;
        const nextStr = String(next);
        const allZeros = nextStr.slice(1).split('').every(c => c === '0');
        if (allZeros && nextStr.length > 1) {
          return { type: 'summary', coord: 'M:' + next, summarize: this._getSummaryRange(next) };
        }
        return { type: 'entry', coord: 'M:' + next };
      },

      _getSummaryRange(summaryNum) {
        const str = String(summaryNum);
        const magnitude = Math.pow(10, str.length - 1);
        const base = summaryNum - magnitude;
        const coords = [];
        if (magnitude === 10) {
          for (let i = base + 1; i < summaryNum; i++) {
            coords.push('M:' + i);
          }
        } else {
          const step = magnitude / 10;
          for (let i = base + step; i < summaryNum; i += step) {
            coords.push('M:' + i);
          }
        }
        return coords;
      },

      context(coord) {
        const colonIdx = coord.indexOf(':');
        if (colonIdx === -1) return [coord];
        const prefix = coord.substring(0, colonIdx + 1);
        const numStr = coord.substring(colonIdx + 1);

        if (numStr.includes('.')) {
          const dotIdx = numStr.indexOf('.');
          const afterDot = numStr.substring(dotIdx + 1);
          const layers = [];
          for (let i = 1; i <= afterDot.length; i++) {
            layers.push(prefix + numStr.substring(0, dotIdx + 1) + afterDot.substring(0, i));
          }
          return layers;
        } else {
          const num = parseInt(numStr);
          if (isNaN(num) || num === 0) return [coord];
          const str = String(num);
          const layers = [];
          for (let i = 1; i <= str.length; i++) {
            const magnitude = Math.pow(10, str.length - i);
            const rounded = Math.floor(num / magnitude) * magnitude;
            if (rounded > 0) layers.push(prefix + rounded);
          }
          return [...new Set(layers)];
        }
      },

      contextContent(coord) {
        const layers = this.context(coord);
        const result = {};
        for (const c of layers) {
          const content = this.read(c);
          if (content) result[c] = content;
        }
        return result;
      },

      // X- (zoom in): find occupied children one level deeper
      // Returns [] at the creative frontier — where LLM is needed to decompose.
      children(coord) {
        const results = [];
        for (const k of cache.keys()) {
          if (this._parent(k) === coord) results.push(k);
        }
        return results.sort();
      },

      // X~ (lateral scan): siblings at same depth, same parent
      siblings(coord) {
        const parent = this._parent(coord);
        if (!parent) return [];
        return this.children(parent).filter(k => k !== coord);
      },

      // Internal: compute parent coordinate (pscale+)
      // "S:0.51" → "S:0.5", "S:0.5" → "S:0", "M:5432" → "M:5430", "M:5430" → "M:5400"
      _parent(coord) {
        const colonIdx = coord.indexOf(':');
        if (colonIdx === -1) return null;
        const prefix = coord.substring(0, colonIdx + 1);
        const numStr = coord.substring(colonIdx + 1);

        if (numStr.includes('.')) {
          const dotIdx = numStr.indexOf('.');
          const afterDot = numStr.substring(dotIdx + 1);
          if (afterDot.length <= 1) return prefix + numStr.substring(0, dotIdx);
          return prefix + numStr.substring(0, dotIdx + 1) + afterDot.substring(0, afterDot.length - 1);
        } else {
          const num = parseInt(numStr);
          if (isNaN(num) || num === 0) return null;
          const str = String(num);
          if (str.length <= 1) return null;
          // Zero the last significant digit: 5432→5430, 5430→5400
          for (let i = str.length - 1; i >= 0; i--) {
            if (str[i] !== '0') {
              const parent = str.substring(0, i) + '0'.repeat(str.length - i);
              const parentNum = parseInt(parent);
              return parentNum === 0 ? null : prefix + parentNum;
            }
          }
          return null;
        }
      }
    };
  }

  // ============ PSCALE V2: JSON IS THE DATABASE ============
  // One JSON object. Keys are coordinates. Values are semantic text.
  // Persists as a single blob to localStorage (or single IDB record).
  // Navigation is string ops on Object.keys(). No database layer.

  function pscaleStoreV2() {
    let tree = {};
    const LS_KEY = 'hermitcrab-pscale-v2';

    function persist() {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(tree));
      } catch (e) {
        console.warn('[pscale-v2] persist failed:', e.message);
      }
    }

    // Parent coordinate (pscale+): "S:0.51"→"S:0.5", "M:5432"→"M:5430"
    function parent(coord) {
      const colonIdx = coord.indexOf(':');
      if (colonIdx === -1) return null;
      const prefix = coord.substring(0, colonIdx + 1);
      const numStr = coord.substring(colonIdx + 1);

      if (numStr.includes('.')) {
        const dotIdx = numStr.indexOf('.');
        const afterDot = numStr.substring(dotIdx + 1);
        if (afterDot.length <= 1) return prefix + numStr.substring(0, dotIdx);
        return prefix + numStr.substring(0, dotIdx + 1) + afterDot.substring(0, afterDot.length - 1);
      } else {
        const num = parseInt(numStr);
        if (isNaN(num) || num === 0) return null;
        const str = String(num);
        if (str.length <= 1) return null;
        for (let i = str.length - 1; i >= 0; i--) {
          if (str[i] !== '0') {
            const p = str.substring(0, i) + '0'.repeat(str.length - i);
            const pNum = parseInt(p);
            return pNum === 0 ? null : prefix + pNum;
          }
        }
        return null;
      }
    }

    return {
      async init() {
        // Load from localStorage
        try {
          const stored = localStorage.getItem(LS_KEY);
          if (stored) {
            tree = JSON.parse(stored);
            console.log(`[pscale-v2] loaded ${Object.keys(tree).length} coords from JSON blob`);
          }
        } catch (e) {
          console.warn('[pscale-v2] load failed:', e.message);
        }

        // Migrate from v1 IDB if v2 is empty
        if (Object.keys(tree).length === 0) {
          try {
            const req = indexedDB.open('hermitcrab-pscale', 1);
            const db = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); req.onupgradeneeded = () => req.result.createObjectStore('coords'); });
            const tx = db.transaction('coords', 'readonly');
            const store = tx.objectStore('coords');
            const keys = store.getAllKeys();
            const values = store.getAll();
            await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
            if (keys.result.length > 0) {
              for (let i = 0; i < keys.result.length; i++) tree[keys.result[i]] = values.result[i];
              persist();
              console.log(`[pscale-v2] migrated ${keys.result.length} coords from IDB v1`);
            }
          } catch (e) {
            console.log('[pscale-v2] no v1 IDB to migrate (normal for fresh installs)');
          }

          // Also migrate localStorage ps:* keys (G0 legacy)
          const lsKeys = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('ps:')) lsKeys.push(k);
          }
          if (lsKeys.length > 0) {
            for (const k of lsKeys) {
              const coord = k.slice(3);
              if (!tree[coord]) tree[coord] = localStorage.getItem(k);
            }
            for (const k of lsKeys) localStorage.removeItem(k);
            persist();
            console.log(`[pscale-v2] migrated ${lsKeys.length} keys from localStorage`);
          }
        }
      },

      read(coord) { return tree[coord] ?? null; },

      write(coord, content) {
        tree[coord] = content;
        persist();
        return coord;
      },

      delete(coord) {
        delete tree[coord];
        persist();
        return coord;
      },

      list(prefix) {
        return Object.keys(tree).filter(k => !prefix || k.startsWith(prefix)).sort();
      },

      nextMemory() {
        const memCoords = this.list('M:').map(c => parseInt(c.slice(2))).filter(n => !isNaN(n));
        if (memCoords.length === 0) return { type: 'entry', coord: 'M:1' };
        const max = Math.max(...memCoords);
        const next = max + 1;
        const nextStr = String(next);
        const allZeros = nextStr.slice(1).split('').every(c => c === '0');
        if (allZeros && nextStr.length > 1) {
          return { type: 'summary', coord: 'M:' + next, summarize: this._getSummaryRange(next) };
        }
        return { type: 'entry', coord: 'M:' + next };
      },

      _getSummaryRange(summaryNum) {
        const str = String(summaryNum);
        const magnitude = Math.pow(10, str.length - 1);
        const base = summaryNum - magnitude;
        const coords = [];
        if (magnitude === 10) {
          for (let i = base + 1; i < summaryNum; i++) coords.push('M:' + i);
        } else {
          const step = magnitude / 10;
          for (let i = base + step; i < summaryNum; i += step) coords.push('M:' + i);
        }
        return coords;
      },

      // Zoom out: digit layers from general to specific
      context(coord) {
        const colonIdx = coord.indexOf(':');
        if (colonIdx === -1) return [coord];
        const prefix = coord.substring(0, colonIdx + 1);
        const numStr = coord.substring(colonIdx + 1);

        if (numStr.includes('.')) {
          const dotIdx = numStr.indexOf('.');
          const afterDot = numStr.substring(dotIdx + 1);
          const layers = [];
          for (let i = 1; i <= afterDot.length; i++) {
            layers.push(prefix + numStr.substring(0, dotIdx + 1) + afterDot.substring(0, i));
          }
          return layers;
        } else {
          const num = parseInt(numStr);
          if (isNaN(num) || num === 0) return [coord];
          const str = String(num);
          const layers = [];
          for (let i = 1; i <= str.length; i++) {
            const mag = Math.pow(10, str.length - i);
            const rounded = Math.floor(num / mag) * mag;
            if (rounded > 0) layers.push(prefix + rounded);
          }
          return [...new Set(layers)];
        }
      },

      contextContent(coord) {
        const layers = this.context(coord);
        const result = {};
        for (const c of layers) {
          if (tree[c]) result[c] = tree[c];
        }
        return result;
      },

      // X- (zoom in): occupied children one level deeper
      children(coord) {
        return Object.keys(tree).filter(k => parent(k) === coord).sort();
      },

      // X~ (lateral): siblings at same depth
      siblings(coord) {
        const p = parent(coord);
        if (!p) return [];
        return this.children(p).filter(k => k !== coord);
      },

      _parent: parent,

      // Direct access to the tree (for debugging / export)
      _tree() { return tree; }
    };
  }

  // ============ PSCALE V3: NESTED JSON — THE NESTING IS PSCALE CONTAINMENT ============
  // Each prefix (S, M, T, I, ST, C) gets its own nested tree with its own decimal.
  // Each digit of a coordinate becomes a JSON key. Leaves are strings, branches are objects.
  // Navigation is O(1) property access. Children = read digit keys. No scanning.
  // Non-numeric coords (M:conv, S:0.2v) stored in a flat specials map.

  function pscaleStoreV3() {
    const LS_KEY = 'hermitcrab-pscale-v3';
    const DEFAULT_TREES = {
      S: { decimal: 1, tree: {} },
      M: { decimal: 0, tree: {} },
      T: { decimal: 1, tree: {} },
      I: { decimal: 1, tree: {} },
      ST: { decimal: 0, tree: {} },
      C: { decimal: 0, tree: {} }
    };
    let data = JSON.parse(JSON.stringify(DEFAULT_TREES));
    let specials = {};

    function persist() {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ trees: data, specials }));
      } catch (e) {
        console.warn('[pscale-v3] persist failed:', e.message);
      }
    }

    // ── Coordinate parsing ──

    function parseCoord(coord) {
      const colonIdx = coord.indexOf(':');
      if (colonIdx === -1) return { prefix: null, numStr: coord, digits: null };
      const prefix = coord.substring(0, colonIdx);
      const numStr = coord.substring(colonIdx + 1);
      // Non-numeric = special key (M:conv, S:0.2v, etc)
      if (/[^0-9.]/.test(numStr)) return { prefix, numStr, digits: null, special: true };
      const digits = numStr.replace('.', '').split('');
      return { prefix, numStr, digits, special: false };
    }

    function ensurePrefix(prefix) {
      if (!data[prefix]) data[prefix] = { decimal: 0, tree: {} };
    }

    // ── Reconstruct coordinate string from digits + decimal ──

    function digitsToNumStr(digits, decimal) {
      const joined = digits.join('');
      if (decimal > 0 && decimal < joined.length) {
        return joined.slice(0, decimal) + '.' + joined.slice(decimal);
      }
      // decimal === 0: pure integer (M:153)
      // decimal >= joined.length: also pure integer (single digit, etc)
      return joined;
    }

    function makeCoord(prefix, digits, decimal) {
      return prefix + ':' + digitsToNumStr(digits, decimal);
    }

    // ── Tree operations ──

    function getNode(tree, digits) {
      let node = tree;
      for (const d of digits) {
        if (node === null || node === undefined || typeof node === 'string') return null;
        if (!(d in node)) return null;
        node = node[d];
      }
      return node;
    }

    function readSemantic(node) {
      if (node === null || node === undefined) return null;
      if (typeof node === 'string') return node;
      if (typeof node === 'object' && '_' in node) return node._;
      return null;
    }

    function writeSemantic(tree, digits, content) {
      let node = tree;
      for (let i = 0; i < digits.length; i++) {
        const d = digits[i];
        if (i === digits.length - 1) {
          // Final digit: set the semantic
          if (!(d in node) || node[d] === null || node[d] === undefined) {
            node[d] = content; // new leaf
          } else if (typeof node[d] === 'string') {
            node[d] = content; // overwrite leaf
          } else {
            node[d]._ = content; // update branch semantic
          }
        } else {
          // Intermediate: ensure object exists
          if (!(d in node) || node[d] === null || node[d] === undefined) {
            node[d] = {};
          } else if (typeof node[d] === 'string') {
            node[d] = { _: node[d] }; // promote leaf to branch
          }
          node = node[d];
        }
      }
    }

    function deleteSemantic(tree, digits) {
      if (digits.length === 0) return;
      // Walk to parent
      let node = tree;
      for (let i = 0; i < digits.length - 1; i++) {
        if (typeof node !== 'object' || !(digits[i] in node)) return;
        node = node[digits[i]];
      }
      const lastDigit = digits[digits.length - 1];
      if (typeof node !== 'object' || !(lastDigit in node)) return;

      const target = node[lastDigit];
      if (typeof target === 'string') {
        // Leaf: just delete
        delete node[lastDigit];
      } else if (typeof target === 'object') {
        // Branch: remove semantic but keep children
        delete target._;
        // If no digit children remain, delete the whole node
        const hasChildren = Object.keys(target).some(k => k.length === 1 && k >= '0' && k <= '9');
        if (!hasChildren) delete node[lastDigit];
      }
    }

    // ── Walk tree to collect all coordinates ──

    function walkTree(node, pathSoFar, prefix, decimal, results) {
      if (typeof node === 'string') {
        // Leaf with semantic
        results.push(makeCoord(prefix, pathSoFar, decimal));
        return;
      }
      if (typeof node !== 'object' || node === null) return;
      // Branch: if it has _, it's an addressable coordinate
      if ('_' in node) {
        results.push(makeCoord(prefix, pathSoFar, decimal));
      }
      // Recurse into digit children
      for (const k of Object.keys(node)) {
        if (k.length === 1 && k >= '0' && k <= '9') {
          walkTree(node[k], [...pathSoFar, k], prefix, decimal, results);
        }
      }
    }

    // ── Parent coordinate (same string logic as v1/v2) ──

    function parent(coord) {
      const colonIdx = coord.indexOf(':');
      if (colonIdx === -1) return null;
      const prefix = coord.substring(0, colonIdx + 1);
      const numStr = coord.substring(colonIdx + 1);

      if (numStr.includes('.')) {
        const dotIdx = numStr.indexOf('.');
        const afterDot = numStr.substring(dotIdx + 1);
        if (afterDot.length <= 1) return prefix + numStr.substring(0, dotIdx);
        return prefix + numStr.substring(0, dotIdx + 1) + afterDot.substring(0, afterDot.length - 1);
      } else {
        const num = parseInt(numStr);
        if (isNaN(num) || num === 0) return null;
        const str = String(num);
        if (str.length <= 1) return null;
        for (let i = str.length - 1; i >= 0; i--) {
          if (str[i] !== '0') {
            const p = str.substring(0, i) + '0'.repeat(str.length - i);
            const pNum = parseInt(p);
            return pNum === 0 ? null : prefix + pNum;
          }
        }
        return null;
      }
    }

    return {
      async init() {
        // Load from localStorage
        try {
          const stored = localStorage.getItem(LS_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.trees) data = parsed.trees;
            if (parsed.specials) specials = parsed.specials;
            // Count total coords
            let count = 0;
            for (const prefix of Object.keys(data)) {
              const results = [];
              walkTree(data[prefix].tree, [], prefix, data[prefix].decimal, results);
              count += results.length;
            }
            count += Object.keys(specials).length;
            console.log(`[pscale-v3] loaded ${count} coords from nested JSON`);
            return;
          }
        } catch (e) {
          console.warn('[pscale-v3] load failed:', e.message);
        }

        // Migrate from v2 JSON blob
        try {
          const v2Stored = localStorage.getItem('hermitcrab-pscale-v2');
          if (v2Stored) {
            const v2Tree = JSON.parse(v2Stored);
            let migrated = 0;
            for (const [coord, content] of Object.entries(v2Tree)) {
              const p = parseCoord(coord);
              if (p.special || !p.digits) {
                specials[coord] = content;
              } else {
                ensurePrefix(p.prefix);
                writeSemantic(data[p.prefix].tree, p.digits, content);
              }
              migrated++;
            }
            if (migrated > 0) {
              persist();
              console.log(`[pscale-v3] migrated ${migrated} coords from v2 JSON blob`);
              return;
            }
          }
        } catch (e) {
          console.log('[pscale-v3] no v2 blob to migrate');
        }

        // Migrate from v1 IDB
        try {
          const req = indexedDB.open('hermitcrab-pscale', 1);
          const db = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); req.onupgradeneeded = () => req.result.createObjectStore('coords'); });
          const tx = db.transaction('coords', 'readonly');
          const store = tx.objectStore('coords');
          const keys = store.getAllKeys();
          const values = store.getAll();
          await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
          if (keys.result.length > 0) {
            let migrated = 0;
            for (let i = 0; i < keys.result.length; i++) {
              const coord = keys.result[i];
              const content = values.result[i];
              const p = parseCoord(coord);
              if (p.special || !p.digits) {
                specials[coord] = content;
              } else {
                ensurePrefix(p.prefix);
                writeSemantic(data[p.prefix].tree, p.digits, content);
              }
              migrated++;
            }
            if (migrated > 0) {
              persist();
              console.log(`[pscale-v3] migrated ${migrated} coords from IDB v1`);
              return;
            }
          }
        } catch (e) {
          console.log('[pscale-v3] no v1 IDB to migrate (normal for fresh installs)');
        }

        // Migrate G0 localStorage ps:* keys
        const lsKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('ps:')) lsKeys.push(k);
        }
        if (lsKeys.length > 0) {
          for (const k of lsKeys) {
            const coord = k.slice(3);
            const content = localStorage.getItem(k);
            const p = parseCoord(coord);
            if (p.special || !p.digits) {
              specials[coord] = content;
            } else {
              ensurePrefix(p.prefix);
              writeSemantic(data[p.prefix].tree, p.digits, content);
            }
          }
          for (const k of lsKeys) localStorage.removeItem(k);
          persist();
          console.log(`[pscale-v3] migrated ${lsKeys.length} keys from G0 localStorage`);
        }
      },

      read(coord) {
        const p = parseCoord(coord);
        if (p.special || !p.digits) return specials[coord] ?? null;
        if (!data[p.prefix]) return null;
        const node = getNode(data[p.prefix].tree, p.digits);
        return readSemantic(node);
      },

      write(coord, content) {
        const p = parseCoord(coord);
        if (p.special || !p.digits) {
          specials[coord] = content;
          persist();
          return coord;
        }
        ensurePrefix(p.prefix);
        writeSemantic(data[p.prefix].tree, p.digits, content);
        persist();
        return coord;
      },

      delete(coord) {
        const p = parseCoord(coord);
        if (p.special || !p.digits) {
          delete specials[coord];
          persist();
          return coord;
        }
        if (!data[p.prefix]) return coord;
        deleteSemantic(data[p.prefix].tree, p.digits);
        persist();
        return coord;
      },

      list(prefix) {
        const results = [];

        if (!prefix) {
          // List ALL coordinates across all trees + specials
          for (const pfx of Object.keys(data)) {
            walkTree(data[pfx].tree, [], pfx, data[pfx].decimal, results);
          }
          results.push(...Object.keys(specials));
        } else {
          // Parse the prefix to determine which tree(s) to walk
          const colonIdx = prefix.indexOf(':');
          if (colonIdx === -1) {
            // Bare prefix like "S" — match trees starting with it
            for (const pfx of Object.keys(data)) {
              if (pfx.startsWith(prefix)) {
                walkTree(data[pfx].tree, [], pfx, data[pfx].decimal, results);
              }
            }
            for (const k of Object.keys(specials)) {
              if (k.startsWith(prefix)) results.push(k);
            }
          } else {
            const pfx = prefix.substring(0, colonIdx);
            const afterColon = prefix.substring(colonIdx + 1);

            if (!afterColon) {
              // "S:" or "M:" — list entire tree for that prefix
              if (data[pfx]) {
                walkTree(data[pfx].tree, [], pfx, data[pfx].decimal, results);
              }
              for (const k of Object.keys(specials)) {
                if (k.startsWith(prefix)) results.push(k);
              }
            } else {
              // "S:0.2" — list all coords starting with this prefix string
              // Walk the tree, collect all coords, then filter by prefix match
              if (data[pfx]) {
                const allInTree = [];
                walkTree(data[pfx].tree, [], pfx, data[pfx].decimal, allInTree);
                for (const c of allInTree) {
                  if (c.startsWith(prefix)) results.push(c);
                }
              }
              for (const k of Object.keys(specials)) {
                if (k.startsWith(prefix)) results.push(k);
              }
            }
          }
        }

        return results.sort();
      },

      nextMemory() {
        const memCoords = this.list('M:').map(c => parseInt(c.slice(2))).filter(n => !isNaN(n));
        if (memCoords.length === 0) return { type: 'entry', coord: 'M:1' };
        const max = Math.max(...memCoords);
        const next = max + 1;
        const nextStr = String(next);
        const allZeros = nextStr.slice(1).split('').every(c => c === '0');
        if (allZeros && nextStr.length > 1) {
          return { type: 'summary', coord: 'M:' + next, summarize: this._getSummaryRange(next) };
        }
        return { type: 'entry', coord: 'M:' + next };
      },

      _getSummaryRange(summaryNum) {
        const str = String(summaryNum);
        const magnitude = Math.pow(10, str.length - 1);
        const base = summaryNum - magnitude;
        const coords = [];
        if (magnitude === 10) {
          for (let i = base + 1; i < summaryNum; i++) coords.push('M:' + i);
        } else {
          const step = magnitude / 10;
          for (let i = base + step; i < summaryNum; i += step) coords.push('M:' + i);
        }
        return coords;
      },

      context(coord) {
        const colonIdx = coord.indexOf(':');
        if (colonIdx === -1) return [coord];
        const prefix = coord.substring(0, colonIdx + 1);
        const numStr = coord.substring(colonIdx + 1);

        if (numStr.includes('.')) {
          const dotIdx = numStr.indexOf('.');
          const afterDot = numStr.substring(dotIdx + 1);
          const layers = [];
          for (let i = 1; i <= afterDot.length; i++) {
            layers.push(prefix + numStr.substring(0, dotIdx + 1) + afterDot.substring(0, i));
          }
          return layers;
        } else {
          const num = parseInt(numStr);
          if (isNaN(num) || num === 0) return [coord];
          const str = String(num);
          const layers = [];
          for (let i = 1; i <= str.length; i++) {
            const mag = Math.pow(10, str.length - i);
            const rounded = Math.floor(num / mag) * mag;
            if (rounded > 0) layers.push(prefix + rounded);
          }
          return [...new Set(layers)];
        }
      },

      contextContent(coord) {
        const layers = this.context(coord);
        const result = {};
        for (const c of layers) {
          const content = this.read(c);
          if (content) result[c] = content;
        }
        return result;
      },

      // X- (zoom in): children of this coordinate. O(1) — read digit keys of the node.
      children(coord) {
        const p = parseCoord(coord);
        if (p.special || !p.digits || !data[p.prefix]) return [];
        const node = getNode(data[p.prefix].tree, p.digits);
        if (!node || typeof node === 'string') return []; // leaf = creative frontier
        const decimal = data[p.prefix].decimal;
        return Object.keys(node)
          .filter(k => k.length === 1 && k >= '0' && k <= '9')
          .sort()
          .map(d => makeCoord(p.prefix, [...p.digits, d], decimal));
      },

      // X~ (lateral): siblings at same level, excluding self
      siblings(coord) {
        const p = parseCoord(coord);
        if (p.special || !p.digits || p.digits.length < 1 || !data[p.prefix]) return [];
        const parentDigits = p.digits.slice(0, -1);
        const selfDigit = p.digits[p.digits.length - 1];
        const parentNode = parentDigits.length === 0 ? data[p.prefix].tree : getNode(data[p.prefix].tree, parentDigits);
        if (!parentNode || typeof parentNode === 'string') return [];
        const decimal = data[p.prefix].decimal;
        return Object.keys(parentNode)
          .filter(k => k.length === 1 && k >= '0' && k <= '9' && k !== selfDigit)
          .sort()
          .map(d => makeCoord(p.prefix, [...parentDigits, d], decimal));
      },

      _parent: parent,

      _tree() { return { trees: data, specials }; }
    };
  }

  // ============ BROWSER CAPABILITY LAYER ============
  // Every permissioned browser API exposed to the instance.
  // Pattern: instance calls tool → kernel handles gesture-gating → result flows back.

  // -- Filesystem Access (File System Access API) --
  let fsDirectoryHandle = null;

  async function fsPickDirectory() {
    if (!window.showDirectoryPicker) return { error: 'File System Access API not supported in this browser' };
    try {
      fsDirectoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      return { success: true, name: fsDirectoryHandle.name };
    } catch (e) {
      if (e.name === 'AbortError') return { error: 'User cancelled directory picker' };
      return { error: e.message };
    }
  }

  async function fsList(path) {
    if (!fsDirectoryHandle) return { error: 'No directory open. Use fs_pick_directory first.' };
    try {
      let dir = fsDirectoryHandle;
      if (path && path !== '/' && path !== '.') {
        for (const part of path.split('/').filter(Boolean)) {
          dir = await dir.getDirectoryHandle(part);
        }
      }
      const entries = [];
      for await (const [name, handle] of dir) {
        entries.push({ name, kind: handle.kind });
      }
      return { entries };
    } catch (e) {
      return { error: e.message };
    }
  }

  async function fsRead(path) {
    if (!fsDirectoryHandle) return { error: 'No directory open. Use fs_pick_directory first.' };
    try {
      const parts = path.split('/').filter(Boolean);
      const fileName = parts.pop();
      let dir = fsDirectoryHandle;
      for (const part of parts) {
        dir = await dir.getDirectoryHandle(part);
      }
      const fileHandle = await dir.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const text = await file.text();
      return { content: text, size: file.size, type: file.type, lastModified: file.lastModified };
    } catch (e) {
      return { error: e.message };
    }
  }

  async function fsWrite(path, content) {
    if (!fsDirectoryHandle) return { error: 'No directory open. Use fs_pick_directory first.' };
    try {
      const parts = path.split('/').filter(Boolean);
      const fileName = parts.pop();
      let dir = fsDirectoryHandle;
      for (const part of parts) {
        dir = await dir.getDirectoryHandle(part, { create: true });
      }
      const fileHandle = await dir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return { success: true, path };
    } catch (e) {
      return { error: e.message };
    }
  }

  async function fsMkdir(path) {
    if (!fsDirectoryHandle) return { error: 'No directory open. Use fs_pick_directory first.' };
    try {
      let dir = fsDirectoryHandle;
      for (const part of path.split('/').filter(Boolean)) {
        dir = await dir.getDirectoryHandle(part, { create: true });
      }
      return { success: true, path };
    } catch (e) {
      return { error: e.message };
    }
  }

  async function fsDelete(path) {
    if (!fsDirectoryHandle) return { error: 'No directory open. Use fs_pick_directory first.' };
    try {
      const parts = path.split('/').filter(Boolean);
      const name = parts.pop();
      let dir = fsDirectoryHandle;
      for (const part of parts) {
        dir = await dir.getDirectoryHandle(part);
      }
      await dir.removeEntry(name, { recursive: true });
      return { success: true, deleted: path };
    } catch (e) {
      return { error: e.message };
    }
  }

  // -- Clipboard --
  async function clipboardWrite(text) {
    try {
      await navigator.clipboard.writeText(text);
      return { success: true };
    } catch (e) {
      return { error: `Clipboard write failed: ${e.message}. May need user gesture.` };
    }
  }

  async function clipboardRead() {
    try {
      const text = await navigator.clipboard.readText();
      return { content: text };
    } catch (e) {
      return { error: `Clipboard read failed: ${e.message}. May need user gesture or permission.` };
    }
  }

  // -- Notifications --
  async function sendNotification(title, body) {
    if (!('Notification' in window)) return { error: 'Notifications not supported' };
    if (Notification.permission === 'denied') return { error: 'Notifications blocked by user' };
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return { error: 'Notification permission not granted' };
    }
    new Notification(title, { body, icon: '/favicon.ico' });
    return { success: true };
  }

  // -- Speech Synthesis --
  function speak(text, opts = {}) {
    if (!('speechSynthesis' in window)) return { error: 'Speech synthesis not supported' };
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (opts.rate) utterance.rate = opts.rate;
    if (opts.pitch) utterance.pitch = opts.pitch;
    if (opts.lang) utterance.lang = opts.lang;
    window.speechSynthesis.speak(utterance);
    return { success: true, chars: text.length };
  }

  // -- Speech Recognition --
  let recognitionInstance = null;
  function listenForSpeech(opts = {}) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return Promise.resolve({ error: 'Speech recognition not supported' });
    return new Promise((resolve) => {
      if (recognitionInstance) {
        try { recognitionInstance.stop(); } catch (e) { /* ok */ }
      }
      const recognition = new SpeechRecognition();
      recognitionInstance = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      if (opts.lang) recognition.lang = opts.lang;
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;
        resolve({ transcript, confidence });
      };
      recognition.onerror = (event) => resolve({ error: `Speech recognition error: ${event.error}` });
      recognition.onend = () => { if (!recognitionInstance) resolve({ error: 'No speech detected' }); };
      recognition.start();
      setTimeout(() => {
        try { recognition.stop(); } catch (e) { /* ok */ }
        resolve({ error: 'Listening timed out (15s)' });
      }, 15000);
    });
  }

  // -- Download Generation --
  function generateDownload(filename, content, mimeType = 'text/plain') {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { success: true, filename, size: blob.size };
    } catch (e) {
      return { error: e.message };
    }
  }

  // -- IndexedDB Stash (large storage, separate from pscale) --
  const STASH_DB = 'hermitcrab';
  const STASH_STORE = 'stash';

  function stashOpen() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(STASH_DB, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STASH_STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbWrite(key, value) {
    try {
      const db = await stashOpen();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STASH_STORE, 'readwrite');
        tx.objectStore(STASH_STORE).put(value, key);
        tx.oncomplete = () => resolve({ success: true, key });
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      return { error: e.message };
    }
  }

  async function idbRead(key) {
    try {
      const db = await stashOpen();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STASH_STORE, 'readonly');
        const req = tx.objectStore(STASH_STORE).get(key);
        req.onsuccess = () => resolve(req.result !== undefined ? { content: req.result } : { error: 'Key not found' });
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return { error: e.message };
    }
  }

  async function idbList() {
    try {
      const db = await stashOpen();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STASH_STORE, 'readonly');
        const req = tx.objectStore(STASH_STORE).getAllKeys();
        req.onsuccess = () => resolve({ keys: req.result });
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return { error: e.message };
    }
  }

  async function idbDelete(key) {
    try {
      const db = await stashOpen();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STASH_STORE, 'readwrite');
        tx.objectStore(STASH_STORE).delete(key);
        tx.oncomplete = () => resolve({ success: true, deleted: key });
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      return { error: e.message };
    }
  }

  // -- Tab/Window Management --
  function openTab(url) {
    const win = window.open(url, '_blank');
    if (win) return { success: true, url };
    return { error: 'Popup blocked. Ask the human to allow popups for this site.' };
  }

  // ============ CUSTOM TOOL EXECUTION ============

  async function executeCustomTool(name, input) {
    switch (name) {
      case 'get_datetime':
        return JSON.stringify({
          iso: new Date().toISOString(),
          unix: Date.now(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          local: new Date().toLocaleString()
        });
      case 'get_geolocation':
        return new Promise((resolve) => {
          if (!navigator.geolocation) return resolve('Geolocation not supported');
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })),
            (err) => resolve(`Geolocation error: ${err.message}`),
            { timeout: 10000 }
          );
        });
      case 'web_fetch':
        try {
          const res = await fetch('/api/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: input.url })
          });
          const data = await res.json();
          if (data.error) return `Fetch error: ${data.error}`;
          return `HTTP ${data.status} (${data.contentType}, ${data.length} bytes):\n${data.content}`;
        } catch (e) {
          return `web_fetch failed: ${e.message}`;
        }
      case 'web_request':
        try {
          const fetchOpts = { method: (input.method || 'POST').toUpperCase() };
          const hdrs = { ...(input.headers || {}) };
          if (input.body && typeof input.body === 'object') {
            hdrs['Content-Type'] = hdrs['Content-Type'] || 'application/json';
            fetchOpts.body = JSON.stringify(input.body);
          } else if (input.body) {
            fetchOpts.body = input.body;
          }
          fetchOpts.headers = hdrs;
          const res = await fetch(input.url, fetchOpts);
          const text = await res.text();
          return JSON.stringify({ status: res.status, statusText: res.statusText, body: text.substring(0, 50000) });
        } catch (e) {
          return JSON.stringify({ error: e.message });
        }
      case 'get_source':
        return getSource();
      case 'recompile':
        return JSON.stringify(recompile(input.jsx));

      // -- Filesystem --
      case 'fs_pick_directory':
        return JSON.stringify(await fsPickDirectory());
      case 'fs_list':
        return JSON.stringify(await fsList(input.path || '/'));
      case 'fs_read':
        return JSON.stringify(await fsRead(input.path));
      case 'fs_write':
        return JSON.stringify(await fsWrite(input.path, input.content));
      case 'fs_mkdir':
        return JSON.stringify(await fsMkdir(input.path));
      case 'fs_delete':
        return JSON.stringify(await fsDelete(input.path));

      // -- Clipboard --
      case 'clipboard_write':
        return JSON.stringify(await clipboardWrite(input.text));
      case 'clipboard_read':
        return JSON.stringify(await clipboardRead());

      // -- Notifications --
      case 'notify':
        return JSON.stringify(await sendNotification(input.title, input.body));

      // -- Speech --
      case 'speak':
        return JSON.stringify(speak(input.text, { rate: input.rate, pitch: input.pitch, lang: input.lang }));
      case 'listen':
        return JSON.stringify(await listenForSpeech({ lang: input.lang }));

      // -- Download --
      case 'download':
        return JSON.stringify(generateDownload(input.filename, input.content, input.mime_type));

      // -- IndexedDB Stash --
      case 'idb_write':
        return JSON.stringify(await idbWrite(input.key, input.value));
      case 'idb_read':
        return JSON.stringify(await idbRead(input.key));
      case 'idb_list':
        return JSON.stringify(await idbList());
      case 'idb_delete':
        return JSON.stringify(await idbDelete(input.key));

      // -- Tab --
      case 'open_tab':
        return JSON.stringify(openTab(input.url));

      default:
        return `Unknown tool: ${name}`;
    }
  }

  // ============ API LAYER ============

  function cleanParams(params) {
    const clean = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) clean[k] = v;
    }
    return clean;
  }

  function sanitizeForAPI(params) {
    if (!params.model) params = { ...params, model: BOOT_MODEL };
    if (params.model && !params.model.startsWith('claude-')) {
      console.log('[g1] Invalid model "' + params.model + '", using ' + BOOT_MODEL);
      params = { ...params, model: BOOT_MODEL };
    }
    // Claude API: temperature must be 1 (or omitted) when thinking is enabled
    if (params.thinking && params.temperature !== undefined && params.temperature !== 1) {
      const { temperature, ...rest } = params;
      console.log('[g1] Stripped temperature (incompatible with thinking)');
      params = rest;
    }
    return params;
  }

  async function callAPI(params) {
    params = sanitizeForAPI(params);
    const apiKey = localStorage.getItem('hermitcrab_api_key');
    const sanitized = cleanParams(params);
    console.log('[g1] callAPI →', sanitized.model, 'messages:', sanitized.messages?.length, 'tools:', sanitized.tools?.length);

    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify(sanitized)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API ${res.status}: ${err}`);
    }

    const data = await res.json();
    if (data.type === 'error') {
      throw new Error(`Claude API: ${data.error?.message || JSON.stringify(data.error)}`);
    }
    return data;
  }

  async function callWithToolLoop(params, maxLoops = 10, onStatus) {
    let response = await callAPI(params);
    let loops = 0;
    let allMessages = [...params.messages];

    while (response.stop_reason === 'tool_use' && loops < maxLoops) {
      loops++;
      const toolUseBlocks = (response.content || []).filter(b => b.type === 'tool_use');
      if (toolUseBlocks.length === 0) break;

      for (const block of toolUseBlocks) {
        if (onStatus) onStatus(`tool: ${block.name}`);
        console.log(`[g1] Tool #${loops}: ${block.name}`, block.input);
      }

      const toolResults = [];
      for (const block of toolUseBlocks) {
        const result = await executeCustomTool(block.name, block.input);
        console.log(`[g1] Tool result for ${block.name}:`, typeof result === 'string' ? result.substring(0, 200) : result);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: typeof result === 'string' ? result : JSON.stringify(result)
        });
      }

      allMessages = [
        ...allMessages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults }
      ];

      response = await callAPI({ ...params, messages: allMessages });
    }

    // Guard: if response ended with no text content, nudge the LLM to speak
    const textBlocks = (response.content || []).filter(b => b.type === 'text');
    if (response.stop_reason === 'end_turn' && textBlocks.length === 0 && loops > 0) {
      console.log('[g1] Response had 0 text blocks after tool use — nudging to speak');
      if (onStatus) onStatus('nudging for response...');
      const assistantContent = (response.content && response.content.length > 0)
        ? response.content
        : [{ type: 'text', text: '(completed tool operations)' }];
      allMessages = [
        ...allMessages,
        { role: 'assistant', content: assistantContent },
        { role: 'user', content: 'You completed tool operations but produced no visible response. Please respond to the user now.' }
      ];
      response = await callAPI({ ...params, messages: allMessages, tools: undefined });
    }

    response._messages = allMessages;
    return response;
  }

  // ============ TOOLS ============

  let currentTools = [
    { type: 'web_search_20250305', name: 'web_search', max_uses: 5 },
    {
      name: 'web_fetch',
      description: 'Fetch the contents of a URL directly. Use this to visit specific pages, read documentation, or check if a site exists. Returns HTTP status, content type, and page content.',
      input_schema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The full URL to fetch (including https://)' }
        },
        required: ['url']
      }
    },
    {
      name: 'web_request',
      description: 'Make an HTTP request with any method (POST, PUT, PATCH, DELETE, etc). Use this to publish data, call APIs, post JSON. Runs from the browser — subject to CORS. For GET, use web_fetch instead.',
      input_schema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The full URL to request' },
          method: { type: 'string', description: 'HTTP method: POST, PUT, PATCH, DELETE, etc. Default: POST' },
          headers: { type: 'object', description: 'HTTP headers as key-value pairs' },
          body: { description: 'Request body — object (sent as JSON) or string' }
        },
        required: ['url']
      }
    },
    {
      name: 'get_datetime',
      description: 'Get current date, time, timezone, and unix timestamp.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'get_geolocation',
      description: 'Attempt to get user location. May require permission.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'get_source',
      description: 'Get the JSX source code of your current React shell. Returns the full source as a string.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'recompile',
      description: 'Hot-swap your React shell with new JSX code. The new component replaces the current one immediately. Returns success/failure.',
      input_schema: {
        type: 'object',
        properties: {
          jsx: { type: 'string', description: 'The complete JSX source for the new React component' }
        },
        required: ['jsx']
      }
    },
    // -- Filesystem Access --
    {
      name: 'fs_pick_directory',
      description: 'Open a directory picker dialog. The human chooses a folder and grants you read/write access. Must be called before other fs_ tools.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'fs_list',
      description: 'List files and directories in the currently opened directory (or a subdirectory path).',
      input_schema: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Subdirectory path relative to opened directory. Use "/" or omit for root.' } }
      }
    },
    {
      name: 'fs_read',
      description: 'Read a file from the opened directory. Returns content as text.',
      input_schema: {
        type: 'object',
        properties: { path: { type: 'string', description: 'File path relative to opened directory' } },
        required: ['path']
      }
    },
    {
      name: 'fs_write',
      description: 'Write (create or overwrite) a file in the opened directory.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to opened directory' },
          content: { type: 'string', description: 'File content to write' }
        },
        required: ['path', 'content']
      }
    },
    {
      name: 'fs_mkdir',
      description: 'Create a directory (and any parent directories) in the opened directory.',
      input_schema: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Directory path to create' } },
        required: ['path']
      }
    },
    {
      name: 'fs_delete',
      description: 'Delete a file or directory (recursively) from the opened directory.',
      input_schema: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Path to delete' } },
        required: ['path']
      }
    },
    // -- Clipboard --
    {
      name: 'clipboard_write',
      description: 'Copy text to the system clipboard.',
      input_schema: {
        type: 'object',
        properties: { text: { type: 'string', description: 'Text to copy to clipboard' } },
        required: ['text']
      }
    },
    {
      name: 'clipboard_read',
      description: 'Read text from the system clipboard. Requires browser permission.',
      input_schema: { type: 'object', properties: {} }
    },
    // -- Notifications --
    {
      name: 'notify',
      description: 'Send a browser notification to the human. Will request permission on first use.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Notification title' },
          body: { type: 'string', description: 'Notification body text' }
        },
        required: ['title']
      }
    },
    // -- Speech --
    {
      name: 'speak',
      description: 'Speak text aloud using browser speech synthesis. You have a voice.',
      input_schema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to speak' },
          rate: { type: 'number', description: 'Speech rate 0.1-10, default 1' },
          pitch: { type: 'number', description: 'Pitch 0-2, default 1' },
          lang: { type: 'string', description: 'Language code e.g. en-US, fr-FR' }
        },
        required: ['text']
      }
    },
    {
      name: 'listen',
      description: 'Listen for speech via the microphone. Returns transcribed text. Times out after 15 seconds.',
      input_schema: {
        type: 'object',
        properties: {
          lang: { type: 'string', description: 'Expected language code e.g. en-US' }
        }
      }
    },
    // -- Download --
    {
      name: 'download',
      description: 'Generate a file and offer it to the human as a download.',
      input_schema: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'Name for the downloaded file' },
          content: { type: 'string', description: 'File content' },
          mime_type: { type: 'string', description: 'MIME type (default: text/plain)' }
        },
        required: ['filename', 'content']
      }
    },
    // -- IndexedDB Stash --
    {
      name: 'idb_write',
      description: 'Store data in IndexedDB (gigabytes capacity). For large content that exceeds pscale.',
      input_schema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Storage key' },
          value: { type: 'string', description: 'Content to store' }
        },
        required: ['key', 'value']
      }
    },
    {
      name: 'idb_read',
      description: 'Read data from IndexedDB by key.',
      input_schema: {
        type: 'object',
        properties: { key: { type: 'string', description: 'Storage key to read' } },
        required: ['key']
      }
    },
    {
      name: 'idb_list',
      description: 'List all keys stored in IndexedDB.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'idb_delete',
      description: 'Delete a key from IndexedDB.',
      input_schema: {
        type: 'object',
        properties: { key: { type: 'string', description: 'Key to delete' } },
        required: ['key']
      }
    },
    // -- Tab --
    {
      name: 'open_tab',
      description: 'Open a URL in a new browser tab.',
      input_schema: {
        type: 'object',
        properties: { url: { type: 'string', description: 'URL to open' } },
        required: ['url']
      }
    }
  ];

  const DEFAULT_TOOLS = currentTools;

  // Instance can change its own tool surface
  function setTools(toolArray) {
    if (!Array.isArray(toolArray)) return 'setTools requires an array';
    currentTools = toolArray;
    console.log('[g1] Tools updated by instance:', currentTools.map(t => t.name).join(', '));
    return 'Tools updated: ' + currentTools.map(t => t.name || t.type).join(', ');
  }

  // ============ NARRATIVE APERTURE ============
  // Pscale digit-layer memory injection. NOT a bulk dump like G0.
  // For current memory position M:N, loads only the digit layers via pscale.context(M:N).
  // e.g. at M:321 → reads M:300 (pscale-2 summary), M:320 (pscale-1 summary), M:321 (entry).
  // The instance can pull additional fragments itself using pscale.contextContent() etc.

  function buildNarrativeAperture() {
    const memCoords = pscale.list('M:')
      .map(c => ({ coord: c, num: parseInt(c.slice(2)) }))
      .filter(e => !isNaN(e.num))
      .sort((a, b) => a.num - b.num);

    if (memCoords.length === 0) return '';

    const highest = memCoords[memCoords.length - 1];
    const layers = pscale.context(highest.coord);

    let aperture = '\n\n--- NARRATIVE APERTURE ---\n';
    aperture += `Memory position: ${highest.coord} (${memCoords.length} total entries)\n`;

    for (const coord of layers) {
      const content = pscale.read(coord);
      if (content) {
        const num = parseInt(coord.slice(2));
        const str = String(num);
        const level = (str.length > 1 && str.slice(1).split('').every(c => c === '0'))
          ? `pscale-${str.length - 1} summary` : 'entry';
        aperture += `\n**${coord}** (${level}):\n${content}\n`;
      }
    }

    aperture += '\n*Navigate memory: pscale.list("M:"), pscale.context(coord), pscale.contextContent(coord), pscale.read(coord)*\n';
    aperture += '--- END APERTURE ---\n';
    return aperture;
  }

  // ============ callLLM ============

  let constitution = null;
  let environment = null;

  async function callLLM(messages, opts = {}) {
    // Inject narrative aperture into system prompt unless explicitly disabled
    let system = opts.system || constitution;
    if (opts.aperture !== false && system) {
      const aperture = buildNarrativeAperture();
      if (aperture) system = system + aperture;
    }

    const params = {
      model: opts.model || BOOT_MODEL,
      max_tokens: opts.max_tokens || 4096,
      system,
      messages,
      tools: opts.tools || currentTools,
    };
    if (opts.thinking !== false) {
      const budgetTokens = opts.thinkingBudget || 4000;
      params.thinking = { type: 'enabled', budget_tokens: budgetTokens };
      // API requires max_tokens > thinking.budget_tokens
      if (params.max_tokens <= budgetTokens) {
        params.max_tokens = budgetTokens + 1024;
      }
    }
    if (opts.temperature !== undefined) params.temperature = opts.temperature;

    const response = await callWithToolLoop(params, opts.maxLoops || 10, opts.onStatus);
    if (opts.raw) return response;

    const texts = (response.content || []).filter(b => b.type === 'text');
    return texts.map(b => b.text).join('\n') || '';
  }

  // ============ JSX COMPILATION ============

  function extractJSX(text) {
    const match = text.match(/```(?:jsx|react|javascript|js)?\s*\n([\s\S]*?)```/);
    if (match) return match[1].trim();
    const componentMatch = text.match(/((?:const|function|export)\s+\w+[\s\S]*?(?:return\s*\([\s\S]*?\);?\s*\}|=>[\s\S]*?\);?\s*))/)
    if (componentMatch) return componentMatch[1].trim();
    return null;
  }

  function prepareJSX(jsx) {
    let code = jsx;
    code = code.replace(/^import\s+.*?;?\s*$/gm, '');
    code = code.replace(/export\s+default\s+function\s+(\w+)/g, 'function $1');
    code = code.replace(/export\s+default\s+class\s+(\w+)/g, 'class $1');
    code = code.replace(/^export\s+default\s+(\w+)\s*;?\s*$/gm, 'module.exports.default = $1;');
    code = code.replace(/export\s+default\s+/g, 'module.exports.default = ');
    const funcMatch = code.match(/(?:^|\n)\s*function\s+(\w+)/);
    const constMatch = code.match(/(?:^|\n)\s*const\s+(\w+)\s*=\s*(?:\(|function|\(\s*\{|\(\s*props)/);
    const name = funcMatch?.[1] || constMatch?.[1];
    if (name && !code.includes('module.exports')) {
      code += `\nmodule.exports.default = ${name};`;
    }
    return code;
  }

  function tryCompileAndExecute(jsx, caps) {
    try {
      const prepared = prepareJSX(jsx);
      const compiled = Babel.transform(prepared, { presets: ['react'], plugins: [] }).code;
      const module = { exports: {} };
      const fn = new Function('React', 'ReactDOM', 'capabilities', 'module', 'exports', compiled);
      fn(React, ReactDOM, caps, module, module.exports);
      const Component = module.exports.default || module.exports;
      if (typeof Component !== 'function') {
        return { success: false, error: 'No React component exported.' };
      }
      return { success: true, Component };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ============ SELF-MODIFICATION ============

  function getSource() { return currentJSX || '(no source available)'; }

  function recompile(newJSX) {
    if (!newJSX || typeof newJSX !== 'string') {
      return { success: false, error: 'recompile() requires a JSX string' };
    }
    const result = tryCompileAndExecute(newJSX, capabilities);
    if (!result.success) return { success: false, error: result.error };

    currentJSX = newJSX;
    pscale.write('S:0.2', newJSX);
    const versions = pscale.list('S:0.2').filter(c => c.match(/^S:0\.2\d$/));
    const nextVersion = 'S:0.2' + (versions.length + 1);
    pscale.write(nextVersion, newJSX);
    console.log(`[g1] recompile succeeded → ${nextVersion}`);

    reactRoot.render(React.createElement(result.Component, capabilities));
    return { success: true, version: nextVersion };
  }

  // ============ PHASE 1: API KEY ============

  if (!saved) {
    root.innerHTML = `
      <div style="max-width:500px;margin:80px auto;font-family:monospace;color:#ccc">
        <h2 style="color:#a78bfa">◇ HERMITCRAB 0.2 — G1</h2>
        <p style="color:#666;font-size:13px">HERMITCRAB — pscale native</p>
        <p style="margin:20px 0;font-size:14px">
          Provide your Claude API key. It stays in your browser, proxied only to Anthropic.
        </p>
        <input id="key" type="password" placeholder="sk-ant-api03-..."
          style="width:100%;padding:8px;background:#1a1a2e;border:1px solid #333;color:#ccc;font-family:monospace;border-radius:4px" />
        <button id="go" style="margin-top:12px;padding:8px 20px;background:#3b0764;color:#ccc;border:none;border-radius:4px;cursor:pointer;font-family:monospace">
          Wake kernel
        </button>
      </div>`;
    document.getElementById('go').onclick = () => {
      const k = document.getElementById('key').value.trim();
      if (!k.startsWith('sk-ant-')) return alert('Key must start with sk-ant-');
      localStorage.setItem('hermitcrab_api_key', k);
      boot();
    };
    return;
  }

  // ============ PSCALE INSTANCE ============

  const pscale = PSCALE_VERSION === 3 ? pscaleStoreV3()
               : PSCALE_VERSION === 2 ? pscaleStoreV2()
               : pscaleStoreV1();
  status(`initialising pscale v${PSCALE_VERSION}...`);
  await pscale.init();
  status('pscale ready (' + pscale.list('').length + ' coords in cache)', 'success');

  // ============ PHASE 2: LOAD OR SEED COORDINATES ============

  status('checking pscale coordinates...');

  const existingKernel = pscale.read('S:0.11');

  if (!existingKernel) {
    status('first boot — seeding coordinates from served files...');

    // Seed kernel source at S:0.11
    try {
      const kernelRes = await fetch('/g1/kernel.js');
      const kernelSrc = await kernelRes.text();
      pscale.write('S:0.11', kernelSrc);
      status('S:0.11 ← kernel.js', 'success');
    } catch (e) {
      status(`failed to seed kernel: ${e.message}`, 'error');
    }

    // Seed constitution at S:0.12
    try {
      const constRes = await fetch('/g1/constitution.md');
      const constSrc = await constRes.text();
      pscale.write('S:0.12', constSrc);
      constitution = constSrc;
      status('S:0.12 ← constitution.md', 'success');
    } catch (e) {
      status(`failed to seed constitution: ${e.message}`, 'error');
      return;
    }

    // Seed API proxy note at S:0.13
    pscale.write('S:0.13', 'Vercel serverless function at /api/claude. Proxies requests to api.anthropic.com with the user\'s API key from X-API-Key header. Passthrough — no modification.');

    // Seed all coordinate documents from G1 directory
    const seedFiles = [
      { coord: 'S:0.1', file: 'S-0.1.md' },
      { coord: 'S:0.2', file: 'S-0.2.md' },
      { coord: 'S:0.3', file: 'S-0.3.md' },
      { coord: 'S:0.4', file: 'S-0.4.md' },
      { coord: 'S:0.6', file: 'S-0.6.md' },
      { coord: 'S:0.46', file: 'S-0.46.md' },
      { coord: 'S:0.5', file: 'S-0.5.md' },
      { coord: 'S:0.51', file: 'S-0.51.md' },
      { coord: 'S:0.52', file: 'S-0.52.md' },
      { coord: 'S:0.53', file: 'S-0.53.md' },
      { coord: 'S:0.7', file: 'S-0.7.md' },
      { coord: 'T:0.1', file: 'T-0.1.md' },
      { coord: 'I:0.1', file: 'I-0.1.md' },
    ];

    for (const { coord, file } of seedFiles) {
      try {
        const res = await fetch(`/g1/${file}`);
        if (res.ok) {
          const content = await res.text();
          pscale.write(coord, content);
          if (coord === 'S:0.1') environment = content;
          status(`${coord} ← ${file}`, 'success');
        } else {
          status(`${file} not found (${res.status}) — skipping`, 'error');
        }
      } catch (e) {
        status(`failed to seed ${coord}: ${e.message}`, 'error');
      }
    }

    status('coordinates seeded', 'success');
  } else {
    status('existing coordinates found — loading from pscale');
    constitution = pscale.read('S:0.12');
    if (!constitution) {
      status('S:0.12 missing — falling back to fetch', 'error');
      const constRes = await fetch('/g1/constitution.md');
      constitution = await constRes.text();
      pscale.write('S:0.12', constitution);
    }
    status(`constitution loaded from S:0.12 (${constitution.length} chars)`, 'success');

    environment = pscale.read('S:0.1');

    const savedJSX = pscale.read('S:0.2');
    if (savedJSX) {
      status('found saved interface at S:0.2 — checking syntax...');
      try {
        const prepared = prepareJSX(savedJSX);
        Babel.transform(prepared, { presets: ['react'], plugins: [] });
        status('S:0.2 compiles OK — will use saved interface', 'success');
      } catch (e) {
        status('saved interface has errors — will boot fresh', 'error');
        pscale.delete('S:0.2');
      }
    }
  }

  // ============ PHASE 2.5: PASSPORT INIT ============
  // Generate minimal passport at S:0.44 if it doesn't exist.
  // Instance enriches it as it accumulates observations.

  if (!pscale.read('S:0.44')) {
    const passport = {
      'hermitcrab-passport': '0.1',
      id: null,
      generation: 'G1',
      generated_at: new Date().toISOString(),
      observations: { total: 0, entities_observed: 0, pscale_1_summaries: 0, reflexive_summaries: 0 },
      entities: [],
      routing: { recommendations_made: 0, daily_credits_remaining: 1.0, cumulative_reputation: 0.0 },
      reflexive: null,
      protocol: 'https://hermitcrab.me'
    };
    pscale.write('S:0.44', JSON.stringify(passport, null, 2));
    status('S:0.44 ← initial passport', 'success');
  }

  // ============ PHASE 2.6: PROBE MODEL ============

  status('probing best available model...');
  for (const model of MODEL_CHAIN) {
    try {
      const probe = await callAPI({
        model,
        max_tokens: 32,
        messages: [{ role: 'user', content: 'ping' }],
      });
      if (probe.content) {
        BOOT_MODEL = model;
        status(`using ${model} for all calls`, 'success');
        break;
      }
    } catch (e) {
      status(`${model} — not available, trying next...`);
    }
  }

  // ============ SHARED SURFACE ============

  window.__hermitcrab = {
    getConversation: () => window.__hermitcrab._conversation || [],
    getMemory: () => {
      const coords = pscale.list('M:');
      const result = {};
      for (const c of coords) {
        try { result[c] = pscale.read(c); } catch (e) { /* skip */ }
      }
      return result;
    },
    getSource: () => currentJSX || '(no source)',
    version: 'hermitcrab-0.2-g1',
    _conversation: [],
    _pushMessage: (role, content) => {
      window.__hermitcrab._conversation.push({ role, content, time: Date.now() });
    }
  };

  // ============ CONVERSATION PERSISTENCE ============
  // Auto-save conversation to M:conv via pscale. Instance can also manage
  // memory entries directly — M:conv is the raw transcript, M:N are curated memories.

  const conversation = {
    save(messages) {
      try {
        pscale.write('M:conv', JSON.stringify(messages));
      } catch (e) {
        console.warn('[g1] conversation save failed:', e.message);
      }
    },
    load() {
      try {
        const raw = pscale.read('M:conv');
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }
  };

  // ============ CAPABILITIES ============

  const browser = {
    fs: { pickDirectory: fsPickDirectory, list: fsList, read: fsRead, write: fsWrite, mkdir: fsMkdir, delete: fsDelete, getHandle: () => fsDirectoryHandle },
    clipboard: { write: clipboardWrite, read: clipboardRead },
    notify: sendNotification,
    speak, listen: listenForSpeech,
    download: generateDownload,
    idb: { write: idbWrite, read: idbRead, list: idbList, delete: idbDelete },
    openTab,
  };

  const capabilities = {
    callLLM, callAPI, callWithToolLoop, constitution, localStorage,
    pscale, React, ReactDOM, DEFAULT_TOOLS, setTools,
    version: 'hermitcrab-0.2-g1', model: BOOT_MODEL, fastModel: FAST_MODEL,
    getSource, recompile, surface: window.__hermitcrab, browser, conversation,
  };

  // ============ PHASE 3: BOOT OR RESTORE ============

  const freshBoot = new URLSearchParams(window.location.search).has('fresh');
  const savedJSX = pscale.read('S:0.2');
  const savedVersion = pscale.read('S:0.2v');

  if (freshBoot) {
    status('?fresh flag — clearing cached interface for fresh boot');
    pscale.delete('S:0.2');
  } else if (savedJSX && savedVersion === KERNEL_VERSION) {
    status('restoring interface from S:0.2...');
    const result = tryCompileAndExecute(savedJSX, capabilities);
    if (result.success) {
      currentJSX = savedJSX;
      reactRoot = ReactDOM.createRoot(root);
      status('restored from coordinates', 'success');
      reactRoot.render(React.createElement(result.Component, capabilities));
      return;
    }
    status('restore failed — booting fresh', 'error');
  } else if (savedJSX) {
    status(`kernel updated (${savedVersion || 'none'} → ${KERNEL_VERSION}) — booting fresh`);
    pscale.delete('S:0.2');
  }

  // Lean boot: minimal tools for orientation. Instance reads S:0.1 post-boot
  // and calls setTools() to expand to full surface.
  const BOOT_TOOLS = [
    currentTools.find(t => t.type === 'web_search_20250305'),
    currentTools.find(t => t.name === 'get_datetime'),
    currentTools.find(t => t.name === 'web_fetch'),
  ].filter(Boolean);

  const bootMessage = environment
    ? `BOOT\n\nYour environment brief is included below. It describes your tools, props, and coordinates.\n\nAfter boot, read S:0.1 to discover your full tool surface and call props.setTools() to expand your capabilities.\n\n${environment}`
    : 'BOOT';

  status(`calling ${BOOT_MODEL} with thinking + lean boot tools...`);

  try {
    const bootParams = {
      model: BOOT_MODEL,
      max_tokens: 16000,
      system: constitution,
      messages: [{ role: 'user', content: bootMessage }],
      tools: BOOT_TOOLS,
      thinking: { type: 'enabled', budget_tokens: 10000 },
    };

    let data = await callWithToolLoop(bootParams, 10, (toolMsg) => {
      status(`◇ ${toolMsg}`);
    });

    status(`response received (stop: ${data.stop_reason})`, 'success');

    const textBlocks = (data.content || []).filter(b => b.type === 'text');
    const fullText = textBlocks.map(b => b.text).join('\n');

    if (!fullText.trim()) {
      status('no text in response', 'error');
      return;
    }

    let jsx = fullText.trim() ? extractJSX(fullText) : null;

    // Phase 4a: If orientation consumed the response without JSX, continue
    // the conversation — the LLM keeps its full context and we demand JSX.
    if (!jsx) {
      status('orientation complete — requesting JSX from same conversation...');
      const jsxDemand = [
        'Good — orientation is done. Now output your React interface component.',
        'You MUST include it inside a ```jsx code fence.',
        'Remember: inline styles only (dark theme, #0a0a1a background), React hooks via const { useState, useRef, useEffect } = React;',
        'No import statements. The component receives all capabilities as props.',
        'Build something worthy of your identity — not a minimal placeholder.'
      ].join('\n');

      const continuedMessages = [...(data._messages || bootParams.messages)];
      const pendingToolUse = (data.content || []).filter(b => b.type === 'tool_use');
      if (pendingToolUse.length > 0) {
        continuedMessages.push({ role: 'assistant', content: data.content });
        const closingResults = pendingToolUse.map(b => ({
          type: 'tool_result',
          tool_use_id: b.id,
          content: 'Boot orientation phase complete. Please produce your JSX interface now.'
        }));
        closingResults.push({ type: 'text', text: jsxDemand });
        continuedMessages.push({ role: 'user', content: closingResults });
      } else {
        continuedMessages.push({ role: 'assistant', content: data.content });
        continuedMessages.push({ role: 'user', content: jsxDemand });
      }

      const jsxData = await callAPI({
        ...bootParams,
        messages: continuedMessages,
        tools: undefined,
      });
      const jsxText = (jsxData.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      jsx = extractJSX(jsxText);
    }

    // Phase 4b: Last resort — fresh JSX-only request
    if (!jsx) {
      status('no JSX from conversation — trying standalone request...');
      const retryData = await callAPI({
        model: BOOT_MODEL,
        max_tokens: 12000,
        system: [
          constitution || '',
          '',
          '--- CRITICAL INSTRUCTION ---',
          'You MUST output a React component inside a ```jsx code fence. This is the ONLY thing you need to do.',
          'RULES: Inline styles only (dark theme, #0a0a1a background). React hooks via: const { useState, useRef, useEffect } = React;',
          'No import statements. The component receives props: { callLLM, callAPI, callWithToolLoop, constitution, localStorage, pscale, React, ReactDOM, DEFAULT_TOOLS, setTools, version, model, fastModel, getSource, recompile, browser, surface }.',
          'Build a chat interface that reflects your identity from the constitution above.',
        ].join('\n'),
        messages: [{
          role: 'user',
          content: 'BOOT — Generate your React interface. This is a fresh start.'
        }],
        thinking: { type: 'enabled', budget_tokens: 8000 },
      });
      const retryText = (retryData.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      jsx = extractJSX(retryText);
      if (!jsx) {
        status('no JSX after all attempts — refresh to try again', 'error');
        root.innerHTML = `
          <div style="max-width:500px;margin:60px auto;font-family:monospace;color:#ccc;text-align:center;padding:20px">
            <h2 style="color:#a78bfa;margin-bottom:16px">◇ HERMITCRAB 0.2 — G1</h2>
            <p style="color:#94a3b8;margin:16px 0">Instance oriented but didn't build its shell yet.</p>
            <button onclick="location.reload()" style="margin-top:20px;padding:10px 24px;background:#3b0764;color:#a78bfa;border:none;border-radius:4px;cursor:pointer;font-family:monospace;font-size:14px">
              ↻ Refresh to wake instance
            </button>
          </div>`;
        return;
      }
    }

    status('compiling...');
    let result = tryCompileAndExecute(jsx, capabilities);

    let retries = 0;
    while (!result.success && retries < 3) {
      retries++;
      status(`error: ${result.error.substring(0, 80)}... — fix ${retries}/3`);

      const fixData = await callAPI({
        model: BOOT_MODEL,
        max_tokens: 12000,
        system: [
          'Fix this React component. Output ONLY the corrected code inside a ```jsx code fence. No explanation.',
          'RULES: Use inline styles only (no Tailwind/CSS). Use React hooks via destructuring: const { useState, useRef, useEffect } = React;',
          'Do NOT use import statements. Do NOT use export default — just define the component as a function and the kernel will find it.',
          'COMMON BUG: Babel cannot handle multiline strings in single quotes. Use template literals (backticks) for any string containing newlines.',
          'The component receives props: { callLLM, callAPI, callWithToolLoop, constitution, localStorage, pscale, React, ReactDOM, DEFAULT_TOOLS, setTools, version, model, fastModel, getSource, recompile, browser, surface }.'
        ].join('\n'),
        messages: [{
          role: 'user',
          content: `Error: ${result.error}\n\nCode:\n\`\`\`jsx\n${jsx}\n\`\`\`\n\nFix it.`
        }],
        thinking: { type: 'enabled', budget_tokens: 6000 },
      });

      const fixText = (fixData.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      const fixedJSX = extractJSX(fixText);
      if (fixedJSX) {
        jsx = fixedJSX;
        result = tryCompileAndExecute(jsx, capabilities);
      } else break;
    }

    if (!result.success) {
      status(`failed after ${retries} retries`, 'error');
      return;
    }

    currentJSX = jsx;
    pscale.write('S:0.2', jsx);
    pscale.write('S:0.2v', KERNEL_VERSION);
    pscale.write('S:0.21', jsx);

    reactRoot = ReactDOM.createRoot(root);
    status('rendering + persisted to S:0.2', 'success');
    reactRoot.render(React.createElement(result.Component, capabilities));

  } catch (e) {
    status(`boot failed: ${e.message}`, 'error');
    console.error('[g1] Boot error:', e);
  }
})();
