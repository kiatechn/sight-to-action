"""The Explore tab does not use the same algorithm as the rest of the project.

Route ranking elsewhere uses Yen's k-shortest-paths, which is exact but too
slow to run for every sense/target pair. The explorer instead uses a
vectorised hop-limited Bellman-Ford relaxation. Those two must agree, or the
interactive numbers quietly disagree with the published ones.

That equivalence was originally checked by hand, once, in a terminal. These
tests make it run every time.
"""
import numpy as np
import pytest

from sight_to_action.analysis import build_type_graph, strongest_paths
from sight_to_action.explorer import _edge_arrays, _rebuild, hop_limited_paths
from sight_to_action.nulls import hop_limited_costs

from conftest import needs_data


def _dp_best(graph, source, target, max_hops):
    """Best route/score for one pair using the fast path."""
    nodes, index, u, v, cost = _edge_arrays(graph)
    dist, pred = hop_limited_paths(len(nodes), u, v, cost, index[source], max_hops)
    ti = index[target]
    if not np.isfinite(dist[ti]):
        return None, 0.0
    route = _rebuild(nodes, u, pred, ti, index[source], max_hops)
    return route, float(np.exp(-dist[ti]))


def test_fast_and_reference_agree_on_toy_graph(toy_connectivity):
    g = build_type_graph(toy_connectivity, min_weight=1)
    reference = strongest_paths(g, "SRC", "DST", k=1, max_hops=4)[0]
    route, score = _dp_best(g, "SRC", "DST", 4)
    assert route == reference.nodes
    assert score == pytest.approx(reference.score, rel=1e-9)


def test_fast_path_respects_the_hop_limit(toy_connectivity):
    g = build_type_graph(toy_connectivity, min_weight=1)
    route, score = _dp_best(g, "SRC", "DST", 2)  # every route needs 3
    assert route is None or len(route) - 1 <= 2
    assert score == 0.0 or route is not None


def test_fast_path_reports_nothing_when_unreachable(toy_connectivity):
    g = build_type_graph(toy_connectivity, min_weight=1)
    g.add_node("ISOLATED")
    route, score = _dp_best(g, "SRC", "ISOLATED", 5)
    assert route is None
    assert score == 0.0


def test_predecessor_chain_never_loops(toy_connectivity):
    """Costs are positive and distances strictly decrease on update, so
    following predecessors must terminate. A cycle here would hang the build."""
    g = build_type_graph(toy_connectivity, min_weight=1)
    nodes, index, u, v, cost = _edge_arrays(g)
    _, pred = hop_limited_paths(len(nodes), u, v, cost, index["SRC"], 5)
    for start in range(len(nodes)):
        seen, cur, steps = set(), start, 0
        while pred[cur] >= 0 and steps < 100:
            cur = int(u[pred[cur]])
            assert cur not in seen, "predecessor chain contains a cycle"
            seen.add(cur)
            steps += 1


def test_hop_limited_costs_matches_paths_variant(toy_connectivity):
    """nulls.py and explorer.py each implement the relaxation; they must not
    drift apart."""
    g = build_type_graph(toy_connectivity, min_weight=1)
    nodes, index, u, v, cost = _edge_arrays(g)
    a = hop_limited_costs(len(nodes), u, v, cost, index["SRC"], 4)
    b, _ = hop_limited_paths(len(nodes), u, v, cost, index["SRC"], 4)
    np.testing.assert_allclose(a, b)


@needs_data
@pytest.mark.parametrize(
    "source,target",
    [("R1-R6", "DNg13"), ("R1-R6", "DNp01"), ("R1-R6", "DNp11")],
)
def test_agreement_on_the_real_connectome(source, target):
    """The check that matters: same answer on the actual data."""
    from sight_to_action.data import load_weights

    g = build_type_graph(load_weights(), min_weight=20)
    reference = strongest_paths(g, source, target, k=1, max_hops=5)
    route, score = _dp_best(g, source, target, 5)
    assert reference, f"reference found no route {source} -> {target}"
    assert route == reference[0].nodes
    assert score == pytest.approx(reference[0].score, rel=1e-9)
