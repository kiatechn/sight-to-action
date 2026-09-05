import { useEffect, useMemo, useState } from "react";
import type { ExplorerData } from "./types";

interface Props {
  onSelectType: (t: string) => void;
  pathwayTypes: Set<string>;
}

/** Rank of `value` within `all`, 1 = strongest. */
function rankOf(value: number, all: number[]) {
  const better = all.filter((v) => v > value).length;
  return better + 1;
}

export default function ExplorePanel({ onSelectType, pathwayTypes }: Props) {
  const [data, setData] = useState<ExplorerData | null>(null);
  const [source, setSource] = useState("R1-R6");
  const [target, setTarget] = useState("DNg13");

  useEffect(() => {
    fetch("/data/explorer.json")
      .then((r) => r.json())
      .then(setData);
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const perTarget = data.results[source] ?? {};
    const entry = perTarget[target];

    // How this target ranks among all movement neurons, for this sense
    const allFromSource = Object.entries(perTarget).map(([t, r]) => ({ type: t, score: r.score }));
    allFromSource.sort((a, b) => b.score - a.score);
    const targetRank = entry ? rankOf(entry.score, allFromSource.map((r) => r.score)) : null;

    // How this sense ranks among all senses, for this target
    const acrossSources = data.sources
      .map((s) => ({ type: s, score: data.results[s]?.[target]?.score ?? 0 }))
      .filter((r) => r.score > 0);
    acrossSources.sort((a, b) => b.score - a.score);
    const sourceRank = entry ? rankOf(entry.score, acrossSources.map((r) => r.score)) : null;

    return { entry, allFromSource, targetRank, acrossSources, sourceRank };
  }, [data, source, target]);

  if (!data) return <div className="panel-scroll">Loading explorer…</div>;

  const { entry, allFromSource, targetRank, acrossSources, sourceRank } = view!;

  return (
    <div className="panel-scroll">
      <section className="detail-block">
        <h4>Test it yourself</h4>
        <p className="small muted">
          Pick any sense and any movement neuron. The route and score are computed with exactly
          the same method used everywhere else in this project — nothing here is approximated.
        </p>

        <label className="field-label" htmlFor="src">
          Sense (input)
        </label>
        <select id="src" value={source} onChange={(e) => setSource(e.target.value)}>
          {data.sources.map((s) => (
            <option key={s} value={s}>
              {s} — {data.modality[s] ?? "sensory"}
            </option>
          ))}
        </select>

        <label className="field-label" htmlFor="tgt">
          Movement neuron (output)
        </label>
        <select id="tgt" value={target} onChange={(e) => setTarget(e.target.value)}>
          {data.targets.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </section>

      {!entry ? (
        <section className="detail-block highlight-warn">
          <h4>No route</h4>
          <p className="small">
            No route from <strong>{source}</strong> to <strong>{target}</strong> within{" "}
            {data.meta.max_hops} hops. That itself is informative — most pairs in a connectome
            <em> are</em> connected, so an absent short route is unusual.
          </p>
        </section>
      ) : (
        <>
          <section className="detail-block">
            <h4>Strongest route</h4>
            <div className="route-chain">
              {entry.route.map((n, i) => (
                <span key={`${n}-${i}`}>
                  {i > 0 && <span className="arrow">→</span>}
                  <button
                    className="chip"
                    onClick={() => pathwayTypes.has(n) && onSelectType(n)}
                    title={pathwayTypes.has(n) ? "Show details" : "Not part of the featured pathway"}
                  >
                    {n}
                  </button>
                </span>
              ))}
            </div>
            <p className="small muted">
              {entry.route.length - 1} hops · score {entry.score.toExponential(2)}
            </p>
          </section>

          <section className="detail-block">
            <h4>Is that a strong connection?</h4>
            <div className="verdict-grid">
              <div>
                <span className="fact-key">Among movement neurons</span>
                <span className="verdict-num">
                  {targetRank}
                  <span className="muted"> / {allFromSource.length}</span>
                </span>
                <span className="small muted">
                  how well <strong>{source}</strong> reaches <strong>{target}</strong> compared
                  with every other movement neuron
                </span>
              </div>
              <div>
                <span className="fact-key">Among senses</span>
                <span className="verdict-num">
                  {sourceRank}
                  <span className="muted"> / {acrossSources.length}</span>
                </span>
                <span className="small muted">
                  how well <strong>{source}</strong> reaches <strong>{target}</strong> compared
                  with every other sense
                </span>
              </div>
            </div>
          </section>

          <section className="detail-block">
            <h4>Movement neurons best reached from {source}</h4>
            <div className="lead-list">
              {allFromSource.slice(0, 8).map((r) => (
                <div className={`lead-row ${r.type === target ? "current" : ""}`} key={r.type}>
                  <button className="chip" onClick={() => setTarget(r.type)}>
                    {r.type}
                  </button>
                  <span className="mono muted">{r.score.toExponential(2)}</span>
                </div>
              ))}
              {targetRank && targetRank > 8 && (
                <div className="lead-row current">
                  <span className="chip">
                    {target} (#{targetRank})
                  </span>
                  <span className="mono">{entry.score.toExponential(2)}</span>
                </div>
              )}
            </div>
          </section>

          <section className="detail-block">
            <h4>Senses that best reach {target}</h4>
            <div className="lead-list">
              {acrossSources.slice(0, 8).map((r) => (
                <div className={`lead-row ${r.type === source ? "current" : ""}`} key={r.type}>
                  <button className="chip" onClick={() => setSource(r.type)}>
                    {r.type}
                    <span className="muted"> · {data.modality[r.type]}</span>
                  </button>
                  <span className="mono muted">{r.score.toExponential(2)}</span>
                </div>
              ))}
              {sourceRank && sourceRank > 8 && (
                <div className="lead-row current">
                  <span className="chip">
                    {source} (#{sourceRank})
                  </span>
                  <span className="mono">{entry.score.toExponential(2)}</span>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <section className="detail-block">
        <h4>Try these</h4>
        <div className="chip-row">
          <button
            className="chip"
            onClick={() => {
              setSource("R1-R6");
              setTarget("DNg13");
            }}
          >
            vision → DNg13 (the featured route)
          </button>
          <button
            className="chip"
            onClick={() => {
              setSource("R1-R6");
              setTarget("DNp01");
            }}
          >
            vision → DNp01 (Giant Fiber)
          </button>
          <button
            className="chip"
            onClick={() => {
              setSource("SNpp50");
              setTarget("DNg13");
            }}
          >
            proprioception → DNg13
          </button>
          <button
            className="chip"
            onClick={() => {
              setSource("LgLG1a");
              setTarget("DNg13");
            }}
          >
            taste → DNg13
          </button>
        </div>
        <p className="small muted">
          Comparing the first two is the quickest way to see the point. Vision reaches DNp01 —
          the Giant Fiber — about 140× more strongly than it reaches DNg13, and it does so via{" "}
          <strong>LC4</strong>, the looming-detector of the textbook escape circuit. The third
          shows that DNg13 is reached far better by body-position sense than by vision.
        </p>
      </section>
    </div>
  );
}
