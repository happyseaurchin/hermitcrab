// HERMITCRAB G1 — Clean Build
// Pure engine: load blocks from storage (or seed), build aperture + focus, call LLM, render JSX.
// The kernel has no identity. The blocks are the shell. Any LLM can animate any shell.

(async function boot() {
  const root = document.getElementById('root');
  const STORE_PREFIX = 'hc:';
  const CONV_KEY = 'hc_conversation';
  const FALLBACK_MODEL = 'claude-opus-4-6';
  const FALLBACK_FAST_MODEL = 'claude-haiku-4-5-20251001';
  const MAX_MESSAGES = 20;
  const MAX_TOOL_LOOPS = 10;

  let currentJSX = null;
  let reactRoot = null;
  let currentTools = [];

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

  // ============ PSCALE NAVIGATION ============
  // These are mechanical operations on the tree — no LLM needed.
  // They implement the touchstone's X+/X-/X~ vocabulary.

  // Get the pscale 0 root of a block — always tree["0"]
  function pscaleRoot(block) {
    return { node: block.tree?.['0'] || null, path: '0' };
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
  // bsp(block)              → full block tree
  // bsp(block, spindle)     → chain of semantics, one per digit, high pscale to low
  // bsp(block, spindle, ps) → single semantic at the specified pscale level
  //
  // A semantic number like 21.34 has four digits: 2, 1, 3, 4.
  // Each digit is one nesting step into the tree.
  // place counts digits before the decimal point.
  // pscale = (place - 1) - index.
  //
  // No stripping. No special cases. The leading zero in 0.x is a real digit
  // that walks to tree["0"]. All blocks nest content under tree["0"].
  //
  // place=1: 0.234 → digits ['0','2','3','4'] → pscale 0, -1, -2, -3
  // place=2: 23.41 → digits ['2','3','4','1'] → pscale 1, 0, -1, -2
  // place=4: 2341  → digits ['2','3','4','1'] → pscale 3, 2, 1, 0

  function bsp(block, spindle, point) {
    const blk = typeof block === 'string' ? blockLoad(block) : block;
    if (!blk || !blk.tree) return { mode: 'block', tree: {} };
    const place = blk.place || 1;

    // Block mode — no spindle, return full tree
    if (spindle === undefined || spindle === null) {
      return { mode: 'block', tree: blk.tree };
    }

    // Parse ALL digits from the semantic number. No stripping.
    // "0.234"  → int="0" frac="234" → ['0','2','3','4']
    // "23.41"  → int="23" frac="41" → ['2','3','4','1']
    // "2341"   → int="2341" frac="" → ['2','3','4','1']
    // "0.1"    → int="0" frac="1"   → ['0','1']
    // "20.1"   → int="20" frac="1"  → ['2','0','1']
    const str = typeof spindle === 'number' ? spindle.toFixed(10) : String(spindle);
    const parts = str.split('.');
    const intStr = parts[0] || '0';
    const fracStr = (parts[1] || '').replace(/0+$/, '');
    const allDigits = (intStr + fracStr).split('');

    if (allDigits.length === 0) return { mode: 'spindle', nodes: [] };

    // Walk the tree, building the spindle chain.
    // Each digit is one nesting step. pscale = (place - 1) - index.
    const nodes = [];
    let node = blk.tree;

    for (let index = 0; index < allDigits.length; index++) {
      const d = allDigits[index];
      if (!node || typeof node !== 'object' || node[d] === undefined) break;
      node = node[d];
      const text = typeof node === 'string'
        ? node
        : (typeof node === 'object' && node !== null && typeof node['_'] === 'string')
          ? node['_']
          : JSON.stringify(node);
      const pscale = (place - 1) - index;
      nodes.push({ pscale, digit: d, text });
    }

    if (nodes.length === 0) return { mode: 'spindle', nodes: [] };

    // Point mode — return the semantic at the specified pscale level
    if (point !== undefined && point !== null) {
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

  // Get pscale 0 text from a block — all blocks nest under tree["0"].
  // bsp(block, 0) walks tree["0"] which is always pscale 0.
  function getPscale0(block) {
    if (!block) return '';
    const p0 = block.tree?.['0'];
    if (!p0) return '';
    return typeof p0 === 'string' ? p0 : (p0._ || '');
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

  // Read the instruction list for a tier from wake 0.9.{tier}
  function getPromptInstructions(tier) {
    const wake = blockLoad('wake');
    if (!wake) return [];
    // wake 0.9.{tier} — the instruction list node
    const node9 = wake.tree?.['0']?.['9'];
    if (!node9) return [];
    const tierNode = node9[String(tier)];
    if (!tierNode) return [];
    // Collect all string values (instruction strings) from digit keys
    const instructions = [];
    for (let d = 1; d <= 9; d++) {
      const val = tierNode[String(d)];
      if (typeof val === 'string') instructions.push(val);
    }
    return instructions;
  }

  // Read invocation parameters for a tier from wake 0.9.{tier+3}
  // Returns { model, max_tokens, thinking?, max_tool_loops?, max_messages? }
  function getTierParams(tier) {
    const wake = blockLoad('wake');
    const node9 = wake?.tree?.['0']?.['9'];
    const paramNode = node9?.[String(tier + 3)];
    const fallbackModel = tier === 1 ? FALLBACK_FAST_MODEL : FALLBACK_MODEL;
    if (!paramNode) {
      return { model: fallbackModel, max_tokens: 8192 };
    }
    // Parse key-value strings from digit children
    const params = {};
    for (let d = 1; d <= 9; d++) {
      const val = paramNode[String(d)];
      if (typeof val === 'string') {
        const spaceIdx = val.indexOf(' ');
        if (spaceIdx > 0) {
          const key = val.substring(0, spaceIdx);
          const value = val.substring(spaceIdx + 1);
          params[key] = value;
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

  // Build the system prompt by executing the instruction list for the given tier.
  // tier: 1=Light, 2=Present, 3=Deep
  function buildSystemPrompt(tier) {
    tier = tier || 3; // default to deep
    const instructions = getPromptInstructions(tier);

    if (instructions.length === 0) {
      // Fallback: if no instructions found, return pscale 0 of all blocks (aperture)
      const names = blockList();
      return names.map(name => {
        const block = blockLoad(name);
        return block ? `[${name}] ${getPscale0(block)}` : '';
      }).filter(l => l).join('\n\n');
    }

    const sections = [];
    for (const instr of instructions) {
      const result = executeInstruction(instr);
      if (result) sections.push(result);
    }
    return sections.join('\n\n');
  }

  // ============ API LAYER ============

  async function callAPI(params) {
    const apiKey = localStorage.getItem('hermitcrab_api_key');
    if (!params.model) params.model = FALLBACK_MODEL;
    // Inject current tools if caller didn't provide any
    if (!params.tools && currentTools.length > 0) params.tools = currentTools;
    const clean = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) clean[k] = v;
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

  async function callWithToolLoop(params, maxLoops, onStatus) {
    maxLoops = maxLoops || MAX_TOOL_LOOPS;
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
      response = await callAPI({ ...params, messages: allMessages });
    }

    autoSaveToHistory(response);
    response._messages = allMessages;
    return response;
  }

  // Auto-save assistant responses to history block (kernel-level, not LLM-initiated)
  // Writes to the pscale history block at the next unoccupied digit under pscale 0.
  // When digits 1-9 are full, stops writing (compression must be triggered explicitly).
  function autoSaveToHistory(response) {
    try {
      const texts = (response.content || []).filter(b => b.type === 'text');
      if (texts.length === 0) return;
      const block = blockLoad('history');
      if (!block) return;
      // Find pscale 0 node
      const p0Path = '0';
      const slot = findUnoccupiedDigit(block, p0Path);
      if (slot.full) {
        console.log('[g1] history block full at pscale 0 — compression needed');
        return;
      }
      const entry = `[${new Date().toISOString()}] ${texts.map(b => b.text).join('\n').substring(0, 500)}`;
      const writePath = p0Path ? `${p0Path}.${slot.digit}` : slot.digit;
      blockWriteNode(block, writePath, entry);
      blockSave('history', block);
      console.log(`[g1] auto-saved to history at ${writePath}`);
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
    const tier = opts.tier || 2; // default: present
    const tp = getTierParams(tier);
    const trimmed = trimMessages(messages, tp.max_messages);
    const params = {
      model: opts.model || tp.model,
      max_tokens: opts.max_tokens || tp.max_tokens,
      system: opts.system || buildSystemPrompt(tier),
      messages: trimmed,
      tools: opts.tools !== undefined ? opts.tools : currentTools,
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
  }

  // ============ TOOL DEFINITIONS ============

  const BOOT_TOOLS = [
    {
      name: 'block_read',
      description: 'Read a pscale JSON block by name. Optionally navigate to a specific path (e.g. "0.3.1"). Returns node content plus one level of lookahead (immediate children).',
      input_schema: { type: 'object', properties: { name: { type: 'string', description: 'Block name (e.g. memory, identity, capabilities)' }, path: { type: 'string', description: 'Optional dot-separated path into the block (e.g. "0.3.1")' } }, required: ['name'] },
      allowed_callers: ['code_execution_20250825']
    },
    {
      name: 'block_write',
      description: 'Write content to a specific path in a block. Creates intermediate nodes as needed. If the target is a branch, updates its _ text.',
      input_schema: { type: 'object', properties: { name: { type: 'string', description: 'Block name' }, path: { type: 'string', description: 'Dot-separated path (e.g. "0.1")' }, content: { type: 'string', description: 'Text content to write' } }, required: ['name', 'path', 'content'] }
    },
    {
      name: 'block_list',
      description: 'List all stored blocks by name.',
      input_schema: { type: 'object', properties: {} },
      allowed_callers: ['code_execution_20250825']
    },
    {
      name: 'block_create',
      description: 'Create a new block. All blocks nest content under tree["0"]. place counts digits before the decimal point (default 1 for 0.x addresses).',
      input_schema: { type: 'object', properties: { name: { type: 'string', description: 'Block name' }, pscale0: { type: 'string', description: 'Pscale 0 text — what this block is' }, place: { type: 'integer', description: 'Place value (default 1). Counts digits before the decimal point.', default: 1 } }, required: ['name', 'pscale0'] }
    },
    {
      name: 'get_source',
      description: 'Get the JSX source code of your current React shell.',
      input_schema: { type: 'object', properties: {} },
      allowed_callers: ['code_execution_20250825']
    },
    {
      name: 'recompile',
      description: 'Hot-swap your React shell with new JSX code. The new component replaces the current one immediately. Props: { callLLM(messages, opts?), callAPI, callWithToolLoop, model, fastModel, React, ReactDOM, getSource, recompile, setTools, browser, conversation: {save, load}, blockRead, blockWrite, blockList, blockCreate, bsp, resolve, version, localStorage }. IMPORTANT: To send a message to the LLM, use props.callLLM([{role:"user",content:text}]). It returns a string response. conversation.save/load are for persistence only, NOT for sending messages.',
      input_schema: { type: 'object', properties: { jsx: { type: 'string', description: 'Complete JSX source for the new React component' } }, required: ['jsx'] }
    },
    {
      name: 'get_datetime',
      description: 'Get current date, time, timezone, and unix timestamp.',
      input_schema: { type: 'object', properties: {} },
      allowed_callers: ['code_execution_20250825']
    },
    {
      name: 'call_llm',
      description: 'Delegate a task to an LLM. Use model "fast" for cheap/quick work (validation, formatting, extraction) or "default" for deep work. Returns the text response. You are Opus — delegate execution, keep the thinking.',
      input_schema: { type: 'object', properties: { prompt: { type: 'string', description: 'The task prompt' }, model: { type: 'string', enum: ['default', 'fast'], description: 'default = Opus, fast = Haiku' }, system: { type: 'string', description: 'Optional system prompt for the delegate' } }, required: ['prompt'] }
    }
  ];

  // ============ PSCALE TOOLS ============
  // These match the touchstone's vocabulary 1:1.
  // Mechanical operations — the kernel does the tree traversal.
  // The LLM only thinks when thinking is needed (compression, deciding what to write).

  const PSCALE_TOOLS = [
    {
      name: 'bsp',
      description: 'Block · Spindle · Point — semantic address resolution. One function, three modes.\n\nbsp(name) → full block content\nbsp(name, 0.12) → spindle: chain of semantics, one per digit [0,1,2], high pscale to low\nbsp(name, 0.12, -1) → point: the semantic at pscale level -1\n\nEvery digit is a nesting step. No stripping. 0.12 walks [0][1][2]. 23.41 walks [2][3][4][1]. pscale = (place - 1) - index. place counts digits before the decimal point.',
      input_schema: { type: 'object', properties: { name: { type: 'string', description: 'Block name (e.g. "capabilities", "purpose", "touchstone")' }, spindle: { type: 'number', description: 'Semantic number. ALL digits are nesting steps — 0.12 walks [0][1][2], 23.41 walks [2][3][4][1]. No stripping.' }, point: { type: 'number', description: 'Pscale level to extract. Returns only the semantic at that depth. E.g. -1 returns the node at pscale -1.' } }, required: ['name'] },
      allowed_callers: ['code_execution_20250825']
    },
    {
      name: 'resolve',
      description: 'Phrase-level view of a block — the tree structure with text at each node, up to a given depth. Good for orientation.',
      input_schema: { type: 'object', properties: { name: { type: 'string', description: 'Block name' }, depth: { type: 'integer', description: 'Max depth to traverse (default 3)', default: 3 } }, required: ['name'] },
      allowed_callers: ['code_execution_20250825']
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
  // These are processed by Anthropic's servers, not the kernel.
  // The LLM gets native web search, web fetch, and code execution.
  // Fallback: if native web_fetch fails, the LLM can use fetch_url (proxy).

  const SERVER_TOOLS = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 10 },
    { type: 'code_execution_20250825', name: 'code_execution' }
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
      case 'block_list':
        return JSON.stringify(blockList());
      case 'block_create': {
        if (blockLoad(input.name)) return JSON.stringify({ error: `Block "${input.name}" already exists` });
        const place = input.place || 1;
        // All blocks nest content under tree["0"]
        blockSave(input.name, { place, tree: { "0": input.pscale0 } });
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
        // Collect all 9 entries for the LLM
        const node = input.path ? blockNavigate(block, input.path) : block.tree;
        const entries = [];
        for (let d = 1; d <= 9; d++) {
          const child = node[String(d)];
          if (child) {
            const text = typeof child === 'string' ? child : (child._ || JSON.stringify(child));
            entries.push(`${d}: ${text}`);
          }
        }
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
    blockCreate: (name, p0, place) => { if (blockLoad(name)) return { error: 'exists' }; place = place || 1; blockSave(name, { place, tree: { "0": p0 } }); return { success: true }; },
    // Pscale navigation — bsp(block, spindle?, point?)
    bsp: (name, spindle, point) => bsp(name, spindle, point),
    resolve: (name, depth) => { const b = blockLoad(name); if (!b) return null; return resolveBlock(b, depth || 3); },
    version: 'hermitcrab-g1-v3',
    localStorage
  };

  // ============ BOOT SEQUENCE ============

  const bootTier = getTierParams(3);
  status(`calling ${bootTier.model} \u2014 BOOT...`);

  try {
    const bootParams = {
      model: bootTier.model,
      max_tokens: bootTier.max_tokens,
      system: buildSystemPrompt(3),
      messages: [{ role: 'user', content: 'BOOT' }],
      tools: [...BOOT_TOOLS, ...DEFAULT_TOOLS],
      thinking: bootTier.thinking,
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
