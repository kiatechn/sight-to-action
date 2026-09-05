# %% [markdown]
# # From Sight to Action — extracting a visual→motor pathway
#
# **Question.** Which neurons form a structural route from the R1–R6
# photoreceptors to **DNg13**, a descending neuron of the locomotor control
# population, in the adult male *Drosophila* central nervous system?
#
# **Data.** MaleCNS v1.0 (HHMI Janelia / Cambridge Drosophila Connectomics /
# Google Research), CC-BY. Flat connectome tables are downloaded from the
# public bucket `gs://flyem-male-cns/v1.0/connectome-data/flat-connectome/`
# and neuron skeletons from
# `gs://flyem-male-cns/v1.0/segmentation/skeletons-malecns/skeletons-swc/`.
# No API token is required. See `../README.md` for the download commands.
#
# **Scope.** Everything below is a *structural* analysis of wiring. Nothing
# here simulates neural activity or predicts behaviour.

# %%
import sys

sys.path.insert(0, "../src")

import pandas as pd

from sight_to_action.data import load_annotations, load_neurotransmitters, load_weights
from sight_to_action.analysis import (
    build_type_graph,
    strongest_paths,
    bottleneck_nodes,
    removal_effect,
)

annotations = load_annotations()
neurotransmitters = load_neurotransmitters()
weights = load_weights()

print(f"{len(annotations):,} traced bodies")
print(f"{len(weights):,} body→body connections")

# %% [markdown]
# ## 1. Confirm the endpoints exist
#
# R1–R6 are the outer photoreceptors (the motion/luminance channel).
# DNg13 is a descending neuron. Both must be present and traced before any
# path search is meaningful.

# %%
for t in ["R1-R6", "DNg13"]:
    sub = annotations[annotations["type"] == t]
    print(
        f"{t:8s} n_bodies={len(sub):5d}  superclass={sub['superclass'].mode().iat[0]}"
        f"  dimorphism={sub['dimorphism'].dropna().unique()}"
    )

# %% [markdown]
# ## 2. Build the type-level graph
#
# Every body→body connection is summed into a type→type edge. Each edge
# additionally gets a **relative weight**: the fraction of the *target*
# type's total input that arrives from that source. Raw synapse counts alone
# favour large, highly-connected cell types; the relative weight asks the
# more useful question, "how much of what this neuron hears comes from
# there?".

# %%
graph = build_type_graph(weights, min_weight=20)
print(f"{graph.number_of_nodes():,} cell types, {graph.number_of_edges():,} edges")

# %% [markdown]
# ## 3. Rank the routes
#
# A route's score is the **product of relative weights** along it, found as a
# shortest path under the additive cost `-log(relative weight)`. Searching is
# restricted to a corridor of types that can lie on a ≤5-hop path, which
# makes the k-shortest-path search tractable without changing the result.

# %%
routes = strongest_paths(graph, "R1-R6", "DNg13", k=12, max_hops=5)

rows = []
for i, r in enumerate(routes, 1):
    rows.append(
        {
            "rank": i,
            "hops": r.hops,
            "route": " → ".join(r.nodes),
            "total_synapses": r.total_synapses,
            "weakest_link": r.min_relative_weight,
            "score": r.score,
        }
    )
pd.DataFrame(rows)

# %% [markdown]
# The routes recapitulate the textbook fly visual pathway —
# **retina → lamina → medulla → lobula → central brain → descending neuron** —
# without that structure being imposed anywhere in the search. The lamina
# monopolar cells (L1/L2/L3), medulla neurons (Tm/Mi), lobula projection
# neurons (LC10 family, LoVP) and anterior-optic-tubercle cells (AOTU002/016)
# all appear because of measured connectivity alone.

# %% [markdown]
# ## 4. Bottlenecks and alternative routes
#
# A cell type appearing in many of the alternative routes is a structural
# bottleneck: if it were missing, those particular wiring routes would not
# exist. This is a claim about graph connectivity, not about function.

# %%
bottlenecks = bottleneck_nodes(routes)
bottlenecks.head(10)

# %% [markdown]
# ## 5. Node-removal experiment
#
# Deleting a type from the graph and re-running the search shows how the
# available structural routes change. Again: this is **not** a simulation of
# activity and **not** a prediction of behaviour.

# %%
for t in ["LC10a", "LoVP92", "Tm3"]:
    eff = removal_effect(graph, "R1-R6", "DNg13", t, max_hops=5)
    print(f"remove {t}:")
    print(f"   before: {' → '.join(eff['best_before'])}")
    print(f"   after : {' → '.join(eff['best_after']) if eff['best_after'] else 'no route within hop limit'}")
    print(f"   still connected: {eff['still_connected']}\n")

# %% [markdown]
# ## 6. Male / female comparison
#
# MaleCNS annotations carry cross-connectome mappings (`flywireType` for the
# female FlyWire/FAFB dataset, `hemibrainType` for the female hemibrain) and
# explicit `dimorphism` flags. This lets each neuron on the pathway be
# classified as shared, sex-specific or sexually dimorphic.

# %%
pathway_types = sorted({n for r in routes for n in r.nodes})
traced = annotations[annotations["status"] == "Traced"]
sex_rows = []
for t in pathway_types:
    s = traced[traced["type"] == t]
    sex_rows.append(
        {
            "type": t,
            "n_bodies": len(s),
            "flywireType": s["flywireType"].dropna().iloc[0] if s["flywireType"].notna().any() else None,
            "hemibrainType": s["hemibrainType"].dropna().iloc[0] if s["hemibrainType"].notna().any() else None,
            "dimorphism": s["dimorphism"].dropna().iloc[0] if s["dimorphism"].notna().any() else None,
        }
    )
sex_df = pd.DataFrame(sex_rows)
sex_df

# %% [markdown]
# **Finding.** The pathway is not sex-neutral. `LoVP92` — which sits on the
# top-ranked route — is annotated **male-specific**, `VES200m` is
# *potentially* male-specific, and the target neuron **DNg13 is annotated
# sexually dimorphic** with a named FlyWire counterpart. So the strongest
# structural route found here may have no direct equivalent in the female
# connectome, while the early visual stages (photoreceptors, lamina, medulla)
# map cleanly onto female cell types.

# %%
sex_df[sex_df["dimorphism"].notna()]

# %% [markdown]
# ## 7. Is the route actually special?
#
# This is the part that distinguishes the project from a path-finder. A dense
# recurrent network connects nearly everything to nearly everything within a
# few hops, so *a path existing* is weak evidence. Three attempts to falsify
# the route follow.

# %%
from sight_to_action.nulls import best_scores_from, best_scores_to, evaluate

nulls = evaluate(graph, annotations, "R1-R6", "DNg13", max_hops=5, n_shuffles=50)
print(f"observed score            {nulls.observed_score:.3e}")
print(f"rank among descending     {nulls.target_rank} of {nulls.target_pool}")
print(f"rank among sensory types  {nulls.source_rank} of {nulls.source_pool}")
print(f"weight-shuffled mean      {nulls.shuffled_mean:.3e}")
print(f"shuffles >= observed      {nulls.shuffled_better_fraction:.0%} of {nulls.n_shuffles}")

# %% [markdown]
# ### Which descending neurons *are* strongly wired from the photoreceptors?
#
# This doubles as a sanity check on the method: if it is measuring anything
# real, the descending neurons already known to be visually driven should come
# out on top.

# %%
traced_all = annotations[annotations["status"] == "Traced"]
dn_types = set(traced_all[traced_all["superclass"] == "descending_neuron"]["type"].dropna())
forward = best_scores_from(graph, "R1-R6", max_hops=5)
top_dn = sorted(
    ((t, s) for t, s in forward.items() if t in dn_types and s > 0),
    key=lambda kv: kv[1],
    reverse=True,
)[:10]
pd.DataFrame(top_dn, columns=["descending_neuron", "score"])

# %% [markdown]
# `DNp01` — the Giant Fiber, the textbook visual escape neuron — appears near
# the top at roughly 140× the score of DNg13, alongside DNp02/03/04 and DNp11.
# The method is finding the visually-driven descending neurons; DNg13 simply
# is not one of the strongest of them by this structural measure.

# %% [markdown]
# ### Which senses dominate DNg13's input?

# %%
sensory_types = set(
    traced_all[traced_all["superclass"].isin(["ol_sensory", "cb_sensory", "vnc_sensory"])][
        "type"
    ].dropna()
)
backward = best_scores_to(graph, "DNg13", max_hops=5)
top_sensory = sorted(
    ((t, s) for t, s in backward.items() if t in sensory_types and s > 0),
    key=lambda kv: kv[1],
    reverse=True,
)[:10]
pd.DataFrame(top_sensory, columns=["sensory_type", "score"])

# %% [markdown]
# **Conclusion.** The R1–R6 → DNg13 route is real, reproducible and stable,
# but it is *not statistically special*: below median against other descending
# neurons, below median against other senses, and beaten by most
# weight-shuffled graphs. That does not contradict the published result that
# DNg13 is visually driven and steers walking — it shows that **path
# existence, and even "strongest path", are weak evidence of a functional
# channel**, which is precisely the failure mode invited by tools that return
# a path between any two neurons.

# %% [markdown]
# ### Robustness to analysis choices

# %%
rows = []
for min_weight in [10, 20, 50, 100]:
    g = build_type_graph(weights, min_weight=min_weight)
    found = strongest_paths(g, "R1-R6", "DNg13", k=1, max_hops=5)
    rows.append(
        {
            "min_weight": min_weight,
            "score": found[0].score if found else 0.0,
            "route": " → ".join(found[0].nodes) if found else "none",
        }
    )
pd.DataFrame(rows)

# %% [markdown]
# ## 8. Build every artefact the web app consumes
#
# This writes `pathway.json` (types, routes, bottlenecks, removal effects,
# sex mapping), `skeletons.json` (real EM-traced morphology, decimated) and
# `cloud.json` (a background soma cloud), all in one shared coordinate frame.

# %%
from sight_to_action.build import build_all

paths = build_all()
for name, path in paths.items():
    print(f"{name:10s} {path}")
