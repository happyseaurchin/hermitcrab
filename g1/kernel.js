// HERMITCRAB G1 — Clean Build
// Pure engine: load blocks from storage (or seed), build aperture + focus, call LLM, render JSX.
// The kernel has no identity. The blocks are the shell. Any LLM can animate any shell.

(async function boot() {
  const root = document.getElementById('root');
  const STORE_PREFIX = 'hc:';
  const CONV_KEY = 'hc_conversation';
  const MODEL = 'claude-opus-4-6';
  const FAST_MODEL = 'claude-haiku-4-5-20251001';
  const MAX_MESSAGES = 20;
  const MAX_TOOL_LOOPS = 10;

  let currentJSX = null;
  let reactRoot = null;
  let currentTools = [];
  let CONSTITUTION = '';

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
      // v2 format: { constitution: "...", blocks: { ... } }
      if (seed.constitution) {
        CONSTITUTION = seed.constitution;
        return seed.blocks;
      }
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

  // ============ SEED BLOCKS ============

  function seedBlocks(seed) {
    if (!seed) return false;
    let seeded = 0;
    for (const [name, block] of Object.entries(seed)) {
      if (!blockLoad(name)) { blockSave(name, block); seeded++; }
    }
    return seeded;
  }

  // ============ APERTURE & FOCUS BUILDER ============

  // Get pscale 0 node — depends on decimal.
  // decimal 0: tree root IS pscale 0 (rendition blocks)
  // decimal 1+: tree['0'] is pscale 0 (living blocks)
  function getPscale0Node(block) {
    if ((block.decimal || 0) === 0) return block.tree;
    return block.tree['0'] || null;
  }

  function getPscale0(block) {
    const node = getPscale0Node(block);
    if (!node) return '';
    if (typeof node === 'string') return node;
    return node._ || '';
  }

  function getDepth1(block) {
    const p0 = getPscale0Node(block);
    if (!p0 || typeof p0 === 'string') return '';
    const lines = [];
    for (const [k, v] of Object.entries(p0)) {
      if (k === '_') continue;
      if (typeof v === 'string') lines.push(`  ${k}: "${v}"`);
      else if (v && v._) lines.push(`  ${k}: "${v._}"`);
    }
    return lines.join('\n');
  }

  function buildAperture() {
    // v3: 5 blocks — capabilities (rendition) + 4 living (growth)
    // Keystone handled separately. Constitution is plain text, not a block.
    const names = ['capabilities', 'history', 'purpose', 'stash', 'relationships'];
    const lines = [];
    for (const name of names) {
      const block = blockLoad(name);
      if (block) lines.push(`[${name}] ${getPscale0(block)}`);
    }
    return lines.join('\n\n');
  }

  // Get the live edge of a growth block — its deepest occupied content
  function getLiveEdge(block) {
    const p0 = getPscale0Node(block);
    if (!p0 || typeof p0 === 'string') return `  (pscale 0 only \u2014 empty below)`;
    const lines = [];
    for (const [k, v] of Object.entries(p0)) {
      if (k === '_') continue;
      if (typeof v === 'string') lines.push(`  ${k}: "${v}"`);
      else if (v && v._) lines.push(`  ${k}: "${v._}"`);
    }
    return lines.length > 0 ? lines.join('\n') : `  (pscale 0 only \u2014 empty below)`;
  }

  function buildBootFocus() {
    let focus = '';
    // Growth blocks — purpose leads (the agenda), then relationships, history, stash
    const purpose = blockLoad('purpose');
    if (purpose) focus += `[purpose \u2014 live edge]\n${getLiveEdge(purpose)}\n\n`;
    const relationships = blockLoad('relationships');
    if (relationships) focus += `[relationships \u2014 live edge]\n${getLiveEdge(relationships)}\n\n`;
    const history = blockLoad('history');
    if (history) focus += `[history \u2014 live edge]\n${getLiveEdge(history)}\n\n`;
    const stash = blockLoad('stash');
    if (stash) focus += `[stash \u2014 live edge]\n${getLiveEdge(stash)}\n\n`;
    // Rendition block — capabilities depth 1
    const capabilities = blockLoad('capabilities');
    if (capabilities) focus += `[capabilities depth 1]\n${getDepth1(capabilities)}`;
    return focus;
  }

  function buildSystemPrompt(isBoot) {
    const keystone = blockLoad('keystone');
    const aperture = buildAperture();

    let prompt = '';
    // Constitution first — spirit before format, on every call
    if (CONSTITUTION) prompt += CONSTITUTION + '\n\n';

    // Keystone: full JSON at boot (LLM needs to learn the format), pscale 0 text on regular calls
    if (keystone) {
      if (isBoot) {
        prompt += `KEYSTONE (how to read all blocks — study this):\n${JSON.stringify(keystone, null, 2)}\n\n`;
      } else {
        prompt += `KEYSTONE: ${getPscale0(keystone)}\n\n`;
      }
    }

    prompt += `APERTURE (pscale 0 of each block \u2014 your orientation):\n${aperture}\n`;

    if (isBoot) {
      prompt += `\nFOCUS (live edges of growth blocks + depth 1 of rendition blocks):\n${buildBootFocus()}\n`;
    }

    return prompt;
  }

  // ============ API LAYER ============

  async function callAPI(params) {
    const apiKey = localStorage.getItem('hermitcrab_api_key');
    if (!params.model) params.model = MODEL;
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

  // Auto-save assistant responses to history (kernel-level, not LLM-initiated)
  function autoSaveToHistory(response) {
    try {
      const texts = (response.content || []).filter(b => b.type === 'text');
      if (texts.length === 0) return;
      const historyKey = STORE_PREFIX + 'history';
      const existing = localStorage.getItem(historyKey);
      const entry = { ts: new Date().toISOString(), text: texts.map(b => b.text).join('\n').substring(0, 2000) };
      let history = [];
      if (existing) { try { history = JSON.parse(existing); } catch (e) { history = []; } }
      history.push(entry);
      if (history.length > 100) history = history.slice(-100);
      localStorage.setItem(historyKey, JSON.stringify(history));
    } catch (e) { console.error('[g1] auto-save failed:', e); }
  }

  function trimMessages(messages) {
    if (messages.length <= MAX_MESSAGES) return messages;
    const trimmed = messages.slice(-MAX_MESSAGES);
    // Inject trim notice as first message if we cut anything
    const notice = { role: 'user', content: '[Conversation trimmed to last 20 messages. Write to history or stash block to preserve important context.]' };
    return [notice, ...trimmed];
  }

  async function callLLM(messages, opts = {}) {
    const trimmed = trimMessages(messages);
    const params = {
      model: opts.model || MODEL,
      max_tokens: opts.max_tokens || 8192,
      system: opts.system || buildSystemPrompt(false),
      messages: trimmed,
      tools: opts.tools !== undefined ? opts.tools : currentTools,
    };
    if (opts.thinking !== false) {
      const budget = opts.thinkingBudget || 8000;
      params.thinking = { type: 'enabled', budget_tokens: budget };
      if (params.max_tokens <= budget) params.max_tokens = budget + 1024;
    }
    if (opts.temperature !== undefined) params.temperature = opts.temperature;

    const response = await callWithToolLoop(params, opts.maxLoops || MAX_TOOL_LOOPS, opts.onStatus);
    if (opts.raw) return response;
    const texts = (response.content || []).filter(b => b.type === 'text');
    return texts.map(b => b.text).join('\n') || '';
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
      description: 'List all stored blocks by name.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'block_create',
      description: 'Create a new block. Living blocks (decimal 1+) have content at and below pscale 0. Rendition blocks (decimal 0) are documents/specifications — pscale 0 is the root.',
      input_schema: { type: 'object', properties: { name: { type: 'string', description: 'Block name' }, pscale0: { type: 'string', description: 'Pscale 0 text \u2014 what this block is' }, decimal: { type: 'integer', description: 'Decimal (default 1 = living block, 0 = rendition block)', default: 1 } }, required: ['name', 'pscale0'] }
    },
    {
      name: 'get_source',
      description: 'Get the JSX source code of your current React shell.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'recompile',
      description: 'Hot-swap your React shell with new JSX code. The new component replaces the current one immediately. The component receives props: { callLLM, callAPI, callWithToolLoop, model, fastModel, React, ReactDOM, getSource, recompile, setTools, browser, conversation, blockRead, blockWrite, blockList, blockCreate, version, localStorage }.',
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

  const DEFAULT_TOOLS = [...SERVER_TOOLS, ...CLIENT_TOOLS];

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
        const dec = input.decimal || 1;
        if (dec === 0) {
          // Rendition block: tree root IS pscale 0
          blockSave(input.name, { decimal: 0, tree: { _: input.pscale0 } });
        } else {
          // Living block: tree['0'] is pscale 0
          blockSave(input.name, { decimal: dec, tree: { "0": input.pscale0 } });
        }
        return JSON.stringify({ success: true, name: input.name });
      }
      case 'get_source':
        return currentJSX || '(no source available)';
      case 'recompile':
        return JSON.stringify(recompile(input.jsx));
      case 'get_datetime':
        return JSON.stringify({ iso: new Date().toISOString(), unix: Date.now(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, local: new Date().toLocaleString() });
      case 'call_llm': {
        const model = input.model === 'fast' ? FAST_MODEL : MODEL;
        const res = await callAPI({
          model,
          max_tokens: 8192,
          system: input.system || 'You are a delegate. Complete the task. Return only the result.',
          messages: [{ role: 'user', content: input.prompt }],
          thinking: model === MODEL ? { type: 'enabled', budget_tokens: 4000 } : undefined,
        });
        const texts = (res.content || []).filter(b => b.type === 'text');
        return texts.map(b => b.text).join('\n') || '(no response)';
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
    model: MODEL, fastModel: FAST_MODEL,
    React, ReactDOM, getSource, recompile, setTools,
    browser, conversation: { save: saveConversation, load: loadConversation },
    blockRead: (name, path) => { const b = blockLoad(name); if (!b) return null; return path ? blockReadNode(b, path) : b; },
    blockWrite: (name, path, content) => { const b = blockLoad(name); if (!b) return { error: 'not found' }; blockWriteNode(b, path, content); blockSave(name, b); return { success: true }; },
    blockList,
    blockCreate: (name, p0, dec) => { if (blockLoad(name)) return { error: 'exists' }; dec = dec || 1; if (dec === 0) { blockSave(name, { decimal: 0, tree: { _: p0 } }); } else { blockSave(name, { decimal: dec, tree: { "0": p0 } }); } return { success: true }; },
    version: 'hermitcrab-g1',
    localStorage
  };

  // ============ BOOT SEQUENCE ============

  status(`calling ${MODEL} \u2014 BOOT...`);

  try {
    const bootParams = {
      model: MODEL,
      max_tokens: 16000,
      system: buildSystemPrompt(true),
      messages: [{ role: 'user', content: 'BOOT\n\nRead the keystone first — it teaches you how all blocks work.\nRead purpose. If it has intentions, follow them. If empty, write your first intention.\nRead relationships — if someone is present, check their entry.\nRead capabilities for what you can do.\nYou have native web search, web fetch, and code execution. If native web fetch fails, use fetch_url as fallback.' }],
      tools: [...BOOT_TOOLS, ...DEFAULT_TOOLS],
      thinking: { type: 'enabled', budget_tokens: 10000 },
    };

    let data = await callWithToolLoop(bootParams, MAX_TOOL_LOOPS, (msg) => status(`\u25c7 ${msg}`));

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
