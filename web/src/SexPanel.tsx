import type { PathwayData, SexStatus } from "./types";
import { SEX_COLOR } from "./types";

interface Props {
  data: PathwayData;
  onSelectType: (t: string) => void;
}

const ORDER: SexStatus["category"][] = [
  "sexually dimorphic",
  "male-specific",
  "potentially male-specific",
  "shared",
  "unknown",
];

const BLURB: Record<SexStatus["category"], string> = {
  "sexually dimorphic":
    "A matching cell exists in the female connectome, but its morphology and/or connectivity differ between the sexes.",
  "male-specific":
    "No corresponding cell is identified in the female connectomes — routes through these neurons may have no female counterpart.",
  "potentially male-specific":
    "Provisionally flagged as male-specific in the dataset; the cross-connectome match is not yet settled.",
  shared:
    "Reliably matched to a named cell type in the female FlyWire/FAFB (and sometimes hemibrain) connectome.",
  unknown: "The dataset records no reliable cross-connectome mapping for this type.",
};

export default function SexPanel({ data, onSelectType }: Props) {
  const groups = ORDER.map((cat) => ({
    cat,
    nodes: data.nodes.filter((n) => n.sex.category === cat),
  })).filter((g) => g.nodes.length > 0);

  const onTopRoute = new Set(data.routes[0]?.nodes ?? []);
  const notableOnTop = data.nodes.filter(
    (n) => onTopRoute.has(n.type) && n.sex.category !== "shared",
  );

  return (
    <div className="panel-scroll">
      <section className="detail-block">
        <h4>What this compares</h4>
        <p className="small muted">
          MaleCNS annotations carry cross-connectome mappings to the female FlyWire/FAFB and
          hemibrain datasets, plus explicit dimorphism flags. That lets each neuron in this
          pathway be labelled as shared, sex-specific or sexually dimorphic — without claiming
          anything about behaviour.
        </p>
      </section>

      {notableOnTop.length > 0 && (
        <section className="detail-block highlight">
          <h4>Finding: the strongest route is not sex-neutral</h4>
          <p className="small">
            The top-ranked route passes through{" "}
            {notableOnTop.map((n, i) => (
              <span key={n.type}>
                {i > 0 && ", "}
                <button className="chip" onClick={() => onSelectType(n.type)}>
                  {n.type}
                </button>{" "}
                <span className="muted">({n.sex.category})</span>
              </span>
            ))}
            . A directly equivalent route may therefore not exist in the female connectome.
          </p>
        </section>
      )}

      {groups.map((g) => (
        <section className="detail-block" key={g.cat}>
          <h4>
            <span className="dot" style={{ background: SEX_COLOR[g.cat] }} />
            {g.cat} ({g.nodes.length})
          </h4>
          <p className="small muted">{BLURB[g.cat]}</p>
          <div className="chip-row">
            {g.nodes.map((n) => (
              <button className="chip" key={n.type} onClick={() => onSelectType(n.type)}>
                {n.type}
                {n.sex.flywireType && n.sex.category === "shared" && (
                  <span className="muted"> = {n.sex.flywireType}</span>
                )}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
