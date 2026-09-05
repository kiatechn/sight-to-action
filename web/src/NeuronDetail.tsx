import type { PathwayData, PathwayNode } from "./types";
import { EVIDENCE_LABEL, SEX_COLOR, STAGE_COLORS } from "./types";

interface Props {
  node: PathwayNode | null;
  data: PathwayData;
  onClose: () => void;
}

function neuprintUrl(bodyId: number) {
  return `https://neuprint.janelia.org/view?bodyId=${bodyId}&dataset=male-cns:v1.0`;
}

export default function NeuronDetail({ node, data, onClose }: Props) {
  if (!node) {
    return (
      <div className="detail empty">
        <p>
          Select any neuron — in the 3D view or the circuit diagram — to see its cell type,
          location, connection strengths, predicted neurotransmitter and the evidence behind
          each statement.
        </p>
      </div>
    );
  }

  const inputs = data.edges
    .filter((e) => e.target === node.type)
    .sort((a, b) => b.relative_weight - a.relative_weight);
  const outputs = data.edges
    .filter((e) => e.source === node.type)
    .sort((a, b) => b.relative_weight - a.relative_weight);

  return (
    <div className="detail">
      <div className="detail-head">
        <div>
          <span className="stage-chip" style={{ background: STAGE_COLORS[node.stage] }}>
            Stage {node.stage} · {node.stageName}
          </span>
          <h2>{node.type}</h2>
        </div>
        <button className="ghost-button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="fact-grid">
        <div>
          <span className="fact-key">Traced cells of this type</span>
          <span className="fact-val">{node.n_bodies.toLocaleString()}</span>
        </div>
        <div>
          <span className="fact-key">Dataset class</span>
          <span className="fact-val">{node.superclass ?? "—"}</span>
        </div>
        <div>
          <span className="fact-key">Predicted neurotransmitter</span>
          <span className="fact-val">
            {node.neurotransmitter.predicted ?? "no confident prediction"}
            {node.neurotransmitter.confidence != null && (
              <span className="muted"> ({(node.neurotransmitter.confidence * 100).toFixed(0)}%)</span>
            )}
          </span>
        </div>
        <div>
          <span className="fact-key">Male / female status</span>
          <span className="fact-val">
            <span className="dot" style={{ background: SEX_COLOR[node.sex.category] }} />
            {node.sex.category}
          </span>
        </div>
      </div>

      <section className="detail-block">
        <h4>Evidence for this interpretation</h4>
        <div className={`evidence-tag ev-${node.evidence.level}`}>
          {EVIDENCE_LABEL[node.evidence.level]}
        </div>
        <p className="small">{node.evidence.note}</p>
        <p className="small muted">
          Connectivity, cell counts and morphology below are <strong>directly mapped</strong> from
          the EM reconstruction. Neurotransmitter is a{" "}
          <strong>computationally inferred</strong> model prediction.
        </p>
      </section>

      <section className="detail-block">
        <h4>Sex comparison</h4>
        <p className="small">{node.sex.detail}</p>
        {(node.sex.flywireType || node.sex.hemibrainType) && (
          <p className="small muted">
            {node.sex.flywireType && <>FlyWire (female): <code>{node.sex.flywireType}</code>. </>}
            {node.sex.hemibrainType && <>Hemibrain (female): <code>{node.sex.hemibrainType}</code>.</>}
          </p>
        )}
      </section>

      <section className="detail-block">
        <h4>Connections inside this pathway</h4>
        {inputs.length > 0 && (
          <>
            <div className="conn-head">Receives from</div>
            {inputs.map((e) => (
              <div className="conn-row" key={`${e.source}-in`}>
                <span>{e.source}</span>
                <span className="muted">
                  {e.weight.toLocaleString()} synapses · {(e.relative_weight * 100).toFixed(1)}% of
                  its input
                </span>
              </div>
            ))}
          </>
        )}
        {outputs.length > 0 && (
          <>
            <div className="conn-head">Sends to</div>
            {outputs.map((e) => (
              <div className="conn-row" key={`${e.target}-out`}>
                <span>{e.target}</span>
                <span className="muted">
                  {e.weight.toLocaleString()} synapses · {(e.relative_weight * 100).toFixed(1)}% of
                  target input
                </span>
              </div>
            ))}
          </>
        )}
      </section>

      <section className="detail-block">
        <h4>Source data</h4>
        <p className="small muted">
          Example traced cells (opens neuPrint):{" "}
          {node.bodyIds.slice(0, 3).map((b, i) => (
            <span key={b}>
              {i > 0 && ", "}
              <a href={neuprintUrl(b)} target="_blank" rel="noreferrer">
                {b}
              </a>
            </span>
          ))}
        </p>
      </section>
    </div>
  );
}
