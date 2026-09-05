import { useEffect, useRef } from "react";
import cytoscape, { type Core } from "cytoscape";
import dagre from "cytoscape-dagre";
import type { PathwayData } from "./types";
import { TIER_COLORS } from "./types";

cytoscape.use(dagre);

interface Props {
  data: PathwayData;
  visibleTypes: Set<string>;
  onSelectType: (type: string | null) => void;
  activeUpTo: number; // -1 = nothing lit, else tiers [0..activeUpTo] are lit
}

// Same-tier (recurrent, e.g. optic-lobe-internal) edges are real but make
// the "signal flows forward" story hard to read, so the diagram only draws
// edges that move strictly from an earlier tier to a later one.
function feedForwardEdges(data: PathwayData, visibleTypes: Set<string>) {
  const tierOf = new Map(data.nodes.map((n) => [n.type, n.tier]));
  return data.edges.filter(
    (e) =>
      visibleTypes.has(e.source) &&
      visibleTypes.has(e.target) &&
      (tierOf.get(e.source) ?? 0) < (tierOf.get(e.target) ?? 0),
  );
}

export default function PathwayGraph({ data, visibleTypes, onSelectType, activeUpTo }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const visibleNodes = data.nodes.filter((n) => visibleTypes.has(n.type));
    const edges = feedForwardEdges(data, visibleTypes);
    const maxWeight = Math.max(1, ...edges.map((e) => e.weight));

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...visibleNodes.map((n) => ({
          data: { id: n.type, label: n.type, tier: n.tier },
        })),
        ...edges.map((e) => ({
          data: {
            id: `${e.source}->${e.target}`,
            source: e.source,
            target: e.target,
            weight: e.weight,
            // sqrt compresses the huge weight range (12 .. 100k+) into a
            // readable line-width range without hiding the smallest edges
            widthPx: 1.5 + 7 * Math.sqrt(e.weight / maxWeight),
          },
        })),
      ],
      style: [
        {
          selector: "node",
          style: {
            "background-color": (ele) => TIER_COLORS[ele.data("tier")] ?? "#888",
            label: "data(label)",
            color: "#e5e7eb",
            "font-size": 11,
            "text-valign": "center",
            "text-halign": "center",
            width: 46,
            height: 46,
            "border-width": 2,
            "border-color": "#1f2937",
          },
        },
        {
          selector: "edge",
          style: {
            width: "data(widthPx)",
            "line-color": "#4b5563",
            "target-arrow-color": "#4b5563",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            opacity: 0.55,
          },
        },
        {
          selector: ".highlighted",
          style: {
            "background-color": "#facc15",
            "border-color": "#fde68a",
            "line-color": "#facc15",
            "target-arrow-color": "#facc15",
            opacity: 1,
          },
        },
        {
          selector: ".dimmed",
          style: { opacity: 0.15 },
        },
      ],
      layout: {
        name: "dagre",
        rankDir: "LR",
        nodeSep: 14,
        rankSep: 120,
        padding: 30,
      } as cytoscape.LayoutOptions,
    });

    cy.ready(() => {
      cy.resize();
      cy.fit(undefined, 30);
    });

    cy.on("tap", "node", (evt) => onSelectType(evt.target.id()));
    cy.on("tap", (evt) => {
      if (evt.target === cy) onSelectType(null);
    });

    const resizeObserver = new ResizeObserver(() => {
      cy.resize();
      cy.fit(undefined, 30);
    });
    resizeObserver.observe(containerRef.current);

    cyRef.current = cy;
    return () => {
      resizeObserver.disconnect();
      cy.destroy();
    };
  }, [data, visibleTypes]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    if (activeUpTo < 0) {
      cy.elements().removeClass("highlighted dimmed");
      return;
    }
    cy.nodes().forEach((n) => {
      n.toggleClass("highlighted", n.data("tier") <= activeUpTo);
      n.toggleClass("dimmed", n.data("tier") > activeUpTo);
    });
    cy.edges().forEach((e) => {
      const targetLit = (e.target().data("tier") ?? 0) <= activeUpTo;
      e.toggleClass("highlighted", targetLit);
      e.toggleClass("dimmed", !targetLit);
    });
  }, [activeUpTo]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
