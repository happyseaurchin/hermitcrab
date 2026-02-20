# bsp.py — Block · Spindle · Point
# Semantic address resolver for pscale JSON blocks.
# Not code. Coordinates.

from typing import Any, Optional, Union
from dataclasses import dataclass, field

# --- Block loader registry ---
_block_loader = None


def bsp_register(loader):
    """Register a block loader so bsp can resolve block names."""
    global _block_loader
    _block_loader = loader


# --- Types ---

@dataclass
class SpindleNode:
    pscale: int      # depth below decimal: -1, -2, -3...
    digit: str       # the key at this level
    text: str        # content at this level (_ summary or leaf string)


@dataclass
class BspResult:
    mode: str                           # 'block' | 'spindle' | 'point'
    tree: Optional[dict] = None         # full tree (block mode)
    nodes: list = field(default_factory=list)  # spindle chain (spindle mode)
    text: Optional[str] = None          # focused content (point mode)


def bsp(
    block: Union[str, dict],
    spindle: Optional[float] = None,
    point: Optional[int] = None,
) -> BspResult:
    """
    bsp — Block · Spindle · Point

    bsp("wake")              → the full block tree
    bsp("wake", 0.842)       → spindle: nodes at 0.8, 0.84, 0.842
    bsp("wake", 0.842, 2)    → point: just the content at the final digit (2)

    block   - block name (string) resolved via registered loader, or a dict
    spindle - semantic number: each digit after the decimal is a tree key
    point   - focus digit within the spindle. Returns only that node's content.
    """
    # Resolve block name to object
    if isinstance(block, str):
        if _block_loader is None:
            return BspResult(mode="block", tree={})
        blk = _block_loader(block)
        if blk is None:
            return BspResult(mode="block", tree={})
    else:
        blk = block

    tree = blk.get("tree", blk)

    # Block mode — no spindle, return full tree
    if spindle is None:
        return BspResult(mode="block", tree=tree)

    # Parse semantic number into digit sequence
    s = f"{spindle:.10f}"
    dot = s.index(".")
    digits = s[dot + 1:].rstrip("0")

    # Walk the tree, building the spindle chain
    nodes = []
    node = tree

    for i, d in enumerate(digits):
        if not isinstance(node, dict) or d not in node:
            break
        node = node[d]
        if isinstance(node, str):
            text = node
        elif isinstance(node, dict) and "_" in node:
            text = node["_"]
        else:
            text = str(node)
        nodes.append(SpindleNode(pscale=-(i + 1), digit=d, text=text))

    if not nodes:
        return BspResult(mode="spindle", nodes=[])

    # Point mode — return just the focused node
    if point is not None:
        target = next((n for n in nodes if n.digit == str(point)), None)
        if target:
            return BspResult(mode="point", text=target.text)
        # Default: last node
        return BspResult(mode="point", text=nodes[-1].text)

    # Spindle mode — return the full chain
    return BspResult(mode="spindle", nodes=nodes)
