# From Sight to Action

**An interactive explorer of the *Drosophila* visual–motor connectome.**

How can visual information travel through the fruit-fly nervous system towards
neurons involved in movement control? This project traces one structural
pathway — from the **R1–R6 photoreceptors** to **DNg13**, a descending neuron
of the locomotor control population — through the open
[MaleCNS connectome](https://male-cns.janelia.org/download/), and presents it
as interactive 3D neuron reconstructions, a weighted connectivity graph and
evidence-linked information about every neuron.

> Everything shown is a **structural** account of wiring: which neurons
> connect to which, and how strongly. It does not simulate neural firing and
> does not predict behaviour.

---

## What's in the app

| View | What it does |
| --- | --- |
| **3D connectome** | Real EM-traced neuron skeletons, coloured by pathway stage, inside a soma point-cloud of the whole CNS. Click a neuron to inspect it. |
| **Journey** | A step-by-step animated walk from retina → lamina → medulla → lobula → central brain → descending neuron, with the 3D view following along. |
| **Circuit** | A simplified weighted graph of the pathway; arrow thickness is the fraction of the target's input supplied by that source. |
| **Routes** | Ranked alternative routes, path lengths, bottleneck neurons, and a node-removal experiment showing how structural routes change. |
| **Explore** | Pick any of 30 senses and any of 480 movement neurons and get the real route, its strength, and how it ranks — so the statistical argument can be tested rather than taken on trust. |
| **Context** | Whether the route is stronger than chance: rank against all descending neurons, against all sensory modalities, against weight-shuffled graphs, plus a threshold-robustness sweep. |
| **Sex** | Each neuron classified as shared, sex-specific or sexually dimorphic using the dataset's cross-connectome mappings. |
| **Neuron detail** | Cell type, class, connection strengths, predicted neurotransmitter, sex status, and an evidence label on every claim, with links to neuPrint. |

## Headline finding

Existing connectome explorers will return a path between almost any two
neurons, because a dense recurrent network links nearly everything within a
few hops. **So "a path exists" is weak evidence — and this project measures
how weak.**

The R1–R6 → DNg13 route is real, reproducible and stable across thresholds.
It also turns out **not to be statistically special**:

- DNg13 ranks **312 of 480** descending neurons for connection strength from
  the photoreceptors.
- R1–R6 ranks **191 of 333** sensory types into DNg13 — whose strongest
  structural sensory inputs are mechanosensory, gustatory and olfactory, not
  visual.
- **70% of weight-shuffled** versions of the same graph produce a route at
  least as strong.

The same ranking independently surfaces **DNp01 (the Giant Fiber)** and the
other known visually-driven descending neurons at the top — about 140×
stronger than DNg13 — which is a useful check that the method works.

Along the way the pathway also proves not to be sex-neutral: the top route
passes through **LoVP92 (male-specific)** and ends on **DNg13 (sexually
dimorphic)**.

Full write-up: [docs/methods-and-findings.md](docs/methods-and-findings.md).

## Run it

```bash
npm install --prefix web
npm run dev --prefix web
```

Then open <http://localhost:5173>. The app reads three small pre-computed
JSON files, so it needs no backend.

## Reproduce the analysis

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Download the connectome tables (~560 MB, public, no API token):

```bash
BASE=https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome
curl -o data/raw/body-annotations-male-cns-v1.0-minconf-0.5.feather $BASE/body-annotations-male-cns-v1.0-minconf-0.5.feather
curl -o data/raw/body-neurotransmitters-male-cns-v1.0.feather $BASE/body-neurotransmitters-male-cns-v1.0.feather
curl -o data/raw/connectome-weights-male-cns-v1.0-minconf-0.5-significant-only.feather $BASE/connectome-weights-male-cns-v1.0-minconf-0.5-significant-only.feather
```

Then run the notebook, which regenerates every file the app consumes
(skeletons are fetched from the public bucket on first run and cached):

```bash
jupyter nbconvert --to notebook --execute --inplace notebooks/01_extract_pathway.ipynb
cp data/processed/*.json web/public/data/
```

## Repository layout

```
src/sight_to_action/
  data.py        loaders for the MaleCNS flat tables
  analysis.py    type-level graph, route ranking, bottlenecks, removal experiment
  nulls.py       null models: rank vs other DNs/senses, weight-shuffled graphs
  explorer.py    precomputes every sense -> every descending neuron for the app
  pipeline.py    assembles the pathway dataset (evidence + sex labels)
  skeletons.py   SWC download, parsing and decimation
  build.py       one reproducible build of every artefact
notebooks/       the analysis, executed with outputs
web/             React + Three.js (R3F) + Cytoscape.js application
docs/            methods and findings write-up
data/processed/  small derived JSON consumed by the app (committed)
data/raw/        downloaded connectome tables and skeletons (gitignored)
```

## Method in one paragraph

Body-to-body connectivity is collapsed to a type-level directed graph. Each
edge carries the total synapse count **and** a relative weight — the fraction
of the target type's input coming from that source — so that routes are not
dominated by simply large cell types. Routes are ranked by the product of
relative weights along the path (a shortest path under `−log` cost), searched
within a corridor of types that can lie on a ≤5-hop path. Bottlenecks are
types shared by many alternative routes; the removal experiment deletes a
type and re-runs the search.

## Data and licence

MaleCNS v1.0, CC-BY, produced by HHMI Janelia, the Cambridge Drosophila
Connectomics Group, Google Research and collaborators —
<https://male-cns.janelia.org/download/>.

## Status

- [x] Validated R1–R6 → DNg13 pathway extracted from real connectivity
- [x] Interactive 3D EM-traced neuron skeletons
- [x] Animated step-by-step journey through the pathway
- [x] Route ranking, path lengths, alternative routes, bottleneck analysis
- [x] Structural node-removal experiment
- [x] Male/female comparison via cross-connectome mappings
- [x] Statistical null models and threshold-robustness analysis
- [x] Interactive explorer over all 30 senses x 480 descending neurons
- [x] Four-level evidence labelling with links to source data
- [x] Reproducible notebook, documented provenance, methods write-up
- [ ] Public deployment
- [ ] Short demonstration video
