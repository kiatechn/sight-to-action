export interface PathwayNode {
  type: string;
  tier: number;
  superclass: string | null;
  n_bodies: number;
  predicted_neurotransmitter: string | null;
}

export interface PathwayEdge {
  source: string;
  target: string;
  weight: number;
  n_synapse_connections: number;
}

export interface PathwayMeta {
  title: string;
  dataset: string;
  source: string;
  description: string;
  references?: string[];
}

export interface PathwayData {
  meta: PathwayMeta;
  nodes: PathwayNode[];
  edges: PathwayEdge[];
}

export const TIER_LABELS: Record<number, string> = {
  0: "Visual input (optic lobe)",
  1: "Looming-sensitive projection neurons",
  2: "Descending neuron",
  3: "Motor output",
};

export const TIER_COLORS: Record<number, string> = {
  0: "#3b82f6",
  1: "#8b5cf6",
  2: "#ef4444",
  3: "#f59e0b",
};
