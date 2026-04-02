/**
 * history.ts — History and conversation append helpers.
 *
 * Port of mobius-2 kernel.py lines 692-759.
 * Pscale-structured append: fills digits 1-9 at the active edge.
 */

import type { Block } from './bsp.js';

/** Find first free digit (1-9) at the active edge. Return [path, slot] or [null, null] if full. */
export function findWritePosition(block: Block): [string, string | null] {
  for (let i = 1; i <= 9; i++) {
    const key = String(i);
    if (!(key in block)) return ['', key];
    const child = block[key];
    if (child && typeof child === 'object') {
      const [subPath, subSlot] = findWritePosition(child);
      if (subSlot) return [path(key, subPath), subSlot];
    }
  }
  return ['', null]; // All 9 full at all levels
}

function path(a: string, b: string): string {
  return b ? `${a}.${b}` : a;
}

/** Write note to history block. Return true if compression needed. */
export function writeHistoryEntry(block: Block, note: string): boolean {
  const [p, slot] = findWritePosition(block);
  if (slot === null) return true; // Needs compression

  const ts = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const entry = `[${ts}] ${note}`;

  if (p) {
    const parts = p.split('.').filter(Boolean);
    let node: any = block;
    for (const part of parts) {
      if (part in node && typeof node[part] === 'object') {
        node = node[part];
      } else {
        node[part] = {};
        node = node[part];
      }
    }
    node[slot] = entry;
  } else {
    block[slot] = entry;
  }

  return false;
}

/** Append exchange to conversation block. Return true if compression needed. */
export function appendConversation(convBlock: Block, humanMsg: string | null, agentResponse: string | null): boolean {
  const [p, slot] = findWritePosition(convBlock);
  if (slot === null) return true;

  const entry: Record<string, string> = {
    '1': humanMsg || '',
    '2': agentResponse || '',
  };

  if (p) {
    const parts = p.split('.').filter(Boolean);
    let node: any = convBlock;
    for (const part of parts) {
      if (part in node && typeof node[part] === 'object') {
        node = node[part];
      } else {
        node[part] = {};
        node = node[part];
      }
    }
    node[slot] = entry;
  } else {
    convBlock[slot] = entry;
  }

  return false;
}
