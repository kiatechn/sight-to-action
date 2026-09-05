import { useState } from "react";
import type { PathwayData } from "./types";

interface Props {
  data: PathwayData;
  onSelectType: (t: string) => void;
  removedType: string | null;
  onRemoveType: (t: string | null) => void;
  onShowRoute: (route: string[] | null) => void;
  onPlayRoute: (route: string[]) => void;
  activeRoute: string[] | null;
}

export default function AnalysisPanel({
  data,
  onSelectType,
  removedType,
  onRemoveType,
  onShowRoute,
  onPlayRoute,
  activeRoute,
}: Props) {
  const [showAllRoutes, setShowAllRoutes] = useState(false);
  const routes = showAllRoutes ? data.routes : data.routes.slice(0, 5);
  const removal = removedType ? data.removals[removedType] : null;

  const hopCounts = data.routes.reduce<Record<number, number>>((acc, r) => {
    acc[r.hops] = (acc[r.hops] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="panel-scroll">
      <section className="detail-block">
        <h4>How routes are ranked</h4>
        <p className="small muted">{data.meta.method}</p>
      </section>

      <section className="detail-block">
        <h4>Routes ({data.routes.length} found)</h4>
        <p className="small muted">
          The <strong>primary route</strong> is the strongest by relative synaptic weight.
          The rest are genuine alternatives through different intermediate neurons — click any
          one to draw it in the 3D view, or play it neuron by neuron.
        </p>
        <p className="small muted">
          Path lengths: {Object.entries(hopCounts).map(([h, c]) => `${c}×${h} hops`).join(", ")}
        </p>
        <div className="route-list">
          {routes.map((r, i) => {
            const isActive =
              activeRoute?.length === r.nodes.length &&
              activeRoute.every((n, k) => n === r.nodes[k]);
            return (
              <div className={`route ${i === 0 ? "primary" : ""} ${isActive ? "on" : ""}`} key={i}>
                <div className="route-rank">{i === 0 ? "★" : `#${i + 1}`}</div>
                <div className="route-body">
                  {i === 0 && <div className="route-tag">Primary route</div>}
                  <div className="route-chain">
                    {r.nodes.map((n, j) => (
                      <span key={n}>
                        {j > 0 && <span className="arrow">→</span>}
                        <button className="chip" onClick={() => onSelectType(n)}>
                          {n}
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="small muted">
                    {r.hops} hops · {r.total_synapses.toLocaleString()} synapses · weakest link{" "}
                    {(r.min_relative_weight * 100).toFixed(2)}% of target input
                  </div>
                  <div className="route-actions">
                    <button
                      className="ghost-button"
                      onClick={() => onShowRoute(isActive ? null : r.nodes)}
                    >
                      {isActive ? "Hide in 3D" : "Show in 3D"}
                    </button>
                    <button className="ghost-button" onClick={() => onPlayRoute(r.nodes)}>
                      ▶ Play
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {data.routes.length > 5 && (
          <button className="ghost-button" onClick={() => setShowAllRoutes((s) => !s)}>
            {showAllRoutes ? "Show top 5 only" : `Show all ${data.routes.length}`}
          </button>
        )}
      </section>

      <section className="detail-block">
        <h4>Bottleneck neurons</h4>
        <p className="small muted">
          Cell types appearing in the most alternative routes. A type on every route is a
          structural bottleneck: without it, those wiring routes do not exist.
        </p>
        {data.bottlenecks.slice(0, 8).map((b) => (
          <div className="bar-row" key={b.type}>
            <button className="chip" onClick={() => onSelectType(b.type)}>
              {b.type}
            </button>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${b.fraction_of_routes * 100}%` }} />
            </div>
            <span className="small muted">
              {b.n_routes}/{data.routes.length}
            </span>
          </div>
        ))}
      </section>

      <section className="detail-block">
        <h4>Remove a neuron (structural experiment)</h4>
        <p className="small warn">
          This deletes a cell type from the <em>graph</em> and re-runs the route search. It shows
          how the available wiring routes change. It is <strong>not</strong> a simulation of
          neural activity and <strong>not</strong> a prediction of behaviour.
        </p>
        <select
          value={removedType ?? ""}
          onChange={(e) => onRemoveType(e.target.value || null)}
        >
          <option value="">— nothing removed —</option>
          {Object.keys(data.removals).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {removal && (
          <div className="removal-result">
            <div className={`removal-status ${removal.still_connected ? "ok" : "cut"}`}>
              {removal.still_connected
                ? "Route still exists via a different path"
                : `No route from ${data.meta.source} to ${data.meta.target} within the hop limit`}
            </div>
            <div className="small">
              <div className="conn-head">Strongest route before</div>
              <div className="mono">{removal.best_before?.join(" → ") ?? "—"}</div>
              <div className="conn-head">Strongest route after</div>
              <div className="mono">{removal.best_after?.join(" → ") ?? "— none —"}</div>
            </div>
            {removal.still_connected && (
              <div className="small muted">
                Route strength changes from {removal.score_before.toExponential(2)} to{" "}
                {removal.score_after.toExponential(2)} (
                {removal.score_before > 0
                  ? `${((removal.score_after / removal.score_before - 1) * 100).toFixed(0)}%`
                  : "—"}
                ), {removal.hops_before} → {removal.hops_after} hops.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
