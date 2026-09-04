# From Sight to Action

An interactive journey through the fruit-fly (male CNS connectome) nervous
system, showing how visual input reaches the neurons that control movement.

**Scientific question:** which neurons act as bridges between visual input
and descending movement-control neurons, and how does that circuit differ
between the male and female connectomes?

## Status

V0.1 in progress: extracting and validating one real visual-input →
descending-neuron pathway from the [MaleCNS dataset](https://male-cns.janelia.org/download/)
(Janelia, CC-BY licensed).

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
