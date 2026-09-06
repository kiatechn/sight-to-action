"""The core claim of this project is that its route ranking means something.
These tests pin down what the ranking actually does."""
import math

import networkx as nx
import pytest

from sight_to_action.analysis import (
    bottleneck_nodes,
    build_type_graph,
    corridor_subgraph,
    removal_effect,
    strongest_paths,
)


def test_relative_weight_is_share_of_target_input(toy_connectivity):
    g = build_type_graph(toy_connectivity, min_weight=1)
    # C receives 300 from A and 50 from B, so A supplies 300/350 of its input
    assert g.edges["A", "C"]["relative_weight"] == pytest.approx(300 / 350)
    assert g.edges["B", "C"]["relative_weight"] == pytest.approx(50 / 350)


def test_relative_weights_into_a_node_sum_to_one(toy_connectivity):
    g = build_type_graph(toy_connectivity, min_weight=1)
    for node in g.nodes:
        incoming = [g.edges[u, node]["relative_weight"] for u in g.predecessors(node)]
        if incoming:
            assert sum(incoming) == pytest.approx(1.0)


def test_cost_is_negative_log_of_relative_weight(toy_connectivity):
    g = build_type_graph(toy_connectivity, min_weight=1)
    for _, _, d in g.edges(data=True):
        assert d["cost"] == pytest.approx(-math.log(d["relative_weight"]))


def test_min_weight_filter_drops_weak_edges(toy_connectivity):
    g = build_type_graph(toy_connectivity, min_weight=100)
    assert not g.has_edge("D", "DST")  # weight 5
    assert not g.has_edge("B", "C")  # weight 50
    assert g.has_edge("A", "C")  # weight 300


def test_strongest_path_is_the_strong_route(toy_connectivity):
    g = build_type_graph(toy_connectivity, min_weight=1)
    routes = strongest_paths(g, "SRC", "DST", k=5, max_hops=4)
    assert routes, "expected at least one route"
    assert routes[0].nodes == ["SRC", "A", "C", "DST"]


def test_routes_are_returned_in_descending_score_order(toy_connectivity):
    g = build_type_graph(toy_connectivity, min_weight=1)
    routes = strongest_paths(g, "SRC", "DST", k=5, max_hops=4)
    scores = [r.score for r in routes]
    assert scores == sorted(scores, reverse=True)


def test_score_is_the_product_of_relative_weights(toy_connectivity):
    g = build_type_graph(toy_connectivity, min_weight=1)
    best = strongest_paths(g, "SRC", "DST", k=1, max_hops=4)[0]
    expected = 1.0
    for a, b in zip(best.nodes, best.nodes[1:]):
        expected *= g.edges[a, b]["relative_weight"]
    assert best.score == pytest.approx(expected)


def test_hop_limit_is_respected(toy_connectivity):
    """Regression: the search once terminated on the first over-long candidate
    instead of skipping it, which silently returned no routes at all."""
    g = build_type_graph(toy_connectivity, min_weight=1)
    routes = strongest_paths(g, "SRC", "DST", k=10, max_hops=2)
    assert routes, "SRC->D->DST is a genuine 2-hop route and should be found"
    assert all(r.hops <= 2 for r in routes)
    # the 3-hop route through the hub must be excluded by the limit
    assert all("C" not in r.nodes for r in routes)


def test_paths_are_valid_edges_in_the_graph(toy_connectivity):
    g = build_type_graph(toy_connectivity, min_weight=1)
    for r in strongest_paths(g, "SRC", "DST", k=5, max_hops=4):
        for a, b in zip(r.nodes, r.nodes[1:]):
            assert g.has_edge(a, b)


def test_no_route_between_unconnected_types(toy_connectivity):
    g = build_type_graph(toy_connectivity, min_weight=1)
    g.add_node("ISOLATED")
    assert strongest_paths(g, "SRC", "ISOLATED", k=3, max_hops=5) == []


def test_bottleneck_counts_shared_intermediates(toy_connectivity):
    g = build_type_graph(toy_connectivity, min_weight=1)
    routes = strongest_paths(g, "SRC", "DST", k=5, max_hops=4)
    bn = bottleneck_nodes(routes)
    row = bn[bn["type"] == "C"].iloc[0]
    # C sits on both of the routes that pass through the hub
    assert row["n_routes"] == 2
    assert row["fraction_of_routes"] == pytest.approx(2 / len(routes))


def test_endpoints_are_not_counted_as_bottlenecks(toy_connectivity):
    g = build_type_graph(toy_connectivity, min_weight=1)
    routes = strongest_paths(g, "SRC", "DST", k=5, max_hops=4)
    assert "SRC" not in set(bottleneck_nodes(routes)["type"])
    assert "DST" not in set(bottleneck_nodes(routes)["type"])


def test_removing_the_bottleneck_forces_the_alternative(toy_connectivity):
    g = build_type_graph(toy_connectivity, min_weight=1)
    effect = removal_effect(g, "SRC", "DST", "C", max_hops=4)
    assert effect["best_before"] == ["SRC", "A", "C", "DST"]
    assert effect["best_after"] == ["SRC", "D", "DST"]
    assert effect["still_connected"] is True
    assert effect["score_after"] < effect["score_before"]


def test_removal_can_disconnect_entirely(toy_connectivity):
    g = build_type_graph(toy_connectivity, min_weight=1)
    # with D gone too, C is the only way through
    g.remove_node("D")
    effect = removal_effect(g, "SRC", "DST", "C", max_hops=4)
    assert effect["still_connected"] is False
    assert effect["best_after"] is None


def test_removal_does_not_mutate_the_original_graph(toy_connectivity):
    g = build_type_graph(toy_connectivity, min_weight=1)
    before = (g.number_of_nodes(), g.number_of_edges())
    removal_effect(g, "SRC", "DST", "C", max_hops=4)
    assert (g.number_of_nodes(), g.number_of_edges()) == before


def test_corridor_keeps_nodes_on_short_paths_and_drops_others(toy_connectivity):
    g = build_type_graph(toy_connectivity, min_weight=1)
    g.add_edge("FARAWAY", "SRC", weight=1, relative_weight=0.1, cost=2.3)
    sub = corridor_subgraph(g, "SRC", "DST", max_hops=3)
    assert {"SRC", "A", "C", "DST"} <= set(sub.nodes)
    assert "FARAWAY" not in sub.nodes


def test_graph_is_directed_and_not_symmetric(toy_connectivity):
    g = build_type_graph(toy_connectivity, min_weight=1)
    assert isinstance(g, nx.DiGraph)
    assert g.has_edge("A", "C")
    assert not g.has_edge("C", "A")


# --- null models ---------------------------------------------------------


def test_within_target_null_preserves_each_input_profile(toy_connectivity):
    """The conservative null must leave every node's set of incoming relative
    weights untouched, only reassigning which source supplies which."""
    import numpy as np

    from sight_to_action.nulls import _edge_arrays

    g = build_type_graph(toy_connectivity, min_weight=1)
    _, _, _, v, cost = _edge_arrays(g)

    rng = np.random.default_rng(0)
    order = np.argsort(v, kind="stable")
    boundaries = np.flatnonzero(np.diff(v[order])) + 1
    shuffled = cost.copy()
    for grp in [g_ for g_ in np.split(order, boundaries) if len(g_) > 1]:
        shuffled[grp] = rng.permutation(shuffled[grp])

    for node in np.unique(v):
        mask = v == node
        np.testing.assert_allclose(np.sort(cost[mask]), np.sort(shuffled[mask]))


def test_global_null_does_not_preserve_input_profiles(toy_connectivity):
    """The blunt null is expected to break that structure — which is exactly
    why it is the harsher of the two."""
    import numpy as np

    from sight_to_action.nulls import _edge_arrays

    g = build_type_graph(toy_connectivity, min_weight=1)
    _, _, _, v, cost = _edge_arrays(g)
    shuffled = np.random.default_rng(3).permutation(cost)
    differs = any(
        not np.allclose(np.sort(cost[v == n]), np.sort(shuffled[v == n]))
        for n in np.unique(v)
    )
    assert differs


def test_nulls_return_the_requested_number_of_samples(toy_connectivity):
    from sight_to_action.nulls import weight_shuffled_scores

    g = build_type_graph(toy_connectivity, min_weight=1)
    for within in (False, True):
        out = weight_shuffled_scores(
            g, "SRC", "DST", n_shuffles=25, max_hops=4, within_target=within
        )
        assert len(out) == 25
        assert (out >= 0).all()


def test_nulls_are_reproducible_for_a_given_seed(toy_connectivity):
    import numpy as np

    from sight_to_action.nulls import weight_shuffled_scores

    g = build_type_graph(toy_connectivity, min_weight=1)
    a = weight_shuffled_scores(g, "SRC", "DST", n_shuffles=10, seed=7, max_hops=4)
    b = weight_shuffled_scores(g, "SRC", "DST", n_shuffles=10, seed=7, max_hops=4)
    np.testing.assert_allclose(a, b)
