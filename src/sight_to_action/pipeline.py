"""Build the complete R1-R6 -> DNg13 pathway dataset for the web app.

Produces one JSON containing: the pathway's cell types with annotations and
evidence labels, the ranked alternative routes, bottleneck analysis,
per-node structural removal effects, and male/female mapping status.
"""
import json
from pathlib import Path

import networkx as nx
import pandas as pd

from .analysis import PathResult, bottleneck_nodes, removal_effect, strongest_paths

PROCESSED_DIR = Path(__file__).resolve().parents[2] / "data" / "processed"

SOURCE_TYPE = "R1-R6"
TARGET_TYPE = "DNg13"

# Anatomical stage names for each hop-distance from the photoreceptors.
# The stage *index* of every type is derived from the data (its shortest
# hop distance from R1-R6 along the selected routes); only the human-readable
# name of each stage is curated here.
STAGE_NAMES = {
    0: "Photoreceptor (retina)",
    1: "Lamina monopolar",
    2: "Medulla interneuron",
    3: "Lobula projection",
    4: "Central brain",
    5: "Descending neuron",
}

# Cell types whose function in this pathway has direct experimental support
# in the published literature (used for the evidence taxonomy below).
EXPERIMENTALLY_SUPPORTED = {
    "R1-R6": "Classic electrophysiology and behaviour: R1-R6 are the motion/luminance photoreceptors feeding the lamina.",
    "L1": "L1 and L2 are the experimentally established ON/OFF motion-pathway channels leaving the lamina.",
    "L2": "L1 and L2 are the experimentally established ON/OFF motion-pathway channels leaving the lamina.",
    "L3": "L3 is an experimentally characterised luminance/contrast channel out of the lamina.",
    "Mi1": "Mi1 is a well-characterised ON-pathway medulla interneuron (T4 input element).",
    "Tm3": "Tm3 is a well-characterised ON-pathway medulla interneuron.",
    "LC10a": "LC10a is experimentally linked to visual object tracking and is required for male visual courtship pursuit.",
    "DNg13": (
        "DNg13 is a steering descending neuron: it is reported to receive input from "
        "visual pathways, and unilateral activation versus inhibition drives ipsilateral "
        "versus contralateral turning in walking flies. That published result is what "
        "makes it a meaningful endpoint here — the structural route found in this "
        "connectome ends on a neuron independently shown to be visually driven and to "
        "steer locomotion."
    ),
}


def _stage_assignment(routes: list[PathResult]) -> dict[str, int]:
    """Stage = shortest hop distance from the photoreceptors across routes.

    The target neuron is forced onto its own final stage so the last step of
    the story is always the descending neuron.
    """
    stage: dict[str, int] = {}
    for r in routes:
        for i, n in enumerate(r.nodes):
            stage[n] = min(stage.get(n, 99), i)
    if TARGET_TYPE in stage:
        stage[TARGET_TYPE] = max(stage.values()) + 1 if len(stage) > 1 else 1
    return stage


def _evidence(row: pd.Series, node_type: str) -> dict:
    """Four-level evidence taxonomy required by the project scope.

    directly-mapped        -> read straight out of the EM reconstruction
    experimentally-supported -> published physiology/behaviour for this cell type
    computationally-inferred -> model output (e.g. neurotransmitter prediction)
    unknown                -> the dataset does not answer it
    """
    if node_type in EXPERIMENTALLY_SUPPORTED:
        return {
            "level": "experimentally-supported",
            "note": EXPERIMENTALLY_SUPPORTED[node_type],
        }
    return {
        "level": "computationally-inferred",
        "note": (
            "This type's connectivity is directly mapped from the EM volume, but its "
            "role in this pathway is inferred from wiring alone — no targeted "
            "physiology for this cell type is asserted here."
        ),
    }


def _sex_status(row: pd.Series) -> dict:
    dim = row.get("dimorphism")
    flywire = row.get("flywireType")
    hemibrain = row.get("hemibrainType")
    if isinstance(dim, str) and dim:
        if "male-specific" in dim:
            category = "male-specific" if dim == "male-specific" else "potentially male-specific"
            detail = (
                "Annotated as "
                f"'{dim}' in MaleCNS: no corresponding cell is identified in the female "
                "connectomes, so routes through it may have no female counterpart."
            )
        else:
            category = "sexually dimorphic"
            detail = (
                f"Annotated as '{dim}': a matching cell exists in the female connectome "
                "but its morphology and/or connectivity differ between sexes."
            )
    elif isinstance(flywire, str) and flywire:
        category = "shared"
        detail = (
            f"Matched to '{flywire}' in the female FlyWire/FAFB connectome"
            + (f" and '{hemibrain}' in the female hemibrain." if isinstance(hemibrain, str) and hemibrain else ".")
        )
    else:
        category = "unknown"
        detail = "No reliable cross-connectome mapping is recorded for this type in the dataset."
    return {"category": category, "detail": detail, "flywireType": flywire if isinstance(flywire, str) else None,
            "hemibrainType": hemibrain if isinstance(hemibrain, str) else None,
            "dimorphism": dim if isinstance(dim, str) else None}


def build_pathway_dataset(
    graph: nx.DiGraph,
    annotations: pd.DataFrame,
    neurotransmitters: pd.DataFrame,
    n_routes: int = 12,
    max_hops: int = 5,
) -> dict:
    routes = strongest_paths(graph, SOURCE_TYPE, TARGET_TYPE, k=n_routes, max_hops=max_hops)
    if not routes:
        raise RuntimeError("no routes found between source and target")

    stage = _stage_assignment(routes)
    types = list(stage.keys())

    traced = annotations[annotations["status"] == "Traced"]
    nt_by_type = (
        neurotransmitters[neurotransmitters["cell_type"].isin(types)]
        .drop_duplicates("cell_type")
        .set_index("cell_type")
    )

    nodes = []
    for t in types:
        sub = traced[traced["type"] == t]
        row = sub.iloc[0] if len(sub) else pd.Series(dtype=object)
        nt_row = nt_by_type.loc[t] if t in nt_by_type.index else None
        nodes.append(
            {
                "type": t,
                "stage": stage[t],
                "stageName": STAGE_NAMES.get(stage[t], f"Stage {stage[t]}"),
                "n_bodies": int(len(sub)),
                "superclass": str(row.get("superclass")) if isinstance(row.get("superclass"), str) else None,
                "neurotransmitter": {
                    "predicted": str(nt_row["celltype_predicted_nt"]) if nt_row is not None and isinstance(nt_row["celltype_predicted_nt"], str) else None,
                    "confidence": float(nt_row["celltype_predicted_nt_confidence"]) if nt_row is not None and pd.notna(nt_row["celltype_predicted_nt_confidence"]) else None,
                    "ground_truth": str(nt_row["ground_truth"]) if nt_row is not None and isinstance(nt_row["ground_truth"], str) else None,
                },
                "evidence": _evidence(row, t),
                "sex": _sex_status(row),
                "bodyIds": [int(b) for b in sub["bodyId"].head(400).tolist()],
            }
        )

    # every edge that appears in at least one selected route
    edge_keys = {(e["source"], e["target"]) for r in routes for e in r.edges}
    edges = []
    for a, b in sorted(edge_keys):
        d = graph.edges[a, b]
        edges.append(
            {
                "source": a,
                "target": b,
                "weight": int(d["weight"]),
                "relative_weight": round(float(d["relative_weight"]), 5),
            }
        )

    bottlenecks = bottleneck_nodes(routes).to_dict(orient="records")

    removals = {}
    for t in types:
        if t in (SOURCE_TYPE, TARGET_TYPE):
            continue
        removals[t] = removal_effect(graph, SOURCE_TYPE, TARGET_TYPE, t, max_hops=max_hops)

    return {
        "meta": {
            "title": "From Sight to Action",
            "subtitle": "A structural route from the photoreceptors to a locomotor descending neuron",
            "source": SOURCE_TYPE,
            "target": TARGET_TYPE,
            "dataset": "MaleCNS v1.0 (minconf 0.5), HHMI Janelia — CC-BY",
            "dataUrl": "https://male-cns.janelia.org/download/",
            "method": (
                "Body-level connectivity was collapsed to a type-level directed graph. "
                "Each edge carries both the total synapse count and a relative weight "
                "(the fraction of the target type's total input coming from that source). "
                "Routes are ranked by the product of relative weights along the path. "
                "All results are structural statements about wiring, not simulations of "
                "neural activity or predictions of behaviour."
            ),
            "stageNames": STAGE_NAMES,
        },
        "nodes": nodes,
        "edges": edges,
        "routes": [
            {
                "nodes": r.nodes,
                "hops": r.hops,
                "total_synapses": r.total_synapses,
                "min_relative_weight": r.min_relative_weight,
                "score": r.score,
                "edges": r.edges,
            }
            for r in routes
        ],
        "bottlenecks": bottlenecks,
        "removals": removals,
    }


def build_context(
    graph: nx.DiGraph,
    weights: pd.DataFrame,
    annotations: pd.DataFrame,
    max_hops: int = 5,
    n_shuffles: int = 500,
    leaderboard: int = 12,
    thresholds: tuple[int, ...] = (10, 20, 50, 100),
) -> dict:
    """Statistical context: is this route actually special?

    A dense recurrent network connects nearly everything to nearly everything
    within a few hops, so "a path exists" is weak evidence on its own. This
    compares the observed route against other descending neurons, other
    sensory modalities, and weight-shuffled versions of the same graph, and
    checks that the route survives changes to the analysis thresholds.
    """
    from .analysis import build_type_graph, strongest_paths
    from .nulls import best_scores_from, best_scores_to, evaluate

    traced = annotations[annotations["status"] == "Traced"]
    dn_types = set(traced[traced["superclass"] == "descending_neuron"]["type"].dropna())
    sensory_types = set(
        traced[traced["superclass"].isin(["ol_sensory", "cb_sensory", "vnc_sensory"])][
            "type"
        ].dropna()
    )

    nulls = evaluate(
        graph, annotations, SOURCE_TYPE, TARGET_TYPE, max_hops=max_hops, n_shuffles=n_shuffles
    )

    forward = best_scores_from(graph, SOURCE_TYPE, max_hops=max_hops)
    backward = best_scores_to(graph, TARGET_TYPE, max_hops=max_hops)

    top_dn = sorted(
        ((t, s) for t, s in forward.items() if t in dn_types and s > 0),
        key=lambda kv: kv[1],
        reverse=True,
    )[:leaderboard]
    top_sensory = sorted(
        ((t, s) for t, s in backward.items() if t in sensory_types and s > 0),
        key=lambda kv: kv[1],
        reverse=True,
    )[:leaderboard]

    robustness = []
    for mw in thresholds:
        g = build_type_graph(weights, min_weight=mw)
        found = strongest_paths(g, SOURCE_TYPE, TARGET_TYPE, k=1, max_hops=max_hops)
        robustness.append(
            {
                "min_weight": mw,
                "route": found[0].nodes if found else None,
                "score": found[0].score if found else 0.0,
                "hops": found[0].hops if found else None,
            }
        )

    return {
        "nulls": nulls.to_dict(),
        "topDescendingFromSource": [{"type": t, "score": s} for t, s in top_dn],
        "topSensoryToTarget": [{"type": t, "score": s} for t, s in top_sensory],
        "robustness": robustness,
        "note": (
            "Scores are the product of relative synaptic weights along the best "
            "route of at most five hops. Everything here is structural: it "
            "describes wiring, not activity or behaviour."
        ),
    }


def write_pathway_dataset(payload: dict, name: str = "pathway") -> Path:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    out = PROCESSED_DIR / f"{name}.json"
    out.write_text(json.dumps(payload, indent=1))
    return out
