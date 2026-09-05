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

25 candidate cell types (20 ranked upstream-input candidates + LC4/LPLC2 +
DNp01 + TTMn/PSI), exported to
[data/processed/giant_fiber_pathway.json](data/processed/giant_fiber_pathway.json),
plus every pathway neuron's real 3D soma position (EM-reconstructed, not
simulated) in
[data/processed/giant_fiber_3d.json](data/processed/giant_fiber_3d.json).

**Interactive viewer:** [web/](web/) is a React + TypeScript app with two
linked views:

- **3D connectome** (Three.js / React Three Fiber) — a real point cloud of
  ~20k traced-neuron soma positions (giving a recognizable brain-shaped
  cloud) with the pathway neurons picked out by tier color. "Play signal"
  runs a short sequence: a looming-stimulus intro (what the fly's eye
  detects), a camera zoom into the circuit, the real neurons lighting up
  tier by tier in the order the signal actually reaches them, then a
  labeled outcome ("escape jump triggered") explicitly marked as the
  known behavioral result from prior physiology — not something simulated
  from the connectome itself.
- **Simplified circuit diagram** (Cytoscape.js) — a clean, directed,
  tier-colored diagram of the same pathway, with an adjustable "minimum
  synapse weight" slider (so which optic-lobe types count as "visual
  input" is a transparent, explorable threshold rather than a silently
  hard-coded cutoff) and click-to-inspect evidence cards (cell type,
  superclass, traced-body count — with a note when a low count reflects a
  known bilateral pair rather than incomplete tracing — predicted
  neurotransmitter, and explicit observed-vs-inferred framing).

Run it with:

```
npm install --prefix web
npm run dev --prefix web
```

Not yet implemented: real neuron *shapes* (dendrites/axons) in 3D — MaleCNS
ships full morphology only as sharded Neuroglancer precomputed meshes
(`gs://flyem-male-cns/v1.0/male-cns-meshes-transformed-to-fafb-flywire/`),
which need a dedicated decoder; the 3D view currently shows real soma
*positions* as points, not full arbors. Also still open for V0.2:
male/female comparison and the "remove this neuron" graph experiment.

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
