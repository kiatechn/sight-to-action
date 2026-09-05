import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { CloudData, PathwayNode, SkeletonData } from "./types";
import { STAGE_COLORS } from "./types";

interface Props {
  nodes: PathwayNode[];
  skeletons: SkeletonData;
  cloud: CloudData;
  activeStage: number; // -1 = show whole pathway evenly
  selectedType: string | null;
  onSelectType: (t: string | null) => void;
  hiddenTypes: Set<string>;
}

// MaleCNS voxel space -> Three.js: the long brain→nerve-cord axis is data Z,
// and low Z is the brain, so map it to -Y to stand the animal upright.
function toScene(x: number, y: number, z: number): [number, number, number] {
  return [x, -z, y];
}

function CloudPoints({ cloud }: { cloud: CloudData }) {
  const geometry = useMemo(() => {
    const src = cloud.positions;
    const arr = new Float32Array(src.length);
    for (let i = 0; i < src.length; i += 3) {
      const [x, y, z] = toScene(src[i], src[i + 1], src[i + 2]);
      arr[i] = x;
      arr[i + 1] = y;
      arr[i + 2] = z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, [cloud]);

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color="#334f74"
        size={0.0055}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </points>
  );
}

function TypeSkeleton({
  segments,
  color,
  emphasis,
  onClick,
}: {
  segments: Float32Array;
  color: string;
  emphasis: "active" | "seen" | "muted";
  onClick: () => void;
}) {
  const matRef = useRef<THREE.LineBasicMaterial>(null);
  const current = useRef(0);

  const target = emphasis === "active" ? 1 : emphasis === "seen" ? 0.5 : 0.08;

  useFrame((_, delta) => {
    if (!matRef.current) return;
    current.current += (target - current.current) * Math.min(1, delta * 5);
    matRef.current.opacity = 0.08 + current.current * 0.92;
  });

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(segments, 3));
    return g;
  }, [segments]);

  return (
    <lineSegments
      geometry={geometry}
      frustumCulled={false}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <lineBasicMaterial
        ref={matRef}
        color={color}
        transparent
        opacity={0.5}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

/** Glides the orbit target to whatever is currently emphasised, then hands
 *  control straight back to the user (no fighting with OrbitControls). */
function Rig({
  focus,
  controls,
}: {
  focus: { centre: THREE.Vector3; radius: number } | null;
  controls: React.RefObject<any>;
}) {
  const { camera } = useThree();
  const animating = useRef(0);
  const goalTarget = useRef(new THREE.Vector3());
  const goalPos = useRef(new THREE.Vector3());

  const key = focus ? `${focus.centre.toArray().map((v) => v.toFixed(3)).join(",")}|${focus.radius.toFixed(3)}` : "none";
  const lastKey = useRef("");

  useFrame((_, delta) => {
    const ctrl = controls.current;
    if (!ctrl || !focus) return;

    if (key !== lastKey.current) {
      lastKey.current = key;
      // distance that makes the bounding sphere fill most of the viewport
      const cam = camera as THREE.PerspectiveCamera;
      const vFov = (cam.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * cam.aspect);
      const dist = (focus.radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.15;

      const dir = camera.position.clone().sub(ctrl.target);
      if (!Number.isFinite(dir.x) || dir.lengthSq() < 1e-6) dir.set(0.4, 0.15, 1);
      dir.normalize();

      goalTarget.current.copy(focus.centre);
      goalPos.current.copy(focus.centre).add(dir.multiplyScalar(dist));
      animating.current = 1.5; // seconds of assisted movement, then user drives
    }

    if (animating.current > 0) {
      animating.current -= delta;
      const k = Math.min(1, delta * 2.4);
      camera.position.lerp(goalPos.current, k);
      ctrl.target.lerp(goalTarget.current, k);
      ctrl.update();
    }
  });
  return null;
}

export default function BrainScene({
  nodes,
  skeletons,
  cloud,
  activeStage,
  selectedType,
  onSelectType,
  hiddenTypes,
}: Props) {
  const controlsRef = useRef<any>(null);
  const stageOf = useMemo(
    () => new Map(nodes.map((n) => [n.type, n.stage])),
    [nodes],
  );

  const meshes = useMemo(() => {
    const out: { type: string; stage: number; positions: Float32Array }[] = [];
    for (const [type, entries] of Object.entries(skeletons)) {
      const stage = stageOf.get(type) ?? 0;
      const total = entries.reduce((s, e) => s + e.segments.length, 0);
      const arr = new Float32Array(total);
      let o = 0;
      for (const e of entries) {
        for (let i = 0; i < e.segments.length; i += 3) {
          const [x, y, z] = toScene(e.segments[i], e.segments[i + 1], e.segments[i + 2]);
          arr[o++] = x;
          arr[o++] = y;
          arr[o++] = z;
        }
      }
      out.push({ type, stage, positions: arr });
    }
    return out.sort((a, b) => a.stage - b.stage);
  }, [skeletons, stageOf]);

  // Camera framing: bounding sphere of whatever is currently emphasised, so
  // the view actually fills the viewport instead of sitting tiny in the middle.
  const focus = useMemo(() => {
    const relevant = meshes.filter((m) => {
      if (hiddenTypes.has(m.type)) return false;
      if (selectedType) return m.type === selectedType;
      if (activeStage < 0) return true; // frame the whole pathway
      return m.stage === activeStage;
    });
    if (!relevant.length) return null;

    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    for (const m of relevant) {
      for (let i = 0; i < m.positions.length; i += 3) {
        box.expandByPoint(v.set(m.positions[i], m.positions[i + 1], m.positions[i + 2]));
      }
    }
    if (box.isEmpty()) return null;
    const centre = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.05);
    return { centre, radius };
  }, [meshes, activeStage, selectedType, hiddenTypes]);

  return (
    <Canvas
      camera={{ position: [1.6, 0.4, 1.9], fov: 45, near: 0.01, far: 100 }}
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onPointerMissed={() => onSelectType(null)}
    >
      <color attach="background" args={["#070b14"]} />
      <CloudPoints cloud={cloud} />
      {meshes.map((m) => {
        if (hiddenTypes.has(m.type)) return null;
        let emphasis: "active" | "seen" | "muted";
        if (selectedType) {
          emphasis = m.type === selectedType ? "active" : "muted";
        } else if (activeStage < 0) {
          emphasis = "seen";
        } else if (m.stage === activeStage) {
          emphasis = "active";
        } else if (m.stage < activeStage) {
          emphasis = "seen";
        } else {
          emphasis = "muted";
        }
        return (
          <TypeSkeleton
            key={m.type}
            segments={m.positions}
            color={STAGE_COLORS[m.stage] ?? "#94a3b8"}
            emphasis={emphasis}
            onClick={() => onSelectType(m.type)}
          />
        );
      })}
      <Rig focus={focus} controls={controlsRef} />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={0.3}
        maxDistance={5}
        enableDamping
      />
    </Canvas>
  );
}
