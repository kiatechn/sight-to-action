import { useEffect, useState } from "react";
import "./App.css";
import PathwayGraph from "./PathwayGraph";
import EvidencePanel from "./EvidencePanel";
import type { PathwayData } from "./types";
import { TIER_LABELS, TIER_COLORS } from "./types";

export default function App() {
  const [data, setData] = useState<PathwayData | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [playSignal, setPlaySignal] = useState(0);

  useEffect(() => {
    fetch("/data/giant_fiber_pathway.json")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <div className="loading">Loading connectome data…</div>;

  const selectedNode = data.nodes.find((n) => n.type === selectedType) ?? null;
  const tiers = [...new Set(data.nodes.map((n) => n.tier))].sort();

  return (
    <div className="app">
      <header className="app-header">
        <h1>From Sight to Action</h1>
        <p className="subtitle">{data.meta.description}</p>
        <div className="header-controls">
          <button className="play-button" onClick={() => setPlaySignal((s) => s + 1)}>
            ▶ Play signal
          </button>
          <span className="dataset-tag">{data.meta.dataset} · MaleCNS connectome</span>
        </div>
      </header>

      <div className="app-body">
        <aside className="legend">
          <h3>Pathway stages</h3>
          <ul>
            {tiers.map((t) => (
              <li key={t}>
                <span className="swatch" style={{ background: TIER_COLORS[t] }} />
                {TIER_LABELS[t]}
              </li>
            ))}
          </ul>
          <p className="legend-note">
            Edge thickness = relative synapse weight. Only forward
            (earlier-stage → later-stage) connections are drawn; the optic
            lobe also has extensive same-stage recurrent connectivity, left
            out here for readability.
          </p>
          <p className="legend-note legend-note--muted">
            Male/female comparison and the "remove this neuron" graph
            experiment are planned for V0.2 — this view uses the MaleCNS
            dataset only.
          </p>
        </aside>

        <main className="graph-container">
          <PathwayGraph data={data} onSelectType={setSelectedType} playSignal={playSignal} />
        </main>

        <EvidencePanel node={selectedNode} />
      </div>
    </div>
  );
}
