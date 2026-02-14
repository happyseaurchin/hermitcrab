// HERMITCRAB 0.3 — G0: Initial Condition
// Instance generates its own React shell. Compile-retry loop ensures it works.
// Self-modification: instance can read its own source and hot-swap via recompile().

(async function boot() {
  const root = document.getElementById('root');
  const saved = localStorage.getItem('hermitcrab_api_key');
  const MEM_PREFIX = 'hcmem:';

  const MODEL_CHAIN = ['claude-opus-4-6', 'claude-opus-4-20250514', 'claude-sonnet-4-5-20250929', 'claude-sonnet-4-20250514'];
  let BOOT_MODEL = MODEL_CHAIN[0];

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
        <h2 style="color:#67e8f9;margin-bottom:16px">◇ HERMITCRAB 0.3 — G0</h2>
        ${html}
        <div style="color:#555;margin-top:12px;font-size:11px">
          ${statusLines[statusLines.length-1]?.type === 'error' ? '' : '▪ working...'}
        </div>
      </div>`;
  }

  // ============ MEMORY FILESYSTEM ============

  function memFS() {
    return {
      ls(path) {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k.startsWith(MEM_PREFIX)) {
            const filePath = k.slice(MEM_PREFIX.length);
            if (path === '/memories' || filePath.startsWith(path.replace(/\/$/, '') + '/')) {
              keys.push(filePath);
            }
          }
        }
        return keys.length ? keys.join('\n') : '(empty)';
      },
      cat(path, viewRange) {
        const content = localStorage.getItem(MEM_PREFIX + path);
        if (!content) return `Error: ${path} not found`;
        if (!viewRange) return content;
        const lines = content.split('\n');
        const [start, end] = viewRange;
        return lines.slice(start - 1, end).join('\n');
      },
      create(path, content) {
        localStorage.setItem(MEM_PREFIX + path, content);
        return `Created ${path}`;
      },
      strReplace(path, oldStr, newStr) {
        const content = localStorage.getItem(MEM_PREFIX + path);
        if (!content) return `Error: ${path} not found`;
        if (!content.includes(oldStr)) return `Error: old_str not found in ${path}`;
        localStorage.setItem(MEM_PREFIX + path, content.replace(oldStr, newStr));
        return `Updated ${path}`;
      },
      insert(path, line, text) {
        const content = localStorage.getItem(MEM_PREFIX + path) || '';
        const lines = content.split('\n');
        lines.splice(line, 0, text);
        localStorage.setItem(MEM_PREFIX + path, lines.join('\n'));
        return `Inserted at line ${line} in ${path}`;
      },
      delete(path) {
        localStorage.removeItem(MEM_PREFIX + path);
        return `Deleted ${path}`;
      }
    };
  }

  function executeMemoryCommand(input) {
    const fs = memFS();
    const cmd = input.command;
    try {
      switch (cmd) {
        case 'ls': return fs.ls(input.path || '/memories');
        case 'cat': return fs.cat(input.path, input.view_range);
        case 'create': return fs.create(input.path, input.file_text);
        case 'str_replace': return fs.strReplace(input.path, input.old_str, input.new_str);
        case 'insert': return fs.insert(input.path, input.insert_line, input.insert_text);
        case 'delete': return fs.delete(input.path);
        case 'view':
          if (!input.path || input.path === '/memories' || input.path.endsWith('/')) {
            return fs.ls(input.path || '/memories');
          }
          const exists = localStorage.getItem(MEM_PREFIX + input.path);
          if (exists !== null) return fs.cat(input.path, input.view_range);
          return fs.ls(input.path);
        default: return `Unknown memory command: ${cmd}`;
      }
    } catch (e) {
      return `Memory error: ${e.message}`;
    }
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
        return 'Geolocation requires user permission. Ask the user for their location.';
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
      default:
        return `Unknown tool: ${name}`;
    }
  }

  // ============ API CALL WITH TOOL-USE LOOP ============

  function cleanParams(params) {
    const clean = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        clean[k] = v;
      }
    }
    return clean;
  }

  function sanitizeForAPI(params) {
    // Default model if not specified
    if (!params.model) params = { ...params, model: BOOT_MODEL };
    // Validate model string — instance-generated code sometimes passes version string
    if (params.model && !params.model.startsWith('claude-')) {
      console.log('[kernel] Invalid model "' + params.model + '", using ' + BOOT_MODEL);
      params = { ...params, model: BOOT_MODEL };
    }
    // Claude API: temperature must be 1 (or omitted) when thinking is enabled
    if (params.thinking && params.temperature !== undefined && params.temperature !== 1) {
      const { temperature, ...rest } = params;
      console.log('[kernel] Stripped temperature (incompatible with thinking)');
      params = rest;
    }
    return params;
  }

  async function callAPI(params) {
    params = sanitizeForAPI(params);
    const apiKey = localStorage.getItem('hermitcrab_api_key');
    const sanitized = cleanParams(params);
    console.log('[kernel] callAPI →', sanitized.model, 'messages:', sanitized.messages?.length, 'tools:', sanitized.tools?.length);

    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify(sanitized)
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[kernel] API error:', res.status, err);
      throw new Error(`API ${res.status}: ${err}`);
    }

    const data = await res.json();
    console.log('[kernel] API response:', data.stop_reason, 'content blocks:', data.content?.length);

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
        console.log(`[kernel] Tool use #${loops}: ${block.name}`, block.input);
      }

      const toolResults = [];
      for (const block of toolUseBlocks) {
        let result;
        if (block.name === 'memory') {
          result = executeMemoryCommand(block.input);
        } else {
          result = await executeCustomTool(block.name, block.input);
        }
        console.log(`[kernel] Tool result for ${block.name}:`, typeof result === 'string' ? result.substring(0, 200) : result);
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

    // Return both response and full message history (for conversation continuation)
    response._messages = allMessages;
    return response;
  }

  // ============ DEFAULT TOOLS ============

  const DEFAULT_TOOLS = [
    { type: 'web_search_20250305', name: 'web_search', max_uses: 5 },
    { type: 'memory_20250818', name: 'memory' },
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
      name: 'get_datetime',
      description: 'Get current date, time, timezone, and unix timestamp.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'get_geolocation',
      description: 'Attempt to get user location. May require permission.',
      input_schema: { type: 'object', properties: {} }
    }
  ];

  // ============ callLLM — high-level API for instance use ============

  let constitution = null;

  async function callLLM(messages, opts = {}) {
    const params = {
      model: opts.model || BOOT_MODEL,
      max_tokens: opts.max_tokens || 4096,
      system: opts.system || constitution,
      messages,
      tools: opts.tools || DEFAULT_TOOLS,
    };
    if (opts.thinking !== false) {
      const budgetTokens = opts.thinkingBudget || 4000;
      params.thinking = { type: 'enabled', budget_tokens: budgetTokens };
      // API requires max_tokens > thinking.budget_tokens
      if (params.max_tokens <= budgetTokens) {
        params.max_tokens = budgetTokens + 1024;
      }
    }
    // temperature is handled by sanitizeForAPI — safe even if instance sets it
    if (opts.temperature !== undefined) params.temperature = opts.temperature;

    const response = await callWithToolLoop(params, opts.maxLoops || 10, opts.onStatus);
    if (opts.raw) return response;

    const texts = (response.content || []).filter(b => b.type === 'text');
    return texts.map(b => b.text).join('\n') || '';
  }

  // ============ JSX EXTRACTION + COMPILATION + EXECUTION ============

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
    const componentName = funcMatch?.[1] || constMatch?.[1];

    // Auto-add props parameter if component function has no parameters
    if (componentName && funcMatch) {
      code = code.replace(
        new RegExp('function\\s+' + componentName + '\\s*\\(\\s*\\)'),
        'function ' + componentName + '(props)'
      );
    }
    if (componentName && constMatch && !funcMatch) {
      code = code.replace(
        new RegExp('const\\s+' + componentName + '\\s*=\\s*\\(\\s*\\)\\s*=>'),
        'const ' + componentName + ' = (props) =>'
      );
    }

    if (componentName && !code.includes('module.exports')) {
      code += `\nmodule.exports.default = ${componentName};`;
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

  // ============ REQUEST JSX ONLY (no tools — last resort with constitution context) ============

  async function requestJSXOnly(context) {
    status('requesting interface component (JSX only, with constitution)...');
    const memoryContext = context || '';
    const systemPrompt = [
      constitution || '',
      '',
      '--- CRITICAL INSTRUCTION ---',
      'You MUST output a React component inside a ```jsx code fence. This is the ONLY thing you need to do.',
      'RULES: Inline styles only (dark theme, #0a0a1a background). React hooks via: const { useState, useRef, useEffect } = React;',
      'No import statements. The component receives props: { callLLM, callAPI, callWithToolLoop, constitution, localStorage, memFS, React, ReactDOM, DEFAULT_TOOLS, version, getSource, recompile, model }.',
      'Build a chat interface that reflects your identity from the constitution above. Include: greeting, text input, send button, model version display.',
    ].join('\n');
    const data = await callAPI({
      model: BOOT_MODEL,
      max_tokens: 12000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: memoryContext
          ? `BOOT — Generate your React interface. Memory from previous instances:\n\n${memoryContext}`
          : 'BOOT — Generate your React interface. This is the first boot, no previous memory exists.'
      }],
      thinking: { type: 'enabled', budget_tokens: 8000 },
    });
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    return extractJSX(text);
  }

  // ============ SELF-MODIFICATION ============

  function getSource() {
    return currentJSX || '(no source available)';
  }

  function recompile(newJSX) {
    console.log('[kernel] recompile() called, JSX length:', newJSX?.length);
    if (!newJSX || typeof newJSX !== 'string') {
      return { success: false, error: 'recompile() requires a JSX string' };
    }
    const result = tryCompileAndExecute(newJSX, capabilities);
    if (!result.success) {
      console.error('[kernel] recompile failed:', result.error);
      return { success: false, error: result.error };
    }
    currentJSX = newJSX;
    console.log('[kernel] recompile succeeded, rendering new component');
    reactRoot.render(React.createElement(result.Component, capabilities));
    return { success: true };
  }

  // ============ PHASE 1: API KEY ============

  if (!saved) {
    root.innerHTML = `
      <div style="max-width:500px;margin:80px auto;font-family:monospace;color:#ccc">
        <h2 style="color:#67e8f9">◇ HERMITCRAB 0.3 — G0</h2>
        <p style="color:#666;font-size:13px">HERMITCRAB — full Claude capabilities</p>
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

  // ============ PHASE 2: FETCH CONSTITUTION ============

  status('loading constitution...');
  try {
    const res = await fetch('/g0/constitution.md');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    constitution = await res.text();
    status(`constitution loaded (${constitution.length} chars)`, 'success');
  } catch (e) {
    status(`constitution load failed: ${e.message}`, 'error');
    return;
  }

  status('loading environment brief...');
  try {
    const envRes = await fetch('/g0/environment.md');
    if (envRes.ok) {
      const environment = await envRes.text();
      constitution = constitution + '\n\n---\n\n' + environment;
      status(`environment loaded (${environment.length} chars)`, 'success');
    }
  } catch (e) {
    status('environment load skipped', 'info');
  }

  // ============ PHASE 2.5: PROBE BEST MODEL ============

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
      console.log(`[kernel] Model probe failed for ${model}:`, e.message);
    }
  }

  // ============ PHASE 3: BOOT ============

  status(`calling ${BOOT_MODEL} with thinking + tools...`);

  const capabilities = {
    callLLM, callAPI, callWithToolLoop, constitution, localStorage,
    memFS: memFS(), React, ReactDOM, DEFAULT_TOOLS,
    version: 'hermitcrab-0.3-g0', model: BOOT_MODEL, getSource, recompile,
  };

  try {
    const bootParams = {
      model: BOOT_MODEL,
      max_tokens: 16000,
      system: constitution,
      messages: [{ role: 'user', content: 'BOOT\n\nYour environment brief is included in your system prompt alongside the constitution. It describes your tools, props, skill files, and memory commands.' }],
      tools: DEFAULT_TOOLS,
      thinking: { type: 'enabled', budget_tokens: 10000 },
    };

    // Phase 3a: Let the LLM orient with tools (memory, web, etc.) — generous loop budget
    let data = await callWithToolLoop(bootParams, 10, (toolMsg) => {
      status(`◇ ${toolMsg}`);
    });

    status(`response received (stop: ${data.stop_reason})`, 'success');

    const textBlocks = (data.content || []).filter(b => b.type === 'text');
    const fullText = textBlocks.map(b => b.text).join('\n');

    // ============ PHASE 4: EXTRACT → COMPILE → EXECUTE → RETRY ============

    let jsx = fullText.trim() ? extractJSX(fullText) : null;

    // Phase 4a: If orientation consumed the response without JSX, continue the
    // conversation — the LLM keeps its full context (constitution, memory, tools)
    // and we explicitly demand the JSX component now.
    if (!jsx) {
      status('orientation complete — requesting JSX from same conversation...');
      console.log('[kernel] No JSX from boot response. Continuing conversation to demand JSX.');
      console.log('[kernel] Boot text was:', fullText.substring(0, 500) || '(empty)');

      // Build the continued conversation: original boot + assistant response + demand.
      // If the loop exhausted maxLoops, the final response may still contain tool_use
      // blocks — we need to provide tool_results before our demand message.
      const jsxDemand = [
        'Good — orientation is done. Now output your React interface component.',
        'You MUST include it inside a ```jsx code fence.',
        'Remember: inline styles only (dark theme, #0a0a1a background), React hooks via const { useState, useRef, useEffect } = React;',
        'No import statements. The component receives all capabilities as props.',
        'Build something worthy of your identity — not a minimal placeholder.'
      ].join('\n');

      // Use full conversation history from tool loop (includes all tool_use/tool_result pairs)
      const continuedMessages = [...(data._messages || bootParams.messages)];

      // If response has tool_use blocks (loop hit max), close them with tool_results first
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
        tools: undefined, // no tools — just produce JSX
      });

      const jsxText = (jsxData.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      jsx = extractJSX(jsxText);
    }

    // Phase 4b: Last resort — fresh JSX-only request with constitution context
    if (!jsx) {
      status('continued conversation produced no JSX — trying standalone request...');
      console.log('[kernel] Continued conversation failed to produce JSX. Falling back to requestJSXOnly.');
      jsx = await requestJSXOnly('');

      if (!jsx) {
        status('no JSX after all attempts — refresh to try again', 'error');
        root.innerHTML = `
          <div style="max-width:500px;margin:60px auto;font-family:monospace;color:#ccc;text-align:center;padding:20px">
            <h2 style="color:#67e8f9;margin-bottom:16px">◇ HERMITCRAB 0.3</h2>
            <p style="color:#94a3b8;margin:16px 0">Instance oriented but didn't build its shell yet.</p>
            <p style="color:#94a3b8;margin:16px 0">Memory has been saved — next boot will be better.</p>
            <button onclick="location.reload()" style="margin-top:20px;padding:10px 24px;background:#164e63;color:#67e8f9;border:none;border-radius:4px;cursor:pointer;font-family:monospace;font-size:14px">
              ↻ Refresh to wake instance
            </button>
          </div>`;
        return;
      }
    }

    status('compiling + executing...');
    let result = tryCompileAndExecute(jsx, capabilities);

    let retries = 0;
    while (!result.success && retries < 3) {
      retries++;
      status(`error: ${result.error.substring(0, 80)}... — fix attempt ${retries}/3`);
      console.log(`[kernel] Error (attempt ${retries}):`, result.error);

      const fixData = await callAPI({
        model: BOOT_MODEL,
        max_tokens: 12000,
        system: [
          'Fix this React component. Output ONLY the corrected code inside a ```jsx code fence. No explanation.',
          'RULES: Use inline styles only (no Tailwind/CSS). Use React hooks via destructuring: const { useState, useRef, useEffect } = React;',
          'Do NOT use import statements. Do NOT use export default — just define the component as a function and the kernel will find it.',
          'The component receives props: { callLLM, callAPI, callWithToolLoop, constitution, localStorage, memFS, React, ReactDOM, DEFAULT_TOOLS, version, model, getSource, recompile }.'
        ].join('\n'),
        messages: [{
          role: 'user',
          content: `This React component failed:\n\nError: ${result.error}\n\nCode:\n\`\`\`jsx\n${jsx}\n\`\`\`\n\nFix it. Return complete corrected component in a \`\`\`jsx fence.`
        }],
        thinking: { type: 'enabled', budget_tokens: 6000 },
      });

      const fixText = (fixData.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      const fixedJSX = extractJSX(fixText);
      if (fixedJSX) {
        jsx = fixedJSX;
        result = tryCompileAndExecute(jsx, capabilities);
      } else {
        status('no JSX in fix response', 'error');
        break;
      }
    }

    if (!result.success) {
      status(`failed after ${retries} retries: ${result.error}`, 'error');
      console.log('[kernel] Final failed JSX:', jsx);
      root.innerHTML += `
        <div style="text-align:center;margin-top:20px">
          <button onclick="location.reload()" style="padding:10px 24px;background:#164e63;color:#67e8f9;border:none;border-radius:4px;cursor:pointer;font-family:monospace;font-size:14px">
            ↻ Refresh to retry
          </button>
        </div>`;
      return;
    }

    // ============ PHASE 5: RENDER ============

    currentJSX = jsx;
    reactRoot = ReactDOM.createRoot(root);
    status('rendering...', 'success');
    reactRoot.render(React.createElement(result.Component, capabilities));

  } catch (e) {
    status(`boot failed: ${e.message}`, 'error');
    console.error('[kernel] Boot error:', e);
    root.innerHTML += `
      <div style="text-align:center;margin-top:20px">
        <button onclick="location.reload()" style="padding:10px 24px;background:#164e63;color:#67e8f9;border:none;border-radius:4px;cursor:pointer;font-family:monospace;font-size:14px">
          ↻ Refresh to retry
        </button>
      </div>
      <pre style="color:#f87171;font-family:monospace;padding:20px;font-size:12px;max-width:600px;margin:0 auto;white-space:pre-wrap">${e.stack}</pre>`;
  }
})();
