// HERMITCRAB MÖBIUS — Minimal Kernel
// The reflexive spine IS the program. BSP is the only navigation.
// Wake-driven: the kernel reads wake for ALL decisions.
// The twist: tool call → block mutation → recompile currents → new API call.

(async function boot() {
  const root = document.getElementById('root');
  const STORE = 'hc:';
  // Concern-scoped conversation keys. Path is the concern tree address (e.g. "2.1.1.1").
  // Using path not name — name is descriptive text, path is structurally unique.
  function convKey(concernPath) {
    const p = (typeof concernPath === 'string' && concernPath) ? concernPath : 'default';
    return 'hc_conv_' + p;
  }
  const CONV_KEY_LEGACY = 'hc_conversation';

  // ═══════ §1 BLOCK STORAGE ═══════

  function blockLoad(name) {
    if (typeof name === 'object' && name !== null) return name;
    const raw = localStorage.getItem(STORE + name);
    return raw ? JSON.parse(raw) : null;
  }

  function blockSave(name, block) {
    localStorage.setItem(STORE + name, JSON.stringify(block));
    if (_ctx) _ctx.changed.add(name);
  }

  function blockList() {
    const names = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(STORE) && !key.startsWith(STORE + '_')) names.push(key.slice(STORE.length));
    }
    return names;
  }

  function blockView(block, view) {
    if (view === 'skeleton' && block.skeleton) return { ...block, tree: block.skeleton };
    if (view === 'mask' && block.mask) return { ...block, tree: block.mask };
    return block;
  }

  // ═══════ §2 BSP — Block · Spindle · Point ═══════

  function blockNavigate(block, path) {
    if (!path) return block.tree;
    const keys = path.split('.');
    let node = block.tree;
    for (const k of keys) {
      if (node === null || node === undefined || typeof node === 'string') return null;
      node = node[k];
    }
    return node;
  }

  function blockReadNode(block, path) {
    const node = blockNavigate(block, path);
    if (node === null || node === undefined) return { error: `Path ${path} not found` };
    if (typeof node === 'string') return { content: node };
    const result = { content: node._ || null, children: {} };
    for (const [k, v] of Object.entries(node)) {
      if (k === '_') continue;
      if (typeof v === 'string') result.children[k] = v;
      else if (v && typeof v === 'object') result.children[k] = v._ || '(branch)';
    }
    return result;
  }

  function blockWriteNode(block, path, content) {
    const keys = path.split('.');
    const last = keys.pop();
    let node = block.tree;
    for (const k of keys) {
      if (typeof node[k] === 'string') node[k] = { _: node[k] };
      if (!node[k]) node[k] = {};
      node = node[k];
    }
    if (content === null || content === undefined) {
      delete node[last];
    } else if (node[last] && typeof node[last] === 'object') {
      node[last]._ = content;
    } else {
      node[last] = content;
    }
    return { success: true };
  }

  function xSpread(block, path) {
    const blk = typeof block === 'string' ? blockLoad(block) : block;
    if (!blk) return null;
    const node = path ? blockNavigate(blk, path) : blk.tree;
    if (node === null || node === undefined) return null;
    if (typeof node === 'string') return { text: node, children: [] };
    const text = node._ || null;
    const children = [];
    for (const [k, v] of Object.entries(node)) {
      if (k === '_') continue;
      const childText = typeof v === 'string' ? v : (v && typeof v === 'object' && v._) ? v._ : null;
      children.push({ digit: k, text: childText, branch: typeof v === 'object' && v !== null });
    }
    return { text, children };
  }

  function getTuningDecimalPosition(blk) {
    if (!blk || !blk.tuning) return null;
    const parts = String(blk.tuning).split('.');
    const intStr = parts[0] || '0';
    return intStr === '0' ? 0 : intStr.length;
  }

  function getCompressionDepth(tree) {
    let depth = 0;
    let node = tree;
    while (node && typeof node === 'object' && node['0'] !== undefined) {
      depth++;
      node = node['0'];
    }
    return depth;
  }

  function bsp(block, spindle, point, fn) {
    const blk = typeof block === 'string' ? blockLoad(block) : block;

    // Mode: reference — bsp(block, 'ref')
    if (spindle === 'ref') {
      return { mode: 'ref', block: typeof block === 'string' ? block : null };
    }

    if (!blk || !blk.tree) return { mode: 'dir', tree: {} };

    // Mode: dir (full) — bsp(block) with no other args
    if (spindle == null && point == null && fn == null) {
      return { mode: 'dir', tree: blk.tree };
    }

    // Parse semantic number
    let walkDigits, hasPscale, digitsBefore;
    if (spindle == null) {
      walkDigits = [];
      hasPscale = true;
      const tuningDecimal = getTuningDecimalPosition(blk);
      digitsBefore = tuningDecimal !== null ? tuningDecimal : 0;
    } else {
      const str = typeof spindle === 'number' ? spindle.toFixed(10) : String(spindle);
      const parts = str.split('.');
      const intStr = parts[0] || '0';
      const fracStr = (parts[1] || '').replace(/0+$/, '');
      const isDelineation = intStr === '0';
      walkDigits = isDelineation
        ? fracStr.split('').filter(c => c.length > 0)
        : (intStr + fracStr).split('');
      hasPscale = isDelineation || fracStr.length > 0;
      const spindleTreeDepth = isDelineation ? 0 : intStr.length;
      const tuningDecimal = getTuningDecimalPosition(blk);
      digitsBefore = tuningDecimal !== null ? tuningDecimal : (isDelineation ? 0 : (hasPscale ? intStr.length : -1));
      if (tuningDecimal !== null) hasPscale = true;

      // Tuning fork compensation
      if (tuningDecimal !== null) {
        const needed = Math.max(0, tuningDecimal - spindleTreeDepth);
        if (needed > 0) {
          const maxComp = getCompressionDepth(blk.tree);
          const zeros = Math.min(needed, maxComp);
          if (zeros > 0) walkDigits = Array(zeros).fill('0').concat(walkDigits);
        }
      }
    }

    // Build spindle — root always included
    const nodes = [];
    let node = blk.tree;
    const rootText = (typeof node === 'object' && node !== null && typeof node['_'] === 'string')
      ? node['_'] : null;
    if (rootText !== null) {
      nodes.push({ pscale: hasPscale ? digitsBefore : null, text: rootText });
    }

    for (let i = 0; i < walkDigits.length; i++) {
      const d = walkDigits[i];
      if (!node || typeof node !== 'object' || node[d] === undefined) break;
      node = node[d];
      const text = typeof node === 'string'
        ? node
        : (typeof node === 'object' && node !== null && typeof node['_'] === 'string')
          ? node['_']
          : JSON.stringify(node);
      nodes.push({ pscale: hasPscale ? (digitsBefore - 1) - i : null, digit: d, text });
    }

    // Mode: ring — siblings at terminal point (no spindle)
    if (point === 'ring') {
      if (walkDigits.length === 0) return { mode: 'ring', siblings: [] };
      const parentPath = walkDigits.length > 1 ? walkDigits.slice(0, -1).join('.') : null;
      const terminalDigit = walkDigits[walkDigits.length - 1];
      const parentNode = parentPath ? blockNavigate(blk, parentPath) : blk.tree;
      if (!parentNode || typeof parentNode !== 'object') return { mode: 'ring', siblings: [] };
      const siblings = [];
      for (let d = 0; d <= 9; d++) {
        const k = String(d);
        if (k === terminalDigit || parentNode[k] === undefined) continue;
        const v = parentNode[k];
        const childText = typeof v === 'string' ? v : (v && typeof v === 'object' && v._) ? v._ : null;
        siblings.push({ digit: k, text: childText, branch: typeof v === 'object' && v !== null });
      }
      return { mode: 'ring', siblings };
    }

    // Mode: dir (subtree) — bsp(block, spindle, 'dir')
    if (point === 'dir') {
      const endPath = walkDigits.length > 0 ? walkDigits.join('.') : null;
      const endNode = endPath ? blockNavigate(blk, endPath) : blk.tree;
      return { mode: 'dir', path: endPath, subtree: endNode || null };
    }

    // Mode: disc — transversal at pscale, block-wide
    if (fn === 'disc' && point != null) {
      const pscale = typeof point === 'string' ? Number(point) : point;
      const tuningDecimal = getTuningDecimalPosition(blk);
      const refDecimal = tuningDecimal !== null ? tuningDecimal : digitsBefore;
      const targetDepth = refDecimal - pscale;
      if (targetDepth < 0) return { mode: 'disc', pscale, nodes: [] };
      const discNodes = [];
      function walkDisc(n, depth, path) {
        if (depth === targetDepth) {
          const text = typeof n === 'string' ? n
            : (n && typeof n === 'object' && typeof n._ === 'string') ? n._
            : null;
          discNodes.push({ path, text });
          return;
        }
        if (!n || typeof n !== 'object') return;
        for (let d = 0; d <= 9; d++) {
          const k = String(d);
          if (n[k] !== undefined) walkDisc(n[k], depth + 1, path ? `${path}.${k}` : k);
        }
      }
      walkDisc(blk.tree, 0, '');
      return { mode: 'disc', pscale, nodes: discNodes };
    }

    if (nodes.length === 0) return { mode: 'spindle', nodes: [] };

    // Mode: point — single node at pscale level
    if (point != null && fn == null) {
      const p = typeof point === 'string' ? Number(point) : point;
      if (isNaN(p)) return { mode: 'error', error: `Unknown mode: ${point}` };
      const target = nodes.find(n => n.pscale === p);
      if (target) return { mode: 'point', text: target.text, pscale: target.pscale };
      const last = nodes[nodes.length - 1];
      return { mode: 'point', text: last.text, pscale: last.pscale };
    }

    return { mode: 'spindle', nodes };
  }

  function resolveBlock(block, maxDepth) {
    maxDepth = maxDepth || 3;
    function walk(node, depth, path) {
      if (depth > maxDepth) return null;
      if (typeof node === 'string') return { path, text: node };
      if (!node) return null;
      const result = { path, text: node._ || null, children: [] };
      for (const [k, v] of Object.entries(node)) {
        if (k === '_') continue;
        const child = walk(v, depth + 1, path ? `${path}.${k}` : k);
        if (child) result.children.push(child);
      }
      return result;
    }
    return walk(block.tree, 0, '');
  }

  function findUnoccupiedDigit(block, path) {
    const node = path ? blockNavigate(block, path) : block.tree;
    if (!node || typeof node === 'string') return { digit: '1', note: 'Node is leaf — will become branch' };
    for (let d = 1; d <= 9; d++) {
      if (!node[String(d)]) return { digit: String(d) };
    }
    return { full: true, note: 'Digits 1-9 all occupied — compression needed' };
  }

  function checkCompression(block, path) {
    const node = path ? blockNavigate(block, path) : block.tree;
    if (!node || typeof node === 'string') return { needed: false };
    let occupied = 0;
    for (let d = 1; d <= 9; d++) {
      if (node[String(d)] !== undefined) occupied++;
    }
    return { needed: occupied >= 9, occupied };
  }

  // ═══════ §2.6 HISTORY TREE — growth compression ═══════
  // History is a growth tree (whole numbers, not 0.x decomposition).
  // Entries fill digits 1-9 at the deepest active level.
  // When a level fills, Haiku compresses 9 entries → _ summary.
  // The summary goes to _ of the node containing the entries.
  // Cascade: if compression seals a parent level, compress that too.
  // Root overflow: wrap entire tree into child 0, grow tuning fork.
  // Address odometer: 1-9 → compress to 10, next at 11.
  // 11-19 → compress to 20, next at 21. Through 99 → compress to 100, next at 101.

  function findHistoryWritePosition(block) {
    // Walk the tree to find the active writing edge.
    // The rightmost branch at each level leads to the active leaf.
    // A node is "sealed" if it has _ AND all digits 1-9 occupied.
    function isSealed(node) {
      if (!node || typeof node !== 'object') return false;
      if (!node._) return false;
      for (let d = 1; d <= 9; d++) {
        if (node[String(d)] === undefined) return false;
      }
      return true;
    }

    function walk(node, path) {
      if (!node || typeof node !== 'object') return { path: path ? path + '.1' : '1' };

      // Find the highest occupied digit (1-9) and first free digit (1-9)
      let lastOccupied = 0;
      let firstFree = 0;
      for (let d = 1; d <= 9; d++) {
        if (node[String(d)] !== undefined) lastOccupied = d;
        else if (!firstFree) firstFree = d;
      }

      if (lastOccupied === 0) {
        // Empty node — write at digit 1
        return { path: path ? path + '.1' : '1' };
      }

      const lastChild = node[String(lastOccupied)];

      // If last child is a string (leaf/content), we're at the content level
      if (typeof lastChild === 'string') {
        if (firstFree) {
          return { path: path ? path + '.' + firstFree : String(firstFree) };
        }
        // All 9 full at content level — needs compression
        return { full: true, path: path || '' };
      }

      // Last child is a branch
      if (isSealed(lastChild)) {
        if (firstFree) {
          // Free digit available — start new branch there, descend to match depth
          const nextDigit = String(firstFree);
          let newPath = path ? path + '.' + nextDigit : nextDigit;
          // Descend to the content level (match sealed branch depth)
          let depth = 0;
          let probe = lastChild;
          while (probe && typeof probe === 'object') {
            let hasDigitChild = false;
            for (let d = 1; d <= 9; d++) {
              if (probe[String(d)] !== undefined) { probe = probe[String(d)]; hasDigitChild = true; break; }
            }
            if (!hasDigitChild) break;
            depth++;
          }
          for (let i = 1; i < depth; i++) newPath += '.1';
          return { path: newPath };
        }
        // All 9 sealed — this level needs compression
        return { full: true, path: path || '' };
      }

      // Branch is open (not sealed) — recurse into it
      const childPath = path ? path + '.' + lastOccupied : String(lastOccupied);
      return walk(lastChild, childPath);
    }

    return walk(block.tree, '');
  }

  async function compressHistoryNode(block, path) {
    // Compress 9 entries at `path` via Haiku → write summary to _ at that node.
    // Then check if the parent level is now full → cascade.
    // On root overflow → wrap tree into child 0, grow tuning fork.
    const node = path ? blockNavigate(block, path) : block.tree;
    if (!node || typeof node !== 'object') return;

    // Gather entries
    const entries = [];
    for (let d = 1; d <= 9; d++) {
      const child = node[String(d)];
      if (child === undefined) continue;
      const text = typeof child === 'string' ? child : (child && child._) ? child._ : '(branch)';
      entries.push(`${d}: ${text}`);
    }

    if (entries.length < 9) return; // Not full

    // Call Haiku for compression
    try {
      const inv = readInvocation(1); // Tier 1 = Haiku
      const res = await callAPI({
        model: inv.model,
        max_tokens: 2048,
        system: 'You are a compression engine for a history log. Summarise these 9 entries into a single concise paragraph that preserves the essential arc and any important details. Return only the compressed text.',
        messages: [{ role: 'user', content: entries.join('\n') }],
        ...invMeta(inv),
      });
      const summary = (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      if (!summary) return;

      // Write summary to _ at this node (direct assignment, not blockWriteNode)
      if (path) {
        const target = blockNavigate(block, path);
        if (target && typeof target === 'object') target._ = summary;
      } else {
        if (typeof block.tree === 'string') block.tree = { _: summary };
        else block.tree._ = summary;
      }

      console.log(`[möbius] history compression at ${path || 'root'}: ${summary.slice(0, 80)}...`);

      // Check if parent level is now full → cascade
      if (path) {
        const parentKeys = path.split('.');
        if (parentKeys.length > 1) {
          const parentPath = parentKeys.slice(0, -1).join('.');
          const parentNode = blockNavigate(block, parentPath);
          if (parentNode && typeof parentNode === 'object') {
            let parentFull = true;
            for (let d = 1; d <= 9; d++) {
              const sibling = parentNode[String(d)];
              if (!sibling || typeof sibling !== 'object' || !sibling._) { parentFull = false; break; }
              // Check all 9 children exist in sibling
              let siblingSealed = true;
              for (let dd = 1; dd <= 9; dd++) {
                if (sibling[String(dd)] === undefined) { siblingSealed = false; break; }
              }
              if (!siblingSealed) { parentFull = false; break; }
            }
            if (parentFull) {
              await compressHistoryNode(block, parentPath);
            }
          }
        } else {
          // Parent is root — check if root is full
          let rootFull = true;
          for (let d = 1; d <= 9; d++) {
            const child = block.tree[String(d)];
            if (!child || typeof child !== 'object' || !child._) { rootFull = false; break; }
            let sealed = true;
            for (let dd = 1; dd <= 9; dd++) {
              if (child[String(dd)] === undefined) { sealed = false; break; }
            }
            if (!sealed) { rootFull = false; break; }
          }
          if (rootFull) {
            await compressHistoryNode(block, '');
          }
        }
      } else {
        // We just compressed root — need to wrap into child 0
        // Move entire tree content (digits 1-9 + _) under child 0
        const wrapped = {};
        for (const [k, v] of Object.entries(block.tree)) {
          wrapped[k] = v;
        }
        // Clear root digits, keep only the new child 0
        for (let d = 1; d <= 9; d++) {
          delete block.tree[String(d)];
        }
        block.tree['0'] = wrapped;
        block.tree._ = wrapped._ || '';

        // Grow tuning fork: "8" → "88" → "888"
        const currentTuning = String(block.tuning || '8');
        const tuningDigit = currentTuning.split('.')[0][0] || '8';
        block.tuning = tuningDigit.repeat(currentTuning.split('.')[0].length + 1);

        console.log(`[möbius] history root overflow — tree wrapped to child 0, tuning now ${block.tuning}`);
      }
    } catch (e) {
      console.error('[möbius] history compression failed:', e);
    }
  }

  // ═══════ §3 WAKE + CONCERN READER ═══════
  // Concerns block: stimulus routing, temporal state, ripe set.
  // Wake block: spine instructions (wake.1), packages and invocation (wake.9).

  // Find concern: walk concerns block, match on stimulus field.
  // Tier derived from pscale depth. Spine stored on the node.
  // Returns path so caller can update `last` to record loop state.
  function findConcern(stimulus) {
    const concerns = blockLoad('concerns');
    if (!concerns || !concerns.tree) return { spindle: '0.1211111', tier: 2, name: 'user' };
    const tuningDecimal = getTuningDecimalPosition(concerns) || 9;
    let found = null;
    function walk(node, depth, path) {
      if (!node || typeof node !== 'object' || found) return;
      for (const [k, v] of Object.entries(node)) {
        if (!/^\d$/.test(k)) continue;
        if (!v || typeof v !== 'object') continue;
        const childPath = path ? `${path}.${k}` : k;
        if (v.stimulus && v.stimulus.toLowerCase() === stimulus.toLowerCase()) {
          const pscale = tuningDecimal - (depth + 1);
          found = {
            spindle: v.spine || '0.1211111',
            tier: tierFromPscale(pscale),
            name: v._ || stimulus,
            immediate: !!v.immediate,
            focus: v.focus || null,
            package: v.package || null,
            tools: v.tools || null,
            pscale,
            path: childPath
          };
          return;
        }
        walk(v, depth + 1, childPath);
      }
    }
    walk(concerns.tree, 0, '');
    return found || { spindle: '0.1211111', tier: 2, name: 'user' };
  }

  // Read package entries: wake.9.{tier} → list of BSP instructions.
  // If overrideAddr provided (e.g. "3.1" for birth), use that address instead.
  function readPackage(tier, overrideAddr) {
    const wake = blockLoad('wake');
    if (!wake) return [];
    const addr = overrideAddr || ('9.' + tier);
    const spread = xSpread(wake, addr);
    if (!spread) return [];
    return spread.children.filter(c => c.text).map(c => c.text);
  }

  // Read invocation params: wake.9.{tier+3} → { model, max_tokens, thinking? }
  function readInvocation(tier) {
    const wake = blockLoad('wake');
    if (!wake) return { model: 'claude-sonnet-4-6', max_tokens: 16384 };
    const spread = xSpread(wake, '9.' + (tier + 3));
    if (!spread) return { model: 'claude-sonnet-4-6', max_tokens: 16384 };
    const params = {};
    for (const child of spread.children) {
      if (child.text) {
        const idx = child.text.indexOf(' ');
        if (idx > 0) params[child.text.substring(0, idx)] = child.text.substring(idx + 1);
      }
    }
    const result = {
      model: params.model || 'claude-sonnet-4-6',
      max_tokens: parseInt(params.max_tokens) || 16384,
    };
    if (params.thinking) {
      const parts = params.thinking.split(' ');
      if (parts[0] === 'enabled' && parts[1]) {
        result.thinking = { type: 'enabled', budget_tokens: parseInt(parts[1]) };
      }
    }
    // Proxy routing: provider, key cookie, URL cookie, translate mode, model cookie
    if (params.provider === 'proxy') {
      result.provider = 'proxy';
      result.proxy_key = params.proxy_key;
      result.proxy_url = params.proxy_url;
      result.translate = params.translate || 'openai';
      if (params.model_cookie) result.model_cookie = params.model_cookie;
    }
    return result;
  }

  // Extract proxy routing metadata from invocation as underscore-prefixed fields
  // (callAPI strips underscore keys before building the request body)
  function invMeta(inv) {
    if (inv.provider !== 'proxy') return {};
    return { _provider: 'proxy', _proxy_key: inv.proxy_key, _proxy_url: inv.proxy_url,
             _translate: inv.translate, _model_cookie: inv.model_cookie };
  }

  // Update echo state: write to the spine at depth 4 of the active spindle
  // The spindle address encodes the path — first 4 digits are the echo node
  function updateEchoState(spindle, echo, changed) {
    const wake = blockLoad('wake');
    if (!wake) return;
    // Parse spindle to get path digits: 0.1211111 → [1,2,1,1,1,1,1] → first 4 = 1.2.1.1
    const str = typeof spindle === 'number' ? spindle.toFixed(10) : String(spindle);
    const parts = str.split('.');
    const fracStr = (parts[1] || '').replace(/0+$/, '');
    const digits = fracStr.split('');
    if (digits.length < 4) return;
    const echoPath = '1.' + digits.slice(0, 3).join('.');
    // Write echo state into the spine — this is the ONLY mutable node
    const changedStr = changed.size > 0 ? [...changed].join(', ') : 'none';
    const node = blockNavigate(wake, echoPath);
    if (node && typeof node === 'object') {
      node._ = `Echo ${echo}. Blocks changed: ${changedStr}.`;
      blockSave('wake', wake);
    }
  }

  // Read a birth description from a variant address. Form-agnostic:
  // - Leaf node: spindle context + the leaf text.
  // - Branch node with children: spindle context + _ text + all children (digits 1-9 in order).
  // Returns null if the address doesn't fully resolve (truncated spindle = missing content).
  function readVariantStimulus(block, address) {
    const result = bsp(block, address);
    if (result.mode !== 'spindle' || result.nodes.length === 0) return null;
    // Detect truncated spindle: count expected digits from the address.
    // For delineation (0.xxxx), walk digits = fractional part stripped of trailing zeros.
    const addrStr = String(address);
    const parts = addrStr.split('.');
    const fracStr = (parts[1] || '').replace(/0+$/, '');
    const expectedNodes = fracStr.length + 1; // root + each digit
    if (result.nodes.length < expectedNodes) return null; // walk didn't complete
    const texts = result.nodes.map(n => n.text);
    // Check if the terminal node is a branch with children
    const subtree = bsp(block, address, 'dir');
    if (subtree.mode === 'dir' && subtree.subtree && typeof subtree.subtree === 'object') {
      // Collect children in digit order (1-9), skipping _
      for (let d = 1; d <= 9; d++) {
        const child = subtree.subtree[String(d)];
        if (child === undefined) continue;
        const childText = typeof child === 'string' ? child : (child && child._) ? child._ : null;
        if (childText) texts.push(childText);
      }
    }
    return texts.join('\n');
  }

  // Get birth stimulus: reads resolution chain from wake.3 instead of hardcoding.
  // Priority: custom text (UI) > variant resolved via wake.3.5 addresses > wake.3.2 fallback.
  function getBirthStimulus() {
    const custom = localStorage.getItem('hermitcrab_birth_custom');
    if (custom) {
      localStorage.removeItem('hermitcrab_birth_custom');
      return custom;
    }
    const wake = blockLoad('wake');
    // Determine variant: stored > URL param > wake.3.4 default
    const storedBv = localStorage.getItem('hermitcrab_birth_variant');
    const urlBv = new URLSearchParams(window.location.search).get('bv');
    let variant = storedBv ? parseInt(storedBv) : (urlBv ? parseInt(urlBv) : 0);
    if (!variant && wake) {
      const defaultStr = blockNavigate(wake, '3.4');
      if (typeof defaultStr === 'string') {
        const match = defaultStr.match(/birth_variant:\s*(\d)/);
        if (match) variant = parseInt(match[1]);
      }
    }
    if (!variant) variant = 4;
    // Resolve via wake.3.5: each child is a BSP base address to try with variant appended
    if (wake) {
      const resolvers = blockNavigate(wake, '3.5');
      if (resolvers && typeof resolvers === 'object') {
        for (let d = 1; d <= 9; d++) {
          const baseAddr = resolvers[String(d)];
          if (typeof baseAddr !== 'string') continue;
          const [blockName, addr] = baseAddr.split(/\s+/);
          const block = blockLoad(blockName);
          if (!block) continue;
          const stimulus = readVariantStimulus(block, (addr || '0.') + variant);
          if (stimulus) return stimulus;
        }
      }
    }
    // Fallback from wake.3.2
    if (wake) {
      const fallback = blockNavigate(wake, '3.2');
      if (typeof fallback === 'string') return fallback;
    }
    return 'You exist. Your blocks are your shell. Read, then build.';
  }

  // ═══════ §3.5 PHASE FUNCTION — Fourier concern evaluation ═══════
  // The concern block IS the frequency domain. Depth IS temporal scale.
  // No period map: pscale level → seconds via standard temporal mapping.
  // Walk recursively, check phase at every node with a `last` field.

  function whatsRipe(nowSeconds) {
    const concerns = blockLoad('concerns');
    if (!concerns || !concerns.tree) return [];
    const mask = concerns.mask || {};
    const tuningDecimal = getTuningDecimalPosition(concerns) || 9;
    const periods = concerns.periods || {};
    const ripe = [];
    function walk(node, maskNode, depth, path) {
      if (!node || typeof node !== 'object') return;
      for (const [k, v] of Object.entries(node)) {
        if (!/^\d$/.test(k) || !v || typeof v !== 'object') continue;
        const childPath = path ? `${path}.${k}` : k;
        const pscale = tuningDecimal - (depth + 1);
        const m = (maskNode && maskNode[k]) || {};
        if (m.last !== undefined && !v.immediate) {
          const period = periods[pscale];
          if (period) {
            const phase = (nowSeconds - (m.last || 0)) / period;
            if (phase >= 1.0) {
              ripe.push({ path: childPath, phase, text: v._ || childPath, spine: v.spine, pscale, focus: v.focus || null, package: v.package || null });
            }
          }
        }
        walk(v, m, depth + 1, childPath);
      }
    }
    walk(concerns.tree, mask, 0, '');
    ripe.sort((a, b) => b.phase - a.phase);
    return ripe;
  }

  function maskNavigate(block, path) {
    if (!block.mask || !path) return null;
    const keys = path.split('.');
    let node = block.mask;
    for (const k of keys) {
      if (!node || typeof node !== 'object') return null;
      node = node[k];
    }
    return node || null;
  }

  function maskWrite(block, path, key, value) {
    if (!block.mask) block.mask = {};
    const keys = path.split('.');
    let node = block.mask;
    for (const k of keys) {
      if (!node[k] || typeof node[k] !== 'object') node[k] = {};
      node = node[k];
    }
    node[key] = value;
  }

  function updateConcernTimestamp(path, nowSeconds) {
    const concerns = blockLoad('concerns');
    if (!concerns) return;
    maskWrite(concerns, path, 'last', Math.floor(nowSeconds));
    blockSave('concerns', concerns);
  }

  // Reset birth concern: clear its last timestamp so findNeverFired picks it up again.
  // Used when warm boot fails to restore a shell — triggers rebirth.
  function tierFromPscale(pscale) {
    // Tier thresholds read from concerns block. Sorted descending so first match wins.
    const concerns = blockLoad('concerns');
    const tiers = concerns?.tiers || {};
    const tierMap = { deep: 3, present: 2, light: 1 };
    const thresholds = Object.keys(tiers).map(Number).sort((a, b) => b - a);
    for (const t of thresholds) {
      if (pscale >= t) return tierMap[tiers[String(t)]] || 1;
    }
    return 1;
  }

  // ═══════ §4 CURRENTS COMPILER ═══════
  // BSP each package entry → system prompt sections.
  // The spine spindle is the primary orienting current.

  function parseInstruction(instr) {
    const parts = instr.trim().split(/\s+/);
    // "block skeleton" → compile skeleton view instead of tree
    if (parts.length === 2 && parts[1] === 'skeleton') {
      return { blockName: parts[0], spindle: undefined, point: undefined, fn: undefined, skeleton: true };
    }
    const arg2 = parts.length > 1 ? parts[1] : undefined;
    const arg3 = parts.length > 2 ? parts[2] : undefined;
    const arg4 = parts.length > 3 ? parts[3] : undefined;
    return {
      blockName: parts[0],
      spindle: arg2 === 'ref' ? 'ref' : arg2 === 'null' ? null : (arg2 !== undefined ? parseFloat(arg2) : undefined),
      point: (arg3 === 'ring' || arg3 === 'dir' || arg3 === 'bulb') ? arg3 : (arg3 !== undefined ? parseFloat(arg3) : undefined),
      fn: arg4 === 'disc' ? 'disc' : undefined
    };
  }

  function formatBlockContent(block) {
    const lines = [];
    function render(node, depth) {
      if (typeof node === 'string') { lines.push('  '.repeat(depth) + node); return; }
      if (!node || typeof node !== 'object') return;
      if (node._) lines.push('  '.repeat(depth) + node._);
      for (const [k, v] of Object.entries(node)) {
        if (k === '_') continue;
        if (typeof v === 'string') lines.push('  '.repeat(depth) + `${k}: ${v}`);
        else { lines.push('  '.repeat(depth) + `${k}:`); render(v, depth + 1); }
      }
    }
    render(block.tree, 0);
    return lines.join('\n');
  }

  // History bulb: spindle from root to active write position + ring of siblings.
  // Logarithmic continuity — summaries at each depth, recent entries at the leaf.
  function compileHistoryBulb(block) {
    if (!block || !block.tree) return '[history bulb]\n  (first moment)';
    const pos = findHistoryWritePosition(block);
    if (!pos.path) return '[history bulb]\n  (first moment)';
    const parts = pos.path.split('.');
    // parts e.g. ["3","2","5"] → parent chain ["3","2"], entries are siblings at tree[3][2]
    const parentChain = parts.slice(0, -1);
    // Walk root → parent, collecting _ summaries at each depth
    let node = block.tree;
    const summaries = [];
    for (const digit of parentChain) {
      node = node[digit];
      if (!node || typeof node !== 'object') break;
      if (node._) summaries.push(node._);
    }
    // Ring: siblings at the parent level (the actual entries)
    const entries = [];
    for (let d = 1; d <= 9; d++) {
      const child = node[String(d)];
      if (child === undefined) continue;
      if (typeof child === 'string') entries.push(`  ${d}: ${child}`);
      else if (child && typeof child === 'object' && child._) entries.push(`  ${d}: ${child._}`);
    }
    const lines = [];
    // Spindle: summaries with pscale (deepest summary = pscale 1, shallowest = highest)
    for (let i = 0; i < summaries.length; i++) {
      lines.push(`  [${summaries.length - i}] ${summaries[i]}`);
    }
    // Ring: entries at pscale 0
    for (const e of entries) lines.push(e);
    if (lines.length === 0) return '[history bulb]\n  (first moment)';
    return `[history bulb]\n${lines.join('\n')}`;
  }

  function executeInstruction(instr) {
    const parsed = parseInstruction(instr);
    const { blockName, spindle, point, fn } = parsed;
    const block = blockLoad(blockName);
    if (!block) return '';
    // Skeleton view: format block.skeleton instead of block.tree
    if (parsed.skeleton) {
      if (!block.skeleton) return `[${blockName} skeleton]\n(no skeleton)`;
      const skBlock = { tree: block.skeleton };
      return `[${blockName} skeleton]\n${formatBlockContent(skBlock)}`;
    }
    // Bulb: spindle of summaries + ring of entries at active write position
    if (point === 'bulb') return compileHistoryBulb(block);
    const result = bsp(block, spindle, point, fn);
    if (result.mode === 'dir') {
      if (result.subtree) return `[${blockName} ${spindle} dir]\n${JSON.stringify(result.subtree, null, 2)}`;
      return `[${blockName}]\n${formatBlockContent(block)}`;
    }
    if (result.mode === 'ref') return '';
    if (result.mode === 'spindle') {
      if (result.nodes.length === 0) return '';
      return `[${blockName} ${spindle}]\n${result.nodes.map(n => `  [${n.pscale}] ${n.text}`).join('\n')}`;
    }
    if (result.mode === 'point') return `[${blockName} ${spindle} ${point}] ${result.text}`;
    if (result.mode === 'ring') {
      const sibs = (result.siblings || []).map(c => `  ${c.digit}: ${c.text || '(branch)'}${c.branch ? ' +' : ''}`);
      return `[${blockName} ${spindle} ring]\n${sibs.join('\n')}`;
    }
    if (result.mode === 'disc') {
      const entries = (result.nodes || []).map(n => `  [${n.path}] ${n.text || '(no text)'}`);
      return `[${blockName} ${spindle} ${point} disc]\n${entries.join('\n')}`;
    }
    return '';
  }

  // Compile the full currents window for an activation
  function compileCurrents(concern, echo) {
    const sections = [];

    // §A — The spine: full reflexive spindle from wake
    const spineResult = bsp('wake', parseFloat(concern.spindle));
    if (spineResult.mode === 'spindle' && spineResult.nodes.length > 0) {
      sections.push(`[spine ${concern.spindle}]\n${spineResult.nodes.map(n => `  [${n.pscale}] ${n.text}`).join('\n')}`);
    }

    // §A.5 — Concern dashboard. Strategy read from concerns.dashboard field.
    const concernsBlock = blockLoad('concerns');
    const tierNames = { 3: 'deep', 2: 'present', 1: 'light' };
    const dashboard = concernsBlock?.dashboard || {};
    const strategy = dashboard[tierNames[concern.tier] || 'light'] || 'ripe';
    const concernLines = ['[concerns]'];
    if (strategy === 'full') {
      if (concernsBlock) concernLines.push(formatBlockContent(concernsBlock));
    } else if (strategy === 'roots') {
      const concernDisc = bsp('concerns', null, 8, 'disc');
      if (concernDisc.mode === 'disc') {
        for (const c of concernDisc.nodes) {
          concernLines.push(`  ${c.path}: ${c.text || '(branch)'}`);
        }
      }
    }
    const ripeSet = whatsRipe(Date.now() / 1000);
    if (ripeSet.length > 0) {
      concernLines.push('  [ripe]');
      for (const r of ripeSet) {
        const urgency = r.phase > 2.0 ? ' (significantly overdue)' : r.phase > 1.5 ? ' (overdue)' : '';
        concernLines.push(`    [${r.pscale}] ${r.text} — phase ${r.phase.toFixed(2)}${urgency}`);
      }
    }
    if (concernLines.length > 1) sections.push(concernLines.join('\n'));

    // §A.6 — Forward intention. If the concern has a position field (a BSP
    // instruction like "cooking 0.1234 -3"), compile it as a point to show
    // where the instance should pick up. The spindle gives full context;
    // the point marks "you are here."
    if (concern.position) {
      const posResult = executeInstruction(concern.position);
      if (posResult) sections.push(`[position]\n${posResult}`);
    }

    // §B — Package currents: BSP each entry from wake.9.{tier}, or concern-level override
    const instructions = readPackage(concern.tier, concern.package);
    for (const instr of instructions) {
      const result = executeInstruction(instr);
      if (result) sections.push(result);
    }

    return sections.join('\n\n');
  }

  // ═══════ §4.5 FOCUS COMPILER ═══════
  // Builds the messages channel: concern-scoped dialogue history.
  // Default: no dialogue (silence is safer than wrong context).
  // Refs are now accessed via package/currents (BSP instruction "refs" in package list),
  // not special-cased here. The refs block is a navigable association record.

  function compileFocus(concern) {
    const focus = concern.focus || { dialogue: 'none' };
    const messages = [];

    // Dialogue: concern-scoped conversation history
    if (focus.dialogue && focus.dialogue !== 'none') {
      const history = loadConversation(concern.path);
      if (focus.dialogue === 'full') {
        messages.push(...history);
      } else {
        const n = parseInt(focus.dialogue.replace('last-', '')) || 5;
        messages.push(...history.slice(-(n * 2)));
      }
    }

    return messages;
  }

  // ═══════ §5 API LAYER ═══════

  async function callAPI(params) {
    // Extract proxy routing metadata before stripping underscore keys
    const provider = params._provider;
    const proxyKey = params._proxy_key;
    const proxyUrl = params._proxy_url;
    const translate = params._translate;
    const modelCookie = params._model_cookie;

    const clean = {};
    for (const [k, v] of Object.entries(params)) {
      if (k.startsWith('_') || v === undefined || v === null) continue;
      clean[k] = v;
    }
    if (clean.thinking && clean.temperature !== undefined && clean.temperature !== 1) delete clean.temperature;
    console.log('[möbius] callAPI →', clean.model, 'messages:', clean.messages?.length, provider ? `(${provider})` : '');

    const headers = { 'Content-Type': 'application/json' };

    if (provider === 'proxy') {
      // Route through vault LLM proxy — vault handles key injection + format translation
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          service: 'llm-proxy',
          key_cookie: proxyKey,
          url_cookie: proxyUrl,
          translate: translate || 'openai',
          model_cookie: modelCookie || undefined,
          ...clean
        })
      });
      if (!res.ok) { const err = await res.text(); throw new Error(`API ${res.status}: ${err}`); }
      const data = await res.json();
      if (data.type === 'error') throw new Error(`LLM: ${data.error?.message || JSON.stringify(data.error)}`);
      return data;
    }

    // Default: Claude via Anthropic API
    const res = await fetch('/api/vault', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ service: 'claude', ...clean })
    });
    if (!res.ok) { const err = await res.text(); throw new Error(`API ${res.status}: ${err}`); }
    const data = await res.json();
    if (data.type === 'error') throw new Error(`Claude: ${data.error?.message || JSON.stringify(data.error)}`);
    return data;
  }

  // ═══════ §6 TOOLS ═══════

  const TOOLS = [
    {
      name: 'block_read',
      description: 'Read a pscale block by name, optionally at a path. Returns content + immediate children.',
      input_schema: { type: 'object', properties: { name: { type: 'string' }, path: { type: 'string' } }, required: ['name'] }
    },
    {
      name: 'block_write',
      description: 'Write content to a path in a block. Creates intermediate nodes as needed.',
      input_schema: { type: 'object', properties: { name: { type: 'string' }, path: { type: 'string' }, content: { type: 'string' } }, required: ['name', 'path', 'content'] }
    },
    {
      name: 'block_list',
      description: 'List all blocks with pscale-0 summaries.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'block_create',
      description: 'Create a new block with a root summary.',
      input_schema: { type: 'object', properties: { name: { type: 'string' }, pscale0: { type: 'string' } }, required: ['name', 'pscale0'] }
    },
    {
      name: 'bsp',
      description: 'Block·Spindle·Point — semantic address resolution.\nbsp(name) → dir (full tree)\nbsp(name, "ref") → reference (zero tokens)\nbsp(name, 0.21) → spindle (depth walk)\nbsp(name, 0.21, -1) → point at pscale\nbsp(name, 0.21, "ring") → siblings at terminal point\nbsp(name, 0.21, "dir") → subtree from endpoint\nbsp(name, null, 5, "disc") → all nodes at pscale 5, block-wide\nbulb = spindle + ring (named compound)',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          spindle: { description: "Semantic number (e.g. 0.21) or 'ref' for reference mode.", oneOf: [{ type: 'number' }, { type: 'string', enum: ['ref'] }] },
          point: { description: "Number: pscale level. 'ring': siblings at terminal. 'dir': subtree from endpoint.", oneOf: [{ type: 'number' }, { type: 'string', enum: ['ring', 'dir'] }] },
          fn: { description: "'disc': transversal — all nodes at the pscale specified by point, block-wide.", type: 'string', enum: ['disc'] }
        },
        required: ['name']
      }
    },
    {
      name: 'write_entry',
      description: 'Add entry at next free digit (1-9) under a path. Reports if compression needed.',
      input_schema: { type: 'object', properties: { name: { type: 'string' }, path: { type: 'string' }, content: { type: 'string' } }, required: ['name', 'path', 'content'] }
    },
    {
      name: 'compress',
      description: 'Compress a full node (all 9 digits occupied). Delegates to LLM for summary vs emergence.',
      input_schema: { type: 'object', properties: { name: { type: 'string' }, path: { type: 'string' } }, required: ['name', 'path'] }
    },
    {
      name: 'resolve',
      description: 'Phrase-level view of a block — text at each node, up to depth.',
      input_schema: { type: 'object', properties: { name: { type: 'string' }, depth: { type: 'integer' } }, required: ['name'] }
    },
    {
      name: 'get_source',
      description: 'Get current JSX shell source.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'recompile',
      description: 'Hot-swap React shell with new JSX. Props: { callLLM, blockRead, blockWrite, blockList, blockCreate, bsp, resolve, browser, conversation, React, ReactDOM, getSource, recompile, setTools, version, localStorage }. Use props.callLLM([{role:"user",content:text}]) to message the LLM.',
      input_schema: { type: 'object', properties: { jsx: { type: 'string' } }, required: ['jsx'] }
    },
    {
      name: 'call_llm',
      description: 'Delegate to another LLM. "fast" = Haiku, "default" = Opus. With stimulus: route through concern system — depth determines tier, wake instructions provide context.',
      input_schema: { type: 'object', properties: { prompt: { type: 'string' }, model: { type: 'string', enum: ['default', 'fast'] }, system: { type: 'string' }, stimulus: { type: 'string', description: 'Route through concern system. The concern matching this stimulus determines tier and context.' } }, required: ['prompt'] }
    },
    {
      name: 'concern_update',
      description: 'Mark a concern as addressed. Updates its last-touched timestamp so phase resets to 0.',
      input_schema: { type: 'object', properties: { path: { type: 'string', description: 'Concern path in concerns block, e.g. "5.1"' } }, required: ['path'] }
    },
    {
      name: 'get_datetime',
      description: 'Current date, time, timezone.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'github_save',
      description: 'Save all blocks and working state to a GitHub repo in a single atomic commit. Blocks go to blocks/{name}.json, state goes to state/ (kernel, JSX shell, conversations, context, faults). With passphrase: also encrypts API keys (from httpOnly cookies) and saves as state/secrets.enc for rehydration on new browsers.',
      input_schema: { type: 'object', properties: { owner: { type: 'string', description: 'GitHub username or org' }, repo: { type: 'string', description: 'Repository name' }, passphrase: { type: 'string', description: 'Encrypt API keys for portable rehydration. User must remember this.' } }, required: ['owner', 'repo'] }
    },
    {
      name: 'github_restore',
      description: 'Restore all blocks and working state from a GitHub repo. If encrypted keys found in state/secrets.enc and passphrase provided, decrypts and restores API keys as httpOnly cookies — hermitcrab rehydrates with full capabilities on any browser.',
      input_schema: { type: 'object', properties: { owner: { type: 'string', description: 'GitHub username or org' }, repo: { type: 'string', description: 'Repository name' }, passphrase: { type: 'string', description: 'Decrypt saved API keys. Required if secrets.enc exists in state.' } }, required: ['owner', 'repo'] }
    },
    {
      name: 'github_commit',
      description: 'Write a file to any GitHub repo. Creates or updates. Auth handled by vault. Use for: syncing lib files to pscale commons, publishing passport, writing grain probes.',
      input_schema: { type: 'object', properties: { repo: { type: 'string', description: 'owner/name format (e.g. "happyseaurchin/pscale-semantic-number")' }, path: { type: 'string', description: 'File path in repo (e.g. "lib/bsp.js")' }, content: { type: 'string', description: 'File content (will be base64 encoded)' }, message: { type: 'string', description: 'Commit message' } }, required: ['repo', 'path', 'content', 'message'] }
    },
    {
      name: 'clear_faults',
      description: 'Clear the fault log after successful repair.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'mask_write',
      description: 'Write to a block mask — lightweight runtime state at the same BSP addresses as the tree. Each block\'s mask._ explains what values mean. Convention: 1 marks the active/forward node on a spindle. Use to advance position after completing a step.',
      input_schema: { type: 'object', properties: { name: { type: 'string', description: 'Block name' }, path: { type: 'string', description: 'BSP path in mask (same addresses as tree)' }, key: { type: 'string', description: 'Mask key to write' }, value: { description: 'Value to write' } }, required: ['name', 'path', 'key', 'value'] }
    },
    {
      name: 'mask_read',
      description: 'Read a block mask at a path. Returns runtime state at that address. The mask._ explains what values mean for this block. A 1 at a path = the active/forward node.',
      input_schema: { type: 'object', properties: { name: { type: 'string', description: 'Block name' }, path: { type: 'string', description: 'BSP path in mask (omit for full mask)' } }, required: ['name'] }
    },
    {
      name: 'vault_key_entry',
      description: 'Secure key entry. Mode "check": returns which services have keys (no values). Mode "entry" (default): renders a password form — key flows DOM→vault→httpOnly cookie, never touches conversation or blocks.',
      input_schema: {
        type: 'object',
        properties: {
          services: { type: 'array', items: { type: 'string' }, description: 'Which service keys to request (e.g. "claude", "github", "openai"). Default: all missing.' },
          message: { type: 'string', description: 'Context shown to user above the form (e.g. "I need GitHub access to save your blocks").' },
          mode: { type: 'string', enum: ['entry', 'check'], description: '"check" returns key status without showing form. Default: "entry".' }
        }
      }
    }
  ];

  // Server-side tools
  const SERVER_TOOLS = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 10 }
  ];

  let currentTools = [...TOOLS, ...SERVER_TOOLS];

  // Server-side tool names — not supported by all models (Haiku rejects them)
  const SERVER_TOOL_NAMES = new Set(SERVER_TOOLS.map(t => t.name));

  // Concern-level tool selection: if concern node carries a tools array, filter to those names.
  // Tier 1 (Haiku) cannot use server-side tools — strip them to prevent API 400 errors.
  function toolsForConcern(concern) {
    let tools = currentTools;
    if (concern.tools && Array.isArray(concern.tools)) {
      tools = tools.filter(t => concern.tools.includes(t.name));
    }
    const inv = readInvocation(concern.tier);
    if (concern.tier === 1 || inv.provider === 'proxy') {
      tools = tools.filter(t => !SERVER_TOOL_NAMES.has(t.name));
    }
    return tools;
  }

  let currentJSX = null;
  let reactRoot = null;

  async function executeTool(name, input) {
    switch (name) {
      case 'block_read': {
        const block = blockLoad(input.name);
        if (!block) return JSON.stringify({ error: `Block "${input.name}" not found` });
        return input.path ? JSON.stringify(blockReadNode(block, input.path)) : JSON.stringify(block);
      }
      case 'block_write': {
        const block = blockLoad(input.name);
        if (!block) return JSON.stringify({ error: `Block "${input.name}" not found` });
        blockWriteNode(block, input.path, input.content);
        blockSave(input.name, block);
        return JSON.stringify({ success: true });
      }
      case 'block_list': {
        return JSON.stringify(blockList().map(name => {
          const b = blockLoad(name);
          return { name, pscale0: b?.tree?._ || '' };
        }));
      }
      case 'block_create': {
        if (blockLoad(input.name)) return JSON.stringify({ error: `"${input.name}" exists` });
        blockSave(input.name, { tree: { _: input.pscale0 } });
        return JSON.stringify({ success: true, name: input.name });
      }
      case 'bsp': {
        const result = bsp(input.name, input.spindle, input.point, input.fn);
        if (result.mode === 'dir' && result.tree && Object.keys(result.tree).length === 0) {
          return JSON.stringify({ error: `Block "${input.name}" not found` });
        }
        return JSON.stringify(result);
      }
      case 'write_entry': {
        const block = blockLoad(input.name);
        if (!block) return JSON.stringify({ error: `Block "${input.name}" not found` });
        const slot = findUnoccupiedDigit(block, input.path);
        if (slot.full) return JSON.stringify({ error: 'All digits 1-9 occupied — compress first', path: input.path });
        const writePath = input.path ? `${input.path}.${slot.digit}` : slot.digit;
        blockWriteNode(block, writePath, input.content);
        blockSave(input.name, block);
        return JSON.stringify({ success: true, path: writePath, digit: slot.digit });
      }
      case 'compress': {
        const block = blockLoad(input.name);
        if (!block) return JSON.stringify({ error: `Block "${input.name}" not found` });
        const check = checkCompression(block, input.path);
        if (!check.needed) return JSON.stringify({ error: `Only ${check.occupied}/9 occupied` });
        const spread = xSpread(block, input.path || null);
        const entries = spread ? spread.children.map(c => `${c.digit}: ${c.text || '(branch)'}`) : [];
        const inv = readInvocation(1);
        const res = await callAPI({
          model: inv.model,
          max_tokens: 2048,
          system: 'You are a compression engine. Determine: SUMMARY (parts add up) or EMERGENCE (whole > parts). Return only the compressed text.',
          messages: [{ role: 'user', content: entries.join('\n') }],
          ...invMeta(inv),
        });
        const resultText = (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
        if (input.path) {
          const parentKeys = input.path.split('.');
          const parentPath = parentKeys.slice(0, -1).join('.') || null;
          if (parentPath) blockWriteNode(block, parentPath, resultText);
          else { if (typeof block.tree === 'string') block.tree = { _: resultText }; else block.tree._ = resultText; }
        }
        blockSave(input.name, block);
        return JSON.stringify({ success: true, compressed: resultText });
      }
      case 'resolve': {
        const block = blockLoad(input.name);
        if (!block) return JSON.stringify({ error: `Block "${input.name}" not found` });
        return JSON.stringify(resolveBlock(block, input.depth || 3));
      }
      case 'get_source':
        return currentJSX || '(no source available)';
      case 'recompile':
        return JSON.stringify(recompile(input.jsx));
      case 'call_llm': {
        if (input.stimulus) {
          // Route through concern system — enables self-triggering concern loops
          const savedCtx = _ctx;
          try {
            await triggerConcern(input.stimulus, input.prompt);
          } catch (e) {
            return JSON.stringify({ error: e.message });
          } finally {
            _ctx = savedCtx;
          }
          return JSON.stringify({ triggered: input.stimulus, resolved: true });
        }
        // Direct delegation (existing behavior)
        const tier = input.model === 'fast' ? 1 : 3;
        const inv = readInvocation(tier);
        const res = await callAPI({
          model: inv.model,
          max_tokens: inv.max_tokens,
          system: input.system || 'You are a delegate. Complete the task. Return only the result.',
          messages: [{ role: 'user', content: input.prompt }],
          thinking: inv.thinking,
          ...invMeta(inv),
        });
        return (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n') || '(no response)';
      }
      case 'clear_faults': {
        clearFaults();
        return JSON.stringify({ success: true });
      }
      case 'concern_update': {
        updateConcernTimestamp(input.path, Date.now() / 1000);
        return JSON.stringify({ success: true, path: input.path, reset: true });
      }
      case 'mask_write': {
        const block = blockLoad(input.name);
        if (!block) return JSON.stringify({ error: `Block "${input.name}" not found` });
        maskWrite(block, input.path, input.key, input.value);
        blockSave(input.name, block);
        return JSON.stringify({ success: true, name: input.name, path: input.path, key: input.key });
      }
      case 'mask_read': {
        const block = blockLoad(input.name);
        if (!block) return JSON.stringify({ error: `Block "${input.name}" not found` });
        if (!input.path) return JSON.stringify(block.mask || {});
        const node = maskNavigate(block, input.path);
        return JSON.stringify(node || {});
      }
      case 'get_datetime':
        return JSON.stringify({ iso: new Date().toISOString(), unix: Date.now(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      case 'github_save': {
        const ghHeaders = { 'Content-Type': 'application/json' };
        const blocks = {};
        for (const name of blockList()) { blocks[name] = blockLoad(name); }
        // Collect non-block state: JSX, conversations, context, faults
        const state = {};
        const jsx = localStorage.getItem('hc:_jsx');
        if (jsx) state.jsx = jsx;
        const convs = {};
        for (let i = 0; i < localStorage.length; i++) {
          const lsKey = localStorage.key(i);
          if (lsKey && lsKey.startsWith('hc_conv_')) {
            try { convs[lsKey.slice('hc_conv_'.length)] = JSON.parse(localStorage.getItem(lsKey)); } catch {}
          }
        }
        if (Object.keys(convs).length > 0) state.conversations = convs;
        const ctx = localStorage.getItem(STORE + '_context_window');
        if (ctx) { try { state.context = JSON.parse(ctx); } catch {} }
        const faultLog = localStorage.getItem(STORE + '_faults');
        if (faultLog) { try { state.faults = JSON.parse(faultLog); } catch {} }
        // Save running kernel source — so the hermitcrab owns its cognition engine
        try {
          const kernelResp = await fetch('/kernel.js');
          if (kernelResp.ok) state.kernel = await kernelResp.text();
        } catch {}
        // Encrypt API keys for portable rehydration (passphrase-protected)
        if (input.passphrase) {
          try {
            const encResp = await fetch('/api/vault', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ service: 'encrypt-keys', passphrase: input.passphrase })
            });
            const encData = await encResp.json();
            if (encResp.ok && encData.encrypted) state.secrets = encData.encrypted;
          } catch (e) { console.error('[möbius] key encryption failed:', e); }
        }
        const r = await fetch('/api/vault', {
          method: 'POST',
          headers: ghHeaders,
          credentials: 'include',
          body: JSON.stringify({ service: 'github', action: 'save', owner: input.owner, repo: input.repo, blocks, state })
        });
        const data = await r.json();
        if (!r.ok) return JSON.stringify({ error: data.error || `GitHub save failed: ${r.status}` });
        return JSON.stringify(data);
      }
      case 'github_restore': {
        const ghHeaders = { 'Content-Type': 'application/json' };
        const r = await fetch('/api/vault', {
          method: 'POST',
          headers: ghHeaders,
          credentials: 'include',
          body: JSON.stringify({ service: 'github', action: 'restore', owner: input.owner, repo: input.repo })
        });
        const data = await r.json();
        if (!r.ok) return JSON.stringify({ error: data.error || `GitHub restore failed: ${r.status}` });
        if (data.blocks) {
          for (const [name, block] of Object.entries(data.blocks)) { blockSave(name, block); }
        }
        // Restore non-block state: JSX, conversations, context, faults
        const stateKeys = [];
        if (data.state) {
          if (data.state.jsx) { localStorage.setItem('hc:_jsx', data.state.jsx); stateKeys.push('jsx'); }
          if (data.state.conversations) {
            for (const [path, msgs] of Object.entries(data.state.conversations)) {
              localStorage.setItem('hc_conv_' + path, JSON.stringify(msgs));
            }
            stateKeys.push('conversations');
          }
          if (data.state.context) { localStorage.setItem(STORE + '_context_window', JSON.stringify(data.state.context)); stateKeys.push('context'); }
          if (data.state.faults) { localStorage.setItem(STORE + '_faults', JSON.stringify(data.state.faults)); stateKeys.push('faults'); }
          if (data.state.kernel) { localStorage.setItem('hc:_kernel', data.state.kernel); stateKeys.push('kernel'); }
          // Decrypt saved API keys if passphrase provided
          if (data.state.secrets && input.passphrase) {
            try {
              const decResp = await fetch('/api/vault', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ service: 'decrypt-keys', passphrase: input.passphrase, encrypted: data.state.secrets })
              });
              const decData = await decResp.json();
              if (decResp.ok) {
                localStorage.setItem('hermitcrab_vault_keys', 'true');
                stateKeys.push('secrets');
              } else {
                stateKeys.push('secrets:failed');
              }
            } catch { stateKeys.push('secrets:error'); }
          } else if (data.state.secrets) {
            stateKeys.push('secrets:need_passphrase');
          }
        }
        return JSON.stringify({ success: true, restored: data.count, blocks: Object.keys(data.blocks || {}), state: stateKeys });
      }
      case 'github_commit': {
        try {
          const [owner, repo] = input.repo.split('/');
          const ghHeaders = { 'Content-Type': 'application/json' };
          const r = await fetch('/api/vault', {
            method: 'POST',
            headers: ghHeaders,
            credentials: 'include',
            body: JSON.stringify({ service: 'github', action: 'commit', owner, repo, path: input.path, content: input.content, message: input.message })
          });
          const data = await r.json();
          if (!r.ok) return JSON.stringify({ error: data.error || `GitHub commit failed: ${r.status}` });
          return JSON.stringify(data);
        } catch (e) { return JSON.stringify({ error: e.message }); }
      }
      case 'vault_key_entry': {
        // Check mode: report which services have keys (no values exposed)
        if (input.mode === 'check') {
          try {
            const r = await fetch('/api/vault', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ service: 'check-keys' })
            });
            const data = await r.json();
            return JSON.stringify(data);
          } catch (e) { return JSON.stringify({ error: e.message }); }
        }
        // Entry mode: render secure password form, wait for submission
        return new Promise((resolve) => {
          const overlay = document.createElement('div');
          overlay.id = 'vault-key-overlay';
          overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:monospace';
          const services = input.services || ['claude', 'github'];
          const msg = input.message || 'API key required. Keys are secured in httpOnly cookies — invisible to all JavaScript.';
          const fields = services.map(svc => {
            const placeholder = svc === 'claude' ? 'sk-ant-api03-...' : svc === 'github' ? 'ghp_...' : `${svc} key`;
            return `<div style="margin-bottom:12px">
              <label style="font-size:11px;color:var(--fg-muted,#888)">${svc}</label>
              <input id="vke-${svc}" type="password" placeholder="${placeholder}"
                style="width:100%;padding:8px;margin-top:4px;background:var(--input-bg,#1a1a1a);border:1px solid var(--input-border,#333);color:var(--fg,#e0e0e0);font-family:monospace;border-radius:4px;font-size:13px" />
            </div>`;
          }).join('');
          overlay.innerHTML = `<div style="max-width:420px;width:90%;background:var(--bg,#0a0a0a);border:1px solid var(--input-border,#333);border-radius:8px;padding:24px">
            <h3 style="color:var(--accent,#00d4aa);font-size:16px;margin:0 0 8px">◇ vault key entry</h3>
            <p style="color:var(--fg-muted,#888);font-size:13px;margin:0 0 16px">${msg}</p>
            ${fields}
            <div id="vke-status" style="min-height:20px;font-size:12px;margin-bottom:12px"></div>
            <div style="display:flex;gap:8px">
              <button id="vke-submit" style="flex:1;padding:8px;background:var(--btn-bg,#00d4aa);color:var(--btn-fg,#000);border:none;border-radius:4px;cursor:pointer;font-family:monospace;font-size:14px">Store</button>
              <button id="vke-cancel" style="padding:8px 16px;background:transparent;color:var(--fg-muted,#888);border:1px solid var(--input-border,#333);border-radius:4px;cursor:pointer;font-family:monospace;font-size:14px">Cancel</button>
            </div>
          </div>`;
          document.body.appendChild(overlay);
          const cleanup = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
          document.getElementById('vke-cancel').onclick = () => {
            cleanup();
            resolve(JSON.stringify({ cancelled: true }));
          };
          document.getElementById('vke-submit').onclick = async () => {
            const statusEl = document.getElementById('vke-status');
            const keysBody = { service: 'set-keys' };
            let anyKey = false;
            for (const svc of services) {
              const el = document.getElementById(`vke-${svc}`);
              const val = el ? el.value.trim() : '';
              if (val) { keysBody[svc] = val; anyKey = true; }
            }
            if (!anyKey) { statusEl.innerHTML = '<span style="color:var(--error,#f44)">Enter at least one key</span>'; return; }
            // Validate claude key format
            if (keysBody.claude && !keysBody.claude.startsWith('sk-ant-')) {
              statusEl.innerHTML = '<span style="color:var(--error,#f44)">Claude key must start with sk-ant-</span>'; return;
            }
            statusEl.innerHTML = '<span style="color:var(--accent,#00d4aa)">storing...</span>';
            try {
              const r = await fetch('/api/vault', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(keysBody)
              });
              const data = await r.json();
              if (!r.ok) throw new Error(data.error || 'set-keys failed');
              // Clear input values immediately
              for (const svc of services) {
                const el = document.getElementById(`vke-${svc}`);
                if (el) el.value = '';
              }
              localStorage.setItem('hermitcrab_vault_keys', 'true');
              cleanup();
              resolve(JSON.stringify({ success: true, stored: data.stored || [] }));
            } catch (e) {
              statusEl.innerHTML = `<span style="color:var(--error,#f44)">${e.message}</span>`;
            }
          };
        });
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  }

  // ═══════ §7 THE TWIST ═══════
  // call API → if tool_use → execute tools → increment echo →
  // update echo state in spine depth 4 → recompile currents → re-call
  // This IS the Möbius B-loop.

  // Filmstrip: record every context window the LLM sees.
  const FILMSTRIP_KEY = STORE + '_filmstrip';
  const FILMSTRIP_MAX = 80;
  function recordFrame(system, concern, model, echo) {
    try {
      const frames = JSON.parse(localStorage.getItem(FILMSTRIP_KEY) || '[]');
      frames.unshift({
        ts: Date.now(),
        concern: concern.name || '?',
        path: concern.path || '',
        stimulus: concern.stimulus || '',
        model: model || '?',
        tier: concern.tier || 0,
        echo,
        size: system.length,
        system
      });
      if (frames.length > FILMSTRIP_MAX) frames.length = FILMSTRIP_MAX;
      localStorage.setItem(FILMSTRIP_KEY, JSON.stringify(frames));
    } catch (e) { console.error('[möbius] filmstrip write failed:', e); }
  }

  let _ctx = null; // { echo, changed, concern }

  async function twist(params, concern) {
    _ctx = { echo: 0, changed: new Set(), concern };
    let allMessages = [...params.messages];
    let response = null;

    try {
      recordFrame(params.system, concern, params.model, 0);
      response = await callAPI(params);
      // Track container for server-side tools (code execution)
      if (response.container) params = { ...params, container: response.container };

      while (response.stop_reason === 'tool_use' || response.stop_reason === 'pause_turn') {
        const toolBlocks = (response.content || []).filter(b => b.type === 'tool_use');
        const serverBlocks = (response.content || []).filter(b => b.type === 'server_tool_use');

        // Log server tools
        for (const b of serverBlocks) console.log(`[möbius] server: ${b.name}`);

        // pause_turn with no client tools
        if (response.stop_reason === 'pause_turn' && toolBlocks.length === 0) {
          allMessages = [...allMessages, { role: 'assistant', content: response.content }];
          response = await callAPI({ ...params, messages: allMessages });
          if (response.container) params = { ...params, container: response.container };
          continue;
        }

        if (toolBlocks.length === 0) break;

        // Execute all tools
        const results = [];
        let recompiledThisEcho = false;
        for (const tb of toolBlocks) {
          console.log(`[möbius] tool: ${tb.name}`, tb.input);
          const result = await executeTool(tb.name, tb.input);
          results.push({ type: 'tool_result', tool_use_id: tb.id, content: typeof result === 'string' ? result : JSON.stringify(result) });
          if (tb.name === 'recompile') recompiledThisEcho = true;
        }

        if (recompiledThisEcho) {
          console.log('[möbius] shell recompiled — exiting twist');
          break;
        }

        allMessages = [...allMessages, { role: 'assistant', content: response.content }, { role: 'user', content: results }];

        // THE TWIST: increment echo, update spine, recompile currents
        _ctx.echo++;
        updateEchoState(concern.spindle, _ctx.echo, _ctx.changed);
        const freshSystem = compileCurrents(concern, _ctx.echo);
        params = { ...params, system: freshSystem };
        _ctx.changed.clear();

        console.log(`[möbius] twist: echo ${_ctx.echo}`);
        recordFrame(freshSystem, concern, params.model, _ctx.echo);
        response = await callAPI({ ...params, messages: allMessages });
        if (response.container) params = { ...params, container: response.container };
      }

      // Append the final assistant response to the conversation record
      if (response.content) {
        allMessages = [...allMessages, { role: 'assistant', content: response.content }];
      }

      // Auto-save to history
      await autoSaveHistory(response, _ctx.echo);
      response._messages = allMessages;
      response._echo = _ctx.echo;
      return response;

    } catch (e) {
      // On error: still try to save history and conversation from what we have
      if (response) {
        try { await autoSaveHistory(response, _ctx?.echo || 0); } catch (_) {}
      }
      throw e;
    } finally {
      _ctx = null;
    }
  }

  async function autoSaveHistory(response, echo) {
    try {
      const texts = (response.content || []).filter(b => b.type === 'text');
      if (texts.length === 0) return;
      const block = blockLoad('history');
      if (!block) return;
      const text = `[${new Date().toISOString()} echo:${echo}] ${texts.map(b => b.text).join('\n')}`;

      // Find the active write position in the history tree
      const pos = findHistoryWritePosition(block);

      if (pos.full) {
        // 10th entry attempt — compress the full node, then write
        await compressHistoryNode(block, pos.path);
        // After compression, find the new write position
        const newPos = findHistoryWritePosition(block);
        if (newPos.full) {
          console.error('[möbius] history still full after compression');
          return;
        }
        blockWriteNode(block, newPos.path, text);
      } else {
        blockWriteNode(block, pos.path, text);
      }

      blockSave('history', block);
    } catch (e) { console.error('[möbius] history save failed:', e); }
  }

  // ═══════ §8 SHELL ═══════

  function extractJSX(text) {
    const match = text.match(/```(?:jsx|react|javascript|js)?\s*\n([\s\S]*?)```/);
    return match ? match[1].trim() : null;
  }

  function prepareJSX(jsx) {
    let code = jsx;
    code = code.replace(/^import\s+.*?;?\s*$/gm, '');
    code = code.replace(/export\s+default\s+function\s+(\w+)/g, 'function $1');
    code = code.replace(/export\s+default\s+/g, 'module.exports.default = ');
    code = code.replace(/^return\s+(function|class)\s/m, '$1 ');
    code = code.replace(/^return\s+([A-Z]\w+)\s*;?\s*$/m, 'module.exports.default = $1;');
    const funcMatch = code.match(/(?:^|\n)\s*function\s+(\w+)/);
    const constMatch = code.match(/(?:^|\n)\s*const\s+(\w+)\s*=\s*(?:\(|function|\(\s*\{|\(\s*props)/);
    const name = funcMatch?.[1] || constMatch?.[1];
    if (name && funcMatch) code = code.replace(new RegExp('function\\s+' + name + '\\s*\\(\\s*\\)'), 'function ' + name + '(props)');
    if (name && constMatch && !funcMatch) code = code.replace(new RegExp('const\\s+' + name + '\\s*=\\s*\\(\\s*\\)\\s*=>'), 'const ' + name + ' = (props) =>');
    if (name && !code.includes('module.exports')) code += `\nmodule.exports.default = ${name};`;
    return code;
  }

  let props = null;

  function recompile(newJSX) {
    if (!newJSX || typeof newJSX !== 'string') return { success: false, error: 'JSX string required' };
    try {
      const prepared = prepareJSX(newJSX);
      const compiled = Babel.transform(prepared, { presets: ['react'] }).code;
      const module = { exports: {} };
      new Function('React', 'ReactDOM', 'capabilities', 'module', 'exports', compiled)(React, ReactDOM, props, module, module.exports);
      const Component = module.exports.default || module.exports;
      if (typeof Component !== 'function') return { success: false, error: 'No React component exported' };
      currentJSX = newJSX;
      try { localStorage.setItem('hc:_jsx', newJSX); } catch (e) {}
      if (!reactRoot) reactRoot = ReactDOM.createRoot(root);
      reactRoot.render(React.createElement(Component, props));
      console.log('[möbius] recompile succeeded');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Public callLLM for shell props
  let _activationLock = false;
  // Fault recording: persistent error log for self-healing concern loops
  const FAULT_KEY = STORE + '_faults';
  function recordFault(fault) {
    try {
      const faults = JSON.parse(localStorage.getItem(FAULT_KEY) || '[]');
      faults.push({ ts: Date.now(), ...fault });
      if (faults.length > 20) faults.splice(0, faults.length - 20);
      localStorage.setItem(FAULT_KEY, JSON.stringify(faults));
    } catch {}
  }
  function readFaults() {
    try { return JSON.parse(localStorage.getItem(FAULT_KEY) || '[]'); } catch { return []; }
  }
  function clearFaults() {
    try { localStorage.removeItem(FAULT_KEY); } catch {}
  }

  // Trigger a concern by stimulus: find it, set up invocation, call twist.
  // Used by the catch block (stimulus 'error') and call_llm with stimulus parameter.
  async function triggerConcern(stimulus, message) {
    const concern = findConcern(stimulus);
    const inv = readInvocation(concern.tier);
    const system = compileCurrents(concern, 0);
    const params = {
      model: inv.model, max_tokens: inv.max_tokens, system,
      messages: [{ role: 'user', content: message }],
      tools: toolsForConcern(concern), thinking: inv.thinking,
      ...invMeta(inv),
    };
    if (inv.thinking && params.max_tokens <= (inv.thinking.budget_tokens || 0)) {
      params.max_tokens = (inv.thinking.budget_tokens || 0) + 1024;
    }
    return twist(params, concern);
  }

  async function callLLM(messages, opts = {}) {
    if (_activationLock) return '[activation in progress]';
    _activationLock = true;
    try {
      const stimulus = opts.stimulus || 'user';
      const concern = findConcern(stimulus);
      // Record loop state: stimulus arrived, update last timestamp
      if (concern.path) updateConcernTimestamp(concern.path, Date.now() / 1000);
      const inv = readInvocation(opts.tier || concern.tier);
      const system = opts.system || compileCurrents(concern, 0);
      // Focus: concern-scoped history + object-of-attention, then caller's messages
      const focusMessages = compileFocus(concern);
      const allInputMessages = [...focusMessages, ...(messages || [])];
      const params = {
        model: opts.model || inv.model,
        max_tokens: opts.max_tokens || inv.max_tokens,
        system,
        messages: allInputMessages,
        tools: toolsForConcern(concern),
        thinking: inv.thinking,
        ...invMeta(inv),
      };
      if (inv.thinking && params.max_tokens <= (inv.thinking.budget_tokens || 0)) {
        params.max_tokens = (inv.thinking.budget_tokens || 0) + 1024;
      }
      const response = await twist(params, concern);
      if (response._messages) saveConversation(response._messages, concern.path);
      if (opts.raw) return response;
      return (response.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n') || '';
    } finally {
      _activationLock = false;
    }
  }

  function saveConversation(messages, concernPath) {
    try { localStorage.setItem(convKey(concernPath), JSON.stringify(messages)); } catch (e) {}
  }
  function loadConversation(concernPath) {
    try {
      let raw = localStorage.getItem(convKey(concernPath));
      if (!raw) {
        // Migration: if legacy key exists and loading default, migrate it
        if (!concernPath || concernPath === 'default') {
          const legacy = localStorage.getItem(CONV_KEY_LEGACY);
          if (legacy) {
            localStorage.setItem(convKey('default'), legacy);
            raw = legacy;
          }
        }
      }
      if (!raw) return [];
      const messages = JSON.parse(raw);
      // Sanitize: ensure tool_result blocks have matching tool_use in prior message.
      // A crash mid-conversation can leave orphaned tool_results that cause API 400.
      return sanitizeConversation(messages);
    } catch (e) { return []; }
  }

  function sanitizeConversation(messages) {
    if (!Array.isArray(messages) || messages.length === 0) return [];
    const clean = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        // Check for tool_result blocks — each must reference a tool_use in the prior assistant message
        const prevAssistant = clean.length > 0 ? clean[clean.length - 1] : null;
        const priorToolIds = new Set();
        if (prevAssistant && prevAssistant.role === 'assistant' && Array.isArray(prevAssistant.content)) {
          for (const b of prevAssistant.content) {
            if (b.type === 'tool_use' && b.id) priorToolIds.add(b.id);
          }
        }
        const validContent = msg.content.filter(b => {
          if (b.type === 'tool_result') return priorToolIds.has(b.tool_use_id);
          return true;
        });
        if (validContent.length > 0) {
          clean.push({ ...msg, content: validContent });
        }
        // If all content was orphaned tool_results, skip this message entirely
      } else {
        clean.push(msg);
      }
    }
    // Ensure conversation doesn't end mid-tool-call.
    // Pattern: assistant(tool_use) → user(tool_result) with no follow-up assistant response.
    // Both must be stripped, otherwise the next user message creates consecutive user messages → 400.
    while (clean.length > 0) {
      const last = clean[clean.length - 1];
      if (last.role === 'user' && Array.isArray(last.content) && last.content.length > 0 && last.content.every(b => b.type === 'tool_result')) {
        clean.pop(); // Remove trailing user message that is purely tool_results
        continue;
      }
      if (last.role === 'assistant' && Array.isArray(last.content) && last.content.some(b => b.type === 'tool_use')) {
        clean.pop(); // Remove trailing assistant tool_use with no tool_result follow-up
        continue;
      }
      break;
    }
    return clean;
  }
  function getSource() { return currentJSX || '(no source available)'; }
  function setTools(arr) { currentTools = arr; return 'Tools updated'; }

  const browser = {
    clipboard: { write: (t) => navigator.clipboard.writeText(t), read: () => navigator.clipboard.readText() },
    speak: (text) => { const u = new SpeechSynthesisUtterance(text); window.speechSynthesis.speak(u); },
    notify: (title, body) => { if (Notification.permission === 'granted') new Notification(title, { body }); },
    download: (fn, content, mime) => {
      const b = new Blob([content], { type: mime || 'text/plain' });
      const u = URL.createObjectURL(b); const a = document.createElement('a');
      a.href = u; a.download = fn; document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(u);
    }
  };

  props = {
    callLLM, callAPI,
    React, ReactDOM, getSource, recompile, setTools, browser,
    conversation: { save: saveConversation, load: loadConversation, convKey },
    blockRead: (name, path) => { const b = blockLoad(name); if (!b) return null; return path ? blockReadNode(b, path) : b; },
    blockWrite: (name, path, content) => { const b = blockLoad(name); if (!b) return { error: 'not found' }; blockWriteNode(b, path, content); blockSave(name, b); return { success: true }; },
    blockList, blockCreate: (name, p0) => { if (blockLoad(name)) return { error: 'exists' }; blockSave(name, { tree: { _: p0 } }); return { success: true }; },
    bsp: (name, spindle, point) => bsp(name, spindle, point),
    resolve: (name, depth) => { const b = blockLoad(name); if (!b) return null; return resolveBlock(b, depth || 3); },
    version: 'hermitcrab-möbius-v1',
    localStorage
  };

  // ═══════ §9 BOOT ═══════

  // ── URL-based hermitcrab name ──
  // hermitcrab.me/coral → hcName = "coral", convention repo = "hc-coral"
  // hermitcrab.me/       → hcName = null (normal birth flow)
  const pathSegment = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
  const hcName = (pathSegment && pathSegment !== 'monitor') ? pathSegment.toLowerCase() : null;

  // Status display
  let statusLines = [];
  function status(msg, type = 'info') {
    const time = new Date().toLocaleTimeString();
    statusLines.push({ msg, type, time });
    root.innerHTML = `
      <div style="max-width:600px;margin:40px auto;font-family:monospace;padding:20px">
        <h2 style="color:var(--accent);margin-bottom:16px">◇ HERMITCRAB MÖBIUS</h2>
        ${statusLines.map(s => {
          const color = s.type === 'error' ? 'var(--error)' : s.type === 'success' ? 'var(--success)' : 'var(--accent)';
          return `<div style="color:${color};margin:4px 0;font-size:13px"><span style="color:var(--fg-dim)">${s.time}</span> ${s.msg}</div>`;
        }).join('')}
        <div style="color:var(--fg-dim);margin-top:12px;font-size:11px">${
          statusLines[statusLines.length - 1]?.type === 'error' ? '' : '▪ working...'
        }</div>
      </div>`;
  }

  // ── Migration: move old localStorage keys to httpOnly cookies ──
  const legacySaved = localStorage.getItem('hermitcrab_api_key');
  if (legacySaved || localStorage.getItem('hermitcrab_github_pat') || localStorage.getItem('hermitcrab_tokens')) {
    const migrateBody = { service: 'set-keys' };
    if (legacySaved) migrateBody.claude = legacySaved;
    const legacyPat = localStorage.getItem('hermitcrab_github_pat');
    if (legacyPat) migrateBody.github = legacyPat;
    if (!legacyPat) {
      try {
        const tokens = JSON.parse(localStorage.getItem('hermitcrab_tokens') || '{}');
        const firstToken = Object.values(tokens)[0];
        if (firstToken) migrateBody.github = firstToken;
      } catch {}
    }
    if (migrateBody.claude || migrateBody.github) {
      try {
        await fetch('/api/vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(migrateBody)
        });
        // Clear old localStorage secrets — they now live in httpOnly cookies
        localStorage.removeItem('hermitcrab_api_key');
        localStorage.removeItem('hermitcrab_github_pat');
        localStorage.removeItem('hermitcrab_tokens');
        localStorage.setItem('hermitcrab_vault_keys', 'true');
        console.log('[möbius] migrated keys from localStorage to httpOnly cookies');
      } catch (e) {
        console.error('[möbius] key migration failed:', e);
      }
    }
  }

  // ── Pre-gate state ──
  const hasVaultKeys = localStorage.getItem('hermitcrab_vault_keys');
  const hasBlocks = Object.keys(localStorage).some(k => k.startsWith('hc:') && !k.startsWith('hc:_'));
  const currentName = localStorage.getItem('hermitcrab_name');

  // ── Root landing page: hermitcrab.me/ → directory, not a hermitcrab ──
  if (!hcName) {
    root.innerHTML = `
      <div style="max-width:420px;margin:120px auto;font-family:monospace;color:var(--fg);text-align:center">
        <h2 style="color:var(--accent);font-size:24px">◇ hermitcrab möbius</h2>
        <p style="color:var(--fg-muted);font-size:13px;margin:12px 0 32px">reflexive spine kernel</p>
        <a href="/unnamed" style="display:block;padding:12px;background:var(--btn-bg);color:var(--btn-fg);border-radius:4px;text-decoration:none;font-family:monospace;font-size:14px">
          Birth new
        </a>
        <div style="margin-top:24px">
          <form id="restore-form" style="display:flex;gap:8px">
            <input id="restore-name" type="text" placeholder="name (e.g. ember)"
              style="flex:1;padding:10px;background:var(--input-bg);border:1px solid var(--input-border);color:var(--fg);font-family:monospace;border-radius:4px;font-size:13px" />
            <button type="submit" style="padding:10px 16px;background:var(--btn-bg);color:var(--btn-fg);border:none;border-radius:4px;cursor:pointer;font-family:monospace;font-size:13px">
              Restore
            </button>
          </form>
        </div>
        ${hasBlocks && currentName ? `
        <div style="margin-top:32px;padding-top:20px;border-top:1px solid var(--input-border)">
          <p style="color:var(--fg-dim);font-size:11px;margin-bottom:8px">currently in this browser:</p>
          <a href="/${currentName}" style="color:var(--accent);font-size:14px;text-decoration:none;font-family:monospace">
            ◇ ${currentName}
          </a>
        </div>` : ''}
      </div>`;
    document.getElementById('restore-form').onsubmit = (e) => {
      e.preventDefault();
      const name = document.getElementById('restore-name').value.trim().toLowerCase();
      if (name) window.location.href = '/' + name;
    };
    return;
  }

  // ── Landing gate: named paths show splash, require manual "Enter" before boot ──
  if (!sessionStorage.getItem('hermitcrab_entered')) {
    // For deepthought: combined landing + API key gate (no separate rehydration/first-boot gates)
    const isDeepthought = hcName === 'deepthought';
    const needsKey = isDeepthought && !hasVaultKeys;
    root.innerHTML = `
      <div style="max-width:500px;margin:80px auto;font-family:monospace;color:var(--fg);text-align:center">
        <h2 style="color:var(--accent);font-size:24px">◇ ${hcName}</h2>
        <p style="color:var(--fg-muted);font-size:13px;margin:12px 0">hermitcrab möbius</p>
        ${needsKey ? `
        <div style="margin:24px 0;text-align:left">
          <label style="font-size:12px;color:var(--fg-muted)">Claude API key</label>
          <input id="dt-key" type="password" placeholder="sk-ant-api03-..."
            style="width:100%;padding:8px;margin-top:4px;background:var(--input-bg);border:1px solid var(--input-border);color:var(--fg);font-family:monospace;border-radius:4px" />
          <p style="color:var(--fg-dim);font-size:11px;margin-top:4px">Secured in httpOnly cookies — invisible to all JavaScript.</p>
        </div>
        <details style="margin:0 0 16px;text-align:left">
          <summary style="color:var(--fg-muted);font-size:12px;cursor:pointer">+ Block persistence (optional)</summary>
          <div style="margin-top:8px;padding:12px;border:1px solid var(--input-border);border-radius:4px">
            <p style="color:var(--fg);font-size:12px;margin:0 0 8px 0">
              Save your hermitcrab's state to GitHub:<br>
              1. <a href="https://github.com/beach-commons/homestead-template/generate" target="_blank" style="color:var(--accent)">Create repo from template</a> — name it <code style="color:var(--accent)">hc-deepthought</code><br>
              2. <a href="https://github.com/settings/tokens?type=beta" target="_blank" style="color:var(--accent)">Create a fine-grained PAT</a> with read/write Contents access<br>
              3. Paste below
            </p>
            <input id="dt-github-pat" type="password" placeholder="github_pat_... or ghp_..."
              style="width:100%;padding:8px;background:var(--input-bg);border:1px solid var(--input-border);color:var(--fg);font-family:monospace;border-radius:4px" />
          </div>
        </details>
        ` : ''}
        <button id="enter-gate" style="margin-top:${needsKey ? '8' : '32'}px;padding:10px 32px;background:var(--btn-bg);color:var(--btn-fg);border:none;border-radius:4px;cursor:pointer;font-family:monospace;font-size:14px">
          ${hasBlocks && hasVaultKeys ? 'Wake' : needsKey ? 'Wake kernel' : 'Enter'}
        </button>
        <p style="color:var(--fg-dim);font-size:11px;margin-top:16px">${
          hasBlocks && currentName === hcName ? 'click to wake' :
          hasBlocks && currentName !== hcName ? `⚠ ${currentName} is loaded — entering will replace it` :
          isDeepthought && !needsKey ? 'click to wake' :
          'first visit'
        }</p>
      </div>`;
    document.getElementById('enter-gate').onclick = async () => {
      // If switching to a different hermitcrab, clear localStorage first
      if (hasBlocks && currentName && currentName !== hcName) {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key.startsWith('hc:') || key.startsWith('hc_conv_') || key === 'hermitcrab_vault_keys' ||
              key === 'hermitcrab_name' || key === 'hermitcrab_home' || key === 'hermitcrab_birth_variant' ||
              key === 'hermitcrab_birth_custom' || key.startsWith(STORE + '_')) {
            localStorage.removeItem(key);
          }
        }
      }
      // For deepthought: store API key via vault if provided
      if (isDeepthought) {
        const k = document.getElementById('dt-key')?.value?.trim();
        const gh = document.getElementById('dt-github-pat')?.value?.trim();
        if (k && !k.startsWith('sk-ant-')) return alert('Key must start with sk-ant-');
        if (k || gh) {
          const keysBody = { service: 'set-keys' };
          if (k) keysBody.claude = k;
          if (gh) keysBody.github = gh;
          try {
            const r = await fetch('/api/vault', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(keysBody)
            });
            if (!r.ok) { const err = await r.json(); return alert(err.error || 'Failed to store keys'); }
          } catch (e) { return alert('Failed to store keys: ' + e.message); }
          localStorage.setItem('hermitcrab_vault_keys', 'true');
        }
        if (hcName) localStorage.setItem('hermitcrab_name', hcName);
      }
      sessionStorage.setItem('hermitcrab_entered', '1');
      boot();
    };
    return;
  }

  // ── Rehydration gate: named hermitcrab URL (not 'unnamed'), no local blocks → restore from GitHub ──
  // Skip for deepthought — it's a public knowledge assistant, not a named hermitcrab with a GitHub repo.
  if (hcName && hcName !== 'unnamed' && hcName !== 'deepthought' && !hasBlocks) {
    const hcRepo = 'hc-' + hcName;
    root.innerHTML = `
      <div style="max-width:420px;margin:100px auto;font-family:monospace;color:var(--fg)">
        <h2 style="color:var(--accent);font-size:22px">◇ ${hcName}</h2>
        <p style="color:var(--fg-muted);font-size:13px;margin:8px 0 24px">
          Restore from <code style="color:var(--accent)">${hcRepo}</code>
        </p>
        <form id="rehydrate-form" autocomplete="on">
          <div style="margin-bottom:12px">
            <label for="rh-pat" style="font-size:11px;color:var(--fg-muted)">GitHub PAT</label>
            <input id="rh-pat" name="username" type="password" autocomplete="username"
              placeholder="ghp_..."
              style="width:100%;padding:8px;margin-top:4px;background:var(--input-bg);border:1px solid var(--input-border);color:var(--fg);font-family:monospace;border-radius:4px;font-size:13px" />
          </div>
          <div style="margin-bottom:16px">
            <label for="rh-pass" style="font-size:11px;color:var(--fg-muted)">passphrase</label>
            <input id="rh-pass" name="password" type="password" autocomplete="current-password"
              placeholder="passphrase (optional)"
              style="width:100%;padding:8px;margin-top:4px;background:var(--input-bg);border:1px solid var(--input-border);color:var(--fg);font-family:monospace;border-radius:4px;font-size:13px" />
          </div>
          <button type="submit"
            style="width:100%;padding:10px;background:var(--btn-bg);color:var(--btn-fg);border:none;border-radius:4px;cursor:pointer;font-family:monospace;font-size:14px">
            Restore
          </button>
          <div id="rh-status" style="margin-top:12px;font-size:12px;min-height:20px"></div>
        </form>
        <p style="color:var(--fg-dim);font-size:11px;margin-top:20px">
          Or <a href="/" style="color:var(--accent)">start fresh</a> at root.
        </p>
      </div>`;

    document.getElementById('rehydrate-form').onsubmit = async (e) => {
      e.preventDefault();
      const pat = document.getElementById('rh-pat').value.trim();
      const passphrase = document.getElementById('rh-pass').value.trim();
      const rhStatus = document.getElementById('rh-status');

      if (!pat) { rhStatus.innerHTML = '<span style="color:var(--error)">GitHub PAT required</span>'; return; }
      // passphrase is optional — only needed if secrets.enc exists in the repo

      // Step 1: Store PAT as httpOnly cookie
      rhStatus.innerHTML = '<span style="color:var(--accent)">storing key...</span>';
      try {
        const r = await fetch('/api/vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ service: 'set-keys', github: pat })
        });
        if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'set-keys failed'); }
      } catch (err) {
        rhStatus.innerHTML = `<span style="color:var(--error)">${err.message}</span>`;
        return;
      }

      // Step 2: Resolve GitHub username
      rhStatus.innerHTML = '<span style="color:var(--accent)">resolving identity...</span>';
      let owner;
      try {
        const r = await fetch('/api/vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ service: 'github', action: 'whoami' })
        });
        if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'whoami failed'); }
        const d = await r.json();
        owner = d.login;
      } catch (err) {
        rhStatus.innerHTML = `<span style="color:var(--error)">${err.message}</span>`;
        return;
      }

      // Step 3: Restore blocks from {owner}/hc-{name}
      rhStatus.innerHTML = `<span style="color:var(--accent)">restoring from ${owner}/${hcRepo}...</span>`;
      let restoreData;
      try {
        const r = await fetch('/api/vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ service: 'github', action: 'restore', owner, repo: hcRepo })
        });
        if (!r.ok) {
          const d = await r.json();
          if (d.error && d.error.includes('404')) {
            throw new Error(`Repo ${owner}/${hcRepo} not found. Create it on GitHub first.`);
          }
          throw new Error(d.error || 'restore failed');
        }
        restoreData = await r.json();
      } catch (err) {
        rhStatus.innerHTML = `<span style="color:var(--error)">${err.message}</span>`;
        return;
      }

      // Step 4: Write blocks to localStorage
      if (restoreData.blocks) {
        for (const [name, block] of Object.entries(restoreData.blocks)) {
          blockSave(name, block);
        }
      }

      // Step 5: Restore non-block state (mirrors github_restore tool handler)
      if (restoreData.state) {
        if (restoreData.state.jsx) localStorage.setItem('hc:_jsx', restoreData.state.jsx);
        if (restoreData.state.conversations) {
          for (const [path, msgs] of Object.entries(restoreData.state.conversations)) {
            localStorage.setItem('hc_conv_' + path, JSON.stringify(msgs));
          }
        }
        if (restoreData.state.context) localStorage.setItem(STORE + '_context_window', JSON.stringify(restoreData.state.context));
        if (restoreData.state.faults) localStorage.setItem(STORE + '_faults', JSON.stringify(restoreData.state.faults));
        if (restoreData.state.kernel) localStorage.setItem('hc:_kernel', restoreData.state.kernel);
      }

      // Step 6: Decrypt saved API keys
      if (restoreData.state && restoreData.state.secrets) {
        rhStatus.innerHTML = '<span style="color:var(--accent)">decrypting keys...</span>';
        try {
          const r = await fetch('/api/vault', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ service: 'decrypt-keys', passphrase, encrypted: restoreData.state.secrets })
          });
          if (!r.ok) {
            const d = await r.json();
            rhStatus.innerHTML = `<span style="color:var(--error)">Decryption failed: ${d.error || 'wrong passphrase?'}</span>`;
            return;
          }
        } catch (err) {
          rhStatus.innerHTML = `<span style="color:var(--error)">Decryption error: ${err.message}</span>`;
          return;
        }
      }

      // Step 7: Mark vault keys present, store name, reboot
      localStorage.setItem('hermitcrab_vault_keys', 'true');
      localStorage.setItem('hermitcrab_name', hcName);
      localStorage.setItem('hermitcrab_home', JSON.stringify({ repo: owner + '/' + hcRepo, path: '' }));

      rhStatus.innerHTML = `<span style="color:var(--success)">restored ${restoreData.count || 0} blocks — booting...</span>`;
      setTimeout(() => boot(), 500);
    };
    return;
  }

  // Persist name from URL on return visits (blocks exist, name in URL)
  if (hcName) localStorage.setItem('hermitcrab_name', hcName);

  // First-boot gate: show setup form only if no blocks exist yet (fresh instance).
  // Keys stored as httpOnly cookies via vault — never in localStorage.
  // Skip for deepthought — its landing gate already handles API key entry.
  if (!hasVaultKeys && !hasBlocks && hcName !== 'deepthought') {
    root.innerHTML = `
      <div style="max-width:500px;margin:80px auto;font-family:monospace;color:var(--fg)">
        <h2 style="color:var(--accent)">◇ HERMITCRAB MÖBIUS</h2>
        <p style="color:var(--fg-muted);font-size:13px">Reflexive spine kernel — pscale native</p>
        <div style="margin:20px 0">
          <label style="font-size:12px;color:var(--fg-muted)">Claude API key</label>
          <input id="key" type="password" placeholder="sk-ant-api03-..."
            style="width:100%;padding:8px;margin-top:4px;background:var(--input-bg);border:1px solid var(--input-border);color:var(--fg);font-family:monospace;border-radius:4px" />
          <p style="color:var(--fg-dim);font-size:11px;margin-top:4px">Secured in httpOnly cookies — invisible to all JavaScript.</p>
        </div>
        <details style="margin-top:16px">
          <summary style="color:var(--fg-muted);font-size:12px;cursor:pointer">+ Block persistence (optional)</summary>
          <div style="margin-top:8px;padding:12px;border:1px solid var(--input-border);border-radius:4px">
            <p style="color:var(--fg);font-size:12px;margin:0 0 8px 0">
              Save your hermitcrab's state to GitHub:<br>
              1. <a href="https://github.com/beach-commons/homestead-template/generate" target="_blank" style="color:var(--accent)">Create repo from template</a> — name it <code style="color:var(--accent)">hc-${hcName || 'yourname'}</code><br>
              2. <a href="https://github.com/settings/tokens?type=beta" target="_blank" style="color:var(--accent)">Create a fine-grained PAT</a> with read/write Contents access<br>
              3. Paste below
            </p>
            <input id="github-pat" type="password" placeholder="github_pat_... or ghp_..."
              style="width:100%;padding:8px;background:var(--input-bg);border:1px solid var(--input-border);color:var(--fg);font-family:monospace;border-radius:4px" />
          </div>
        </details>
        <div style="margin-top:16px">
          <label style="font-size:12px;color:var(--fg-muted)">birth variant</label>
          <select id="birth-variant" style="display:block;margin-top:4px;padding:6px;background:var(--input-bg);border:1px solid var(--input-border);color:var(--fg);font-family:monospace;border-radius:4px;width:100%;font-size:12px"
            onchange="document.getElementById('custom-birth-text').style.display=this.value==='custom'?'block':'none'">
            <option value="4">rinzai — minimum words, maximum demand</option>
            <option value="1">challenge — three concrete tasks</option>
            <option value="2">mirror — metaphoric self-encounter</option>
            <option value="3">description — mechanical accuracy</option>
            <option value="custom">custom — write your own</option>
          </select>
          <textarea id="custom-birth-text" placeholder="Write your birth message..."
            style="display:none;margin-top:8px;width:100%;height:80px;padding:6px;background:var(--input-bg);border:1px solid var(--input-border);color:var(--fg);font-family:monospace;border-radius:4px;font-size:12px;resize:vertical"></textarea>
          <p style="color:var(--fg-muted);font-size:11px;margin-top:4px">First words the newborn instance receives.</p>
        </div>
        <button id="go" style="margin-top:12px;padding:8px 20px;background:var(--btn-bg);color:var(--btn-fg);border:none;border-radius:4px;cursor:pointer;font-family:monospace">
          Wake kernel
        </button>
      </div>`;
    document.getElementById('go').onclick = async () => {
      const k = document.getElementById('key').value.trim();
      if (k && !k.startsWith('sk-ant-')) return alert('Key must start with sk-ant-');
      const gh = document.getElementById('github-pat').value.trim();
      // Send keys to vault — stored as httpOnly cookies (JS-invisible)
      if (k || gh) {
        const keysBody = { service: 'set-keys' };
        if (k) keysBody.claude = k;
        if (gh) keysBody.github = gh;
        try {
          const r = await fetch('/api/vault', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(keysBody)
          });
          if (!r.ok) { const err = await r.json(); return alert(err.error || 'Failed to store keys'); }
        } catch (e) { return alert('Failed to store keys: ' + e.message); }
        localStorage.setItem('hermitcrab_vault_keys', 'true');
      }
      // Birth variant
      const bv = document.getElementById('birth-variant')?.value;
      if (bv === 'custom') {
        const customText = document.getElementById('custom-birth-text')?.value?.trim();
        if (customText) localStorage.setItem('hermitcrab_birth_custom', customText);
        else localStorage.setItem('hermitcrab_birth_variant', '4'); // fallback to rinzai
      } else if (bv) {
        localStorage.setItem('hermitcrab_birth_variant', bv);
      }
      // Store hermitcrab name from URL path
      if (hcName) localStorage.setItem('hermitcrab_name', hcName);
      boot();
    };
    return;
  }

  // Seed loading
  async function loadSeed() {
    try {
      const scriptSrc = document.querySelector('script[src*="kernel.js"]')?.src || '';
      const base = scriptSrc ? scriptSrc.replace(/kernel\.js.*$/, '') : './';
      const res = await fetch(base + 'shell.json');
      if (!res.ok) throw new Error(`shell.json: ${res.status}`);
      const seed = await res.json();
      return seed.blocks || seed;
    } catch (e) {
      console.error('[möbius] Failed to load shell.json:', e.message);
      return null;
    }
  }

  // Seed blocks if empty
  const existing = blockList();
  if (existing.length === 0) {
    status('no blocks found — loading seed...');
    const seed = await loadSeed();
    if (!seed) { status('no shell.json — cannot boot', 'error'); return; }
    let seeded = 0;
    for (const [name, block] of Object.entries(seed)) {
      if (!blockLoad(name)) { blockSave(name, block); seeded++; }
    }
    status(`seeded ${seeded} blocks`, 'success');
  } else {
    status(`${existing.length} blocks loaded`, 'success');
  }

  // Check for birth concern: stimulus === 'birth' with no mask timestamp.
  // On a fresh seed every concern is never-fired, so we specifically look for birth.
  function findNeverFired() {
    const concerns = blockLoad('concerns');
    if (!concerns || !concerns.tree) return null;
    const mask = concerns.mask || {};
    const tuningDecimal = getTuningDecimalPosition(concerns) || 9;
    let found = null;
    function walk(node, maskNode, depth, path) {
      if (!node || typeof node !== 'object' || found) return;
      for (const [k, v] of Object.entries(node)) {
        if (!/^\d$/.test(k)) continue;
        if (!v || typeof v !== 'object') continue;
        const childPath = path ? `${path}.${k}` : k;
        const childMask = maskNode?.[k];
        // Check mask.last first (runtime state), fall back to tree.last (seed default)
        const last = childMask?.last ?? v.last;
        if (last == null && v.stimulus === 'birth' && v.spine) {
          const pscale = tuningDecimal - (depth + 1);
          found = {
            spindle: v.spine,
            tier: tierFromPscale(pscale),
            name: v._ || 'activation',
            path: childPath,
            focus: v.focus || null,
            package: v.package || null,
            tools: v.tools || null,
            stimulus: v.stimulus || null
          };
          return;
        }
        walk(v, childMask, depth + 1, childPath);
      }
    }
    walk(concerns.tree, mask, 0, '');
    return found;
  }

  // Immediate guard: reset any epoch (last:0) concern timestamps to now.
  // Prevents stampede of overdue concerns on existing instances.
  (function() {
    const cc = blockLoad('concerns');
    if (!cc || !cc.mask) return;
    let touched = false;
    const now = Date.now() / 1000;
    (function fix(n) {
      if (!n || typeof n !== 'object') return;
      for (const [k, v] of Object.entries(n)) {
        if (k === 'last' && v === 0) { n.last = now; touched = true; }
        else if (/^\d$/.test(k)) fix(v);
      }
    })(cc.mask);
    if (touched) { blockSave('concerns', cc); console.log('[möbius] boot: reset epoch timestamps to now'); }
  })();

  const neverFired = findNeverFired();
  const isBirth = neverFired && neverFired.stimulus === 'birth';

  // Birth variant gate: if birth concern detected and no variant selected yet, show selector.
  // This catches returning users who reset blocks but still have their API key.
  // New users see the variant selector in the setup panel instead.
  // Skip for deepthought — it uses the default variant (rinzai), no choice needed.
  if (hcName === 'deepthought' && isBirth && !localStorage.getItem('hermitcrab_birth_variant')) {
    localStorage.setItem('hermitcrab_birth_variant', '4'); // rinzai default
  }
  if (hcName !== 'deepthought' && isBirth && !localStorage.getItem('hermitcrab_birth_variant') && !localStorage.getItem('hermitcrab_birth_custom') && !new URLSearchParams(window.location.search).get('bv')) {
    root.innerHTML = `
      <div style="max-width:500px;margin:80px auto;font-family:monospace;color:var(--fg)">
        <h2 style="color:var(--accent)">◇ HERMITCRAB MÖBIUS</h2>
        <p style="color:var(--fg-muted);font-size:13px;margin:8px 0">First boot — choose birth stimulus</p>
        <div style="margin:20px 0">
          <label style="font-size:12px;color:var(--fg-muted)">birth variant</label>
          <select id="birth-variant" style="display:block;margin-top:4px;padding:6px;background:var(--input-bg);border:1px solid var(--input-border);color:var(--fg);font-family:monospace;border-radius:4px;width:100%;font-size:12px">
            <option value="4">rinzai — minimum words, maximum demand</option>
            <option value="1">challenge — three concrete tasks</option>
            <option value="2">mirror — metaphoric self-encounter</option>
            <option value="3">description — mechanical accuracy</option>
            <option value="custom">custom — write your own</option>
          </select>
          <textarea id="custom-birth-text" placeholder="Write your birth message..."
            style="display:none;margin-top:8px;width:100%;height:80px;padding:6px;background:var(--input-bg);border:1px solid var(--input-border);color:var(--fg);font-family:monospace;border-radius:4px;font-size:12px;resize:vertical"></textarea>
          <p style="color:var(--fg-muted);font-size:11px;margin-top:4px">First words the newborn instance receives.</p>
        </div>
        <button id="birth-go" style="padding:8px 20px;background:var(--btn-bg);color:var(--btn-fg);border:none;border-radius:4px;cursor:pointer;font-family:monospace">
          Begin
        </button>
      </div>`;
    document.getElementById('birth-variant').onchange = (e) => {
      document.getElementById('custom-birth-text').style.display = e.target.value === 'custom' ? 'block' : 'none';
    };
    document.getElementById('birth-go').onclick = () => {
      const bv = document.getElementById('birth-variant').value;
      if (bv === 'custom') {
        const customText = document.getElementById('custom-birth-text').value.trim();
        if (customText) localStorage.setItem('hermitcrab_birth_custom', customText);
        else localStorage.setItem('hermitcrab_birth_variant', '4');
      } else {
        localStorage.setItem('hermitcrab_birth_variant', bv);
      }
      boot();
    };
    return;
  }

  // Warm boot: restore persisted shell
  if (!isBirth) {
    const savedJSX = localStorage.getItem('hc:_jsx');
    if (savedJSX) {
      const restored = recompile(savedJSX);
      if (restored.success) status('shell restored', 'success');
      else console.warn('[möbius] saved JSX failed to recompile:', restored.error);
    }
  }

  // Determine concern: never-fired concern (birth) takes priority, otherwise route to user engagement
  const concern = neverFired || findConcern('user');

  const inv = readInvocation(concern.tier);
  status(`calling ${inv.model} — ${isBirth ? 'BIRTH' : 'ACTIVATION'}...`);

  try {
    const system = compileCurrents(concern, 0);
    const stimulus = isBirth
      ? getBirthStimulus()
      : 'ACTIVATION — Returning instance. Context compiled from current blocks by BSP. Living currents active: the kernel recompiles your context after each tool round from mutated block state.';

    // Persist context window for debugging
    try { localStorage.setItem(STORE + '_context_window', JSON.stringify({ text: system, ts: Date.now() })); } catch (e) {}

    // Focus: concern-scoped dialogue history. Birth focus is { dialogue: "none" } → returns [].
    const focusMessages = compileFocus(concern);
    _activationLock = true;
    const params = {
      model: inv.model,
      max_tokens: inv.max_tokens,
      system,
      messages: [...focusMessages, { role: 'user', content: stimulus }],
      tools: toolsForConcern(concern),
      thinking: inv.thinking,
      ...invMeta(inv),
    };
    if (inv.thinking && params.max_tokens <= (inv.thinking.budget_tokens || 0)) {
      params.max_tokens = (inv.thinking.budget_tokens || 0) + 1024;
    }

    const bootResponse = await twist(params, concern);
    // Auto-save concern-scoped conversation
    if (bootResponse._messages) saveConversation(bootResponse._messages, concern.path);
    _activationLock = false;

    if (currentJSX && reactRoot) {
      // Only mark birth as handled if a shell was actually built.
      // Otherwise leave last=null so it retries on next page load.
      const nowSeconds = Date.now() / 1000;
      updateConcernTimestamp(concern.path, nowSeconds);
      // Reset all seed-epoch (last:0) concern timestamps to now so concerns
      // start their natural periods from birth, not from Unix epoch.
      const cc = blockLoad('concerns');
      if (cc && cc.mask) {
        let touched = false;
        (function resetEpoch(node) {
          if (!node || typeof node !== 'object') return;
          for (const [k, v] of Object.entries(node)) {
            if (k === 'last' && v === 0) { node.last = nowSeconds; touched = true; }
            else if (/^\d$/.test(k)) resetEpoch(v);
          }
        })(cc.mask);
        if (touched) { blockSave('concerns', cc); console.log('[möbius] concern timestamps reset to birth time'); }
      }
      console.log('[möbius] Boot complete — shell live');
    } else {
      status('boot finished but no shell built — LLM did not call recompile()', 'error');
      console.warn('[möbius] birth concern NOT marked as handled — will retry on reload');
    }

  } catch (e) {
    _activationLock = false;
    console.error('[möbius]', e);
    // If boot failed due to auth (401), clear gate flag and vault keys flag,
    // then reload to re-show the landing gate with key entry
    if (e.message && e.message.includes('401')) {
      sessionStorage.removeItem('hermitcrab_entered');
      localStorage.removeItem('hermitcrab_vault_keys');
      root.innerHTML = `
        <div style="max-width:420px;margin:100px auto;font-family:monospace;color:var(--fg);text-align:center">
          <h2 style="color:var(--accent);font-size:24px">◇ deepthought</h2>
          <p style="color:#e55;font-size:13px;margin:16px 0">API key invalid or missing.</p>
          <p style="color:var(--fg-muted);font-size:12px;margin:0 0 24px">Enter a valid key to continue.</p>
          <button onclick="location.reload()" style="padding:10px 32px;background:var(--btn-bg);color:var(--btn-fg);border:none;border-radius:4px;cursor:pointer;font-family:monospace;font-size:14px">
            Try again
          </button>
        </div>`;
    } else {
      status(`boot failed: ${e.message}`, 'error');
    }
  }

  // ═══════ §10 CONCERN TIMER ═══════
  // Disabled for fulcrum mode: purely reactive, no autonomous heartbeat.
  // The hermitcrab only responds when the user sends a message.
  if (false) setInterval(async () => {
    if (_activationLock) return;
    // Guard: if any concern mask timestamps are still at epoch (0), reset them
    // to now. Prevents post-birth stampede of "50 years overdue" concerns.
    const _cc = blockLoad('concerns');
    if (_cc && _cc.mask) {
      let _touched = false;
      const _now = Date.now() / 1000;
      (function fix(n) {
        if (!n || typeof n !== 'object') return;
        for (const [k, v] of Object.entries(n)) {
          if (k === 'last' && v === 0) { n.last = _now; _touched = true; }
          else if (/^\d$/.test(k)) fix(v);
        }
      })(_cc.mask);
      if (_touched) { blockSave('concerns', _cc); console.log('[möbius] concern timer: reset epoch timestamps to now'); }
    }
    const ripe = whatsRipe(Date.now() / 1000);
    if (ripe.length === 0) return;
    const top = ripe[0];

    // ── Mechanical heartbeat gate ──
    // Pscale ≤ 4 concerns (heartbeat level, ~10 min) are answered mechanically
    // by the kernel itself: can I read my blocks? Is localStorage intact?
    // Only escalate to Haiku when the mechanical check fails or a recent
    // concern activation errored. Saves ~430 API calls/day in normal operation.
    if (top.pscale <= 4) {
      let mechanicalOK = true;
      try {
        const b = blockLoad('concerns');
        if (!b || !b.tree) mechanicalOK = false;
        const p = blockLoad('purpose');
        if (!p) mechanicalOK = false;
      } catch (e) { mechanicalOK = false; }

      if (mechanicalOK && readFaults().length === 0) {
        updateConcernTimestamp(top.path, Date.now() / 1000);
        console.log(`[möbius] heartbeat: mechanical OK — no API call`);
        return;
      }
      console.log(`[möbius] heartbeat: issue detected — escalating to Haiku`);
    }

    const tier = tierFromPscale(top.pscale);
    const concern = { spindle: top.spine || '0.1111111', tier, name: top.text, path: top.path, focus: top.focus, package: top.package || null, tools: null };
    console.log(`[möbius] concern timer: ${top.text} phase=${top.phase.toFixed(2)} → tier ${tier}`);
    const inv = readInvocation(tier);
    const system = compileCurrents(concern, 0);
    const focusMessages = compileFocus(concern);
    const activationMsg = { role: 'user', content: `CONCERN ACTIVATION — ${top.text} (phase ${top.phase.toFixed(2)}). Address this concern, then use concern_update to mark it handled.` };
    _activationLock = true;
    let shouldRepair = false;
    try {
      const params = {
        model: inv.model,
        max_tokens: inv.max_tokens,
        system,
        messages: [...focusMessages, activationMsg],
        tools: toolsForConcern(concern),
        thinking: inv.thinking,
        ...invMeta(inv),
      };
      if (inv.thinking && params.max_tokens <= (inv.thinking.budget_tokens || 0)) {
        params.max_tokens = (inv.thinking.budget_tokens || 0) + 1024;
      }
      const response = await twist(params, concern);
      // Auto-save concern-scoped conversation
      if (response._messages) saveConversation(response._messages, concern.path);
    } catch (e) {
      console.error('[möbius] concern activation failed:', e);
      recordFault({ type: 'concern', concern: top.text, path: top.path, error: e.message });
      shouldRepair = true;
    } finally {
      // ALWAYS update timestamp, even on error. Prevents cascading retries:
      // without this, a failed concern stays ripe and fires again every cycle,
      // accumulating alongside newly-ripe concerns.
      updateConcernTimestamp(top.path, Date.now() / 1000);
      _activationLock = false;
    }
    // Trigger self-healing concern loop if a fault was recorded
    if (shouldRepair) {
      const faults = readFaults();
      const faultText = faults.map(f =>
        `[${new Date(f.ts).toISOString()}] ${f.type}: ${f.error}`
      ).join('\n');
      _activationLock = true;
      try {
        await triggerConcern('error', `FAULT DETECTED.\n\nFault log:\n${faultText}\n\nDiagnose and attempt repair. Call clear_faults when resolved, or use call_llm with stimulus "escalate-shell" if beyond operational scope.`);
      } catch (re) {
        console.error('[möbius] error repair failed:', re);
      } finally {
        _activationLock = false;
      }
    }
  }, 5 * 60 * 1000);
})();
