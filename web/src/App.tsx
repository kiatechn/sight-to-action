import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import PathwayGraph from "./PathwayGraph";
import EvidencePanel from "./EvidencePanel";
import BrainScene from "./BrainScene";
import SignalOverlay from "./SignalOverlay";
import type { PathwayData, Scene3DData } from "./types";
import { TIER_LABELS, TIER_COLORS } from "./types";

type Phase = "idle" | "intro" | "signal" | "outcome";

const TIER_COUNT = 4;
const INTRO_MS = 1400;
const STEP_MS = 900;
const HOLD_MS = 1200;
const OUTCOME_MS = 3200;

export default function App() {
  const [data, setData] = useState<PathwayData | null>(null);
  const [scene3d, setScene3d] = useState<Scene3DData | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [activeUpTo, setActiveUpTo] = useState(-1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const inputWeights = useMemo(
    () => (data ? data.nodes.filter((n) => n.input_weight != null).map((n) => n.input_weight!) : []),
    [data],
  );
  const [threshold, setThreshold] = useState<number | null>(null);

  useEffect(() => {
    fetch("/data/giant_fiber_pathway.json")
      .then((r) => r.json())
      .then(setData);
    fetch("/data/giant_fiber_3d.json")
      .then((r) => r.json())
      .then(setScene3d);
  }, []);

  useEffect(() => {
    if (threshold === null && inputWeights.length) {
      // Default to showing only the top 10 candidates (a readable starting
      // diagram) — the slider still goes all the way down to reveal all 20.
      const sorted = [...inputWeights].sort((a, b) => b - a);
      setThreshold(sorted[Math.min(9, sorted.length - 1)]);
    }
  }, [inputWeights, threshold]);

  const visibleTypes = useMemo(() => {
    if (!data) return new Set<string>();
    const set = new Set<string>();
    for (const n of data.nodes) {
      if (n.input_weight == null || threshold === null || n.input_weight >= threshold) {
        set.add(n.type);
      }
    }
    return set;
  }, [data, threshold]);

  function play() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase("intro");
    setActiveUpTo(-1);

    timers.current.push(setTimeout(() => setPhase("signal"), INTRO_MS));
    for (let tier = 0; tier < TIER_COUNT; tier++) {
      timers.current.push(setTimeout(() => setActiveUpTo(tier), INTRO_MS + tier * STEP_MS));
    }
    const outcomeAt = INTRO_MS + (TIER_COUNT - 1) * STEP_MS + HOLD_MS;
    timers.current.push(setTimeout(() => setPhase("outcome"), outcomeAt));
    timers.current.push(
      setTimeout(() => {
        setPhase("idle");
        setActiveUpTo(-1);
      }, outcomeAt + OUTCOME_MS),
    );
  }

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  if (!data || !scene3d) return <div className="loading">Loading connectome data…</div>;

  const selectedNode = data.nodes.find((n) => n.type === selectedType) ?? null;
  const tiers = [...new Set(data.nodes.map((n) => n.tier))].sort();
  const minW = inputWeights.length ? Math.min(...inputWeights) : 0;
  const maxW = inputWeights.length ? Math.max(...inputWeights) : 1;
  const hiddenCount = data.nodes.filter((n) => n.tier === 0 && !visibleTypes.has(n.type)).length;

  return (
    <div className="app">
      <header className="app-header">
        <h1>From Sight to Action</h1>
        <p className="subtitle">{data.meta.description}</p>
        <div className="header-controls">
          <button className="play-button" onClick={play} disabled={phase !== "idle"}>
            ▶ Play signal
          </button>
          <span className="dataset-tag">{data.meta.dataset} · MaleCNS connectome</span>
        </div>
      </header>

      <div className="app-body">
        <section className="scene-panel">
          <div className="scene-caption">
            <strong>3D connectome</strong> — real soma positions from the EM reconstruction.
            Dots light up in the order the signal actually reaches them.
          </div>
          <BrainScene scene={scene3d} visibleTypes={visibleTypes} activeUpTo={activeUpTo} phase={phase} />
          <SignalOverlay phase={phase} />
        </section>

        <aside className="side-panel">
          <div className="side-panel-block network-block">
            <div className="side-panel-heading">
              <h3>Simplified circuit diagram</h3>
              <p className="side-panel-sub">Click a neuron for details. Arrows show real synaptic direction.</p>
            </div>
            <div className="threshold-control">
              <label htmlFor="threshold">
                Minimum synapse weight for "visual input" neurons: <strong>{threshold ?? minW}</strong>
                {hiddenCount > 0 && <span className="threshold-hidden"> ({hiddenCount} hidden)</span>}
              </label>
              <input
                id="threshold"
                type="range"
                min={minW}
                max={maxW}
                step={100}
                value={threshold ?? minW}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
              <p className="threshold-help">
                These 20 candidate types are ranked by how strongly they synapse onto LC4/LPLC2 —
                raise the slider to see only the very strongest inputs, exactly as the connectome
                measures them.
              </p>
            </div>
            <div className="legend">
              <ul>
                {tiers.map((t) => (
                  <li key={t}>
                    <span className="swatch" style={{ background: TIER_COLORS[t] }} />
                    {TIER_LABELS[t]}
                  </li>
                ))}
              </ul>
            </div>
            <div className="graph-container">
              <PathwayGraph
                data={data}
                visibleTypes={visibleTypes}
                onSelectType={setSelectedType}
                activeUpTo={activeUpTo}
              />
            </div>
          </div>

          <div className="side-panel-block evidence-block">
            <EvidencePanel node={selectedNode} />
          </div>
        </aside>
      </div>
    </div>
  );
}
