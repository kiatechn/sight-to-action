import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
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
  soma: Record<string, [number, number, number][]>;
  overlayRoute: string[] | null;
  overlayStep: number;
  /** Which animal's brain is on screen. The two datasets are in different
   *  template spaces, so they are shown one at a time and never overlaid. */
  brain: "male" | "female";
  cloudOverride: CloudData | null;
}

const MIN_DIST = 0.25;
const MAX_DIST = 5;

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
    const dt = Math.min(delta, 0.05);
    current.current += (target - current.current) * Math.min(1, dt * 5);
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

/** Colour along a route: cool at the sensory end, hot at the motor end. */
function routeColor(i: number, n: number) {
  const c = new THREE.Color("#38bdf8");
  return c.lerp(new THREE.Color("#f43f5e"), n <= 1 ? 0 : i / (n - 1));
}

/**
 * Draws an arbitrary explored route at real soma positions.
 *
 * Full EM morphology is only shipped for the featured pathway (skeletons for
 * all ~11k cell types would be hundreds of megabytes, and the bucket sends no
 * CORS headers so they cannot be fetched on demand). Every cell type does have
 * a real soma centroid though, so an explored route is drawn as markers at
 * true anatomical locations joined in order.
 */
function RouteOverlay({
  route,
  soma,
  step,
  onSelectType,
}: {
  route: string[];
  soma: Record<string, [number, number, number][]>;
  step: number;
  onSelectType: (t: string) => void;
}) {
  const points = useMemo(() => {
    const out: { type: string; pos: THREE.Vector3 }[] = [];
    let prev: THREE.Vector3 | null = null;
    for (const type of route) {
      const options = soma[type];
      if (!options?.length) continue;
      // pick the side that keeps the chain anatomically coherent
      let best = options[0];
      if (prev) {
        let bestD = Infinity;
        for (const o of options) {
          const [x, y, z] = toScene(o[0], o[1], o[2]);
          const d = prev.distanceToSquared(new THREE.Vector3(x, y, z));
          if (d < bestD) {
            bestD = d;
            best = o;
          }
        }
      }
      const [x, y, z] = toScene(best[0], best[1], best[2]);
      const v = new THREE.Vector3(x, y, z);
      out.push({ type, pos: v });
      prev = v;
    }
    return out;
  }, [route, soma]);

  const lineGeometry = useMemo(() => {
    const verts: number[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      verts.push(...points[i].pos.toArray(), ...points[i + 1].pos.toArray());
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
    return g;
  }, [points]);

  if (!points.length) return null;

  return (
    <group>
      <lineSegments geometry={lineGeometry} frustumCulled={false}>
        <lineBasicMaterial color="#e2e8f0" transparent opacity={0.5} depthWrite={false} />
      </lineSegments>
      {points.map((p, i) => {
        const lit = step < 0 || i <= step;
        return (
          <mesh
            key={`${p.type}-${i}`}
            position={p.pos}
            onClick={(e) => {
              e.stopPropagation();
              onSelectType(p.type);
            }}
          >
            <sphereGeometry args={[lit ? 0.012 : 0.007, 16, 16]} />
            <meshBasicMaterial
              color={lit ? routeColor(i, points.length) : "#475569"}
              transparent
              opacity={lit ? 1 : 0.4}
            />
          </mesh>
        );
      })}
      {points.map((p, i) => (
        <Html key={`label-${p.type}-${i}`} position={p.pos} center distanceFactor={1.6}>
          <div className={`scene-label ${step < 0 || i <= step ? "" : "dim"}`}>{p.type}</div>
        </Html>
      ))}
    </group>
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

  // As soon as the viewer grabs the camera, stop assisting — otherwise the
  // rig keeps lerping towards its goal and drags against the pointer.
  useEffect(() => {
    const ctrl = controls.current;
    if (!ctrl) return;
    const cancel = () => {
      animating.current = 0;
    };
    ctrl.addEventListener("start", cancel);
    return () => ctrl.removeEventListener("start", cancel);
  }, [controls]);

  useFrame((_, delta) => {
    const ctrl = controls.current;
    if (!ctrl || !focus) return;

    if (key !== lastKey.current) {
      lastKey.current = key;
      // distance that makes the bounding sphere fill most of the viewport,
      // clamped into the OrbitControls range — otherwise the controls clamp
      // it while the rig keeps lerping and the camera visibly judders
      const cam = camera as THREE.PerspectiveCamera;
      const vFov = (cam.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * cam.aspect);
      const raw = (focus.radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.15;
      const dist = Math.min(Math.max(raw, MIN_DIST + 0.02), MAX_DIST - 0.02);

      const dir = camera.position.clone().sub(ctrl.target);
      if (!Number.isFinite(dir.x) || dir.lengthSq() < 1e-6) dir.set(0.4, 0.15, 1);
      dir.normalize();

      goalTarget.current.copy(focus.centre);
      goalPos.current.copy(focus.centre).add(dir.multiplyScalar(dist));
      animating.current = 1.5; // seconds of assisted movement, then user drives
    }

    if (animating.current > 0) {
      // clamp delta: after any frame hitch (tab switch, GC, heavy re-render)
      // an unclamped delta makes k reach 1 and the camera visibly snaps
      const dt = Math.min(delta, 0.05);
      animating.current -= dt;
      const k = Math.min(1, dt * 2.4);
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
  soma,
  overlayRoute,
  overlayStep,
  brain,
  cloudOverride,
}: Props) {
  const activeCloud = cloudOverride ?? cloud;
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

    const box = new THREE.Box3();
    const v = new THREE.Vector3();

    // an explored route takes priority for framing
    if (overlayRoute?.length) {
      for (const type of overlayRoute) {
        for (const o of soma[type] ?? []) {
          const [x, y, z] = toScene(o[0], o[1], o[2]);
          box.expandByPoint(v.set(x, y, z));
        }
      }
    } else if (brain === "female") {
      // no skeletons for the female dataset, so frame the cloud itself
      const src = activeCloud.positions;
      for (let i = 0; i < src.length; i += 3) {
        const [x, y, z] = toScene(src[i], src[i + 1], src[i + 2]);
        box.expandByPoint(v.set(x, y, z));
      }
    } else {
      if (!relevant.length) return null;
      for (const m of relevant) {
        for (let i = 0; i < m.positions.length; i += 3) {
          box.expandByPoint(v.set(m.positions[i], m.positions[i + 1], m.positions[i + 2]));
        }
      }
    }
    if (box.isEmpty()) return null;
    const centre = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.05);
    return { centre, radius };
  }, [meshes, activeStage, selectedType, hiddenTypes, overlayRoute, soma, brain, activeCloud]);

  return (
    <Canvas
      camera={{ position: [1.6, 0.4, 1.9], fov: 45, near: 0.01, far: 100 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onPointerMissed={() => onSelectType(null)}
    >
      <color attach="background" args={["#070b14"]} />
      <CloudPoints cloud={activeCloud} />
      {brain === "male" && meshes.map((m) => {
        if (hiddenTypes.has(m.type)) return null;
        let emphasis: "active" | "seen" | "muted";
        if (overlayRoute?.length) {
          emphasis = overlayRoute.includes(m.type) ? "active" : "muted";
        } else if (selectedType) {
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
      {overlayRoute?.length ? (
        <RouteOverlay
          route={overlayRoute}
          soma={soma}
          step={overlayStep}
          onSelectType={onSelectType}
        />
      ) : null}
      <Rig focus={focus} controls={controlsRef} />
      {/* damping off: drei's OrbitControls and the rig would otherwise both
          call update() each frame and visibly fight over the camera */}
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={MIN_DIST}
        maxDistance={MAX_DIST}
        enableDamping={false}
      />
    </Canvas>
  );
}
