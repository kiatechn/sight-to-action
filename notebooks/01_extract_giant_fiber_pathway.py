# %% [markdown]
# # From Sight to Action — V0.1: extracting the Giant Fiber escape pathway
#
# **Question:** which neurons bridge visual input to descending
# movement-control neurons, in the MaleCNS connectome?
#
# **Answer used for V0.1:** the *Giant Fiber visual escape circuit* — one of
# the best-characterized sensorimotor pathways in *Drosophila*. Looming
# (approaching-object) visual signals detected by lobula visual projection
# neurons **LC4** and **LPLC2** drive **DNp01**, the Giant Fiber descending
# neuron, which in turn drives **TTMn** (the tergotrochanteral "jump" motor
# neuron) and **PSI** (which feeds the flight motor system). This matches
# the circuit described in von Reyn et al. 2014/2017 and Ache et al. 2019 —
# so this notebook is a *reproduction*, from real connectome data, of a
# published finding, not a novel claim.
#
# Data: MaleCNS v1.0 (minconf 0.5), public flat-connectome Feather files at
# `gs://flyem-male-cns/v1.0/connectome-data/flat-connectome/` (CC-BY,
# Janelia FlyEM). See `../README.md` for how these were downloaded.

# %%
import sys

sys.path.insert(0, "../src")

from sight_to_action.data import load_annotations, load_neurotransmitters, load_weights
from sight_to_action.pathway import build_pathway_graph, top_upstream_types
from sight_to_action.export import to_json

annotations = load_annotations()
neurotransmitters = load_neurotransmitters()
weights = load_weights()

print(f"{len(annotations):,} traced bodies")
print(f"{len(weights):,} directed connectivity edges (body-to-body)")

# %% [markdown]
# ## 1. Confirm the circuit exists in the data
#
# Search `body-annotations` for the known Giant Fiber circuit cell types by
# their published names, and confirm their `superclass` matches what we'd
# expect (visual projection neuron -> descending neuron -> motor neuron).

# %%
known_types = ["LC4", "LPLC2", "DNp01", "TTMn", "PSI"]
for t in known_types:
    sub = annotations[annotations["type"] == t]
    superclass = sub["superclass"].mode().iat[0] if len(sub) else "NOT FOUND"
    print(f"{t:8s}  n_bodies={len(sub):3d}  superclass={superclass}")

# %% [markdown]
# ## 2. Rank the strongest upstream inputs to the looming-detecting VPNs
#
# Rather than hand-picking the "visual input" tier, rank every cell type
# that synapses onto LC4/LPLC2 by total synaptic weight, and take the
# strongest ones (excluding LC4/LPLC2's own recurrent connections to each
# other).

# %%
ranked = top_upstream_types(weights, target_types=["LC4", "LPLC2"], n=15)
ranked = ranked[~ranked.index.isin(["LC4", "LPLC2"])]
ranked.head(10)

# %% [markdown]
# These are optic-lobe motion- and feature-detecting neurons — T4/T5
# (direction-selective motion detectors) and Tm/T2/TmY-family medulla
# neurons — exactly the classes of neuron known from the literature to
# feed looming-detection VPNs.

# %%
visual_input_tier = ranked.head(10).index.tolist()
visual_input_tier

# %% [markdown]
# ## 3. Build the type-level pathway graph
#
# Four tiers, each strictly feed-forward into the next (edges that run
# backward across tiers, e.g. descending -> visual, are dropped — this is
# what turns the full recurrent connectome into one readable story):
#
# 1. Visual motion/feature detectors (optic lobe)
# 2. Looming-sensitive visual projection neurons (LC4, LPLC2)
# 3. The Giant Fiber descending neuron (DNp01)
# 4. Direct motor targets (TTMn, PSI)

# %%
tiers = [
    visual_input_tier,
    ["LC4", "LPLC2"],
    ["DNp01"],
    ["TTMn", "PSI"],
]

result = build_pathway_graph(
    weights, annotations, neurotransmitters, tiers, min_weight=3
)
print(f"{result.graph.number_of_nodes()} cell types, {result.graph.number_of_edges()} edges")
result.node_table

# %% [markdown]
# ## 4. Sanity-check the core circuit edges
#
# These four edges are the published backbone of the circuit — confirm
# they survive the extraction with non-trivial synapse weight.

# %%
edge_lookup = {
    (r.type_pre, r.type_post): (r.weight, r.n_synapse_connections)
    for r in result.edge_table.itertuples()
}
for pair in [("LC4", "DNp01"), ("LPLC2", "DNp01"), ("DNp01", "TTMn"), ("DNp01", "PSI")]:
    print(pair, "-> weight, n_body_pairs =", edge_lookup.get(pair))

# %% [markdown]
# ## 5. Export for the web app
#
# A small (~15 node) JSON file — the full 500MB+ raw tables never need to
# ship to the browser.

# %%
out_path = to_json(
    result,
    "giant_fiber_pathway",
    meta={
        "title": "Visual looming input to the Giant Fiber escape circuit",
        "dataset": "MaleCNS v1.0 (minconf 0.5)",
        "source": "gs://flyem-male-cns/v1.0/connectome-data/flat-connectome/",
        "description": (
            "LC4/LPLC2 looming-sensitive visual projection neurons drive "
            "DNp01 (the Giant Fiber), which drives TTMn (jump muscle) and "
            "PSI (flight motor pathway)."
        ),
        "references": [
            "von Reyn et al. 2014, Neuron - 'A spike-timing mechanism for action selection'",
            "von Reyn et al. 2017, Nat Neurosci - 'Feature integration drives probabilistic behavior'",
            "Ache et al. 2019, Curr Biol - 'Neural basis for looming size and velocity encoding'",
        ],
    },
)
print("wrote", out_path)
