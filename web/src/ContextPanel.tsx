import type { PathwayData } from "./types";

interface Props {
  data: PathwayData;
  onSelectType: (t: string) => void;
}

function pct(x: number) {
  return `${(x * 100).toFixed(0)}%`;
}

export default function ContextPanel({ data, onSelectType }: Props) {
  const ctx = data.context;
  if (!ctx) return <div className="panel-scroll">No context computed.</div>;
  const n = ctx.nulls;
  const source = data.meta.source;
  const target = data.meta.target;

  const beatsShuffle = n.shuffled_better_fraction < 0.05;
  const pathwayTypes = new Set(data.nodes.map((d) => d.type));

  return (
    <div className="panel-scroll">
      <section className="detail-block">
        <h4>Is this route actually special?</h4>
        <p className="small muted">
          Connectome explorers will return a path between almost any two neurons, because a
          dense recurrent network links nearly everything within a few hops. So "a path
          exists" is weak evidence. These are three attempts to falsify the route.
        </p>
      </section>

      <section className={`detail-block ${beatsShuffle ? "" : "highlight-warn"}`}>
        <h4>Verdict</h4>
        <p className="small">
          The {source} → {target} route is <strong>not statistically special</strong> by these
          measures. It exists and it is the strongest route between these two cell types, but
          it sits below the median on every comparison below.
        </p>
        <p className="small muted">
          That is a real result, not a failure: it shows why path-existence alone should not
          be read as evidence of a functional channel.
        </p>
      </section>

      <section className="detail-block">
        <h4>1 · Compared with other descending neurons</h4>
        <p className="small">
          Ranked <strong>{n.target_rank} of {n.target_pool}</strong> descending neuron types
          for connection strength from {source}.
        </p>
        <div className="rank-bar">
          <div
            className="rank-marker"
            style={{ left: `${((n.target_rank ?? 0) / n.target_pool) * 100}%` }}
          />
        </div>
        <p className="small muted">
          Best-connected descending neurons from {source} — the method independently ranks the
          known visual escape and looming neurons at the top, which is a useful check that it
          works:
        </p>
        <div className="lead-list">
          {ctx.topDescendingFromSource.slice(0, 8).map((r) => (
            <div className="lead-row" key={r.type}>
              <button
                className="chip"
                onClick={() => pathwayTypes.has(r.type) && onSelectType(r.type)}
              >
                {r.type}
              </button>
              <span className="mono muted">{r.score.toExponential(2)}</span>
            </div>
          ))}
          <div className="lead-row current">
            <span className="chip">{target}</span>
            <span className="mono">{n.observed_score.toExponential(2)}</span>
          </div>
        </div>
      </section>

      <section className="detail-block">
        <h4>2 · Compared with other senses</h4>
        <p className="small">
          {source} ranks <strong>{n.source_rank} of {n.source_pool}</strong> sensory cell types
          for connection strength into {target}.
        </p>
        <p className="small muted">
          {target}'s strongest structural sensory inputs are not visual at all — they are
          mechanosensory, gustatory and olfactory:
        </p>
        <div className="lead-list">
          {ctx.topSensoryToTarget.slice(0, 6).map((r) => (
            <div className="lead-row" key={r.type}>
              <span className="chip">{r.type}</span>
              <span className="mono muted">{r.score.toExponential(2)}</span>
            </div>
          ))}
          <div className="lead-row current">
            <span className="chip">{source}</span>
            <span className="mono">{n.observed_score.toExponential(2)}</span>
          </div>
        </div>
      </section>

      <section className="detail-block">
        <h4>3 · Compared with shuffled wiring strengths</h4>
        <p className="small">
          Keeping the wiring but permuting connection strengths across edges,{" "}
          <strong>{pct(n.shuffled_better_fraction)}</strong> of {n.n_shuffles} shuffles produced
          a route at least as strong as the real one.
        </p>
        <p className="small muted">
          Observed {n.observed_score.toExponential(2)} vs shuffled mean{" "}
          {n.shuffled_mean.toExponential(2)}. Caveat: this null breaks the relationship between
          a connection's strength and where it sits in the network, so it is a deliberately
          harsh comparison rather than a definitive test.
        </p>
      </section>

      <section className="detail-block">
        <h4>4 · Does the route survive different settings?</h4>
        <p className="small muted">
          The same search re-run at different minimum-synapse thresholds. The route is stable
          until the threshold gets aggressive enough to delete one of its own edges.
        </p>
        <table className="robust-table">
          <thead>
            <tr>
              <th>Min synapses</th>
              <th>Hops</th>
              <th>Strongest route</th>
            </tr>
          </thead>
          <tbody>
            {ctx.robustness.map((r) => (
              <tr key={r.min_weight}>
                <td>{r.min_weight}</td>
                <td>{r.hops ?? "—"}</td>
                <td className="mono">{r.route ? r.route.join(" → ") : "no route"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
