"""Precompute an interactive "any sense -> any movement neuron" explorer.

The point of the Context analysis is that a path existing between two neurons
means very little on its own. That argument is only convincing if you can
test it yourself, so this precomputes the *same* calculation for many
source/target pairs and ships the answers to the browser. No approximation is
involved: the routes and scores here are produced by the identical
hop-limited, relative-weight method used everywhere else in the project.
"""
import json
from pathlib import Path

import networkx as nx
import numpy as np
import pandas as pd

PROCESSED_DIR = Path(__file__).resolve().parents[2] / "data" / "processed"


def _edge_arrays(graph: nx.DiGraph):
    nodes = list(graph.nodes())
    index = {n: i for i, n in enumerate(nodes)}
    m = graph.number_of_edges()
    u = np.empty(m, dtype=np.int64)
    v = np.empty(m, dtype=np.int64)
    cost = np.empty(m, dtype=np.float64)
    for i, (a, b, d) in enumerate(graph.edges(data=True)):
        u[i] = index[a]
        v[i] = index[b]
        cost[i] = d["cost"]
    return nodes, index, u, v, cost


def hop_limited_paths(
    n_nodes: int,
    u: np.ndarray,
    v: np.ndarray,
    cost: np.ndarray,
    source_idx: int,
    max_hops: int,
):
    """Best <=max_hops cost to every node, with predecessors for path rebuild.

    Vectorised Bellman-Ford: one relaxation round per hop. Predecessors are
    recovered with a second scatter that records which edge achieved each
    node's new minimum. Because costs are positive and a node's distance
    strictly decreases when its predecessor is rewritten, following the
    predecessor chain cannot loop.
    """
    dist = np.full(n_nodes, np.inf)
    dist[source_idx] = 0.0
    pred_edge = np.full(n_nodes, -1, dtype=np.int64)
    edge_ids = np.arange(len(u))

    for _ in range(max_hops):
        candidate = dist[u] + cost
        new_dist = dist.copy()
        np.minimum.at(new_dist, v, candidate)
        improved = candidate <= new_dist[v] + 1e-15
        improved &= new_dist[v] < dist[v] - 1e-15
        if not improved.any():
            break
        np.maximum.at(pred_edge, v[improved], edge_ids[improved])
        dist = new_dist
    return dist, pred_edge


def _rebuild(nodes, u, pred_edge, target_idx, source_idx, max_hops):
    path = [target_idx]
    cur = target_idx
    for _ in range(max_hops + 1):
        if cur == source_idx:
            break
        e = pred_edge[cur]
        if e < 0:
            return None
        cur = int(u[e])
        path.append(cur)
    else:
        return None
    if cur != source_idx:
        return None
    return [nodes[i] for i in reversed(path)]


def choose_sources(annotations: pd.DataFrame, per_class: int = 3) -> list[str]:
    """A representative spread of sensory cell types across modalities."""
    traced = annotations[annotations["status"] == "Traced"]
    sensory = traced[
        traced["superclass"].isin(["ol_sensory", "cb_sensory", "vnc_sensory"])
    ]
    picked: list[str] = []
    for _, group in sensory.groupby("class", observed=True):
        counts = group["type"].value_counts()
        picked.extend(counts.head(per_class).index.tolist())
    # always include the photoreceptors this project is built around
    for must in ["R1-R6", "R7y", "R8y"]:
        if must not in picked and must in set(sensory["type"]):
            picked.append(must)
    return sorted(set(picked))


def build_explorer(
    graph: nx.DiGraph,
    annotations: pd.DataFrame,
    max_hops: int = 5,
    per_class: int = 3,
) -> dict:
    traced = annotations[annotations["status"] == "Traced"]
    dn_types = sorted(
        traced[traced["superclass"] == "descending_neuron"]["type"].dropna().unique()
    )
    sources = choose_sources(annotations, per_class=per_class)

    modality = {}
    for t in sources:
        rows = traced[traced["type"] == t]
        cls = rows["class"].dropna()
        modality[t] = str(cls.iloc[0]) if len(cls) else "unclassified"

    nodes, index, u, v, cost = _edge_arrays(graph)
    dn_idx = [(t, index[t]) for t in dn_types if t in index]

    results: dict[str, dict] = {}
    for src in sources:
        if src not in index:
            continue
        si = index[src]
        dist, pred_edge = hop_limited_paths(len(nodes), u, v, cost, si, max_hops)
        per_target = {}
        for name, ti in dn_idx:
            if not np.isfinite(dist[ti]):
                continue
            route = _rebuild(nodes, u, pred_edge, ti, si, max_hops)
            if not route:
                continue
            per_target[name] = {
                "score": float(np.exp(-dist[ti])),
                "route": route,
            }
        results[src] = per_target

    return {
        "meta": {
            "max_hops": max_hops,
            "method": (
                "Identical to the main analysis: routes are ranked by the product of "
                "relative synaptic weights (each edge weighted by the fraction of the "
                "target's total input it supplies), limited to at most "
                f"{max_hops} hops. Structural wiring only — not activity or behaviour."
            ),
        },
        "modality": modality,
        "sources": sources,
        "targets": dn_types,
        "results": results,
    }


def write_explorer(payload: dict, name: str = "explorer") -> Path:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    path = PROCESSED_DIR / f"{name}.json"
    path.write_text(json.dumps(payload))
    return path
