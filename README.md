# From Sight to Action

An interactive journey through the fruit-fly (male CNS connectome) nervous
system, showing how visual input reaches the neurons that control movement.

**Scientific question:** which neurons act as bridges between visual input
and descending movement-control neurons, and how does that circuit differ
between the male and female connectomes?

## Status

V0.1 pathway extracted: [notebooks/01_extract_giant_fiber_pathway.ipynb](notebooks/01_extract_giant_fiber_pathway.ipynb)
reproducibly pulls the **Giant Fiber visual escape circuit** out of the
[MaleCNS dataset](https://male-cns.janelia.org/download/) (Janelia,
CC-BY licensed) — a published, well-characterized pathway (von Reyn et
al. 2014/2017; Ache et al. 2019):

```
10 optic-lobe motion/feature detectors (T4/T5, Tm/T2/TmY family)
        -> LC4, LPLC2  (looming-sensitive visual projection neurons)
        -> DNp01       (the Giant Fiber, a descending neuron)
        -> TTMn, PSI   (jump motor neuron / flight-motor pathway)
```

15 cell types, 118 aggregated type-to-type connections, exported to
[data/processed/giant_fiber_pathway.json](data/processed/giant_fiber_pathway.json)
for the (not yet built) web front end. Next: the React + Cytoscape.js /
R3F interactive viewer, then the male/female comparison in V0.2.

## Data source

Flattened connectome tables, downloaded directly from the public bucket
`gs://flyem-male-cns/v1.0/connectome-data/flat-connectome/` (no API token
required):

- `body-annotations-*.feather` — cell type / class / sex per neuron ("body")
- `body-neurotransmitters-*.feather` — predicted neurotransmitter per neuron
- `connectome-weights-*-significant-only.feather` — directed, weighted
  connectivity edges between neurons

Raw files are gitignored (too large for the repo); `notebooks/` documents
how to re-download them.

## Project structure

```
data/raw/          downloaded Feather files (gitignored)
data/processed/     derived JSON/graph files for the web app (small, committed)
notebooks/          reproducible analysis notebooks
src/sight_to_action/ shared Python package (data loading, graph analysis)
web/                 React + Three.js/R3F + Cytoscape.js interactive front end
docs/                methods/results write-up
```

## Roadmap

- **V0.1** — one guided visual→movement pathway, ~10–30 cell types, real
  neuron skeletons, animated signal progression, evidence cards, one
  reproducible notebook.
- **V0.2** — male/female comparison, connection-strength threshold,
  "remove this neuron" graph experiment (structural, not a behavior
  prediction), alternative-route detection.
- **V0.3** — natural-language question → controlled graph query → visualized
  result, explained but always tied to the underlying data.
