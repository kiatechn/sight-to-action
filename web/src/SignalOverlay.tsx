interface Props {
  phase: "idle" | "intro" | "signal" | "outcome";
}

export default function SignalOverlay({ phase }: Props) {
  if (phase === "idle" || phase === "signal") return null;

  if (phase === "intro") {
    return (
      <div className="scene-overlay">
        <div className="looming-dot" />
        <p className="overlay-caption">
          What the eye detects: an object expanding rapidly across the retina — a looming threat.
        </p>
      </div>
    );
  }

  return (
    <div className="scene-overlay scene-overlay--outcome">
      <p className="outcome-title">Escape jump triggered</p>
      <p className="overlay-caption">
        DNp01 fires and drives TTMn, the tergotrochanteral "jump" motor neuron. This behavioral
        outcome is known from decades of physiology and behavior experiments on this exact
        circuit — it is not simulated from connectome structure alone.
      </p>
    </div>
  );
}
