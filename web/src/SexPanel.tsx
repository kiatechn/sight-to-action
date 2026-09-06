import type { PathwayData, SexStatus } from "./types";
import { SEX_COLOR } from "./types";

interface Props {
  data: PathwayData;
  onSelectType: (t: string) => void;
  onShowRoute: (route: string[] | null, brain?: "male" | "female") => void;
}

const ORDER: SexStatus["category"][] = [
  "sexually dimorphic",
  "male-specific",
  "potentially male-specific",
  "shared",
  "unknown",
];

export default function SexPanel({ data, onSelectType, onShowRoute }: Props) {
  const f = data.female;

  const groups = ORDER.map((cat) => ({
    cat,
    nodes: data.nodes.filter((n) => n.sex.category === cat),
  })).filter((g) => g.nodes.length > 0);

  const missingEdges = f?.edges.filter((e) => !e.found) ?? [];
  const matchedEdges = f?.edges.filter((e) => e.found) ?? [];

  return (
    <div className="panel-scroll">
      {f ? (
        <>
          <section className="detail-block">
            <h4>What was actually compared</h4>
            <p className="small muted">
              The same graph construction, relative-weight definition and route search were
              re-run on the <strong>female</strong> connectome — this is a computed comparison,
              not a reading of the dimorphism flags. {f.meta.note}
            </p>
            <p className="small muted">
              Female dataset: {f.meta.femaleDataset}.
            </p>
          </section>

          <section className="detail-block highlight">
            <h4>Result: the pathway is conserved except where it isn't</h4>
            <p className="small">
              <strong>
                {f.edgesFound} of {f.edgesTotal}
              </strong>{" "}
              connections in the male pathway have a female counterpart. Every one of the{" "}
              {f.edgesTotal - f.edgesFound} missing connections involves{" "}
              {f.missingTypes.map((t, i) => {
                const node = data.nodes.find((n) => n.type === t);
                return (
                  <span key={t}>
                    {i > 0 && ", "}
                    <button className="chip" onClick={() => onSelectType(t)}>
                      {t}
                    </button>
                    <span className="muted"> ({node?.sex.category ?? "unmatched"})</span>
                  </span>
                );
              })}
              . Neither has a counterpart in the female dataset — though note the
              annotations differ in confidence: LoVP92 is recorded as male-specific,
              VES200m only as <em>potentially</em> male-specific.
            </p>
            <p className="small muted">
              So the early visual stages are shared and quantitatively similar between the sexes,
              while the divergence is concentrated at the male-specific branch near the end.
            </p>
          </section>

          <section className="detail-block">
            <h4>Strongest route in each sex</h4>
            <div className="sex-route">
              <span className="sex-tag male">Male</span>
              <span className="mono">{data.routes[0]?.nodes.join(" → ")}</span>
              <button
                className="ghost-button"
                onClick={() => onShowRoute(data.routes[0].nodes, "male")}
              >
                View
              </button>
            </div>
            <div className="sex-route">
              <span className="sex-tag female">Female</span>
              <span className="mono">{f.femaleRoutes[0]?.nodes.join(" → ")}</span>
              <button
                className="ghost-button"
                onClick={() => onShowRoute(f.femaleRoutes[0].nodes, "female")}
              >
                View
              </button>
            </div>
            <p className="small muted">
              The strongest male route runs through a male-specific neuron, so it has no female
              equivalent — the female brain reaches the same descending neuron a different way.
            </p>
            {f.conservedRoutes.length > 0 && (
              <>
                <div className="conn-head">Routes present in both sexes</div>
                {f.conservedRoutes.map((r) => (
                  <div className="sex-route" key={r.join()}>
                    <span className="mono">{r.join(" → ")}</span>
                    <button className="ghost-button" onClick={() => onShowRoute(r, "male")}>
                      View in ♂
                    </button>
                  </div>
                ))}
              </>
            )}
          </section>

          <section className="detail-block">
            <h4>Is anything female-specific?</h4>
            <p className="small">
              The female connectome contains{" "}
              <strong>{f.femaleSpecific.femaleSpecificCount} female-specific neurons</strong>{" "}
              across {f.femaleSpecific.femaleSpecificTypeCount} cell types, plus{" "}
              {f.femaleSpecific.sexuallyDimorphicCount} annotated sexually dimorphic — so the
              asymmetry is not that the female brain has nothing of its own.
            </p>
            <p className="small">
              But <strong>none of them lie on the routes to DNg13</strong>. Every neuron on the
              female routes is annotated <em>isomorphic</em> (shared between the sexes) except
              the target DNg13 itself, which is sexually dimorphic.
            </p>
            <p className="small muted">
              So the asymmetry here is genuinely one-sided: the male pathway routes through a
              male-specific neuron, whereas the female pathway is built entirely from shared
              cells. The female-specific cells exist elsewhere in her brain, not on this route.
            </p>
            <div className="conn-head">Neurons on the female routes</div>
            {f.femaleSpecific.routeTypes.map((r) => (
              <div className="conn-row" key={r.type}>
                <span>{r.type}</span>
                <span className="small muted">
                  {r.dimorphism ?? "unannotated"}
                  {r.hasMaleCounterpart ? "" : " · no male counterpart recorded"}
                </span>
              </div>
            ))}
          </section>

          <section className="detail-block">
            <h4>The statistical test, re-run on the female brain</h4>
            <p className="small">
              DNg13 ranks <strong>{f.femaleRank} of {f.femalePool}</strong> female descending
              neurons for connection strength from the photoreceptors — below median, just as in
              the male ({data.context?.nulls.target_rank} of {data.context?.nulls.target_pool}).
            </p>
            <p className="small muted">
              The best-connected descending neurons come out nearly the same in both datasets
              (DNc01, DNc02, DNp11, DNp04…), even though the two connectomes were reconstructed
              by different groups using different pipelines. That agreement is a strong check
              that the measure reflects biology rather than an artefact of one dataset.
            </p>
            <div className="lead-list">
              {f.femaleTopDescending.slice(0, 6).map((r) => (
                <div className="lead-row" key={r.type}>
                  <span className="chip">{r.type}</span>
                  <span className="mono muted">{r.score.toExponential(2)}</span>
                </div>
              ))}
              <div className="lead-row current">
                <span className="chip">{f.meta.target}</span>
                <span className="mono">{f.femaleTargetScore.toExponential(2)}</span>
              </div>
            </div>
          </section>

          <section className="detail-block">
            <h4>Connection strengths, male vs female</h4>
            <p className="small muted">
              Relative weight = the share of the target's input supplied by that source. Close
              agreement across two independent reconstructions is meaningful.
            </p>
            <table className="robust-table">
              <thead>
                <tr>
                  <th>Connection</th>
                  <th>Male</th>
                  <th>Female</th>
                </tr>
              </thead>
              <tbody>
                {matchedEdges.slice(0, 12).map((e) => (
                  <tr key={`${e.male_source}-${e.male_target}`}>
                    <td className="mono">
                      {e.male_source} → {e.male_target}
                    </td>
                    <td>{(e.male_relative_weight * 100).toFixed(1)}%</td>
                    <td>{((e.female_relative_weight ?? 0) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="detail-block">
            <h4>Connections with no female counterpart</h4>
            {missingEdges.map((e) => (
              <div className="conn-row" key={`${e.male_source}-${e.male_target}`}>
                <span className="mono">
                  {e.male_source} → {e.male_target}
                </span>
                <span className="small muted">{e.reason_missing}</span>
              </div>
            ))}
          </section>
        </>
      ) : (
        <section className="detail-block">
          <h4>Female comparison not built</h4>
          <p className="small muted">
            The FlyWire female connectome files are an optional download. See the README to
            fetch them and re-run the build.
          </p>
        </section>
      )}

      <section className="detail-block">
        <h4>Dataset annotations, for reference</h4>
        <p className="small muted">
          How MaleCNS itself labels each neuron. The computed comparison above is independent of
          these flags — and agrees with them.
        </p>
        {groups.map((g) => (
          <div key={g.cat} style={{ marginBottom: 8 }}>
            <div className="small">
              <span className="dot" style={{ background: SEX_COLOR[g.cat] }} />
              {g.cat} ({g.nodes.length})
            </div>
            <div className="chip-row">
              {g.nodes.map((n) => (
                <button className="chip" key={n.type} onClick={() => onSelectType(n.type)}>
                  {n.type}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
