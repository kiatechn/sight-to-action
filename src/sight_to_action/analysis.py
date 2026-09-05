"""Reproducible graph analysis of a sensory -> motor pathway.

Method notes (objective 4 of the project scope):

* The connectome is collapsed to a *type-level* directed graph: every
  body->body connection is summed into a single type->type edge weight
  (total synapse count between the two cell types).
* Raw synapse counts are misleading on their own, because a cell type with
  many synapses looks "strong" everywhere. So each edge is also given a
  **relative weight**: the fraction of the *target* type's total input that
  comes from this source. This is the standard way to ask "how much of what
  B hears is coming from A?".
* "Strongest path" therefore means the path maximising the product of those
  relative weights, which is found as a shortest path under the additive
  cost -log(relative weight). This is a structural statement about wiring,
  never a claim about activity or behaviour.
"""
from dataclasses import dataclass, field
from math import log

import networkx as nx
import pandas as pd


@dataclass
class PathResult:
    nodes: list[str]
    hops: int
    total_synapses: int
    min_relative_weight: float
    score: float  # product of relative weights along the path
    edges: list[dict] = field(default_factory=list)


def build_type_graph(weights: pd.DataFrame, min_weight: int = 20) -> nx.DiGraph:
    """Collapse body-level connectivity to a weighted type-level digraph."""
    w = weights.dropna(subset=["type_pre", "type_post"])
    tw = (
        w.groupby(["type_pre", "type_post"], observed=True)["weight"]
        .sum()
        .reset_index()
    )
    tw = tw[tw["weight"] >= min_weight]

    total_in = tw.groupby("type_post", observed=True)["weight"].sum()

    g = nx.DiGraph()
    for row in tw.itertuples(index=False):
        rel = float(row.weight) / float(total_in[row.type_post])
        g.add_edge(
            row.type_pre,
            row.type_post,
            weight=int(row.weight),
            relative_weight=rel,
            cost=-log(max(rel, 1e-12)),
        )
    return g


def corridor_subgraph(
    g: nx.DiGraph, source: str, target: str, max_hops: int
) -> nx.DiGraph:
    """Keep only types that can lie on a <=max_hops path source -> target.

    Without this, k-shortest-path search over the whole 11k-node graph is
    needlessly slow; the corridor is exact for the hop limit we search.
    """
    fwd = nx.single_source_shortest_path_length(g, source, cutoff=max_hops)
    rev = nx.single_source_shortest_path_length(g.reverse(copy=False), target, cutoff=max_hops)
    keep = {n for n in fwd if n in rev and fwd[n] + rev[n] <= max_hops}
    keep |= {source, target}
    return g.subgraph(keep).copy()


def _describe(g: nx.DiGraph, path: list[str]) -> PathResult:
    edges, score, min_rel, total = [], 1.0, 1.0, 0
    for a, b in zip(path, path[1:]):
        d = g.edges[a, b]
        edges.append(
            {
                "source": a,
                "target": b,
                "weight": d["weight"],
                "relative_weight": round(d["relative_weight"], 5),
            }
        )
        score *= d["relative_weight"]
        min_rel = min(min_rel, d["relative_weight"])
        total += d["weight"]
    return PathResult(
        nodes=path,
        hops=len(path) - 1,
        total_synapses=total,
        min_relative_weight=round(min_rel, 5),
        score=score,
        edges=edges,
    )


def strongest_paths(
    g: nx.DiGraph,
    source: str,
    target: str,
    k: int = 10,
    max_hops: int = 5,
    max_candidates: int = 4000,
) -> list[PathResult]:
    """Top-k paths ranked by product of relative synaptic weights."""
    sub = corridor_subgraph(g, source, target, max_hops)
    if source not in sub or target not in sub:
        return []
    # shortest_simple_paths yields by increasing *cost*, not by hop count, so
    # longer-than-allowed candidates are skipped rather than terminating the
    # search; `examined` bounds the work for graphs with many near-ties.
    out: list[PathResult] = []
    examined = 0
    for path in nx.shortest_simple_paths(sub, source, target, weight="cost"):
        examined += 1
        if len(path) - 1 <= max_hops:
            out.append(_describe(g, path))
            if len(out) >= k:
                break
        if examined >= max_candidates:
            break
    return out


def bottleneck_nodes(paths: list[PathResult]) -> pd.DataFrame:
    """How often each intermediate type appears across the top routes.

    A type present in every alternative route is a structural bottleneck:
    remove it and those routes disappear. This is a statement about graph
    connectivity only.
    """
    counts: dict[str, int] = {}
    for p in paths:
        for n in p.nodes[1:-1]:
            counts[n] = counts.get(n, 0) + 1
    df = pd.DataFrame(
        [{"type": t, "n_routes": c, "fraction_of_routes": c / max(len(paths), 1)} for t, c in counts.items()]
    )
    return df.sort_values("n_routes", ascending=False).reset_index(drop=True)


def removal_effect(
    g: nx.DiGraph, source: str, target: str, remove: str, max_hops: int = 5
) -> dict:
    """Structural effect of deleting one type from the graph.

    This re-runs the same path search with the node removed. It shows how
    the available *wiring routes* change -- it is NOT a prediction of
    neural activity or behaviour.
    """
    before = strongest_paths(g, source, target, k=1, max_hops=max_hops)
    h = g.copy()
    if remove in h:
        h.remove_node(remove)
    after = strongest_paths(h, source, target, k=1, max_hops=max_hops)
    return {
        "removed": remove,
        "best_before": before[0].nodes if before else None,
        "best_after": after[0].nodes if after else None,
        "score_before": before[0].score if before else 0.0,
        "score_after": after[0].score if after else 0.0,
        "still_connected": bool(after),
        "hops_before": before[0].hops if before else None,
        "hops_after": after[0].hops if after else None,
    }
