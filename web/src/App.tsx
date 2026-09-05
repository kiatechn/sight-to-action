import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import BrainScene from "./BrainScene";
import CircuitPanel from "./CircuitPanel";
import JourneyPanel from "./JourneyPanel";
import AnalysisPanel from "./AnalysisPanel";
import SexPanel from "./SexPanel";
import ContextPanel from "./ContextPanel";
import NeuronDetail from "./NeuronDetail";
import type { CloudData, PathwayData, SkeletonData } from "./types";
import { STAGE_COLORS } from "./types";

type Tab = "journey" | "circuit" | "analysis" | "context" | "sex";
const STEP_MS = 2200;

export default function App() {
  const [data, setData] = useState<PathwayData | null>(null);
  const [skeletons, setSkeletons] = useState<SkeletonData | null>(null);
  const [cloud, setCloud] = useState<CloudData | null>(null);

  const [tab, setTab] = useState<Tab>("journey");
  const [activeStage, setActiveStage] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [removedType, setRemovedType] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/data/pathway.json").then((r) => r.json()),
      fetch("/data/skeletons.json").then((r) => r.json()),
      fetch("/data/cloud.json").then((r) => r.json()),
    ]).then(([p, s, c]) => {
      setData(p);
      setSkeletons(s);
      setCloud(c);
    });
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const stages = useMemo(
    () => (data ? [...new Set(data.nodes.map((n) => n.stage))].sort((a, b) => a - b) : []),
    [data],
  );

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function play() {
    if (!stages.length) return;
    clearTimers();
    setSelectedType(null);
    setPlaying(true);
    setActiveStage(stages[0]);
    stages.forEach((s, i) => {
      if (i === 0) return;
      timers.current.push(setTimeout(() => setActiveStage(s), i * STEP_MS));
    });
    timers.current.push(
      setTimeout(() => setPlaying(false), stages.length * STEP_MS),
    );
  }

  function goToStage(s: number) {
    clearTimers();
    setPlaying(false);
    setSelectedType(null);
    setActiveStage(s);
  }

  const hiddenTypes = useMemo(
    () => new Set(removedType ? [removedType] : []),
    [removedType],
  );

  if (!data || !skeletons || !cloud) {
    return <div className="loading">Loading connectome…</div>;
  }

  const selectedNode = data.nodes.find((n) => n.type === selectedType) ?? null;
  const stageNodes = activeStage >= 0 ? data.nodes.filter((n) => n.stage === activeStage) : [];

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-main">
          <h1>From Sight to Action</h1>
          <p className="tagline">
            A structural route through the <em>Drosophila</em> connectome, from the R1–R6
            photoreceptors to <strong>DNg13</strong>, a descending neuron of the locomotor
            control population.
          </p>
        </div>
        <div className="masthead-meta">
          <a href={data.meta.dataUrl} target="_blank" rel="noreferrer" className="source-chip">
            {data.meta.dataset}
          </a>
          <span className="disclaimer">Structural wiring only — not a simulation of activity</span>
        </div>
      </header>

      <main className="workspace">
        <section className="viewer">
          <BrainScene
            nodes={data.nodes}
            skeletons={skeletons}
            cloud={cloud}
            activeStage={activeStage}
            selectedType={selectedType}
            onSelectType={setSelectedType}
            hiddenTypes={hiddenTypes}
          />

          <div className="viewer-legend">
            {stages.map((s) => {
              const name = data.nodes.find((n) => n.stage === s)?.stageName ?? `Stage ${s}`;
              const on = activeStage < 0 || activeStage >= s;
              return (
                <button
                  key={s}
                  className={`legend-item ${activeStage === s ? "current" : ""} ${on ? "" : "off"}`}
                  onClick={() => goToStage(activeStage === s ? -1 : s)}
                >
                  <span className="legend-swatch" style={{ background: STAGE_COLORS[s] }} />
                  {name}
                </button>
              );
            })}
          </div>

          {activeStage >= 0 && (
            <div className="stage-banner">
              <span className="stage-index" style={{ background: STAGE_COLORS[activeStage] }}>
                {activeStage}
              </span>
              <div>
                <strong>{stageNodes[0]?.stageName}</strong>
                <span className="muted"> — {stageNodes.map((n) => n.type).join(", ")}</span>
              </div>
            </div>
          )}

          <div className="viewer-hint">Drag to rotate · scroll to zoom · click a neuron</div>

          {removedType && (
            <div className="removed-banner">
              <strong>{removedType}</strong> removed from the graph (structural experiment)
              <button className="ghost-button" onClick={() => setRemovedType(null)}>
                Restore
              </button>
            </div>
          )}
        </section>

        <aside className="sidebar">
          <nav className="tabs">
            {(
              [
                ["journey", "Journey"],
                ["circuit", "Circuit"],
                ["analysis", "Routes"],
                ["context", "Context"],
                ["sex", "Sex"],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                className={`tab ${tab === id ? "active" : ""}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="tab-body">
            {tab === "journey" && (
              <JourneyPanel
                data={data}
                stages={stages}
                activeStage={activeStage}
                playing={playing}
                onStage={goToStage}
                onPlay={play}
                onSelectType={setSelectedType}
              />
            )}
            {tab === "circuit" && (
              <CircuitPanel
                data={data}
                activeStage={activeStage}
                selectedType={selectedType}
                onSelectType={setSelectedType}
                hiddenTypes={hiddenTypes}
              />
            )}
            {tab === "analysis" && (
              <AnalysisPanel
                data={data}
                onSelectType={setSelectedType}
                removedType={removedType}
                onRemoveType={setRemovedType}
              />
            )}
            {tab === "context" && <ContextPanel data={data} onSelectType={setSelectedType} />}
            {tab === "sex" && <SexPanel data={data} onSelectType={setSelectedType} />}
          </div>

          {selectedNode && (
            <div className="detail-dock">
              <NeuronDetail
                node={selectedNode}
                data={data}
                onClose={() => setSelectedType(null)}
              />
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
