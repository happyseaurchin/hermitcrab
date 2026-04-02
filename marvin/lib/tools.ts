/**
 * tools.ts — Tool schemas and execution for the magi A-loop.
 *
 * Port of mobius-2 kernel.py lines 426-518.
 * Four tools: bsp, block_read, block_write, block_list.
 */

import { bsp as bspFn, walk, writeAt, type Block, type BspMode, isValidMode } from './bsp.js';
import type { BlockLoader } from './compile.js';

export const TOOL_SCHEMAS = [
  {
    name: 'bsp',
    description: 'Navigate a pscale block using BSP. Modes: spindle (default, broad-to-specific chain), ring (siblings at terminal), dir (full subtree), point (single text), disc (all nodes at depth), star (hidden directory).',
    input_schema: {
      type: 'object' as const,
      properties: {
        block: { type: 'string' as const, description: 'Block name to navigate' },
        address: { type: 'string' as const, default: '_', description: 'Pscale address (e.g. "1.2.3" or "_")' },
        mode: { type: 'string' as const, default: 'spindle', enum: ['spindle', 'ring', 'dir', 'point', 'disc', 'star'] },
      },
      required: ['block'],
    },
  },
  {
    name: 'block_read',
    description: 'Read raw block content at a path. Returns the JSON subtree.',
    input_schema: {
      type: 'object' as const,
      properties: {
        block: { type: 'string' as const, description: 'Block name' },
        path: { type: 'string' as const, default: '_', description: 'Pscale address to read from' },
      },
      required: ['block'],
    },
  },
  {
    name: 'block_write',
    description: 'Write content to a mutable shell block at a path. Creates intermediate nodes. Cannot write to read-only knowledge blocks.',
    input_schema: {
      type: 'object' as const,
      properties: {
        block: { type: 'string' as const, description: 'Block name (must be a mutable shell block: conversation, history, conditions, purpose)' },
        path: { type: 'string' as const, description: 'Pscale address to write to' },
        content: { description: 'Content to write (string or object)' },
      },
      required: ['block', 'path', 'content'],
    },
  },
  {
    name: 'block_list',
    description: 'List all available block names (both knowledge blocks and shell blocks).',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
];

const MUTABLE_BLOCKS = new Set(['conversation', 'history', 'conditions', 'purpose']);

/**
 * Execute a tool call. Returns result string.
 *
 * @param shellBlocks - mutable shell blocks (modified in place by block_write)
 * @param loadBlock - resolves any block name (shell or static)
 * @param allBlockNames - list of all available block names
 */
export function executeTool(
  name: string,
  input: Record<string, any>,
  shellBlocks: Record<string, Block>,
  loadBlock: BlockLoader,
  allBlockNames: string[],
): string {
  try {
    if (name === 'bsp') {
      const block = loadBlock(input.block);
      const mode: BspMode = (input.mode && isValidMode(input.mode)) ? input.mode : 'spindle';
      const result = bspFn(block, input.address ?? '_', mode);
      return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    }

    if (name === 'block_read') {
      const block = loadBlock(input.block);
      const [, node] = walk(block, input.path ?? '_');
      if (node === null || node === undefined) return '(empty)';
      return typeof node === 'string' ? node : JSON.stringify(node, null, 2);
    }

    if (name === 'block_write') {
      const blockName = input.block;
      if (!MUTABLE_BLOCKS.has(blockName)) {
        return `Error: "${blockName}" is read-only. Writable blocks: ${[...MUTABLE_BLOCKS].join(', ')}`;
      }
      if (!shellBlocks[blockName]) shellBlocks[blockName] = { _: blockName };
      writeAt(shellBlocks[blockName], input.path, input.content);
      return `Wrote to ${blockName}:${input.path}`;
    }

    if (name === 'block_list') {
      return JSON.stringify(allBlockNames);
    }

    return `Unknown tool: ${name}`;
  } catch (e: any) {
    return `Tool error (${name}): ${e.message}`;
  }
}
