import type { PathwayNode } from "./types";
import { TIER_LABELS } from "./types";

interface Props {
  node: PathwayNode | null;
}

// Every fact here comes straight from the MaleCNS connectome tables.
// Confidence framing follows the dataset's own evidence: automated
// segmentation + synapse detection is "observed", a machine-learned
// neurotransmitter call is "predicted", and anything about function
// (what a cell type does behaviorally) is "inferred" from the literature,
// never asserted as directly measured here.
function evidenceLevel(node: PathwayNode): { label: string; note: string } {
  if (node.tier === 2) {
    return {
      label: "Experimentally supported",
      note: "DNp01 (the Giant Fiber) is one of the most extensively studied single identified neurons in Drosophila — its role in escape behavior comes from decades of physiology and behavior experiments, not just connectome structure.",
    };
  }
  if (node.tier === 1) {
    return {
      label: "Experimentally supported",
      note: "LC4 and LPLC2 have been shown by calcium imaging and behavior experiments to respond to looming stimuli and to drive escape via the Giant Fiber.",
    };
  }
  if (node.tier === 3) {
    return {
      label: "Observed connectome + inferred function",
      note: "The synaptic connection from DNp01 is directly observed. That this drives jumping/flight is inferred from motor neuron anatomy and prior physiology, not measured in this dataset.",
    };
  }
  return {
    label: "Observed connectome, inferred role",
    note: "This neuron's synaptic connectivity is directly observed (EM reconstruction). Its role as a 'visual input' feature detector is inferred from its optic-lobe anatomy and connectivity pattern, following prior optic-lobe physiology.",
  };
}

export default function EvidencePanel({ node }: Props) {
  if (!node) {
    return (
      <div className="evidence-panel evidence-panel--empty">
        <p>Click any neuron in the diagram to see what the data actually shows about it.</p>
      </div>
    );
  }

  const evidence = evidenceLevel(node);

  return (
    <div className="evidence-panel">
      <h2>{node.type}</h2>
      <dl>
        <dt>Stage in pathway</dt>
        <dd>{TIER_LABELS[node.tier]}</dd>

        <dt>Superclass (dataset annotation)</dt>
        <dd>{node.superclass ?? "unannotated"}</dd>

        <dt>Traced cell bodies of this type</dt>
        <dd>{node.n_bodies.toLocaleString()}</dd>

        <dt>Predicted neurotransmitter</dt>
        <dd>{node.predicted_neurotransmitter ?? "no confident prediction"}</dd>
      </dl>

      <div className="evidence-badge">{evidence.label}</div>
      <p className="evidence-note">{evidence.note}</p>
    </div>
  );
}
