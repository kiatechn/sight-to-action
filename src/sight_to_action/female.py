"""Run the identical pathway analysis on the female connectome.

Earlier versions of this project called their male/female section a
"comparison" while only reading the dimorphism flags recorded in the MaleCNS
annotations. That is somebody else's result. This module instead rebuilds the
same type-level graph from the *female* FlyWire (FAFB) whole-brain connectome
and re-runs the same route search, so the comparison is actually computed.

Data
----
Connectivity : proofread_connections_783.feather
               Zenodo 10676866, "FlyWire Whole-brain Connectome Connectivity
               Data" (CC-BY).
Annotations  : Supplemental_file1_neuron_annotations.tsv
               github.com/flyconnectome/flywire_annotations (Schlegel et al.,
               Nature 2024).

Caveat: FlyWire is a *brain* dataset with no ventral nerve cord, so descending
neurons are present but truncated at the neck. Comparisons are therefore about
the brain portion of the pathway.
"""
from math import log
from pathlib import Path

import networkx as nx
import numpy as np
import pandas as pd

RAW = Path(__file__).resolve().parents[2] / "data" / "raw" / "flywire"
CONNECTIONS = RAW / "proofread_connections_783.feather"
ANNOTATIONS = RAW / "flywire_annotations.tsv"


def load_female_annotations() -> pd.DataFrame:
    return pd.read_csv(ANNOTATIONS, sep="\t", low_memory=False)


def load_female_connections() -> pd.DataFrame:
    return pd.read_feather(CONNECTIONS)


def build_female_type_graph(
    connections: pd.DataFrame,
    annotations: pd.DataFrame,
    min_weight: int = 20,
) -> nx.DiGraph:
    """Type-level female graph, built exactly like the male one.

    Edge weight is the summed synapse count between two cell types; the
    relative weight is the fraction of the target type's total input that
    arrives from that source, and cost is -log(relative weight).
    """
    cols = {c.lower(): c for c in connections.columns}
    pre = cols.get("pre_root_id") or cols.get("pre_pt_root_id") or connections.columns[0]
    post = cols.get("post_root_id") or cols.get("post_pt_root_id") or connections.columns[1]
    syn = cols.get("syn_count") or cols.get("weight") or connections.columns[-1]

    lookup = annotations.dropna(subset=["cell_type"]).set_index("root_id")["cell_type"]

    df = connections[[pre, post, syn]].copy()
    df.columns = ["pre", "post", "weight"]
    df["type_pre"] = df["pre"].map(lookup)
    df["type_post"] = df["post"].map(lookup)
    df = df.dropna(subset=["type_pre", "type_post"])

    tw = (
        df.groupby(["type_pre", "type_post"], observed=True)["weight"].sum().reset_index()
    )
    tw = tw[tw["weight"] >= min_weight]
    total_in = tw.groupby("type_post", observed=True)["weight"].sum()

    g = nx.DiGraph()
    for row in tw.itertuples(index=False):
        rel = float(row.weight) / float(total_in[row.type_post])
        g.add_edge(
            row.type_pre,
            row.type_post,
            weight=int(row.weight),
            relative_weight=rel,
            cost=-log(max(rel, 1e-12)),
        )
    return g


def male_to_female_map(
    annotations_male: pd.DataFrame,
    types: list[str],
    female_types: set[str] | None = None,
) -> dict[str, list[str]]:
    """MaleCNS type -> the female cell type(s) it is matched to.

    The recorded `flywireType` is authoritative, but it is not always current:
    MaleCNS maps LC10c-1 to "LC10c" while FlyWire actually names that type
    "LC10c-1". So when a female type list is supplied, the male type's own name
    is accepted as a fallback if it exists verbatim in the female dataset.
    Both projects use the same community nomenclature, so an exact name match
    is a real identification rather than a coincidence.
    """
    traced = annotations_male[annotations_male["status"] == "Traced"]
    out: dict[str, list[str]] = {}
    for t in types:
        rows = traced[traced["type"] == t]["flywireType"].dropna()
        names: list[str] = []
        for value in rows.unique():
            names.extend(part.strip() for part in str(value).split(","))
        resolved = {n for n in names if n}
        if female_types is not None:
            resolved = {n for n in resolved if n in female_types}
            if t in female_types:
                resolved.add(t)
        out[t] = sorted(resolved)
    return out


def compare_edges(
    male_graph: nx.DiGraph,
    female_graph: nx.DiGraph,
    male_edges: list[dict],
    mapping: dict[str, list[str]],
) -> list[dict]:
    """For each edge of the male pathway, find its female counterpart."""
    rows = []
    for e in male_edges:
        src_names = mapping.get(e["source"], [])
        dst_names = mapping.get(e["target"], [])
        best = None
        for a in src_names:
            for b in dst_names:
                if female_graph.has_edge(a, b):
                    d = female_graph.edges[a, b]
                    if best is None or d["relative_weight"] > best["relative_weight"]:
                        best = {
                            "female_source": a,
                            "female_target": b,
                            "weight": int(d["weight"]),
                            "relative_weight": round(float(d["relative_weight"]), 5),
                        }
        rows.append(
            {
                "male_source": e["source"],
                "male_target": e["target"],
                "male_weight": e["weight"],
                "male_relative_weight": e["relative_weight"],
                "female_source": ",".join(src_names) or None,
                "female_target": ",".join(dst_names) or None,
                "found": best is not None,
                "female_weight": best["weight"] if best else None,
                "female_relative_weight": best["relative_weight"] if best else None,
                "reason_missing": (
                    None
                    if best
                    else ("no female cell type recorded" if not src_names or not dst_names
                          else "cell types exist but are not connected in the female brain")
                ),
            }
        )
    return rows


def build_female_comparison(
    male_annotations: pd.DataFrame,
    male_payload: dict,
    min_weight: int = 20,
    max_hops: int = 5,
    n_routes: int = 6,
) -> dict | None:
    """Full computed male/female comparison, or None if the data is absent.

    The FlyWire files are a large optional download, so a repository that only
    has the MaleCNS tables still builds — it just omits this section.
    """
    if not CONNECTIONS.exists() or not ANNOTATIONS.exists():
        return None

    from .analysis import strongest_paths
    from .nulls import best_scores_from

    female_ann = load_female_annotations()
    female_graph = build_female_type_graph(
        load_female_connections(), female_ann, min_weight=min_weight
    )

    types = [n["type"] for n in male_payload["nodes"]]
    female_type_names = set(female_ann["cell_type"].dropna())
    mapping = male_to_female_map(male_annotations, types, female_types=female_type_names)
    edges = compare_edges(None, female_graph, male_payload["edges"], mapping)

    # the female names for our two endpoints
    female_source = (mapping.get(male_payload["meta"]["source"]) or ["R1-6"])[0]
    female_target = (mapping.get(male_payload["meta"]["target"]) or ["DNg13"])[0]

    routes = strongest_paths(
        female_graph, female_source, female_target, k=n_routes, max_hops=max_hops
    )

    # identical null test, run on the female brain
    descending = set(female_ann[female_ann["super_class"] == "descending"]["cell_type"].dropna())
    forward = best_scores_from(female_graph, female_source, max_hops=max_hops)
    ranked = sorted(
        ((t, s) for t, s in forward.items() if t in descending and s > 0),
        key=lambda kv: kv[1],
        reverse=True,
    )
    rank = next((i for i, (t, _) in enumerate(ranked, 1) if t == female_target), None)

    # which male types simply do not exist in the female dataset
    missing_types = [t for t in types if not mapping.get(t)]

    male_route_sets = [set(r["nodes"]) for r in male_payload["routes"]]
    conserved = []
    for r in routes:
        # translate the female route back to male names where possible
        back = {v: k for k, vals in mapping.items() for v in vals}
        as_male = [back.get(n, n) for n in r.nodes]
        if any(set(as_male) == s for s in male_route_sets):
            conserved.append(as_male)

    female_specific = female_specific_analysis(
        female_ann, male_annotations, [{"nodes": r.nodes} for r in routes]
    )

    return {
        "femaleSpecific": female_specific,
        "meta": {
            "femaleDataset": "FlyWire / FAFB whole-brain female connectome (snapshot 783)",
            "femaleSource": "Zenodo 10676866 (connectivity, CC-BY); flyconnectome/flywire_annotations (Schlegel et al., Nature 2024)",
            "note": (
                "The same type-level graph construction, relative-weight definition and "
                "route ranking were re-run on the female connectome. FlyWire covers the "
                "brain only (no ventral nerve cord), so descending neurons are present "
                "but truncated at the neck."
            ),
            "source": female_source,
            "target": female_target,
            "min_weight": min_weight,
            "max_hops": max_hops,
        },
        "edges": edges,
        "edgesFound": int(sum(1 for e in edges if e["found"])),
        "edgesTotal": len(edges),
        "missingTypes": missing_types,
        "femaleRoutes": [
            {"nodes": r.nodes, "hops": r.hops, "score": r.score} for r in routes
        ],
        "conservedRoutes": conserved,
        "femaleRank": rank,
        "femalePool": len(ranked),
        "femaleTopDescending": [{"type": t, "score": s} for t, s in ranked[:8]],
        "femaleTargetScore": float(forward.get(female_target, 0.0)),
    }


# FAFB/FlyWire voxel space is anisotropic: x and y are 4 nm, z sections are
# 40 nm. Without correcting that the brain renders badly squashed.
FAFB_VOXEL_NM = (4.0, 4.0, 40.0)


def female_soma_frame(annotations: pd.DataFrame):
    """Centroid and uniform scale for the female soma cloud, in nm."""
    s = annotations.dropna(subset=["soma_x", "soma_y", "soma_z"])
    pts = s[["soma_x", "soma_y", "soma_z"]].to_numpy(dtype=float) * np.array(FAFB_VOXEL_NM)
    center = pts.mean(axis=0)
    scale = float(np.abs(pts - center).max())
    return center, scale, pts


def build_female_3d(
    annotations: pd.DataFrame, cloud_points: int = 12000, seed: int = 0
) -> tuple[dict, dict]:
    """Female brain point cloud and one soma position per cell type per side.

    FlyWire ships no skeletons here, so the female view is a soma cloud with
    route markers — the male view keeps full traced morphology for the featured
    pathway. The two datasets are also in different template spaces, so each is
    normalised independently and they are never overlaid.
    """
    center, scale, _ = female_soma_frame(annotations)

    s = annotations.dropna(subset=["soma_x", "soma_y", "soma_z"])
    pts = s[["soma_x", "soma_y", "soma_z"]].to_numpy(dtype=float) * np.array(FAFB_VOXEL_NM)
    norm = (pts - center) / scale

    rng = np.random.default_rng(seed)
    idx = rng.choice(len(norm), size=min(cloud_points, len(norm)), replace=False)
    cloud = {"stride": 3, "positions": norm[idx].round(3).ravel().tolist()}

    soma: dict[str, list] = {}
    types = s["cell_type"].to_numpy()
    sides = s["side"].astype(str).to_numpy()
    for cell_type in pd.unique(types):
        if not isinstance(cell_type, str) or not cell_type:
            continue
        mask = types == cell_type
        picks = []
        for side in ("left", "right"):
            sel = norm[mask & (sides == side)]
            if len(sel):
                picks.append([round(float(v), 4) for v in sel.mean(axis=0)])
        if not picks:
            picks.append([round(float(v), 4) for v in norm[mask].mean(axis=0)])
        soma[str(cell_type)] = picks
    return cloud, soma


def female_specific_analysis(
    female_annotations: pd.DataFrame,
    male_annotations: pd.DataFrame,
    female_routes: list[dict],
) -> dict:
    """The mirror of the male-specific finding: what is unique to the female?

    Two independent signals are used: FlyWire's own `dimorphism` column, and
    whether any MaleCNS cell type maps onto that female type at all.
    """
    traced_male = male_annotations[male_annotations["status"] == "Traced"]
    mapped_to_female: set[str] = set()
    for value in traced_male["flywireType"].dropna().unique():
        mapped_to_female.update(part.strip() for part in str(value).split(","))

    fa = female_annotations
    dimorphism_by_type = (
        fa.dropna(subset=["cell_type"])
        .groupby("cell_type")["dimorphism"]
        .agg(lambda s: s.dropna().iloc[0] if s.notna().any() else None)
    )

    route_types = sorted({n for r in female_routes for n in r["nodes"]})
    rows = []
    for t in route_types:
        dim = dimorphism_by_type.get(t)
        rows.append(
            {
                "type": t,
                "dimorphism": dim if isinstance(dim, str) else None,
                "hasMaleCounterpart": t in mapped_to_female,
            }
        )

    # every female-specific cell type in the whole dataset, for context
    female_only = sorted(
        dimorphism_by_type[
            dimorphism_by_type.isin(["female-specific", "potentially female-specific"])
        ].index.tolist()
    )

    return {
        "routeTypes": rows,
        "femaleSpecificCount": int(
            fa["dimorphism"].isin(["female-specific", "potentially female-specific"]).sum()
        ),
        "sexuallyDimorphicCount": int((fa["dimorphism"] == "sexually dimorphic").sum()),
        "femaleSpecificTypesSample": female_only[:40],
        "femaleSpecificTypeCount": len(female_only),
    }
