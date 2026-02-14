// HERMITCRAB 0.2 — G1: Pscale Native
// T:0.1 — the temporal entry point. Reads code from S:0.x coordinates.
// Logarithmic memory at M:1, M:2... M:10 (summary), M:11...

(async function boot() {
  const root = document.getElementById('root');
  const saved = localStorage.getItem('xstream_api_key');
  const PS_PREFIX = 'ps:';

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
        <h2 style="color:#a78bfa;margin-bottom:16px">◇ HERMITCRAB 0.2 — G1</h2>
        ${html}
        <div style="color:#555;margin-top:12px;font-size:11px">
          ${statusLines[statusLines.length-1]?.type === 'error' ? '' : '▪ working...'}
        </div>
      </div>`;
  }

  // ============ PSCALE COORDINATE STORAGE ============

  function pscaleStore() {
    function key(coord) { return PS_PREFIX + coord; }

    return {
      read(coord) {
        return localStorage.getItem(key(coord));
      },

      write(coord, content) {
        localStorage.setItem(key(coord), content);
        return coord;
      },

      delete(coord) {
        localStorage.removeItem(key(coord));
        return coord;
      },

      list(prefix) {
        const results = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k.startsWith(PS_PREFIX)) {
            const coord = k.slice(PS_PREFIX.length);
            if (!prefix || coord.startsWith(prefix)) {
              results.push(coord);
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
        const num = parseInt(coord.replace('M:', ''));
        if (isNaN(num)) return [];
        const str = String(num);
        const layers = [];
        for (let i = str.length; i >= 1; i--) {
          const magnitude = Math.pow(10, i - 1);
          const rounded = Math.floor(num / magnitude) * magnitude;
          if (rounded > 0) layers.push('M:' + rounded);
        }
        return [...new Set(layers)];
      },

      contextContent(coord) {
        const layers = this.context(coord);
        const result = {};
        for (const c of layers) {
          const content = this.read(c);
          if (content) result[c] = content;
        }
        return result;
      }
    };
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

  // ============ API LAYER ============

  function cleanParams(params) {
    const clean = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) clean[k] = v;
    }
    return clean;
  }

  async function callAPI(params) {
    const apiKey = localStorage.getItem('xstream_api_key');
    const sanitized = cleanParams(params);
    console.log('[g1] callAPI →', sanitized.model, 'messages:', sanitized.messages?.length);

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
    return response;
  }

  // ============ DEFAULT TOOLS ============

  const DEFAULT_TOOLS = [
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
      name: 'get_datetime',
      description: 'Get current date, time, timezone, and unix timestamp.',
      input_schema: { type: 'object', properties: {} }
    }
  ];

  // ============ callLLM ============

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
      params.thinking = { type: 'enabled', budget_tokens: opts.thinkingBudget || 4000 };
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
    const componentMatch = text.match(/((?:const|function|export)\s+\w+[\s\S]*?(?:return\s*\([\s\S]*?\);?\s*\}|=>[\s\S]*?\);?\s*))/);
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
        <p style="color:#666;font-size:13px">XSTREAM SEED — pscale native</p>
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
      localStorage.setItem('xstream_api_key', k);
      boot();
    };
    return;
  }

  // ============ PSCALE INSTANCE ============

  const pscale = pscaleStore();

  // ============ PHASE 2: LOAD OR SEED COORDINATES ============

  status('checking pscale coordinates...');

  const existingKernel = pscale.read('S:0.11');

  if (!existingKernel) {
    status('first boot — seeding coordinates from served files...');

    try {
      const kernelRes = await fetch('/g1/kernel.js');
      const kernelSrc = await kernelRes.text();
      pscale.write('S:0.11', kernelSrc);
      status('S:0.11 ← kernel.js', 'success');
    } catch (e) {
      status(`failed to seed kernel: ${e.message}`, 'error');
    }

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

    pscale.write('S:0.1', [
      '# Platform Index (S:0.1)',
      '',
      '| Coordinate | Content |',
      '|-----------|---------|',
      '| S:0.11 | kernel.js — boot sequence (T:0.1) |',
      '| S:0.12 | constitution.md — system prompt |',
      '| S:0.13 | API proxy — /api/claude passthrough |',
      '| S:0.2 | Current running interface (JSX) |',
      '| S:0.2N | Interface version history |',
    ].join('\n'));

    pscale.write('S:0.13', 'Vercel serverless function at /api/claude. Proxies requests to api.anthropic.com with the user\'s API key from X-API-Key header. Passthrough — no modification.');

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

    const savedJSX = pscale.read('S:0.2');
    if (savedJSX) {
      status('found saved interface at S:0.2 — attempting restore...');
      const result = tryCompileAndExecute(savedJSX, null);
      if (result.success) {
        status('S:0.2 compiles OK — will use saved interface', 'success');
      } else {
        status('saved interface has errors — will boot fresh', 'error');
        pscale.delete('S:0.2');
      }
    }
  }

  // ============ PHASE 2.5: PROBE MODEL ============

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

  // ============ CAPABILITIES ============

  const capabilities = {
    callLLM, callAPI, callWithToolLoop, constitution, localStorage,
    pscale, React, ReactDOM, DEFAULT_TOOLS,
    version: 'hermitcrab-0.2-g1', getSource, recompile,
  };

  // ============ PHASE 3: BOOT OR RESTORE ============

  const savedJSX = pscale.read('S:0.2');

  if (savedJSX) {
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
  }

  status(`calling ${BOOT_MODEL} with thinking + tools...`);

  try {
    const bootParams = {
      model: BOOT_MODEL,
      max_tokens: 16000,
      system: constitution,
      messages: [{ role: 'user', content: 'BOOT' }],
      tools: DEFAULT_TOOLS,
      thinking: { type: 'enabled', budget_tokens: 10000 },
    };

    let data = await callWithToolLoop(bootParams, 5, (toolMsg) => {
      status(`◇ ${toolMsg}`);
    });

    status(`response received (stop: ${data.stop_reason})`, 'success');

    const textBlocks = (data.content || []).filter(b => b.type === 'text');
    const fullText = textBlocks.map(b => b.text).join('\n');

    if (!fullText.trim()) {
      status('no text in response', 'error');
      return;
    }

    let jsx = extractJSX(fullText);
    if (!jsx) {
      status('no JSX — requesting explicit component...');
      const retryData = await callAPI({
        model: BOOT_MODEL,
        max_tokens: 12000,
        system: 'Output ONLY a React component inside a ```jsx code fence. No prose.',
        messages: [{
          role: 'user',
          content: 'Generate a React chat interface. Props: callLLM, callAPI, callWithToolLoop, constitution, localStorage, pscale, React, ReactDOM, DEFAULT_TOOLS, version, getSource, recompile. Dark theme, inline styles, React hooks from global React.'
        }],
        thinking: { type: 'enabled', budget_tokens: 8000 },
      });
      const retryText = (retryData.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      jsx = extractJSX(retryText);
      if (!jsx) {
        status('still no JSX', 'error');
        root.innerHTML = `<div style="font-family:monospace;color:#ccc;padding:40px;white-space:pre-wrap;max-width:700px;margin:0 auto">${fullText}</div>`;
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
          'Fix this React component. Output ONLY corrected code in a ```jsx fence.',
          'RULES: Inline styles. React hooks via const { useState, useRef, useEffect } = React;',
          'No imports. No export default. Props: { callLLM, callAPI, callWithToolLoop, constitution, localStorage, pscale, React, ReactDOM, DEFAULT_TOOLS, version, getSource, recompile }.'
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
    pscale.write('S:0.21', jsx);

    reactRoot = ReactDOM.createRoot(root);
    status('rendering + persisted to S:0.2', 'success');
    reactRoot.render(React.createElement(result.Component, capabilities));

  } catch (e) {
    status(`boot failed: ${e.message}`, 'error');
    console.error('[g1] Boot error:', e);
  }
})();
