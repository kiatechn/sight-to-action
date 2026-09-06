"""Skeleton decimation and the male/female type mapping.

The mapping test is a direct regression: the first version of the comparison
reported LC10c-1 as absent from the female brain, which was a naming artefact
rather than biology and overstated the divergence between the sexes.
"""
import numpy as np
import pandas as pd
import pytest

from sight_to_action.female import male_to_female_map
from sight_to_action.skeletons import parse_swc, simplify

SWC = """\
# a Y-shaped neuron: a trunk that forks into two branches
1 0 0 0 0 1 -1
2 0 0 1 0 1 1
3 0 0 2 0 1 2
4 0 0 3 0 1 3
5 0 1 4 0 1 4
6 0 2 5 0 1 5
7 0 -1 4 0 1 4
8 0 -2 5 0 1 7
"""


def test_parse_swc_reads_positions_and_parents():
    pos, parent = parse_swc(SWC)
    assert len(pos) == 8
    assert parent[1] == -1  # root
    assert parent[5] == 4  # fork
    assert parent[7] == 4  # the other branch off the same node
    np.testing.assert_allclose(pos[6], [2, 5, 0])  # x y z, per SWC column order


def test_parse_swc_ignores_comments_and_blank_lines():
    pos, _ = parse_swc("# comment\n\n   \n" + SWC)
    assert len(pos) == 8


def test_simplify_keeps_the_branch_point_and_both_leaves():
    pos, parent = parse_swc(SWC)
    segments = simplify(pos, parent, keep_every=1000)  # decimate aggressively
    kept = {tuple(a) for a, _ in segments} | {tuple(b) for _, b in segments}
    assert tuple(pos[4]) in kept, "branch point must survive decimation"
    assert tuple(pos[6]) in kept, "leaf must survive decimation"
    assert tuple(pos[8]) in kept, "the other leaf must survive decimation"


def test_simplify_produces_connected_segments():
    pos, parent = parse_swc(SWC)
    for keep_every in (1, 2, 1000):
        for a, b in simplify(pos, parent, keep_every=keep_every):
            assert not np.allclose(a, b), "a segment must have two distinct ends"


def test_simplify_never_invents_points():
    pos, parent = parse_swc(SWC)
    real = {tuple(p) for p in pos.values()}
    for a, b in simplify(pos, parent, keep_every=2):
        assert tuple(a) in real and tuple(b) in real


def test_more_decimation_yields_no_more_segments():
    pos, parent = parse_swc(SWC)
    counts = [len(simplify(pos, parent, keep_every=k)) for k in (1, 3, 1000)]
    assert counts == sorted(counts, reverse=True)


# --- male/female mapping -------------------------------------------------


def _male_annotations(rows):
    return pd.DataFrame(
        [{"status": "Traced", "type": t, "flywireType": f} for t, f in rows]
    )


def test_mapping_uses_the_recorded_flywire_type():
    ann = _male_annotations([("LC4", "LC4_fw")])
    assert male_to_female_map(ann, ["LC4"], female_types={"LC4_fw"}) == {"LC4": ["LC4_fw"]}


def test_mapping_falls_back_to_an_exact_name_match():
    """Regression: MaleCNS records LC10c-1's counterpart as "LC10c", but
    FlyWire names that type "LC10c-1". Without the fallback the type looked
    absent from the female brain, which wrongly inflated the sex difference."""
    ann = _male_annotations([("LC10c-1", "LC10c")])
    mapping = male_to_female_map(ann, ["LC10c-1"], female_types={"LC10c-1"})
    assert mapping["LC10c-1"] == ["LC10c-1"]


def test_mapping_reports_nothing_for_genuinely_male_specific_types():
    """LoVP92 has no female counterpart at all — that must stay empty, since
    the headline finding depends on it."""
    ann = _male_annotations([("LoVP92", None)])
    assert male_to_female_map(ann, ["LoVP92"], female_types={"LC4", "L1"}) == {"LoVP92": []}


def test_mapping_discards_names_absent_from_the_female_dataset():
    ann = _male_annotations([("X", "not_in_flywire")])
    assert male_to_female_map(ann, ["X"], female_types={"something_else"}) == {"X": []}


def test_mapping_splits_multiple_recorded_counterparts():
    ann = _male_annotations([("AOTU016_c", "CB0007,CB0739")])
    mapping = male_to_female_map(ann, ["AOTU016_c"], female_types={"CB0007", "CB0739"})
    assert mapping["AOTU016_c"] == ["CB0007", "CB0739"]


def test_mapping_without_a_female_list_does_not_filter():
    ann = _male_annotations([("LC4", "LC4_fw")])
    assert male_to_female_map(ann, ["LC4"]) == {"LC4": ["LC4_fw"]}
