import type { PathwayData } from "./types";
import { STAGE_COLORS } from "./types";

interface Props {
  data: PathwayData;
  stages: number[];
  activeStage: number;
  playing: boolean;
  onStage: (s: number) => void;
  onPlay: () => void;
  onSelectType: (t: string) => void;
}

// What actually happens at each step of the journey. These are anatomical
// descriptions of the wiring, not claims about firing or behaviour.
const STAGE_STORY: Record<number, string> = {
  0: "Light hits the retina. R1–R6 are the outer photoreceptors: they are histaminergic and send their signal a very short distance into the lamina, the first optic neuropil.",
  1: "Lamina monopolar cells (L1, L2, L3) are the main output channels leaving the lamina. L1 and L2 split the signal into the ON and OFF motion channels; L3 carries a luminance/contrast channel.",
  2: "In the medulla, transmedullary neurons (Tm/Mi types) reformat the signal and carry it deeper into the optic lobe, towards the lobula.",
  3: "Lobula projection neurons are the exit route from the optic lobe. This is where visual information first leaves the visual system and enters the central brain.",
  4: "Central-brain neurons in the anterior optic tubercle (AOTU) and vest (VES) regions sit between vision and motor control, converging onto descending neurons.",
  5: "DNg13 is a descending neuron: its axon leaves the brain and runs down the ventral nerve cord, where the motor circuitry for locomotion lives.",
};

export default function JourneyPanel({
  data,
  stages,
  activeStage,
  playing,
  onStage,
  onPlay,
  onSelectType,
}: Props) {
  return (
    <div className="panel-scroll">
      <section className="detail-block">
        <div className="journey-controls">
          <button className="primary-button" onClick={onPlay} disabled={playing}>
            {playing ? "Playing…" : "▶ Play the journey"}
          </button>
          <button
            className="ghost-button"
            onClick={() => onStage(-1)}
            disabled={activeStage < 0}
          >
            Show all
          </button>
        </div>
        <p className="small muted">
          Follow the signal one anatomical stage at a time, from the photoreceptors to a
          descending neuron. The 3D view shows the real traced shape of each neuron.
        </p>
      </section>

      <div className="steps">
        {stages.map((s) => {
          const nodes = data.nodes.filter((n) => n.stage === s);
          const isActive = activeStage === s;
          return (
            <button
              key={s}
              className={`step ${isActive ? "active" : ""} ${
                activeStage >= 0 && s < activeStage ? "done" : ""
              }`}
              onClick={() => onStage(s)}
            >
              <span className="step-dot" style={{ background: STAGE_COLORS[s] }}>
                {s}
              </span>
              <span className="step-body">
                <span className="step-title">{nodes[0]?.stageName ?? `Stage ${s}`}</span>
                <span className="step-types">
                  {nodes.map((n) => n.type).join(", ")}
                </span>
                {isActive && (
                  <>
                    <span className="step-story">{STAGE_STORY[s]}</span>
                    <span className="chip-row">
                      {nodes.map((n) => (
                        <span
                          className="chip"
                          key={n.type}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectType(n.type);
                          }}
                        >
                          {n.type}
                        </span>
                      ))}
                    </span>
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <section className="detail-block">
        <p className="small muted">
          Everything shown is a <strong>structural</strong> route through the connectome: which
          neurons are wired to which, and how strongly. It does not simulate neural firing or
          predict what the fly does.
        </p>
      </section>
    </div>
  );
}
