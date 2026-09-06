import { useEffect, useRef } from "react";
import cytoscape, { type Core } from "cytoscape";
import dagre from "cytoscape-dagre";
import type { PathwayData } from "./types";
import { STAGE_COLORS } from "./types";

cytoscape.use(dagre);

interface Props {
  data: PathwayData;
  activeStage: number;
  selectedType: string | null;
  onSelectType: (t: string | null) => void;
  hiddenTypes: Set<string>;
}

export default function CircuitPanel({
  data,
  activeStage,
  selectedType,
  onSelectType,
  hiddenTypes,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const visibleNodes = data.nodes.filter((n) => !hiddenTypes.has(n.type));
    const visible = new Set(visibleNodes.map((n) => n.type));
    const edges = data.edges.filter((e) => visible.has(e.source) && visible.has(e.target));
    const maxRel = Math.max(...edges.map((e) => e.relative_weight), 0.001);

    const cy = cytoscape({
      container: el,
      elements: [
        ...visibleNodes.map((n) => ({
          data: { id: n.type, label: n.type, stage: n.stage },
        })),
        ...edges.map((e) => ({
          data: {
            id: `${e.source}->${e.target}`,
            source: e.source,
            target: e.target,
            stage: data.nodes.find((n) => n.type === e.target)?.stage ?? 0,
            widthPx: 1.2 + 5 * Math.sqrt(e.relative_weight / maxRel),
          },
        })),
      ],
      style: [
        {
          selector: "node",
          style: {
            "background-color": (ele) => STAGE_COLORS[ele.data("stage")] ?? "#94a3b8",
            label: "data(label)",
            // labels sit below the node so long type names (AOTU002_b,
            // LC10c-1) are never truncated
            color: "#cbd5e1",
            "font-size": 10,
            "font-weight": 600,
            "text-valign": "bottom",
            "text-halign": "center",
            "text-margin-y": 3,
            "text-outline-color": "#101a2e",
            "text-outline-width": 2,
            width: 26,
            height: 26,
            "border-width": 2,
            "border-color": "#101a2e",
          },
        },
        {
          selector: "edge",
          style: {
            width: "data(widthPx)",
            "line-color": "#334155",
            "target-arrow-color": "#334155",
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.8,
            "curve-style": "bezier",
            opacity: 0.7,
          },
        },
        { selector: ".dim", style: { opacity: 0.12 } },
        {
          selector: "node.on",
          style: { "border-color": "#f8fafc", "border-width": 3 },
        },
        {
          selector: "edge.on",
          style: { "line-color": "#e2e8f0", "target-arrow-color": "#e2e8f0", opacity: 1 },
        },
        {
          selector: "node.picked",
          style: { "border-color": "#ffffff", "border-width": 4 },
        },
      ],
      layout: {
        name: "dagre",
        rankDir: "TB",
        nodeSep: 44,
        rankSep: 74,
        fit: true,
        padding: 18,
      } as cytoscape.LayoutOptions,
      minZoom: 0.15,
      maxZoom: 2.5,
      wheelSensitivity: 0.2,
    });

    cy.on("tap", "node", (evt) => onSelectType(evt.target.id()));
    cy.on("tap", (evt) => {
      if (evt.target === cy) onSelectType(null);
    });

    // The panel can be laid out at zero size (hidden tab, collapsed pane,
    // first paint). Cytoscape would then fit at zoom 1 into a 0x0 box and
    // stay that way, which is what left the diagram clipped. So refit
    // synchronously on every real size change, and again when the document
    // becomes visible, since animation frames don't run while it's hidden.
    const refit = () => {
      if (el.clientWidth > 2 && el.clientHeight > 2) {
        cy.resize();
        cy.fit(undefined, 18);
      }
    };
    const ro = new ResizeObserver(refit);
    ro.observe(el);
    document.addEventListener("visibilitychange", refit);
    refit();

    cyRef.current = cy;
    return () => {
      ro.disconnect();
      document.removeEventListener("visibilitychange", refit);
      cy.destroy();
      cyRef.current = null;
    };
  }, [data, hiddenTypes, onSelectType]);

  // Stage progression + selection highlighting
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().removeClass("dim on picked");
      if (selectedType) {
        const node = cy.getElementById(selectedType);
        const keep = node.closedNeighborhood();
        cy.elements().difference(keep).addClass("dim");
        node.addClass("picked");
      } else if (activeStage >= 0) {
        cy.nodes().forEach((n) => {
          const s = n.data("stage");
          if (s === activeStage) n.addClass("on");
          else if (s > activeStage) n.addClass("dim");
        });
        cy.edges().forEach((e) => {
          const s = e.data("stage");
          if (s <= activeStage) e.addClass("on");
          else e.addClass("dim");
        });
      }
    });
  }, [activeStage, selectedType]);

  return (
    <div className="circuit-wrap">
      <div ref={containerRef} className="circuit-canvas" />
      <button
        className="ghost-button circuit-reset"
        onClick={() => {
          cyRef.current?.fit(undefined, 18);
        }}
      >
        Reset view
      </button>
    </div>
  );
}
