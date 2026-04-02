/**
 * bsp.ts — Block Structural Protocol engine.
 *
 * Port of mobius-2 kernel.py lines 1-176.
 * Pure functions, no I/O. Operates on raw pscale JSON blocks.
 */

export type Block = Record<string, any>;

/** Follow underscore chain to deepest string. Return [text, hasHidden]. */
export function underscoreText(node: any): [string, boolean] {
  if (typeof node === 'string') return [node, false];
  if (node && typeof node === 'object' && '_' in node) {
    const us = node._;
    const hasHidden = Object.keys(node).some(k => k !== '_' && /^\d$/.test(k));
    if (typeof us === 'string') return [us, hasHidden];
    if (us && typeof us === 'object') {
      const [innerText] = underscoreText(us);
      const innerHidden = Object.keys(us).some(k => k !== '_' && /^\d$/.test(k));
      return [innerText, hasHidden || innerHidden];
    }
  }
  return ['', false];
}

/** Navigate block by digit address. Return [spindle, terminalNode]. */
export function walk(block: Block, address: string = '_'): [string[], any] {
  const spindle: string[] = [];
  let node: any = block;

  // Collect root underscore
  if (node && typeof node === 'object' && '_' in node) {
    const [text] = underscoreText(node);
    if (text) spindle.push(text);
  }

  if (address === '_' || address === '' || address == null) {
    return [spindle, node];
  }

  // Parse address: "1.2.3" or "123" or "1"
  const digits = String(address).includes('.')
    ? String(address).split('.')
    : [...String(address)];

  for (const d of digits) {
    if (!node || typeof node !== 'object') return [spindle, null];
    const key = d === '0' ? '_' : d;
    if (!(key in node)) return [spindle, null];
    node = node[key];
    if (node && typeof node === 'object' && '_' in node) {
      const [text] = underscoreText(node);
      if (text) spindle.push(text);
    } else if (typeof node === 'string') {
      spindle.push(node);
    }
  }

  return [spindle, node];
}

/** Recursively collect all nodes at target depth. */
function collectDisc(node: any, targetDepth: number, currentDepth: number, results: Array<{ key: string; text: string }>) {
  if (!node || typeof node !== 'object') return;
  for (const k of Object.keys(node).filter(k => /^\d$/.test(k)).sort()) {
    const child = node[k];
    if (currentDepth + 1 === targetDepth) {
      const [text] = typeof child === 'object' ? underscoreText(child) : [typeof child === 'string' ? child : '', false];
      if (text) results.push({ key: k, text });
    } else if (child && typeof child === 'object') {
      collectDisc(child, targetDepth, currentDepth + 1, results);
    }
  }
}

export type BspMode = 'spindle' | 'ring' | 'dir' | 'point' | 'disc' | 'star';

const VALID_MODES = new Set<BspMode>(['spindle', 'ring', 'dir', 'point', 'disc', 'star']);

export function isValidMode(m: string): m is BspMode {
  return VALID_MODES.has(m as BspMode);
}

/** Read block at address in given mode. */
export function bsp(block: Block, address: string = '_', mode: BspMode = 'spindle'): any {
  const [spindle, terminal] = walk(block, address);

  if (mode === 'spindle') return spindle;
  if (mode === 'point') return spindle.length > 0 ? spindle[spindle.length - 1] : '';

  if (mode === 'ring') {
    if (!terminal || typeof terminal !== 'object') return {};
    const result: Record<string, string> = {};
    for (const k of Object.keys(terminal).filter(k => /^\d$/.test(k)).sort()) {
      const child = terminal[k];
      const [text] = typeof child === 'object' ? underscoreText(child) : [typeof child === 'string' ? child : '', false];
      result[k] = text;
    }
    return result;
  }

  if (mode === 'dir') return terminal ?? {};

  if (mode === 'disc') {
    const results: Array<{ key: string; text: string }> = [];
    const depth = (address !== '_' && address !== '' && address != null && /^\d+$/.test(String(address)))
      ? parseInt(String(address), 10) : 1;
    collectDisc(block, depth, 0, results);
    return results;
  }

  if (mode === 'star') {
    if (terminal && typeof terminal === 'object' && '_' in terminal) {
      const us = terminal._;
      if (us && typeof us === 'object') {
        const result: Record<string, any> = {};
        for (const [k, v] of Object.entries(us)) {
          if (k !== '_') result[k] = v;
        }
        return result;
      }
    }
    return {};
  }

  return spindle; // fallback
}

/** Write value at address, creating intermediate nodes as needed. */
export function writeAt(block: Block, address: string, value: any): Block {
  if (address === '_' || address === '' || address == null) {
    block._ = value;
    return block;
  }

  const parts = String(address).includes('.')
    ? String(address).split('.')
    : [...String(address)];

  let node: any = block;
  for (const part of parts.slice(0, -1)) {
    const key = part === '0' ? '_' : part;
    if (!(key in node) || typeof node[key] !== 'object') {
      node[key] = {};
    }
    node = node[key];
  }

  const finalKey = parts[parts.length - 1] === '0' ? '_' : parts[parts.length - 1];
  node[finalKey] = value;
  return block;
}

/** Parse 'blockname:address' -> [blockname, address]. */
export function parseStar(ref: any): [string | null, string] {
  if (typeof ref !== 'string') return [null, '_'];
  if (ref.includes(':')) {
    const [name, addr] = ref.split(':', 2);
    return [name, addr || '_'];
  }
  return [ref, '_'];
}
