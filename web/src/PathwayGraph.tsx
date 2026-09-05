import { useEffect, useRef } from "react";
import cytoscape, { type Core } from "cytoscape";
import dagre from "cytoscape-dagre";
import type { PathwayData } from "./types";
import { TIER_COLORS } from "./types";

cytoscape.use(dagre);

interface Props {
  data: PathwayData;
  onSelectType: (type: string | null) => void;
  playSignal: number;
}

// Same-tier (recurrent, e.g. optic-lobe-internal) edges are real but make
// the "signal flows forward" story hard to read, so the diagram only draws
// edges that move strictly from an earlier tier to a later one.
function feedForwardEdges(data: PathwayData) {
  const tierOf = new Map(data.nodes.map((n) => [n.type, n.tier]));
  return data.edges.filter((e) => (tierOf.get(e.source) ?? 0) < (tierOf.get(e.target) ?? 0));
}

export default function PathwayGraph({ data, onSelectType, playSignal }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const edges = feedForwardEdges(data);
    const maxWeight = Math.max(...edges.map((e) => e.weight));

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...data.nodes.map((n) => ({
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
        nodeSep: 30,
        rankSep: 130,
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
  }, [data]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || playSignal === 0) return;

    cy.elements().removeClass("highlighted").addClass("dimmed");
    const tiers = [...new Set(data.nodes.map((n) => n.tier))].sort();
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    tiers.forEach((tier, i) => {
      timeouts.push(
        setTimeout(() => {
          const nodesInTier = cy.nodes().filter((n) => n.data("tier") === tier);
          nodesInTier.removeClass("dimmed").addClass("highlighted");
          if (i > 0) {
            const incoming = nodesInTier.incomers("edge");
            incoming.removeClass("dimmed").addClass("highlighted");
          }
        }, i * 900),
      );
    });

    timeouts.push(
      setTimeout(
        () => {
          cy.elements().removeClass("highlighted dimmed");
        },
        tiers.length * 900 + 1500,
      ),
    );

    return () => timeouts.forEach(clearTimeout);
  }, [playSignal, data]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
