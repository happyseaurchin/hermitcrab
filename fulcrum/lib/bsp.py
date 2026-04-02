#!/usr/bin/env python3
"""
bsp.py — Block · Spindle · Point
Semantic address resolver for pscale JSON blocks.

Seven modes:
    bsp(block)                        → dir: full block tree
    bsp(block, 'ref')                 → ref: block named, zero tokens
    bsp(block, spindle)               → spindle: path chain wide→specific
    bsp(block, spindle, point)        → point: single node at pscale level
    bsp(block, spindle, 'ring')       → ring: siblings at terminal point (no spindle)
    bsp(block, spindle, 'dir')        → dir: subtree from endpoint down (no spindle)
    bsp(block, spindle, pt, 'disc')   → disc: all nodes at pscale pt, block-wide

Usage from command line:
    python lib/bsp.py wake                     # dir (full tree)
    python lib/bsp.py wake ref                 # reference (zero tokens)
    python lib/bsp.py wake 0.12               # spindle mode
    python lib/bsp.py wake 0.12 -1            # point mode (pscale level)
    python lib/bsp.py wake 0.12 ring          # ring (siblings at terminal)
    python lib/bsp.py wake 0.12 dir           # dir (subtree from endpoint)
    python lib/bsp.py concerns _ 5 disc       # disc (all nodes at pscale 5)
    python lib/bsp.py cooking 0.192 ring      # concern architecture siblings

Usage from Python:
    from bsp import bsp, bsp_register
    bsp_register(lambda name: json.load(open(f'blocks/{name}.json')))
    result = bsp('wake', 0.12, 'ring')
"""

import json
import sys
import os

# ============ BLOCK NAVIGATION ============

def block_navigate(block, path):
    """Walk a dot-separated path through block['tree']."""
    if not path:
        return block.get('tree')
    node = block.get('tree')
    for k in path.split('.'):
        if node is None or isinstance(node, str):
            return None
        if isinstance(node, dict):
            node = node.get(k)
        else:
            return None
    return node


def x_spread(block, path):
    """Spread: node text + immediate children summaries."""
    node = block_navigate(block, path) if path else block.get('tree')
    if node is None:
        return None
    if isinstance(node, str):
        return {'text': node, 'children': []}
    text = node.get('_')
    children = []
    for k, v in node.items():
        if k == '_':
            continue
        if isinstance(v, str):
            child_text = v
        elif isinstance(v, dict) and '_' in v:
            child_text = v['_']
        else:
            child_text = None
        children.append({
            'digit': k,
            'text': child_text,
            'branch': isinstance(v, dict)
        })
    return {'text': text, 'children': children}


# ============ TUNING FORK ============

def get_tuning_decimal_position(blk):
    """Where pscale 0 sits, from the block's tuning field."""
    if not blk or 'tuning' not in blk:
        return None
    parts = str(blk['tuning']).split('.')
    int_str = parts[0] or '0'
    return 0 if int_str == '0' else len(int_str)


def get_compression_depth(tree):
    """How many '0' keys exist from tree root (compression layers)."""
    depth = 0
    node = tree
    while isinstance(node, dict) and '0' in node:
        depth += 1
        node = node['0']
    return depth


# ============ BSP — Block · Spindle · Point ============

_block_loader = None

def bsp_register(loader):
    """Register a function that resolves block names to block dicts."""
    global _block_loader
    _block_loader = loader


def bsp(block, spindle=None, point=None, fn=None):
    """
    Block · Spindle · Point — semantic address resolution.

    bsp('wake')                  → dir (full tree)
    bsp('wake', 'ref')           → reference (zero tokens)
    bsp('wake', 0.12)            → spindle (depth walk with pscale labels)
    bsp('wake', 0.12, -1)        → point (content at pscale level)
    bsp('wake', 0.12, 'ring')    → ring (siblings at terminal, no spindle)
    bsp('wake', 0.12, 'dir')     → dir (subtree from endpoint, no spindle)
    bsp('wake', 0.12, 5, 'disc') → disc (all nodes at pscale 5, block-wide)
    """
    # Resolve block
    block_name = block if isinstance(block, str) else None
    if isinstance(block, str):
        blk = _block_loader(block) if _block_loader else None
    else:
        blk = block

    # Mode: reference — bsp(block, 'ref')
    if spindle == 'ref':
        return {'mode': 'ref', 'block': block_name}

    if not blk or 'tree' not in blk:
        return {'mode': 'dir', 'tree': {}}

    # Mode: dir (full) — bsp(block) with no other args
    if spindle is None and point is None and fn is None:
        return {'mode': 'dir', 'tree': blk['tree']}

    # ---- Parse the semantic number ----
    if spindle is None:
        # No spindle but other args present (e.g. disc with null spindle)
        walk_digits = []
        has_pscale = True
        tuning_decimal = get_tuning_decimal_position(blk)
        digits_before = tuning_decimal if tuning_decimal is not None else 0
    else:
        s = f'{spindle:.10f}' if isinstance(spindle, (int, float)) else str(spindle)
        parts = s.split('.')
        int_str = parts[0] or '0'
        frac_str = (parts[1] if len(parts) > 1 else '').rstrip('0')

        is_delineation = (int_str == '0')

        if is_delineation:
            walk_digits = [c for c in frac_str]
        else:
            walk_digits = list(int_str + frac_str)

        has_pscale = is_delineation or len(frac_str) > 0
        spindle_tree_depth = 0 if is_delineation else len(int_str)

        tuning_decimal = get_tuning_decimal_position(blk)
        if tuning_decimal is not None:
            digits_before = tuning_decimal
        elif is_delineation:
            digits_before = 0
        elif has_pscale:
            digits_before = len(int_str)
        else:
            digits_before = -1

        if tuning_decimal is not None:
            has_pscale = True

        # Tuning fork compensation
        if tuning_decimal is not None:
            needed = max(0, tuning_decimal - spindle_tree_depth)
            if needed > 0:
                max_comp = get_compression_depth(blk['tree'])
                zeros = min(needed, max_comp)
                if zeros > 0:
                    walk_digits = ['0'] * zeros + walk_digits

    # ---- Build spindle nodes ----
    nodes = []
    node = blk['tree']

    if isinstance(node, dict) and isinstance(node.get('_'), str):
        root_text = node['_']
        nodes.append({'pscale': digits_before if has_pscale else None, 'text': root_text})

    for i, d in enumerate(walk_digits):
        if not isinstance(node, dict) or d not in node:
            break
        node = node[d]
        if isinstance(node, str):
            text = node
        elif isinstance(node, dict) and isinstance(node.get('_'), str):
            text = node['_']
        else:
            text = json.dumps(node)
        nodes.append({
            'pscale': (digits_before - 1) - i if has_pscale else None,
            'digit': d,
            'text': text
        })

    # ---- Mode: ring — siblings at terminal point ----
    if point == 'ring':
        if len(walk_digits) == 0:
            return {'mode': 'ring', 'siblings': []}
        parent_path = '.'.join(walk_digits[:-1]) if len(walk_digits) > 1 else None
        terminal_digit = walk_digits[-1]
        parent_node = block_navigate(blk, parent_path) if parent_path else blk['tree']
        if not parent_node or not isinstance(parent_node, dict):
            return {'mode': 'ring', 'siblings': []}
        siblings = []
        for d in range(10):
            k = str(d)
            if k == terminal_digit or k not in parent_node:
                continue
            v = parent_node[k]
            child_text = v if isinstance(v, str) else (v.get('_') if isinstance(v, dict) else None)
            siblings.append({
                'digit': k,
                'text': child_text,
                'branch': isinstance(v, dict)
            })
        return {'mode': 'ring', 'siblings': siblings}

    # ---- Mode: dir (subtree) — bsp(block, spindle, 'dir') ----
    if point == 'dir':
        end_path = '.'.join(walk_digits) if walk_digits else None
        end_node = block_navigate(blk, end_path) if end_path else blk['tree']
        return {'mode': 'dir', 'path': end_path, 'subtree': end_node}

    # ---- Mode: disc — transversal at pscale ----
    if fn == 'disc' and point is not None:
        ps = int(point) if isinstance(point, str) else point
        tuning_dec = get_tuning_decimal_position(blk)
        ref_decimal = tuning_dec if tuning_dec is not None else digits_before
        target_depth = ref_decimal - ps
        if target_depth < 0:
            return {'mode': 'disc', 'pscale': ps, 'nodes': []}

        disc_nodes = []
        def walk_disc(n, depth, path):
            if depth == target_depth:
                if isinstance(n, str):
                    text = n
                elif isinstance(n, dict) and isinstance(n.get('_'), str):
                    text = n['_']
                else:
                    text = None
                disc_nodes.append({'path': path, 'text': text})
                return
            if not isinstance(n, dict):
                return
            for d in range(10):
                k = str(d)
                if k in n:
                    child_path = f'{path}.{k}' if path else k
                    walk_disc(n[k], depth + 1, child_path)
        walk_disc(blk['tree'], 0, '')
        return {'mode': 'disc', 'pscale': ps, 'nodes': disc_nodes}

    if len(nodes) == 0:
        return {'mode': 'spindle', 'nodes': []}

    # ---- Mode: point ----
    if point is not None and fn is None:
        p = int(point) if isinstance(point, str) else point
        target = next((n for n in nodes if n.get('pscale') == p), None)
        if target:
            return {'mode': 'point', 'text': target['text'], 'pscale': target['pscale']}
        last = nodes[-1]
        return {'mode': 'point', 'text': last['text'], 'pscale': last.get('pscale')}

    # ---- Mode: spindle ----
    return {'mode': 'spindle', 'nodes': nodes}


# ============ WRITE OPERATIONS ============

def block_write_node(block, path, content):
    """Write content to a path in a block. Creates intermediate nodes."""
    keys = path.split('.')
    last = keys[-1]
    node = block['tree']
    for k in keys[:-1]:
        if isinstance(node.get(k), str):
            node[k] = {'_': node[k]}
        if k not in node:
            node[k] = {}
        node = node[k]
    if isinstance(node.get(last), dict):
        node[last]['_'] = content
    else:
        node[last] = content
    return {'success': True}


def find_unoccupied_digit(block, path=None):
    """Find next free digit (1-9) at a path."""
    node = block_navigate(block, path) if path else block.get('tree')
    if not node or isinstance(node, str):
        return {'digit': '1', 'note': 'Node is leaf — will become branch'}
    for d in range(1, 10):
        if str(d) not in node:
            return {'digit': str(d)}
    return {'full': True, 'note': 'Digits 1-9 all occupied — compression needed'}


# ============ CLI ============

def format_spindle(result):
    """Format a spindle result for terminal output."""
    lines = []
    for n in result['nodes']:
        ps = n.get('pscale')
        ps_str = str(ps) if ps is not None else '?'
        text = n['text']
        if len(text) > 200:
            text = text[:200] + '...'
        lines.append(f"  [{ps_str:>3}] {text}")
    return '\n'.join(lines)


def format_ring(result):
    """Format a ring result for terminal output."""
    lines = []
    if result.get('siblings'):
        for s in result['siblings']:
            marker = ' +' if s.get('branch') else ''
            text = s.get('text') or '(branch)'
            if len(text) > 120:
                text = text[:120] + '...'
            lines.append(f"  {s['digit']}: {text}{marker}")
    else:
        lines.append('  (no siblings)')
    return '\n'.join(lines)


def format_disc(result):
    """Format a disc result for terminal output."""
    lines = []
    for n in result.get('nodes', []):
        text = n.get('text') or '(no text)'
        if len(text) > 150:
            text = text[:150] + '...'
        lines.append(f"  [{n['path']}] {text}")
    if not result.get('nodes'):
        lines.append('  (no nodes at this pscale)')
    return '\n'.join(lines)


def format_dir_subtree(result):
    """Format a subtree dir result for terminal output."""
    return json.dumps(result.get('subtree'), indent=2, ensure_ascii=False)


def format_dir_full(result):
    """Format a full dir result — tree keys at depth 1."""
    tree = result.get('tree', {})
    lines = []
    root = tree.get('_', '')
    if root:
        lines.append(f"  _: {root[:200]}{'...' if len(root) > 200 else ''}")
    for k, v in tree.items():
        if k == '_':
            continue
        if isinstance(v, str):
            text = v
        elif isinstance(v, dict):
            text = v.get('_', '(branch)')
        else:
            text = str(v)
        if len(text) > 120:
            text = text[:120] + '...'
        lines.append(f"  {k}: {text}")
    return '\n'.join(lines)


def block_view(block, view):
    """Swap tree with skeleton or mask for BSP navigation."""
    if view == 'skeleton' and 'skeleton' in block:
        return {**block, 'tree': block['skeleton']}
    if view == 'mask' and 'mask' in block:
        return {**block, 'tree': block['mask']}
    return block


def main():
    if len(sys.argv) < 2:
        print("Usage: python lib/bsp.py <block> [skeleton|mask] [spindle|ref|_] [point|ring|dir] [disc]")
        print("       python lib/bsp.py wake                  # full tree (dir)")
        print("       python lib/bsp.py wake ref              # reference (zero tokens)")
        print("       python lib/bsp.py wake 0.12             # spindle")
        print("       python lib/bsp.py wake 0.12 -1          # point at pscale -1")
        print("       python lib/bsp.py wake 0.12 ring        # siblings at terminal")
        print("       python lib/bsp.py wake 0.12 dir         # subtree from endpoint")
        print("       python lib/bsp.py concerns _ 5 disc     # all nodes at pscale 5")
        print("       python lib/bsp.py horizon skeleton      # skeleton dir")
        print("       python lib/bsp.py horizon mask 0.11     # mask along spindle")
        sys.exit(1)

    # Find blocks directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)
    blocks_dir = os.path.join(repo_root, 'blocks')

    def loader(name):
        path = os.path.join(blocks_dir, f'{name}.json')
        if os.path.exists(path):
            with open(path, 'r') as f:
                return json.load(f)
        return None

    bsp_register(loader)

    block_name = sys.argv[1]
    view = None
    spindle = None
    point = None
    fn = None

    # Detect view selector (skeleton/mask) as second arg, shift remaining args
    args = sys.argv[2:]
    if args and args[0] in ('skeleton', 'mask'):
        view = args[0]
        args = args[1:]

    if len(args) > 0:
        arg2 = args[0]
        if arg2 == 'ref':
            spindle = 'ref'
        elif arg2 == '_':
            spindle = None  # explicit null spindle (e.g. for disc mode)
        elif arg2 in ('ring', 'dir'):
            # bsp(block, 'ring') or bsp(block, 'dir') — not valid, need spindle
            print(f"ERROR: '{arg2}' requires a spindle. Usage: bsp {block_name} <spindle> {arg2}")
            sys.exit(1)
        else:
            spindle = float(arg2)

    if len(args) > 1:
        arg3 = args[1]
        if arg3 in ('ring', 'dir'):
            point = arg3
        elif arg3 == 'disc':
            # bsp(block, spindle, 'disc') — disc needs a point
            print("ERROR: disc requires a pscale level. Usage: bsp <block> <spindle> <pscale> disc")
            sys.exit(1)
        else:
            try:
                point = int(arg3) if '.' not in arg3 else float(arg3)
            except ValueError:
                point = arg3

    if len(args) > 2:
        arg4 = args[2]
        if arg4 == 'disc':
            fn = 'disc'
        else:
            print(f"ERROR: Unknown argument '{arg4}'. Only 'disc' is valid.")
            sys.exit(1)

    # Apply view selector — swap tree before BSP sees it
    if view:
        raw = loader(block_name)
        if not raw:
            print(f"Block not found: {block_name}")
            sys.exit(1)
        viewed = block_view(raw, view)
        if viewed is raw and view in ('skeleton', 'mask'):
            print(f"No {view} on block '{block_name}'")
            sys.exit(1)
        result = bsp(viewed, spindle, point, fn)
    else:
        result = bsp(block_name, spindle, point, fn)
    mode = result.get('mode', '?')

    if mode == 'ref':
        print(f"[{block_name}] ref (zero tokens)")
    elif mode == 'dir':
        if 'subtree' in result:
            print(f"[{block_name} {spindle} dir] subtree @ {result.get('path')}")
            print(format_dir_subtree(result))
        else:
            print(f"[{block_name}] dir")
            print(format_dir_full(result))
    elif mode == 'spindle':
        print(f"[{block_name} {spindle}] spindle")
        print(format_spindle(result))
    elif mode == 'point':
        ps = result.get('pscale', '?')
        print(f"[{block_name} {spindle} {point}] point [{ps}]")
        print(f"  {result['text']}")
    elif mode == 'ring':
        print(f"[{block_name} {spindle} ring] siblings")
        print(format_ring(result))
    elif mode == 'disc':
        ps = result.get('pscale', '?')
        print(f"[{block_name} {spindle} {point} disc] pscale {ps}")
        print(format_disc(result))
    elif mode == 'error':
        print(f"ERROR: {result.get('error')}")
    else:
        print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
