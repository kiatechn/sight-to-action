export interface Evidence {
  level:
    | "directly-mapped"
    | "experimentally-supported"
    | "computationally-inferred"
    | "unknown";
  note: string;
}

export interface SexStatus {
  category: "shared" | "male-specific" | "potentially male-specific" | "sexually dimorphic" | "unknown";
  detail: string;
  flywireType: string | null;
  hemibrainType: string | null;
  dimorphism: string | null;
}

export interface PathwayNode {
  type: string;
  stage: number;
  stageName: string;
  n_bodies: number;
  superclass: string | null;
  neurotransmitter: {
    predicted: string | null;
    confidence: number | null;
    ground_truth: string | null;
  };
  evidence: Evidence;
  sex: SexStatus;
  bodyIds: number[];
  somaPositions: [number, number, number][];
}

export interface PathwayEdge {
  source: string;
  target: string;
  weight: number;
  relative_weight: number;
}

export interface Route {
  nodes: string[];
  hops: number;
  total_synapses: number;
  min_relative_weight: number;
  score: number;
  edges: { source: string; target: string; weight: number; relative_weight: number }[];
}

export interface Bottleneck {
  type: string;
  n_routes: number;
  fraction_of_routes: number;
}

export interface RemovalEffect {
  removed: string;
  best_before: string[] | null;
  best_after: string[] | null;
  score_before: number;
  score_after: number;
  still_connected: boolean;
  hops_before: number | null;
  hops_after: number | null;
}

export interface NullStats {
  observed_score: number;
  target_rank: number | null;
  target_pool: number;
  target_percentile: number | null;
  source_rank: number | null;
  source_pool: number;
  source_percentile: number | null;
  shuffled_mean: number;
  shuffled_p95: number;
  shuffled_better_fraction: number;
  n_shuffles: number;
  within_mean: number;
  within_p95: number;
  within_better_fraction: number;
}

export interface PathwayContext {
  nulls: NullStats;
  topDescendingFromSource: { type: string; score: number }[];
  topSensoryToTarget: { type: string; score: number }[];
  robustness: { min_weight: number; route: string[] | null; score: number; hops: number | null }[];
  note: string;
}

export interface FemaleEdge {
  male_source: string;
  male_target: string;
  male_weight: number;
  male_relative_weight: number;
  female_source: string | null;
  female_target: string | null;
  found: boolean;
  female_weight: number | null;
  female_relative_weight: number | null;
  reason_missing: string | null;
}

export interface FemaleSpecific {
  routeTypes: { type: string; dimorphism: string | null; hasMaleCounterpart: boolean }[];
  femaleSpecificCount: number;
  sexuallyDimorphicCount: number;
  femaleSpecificTypesSample: string[];
  femaleSpecificTypeCount: number;
}

export interface FemaleComparison {
  femaleSpecific: FemaleSpecific;
  meta: {
    femaleDataset: string;
    femaleSource: string;
    note: string;
    source: string;
    target: string;
    min_weight: number;
    max_hops: number;
  };
  edges: FemaleEdge[];
  edgesFound: number;
  edgesTotal: number;
  missingTypes: string[];
  femaleRoutes: { nodes: string[]; hops: number; score: number }[];
  conservedRoutes: string[][];
  femaleRank: number | null;
  femalePool: number;
  femaleTopDescending: { type: string; score: number }[];
  femaleTargetScore: number;
}

export interface PathwayData {
  female?: FemaleComparison;
  context?: PathwayContext;
  meta: {
    title: string;
    subtitle: string;
    source: string;
    target: string;
    dataset: string;
    dataUrl: string;
    method: string;
    stageNames: Record<string, string>;
  };
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  routes: Route[];
  bottlenecks: Bottleneck[];
  removals: Record<string, RemovalEffect>;
}

export interface ExplorerData {
  meta: { max_hops: number; method: string };
  modality: Record<string, string>;
  sources: string[];
  targets: string[];
  results: Record<string, Record<string, { score: number; route: string[] }>>;
}

export type SomaData = Record<string, [number, number, number][]>;

export interface SkeletonEntry {
  bodyId: number;
  segments: number[];
}
export type SkeletonData = Record<string, SkeletonEntry[]>;

export interface CloudData {
  stride: number;
  positions: number[];
}

// One colour per anatomical stage, dark→bright along the pathway.
export const STAGE_COLORS: string[] = [
  "#38bdf8", // 0 photoreceptor
  "#22d3ee", // 1 lamina
  "#4ade80", // 2 medulla
  "#facc15", // 3 lobula projection
  "#fb923c", // 4 central brain
  "#f43f5e", // 5 descending neuron
];

export const EVIDENCE_LABEL: Record<Evidence["level"], string> = {
  "directly-mapped": "Directly mapped",
  "experimentally-supported": "Experimentally supported",
  "computationally-inferred": "Computationally inferred",
  unknown: "Unknown",
};

export const SEX_COLOR: Record<SexStatus["category"], string> = {
  shared: "#64748b",
  "male-specific": "#f43f5e",
  "potentially male-specific": "#fb923c",
  "sexually dimorphic": "#a855f7",
  unknown: "#475569",
};
