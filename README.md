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
| **Analysis** | Ranked alternative routes, path lengths, bottleneck neurons, and a node-removal experiment showing how structural routes change. |
| **Male / female** | Each neuron classified as shared, sex-specific or sexually dimorphic using the dataset's cross-connectome mappings. |
| **Neuron detail** | Cell type, class, connection strengths, predicted neurotransmitter, sex status, and an evidence label on every claim, with links to neuPrint. |

## Headline finding

The route recapitulates the textbook fly visual pathway **without that
structure being imposed on the search** — and it is not sex-neutral. The
top-ranked route passes through **LoVP92 (male-specific)** and terminates on
**DNg13 (sexually dimorphic)**, so a directly equivalent route may not exist
in the female connectome, even though the early visual stages map cleanly
onto female cell types.

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
- [x] Four-level evidence labelling with links to source data
- [x] Reproducible notebook, documented provenance, methods write-up
- [ ] Public deployment
- [ ] Short demonstration video
