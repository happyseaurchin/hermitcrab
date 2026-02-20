// bsp.ts — Block · Spindle · Point
// Semantic address resolver for pscale JSON blocks.
// Not code. Coordinates.

export interface PscaleBlock {
  decimal: number
  tree: Record<string, any>
}

export interface SpindleNode {
  pscale: number    // depth below decimal: -1, -2, -3...
  digit: string     // the key at this level
  text: string      // the content at this level (_ summary or leaf string)
}

export type BspResult =
  | { mode: 'block'; tree: Record<string, any> }
  | { mode: 'spindle'; nodes: SpindleNode[] }
  | { mode: 'point'; text: string }

/**
 * bsp — Block · Spindle · Point
 *
 * bsp("wake")              → the full block tree
 * bsp("wake", 0.842)       → spindle: nodes at 0.8, 0.84, 0.842
 * bsp("wake", 0.842, 2)    → point: just the content at the final digit (2)
 *
 * @param block  - block name (string) resolved via blockLoad, or a block object
 * @param spindle - semantic number: each digit after the decimal is a tree key
 * @param point   - focus digit within the spindle. If provided, returns only
 *                  that node's content. Omit for full spindle.
 */
export function bsp(
  block: string | PscaleBlock,
  spindle?: number,
  point?: number
): BspResult {
  // Resolve block name to object (caller provides blockLoad or passes object)
  const blk = typeof block === 'string'
    ? (globalThis as any).__bspBlockLoad?.(block) as PscaleBlock | undefined
    : block

  if (!blk?.tree) {
    return { mode: 'block', tree: {} }
  }

  // Block mode — no spindle, return full tree
  if (spindle === undefined) {
    return { mode: 'block', tree: blk.tree }
  }

  // Parse semantic number into digit sequence
  const str = spindle.toFixed(10)
  const dot = str.indexOf('.')
  const digits = dot === -1 ? [] : str.slice(dot + 1).replace(/0+$/, '').split('')

  // Walk the tree, building the spindle chain
  const nodes: SpindleNode[] = []
  let node: any = blk.tree

  for (let i = 0; i < digits.length; i++) {
    const d = digits[i]
    if (node[d] === undefined) break
    node = node[d]
    const text = typeof node === 'string'
      ? node
      : (typeof node === 'object' && node !== null && typeof node['_'] === 'string')
        ? node['_']
        : JSON.stringify(node)
    nodes.push({ pscale: -(i + 1), digit: d, text })
  }

  if (nodes.length === 0) {
    return { mode: 'spindle', nodes: [] }
  }

  // Point mode — return just the focused node
  if (point !== undefined) {
    // Find the node matching the requested digit
    const target = nodes.find(n => n.digit === String(point))
    if (target) {
      return { mode: 'point', text: target.text }
    }
    // Default: last node in spindle
    return { mode: 'point', text: nodes[nodes.length - 1].text }
  }

  // Spindle mode — return the full chain
  return { mode: 'spindle', nodes }
}

/**
 * Register a block loader so bsp can resolve block names.
 * Call once at kernel init: bspRegister(blockLoad)
 */
export function bspRegister(loader: (name: string) => PscaleBlock | undefined) {
  (globalThis as any).__bspBlockLoad = loader
}
