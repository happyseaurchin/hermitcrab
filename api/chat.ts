/**
 * chat.ts — Marvin magi endpoint.
 *
 * Receives user message + shell state from browser.
 * Compiles context, calls Anthropic API with A-loop, routes output.
 * Returns updated shell + response.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';
import { bsp, walk, writeAt, parseStar, type Block } from '../marvin/lib/bsp.js';
import { compileContext, type BlockLoader } from '../marvin/lib/compile.js';
import { TOOL_SCHEMAS, executeTool } from '../marvin/lib/tools.js';
import { parseOutput, routeOutput } from '../marvin/lib/output.js';
import { appendConversation, writeHistoryEntry } from '../marvin/lib/history.js';

const ALLOWED_ORIGINS = [
  'https://idiothuman.com',
  'https://www.idiothuman.com',
  'http://localhost:5173',
  'http://localhost:3000',
];

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.some(a => origin.startsWith(a))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function parseCookies(req: VercelRequest): Record<string, string> {
  const raw = req.headers.cookie || '';
  const cookies: Record<string, string> = {};
  for (const pair of raw.split(';')) {
    const eq = pair.indexOf('=');
    if (eq > 0) cookies[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return cookies;
}

// ── Static block loading ──

const BLOCKS_DIR = join(process.cwd(), 'marvin', 'blocks');
const _staticCache: Record<string, Block> = {};

function loadStaticBlock(name: string): Block {
  if (_staticCache[name]) return _staticCache[name];
  try {
    const raw = readFileSync(join(BLOCKS_DIR, `${name}.json`), 'utf-8');
    const block = JSON.parse(raw);
    _staticCache[name] = block;
    return block;
  } catch {
    return { _: name };
  }
}

const STATIC_BLOCK_NAMES = [
  'starstone', 'identity', 'concern',
  'pscale-spec', 'hermitcrab', 'sand', 'magi-xstream',
  'intro_induction_pscale',
  'volume_0_pscale', 'volume_1_pscale_10k', 'volume_2_pscale', 'volume_3_pscale',
  'volume_m1_pscale', 'volume_m2_pscale', 'volume_m3_pscale',
];

const SHELL_BLOCK_NAMES = ['conversation', 'history', 'conditions', 'purpose'];

// ── Anthropic API call ──

async function apiCall(
  apiKey: string,
  system: string,
  messages: any[],
  tools: any[],
  model: string = 'claude-sonnet-4-20250514',
): Promise<any> {
  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    system,
    messages,
  };
  if (tools.length > 0) body.tools = tools;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic ${response.status}: ${err}`);
  }

  return response.json();
}

// ── A-loop ──

interface ALoopResult {
  text: string;
  toolLog: Array<{ name: string; input: string; output: string }>;
  tokens: { input: number; output: number };
}

async function aLoop(
  apiKey: string,
  system: string,
  initialMessage: string,
  tools: any[],
  shellBlocks: Record<string, Block>,
  loadBlock: BlockLoader,
  allBlockNames: string[],
): Promise<ALoopResult> {
  const toolLog: ALoopResult['toolLog'] = [];
  const tokens = { input: 0, output: 0 };
  const messages: any[] = [{ role: 'user', content: initialMessage }];

  for (let iteration = 0; iteration < 10; iteration++) {
    const result = await apiCall(apiKey, system, messages, tools);

    const usage = result.usage || {};
    tokens.input += usage.input_tokens || 0;
    tokens.output += usage.output_tokens || 0;

    const contentBlocks = result.content || [];
    const stopReason = result.stop_reason || 'end_turn';

    const texts: string[] = [];
    const toolUses: any[] = [];
    for (const block of contentBlocks) {
      if (block.type === 'text') texts.push(block.text);
      else if (block.type === 'tool_use') toolUses.push(block);
    }

    if (stopReason !== 'tool_use' || toolUses.length === 0) {
      return { text: texts.join('\n'), toolLog, tokens };
    }

    messages.push({ role: 'assistant', content: contentBlocks });
    const toolResults: any[] = [];
    for (const tu of toolUses) {
      const resultStr = executeTool(tu.name, tu.input || {}, shellBlocks, loadBlock, allBlockNames);
      toolLog.push({
        name: tu.name,
        input: JSON.stringify(tu.input || {}).slice(0, 200),
        output: resultStr.slice(0, 200),
      });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: resultStr.slice(0, 4000),
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return { text: '[A-loop exhausted after 10 iterations]', toolLog, tokens };
}

// ── Main handler ──

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cookies = parseCookies(req);
  const apiKey = process.env.VAULT_KEY_CLAUDE || cookies.hc_claude;
  if (!apiKey) return res.status(401).json({ error: 'No API key.' });
  if (!apiKey.startsWith('sk-ant-')) return res.status(401).json({ error: 'Invalid API key format' });

  const { message, shell } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message required' });
  }

  const shellBlocks: Record<string, Block> = {};
  for (const name of SHELL_BLOCK_NAMES) {
    shellBlocks[name] = shell?.[name] ? JSON.parse(JSON.stringify(shell[name])) : { _: name };
  }

  const allBlockNames = [...new Set([...SHELL_BLOCK_NAMES, ...STATIC_BLOCK_NAMES])];
  const loadBlock: BlockLoader = (name: string) => {
    if (name in shellBlocks) return shellBlocks[name];
    return loadStaticBlock(name);
  };

  const concern = loadStaticBlock('concern');
  let fnConfig: Block = {};
  for (const key of Object.keys(concern).filter(k => /^\d$/.test(k))) {
    const node = concern[key];
    if (node && typeof node === 'object' && '_' in node && typeof node._ === 'object') {
      const trigger = node._['2'];
      if (trigger === 'human') {
        fnConfig = node._['3'] || {};
        break;
      }
    }
  }

  if (!fnConfig || Object.keys(fnConfig).length === 0) {
    return res.status(500).json({ error: 'No engagement concern found' });
  }

  const starstone = loadStaticBlock('starstone');
  let system: string, compiledMessage: string;
  try {
    const result = compileContext(fnConfig, starstone, loadBlock);
    system = result.system;
    compiledMessage = result.message;
  } catch (e: any) {
    return res.status(500).json({ error: `Compilation failed: ${e.message}` });
  }

  const fullMessage = compiledMessage + `\n\n=== HUMAN INPUT ===\n${message}`;

  let text: string, toolLog: any[], tokens: any;
  try {
    const result = await aLoop(apiKey, system, fullMessage, TOOL_SCHEMAS, shellBlocks, loadBlock, allBlockNames);
    text = result.text;
    toolLog = result.toolLog;
    tokens = result.tokens;
  } catch (e: any) {
    return res.status(502).json({ error: `LLM call failed: ${e.message}` });
  }

  const output = parseOutput(text);
  const note = output.note || text.slice(0, 2000);

  routeOutput(output, shellBlocks);
  writeHistoryEntry(shellBlocks.history, note.slice(0, 200));
  appendConversation(shellBlocks.conversation, message, note);

  return res.status(200).json({
    response: note,
    shell: shellBlocks,
    frame: {
      ts: new Date().toISOString(),
      tier: 'sonnet',
      tokens,
      tools: toolLog.length,
      toolLog,
      status: output.status,
    },
  });
}
