"""Export real soma-position data for the 3D viewer.

Every coordinate here is a real EM-reconstructed soma centroid from the
MaleCNS dataset (body-annotations `somaLocation`), normalized into a
roughly [-1, 1] cube (uniform scale, so the true anatomical shape of the
CNS is preserved) for use directly as Three.js positions.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

PROCESSED_DIR = Path(__file__).resolve().parents[2] / "data" / "processed"


def normalize(coords: np.ndarray, center: np.ndarray, scale: float) -> np.ndarray:
    return (coords - center) / scale


def export_3d_scene(
    annotations: pd.DataFrame,
    tiers: list[list[str]],
    background_sample_size: int = 30000,
    seed: int = 0,
) -> Path:
    traced = annotations[
        (annotations["status"] == "Traced") & annotations["somaLocation"].notna()
    ]
    all_coords = np.stack(traced["somaLocation"].to_numpy()).astype(float)

    center = all_coords.mean(axis=0)
    scale = float(np.abs(all_coords - center).max())

    rng = np.random.default_rng(seed)
    bg_idx = rng.choice(len(traced), size=min(background_sample_size, len(traced)), replace=False)
    bg_coords = normalize(all_coords[bg_idx], center, scale)

    tier_index = {t: i for i, tier in enumerate(tiers) for t in tier}
    all_types = list(tier_index.keys())
    pathway = traced[traced["type"].isin(all_types)][
        ["bodyId", "type", "somaLocation", "somaSide"]
    ].copy()
    pathway_coords = normalize(
        np.stack(pathway["somaLocation"].to_numpy()).astype(float), center, scale
    )

    neurons = [
        {
            "bodyId": int(row.bodyId),
            "type": row.type,
            "tier": tier_index[row.type],
            "side": row.somaSide,
            "position": pathway_coords[i].round(4).tolist(),
        }
        for i, row in enumerate(pathway.itertuples(index=False))
    ]

    payload = {
        "meta": {
            "description": (
                "Real soma positions from MaleCNS v1.0 EM reconstruction, "
                "normalized to fit a [-1, 1] cube with true relative "
                "proportions preserved (uniform scale, not stretched per axis)."
            ),
            "n_background_points": len(bg_coords),
            "n_pathway_neurons": len(neurons),
        },
        "backgroundCloud": bg_coords.round(4).tolist(),
        "neurons": neurons,
    }

    out_path = PROCESSED_DIR / "giant_fiber_3d.json"
    out_path.write_text(json.dumps(payload))
    return out_path
