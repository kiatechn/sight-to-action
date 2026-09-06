"""Shared fixtures.

Tests run against small synthetic graphs rather than the real connectome, so
the suite is fast and works on a machine that has not downloaded the ~1.4 GB
of source data. The few tests that genuinely need the real tables are marked
`needs_data` and skip themselves when it is absent.
"""
import sys
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from sight_to_action.data import ANNOTATIONS_FILE, WEIGHTS_FILE  # noqa: E402


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "needs_data: requires the downloaded connectome tables"
    )


@pytest.fixture
def toy_connectivity() -> pd.DataFrame:
    """A tiny connectome with a deliberate structure.

        SRC ─500→ A ─300→ C ─200→ DST     (strong route)
        SRC ─100→ B ─ 50→ C               (weak route into the same hub)
        SRC ─ 10→ D ─  5→ DST             (weak but independent route)

    C is a bottleneck for the two upper routes; D is the only alternative if
    C is removed. Weights are chosen so the strong route wins on both raw
    synapse count and relative weight.
    """
    rows = [
        ("SRC", "A", 500),
        ("SRC", "B", 100),
        ("SRC", "D", 10),
        ("A", "C", 300),
        ("B", "C", 50),
        ("C", "DST", 200),
        ("D", "DST", 5),
    ]
    # the loader works at body level, so expand each type pair into one body pair
    return pd.DataFrame(
        [
            {"body_pre": i, "body_post": i + 100, "weight": w, "type_pre": a, "type_post": b}
            for i, (a, b, w) in enumerate(rows)
        ]
    )


@pytest.fixture
def toy_annotations() -> pd.DataFrame:
    """Annotations matching `toy_connectivity`."""
    types = ["SRC", "A", "B", "C", "D", "DST"]
    superclass = {
        "SRC": "ol_sensory",
        "A": "cb_intrinsic",
        "B": "cb_intrinsic",
        "C": "cb_intrinsic",
        "D": "cb_intrinsic",
        "DST": "descending_neuron",
    }
    return pd.DataFrame(
        [
            {
                "bodyId": 1000 + i,
                "type": t,
                "status": "Traced",
                "superclass": superclass[t],
                "somaLocation": [i * 10, i * 10, i * 10],
                "somaSide": "L" if i % 2 else "R",
                "flywireType": {"SRC": "SRC_fw", "DST": "DST_fw"}.get(t),
                "hemibrainType": None,
                "dimorphism": "male-specific" if t == "B" else None,
                "class": "visual" if t == "SRC" else None,
            }
            for i, t in enumerate(types)
        ]
    )


@pytest.fixture
def toy_neurotransmitters() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "body": 1000 + i,
                "cell_type": t,
                "celltype_predicted_nt": "acetylcholine",
                "celltype_predicted_nt_confidence": 0.9,
                "ground_truth": None,
            }
            for i, t in enumerate(["SRC", "A", "B", "C", "D", "DST"])
        ]
    )


needs_data = pytest.mark.skipif(
    not (ANNOTATIONS_FILE.exists() and WEIGHTS_FILE.exists()),
    reason="connectome tables not downloaded; see README",
)
