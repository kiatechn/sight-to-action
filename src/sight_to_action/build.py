"""One reproducible build of every dataset the web app consumes.

Outputs (into data/processed/):
  pathway.json    cell types, ranked routes, bottlenecks, removal effects, sex mapping
  skeletons.json  real EM-traced neuron morphology (decimated SWC) per cell type
  cloud.json      background soma point cloud giving the CNS its shape

All three share one coordinate frame: raw MaleCNS voxel coordinates centred
on the traced-soma centroid and divided by a single uniform scale, so real
anatomical proportions are preserved.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

from .analysis import build_type_graph
from .data import load_annotations, load_neurotransmitters, load_weights
from .pipeline import build_context, build_pathway_dataset, write_pathway_dataset
from .skeletons import build_skeleton_payload, write_skeletons

PROCESSED_DIR = Path(__file__).resolve().parents[2] / "data" / "processed"


def coordinate_frame(annotations: pd.DataFrame) -> tuple[np.ndarray, float, np.ndarray]:
    """Shared normalisation: centroid of all traced somas, uniform scale."""
    traced = annotations[
        (annotations["status"] == "Traced") & annotations["somaLocation"].notna()
    ]
    coords = np.stack(traced["somaLocation"].to_numpy()).astype(float)
    center = coords.mean(axis=0)
    scale = float(np.abs(coords - center).max())
    return center, scale, coords


def build_all(
    n_routes: int = 12,
    max_hops: int = 5,
    cloud_points: int = 12000,
    skeletons_per_type: int = 2,
    keep_every: int = 12,
    min_weight: int = 20,
    seed: int = 0,
) -> dict[str, Path]:
    annotations = load_annotations()
    neurotransmitters = load_neurotransmitters()
    weights = load_weights()

    center, scale, all_coords = coordinate_frame(annotations)

    graph = build_type_graph(weights, min_weight=min_weight)
    payload = build_pathway_dataset(
        graph, annotations, neurotransmitters, n_routes=n_routes, max_hops=max_hops
    )
    payload["meta"]["coordinateFrame"] = {
        "center": [round(float(c), 2) for c in center],
        "scale": round(scale, 2),
        "note": "normalised = (raw_voxel - center) / scale",
    }

    # per-type soma positions (real coordinates, for placing markers)
    traced = annotations[
        (annotations["status"] == "Traced") & annotations["somaLocation"].notna()
    ]
    for node in payload["nodes"]:
        sub = traced[traced["type"] == node["type"]]
        if len(sub):
            pts = np.stack(sub["somaLocation"].to_numpy()).astype(float)
            pts = (pts - center) / scale
            node["somaPositions"] = [
                [round(float(v), 4) for v in p] for p in pts[:250]
            ]
        else:
            node["somaPositions"] = []

    payload["context"] = build_context(
        graph, weights, annotations, max_hops=max_hops
    )

    pathway_path = write_pathway_dataset(payload, "pathway")

    # real morphology for each cell type in the pathway
    type_to_bodies = {n["type"]: n["bodyIds"] for n in payload["nodes"]}
    skeletons = build_skeleton_payload(
        type_to_bodies,
        center=center,
        scale=scale,
        max_per_type=skeletons_per_type,
        keep_every=keep_every,
    )
    skeleton_path = write_skeletons(skeletons, "skeletons")

    # background cloud, flat array to keep the payload small
    rng = np.random.default_rng(seed)
    idx = rng.choice(len(all_coords), size=min(cloud_points, len(all_coords)), replace=False)
    cloud = ((all_coords[idx] - center) / scale).round(3).ravel().tolist()
    cloud_path = PROCESSED_DIR / "cloud.json"
    cloud_path.write_text(json.dumps({"stride": 3, "positions": cloud}))

    return {"pathway": pathway_path, "skeletons": skeleton_path, "cloud": cloud_path}
