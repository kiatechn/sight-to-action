"""Download and simplify real neuron skeletons (SWC) for the 3D viewer.

Skeletons come from the public MaleCNS bucket:
  gs://flyem-male-cns/v1.0/segmentation/skeletons-malecns/skeletons-swc/<bodyId>.swc

These are the actual EM-traced arbors of individual neurons, so the shapes
shown in the 3D view are real morphology, not stylised placeholders. They are
decimated for the browser (branch points, leaves and the root are always kept,
so overall shape and topology survive).
"""
import json
from pathlib import Path

import numpy as np
import requests

PROCESSED_DIR = Path(__file__).resolve().parents[2] / "data" / "processed"
CACHE_DIR = Path(__file__).resolve().parents[2] / "data" / "raw" / "skeletons"
SWC_URL = (
    "https://storage.googleapis.com/flyem-male-cns/v1.0/segmentation/"
    "skeletons-malecns/skeletons-swc/{body_id}.swc"
)


def fetch_swc(body_id: int, timeout: int = 60) -> str | None:
    """Fetch one SWC file, caching it on disk so re-runs are offline-cheap."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached = CACHE_DIR / f"{body_id}.swc"
    if cached.exists():
        return cached.read_text()
    resp = requests.get(SWC_URL.format(body_id=body_id), timeout=timeout)
    if resp.status_code != 200:
        return None
    cached.write_text(resp.text)
    return resp.text


def parse_swc(text: str) -> tuple[dict[int, np.ndarray], dict[int, int]]:
    """Return {node_id: xyz} and {node_id: parent_id} (parent -1 = root)."""
    pos: dict[int, np.ndarray] = {}
    parent: dict[int, int] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) < 7:
            continue
        nid = int(parts[0])
        pos[nid] = np.array([float(parts[2]), float(parts[3]), float(parts[4])])
        parent[nid] = int(parts[6])
    return pos, parent


def simplify(
    pos: dict[int, np.ndarray], parent: dict[int, int], keep_every: int = 10
) -> list[tuple[np.ndarray, np.ndarray]]:
    """Decimate to line segments, preserving roots, branch points and leaves."""
    child_count: dict[int, int] = {nid: 0 for nid in pos}
    for nid, p in parent.items():
        if p in child_count:
            child_count[p] += 1

    keep = set()
    for i, nid in enumerate(sorted(pos)):
        p = parent.get(nid, -1)
        is_root = p not in pos
        is_branch = child_count.get(nid, 0) > 1
        is_leaf = child_count.get(nid, 0) == 0
        if is_root or is_branch or is_leaf or i % keep_every == 0:
            keep.add(nid)

    segments: list[tuple[np.ndarray, np.ndarray]] = []
    for nid in keep:
        # walk up to the nearest kept ancestor and emit one straight segment
        p = parent.get(nid, -1)
        steps = 0
        while p in pos and p not in keep and steps < 10000:
            p = parent.get(p, -1)
            steps += 1
        if p in pos:
            segments.append((pos[nid], pos[p]))
    return segments


def build_skeleton_payload(
    type_to_bodies: dict[str, list[int]],
    center: np.ndarray,
    scale: float,
    max_per_type: int = 2,
    keep_every: int = 10,
) -> dict:
    """Fetch, simplify and normalise skeletons for each cell type.

    `center`/`scale` must match the normalisation used for the soma point
    cloud so skeletons and cloud share one coordinate frame.
    """
    out: dict[str, list] = {}
    for cell_type, bodies in type_to_bodies.items():
        entries = []
        for body_id in bodies[:max_per_type]:
            text = fetch_swc(body_id)
            if not text:
                continue
            pos, parent = parse_swc(text)
            if not pos:
                continue
            segs = simplify(pos, parent, keep_every=keep_every)
            if not segs:
                continue
            flat: list[float] = []
            for a, b in segs:
                na = (a - center) / scale
                nb = (b - center) / scale
                flat.extend([round(float(v), 4) for v in (*na, *nb)])
            entries.append({"bodyId": body_id, "segments": flat})
        if entries:
            out[cell_type] = entries
    return out


def write_skeletons(payload: dict, name: str = "skeletons") -> Path:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    path = PROCESSED_DIR / f"{name}.json"
    path.write_text(json.dumps(payload))
    return path
