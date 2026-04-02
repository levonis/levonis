import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Stars } from "@react-three/drei";

// Stage definitions based on score
export type StageName = "city" | "clouds" | "atmosphere" | "space" | "moon" | "jupiter" | "sun" | "galaxy";

export function getStage(score: number): StageName {
  if (score <= 25) return "city";
  if (score <= 50) return "clouds";
  if (score <= 75) return "atmosphere";
  if (score <= 100) return "space";
  if (score <= 200) return "moon";
  if (score <= 400) return "jupiter";
  if (score <= 1000) return "sun";
  return "galaxy";
}

interface StageConfig {
  bgTop: string;
  bgBottom: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  ambientColor: string;
  ambientIntensity: number;
  showStars: boolean;
  starCount: number;
}

const STAGE_CONFIGS: Record<StageName, StageConfig> = {
  city: {
    bgTop: "#5da9e9", bgBottom: "#a8d8ea",
    fogColor: "#a8d8ea", fogNear: 12, fogFar: 40,
    ambientColor: "#ffeaa7", ambientIntensity: 0.6,
    showStars: false, starCount: 0,
  },
  clouds: {
    bgTop: "#4a90c4", bgBottom: "#c8e6f5",
    fogColor: "#d5e8f5", fogNear: 10, fogFar: 35,
    ambientColor: "#dfe6e9", ambientIntensity: 0.5,
    showStars: false, starCount: 0,
  },
  atmosphere: {
    bgTop: "#0c1445", bgBottom: "#2d4a7a",
    fogColor: "#1a2a4a", fogNear: 10, fogFar: 40,
    ambientColor: "#74b9ff", ambientIntensity: 0.4,
    showStars: true, starCount: 500,
  },
  space: {
    bgTop: "#050510", bgBottom: "#0a0a2e",
    fogColor: "#050510", fogNear: 15, fogFar: 60,
    ambientColor: "#6c5ce7", ambientIntensity: 0.3,
    showStars: true, starCount: 3000,
  },
  moon: {
    bgTop: "#020208", bgBottom: "#0a0a20",
    fogColor: "#020208", fogNear: 15, fogFar: 60,
    ambientColor: "#dfe6e9", ambientIntensity: 0.35,
    showStars: true, starCount: 4000,
  },
  jupiter: {
    bgTop: "#0a0508", bgBottom: "#1a0a15",
    fogColor: "#0a0508", fogNear: 15, fogFar: 60,
    ambientColor: "#e17055", ambientIntensity: 0.3,
    showStars: true, starCount: 4000,
  },
  sun: {
    bgTop: "#1a0800", bgBottom: "#2d1000",
    fogColor: "#1a0800", fogNear: 15, fogFar: 60,
    ambientColor: "#fdcb6e", ambientIntensity: 0.5,
    showStars: true, starCount: 3000,
  },
  galaxy: {
    bgTop: "#050005", bgBottom: "#100520",
    fogColor: "#050005", fogNear: 20, fogFar: 80,
    ambientColor: "#a29bfe", ambientIntensity: 0.4,
    showStars: true, starCount: 6000,
  },
};

// ─── Floating Objects ────────────────────────────────────

function CityBuildings({ baseY }: { baseY: number }) {
  const buildings = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const radius = 8 + Math.random() * 6;
      const height = 1 + Math.random() * 4;
      const width = 0.3 + Math.random() * 0.6;
      arr.push({
        pos: [Math.cos(angle) * radius, baseY - 2 + height / 2, Math.sin(angle) * radius] as [number, number, number],
        size: [width, height, width] as [number, number, number],
        color: `hsl(${200 + Math.random() * 30}, ${10 + Math.random() * 15}%, ${30 + Math.random() * 25}%)`,
      });
    }
    return arr;
  }, [baseY]);

  return (
    <>
      {buildings.map((b, i) => (
        <mesh key={i} position={b.pos}>
          <boxGeometry args={b.size} />
          <meshStandardMaterial color={b.color} />
        </mesh>
      ))}
      {/* Ground plane */}
      <mesh position={[0, baseY - 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#2d5016" />
      </mesh>
    </>
  );
}

function CloudsLayer({ baseY }: { baseY: number }) {
  const ref = useRef<THREE.Group>(null);
  const clouds = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 15; i++) {
      const angle = (i / 15) * Math.PI * 2 + Math.random();
      const radius = 6 + Math.random() * 8;
      arr.push({
        pos: [Math.cos(angle) * radius, baseY + Math.random() * 4 - 2, Math.sin(angle) * radius] as [number, number, number],
        scale: 0.5 + Math.random() * 1.5,
        speed: 0.1 + Math.random() * 0.3,
      });
    }
    return arr;
  }, [baseY]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.02;
  });

  return (
    <group ref={ref}>
      {clouds.map((c, i) => (
        <mesh key={i} position={c.pos} scale={c.scale}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.3} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function FlyingObject({ type, baseY }: { type: "plane" | "bird"; baseY: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const config = useMemo(() => ({
    radius: 7 + Math.random() * 5,
    speed: type === "plane" ? 0.3 + Math.random() * 0.2 : 0.5 + Math.random() * 0.4,
    height: baseY + Math.random() * 3 - 1,
    offset: Math.random() * Math.PI * 2,
    scale: type === "plane" ? 0.2 : 0.08,
  }), [type, baseY]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * config.speed + config.offset;
    ref.current.position.x = Math.cos(t) * config.radius;
    ref.current.position.z = Math.sin(t) * config.radius;
    ref.current.position.y = config.height + Math.sin(t * 2) * 0.3;
    ref.current.rotation.y = -t + Math.PI / 2;
  });

  return (
    <mesh ref={ref}>
      <coneGeometry args={[config.scale, config.scale * 3, type === "plane" ? 4 : 3]} />
      <meshStandardMaterial color={type === "plane" ? "#b2bec3" : "#2d3436"} />
    </mesh>
  );
}

function Satellites({ baseY }: { baseY: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const sats = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 6; i++) {
      arr.push({
        radius: 6 + Math.random() * 6,
        speed: 0.15 + Math.random() * 0.2,
        tilt: Math.random() * 0.5,
        offset: Math.random() * Math.PI * 2,
        y: baseY + Math.random() * 4 - 2,
      });
    }
    return arr;
  }, [baseY]);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      const s = sats[i];
      const t = state.clock.elapsedTime * s.speed + s.offset;
      child.position.x = Math.cos(t) * s.radius;
      child.position.z = Math.sin(t) * s.radius;
      child.position.y = s.y + Math.sin(t * 0.5) * s.tilt;
      child.rotation.y = t;
    });
  });

  return (
    <group ref={groupRef}>
      {sats.map((_, i) => (
        <group key={i}>
          <mesh>
            <boxGeometry args={[0.08, 0.08, 0.08]} />
            <meshStandardMaterial color="#b2bec3" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Solar panels */}
          <mesh position={[0.15, 0, 0]}>
            <boxGeometry args={[0.15, 0.01, 0.06]} />
            <meshStandardMaterial color="#2d4a7a" metalness={0.5} />
          </mesh>
          <mesh position={[-0.15, 0, 0]}>
            <boxGeometry args={[0.15, 0.01, 0.06]} />
            <meshStandardMaterial color="#2d4a7a" metalness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CelestialBody({ type, baseY }: { type: "moon" | "jupiter" | "sun"; baseY: number }) {
  const ref = useRef<THREE.Mesh>(null);
  
  const config = useMemo(() => {
    switch (type) {
      case "moon":
        return { size: 3, color: "#dfe6e9", emissive: "#636e72", emissiveI: 0.2, x: -10, y: baseY + 8, z: -12 };
      case "jupiter":
        return { size: 5, color: "#c4843e", emissive: "#8b5e34", emissiveI: 0.15, x: 12, y: baseY + 10, z: -15 };
      case "sun":
        return { size: 6, color: "#ffeaa7", emissive: "#fdcb6e", emissiveI: 1.0, x: -8, y: baseY + 12, z: -18 };
    }
  }, [type, baseY]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.05;
  });

  return (
    <group>
      <mesh ref={ref} position={[config.x, config.y, config.z]}>
        <sphereGeometry args={[config.size, 32, 32]} />
        <meshStandardMaterial
          color={config.color}
          emissive={config.emissive}
          emissiveIntensity={config.emissiveI}
          roughness={type === "sun" ? 0.1 : 0.8}
          metalness={type === "sun" ? 0 : 0.1}
        />
      </mesh>
      {type === "sun" && (
        <pointLight position={[config.x, config.y, config.z]} color="#fdcb6e" intensity={2} distance={40} />
      )}
      {type === "jupiter" && (
        <>
          {/* Jupiter bands */}
          <mesh position={[config.x, config.y, config.z]} rotation={[0.1, 0, 0]}>
            <torusGeometry args={[5.2, 0.15, 8, 64]} />
            <meshStandardMaterial color="#a0865a" transparent opacity={0.3} />
          </mesh>
        </>
      )}
    </group>
  );
}

function GalaxySpiral({ baseY }: { baseY: number }) {
  const ref = useRef<THREE.Group>(null);
  const nebulae = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 40; i++) {
      const angle = (i / 40) * Math.PI * 6;
      const radius = 2 + (i / 40) * 10;
      arr.push({
        pos: [Math.cos(angle) * radius, baseY + 10 + Math.random() * 3, Math.sin(angle) * radius - 15] as [number, number, number],
        color: `hsl(${260 + Math.random() * 60}, ${60 + Math.random() * 30}%, ${40 + Math.random() * 30}%)`,
        scale: 0.3 + Math.random() * 0.8,
      });
    }
    return arr;
  }, [baseY]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.03;
  });

  return (
    <group ref={ref} position={[0, 0, -20]}>
      {nebulae.map((n, i) => (
        <mesh key={i} position={n.pos} scale={n.scale}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial color={n.color} transparent opacity={0.15} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Background Gradient Plane ────────────────────────────

function BackgroundGradient({ topColor, bottomColor, cameraY }: { topColor: string; bottomColor: string; cameraY: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, topColor);
    gradient.addColorStop(1, bottomColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 256);
    const texture = new THREE.CanvasTexture(canvas);
    return new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, depthWrite: false, fog: false });
  }, [topColor, bottomColor]);

  useFrame(() => {
    if (ref.current) {
      ref.current.position.y = cameraY;
    }
  });

  return (
    <mesh ref={ref} scale={[80, 80, 80]} renderOrder={-1}>
      <sphereGeometry args={[1, 16, 16]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

// ─── Main Environment Component ────────────────────────────

interface EnvironmentProps {
  score: number;
  cameraY: number;
}

export default function StackEnvironment({ score, cameraY }: EnvironmentProps) {
  const stage = getStage(score);
  const config = STAGE_CONFIGS[stage];
  const baseY = cameraY - 3;

  return (
    <>
      {/* Background */}
      <BackgroundGradient topColor={config.bgTop} bottomColor={config.bgBottom} cameraY={cameraY} />
      
      {/* Fog */}
      <fog attach="fog" args={[config.fogColor, config.fogNear, config.fogFar]} />
      
      {/* Ambient Light */}
      <ambientLight intensity={config.ambientIntensity} color={config.ambientColor} />

      {/* Stars */}
      {config.showStars && (
        <Stars radius={100} depth={50} count={config.starCount} factor={4} saturation={0.1} fade speed={0.3} />
      )}

      {/* Stage-specific elements */}
      {stage === "city" && (
        <>
          <CityBuildings baseY={baseY} />
          {/* Sun */}
          <mesh position={[15, baseY + 15, -10]}>
            <sphereGeometry args={[2, 16, 16]} />
            <meshBasicMaterial color="#ffeaa7" />
          </mesh>
          <pointLight position={[15, baseY + 15, -10]} color="#ffeaa7" intensity={1} distance={50} />
        </>
      )}

      {stage === "clouds" && (
        <>
          <CloudsLayer baseY={baseY} />
          <FlyingObject type="plane" baseY={baseY} />
          <FlyingObject type="plane" baseY={baseY + 2} />
          <FlyingObject type="bird" baseY={baseY - 1} />
          <FlyingObject type="bird" baseY={baseY} />
          <FlyingObject type="bird" baseY={baseY + 1} />
        </>
      )}

      {stage === "atmosphere" && (
        <>
          <Satellites baseY={baseY} />
          <CloudsLayer baseY={baseY - 5} />
          {/* Earth glow below */}
          <mesh position={[0, baseY - 12, 0]}>
            <sphereGeometry args={[8, 32, 32]} />
            <meshStandardMaterial color="#1e90ff" emissive="#1e90ff" emissiveIntensity={0.1} transparent opacity={0.2} />
          </mesh>
        </>
      )}

      {stage === "space" && (
        <>
          <Satellites baseY={baseY} />
          {/* Distant Earth */}
          <mesh position={[8, baseY - 8, -10]}>
            <sphereGeometry args={[2, 32, 32]} />
            <meshStandardMaterial color="#1e90ff" emissive="#0984e3" emissiveIntensity={0.3} />
          </mesh>
        </>
      )}

      {stage === "moon" && (
        <CelestialBody type="moon" baseY={baseY} />
      )}

      {stage === "jupiter" && (
        <CelestialBody type="jupiter" baseY={baseY} />
      )}

      {stage === "sun" && (
        <CelestialBody type="sun" baseY={baseY} />
      )}

      {stage === "galaxy" && (
        <GalaxySpiral baseY={baseY} />
      )}
    </>
  );
}
