"""Build a type-level pathway graph from a set of ordered cell-type tiers.

A "tier" is a list of `type` values (e.g. visual motion detectors, then
visual projection neurons, then a descending neuron, then motor neurons).
Edges are kept only when they run from an earlier tier's type to a later
(or the same) tier's type, which is what turns the full connectome into a
single readable feed-forward story instead of a tangle of local recurrence.
"""
from dataclasses import dataclass

import networkx as nx
import pandas as pd


@dataclass
class PathwayResult:
    graph: nx.DiGraph
    node_table: pd.DataFrame
    edge_table: pd.DataFrame


def top_upstream_types(
    weights: pd.DataFrame, target_types: list[str], n: int = 10
) -> pd.DataFrame:
    """Rank the types that most strongly feed into `target_types`, by total weight."""
    inbound = weights[weights["type_post"].isin(target_types)]
    ranked = (
        inbound.groupby("type_pre")
        .agg(total_weight=("weight", "sum"), n_edges=("weight", "size"))
        .sort_values("total_weight", ascending=False)
    )
    return ranked.head(n)


def build_pathway_graph(
    weights: pd.DataFrame,
    annotations: pd.DataFrame,
    neurotransmitters: pd.DataFrame,
    tiers: list[list[str]],
    min_weight: int = 3,
    input_weights: dict[str, int] | None = None,
) -> PathwayResult:
    """`input_weights` (optional) records, for tier-0 types only, how strongly
    each one feeds the next tier (used client-side to power an adjustable
    "minimum synapse weight" threshold, so the visual-input tier isn't a
    silently hard-coded choice)."""
    all_types = [t for tier in tiers for t in tier]
    tier_index = {t: i for i, tier in enumerate(tiers) for t in tier}

    edges = weights[
        weights["type_pre"].isin(all_types)
        & weights["type_post"].isin(all_types)
        & (weights["weight"] >= min_weight)
    ].copy()
    edges = edges[
        edges["type_pre"].map(tier_index) <= edges["type_post"].map(tier_index)
    ]

    type_edges = (
        edges.groupby(["type_pre", "type_post"])
        .agg(weight=("weight", "sum"), n_synapse_connections=("weight", "size"))
        .reset_index()
        .sort_values("weight", ascending=False)
    )

    nt_by_type = (
        neurotransmitters[neurotransmitters["cell_type"].isin(all_types)]
        .drop_duplicates("cell_type")
        .set_index("cell_type")["celltype_predicted_nt"]
    )

    counts_by_type = annotations[annotations["type"].isin(all_types)][
        "type"
    ].value_counts()

    node_rows = []
    for tier_i, tier in enumerate(tiers):
        for t in tier:
            sample = annotations[annotations["type"] == t]
            node_rows.append(
                {
                    "type": t,
                    "tier": tier_i,
                    "superclass": sample["superclass"].mode().iat[0]
                    if len(sample) and sample["superclass"].notna().any()
                    else None,
                    "n_bodies": int(counts_by_type.get(t, 0)),
                    "predicted_neurotransmitter": nt_by_type.get(t),
                    "input_weight": int(input_weights[t]) if input_weights and t in input_weights else None,
                }
            )
    node_table = pd.DataFrame(node_rows)

    g = nx.DiGraph()
    for _, row in node_table.iterrows():
        g.add_node(row["type"], **row.drop("type").to_dict())
    for _, row in type_edges.iterrows():
        g.add_edge(
            row["type_pre"],
            row["type_post"],
            weight=int(row["weight"]),
            n_synapse_connections=int(row["n_synapse_connections"]),
        )

    return PathwayResult(graph=g, node_table=node_table, edge_table=type_edges)
