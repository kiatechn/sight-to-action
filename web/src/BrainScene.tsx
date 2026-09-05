import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";
import type { Scene3DData } from "./types";
import { TIER_COLORS } from "./types";

interface Props {
  scene: Scene3DData;
  visibleTypes: Set<string>;
  activeUpTo: number; // -1 = nothing lit, else tiers [0..activeUpTo] are lit
  phase: "idle" | "intro" | "signal" | "outcome";
}

function BackgroundCloud({ points }: { points: [number, number, number][] }) {
  const positions = useMemo(() => new Float32Array(points.flat()), [points]);
  return (
    <Points positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#3b4a6b"
        size={0.006}
        sizeAttenuation
        depthWrite={false}
        opacity={0.35}
      />
    </Points>
  );
}

function TierGroup({
  positions,
  color,
  lit,
  baseSize,
}: {
  positions: Float32Array;
  color: string;
  lit: boolean;
  baseSize: number;
}) {
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const pulse = useRef(0);

  useFrame((_, delta) => {
    if (!materialRef.current) return;
    if (lit) {
      pulse.current = Math.min(1, pulse.current + delta * 4);
    } else {
      pulse.current = Math.max(0, pulse.current - delta * 3);
    }
    const size = baseSize * (1 + pulse.current * 1.8);
    materialRef.current.size = size;
    materialRef.current.opacity = 0.35 + pulse.current * 0.65;
  });

  if (positions.length === 0) return null;

  return (
    <Points positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        ref={materialRef}
        transparent
        color={lit ? "#fde68a" : color}
        size={baseSize}
        sizeAttenuation
        depthWrite={false}
        opacity={0.35}
      />
    </Points>
  );
}

function CameraRig({ phase }: { phase: Props["phase"] }) {
  const targetDistance = useRef(2.6);

  useFrame(({ camera }, delta) => {
    const goal = phase === "signal" || phase === "outcome" ? 1.15 : 2.6;
    targetDistance.current += (goal - targetDistance.current) * Math.min(1, delta * 1.5);
    const dir = camera.position.clone().normalize();
    camera.position.copy(dir.multiplyScalar(targetDistance.current));
  });
  return null;
}

export default function BrainScene({ scene, visibleTypes, activeUpTo, phase }: Props) {
  const tierPositions = useMemo(() => {
    const buckets: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [] };
    for (const n of scene.neurons) {
      if (!visibleTypes.has(n.type)) continue;
      buckets[n.tier]?.push(...n.position);
    }
    return Object.fromEntries(
      Object.entries(buckets).map(([tier, arr]) => [tier, new Float32Array(arr)]),
    ) as Record<number, Float32Array>;
  }, [scene, visibleTypes]);

  return (
    <Canvas
      camera={{ position: [1.8, 1.2, 2.2], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{ preserveDrawingBuffer: true }}
    >
      <color attach="background" args={["#05070c"]} />
      <ambientLight intensity={0.6} />
      <BackgroundCloud points={scene.backgroundCloud} />
      {[0, 1, 2, 3].map((tier) => (
        <TierGroup
          key={tier}
          positions={tierPositions[tier] ?? new Float32Array()}
          color={TIER_COLORS[tier]}
          lit={activeUpTo >= tier}
          baseSize={tier === 0 ? 0.014 : 0.03}
        />
      ))}
      <CameraRig phase={phase} />
      <OrbitControls enablePan={false} minDistance={0.6} maxDistance={4} />
    </Canvas>
  );
}
