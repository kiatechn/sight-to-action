import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import BrainScene from "./BrainScene";
import CircuitPanel from "./CircuitPanel";
import JourneyPanel from "./JourneyPanel";
import AnalysisPanel from "./AnalysisPanel";
import SexPanel from "./SexPanel";
import ContextPanel from "./ContextPanel";
import ExplorePanel from "./ExplorePanel";
import NeuronDetail from "./NeuronDetail";
import type { CloudData, PathwayData, SkeletonData, SomaData } from "./types";
import { STAGE_COLORS } from "./types";

type Tab = "journey" | "circuit" | "analysis" | "context" | "explore" | "sex";
const STEP_MS = 2200;

export default function App() {
  const [data, setData] = useState<PathwayData | null>(null);
  const [skeletons, setSkeletons] = useState<SkeletonData | null>(null);
  const [cloud, setCloud] = useState<CloudData | null>(null);
  const [soma, setSoma] = useState<SomaData | null>(null);
  const [femaleCloud, setFemaleCloud] = useState<CloudData | null>(null);
  const [femaleSoma, setFemaleSoma] = useState<SomaData | null>(null);
  const [brain, setBrain] = useState<"male" | "female">("male");

  // Width of the information column. Some panels are dense — the route
  // tables and the sex comparison especially — so it can be dragged wider.
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(localStorage.getItem("sta:sidebarWidth"));
    return saved >= 320 && saved <= 760 ? saved : 400;
  });
  const dragging = useRef(false);

  useEffect(() => {
    function move(e: PointerEvent) {
      if (!dragging.current) return;
      // measured from the right edge, since the column is on the right
      const next = Math.min(760, Math.max(320, window.innerWidth - e.clientX));
      setSidebarWidth(next);
    }
    function up() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem("sta:sidebarWidth", String(sidebarWidth));
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [sidebarWidth]);

  // an explored route drawn over the 3D view, with its own playback position
  const [overlayRoute, setOverlayRoute] = useState<string[] | null>(null);
  const [overlayStep, setOverlayStep] = useState(-1);

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
      fetch("/data/soma.json").then((r) => r.json()),
    ]).then(([p, s, c, so]) => {
      setData(p);
      setSkeletons(s);
      setCloud(c);
      setSoma(so);
    });
    // female brain is optional — absent unless the FlyWire build step ran
    Promise.all([
      fetch("/data/female_cloud.json").then((r) => (r.ok ? r.json() : null)),
      fetch("/data/female_soma.json").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([c, s]) => {
        setFemaleCloud(c);
        setFemaleSoma(s);
      })
      .catch(() => {});
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

  function showRoute(route: string[] | null, which: "male" | "female" = "male") {
    clearTimers();
    setPlaying(false);
    setActiveStage(-1);
    if (route) setBrain(which);
    setOverlayRoute(route);
    setOverlayStep(-1);
  }

  /** Step along an arbitrary route one neuron at a time, like the Journey. */
  function playRoute(route: string[], which: "male" | "female" = "male") {
    clearTimers();
    setBrain(which);
    setPlaying(true);
    setActiveStage(-1);
    setSelectedType(null);
    setOverlayRoute(route);
    setOverlayStep(0);
    route.forEach((_, i) => {
      if (i === 0) return;
      timers.current.push(setTimeout(() => setOverlayStep(i), i * 1100));
    });
    timers.current.push(setTimeout(() => setPlaying(false), route.length * 1100));
  }

  function goToStage(s: number) {
    clearTimers();
    setPlaying(false);
    setSelectedType(null);
    setOverlayRoute(null);
    setOverlayStep(-1);
    setActiveStage(s);
  }

  const hiddenTypes = useMemo(
    () => new Set(removedType ? [removedType] : []),
    [removedType],
  );

  const pathwayTypeSet = useMemo(
    () => new Set((data?.nodes ?? []).map((n) => n.type)),
    [data],
  );

  if (!data || !skeletons || !cloud || !soma) {
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
            soma={brain === "female" && femaleSoma ? femaleSoma : soma}
            cloudOverride={brain === "female" ? femaleCloud : null}
            overlayRoute={overlayRoute}
            overlayStep={overlayStep}
            brain={brain}
          />

          {femaleCloud && (
            <div className="brain-switch">
              <button
                className={brain === "male" ? "on" : ""}
                onClick={() => setBrain("male")}
              >
                ♂ Male
              </button>
              <button
                className={brain === "female" ? "on" : ""}
                onClick={() => setBrain("female")}
              >
                ♀ Female
              </button>
            </div>
          )}

          {brain === "female" && (
            <div className="brain-note">
              Female brain (FlyWire). Soma positions only — no traced morphology in this
              dataset — and brain only, so there is no nerve cord.
            </div>
          )}

          <div className="viewer-legend" hidden={brain === "female"}>
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

          {overlayRoute && (
            <div className="route-banner">
              <span className="mono">{overlayRoute.join(" → ")}</span>
              <button className="ghost-button" onClick={() => showRoute(null)}>
                Clear
              </button>
            </div>
          )}

          {removedType && (
            <div className="removed-banner">
              <strong>{removedType}</strong> removed from the graph (structural experiment)
              <button className="ghost-button" onClick={() => setRemovedType(null)}>
                Restore
              </button>
            </div>
          )}
        </section>

        <div
          className="resizer"
          role="separator"
          aria-label="Resize information panel"
          aria-orientation="vertical"
          title="Drag to resize · double-click to reset"
          onPointerDown={() => {
            dragging.current = true;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
          onDoubleClick={() => {
            setSidebarWidth(400);
            localStorage.setItem("sta:sidebarWidth", "400");
          }}
        />

        <aside className="sidebar" style={{ flexBasis: sidebarWidth }}>
          <nav className="tabs">
            {(
              [
                ["journey", "Journey"],
                ["circuit", "Circuit"],
                ["analysis", "Routes"],
                ["context", "Context"],
                ["explore", "Explore"],
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
                onShowRoute={showRoute}
                onPlayRoute={playRoute}
                activeRoute={overlayRoute}
              />
            )}
            {tab === "context" && <ContextPanel data={data} onSelectType={setSelectedType} />}
            {tab === "explore" && (
              <ExplorePanel
                onSelectType={setSelectedType}
                pathwayTypes={pathwayTypeSet}
                onShowRoute={showRoute}
                onPlayRoute={playRoute}
                activeRoute={overlayRoute}
                playing={playing}
              />
            )}
            {tab === "sex" && (
              <SexPanel
                data={data}
                onSelectType={setSelectedType}
                onShowRoute={showRoute}
              />
            )}
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
