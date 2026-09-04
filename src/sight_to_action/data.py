"""Loaders for the MaleCNS flat-connectome Feather files.

Source: gs://flyem-male-cns/v1.0/connectome-data/flat-connectome/
(public, no auth token required). See README.md for download instructions.
"""
from pathlib import Path

import pandas as pd

RAW_DIR = Path(__file__).resolve().parents[2] / "data" / "raw"

ANNOTATIONS_FILE = RAW_DIR / "body-annotations-male-cns-v1.0-minconf-0.5.feather"
NEUROTRANSMITTERS_FILE = RAW_DIR / "body-neurotransmitters-male-cns-v1.0.feather"
WEIGHTS_FILE = (
    RAW_DIR
    / "connectome-weights-male-cns-v1.0-minconf-0.5-significant-only.feather"
)


def load_annotations(traced_only: bool = True) -> pd.DataFrame:
    """Per-body (per-neuron) annotations: type, superclass, class, side, etc."""
    df = pd.read_feather(ANNOTATIONS_FILE)
    if traced_only:
        df = df[df["status"] == "Traced"]
    return df


def load_neurotransmitters() -> pd.DataFrame:
    """Predicted neurotransmitter per body."""
    return pd.read_feather(NEUROTRANSMITTERS_FILE)


def load_weights() -> pd.DataFrame:
    """Directed body_pre -> body_post connectivity weights (synapse counts)."""
    return pd.read_feather(WEIGHTS_FILE)
