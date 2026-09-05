# From Sight to Action — methods and findings

A structural analysis of how visual information can travel through the adult
male *Drosophila* nervous system towards a neuron involved in locomotor
control.

---

## 1. Question

Which neurons form a structural route from the **R1–R6 photoreceptors** to
**DNg13**, a descending neuron of the locomotor control population — and how
does that route differ between the male and female connectomes?

## 2. Data

| Item | Source |
| --- | --- |
| Connectivity, annotations, neurotransmitter predictions | `gs://flyem-male-cns/v1.0/connectome-data/flat-connectome/` |
| Neuron skeletons (SWC) | `gs://flyem-male-cns/v1.0/segmentation/skeletons-malecns/skeletons-swc/` |
| Dataset | MaleCNS v1.0 (min. synapse confidence 0.5) |
| Producers | HHMI Janelia, Cambridge Drosophila Connectomics Group, Google Research and collaborators |
| Licence | CC-BY — <https://male-cns.janelia.org/download/> |

Both buckets are public and require no API token. Exact file names and sizes
are listed in the repository README; `notebooks/01_extract_pathway.ipynb`
reproduces every derived artefact from them.

## 3. Method

**Type-level graph.** Body-to-body connections (25.1 M edges with both
partners typed) are summed into a directed type-to-type graph. Edges below 20
total synapses are dropped, leaving 11,736 cell types and 583,744 edges.

**Relative weight.** Raw synapse counts favour large, highly-connected cell
types. Each edge therefore also carries a *relative weight*: the fraction of
the **target** type's total input arriving from that source. This asks "how
much of what this neuron hears comes from there?", which is the more
meaningful quantity for tracing a route.

**Route ranking.** A route's score is the product of the relative weights
along it. This is computed as a shortest path under the additive cost
`−log(relative weight)`, using Yen's k-shortest-paths. The search is
restricted to a *corridor* — types that can lie on a path of at most five
hops — which makes the search tractable without changing the results.

**Bottlenecks.** Each intermediate type is scored by how many of the ranked
alternative routes pass through it. A type on every route is a structural
bottleneck: without it, those routes do not exist.

**Removal experiment.** A type is deleted from the graph and the route search
re-run, reporting whether a route survives, how its strength changes and
whether it becomes longer.

**Skeletons.** SWC skeletons for representative cells of each type are
decimated for the browser. Roots, branch points and leaves are always kept,
so overall shape and topology are preserved; intermediate points along
unbranched runs are thinned.

## 4. Results

### 4.1 The route

Twelve routes of ≤5 hops were found. The pathway reconstructs the textbook
fly visual pathway **without that structure being imposed anywhere in the
search** — it falls out of measured connectivity alone:

```
R1–R6  →  L1 / L2 / L3        (lamina monopolar)
       →  Tm3 / Tm4 / Tm5c / Tm20 / Mi1   (medulla)
       →  LC10a / LC10c-1 / LC10d / LoVP92 / Y3   (lobula projection)
       →  AOTU002 / AOTU016 / VES200m / LoVP90b   (central brain)
       →  DNg13                (descending neuron)
```

The strongest single route is
**R1-R6 → L3 → Tm5c → LoVP92 → DNg13** (4 hops), with the strongest 5-hop
route running **R1-R6 → L1 → Tm3 → LC10a → AOTU002_b → DNg13**.

### 4.2 Bottlenecks

`L1` (7/12 routes), `Tm3` (6/12) and `LC10a` (5/12) carry the most
alternative routes. `LoVP92` and `AOTU002_b` each carry 4/12 and are the main
convergence points immediately before the descending neuron.

### 4.3 Neurotransmitters

Predicted neurotransmitters match established biology, which is a useful
sanity check on the data pipeline: R1–R6 are **histaminergic** (as
photoreceptors should be), L1 **glutamatergic**, and L2/L3 and most
downstream types **cholinergic**.

### 4.4 Male / female comparison

This is the most interesting result. Using the dataset's own cross-connectome
mappings (`flywireType`, `hemibrainType`) and `dimorphism` flags:

| Category | Types |
| --- | --- |
| Shared (matched female cell type) | R1-R6, L1, L2, L3, Tm3, Tm4, Tm5c, Tm20, Mi1, Y3, LC10a, LC10c-1, LC10d, LoVP90b, AOTU002_a/b/c, AOTU016_c |
| Male-specific | **LoVP92** |
| Potentially male-specific | VES200m |
| Sexually dimorphic | **DNg13** |

The early visual stages map cleanly onto female cell types, but the pathway
becomes sex-specific at its end: the top-ranked route passes through
**LoVP92, annotated male-specific**, and terminates on **DNg13, annotated
sexually dimorphic**. A directly equivalent route may therefore not exist in
the female connectome. Routes 2–4, which run through LC10a → AOTU002, use
only shared cell types up to the final dimorphic target.

### 4.5 Statistical context — the main result

A dense recurrent network connects nearly everything to nearly everything
within a few hops, so **"a path exists" is close to meaningless on its own**.
Three comparisons were run to try to falsify the route.

**Against other descending neurons.** Best route score from R1–R6 to every
descending neuron type, using a hop-limited Bellman–Ford relaxation so all
targets are scored in one pass. DNg13 ranks **312 of 480** — below median.
The top of that ranking is a useful check that the method works: it
independently surfaces DNc01, DNc02, DNp11, DNp04, DNp02 and **DNp01 (the
Giant Fiber)** — the descending neurons already known to be strongly visually
driven. DNp01 scores 5.5 × 10⁻⁴, roughly **140× stronger** than DNg13.

**Against other senses.** R1–R6 ranks **191 of 333** sensory types for
connection into DNg13. DNg13's strongest structural sensory inputs are not
visual at all — they are mechanosensory (SNpp10), gustatory (BM_Taste) and
olfactory (ORN_DA1), each two to three orders of magnitude stronger than the
photoreceptor route.

**Against shuffled connection strengths.** Keeping the wiring fixed but
permuting relative weights across edges, **70% of 50 shuffles** produced a
route at least as strong as the observed one (observed 3.95 × 10⁻⁶ vs
shuffled mean 1.49 × 10⁻⁵). *Caveat:* this null breaks the relationship
between a connection's strength and its position in the network, so it is a
deliberately harsh comparison rather than a definitive test.

**Interpretation.** The R1–R6 → DNg13 route is real, reproducible and stable,
but it is **not statistically special**. This does not contradict the
published finding that DNg13 is visually driven and steers locomotion — DNg13
may well receive its visual drive over routes this method scores poorly, or
via pathways whose relevance is functional rather than structural weight. What
it does show is that **path existence, and even "strongest path", are weak
evidence of a functional channel** — which is exactly the failure mode that
tools returning a path between any two neurons invite.

### 4.6 Robustness

The strongest route is unchanged at minimum-synapse thresholds of 10, 20 and
50, and at hop limits of 4 and 5. It changes only at a threshold of 100,
which deletes one of its own edges and forces a detour. So the result is not
an artefact of the threshold choice.

## 5. Evidence labelling

Every statement in the interactive application is tagged:

| Label | Meaning |
| --- | --- |
| **Directly mapped** | Read from the EM reconstruction — connectivity, synapse counts, cell counts, morphology |
| **Experimentally supported** | Published physiology/behaviour exists for this cell type (e.g. R1–R6, L1–L3, Mi1, Tm3, LC10a, DNg13) |
| **Computationally inferred** | A model output — notably the neurotransmitter predictions — or a role inferred from wiring alone |
| **Unknown** | The dataset does not answer it |

## 6. Limitations

- This is a **structural** analysis. It does not simulate neural activity and
  does not predict behaviour. A wiring route existing does not establish that
  a signal travels it, nor what the animal does.
- Routes are capped at five hops. Longer or recurrent routes exist and are
  not enumerated.
- The 20-synapse edge threshold and the ≤5-hop cap are analysis choices; both
  are parameters in `analysis.py` and can be varied.
- Only representative skeletons (up to two per cell type) are shown, chosen
  for clarity rather than as a morphological sample.
- Cross-connectome sex comparison relies on the mappings recorded in the
  MaleCNS annotations rather than on an independent re-analysis of the female
  datasets.

## 7. Reproducing

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# downloads ~560 MB of connectome tables on first run
jupyter nbconvert --to notebook --execute --inplace notebooks/01_extract_pathway.ipynb
```

That regenerates `data/processed/pathway.json`, `skeletons.json` and
`cloud.json`, which are the only inputs the web application needs.
