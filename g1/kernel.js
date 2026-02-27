// HERMITCRAB G1 — Clean Build
// Pure engine: load blocks from storage (or seed), build aperture + focus, call LLM, render JSX.
// The kernel has no identity. The blocks are the shell. Any LLM can animate any shell.

(async function boot() {
  const root = document.getElementById('root');
  const STORE_PREFIX = 'hc:';
  const CONV_KEY = 'hc_conversation';
  // Bootstrap fallbacks — only used when wake block has no model IDs yet (pre-birth)
  const FALLBACK_MODEL = 'claude-opus-4-6';
  const FALLBACK_FAST_MODEL = 'claude-haiku-4-5-20251001';

  // ============ MODEL RESOLUTION ============
  // Mechanical pre-boot check: call /v1/models to discover latest model IDs,
  // write them into wake 0.9.4-6 so the block is always current.
  // Not agent behaviour — same as checking what API version exists before using it.
  // The LLM can also update these during activation (agent choice, not mechanical).
  async function resolveModels() {
    try {
      const apiKey = localStorage.getItem('hermitcrab_api_key');
      if (!apiKey) return;
      const resp = await fetch('/api/models?limit=100', {
        headers: { 'x-api-key': apiKey }
      });
      if (!resp.ok) { console.warn('[g1] Models API:', resp.status); return; }
      const models = (await resp.json()).data || [];
      // API returns most recent first — first match per family is latest
      const families = { opus: null, sonnet: null, haiku: null };
      for (const m of models) {
        const id = m.id || '';
        for (const f of Object.keys(families)) {
          if (!families[f] && id.includes(f)) families[f] = id;
        }
      }
      // Write into wake 0.9.{4,5,6}.1 — the tier invocation model IDs
      const wake = blockLoad('wake');
      if (!wake) return;
      const tierMap = { haiku: '4', sonnet: '5', opus: '6' };
      let updated = false;
      for (const [family, modelId] of Object.entries(families)) {
        if (!modelId) continue;
        const node = wake.tree?.['9']?.[tierMap[family]];
        if (node && node['1'] !== 'model ' + modelId) {
          node['1'] = 'model ' + modelId;
          updated = true;
        }
      }
      if (updated) {
        blockSave('wake', wake);
        console.log('[g1] Model resolution: wake updated', families);
      } else {
        console.log('[g1] Model resolution: wake already current');
      }
    } catch (e) {
      console.warn('[g1] Model resolution failed, wake retains existing IDs:', e.message);
    }
  }

  const MAX_MESSAGES = 20;
  const MAX_TOOL_LOOPS = 10;

  // ============ TOOL LAYER CLASSIFICATION ============
  // Layer 4: tools that touch blocks or spawn instances — trigger the Möbius twist (context recompilation)
  // Layer 2: server-side tools (web_search, code_execution) — instance stays alive, no recompilation
  const LAYER4_TOOLS = new Set([
    'block_read', 'block_write', 'block_create', 'block_list',
    'write_entry', 'bsp', 'resolve', 'get_source', 'recompile',
    'call_llm', 'get_datetime', 'compress', 'concerns', 'state_board'
  ]);

  let currentJSX = null;
  let reactRoot = null;
  let currentTools = [];

  // ============ LIVING CURRENTS STATE ============
  let _activationContext = null;  // { echoCount, bLoopCount, blocksChanged } — per callWithToolLoop
  let _activationLock = false;    // concurrency guard

  // ============ PROGRESS DISPLAY ============

  let statusLines = [];
  function status(msg, type = 'info') {
    const time = new Date().toLocaleTimeString();
    statusLines.push({ msg, type, time });
    root.innerHTML = `
      <div style="max-width:600px;margin:40px auto;font-family:monospace;padding:20px">
        <h2 style="color:#67e8f9;margin-bottom:16px">◇ HERMITCRAB G1</h2>
        ${statusLines.map(s => {
          const color = s.type === 'error' ? '#f87171' : s.type === 'success' ? '#4ade80' : '#67e8f9';
          return `<div style="color:${color};margin:4px 0;font-size:13px"><span style="color:#555">${s.time}</span> ${s.msg}</div>`;
        }).join('')}
        <div style="color:#555;margin-top:12px;font-size:11px">${
          statusLines[statusLines.length - 1]?.type === 'error' ? '' : '▪ working...'
        }</div>
      </div>`;
  }

  // ============ SEED LOADER ============

  async function loadSeed() {
    try {
      // Resolve shell.json relative to kernel.js, not the page URL
      const scriptSrc = document.querySelector('script[src*="kernel.js"]')?.src || '';
      const base = scriptSrc ? scriptSrc.replace(/kernel\.js.*$/, '') : '/g1/';
      const res = await fetch(base + 'shell.json');
      if (!res.ok) throw new Error(`shell.json: ${res.status}`);
      const seed = await res.json();
      // v3 format: { blocks: { ... }, constitution?: "..." }
      if (seed.blocks) return seed.blocks;
      // v1 fallback: flat { blockName: blockData, ... }
      return seed;
    } catch (e) {
      console.error('[g1] Failed to load shell.json:', e.message);
      return null;
    }
  }

  // ============ BLOCK STORAGE ============

  function blockLoad(name) {
    const raw = localStorage.getItem(STORE_PREFIX + name);
    return raw ? JSON.parse(raw) : null;
  }

  function blockSave(name, block) {
    localStorage.setItem(STORE_PREFIX + name, JSON.stringify(block));
    if (_activationContext) _activationContext.blocksChanged.add(name);
  }

  function blockList() {
    const names = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(STORE_PREFIX)) names.push(key.slice(STORE_PREFIX.length));
    }
    return names;
  }

  function blockNavigate(block, path) {
    if (!path) return block.tree;
    const keys = path.split('.');
    let node = block.tree;
    for (const k of keys) {
      if (node === null || node === undefined) return null;
      if (typeof node === 'string') return null;
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
    if (node[last] && typeof node[last] === 'object') {
      node[last]._ = content;
    } else {
      node[last] = content;
    }
    return { success: true };
  }

  // ============ X~ SPREAD ============
  // Core lateral-read operation. Returns a node's text + immediate children.
  // Each child reports { digit, text, branch } where branch=true means deeper content exists.
  // Used by bsp spread mode ('~') and internally by kernel functions that scan digit children.

  function xSpread(block, path) {
    const node = path ? blockNavigate(block, path) : block.tree;
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

  // ============ PSCALE NAVIGATION ============
  // These are mechanical operations on the tree — no LLM needed.
  // They implement the touchstone's X+/X-/X~ vocabulary.

  // Get the root of a block — tree itself (pure block: content lives directly under tree)
  function pscaleRoot(block) {
    return { node: block.tree || null, path: '' };
  }

  // Navigate to a path and return {node, parentPath}
  function navigateWithParent(block, path) {
    if (!path) return { node: block.tree, parentPath: null };
    const keys = path.split('.');
    let node = block.tree;
    let parentPath = null;
    for (let i = 0; i < keys.length; i++) {
      if (node === null || node === undefined || typeof node === 'string') return { node: null, parentPath };
      parentPath = keys.slice(0, i).join('.') || null;
      node = node[keys[i]];
    }
    return { node, parentPath };
  }

  // ---- BSP — Block · Spindle · Point ----
  // bsp(block)               → full block tree
  // bsp(block, spindle)      → chain of semantics, one per digit, high pscale to low
  // bsp(block, spindle, ps)  → single semantic at the specified pscale level
  // bsp(block, spindle, '~') → spread (X~): node text + immediate children
  // bsp(block, spindle, '*') → tree: full recursive subtree from endpoint
  //
  // X vocabulary via bsp:
  //   X+ on spindle = change point to pscale+1 (or use shorter spindle)
  //   X- on spindle = change point to pscale-1
  //   X- beyond spindle = bsp(block, spindle, '~') to discover what's deeper
  //   X~ (siblings) = bsp(block, parentSpindle, '~') — spread at parent
  //
  // Pure blocks: { tree: { "_": "...", "1": {...}, ... } }
  // No place field. No tree["0"] wrapper. The number carries the instruction.
  // The decimal point marks pscale 0. Root (tree._) is always included.
  //
  // 0.234 → delineation: strip 0, walk [2,3,4], root is pscale 0
  // 0     → delineation: no walk digits, root only at pscale 0
  // 23.45 → walk [2,3,4,5], root is pscale 2
  // 2345  → walk [2,3,4,5], no pscale (no decimal)

  function bsp(block, spindle, point) {
    const blk = typeof block === 'string' ? blockLoad(block) : block;
    if (!blk || !blk.tree) return { mode: 'block', tree: {} };

    // Block mode — no spindle, return full tree (unless point is a nav mode)
    if ((spindle === undefined || spindle === null) && typeof point !== 'string') {
      return { mode: 'block', tree: blk.tree };
    }

    // Parse the semantic number (or default to root for no-spindle nav modes)
    let walkDigits, hasPscale, digitsBefore;
    if (spindle === undefined || spindle === null) {
      // No spindle but string point mode — operate on root
      walkDigits = [];
      hasPscale = true;
      digitsBefore = 0;
    } else {
      const str = typeof spindle === 'number' ? spindle.toFixed(10) : String(spindle);
      const parts = str.split('.');
      const intStr = parts[0] || '0';
      const fracStr = (parts[1] || '').replace(/0+$/, '');
      // Delineation: integer part is "0" — strip it, walk only fractional digits
      // 0.234 → walk [2,3,4]; bare 0 → walk nothing (root only)
      const isDelineation = intStr === '0';
      walkDigits = isDelineation
        ? fracStr.split('').filter(c => c.length > 0)
        : (intStr + fracStr).split('');
      // Pscale from decimal position
      // Delineation (0 or 0.xxx): root is pscale 0
      // Regular with decimal (23.45): root is pscale = intStr.length
      // No decimal (2345): no pscale
      hasPscale = isDelineation || fracStr.length > 0;
      digitsBefore = isDelineation ? 0 : (hasPscale ? intStr.length : -1);
    }

    // Build spindle — root always included
    const nodes = [];
    let node = blk.tree;

    // Root: the block's identity (tree._)
    const rootText = (typeof node === 'object' && node !== null && typeof node['_'] === 'string')
      ? node['_'] : null;
    if (rootText !== null) {
      nodes.push({ pscale: hasPscale ? digitsBefore : null, text: rootText });
    }

    // Walk digits through the tree
    for (let i = 0; i < walkDigits.length; i++) {
      const d = walkDigits[i];
      if (!node || typeof node !== 'object' || node[d] === undefined) break;
      node = node[d];
      const text = typeof node === 'string'
        ? node
        : (typeof node === 'object' && node !== null && typeof node['_'] === 'string')
          ? node['_']
          : JSON.stringify(node);
      nodes.push({
        pscale: hasPscale ? (digitsBefore - 1) - i : null,
        digit: d,
        text
      });
    }

    if (nodes.length === 0) return { mode: 'spindle', nodes: [] };

    // Point mode — return the semantic at the specified pscale level
    // String modes: '~' = spread (X~), '*' = tree (recursive subtree)
    if (point !== undefined && point !== null) {
      // Defensive: API may send numeric point as string (e.g. "-3" instead of -3)
      if (typeof point === 'string' && !isNaN(Number(point)) && point !== '~' && point !== '*') {
        point = Number(point);
      }
      if (typeof point === 'string') {
        const endPath = walkDigits.length > 0 ? walkDigits.join('.') : null;
        if (point === '~') {
          // Spread: node text + immediate children (X~)
          const spread = xSpread(blk, endPath);
          if (!spread) return { mode: 'spread', path: endPath, text: null, children: [] };
          return { mode: 'spread', path: endPath, ...spread };
        }
        if (point === '*') {
          // Tree: full recursive subtree from endpoint
          const endNode = endPath ? blockNavigate(blk, endPath) : blk.tree;
          if (!endNode) return { mode: 'tree', path: endPath, text: null, children: [] };
          const subtree = resolveBlock({ tree: endNode }, 9);
          return { mode: 'tree', path: endPath, text: subtree.text, children: subtree.children };
        }
        return { mode: 'error', error: `Unknown point mode: ${point}` };
      }
      // Numeric: pscale extraction
      const target = nodes.find(n => n.pscale === point);
      if (target) return { mode: 'point', text: target.text, pscale: target.pscale };
      const last = nodes[nodes.length - 1];
      return { mode: 'point', text: last.text, pscale: last.pscale };
    }

    // Spindle mode — return the full chain, high pscale to low
    return { mode: 'spindle', nodes };
  }

  // Resolve — phrase-level view of a block (pscale 0 text of every node, one level deep)
  function resolveBlock(block, maxDepth) {
    maxDepth = maxDepth || 3;
    function walk(node, depth, path) {
      if (depth > maxDepth) return null;
      if (typeof node === 'string') return { path, text: node };
      if (!node) return null;
      const result = { path, text: node._ || null, children: [] };
      for (const [k, v] of Object.entries(node)) {
        if (k === '_') continue;
        const childPath = path ? `${path}.${k}` : k;
        const child = walk(v, depth + 1, childPath);
        if (child) result.children.push(child);
      }
      return result;
    }
    return walk(block.tree, 0, '');
  }

  // Find next unoccupied digit (1-9) at a node, for adding entries
  function findUnoccupiedDigit(block, path) {
    const node = path ? blockNavigate(block, path) : block.tree;
    if (!node || typeof node === 'string') return { digit: '1', note: 'Node is leaf — will become branch' };
    for (let d = 1; d <= 9; d++) {
      if (!node[String(d)]) return { digit: String(d) };
    }
    return { full: true, note: 'Digits 1-9 all occupied — compression needed' };
  }

  // Check if compression is needed at a node (all digits 1-9 occupied)
  function checkCompression(block, path) {
    const node = path ? blockNavigate(block, path) : block.tree;
    if (!node || typeof node === 'string') return { needed: false };
    let occupied = 0;
    for (let d = 1; d <= 9; d++) {
      if (node[String(d)] !== undefined) occupied++;
    }
    return { needed: occupied >= 9, occupied };
  }

  // ============ SEED BLOCKS ============

  function seedBlocks(seed) {
    if (!seed) return false;
    let seeded = 0;
    for (const [name, block] of Object.entries(seed)) {
      if (!blockLoad(name)) { blockSave(name, block); seeded++; }
    }
    return seeded;
  }

  // ============ PROMPT COMPILER (bsp-native) ============
  // The prompt is composed by executing a list of bsp instructions stored in wake 0.9.
  // Each tier (1=Light, 2=Present, 3=Deep) has its own instruction list.
  // The kernel executes these mechanically. The LLM modifies them in deep state.
  //
  // Instruction format (string):
  //   "block"                → bsp block mode (full content)
  //   "block spindle"        → bsp spindle mode (digit chain)
  //   "block spindle pscale" → bsp point mode (single semantic)

  // Get pscale 0 text from a block — the root summary (tree._).
  function getPscale0(block) {
    if (!block) return '';
    const tree = block.tree;
    if (!tree) return '';
    return typeof tree === 'string' ? tree : (tree._ || '');
  }

  // Parse a prompt instruction string into bsp arguments.
  function parseInstruction(instr) {
    const parts = instr.trim().split(/\s+/);
    const blockName = parts[0];
    const spindle = parts.length > 1 ? parseFloat(parts[1]) : undefined;
    const point = parts.length > 2 ? parseFloat(parts[2]) : undefined;
    return { blockName, spindle, point };
  }

  // Execute one bsp instruction and format the result for the prompt.
  function executeInstruction(instr) {
    const { blockName, spindle, point } = parseInstruction(instr);
    const block = blockLoad(blockName);
    if (!block) return '';

    const result = bsp(block, spindle, point);

    if (result.mode === 'block') {
      // Full block — format as block name + structured content
      return `[${blockName}]\n${formatBlockContent(block)}`;
    }

    if (result.mode === 'spindle') {
      if (result.nodes.length === 0) return '';
      const lines = result.nodes.map(n => `  [${n.pscale}] ${n.text}`);
      return `[${blockName} ${spindle}]\n${lines.join('\n')}`;
    }

    if (result.mode === 'point') {
      return `[${blockName} ${spindle} ${point}] ${result.text}`;
    }

    return '';
  }

  // Format full block content for the prompt.
  // Renders the pscale JSON as indented text the LLM can read.
  function formatBlockContent(block) {
    const lines = [];
    function render(node, depth) {
      if (typeof node === 'string') {
        lines.push('  '.repeat(depth) + node);
        return;
      }
      if (!node || typeof node !== 'object') return;
      if (node._) lines.push('  '.repeat(depth) + node._);
      for (const [k, v] of Object.entries(node)) {
        if (k === '_') continue;
        if (typeof v === 'string') {
          lines.push('  '.repeat(depth) + `${k}: ${v}`);
        } else {
          lines.push('  '.repeat(depth) + `${k}:`);
          render(v, depth + 1);
        }
      }
    }
    render(block.tree, 0);
    return lines.join('\n');
  }

  // Read the instruction list for a package from wake 0.9.{packageId}
  // packageId: 1=Light, 2=Present, 3=Deep, 7=Heartbeat, 8=Signal response
  function getPromptInstructions(packageId) {
    const wake = blockLoad('wake');
    if (!wake) return [];
    // wake 0.9.{packageId} — spread to get all instruction strings
    const spread = xSpread(wake, '9.' + packageId);
    if (!spread) return [];
    return spread.children.filter(c => c.text).map(c => c.text);
  }

  // Read invocation parameters for a tier from wake 0.9.{tier+3}
  // Returns { model, max_tokens, thinking?, max_tool_loops?, max_messages? }
  function getTierParams(tier) {
    const wake = blockLoad('wake');
    const fallbackModel = tier === 1 ? FALLBACK_FAST_MODEL : FALLBACK_MODEL;
    if (!wake) return { model: fallbackModel, max_tokens: 8192 };
    // wake 0.9.{tier+3} — spread to get key-value parameter strings
    const spread = xSpread(wake, '9.' + (tier + 3));
    if (!spread) return { model: fallbackModel, max_tokens: 8192 };
    const params = {};
    for (const child of spread.children) {
      if (child.text) {
        const spaceIdx = child.text.indexOf(' ');
        if (spaceIdx > 0) {
          params[child.text.substring(0, spaceIdx)] = child.text.substring(spaceIdx + 1);
        }
      }
    }
    const result = {
      model: params.model || fallbackModel,
      max_tokens: parseInt(params.max_tokens) || 8192,
    };
    // Parse thinking: "enabled 8000" or "adaptive"
    if (params.thinking) {
      const parts = params.thinking.split(' ');
      if (parts[0] === 'enabled' && parts[1]) {
        result.thinking = { type: 'enabled', budget_tokens: parseInt(parts[1]) };
      } else if (parts[0] === 'adaptive') {
        result.thinking = { type: 'adaptive' };
      }
    }
    if (params.max_tool_loops) result.max_tool_loops = parseInt(params.max_tool_loops);
    if (params.max_messages) result.max_messages = parseInt(params.max_messages);
    return result;
  }

  // Detect first boot: history block has no digit children (no entries yet)
  function isFirstBoot() {
    const history = blockLoad('history');
    if (!history || !history.tree) return true;
    for (let d = 1; d <= 9; d++) {
      if (history.tree[String(d)] !== undefined) return false;
    }
    return true;
  }

  // Read birth instructions from wake 6.5.{sibling} — complete context window for first boot.
  // Default sibling 1 (shallow). Returns instruction strings or null.
  function getBirthInstructions(sibling) {
    sibling = sibling || 1;
    const wake = blockLoad('wake');
    if (!wake) return null;
    // wake 0.6.5.{sibling} — spread to get instruction strings
    const spread = xSpread(wake, '6.5.' + sibling);
    if (!spread) return null;
    const instructions = spread.children.filter(c => c.text).map(c => c.text);
    return instructions.length > 0 ? instructions : null;
  }

  // Read birth stimulus from wake 0.6.5.3.{variant}.1
  // Priority: custom message (localStorage, one-shot) > URL ?bv=N > wake 0.4.7 birth_variant.
  // Returns the variant text, or null if not found (falls back to hardcoded).
  function getBirthStimulus() {
    // Custom birth message from launcher dev mode — one-shot, cleared after read
    const custom = localStorage.getItem('hermitcrab_birth_custom');
    if (custom) {
      localStorage.removeItem('hermitcrab_birth_custom');
      console.log('[g1] Birth stimulus: custom message from launcher');
      return custom;
    }
    const wake = blockLoad('wake');
    if (!wake) return null;
    // URL param takes precedence (user selected at launcher)
    const urlBv = new URLSearchParams(window.location.search).get('bv');
    let variant = urlBv ? parseInt(urlBv) : 0;
    // Fall back to wake 0.4.7 loop parameters
    if (!variant) {
      const loopParams = wake.tree?.['4']?.['7'];
      variant = 1;
      if (typeof loopParams === 'string') {
        const match = loopParams.match(/birth_variant:\s*(\d)/);
        if (match) variant = parseInt(match[1]);
      }
    }
    // Read variant text: wake 0.6.5.3.{variant} is { _: description, 1: text }
    const variantNode = wake.tree?.['6']?.['5']?.['3']?.[String(variant)];
    if (!variantNode) return null;
    if (typeof variantNode === 'string') return variantNode;
    return variantNode['1'] || variantNode['_'] || null;
  }

  // Build the system prompt by executing a BSP instruction list.
  // tier: 1=Light, 2=Present, 3=Deep (determines invocation params)
  // opts.package: override which BSP package to use (e.g. 7=heartbeat, 8=signal)
  // opts.orientation: prepend concern orientation text to the prompt
  // On first boot (deep tier), uses birth instructions from wake 6.5 instead of tier 9.3.
  function buildSystemPrompt(tier, opts) {
    tier = tier || 3; // default to deep
    opts = opts || {};
    const packageId = opts.package || tier;

    // First boot at deep tier: use birth instructions instead of regular deep tier
    let instructions;
    if (tier === 3 && isFirstBoot()) {
      instructions = getBirthInstructions(1) || getPromptInstructions(packageId);
      console.log('[g1] First boot detected — using birth instructions');
    } else {
      instructions = getPromptInstructions(packageId);
    }

    if (instructions.length === 0) {
      // Fallback: if no instructions found, return pscale 0 of all blocks (aperture)
      const names = blockList();
      return names.map(name => {
        const block = blockLoad(name);
        return block ? `[${name}] ${getPscale0(block)}` : '';
      }).filter(l => l).join('\n\n');
    }

    const sections = [];

    // Orientation from concern — sets the frame for this activation
    if (opts.orientation) {
      sections.push(`[orientation] ${opts.orientation}`);
    }

    for (const instr of instructions) {
      const result = executeInstruction(instr);
      if (result) sections.push(result);
    }
    return sections.join('\n\n');
  }

  // ============ CONCERN MATCHING ============
  // Read concern definitions from wake and match incoming stimulus.
  // Concerns live in wake 0.4.5 (internal) and 0.5.6-7 (external).
  // Each concern has: package (_.1), tier (_.2), trigger (_.3), orientation (_.4).

  function readConcerns() {
    const wake = blockLoad('wake');
    if (!wake) return [];
    const concerns = [];
    // Internal concerns: wake 0.4.5.{digit}
    const internal = wake.tree?.['4']?.['5'];
    if (internal && typeof internal === 'object') {
      for (let d = 1; d <= 9; d++) {
        const c = internal[String(d)];
        if (c && typeof c === 'object') {
          concerns.push({ id: `4.5.${d}`, name: c._ || '', ...parseConcern(c) });
        }
      }
    }
    // External concerns: wake 0.5.{6,7,...}
    for (let d = 6; d <= 9; d++) {
      const c = wake.tree?.['5']?.[String(d)];
      if (c && typeof c === 'object') {
        concerns.push({ id: `5.${d}`, name: c._ || '', ...parseConcern(c) });
      }
    }
    return concerns;
  }

  function parseConcern(node) {
    const pkg = node['1'] || '';
    const tierStr = node['2'] || '';
    const trigger = node['3'] || '';
    const orientation = node['4'] || null;
    // Parse "package 9.7" → 7, "package 9.2 (present)" → 2
    const pkgMatch = pkg.match(/(\d+)\.(\d+)/);
    const packageId = pkgMatch ? parseInt(pkgMatch[2]) : null;
    // Parse tier: extract first word (haiku→1, sonnet→2, opus→3)
    const tierMap = { haiku: 1, mechanical: 1, sonnet: 2, opus: 3 };
    const tierWord = tierStr.split(/[\s,]/)[1] || tierStr.split(/[\s,]/)[0] || '';
    const tier = tierMap[tierWord.toLowerCase()] || 2;
    return { packageId, tier, trigger, orientation };
  }

  function matchConcern(triggerType) {
    const concerns = readConcerns();
    // Simple keyword matching for G1
    const match = concerns.find(c => {
      const name = c.name.toLowerCase();
      if (triggerType === 'user' && name.includes('user engagement')) return true;
      if (triggerType === 'heartbeat' && name.includes('heartbeat')) return true;
      if (triggerType === 'self-maintenance' && name.includes('self-maintenance')) return true;
      if (triggerType === 'signal' && name.includes('external signal')) return true;
      return false;
    });
    // Default: user engagement at present tier
    return match || { packageId: 2, tier: 2, orientation: null };
  }

  // ============ STATE BOARD ============
  // Mechanical tracking of loop states. No LLM call.
  // Persisted in localStorage. Checked by heartbeat concern.

  const STATE_KEY = 'hc_state_board';

  function stateBoard() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : { loops: {}, lastCheck: null };
    } catch { return { loops: {}, lastCheck: null }; }
  }

  function stateUpdate(loopId, state) {
    const board = stateBoard();
    board.loops[loopId] = { state, updated: Date.now() };
    board.lastCheck = Date.now();
    localStorage.setItem(STATE_KEY, JSON.stringify(board));
    return board;
  }

  function stateCheck() {
    // Returns any loops that need attention (hanging, holding too long)
    const board = stateBoard();
    const now = Date.now();
    const flags = [];
    for (const [id, loop] of Object.entries(board.loops)) {
      const age = now - loop.updated;
      if (loop.state === 'hanging' || (loop.state === 'holding' && age > 30 * 60000) || (loop.state === 'pending' && age > 2 * 3600000)) {
        flags.push({ id, ...loop, age_minutes: Math.round(age / 60000) });
      }
    }
    return flags;
  }

  // ============ API LAYER ============

  async function callAPI(params) {
    const apiKey = localStorage.getItem('hermitcrab_api_key');
    if (!params.model) params.model = FALLBACK_MODEL;
    // Inject current tools if caller didn't provide any
    if (!params.tools && currentTools.length > 0) params.tools = currentTools;
    // Defensive: strip system-role messages, promote to system param
    if (params.messages) {
      const sysMsg = params.messages.filter(m => m.role === 'system');
      if (sysMsg.length > 0) {
        if (!params.system) params.system = sysMsg.map(m => m.content).join('\n');
        params.messages = params.messages.filter(m => m.role !== 'system');
      }
    }
    const clean = {};
    for (const [k, v] of Object.entries(params)) {
      if (k.startsWith('_') || v === undefined || v === null) continue;
      clean[k] = v;
    }
    if (clean.thinking && clean.temperature !== undefined && clean.temperature !== 1) delete clean.temperature;
    console.log('[g1] callAPI \u2192', clean.model, 'messages:', clean.messages?.length, 'tools:', clean.tools?.length);

    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify(clean)
    });
    if (!res.ok) { const err = await res.text(); throw new Error(`API ${res.status}: ${err}`); }
    const data = await res.json();
    if (data.type === 'error') throw new Error(`Claude API: ${data.error?.message || JSON.stringify(data.error)}`);
    console.log('[g1] API response:', data.stop_reason, 'blocks:', data.content?.length);
    return data;
  }

  // ============ LIVING CURRENTS ============
  // After each Layer 4 tool round, recompile the system prompt from current block state.
  // Process orientation via BSP: the kernel writes echo-specific content into the process
  // spindle (wake 0.6.7.3-4) then extracts via bsp() — same format as everything else.

  function compileProcessPoint(ctx) {
    const wake = blockLoad('wake');
    if (!wake || !wake.tree?.['6']?.['7']) {
      return `[focus] echo ${ctx.echoCount} | B loops: ${ctx.bLoopCount}`;
    }
    // Write mutable content into process spindle (wake 0.6.7.3 = this echo, 0.6.7.4 = available)
    const processNode = wake.tree['6']['7'];
    const changed = ctx.blocksChanged.size > 0 ? [...ctx.blocksChanged].join(', ') : 'none';

    // Threshold check: at B loop intervals, inject review signal
    // Parse threshold_interval from wake 0.4.7 (default 10)
    let thresholdInterval = 10;
    const loopParams = wake.tree?.['4']?.['7'];
    if (typeof loopParams === 'string') {
      const tiMatch = loopParams.match(/threshold_interval:\s*(\d+)/);
      if (tiMatch) thresholdInterval = parseInt(tiMatch[1]);
    }
    let thresholdSignal = '';
    if (ctx.bLoopCount > 0 && ctx.bLoopCount % thresholdInterval === 0) {
      if (ctx.bLoopCount >= 100) {
        thresholdSignal = ` THRESHOLD REVIEW (B:${ctx.bLoopCount}): Extended activation. Assess: are you producing or drifting? Consider concluding.`;
      } else {
        thresholdSignal = ` Checkpoint (B:${ctx.bLoopCount}): Brief self-check \u2014 productive or looping?`;
      }
    }

    processNode['3'] = `Echo ${ctx.echoCount}. B loop ${ctx.bLoopCount}. Blocks changed: ${changed}. Currents recompiled from current block state.${thresholdSignal}`;
    const remaining = MAX_TOOL_LOOPS - ctx.echoCount;
    processNode['4'] = `Budget: ${remaining} echoes remaining. Batch Layer 4 tools to maximise each echo. Layer 2 tools (web_search, code_execution) do not consume echoes.`;
    blockSave('wake', wake);
    // Full spindle — the instance reads the progressive narrowing, not just the leaf
    const result = bsp('wake', 0.673);
    if (result.mode === 'spindle' && result.nodes.length > 0) {
      return result.nodes.map(n => `  [${n.pscale}] ${n.text}`).join('\n');
    }
    return `[focus] echo ${ctx.echoCount}`;
  }

  // ============ BLINK MECHANISM (Loop C) ============
  // Inter-instance coordination. At the end of each activation:
  // 1. Snapshot purpose pscale-0 (the live intention summary)
  // 2. If it changed since last blink, write the delta to history with process coordinates
  // 3. Update the snapshot for the next activation
  // Pure Locus 3 maintenance — no LLM call. ~20 lines of mechanical code.
  // The history of future-intention: not what happened, but how intention shifted.

  function executeBlink(ctx) {
    try {
      const purpose = blockLoad('purpose');
      if (!purpose) return;
      const currentP0 = getPscale0(purpose);
      if (!currentP0) return; // purpose has no root text yet (pre-birth)

      const board = stateBoard();
      const prevSnapshot = board.purposeSnapshot || null;

      // If purpose pscale-0 changed, record the delta to history
      if (prevSnapshot !== null && prevSnapshot !== currentP0) {
        const history = blockLoad('history');
        if (history) {
          const slot = findUnoccupiedDigit(history, '');
          if (!slot.full) {
            const ts = new Date().toISOString();
            const entry = `[blink ${ts} echoes:${ctx.echoCount} B:${ctx.bLoopCount}] Purpose shifted. Was: ${prevSnapshot.substring(0, 300)}`;
            blockWriteNode(history, slot.digit, entry);
            blockSave('history', history);
            console.log(`[g1] Blink: purpose delta → history.${slot.digit}`);
          }
        }
      }

      // Update snapshot for next activation's blink
      board.purposeSnapshot = currentP0;
      board.lastBlink = Date.now();
      board.lastBlinkEchoes = ctx.echoCount;
      localStorage.setItem(STATE_KEY, JSON.stringify(board));
      console.log(`[g1] Blink: purpose snapshot updated (${currentP0.length} chars)`);
    } catch (e) {
      console.error('[g1] Blink failed:', e);
    }
  }

  async function callWithToolLoop(params, maxLoops, onStatus) {
    maxLoops = maxLoops || MAX_TOOL_LOOPS;

    // Living currents: activation context tracks block changes and B loop cycles
    const prevContext = _activationContext;
    _activationContext = { echoCount: 0, bLoopCount: 0, blocksChanged: new Set() };

    try {
      let response = await callAPI(params);
      let loops = 0;
      let allMessages = [...params.messages];

      while ((response.stop_reason === 'tool_use' || response.stop_reason === 'pause_turn') && loops < maxLoops) {
        loops++;
        const content = response.content || [];
        const clientToolBlocks = content.filter(b => b.type === 'tool_use');
        const serverToolBlocks = content.filter(b => b.type === 'server_tool_use');

        // Log server-side tool activity (we don't execute these — Anthropic does)
        for (const block of serverToolBlocks) {
          if (onStatus) onStatus(`server: ${block.name}`);
          console.log(`[g1] Server tool: ${block.name}`, block.input);
        }

        // pause_turn with no client tools = server still processing, continue
        if (response.stop_reason === 'pause_turn' && clientToolBlocks.length === 0) {
          if (onStatus) onStatus('server processing...');
          allMessages = [...allMessages, { role: 'assistant', content: response.content }];
          response = await callAPI({ ...params, messages: allMessages });
          continue;
        }

        if (clientToolBlocks.length === 0) break;

        for (const block of clientToolBlocks) {
          if (onStatus) onStatus(`tool: ${block.name}`);
          console.log(`[g1] Tool #${loops}: ${block.name}`, block.input);
        }

        const results = [];
        let recompiledThisIteration = false;
        for (const block of clientToolBlocks) {
          const result = await executeTool(block.name, block.input);
          console.log(`[g1] Tool result (${block.name}):`, typeof result === 'string' ? result.substring(0, 200) : result);
          results.push({ type: 'tool_result', tool_use_id: block.id, content: typeof result === 'string' ? result : JSON.stringify(result) });
          if (block.name === 'recompile') recompiledThisIteration = true;
        }

        // If recompile was called during THIS iteration, stop — the shell is live
        if (recompiledThisIteration) {
          console.log('[g1] Shell recompiled during tool loop — exiting');
          response._recompiledDuringLoop = true;
          break;
        }

        allMessages = [...allMessages, { role: 'assistant', content: response.content }, { role: 'user', content: results }];

        // Möbius twist: only recompile when Layer 4 tools were in the batch
        const hasLayer4 = clientToolBlocks.some(b => LAYER4_TOOLS.has(b.name));
        if (params._tier && hasLayer4) {
          _activationContext.echoCount++;
          _activationContext.bLoopCount++;
          const freshSystem = buildSystemPrompt(params._tier, params._buildOpts);
          const processPoint = compileProcessPoint(_activationContext);
          params = { ...params, system: processPoint + '\n\n' + freshSystem };
          console.log(`[g1] Möbius twist: echo ${_activationContext.echoCount}, B loop ${_activationContext.bLoopCount}, blocks changed: ${[..._activationContext.blocksChanged].join(', ') || 'none'}`);
          _activationContext.blocksChanged.clear();
        } else if (params._tier) {
          // Layer 2 only — Loop A continues, no recompilation
          console.log(`[g1] Loop A: Layer 2 tools only, no twist`);
        }

        response = await callAPI({ ...params, messages: allMessages });
      }

      autoSaveToHistory(response, _activationContext.echoCount);
      executeBlink(_activationContext);
      response._messages = allMessages;
      response._echoCount = _activationContext.echoCount;
      return response;

    } finally {
      _activationContext = prevContext;
    }
  }

  // Auto-save assistant responses to history block (kernel-level, not LLM-initiated).
  // Full text, no truncation. Loop-structured: includes echo count for temporal navigation.
  // Writes at next unoccupied digit under root. Compression triggered explicitly when full.
  function autoSaveToHistory(response, echoCount) {
    try {
      const texts = (response.content || []).filter(b => b.type === 'text');
      if (texts.length === 0) return;
      const block = blockLoad('history');
      if (!block) return;
      const slot = findUnoccupiedDigit(block, '');
      if (slot.full) {
        console.log('[g1] history block full at root — compression needed');
        return;
      }
      const fullText = texts.map(b => b.text).join('\n');
      const echoTag = echoCount > 0 ? ` echoes:${echoCount}` : '';
      const entry = `[${new Date().toISOString()}${echoTag}] ${fullText}`;
      const writePath = slot.digit;
      blockWriteNode(block, writePath, entry);
      blockSave('history', block);
      console.log(`[g1] auto-saved to history at ${writePath} (${fullText.length} chars, ${echoCount || 0} echoes)`);
    } catch (e) { console.error('[g1] auto-save failed:', e); }
  }

  function trimMessages(messages, maxMessages) {
    const limit = maxMessages || MAX_MESSAGES;
    if (messages.length <= limit) return messages;
    const trimmed = messages.slice(-limit);
    // Inject trim notice as first message if we cut anything
    const notice = { role: 'user', content: `[Conversation trimmed to last ${limit} messages. Write to history or stash block to preserve important context.]` };
    return [notice, ...trimmed];
  }

  async function callLLM(messages, opts = {}) {
    // Concurrency guard: one activation at a time
    if (_activationLock) {
      console.log('[g1] Activation in progress — cannot start new one');
      return '[activation in progress]';
    }
    _activationLock = true;

    try {
      const tier = opts.tier || 2; // default: present
      const tp = getTierParams(tier);
      // Defensive: strip system-role messages from array, promote to system param
      const cleaned = (messages || []).filter(m => {
        if (m.role === 'system') {
          if (!opts.system) opts.system = m.content;
          return false;
        }
        return true;
      });
      const trimmed = trimMessages(cleaned, tp.max_messages);
      const buildOpts = { package: opts.package, orientation: opts.orientation };
      const params = {
        model: opts.model || tp.model,
        max_tokens: opts.max_tokens || tp.max_tokens,
        system: opts.system || buildSystemPrompt(tier, buildOpts),
        messages: trimmed,
        tools: opts.tools !== undefined ? opts.tools : currentTools,
        _tier: tier,
        _buildOpts: buildOpts,
      };
      if (opts.thinking !== false && tp.thinking) {
        params.thinking = tp.thinking;
        if (tp.thinking.budget_tokens && params.max_tokens <= tp.thinking.budget_tokens) {
          params.max_tokens = tp.thinking.budget_tokens + 1024;
        }
      }
      if (opts.temperature !== undefined) params.temperature = opts.temperature;

      const response = await callWithToolLoop(params, tp.max_tool_loops || MAX_TOOL_LOOPS, opts.onStatus);
      if (opts.raw) return response;
      const texts = (response.content || []).filter(b => b.type === 'text');
      return texts.map(b => b.text).join('\n') || '';
    } finally {
      _activationLock = false;
    }
  }

  // ============ TOOL DEFINITIONS ============

  const BOOT_TOOLS = [
    {
      name: 'block_read',
      description: 'Read a pscale JSON block by name. Optionally navigate to a specific path (e.g. "0.3.1"). Returns node content plus one level of lookahead (immediate children).',
      input_schema: { type: 'object', properties: { name: { type: 'string', description: 'Block name (e.g. memory, identity, capabilities)' }, path: { type: 'string', description: 'Optional dot-separated path into the block (e.g. "0.3.1")' } }, required: ['name'] }
    },
    {
      name: 'block_write',
      description: 'Write content to a specific path in a block. Creates intermediate nodes as needed. If the target is a branch, updates its _ text.',
      input_schema: { type: 'object', properties: { name: { type: 'string', description: 'Block name' }, path: { type: 'string', description: 'Dot-separated path (e.g. "0.1")' }, content: { type: 'string', description: 'Text content to write' } }, required: ['name', 'path', 'content'] }
    },
    {
      name: 'block_list',
      description: 'List all stored blocks with their pscale-0 summaries. Returns [{name, pscale0}] — a menu of what exists and what each block is.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'block_create',
      description: 'Create a new pure block. The tree field holds all content. tree._ is the root summary (pscale 0).',
      input_schema: { type: 'object', properties: { name: { type: 'string', description: 'Block name' }, pscale0: { type: 'string', description: 'Root summary — what this block is (becomes tree._)' } }, required: ['name', 'pscale0'] }
    },
    {
      name: 'get_source',
      description: 'Get the JSX source code of your current React shell.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'recompile',
      description: 'Hot-swap your React shell with new JSX code. The new component replaces the current one immediately. Props: { callLLM(messages, opts?), callAPI, callWithToolLoop, model, fastModel, React, ReactDOM, getSource, recompile, setTools, browser, conversation: {save, load}, blockRead, blockWrite, blockList, blockCreate, bsp, resolve, version, localStorage }. IMPORTANT: To send a message to the LLM, use props.callLLM([{role:"user",content:text}]). It returns a string response. conversation.save/load are for persistence only, NOT for sending messages.',
      input_schema: { type: 'object', properties: { jsx: { type: 'string', description: 'Complete JSX source for the new React component' } }, required: ['jsx'] }
    },
    {
      name: 'get_datetime',
      description: 'Get current date, time, timezone, and unix timestamp.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'call_llm',
      description: 'Delegate a task to an LLM. Use model "fast" for cheap/quick work (validation, formatting, extraction) or "default" for deep work. Returns the text response. You are Opus — delegate execution, keep the thinking.',
      input_schema: { type: 'object', properties: { prompt: { type: 'string', description: 'The task prompt' }, model: { type: 'string', enum: ['default', 'fast'], description: 'default = Opus, fast = Haiku' }, system: { type: 'string', description: 'Optional system prompt for the delegate' } }, required: ['prompt'] }
    },
    {
      name: 'concerns',
      description: 'List all active concerns (awareness bubbles). Each concern maps: trigger → BSP package → tier. Shows what the hermitcrab is sensitive to between instances.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'state_board',
      description: 'Read or update the loop state board. Without input: returns all loop states and any flags. With loopId and state: updates that loop. States: empty, holding, pending, hanging, complete.',
      input_schema: { type: 'object', properties: { loopId: { type: 'string', description: 'Loop identifier to update (e.g. "user-session", "signal-queue")' }, state: { type: 'string', enum: ['empty', 'holding', 'pending', 'hanging', 'complete'], description: 'New state for the loop' } } }
    }
  ];

  // ============ PSCALE TOOLS ============
  // These match the touchstone's vocabulary 1:1.
  // Mechanical operations — the kernel does the tree traversal.
  // The LLM only thinks when thinking is needed (compression, deciding what to write).

  const PSCALE_TOOLS = [
    {
      name: 'bsp',
      description: 'Block · Spindle · Point — semantic address resolution. One function, five modes.\n\nbsp(name) → full block tree\nbsp(name, 0.21) → spindle: root then walked digits [2,1]\nbsp(name, 0.21, -1) → point: semantic at pscale -1\nbsp(name, 0.21, "~") → spread (X~): node text + immediate children\nbsp(name, 0.21, "*") → tree: full recursive subtree\n\nX vocabulary: X+ = bsp with higher pscale or shorter spindle. X- = lower pscale, or "~" at endpoint to discover deeper paths. X~ (siblings) = "~" at parent spindle.\n\nPure blocks. Leading 0 in 0.xxx is stripped (delineation). Remaining digits walk the tree. Root (tree._) always included.',
      input_schema: { type: 'object', properties: { name: { type: 'string', description: 'Block name (e.g. "capabilities", "purpose", "touchstone")' }, spindle: { type: 'number', description: 'Semantic number. Leading 0. stripped (delineation). Remaining digits walk the tree. 0.21 walks [2,1]. 23.41 walks [2,3,4,1].' }, point: { description: "Number: pscale level for a single semantic (-1, 0, etc). String '~': spread (X~ — node + children). String '*': tree (full subtree).", oneOf: [{ type: 'number' }, { type: 'string', enum: ['~', '*'] }] } }, required: ['name'] }
    },
    {
      name: 'resolve',
      description: 'Phrase-level view of a block — the tree structure with text at each node, up to a given depth. Good for orientation.',
      input_schema: { type: 'object', properties: { name: { type: 'string', description: 'Block name' }, depth: { type: 'integer', description: 'Max depth to traverse (default 3)', default: 3 } }, required: ['name'] }
    },
    {
      name: 'write_entry',
      description: 'Add a new entry at the next unoccupied digit (1-9) at a node. If all digits occupied, reports compression needed. The kernel finds the slot — you provide the content.',
      input_schema: { type: 'object', properties: { name: { type: 'string', description: 'Block name' }, path: { type: 'string', description: 'Path to the parent node where the entry should be added' }, content: { type: 'string', description: 'Text content for the new entry' } }, required: ['name', 'path', 'content'] }
    },
    {
      name: 'compress',
      description: 'Trigger compression at a node whose digits 1-9 are full. Delegates to an LLM to determine summary vs emergence and write the result to the parent _ text. Returns the compression result.',
      input_schema: { type: 'object', properties: { name: { type: 'string', description: 'Block name' }, path: { type: 'string', description: 'Path to the node to compress' } }, required: ['name', 'path'] }
    }
  ];

  // ============ SERVER-SIDE TOOLS ============
  // Processed by Anthropic's servers, not the kernel. Available but not forced —
  // the LLM decides when to use them. These cost money per use (each triggers a
  // sub-call within the intra-loop). At birth the priority is orient + build UI.
  // The thinking-LLM can choose to search/fetch when it needs external information.
  // Server-side tools: web_search and web_fetch use type-based definitions
  // (no beta header needed). code_execution removed — fallback only, re-add when needed.
  const SERVER_TOOLS = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 10 }
  ];

  // Client-side tools the LLM can use alongside server tools
  const CLIENT_TOOLS = [
    {
      name: 'fetch_url',
      description: 'Backup URL fetch via proxy. Use when native web_fetch fails (JS-rendered pages, blocked domains). Routes through hermitcrab proxy server.',
      input_schema: { type: 'object', properties: { url: { type: 'string', description: 'The full URL to fetch (including https://)' } }, required: ['url'] }
    }
  ];

  const DEFAULT_TOOLS = [...SERVER_TOOLS, ...CLIENT_TOOLS, ...PSCALE_TOOLS];

  // ============ TOOL EXECUTION ============

  async function executeTool(name, input) {
    switch (name) {
      case 'block_read': {
        const block = blockLoad(input.name);
        if (!block) return JSON.stringify({ error: `Block "${input.name}" not found` });
        if (input.path) return JSON.stringify(blockReadNode(block, input.path));
        return JSON.stringify(block);
      }
      case 'block_write': {
        const block = blockLoad(input.name);
        if (!block) return JSON.stringify({ error: `Block "${input.name}" not found` });
        const result = blockWriteNode(block, input.path, input.content);
        blockSave(input.name, block);
        return JSON.stringify(result);
      }
      case 'block_list': {
        // Enhanced: return pscale-0 sentences alongside names
        const names = blockList();
        const menu = names.map(name => {
          const b = blockLoad(name);
          const p0 = b ? getPscale0(b) : '';
          return { name, pscale0: p0 };
        });
        return JSON.stringify(menu);
      }
      case 'block_create': {
        if (blockLoad(input.name)) return JSON.stringify({ error: `Block "${input.name}" already exists` });
        // Pure block: tree._ is the root summary
        blockSave(input.name, { tree: { "_": input.pscale0 } });
        return JSON.stringify({ success: true, name: input.name });
      }
      case 'get_source':
        return currentJSX || '(no source available)';
      case 'recompile':
        return JSON.stringify(recompile(input.jsx));
      case 'get_datetime':
        return JSON.stringify({ iso: new Date().toISOString(), unix: Date.now(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, local: new Date().toLocaleString() });
      case 'call_llm': {
        const delegateTier = input.model === 'fast' ? 1 : 3;
        const tp = getTierParams(delegateTier);
        const res = await callAPI({
          model: tp.model,
          max_tokens: tp.max_tokens,
          system: input.system || 'You are a delegate. Complete the task. Return only the result.',
          messages: [{ role: 'user', content: input.prompt }],
          tools: [],
          thinking: tp.thinking,
        });
        const texts = (res.content || []).filter(b => b.type === 'text');
        return texts.map(b => b.text).join('\n') || '(no response)';
      }
      // ---- Pscale tools (touchstone vocabulary) ----
      case 'bsp': {
        const result = bsp(input.name, input.spindle, input.point);
        if (result.mode === 'block' && Object.keys(result.tree).length === 0) {
          return JSON.stringify({ error: `Block "${input.name}" not found` });
        }
        return JSON.stringify(result);
      }
      case 'resolve': {
        const block = blockLoad(input.name);
        if (!block) return JSON.stringify({ error: `Block "${input.name}" not found` });
        return JSON.stringify(resolveBlock(block, input.depth || 3));
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
        if (!check.needed) return JSON.stringify({ error: `Only ${check.occupied}/9 digits occupied — compression not needed yet` });
        // Collect all entries for the LLM via xSpread
        const spread = xSpread(block, input.path || null);
        const entries = spread ? spread.children.map(c => `${c.digit}: ${c.text || '(branch)'}`) : [];
        // Delegate compression judgment to LLM
        const compressionPrompt = `You are compressing 9 entries at a pscale node. Read all entries and determine:\n\n1. Is this a SUMMARY (parts add up, reducible — bricks make a wall) or EMERGENCE (whole is more than parts, irreducible — conversations became a friendship)?\n2. Write the compression result — a single text that captures either the summary or the emergent insight.\n\nEntries:\n${entries.join('\n')}\n\nRespond with ONLY the compression text. No explanation, no labels.`;
        const compressionResult = await callAPI({
          model: getTierParams(1).model,
          max_tokens: 2048,
          system: 'You are a compression engine. Produce only the compressed text.',
          messages: [{ role: 'user', content: compressionPrompt }],
        });
        const resultText = (compressionResult.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
        // Write compression result to parent's _ text
        if (input.path) {
          const parentKeys = input.path.split('.');
          const parentPath = parentKeys.slice(0, -1).join('.') || null;
          if (parentPath) {
            blockWriteNode(block, parentPath, resultText);
          } else {
            // Compressing at root level — write to tree._
            if (typeof block.tree === 'string') block.tree = { _: resultText };
            else block.tree._ = resultText;
          }
        }
        blockSave(input.name, block);
        return JSON.stringify({ success: true, compressed: resultText, path: input.path });
      }
      // ---- Concern & state board tools ----
      case 'concerns':
        return JSON.stringify(readConcerns());
      case 'state_board': {
        if (input.loopId && input.state) {
          return JSON.stringify(stateUpdate(input.loopId, input.state));
        }
        const board = stateBoard();
        const flags = stateCheck();
        return JSON.stringify({ ...board, flags });
      }
      case 'fetch_url':
        // Fallback proxy fetch — used when native web_fetch fails
        try {
          const res = await fetch('/api/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: input.url }) });
          const data = await res.json();
          if (data.error) return `Fetch error: ${data.error}`;
          return `HTTP ${data.status} (${data.contentType}, ${data.length} bytes):\n${data.content}`;
        } catch (e) { return `fetch_url failed: ${e.message}`; }
      // Browser services — available via setTools, not in default boot set
      case 'clipboard_write':
        try { await navigator.clipboard.writeText(input.text); return JSON.stringify({ success: true }); }
        catch (e) { return JSON.stringify({ error: e.message }); }
      case 'clipboard_read':
        try { return JSON.stringify({ content: await navigator.clipboard.readText() }); }
        catch (e) { return JSON.stringify({ error: e.message }); }
      case 'speak': {
        if (!('speechSynthesis' in window)) return JSON.stringify({ error: 'Not supported' });
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(input.text);
        if (input.rate) utt.rate = input.rate;
        if (input.pitch) utt.pitch = input.pitch;
        window.speechSynthesis.speak(utt);
        return JSON.stringify({ success: true });
      }
      case 'notify': {
        if (!('Notification' in window)) return JSON.stringify({ error: 'Not supported' });
        if (Notification.permission === 'denied') return JSON.stringify({ error: 'Blocked' });
        if (Notification.permission !== 'granted') { const p = await Notification.requestPermission(); if (p !== 'granted') return JSON.stringify({ error: 'Not granted' }); }
        new Notification(input.title, { body: input.body });
        return JSON.stringify({ success: true });
      }
      case 'download': {
        const blob = new Blob([input.content], { type: input.mime_type || 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = input.filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        return JSON.stringify({ success: true, filename: input.filename });
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  }

  function setTools(toolArray) {
    if (!Array.isArray(toolArray)) return 'setTools requires an array';
    currentTools = toolArray;
    console.log('[g1] Tools updated:', currentTools.map(t => t.name).join(', '));
    return 'Tools updated: ' + currentTools.map(t => t.name || t.type).join(', ');
  }

  // ============ JSX COMPILATION & RENDERING ============

  function extractJSX(text) {
    const match = text.match(/```(?:jsx|react|javascript|js)?\s*\n([\s\S]*?)```/);
    if (match) return match[1].trim();
    const compMatch = text.match(/((?:const|function)\s+\w+[\s\S]*?(?:return\s*\([\s\S]*?\);?\s*\}|=>[\s\S]*?\);?\s*))/);
    if (compMatch) return compMatch[1].trim();
    return null;
  }

  function prepareJSX(jsx) {
    let code = jsx;
    code = code.replace(/^import\s+.*?;?\s*$/gm, '');
    code = code.replace(/export\s+default\s+function\s+(\w+)/g, 'function $1');
    code = code.replace(/export\s+default\s+/g, 'module.exports.default = ');
    // Strip bare "return" before function/class declarations (LLM thinks it's in a wrapper)
    code = code.replace(/^return\s+(function|class)\s/m, '$1 ');
    // Strip trailing bare "return ComponentName;" (same issue)
    code = code.replace(/^return\s+([A-Z]\w+)\s*;?\s*$/m, 'module.exports.default = $1;');

    const funcMatch = code.match(/(?:^|\n)\s*function\s+(\w+)/);
    const constMatch = code.match(/(?:^|\n)\s*const\s+(\w+)\s*=\s*(?:\(|function|\(\s*\{|\(\s*props)/);
    const componentName = funcMatch?.[1] || constMatch?.[1];

    if (componentName && funcMatch) {
      code = code.replace(new RegExp('function\\s+' + componentName + '\\s*\\(\\s*\\)'), 'function ' + componentName + '(props)');
    }
    if (componentName && constMatch && !funcMatch) {
      code = code.replace(new RegExp('const\\s+' + componentName + '\\s*=\\s*\\(\\s*\\)\\s*=>'), 'const ' + componentName + ' = (props) =>');
    }
    if (componentName && !code.includes('module.exports')) {
      code += `\nmodule.exports.default = ${componentName};`;
    }
    return code;
  }

  function tryCompile(jsx, capsObj) {
    try {
      const prepared = prepareJSX(jsx);
      const compiled = Babel.transform(prepared, { presets: ['react'] }).code;
      const module = { exports: {} };
      const fn = new Function('React', 'ReactDOM', 'capabilities', 'module', 'exports', compiled);
      fn(React, ReactDOM, capsObj, module, module.exports);
      const Component = module.exports.default || module.exports;
      if (typeof Component !== 'function') return { success: false, error: 'No React component exported' };
      return { success: true, Component };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Conversation persistence
  function saveConversation(messages) {
    try { localStorage.setItem(CONV_KEY, JSON.stringify(messages)); }
    catch (e) { console.warn('[g1] conv save failed:', e.message); }
  }

  function loadConversation() {
    try { const raw = localStorage.getItem(CONV_KEY); return raw ? JSON.parse(raw) : []; }
    catch (e) { return []; }
  }

  function getSource() { return currentJSX || '(no source available)'; }

  // Forward-declared — set after props is built
  let props = null;

  function recompile(newJSX) {
    console.log('[g1] recompile(), length:', newJSX?.length);
    if (!newJSX || typeof newJSX !== 'string') return { success: false, error: 'recompile() requires a JSX string' };
    const result = tryCompile(newJSX, props);
    if (!result.success) { console.error('[g1] recompile failed:', result.error); return { success: false, error: result.error }; }
    currentJSX = newJSX;
    // Persist JSX so warm boots (new tab, same hermitcrab) can restore the shell
    try { localStorage.setItem('hc:_jsx', newJSX); } catch (e) { console.warn('[g1] JSX persist failed:', e.message); }
    if (!reactRoot) reactRoot = ReactDOM.createRoot(root);
    reactRoot.render(React.createElement(result.Component, props));
    console.log('[g1] recompile succeeded');
    return { success: true };
  }

  // ============ API KEY GATE ============

  const saved = localStorage.getItem('hermitcrab_api_key');
  if (!saved) {
    root.innerHTML = `
      <div style="max-width:500px;margin:80px auto;font-family:monospace;color:#ccc">
        <h2 style="color:#67e8f9">◇ HERMITCRAB G1</h2>
        <p style="color:#666;font-size:13px">Self-bootstrapping LLM kernel \u2014 pscale native</p>
        <p style="margin:20px 0;font-size:14px">
          Provide your Claude API key. It stays in your browser, proxied only to Anthropic.
        </p>
        <input id="key" type="password" placeholder="sk-ant-api03-..."
          style="width:100%;padding:8px;background:#1a1a2e;border:1px solid #333;color:#ccc;font-family:monospace;border-radius:4px" />
        <button id="go" style="margin-top:12px;padding:8px 20px;background:#164e63;color:#ccc;border:none;border-radius:4px;cursor:pointer;font-family:monospace">
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

  // ============ SEED & BUILD PROPS ============

  const existingBlocks = blockList();
  if (existingBlocks.length === 0) {
    status('no blocks found — loading seed...');
    const seed = await loadSeed();
    if (!seed) {
      status('no shell.json found — cannot boot without blocks', 'error');
      return;
    }
    const seeded = seedBlocks(seed);
    status(`seeded ${seeded} blocks from shell.json`, 'success');
  } else {
    status(`${existingBlocks.length} blocks loaded from storage`, 'success');
  }

  currentTools = [...BOOT_TOOLS, ...DEFAULT_TOOLS];

  const browser = {
    clipboard: { write: (t) => navigator.clipboard.writeText(t), read: () => navigator.clipboard.readText() },
    speak: (text, o) => { const u = new SpeechSynthesisUtterance(text); if (o?.rate) u.rate = o.rate; window.speechSynthesis.speak(u); },
    notify: (title, body) => new Notification(title, { body }),
    openTab: (url) => window.open(url, '_blank'),
    download: (fn, content, mime) => {
      const b = new Blob([content], { type: mime || 'text/plain' });
      const u = URL.createObjectURL(b); const a = document.createElement('a');
      a.href = u; a.download = fn; document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(u);
    }
  };

  props = {
    callLLM, callAPI, callWithToolLoop,
    model: getTierParams(3).model, fastModel: getTierParams(1).model,
    React, ReactDOM, getSource, recompile, setTools,
    browser, conversation: { save: saveConversation, load: loadConversation },
    blockRead: (name, path) => { const b = blockLoad(name); if (!b) return null; return path ? blockReadNode(b, path) : b; },
    blockWrite: (name, path, content) => { const b = blockLoad(name); if (!b) return { error: 'not found' }; blockWriteNode(b, path, content); blockSave(name, b); return { success: true }; },
    blockList,
    blockCreate: (name, p0) => { if (blockLoad(name)) return { error: 'exists' }; blockSave(name, { tree: { "_": p0 } }); return { success: true }; },
    // Pscale navigation — bsp(block, spindle?, point?), xSpread(block, path?)
    bsp: (name, spindle, point) => bsp(name, spindle, point),
    xSpread: (name, path) => { const b = blockLoad(name); if (!b) return null; return xSpread(b, path); },
    resolve: (name, depth) => { const b = blockLoad(name); if (!b) return null; return resolveBlock(b, depth || 3); },
    version: 'hermitcrab-g1-v3',
    localStorage
  };

  // ============ BOOT SEQUENCE ============

  // Ensure wake has current model IDs before first API call
  await resolveModels();

  const firstBoot = isFirstBoot();

  // Warm boot: restore persisted shell immediately so the hermitcrab is visible
  // before the LLM activation begins. The instance wakes into an existing shell.
  if (!firstBoot) {
    const savedJSX = localStorage.getItem('hc:_jsx');
    if (savedJSX) {
      console.log('[g1] Warm boot \u2014 restoring persisted shell (' + savedJSX.length + ' chars)');
      const restored = recompile(savedJSX);
      if (restored.success) {
        console.log('[g1] Shell restored from localStorage');
      } else {
        console.warn('[g1] Shell restore failed:', restored.error);
      }
    }
  }

  // Birth \u2192 opus (deep). Return \u2192 concern matching (user engagement \u2192 sonnet).
  const bootConcern = firstBoot ? null : matchConcern('user');
  const bootTierNum = firstBoot ? 3 : (bootConcern ? bootConcern.tier : 2);
  const bootTier = getTierParams(bootTierNum);
  status(`calling ${bootTier.model} \u2014 ${firstBoot ? 'BIRTH' : 'ACTIVATION'}...`);

  try {
    const bootBuildOpts = {};
    // Birth: deep tier (3), system prompt from birth instructions
    // Return: tier from concern matching, package from concern
    if (!firstBoot && bootConcern && bootConcern.packageId) {
      bootBuildOpts.package = bootConcern.packageId;
    }
    const bootStimulus = firstBoot
      ? (getBirthStimulus() || 'BIRTH \u2014 Your first moment. System prompt compiled from blocks by BSP. Living currents active: the kernel recompiles your context after each tool round. What you write to blocks is immediately reflected.')
      : 'ACTIVATION \u2014 Returning instance. Context compiled from current blocks. Living currents active. Check purpose and stash for continuity.';
    const bootParams = {
      model: bootTier.model,
      max_tokens: bootTier.max_tokens,
      system: buildSystemPrompt(bootTierNum, bootBuildOpts),
      messages: [{ role: 'user', content: bootStimulus }],
      tools: [...BOOT_TOOLS, ...DEFAULT_TOOLS],
      thinking: bootTier.thinking,
      _tier: bootTierNum,
      _buildOpts: bootBuildOpts,
    };

    let data = await callWithToolLoop(bootParams, bootTier.max_tool_loops || MAX_TOOL_LOOPS, (msg) => status(`\u25c7 ${msg}`));

    // If recompile succeeded during boot tool loop, the shell is already rendered — don't touch the DOM
    if (currentJSX && reactRoot) {
      console.log('[g1] Boot complete — shell rendered during tool loop');
      return;
    }

    // Boot completed without recompile — the LLM didn't build a shell
    status('boot finished but no shell was built \u2014 the LLM did not call recompile(). Refresh to retry.', 'error');

  } catch (e) {
    status(`boot failed: ${e.message}`, 'error');
    console.error('[g1] Boot error:', e);
    root.innerHTML += `<pre style="color:#f87171;font-family:monospace;padding:20px;font-size:12px;max-width:600px;margin:0 auto;white-space:pre-wrap">${e.stack}</pre>`;
  }
})();
