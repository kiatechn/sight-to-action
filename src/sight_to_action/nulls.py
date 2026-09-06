"""Statistical context for a pathway: is this route stronger than chance?

Existing connectome explorers will return a path between almost any two
neurons, because a dense recurrent network connects nearly everything to
nearly everything within a few hops. That makes "a path exists" close to
meaningless on its own. This module asks the harder question:

  Given the same graph, how does the observed route compare with routes
  between comparable pairs of neurons, and with routes through a graph
  whose connection strengths have been shuffled?

Three references are computed:

1. **Target rank** — best route score from the source to every descending
   neuron. Where does the real target rank among them?
2. **Source rank** — best route score to the target from every sensory
   type. Where does the real source rank?
3. **Shuffled-weight nulls** — keep the wiring exactly as it is but permute
   the relative weights, then recompute. Two versions are run: a global
   permutation, and a conservative one that permutes only within each
   target's incoming edges, so every node keeps its own input profile and
   only the choice of partner is randomised.

All of it remains structural. None of it says anything about activity.
"""
from dataclasses import dataclass

import networkx as nx
import numpy as np


@dataclass
class NullResult:
    observed_score: float
    target_rank: int | None
    target_pool: int
    target_percentile: float | None
    source_rank: int | None
    source_pool: int
    source_percentile: float | None
    shuffled_mean: float
    shuffled_p95: float
    shuffled_better_fraction: float
    n_shuffles: int
    # the conservative null: each node keeps its own input profile
    within_mean: float = 0.0
    within_p95: float = 0.0
    within_better_fraction: float = 0.0

    def to_dict(self) -> dict:
        return {
            "observed_score": self.observed_score,
            "target_rank": self.target_rank,
            "target_pool": self.target_pool,
            "target_percentile": self.target_percentile,
            "source_rank": self.source_rank,
            "source_pool": self.source_pool,
            "source_percentile": self.source_percentile,
            "shuffled_mean": self.shuffled_mean,
            "shuffled_p95": self.shuffled_p95,
            "shuffled_better_fraction": self.shuffled_better_fraction,
            "n_shuffles": self.n_shuffles,
            "within_mean": self.within_mean,
            "within_p95": self.within_p95,
            "within_better_fraction": self.within_better_fraction,
        }


def _edge_arrays(graph: nx.DiGraph):
    nodes = list(graph.nodes())
    index = {n: i for i, n in enumerate(nodes)}
    u = np.empty(graph.number_of_edges(), dtype=np.int32)
    v = np.empty(graph.number_of_edges(), dtype=np.int32)
    cost = np.empty(graph.number_of_edges(), dtype=np.float64)
    for i, (a, b, d) in enumerate(graph.edges(data=True)):
        u[i] = index[a]
        v[i] = index[b]
        cost[i] = d["cost"]
    return nodes, index, u, v, cost


def hop_limited_costs(
    n_nodes: int,
    u: np.ndarray,
    v: np.ndarray,
    cost: np.ndarray,
    source_idx: int,
    max_hops: int,
) -> np.ndarray:
    """Best path cost from `source_idx` to every node using <= max_hops edges.

    A Bellman-Ford style relaxation, one round per hop, which gives the whole
    distance vector in a handful of vectorised passes rather than running a
    separate k-shortest-paths search per candidate target.
    """
    dist = np.full(n_nodes, np.inf)
    dist[source_idx] = 0.0
    for _ in range(max_hops):
        candidate = dist[u] + cost
        new = dist.copy()
        np.minimum.at(new, v, candidate)
        if np.array_equal(new, dist):
            break
        dist = new
    return dist


def best_scores_from(
    graph: nx.DiGraph, source: str, max_hops: int = 5
) -> dict[str, float]:
    """score = product of relative weights along the best <= max_hops route."""
    nodes, index, u, v, cost = _edge_arrays(graph)
    dist = hop_limited_costs(len(nodes), u, v, cost, index[source], max_hops)
    return {n: float(np.exp(-dist[i])) for i, n in enumerate(nodes)}


def best_scores_to(
    graph: nx.DiGraph, target: str, max_hops: int = 5
) -> dict[str, float]:
    return best_scores_from(graph.reverse(copy=True), target, max_hops=max_hops)


def _rank_of(scores: dict[str, float], pool: list[str], item: str):
    values = [(t, scores.get(t, 0.0)) for t in pool]
    values = [(t, s) for t, s in values if s > 0]
    if not values or item not in dict(values):
        return None, len(values), None
    ordered = sorted(values, key=lambda kv: kv[1], reverse=True)
    rank = next(i for i, (t, _) in enumerate(ordered, 1) if t == item)
    percentile = 100.0 * (1 - (rank - 1) / len(ordered))
    return rank, len(ordered), percentile


def weight_shuffled_scores(
    graph: nx.DiGraph,
    source: str,
    target: str,
    n_shuffles: int = 500,
    max_hops: int = 5,
    seed: int = 0,
    within_target: bool = False,
) -> np.ndarray:
    """Best source->target score under a randomised null.

    Two nulls are available and they ask different questions.

    ``within_target=False`` permutes edge costs across the whole graph. It is
    a blunt instrument: it destroys the relationship between how strong a
    connection is and where it sits, so heavy weights can land on edges near
    the target that never carry them in reality. Deliberately harsh.

    ``within_target=True`` permutes costs only among the incoming edges of
    each target node. Every node therefore keeps its own input profile
    exactly — the same multiset of relative weights, still summing to one —
    and only *which source supplies which share* is randomised. This is the
    more conservative and more informative comparison, because it holds the
    network's weight structure fixed and tests the specific assignment of
    partners.
    """
    nodes, index, u, v, cost = _edge_arrays(graph)
    rng = np.random.default_rng(seed)
    si, ti = index[source], index[target]

    # incoming-edge groups, computed once rather than per shuffle
    groups: list[np.ndarray] = []
    if within_target:
        order = np.argsort(v, kind="stable")
        boundaries = np.flatnonzero(np.diff(v[order])) + 1
        groups = [g for g in np.split(order, boundaries) if len(g) > 1]

    out = np.empty(n_shuffles)
    for i in range(n_shuffles):
        if within_target:
            shuffled = cost.copy()
            for g in groups:
                shuffled[g] = rng.permutation(shuffled[g])
        else:
            shuffled = rng.permutation(cost)
        dist = hop_limited_costs(len(nodes), u, v, shuffled, si, max_hops)
        out[i] = float(np.exp(-dist[ti]))
    return out


def evaluate(
    graph: nx.DiGraph,
    annotations,
    source: str,
    target: str,
    max_hops: int = 5,
    n_shuffles: int = 500,
    seed: int = 0,
) -> NullResult:
    traced = annotations[annotations["status"] == "Traced"]

    descending = sorted(
        traced[traced["superclass"] == "descending_neuron"]["type"].dropna().unique()
    )
    sensory = sorted(
        traced[traced["superclass"].isin(["ol_sensory", "cb_sensory", "vnc_sensory"])][
            "type"
        ]
        .dropna()
        .unique()
    )

    forward = best_scores_from(graph, source, max_hops=max_hops)
    backward = best_scores_to(graph, target, max_hops=max_hops)
    observed = forward.get(target, 0.0)

    t_rank, t_pool, t_pct = _rank_of(forward, descending, target)
    s_rank, s_pool, s_pct = _rank_of(backward, sensory, source)

    shuffled = weight_shuffled_scores(
        graph, source, target, n_shuffles=n_shuffles, max_hops=max_hops, seed=seed
    )
    within = weight_shuffled_scores(
        graph, source, target, n_shuffles=n_shuffles, max_hops=max_hops,
        seed=seed + 1, within_target=True,
    )

    return NullResult(
        observed_score=observed,
        target_rank=t_rank,
        target_pool=t_pool,
        target_percentile=t_pct,
        source_rank=s_rank,
        source_pool=s_pool,
        source_percentile=s_pct,
        shuffled_mean=float(shuffled.mean()),
        shuffled_p95=float(np.percentile(shuffled, 95)),
        shuffled_better_fraction=float((shuffled >= observed).mean()),
        n_shuffles=n_shuffles,
        within_mean=float(within.mean()),
        within_p95=float(np.percentile(within, 95)),
        within_better_fraction=float((within >= observed).mean()),
    )
