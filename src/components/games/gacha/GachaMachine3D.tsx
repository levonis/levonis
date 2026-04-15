import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox, Environment } from "@react-three/drei";
import * as THREE from "three";

const THEME_COLORS: Record<string, { body: string; bodyDark: string; accent: string; knob: string; topBtn: string }> = {
  default: { body: "#DC2626", bodyDark: "#991B1B", accent: "#FDE68A", knob: "#FBBF24", topBtn: "#EF4444" },
  doll: { body: "#EC4899", bodyDark: "#BE185D", accent: "#FBCFE8", knob: "#C084FC", topBtn: "#F472B6" },
  coupon: { body: "#16A34A", bodyDark: "#166534", accent: "#BBF7D0", knob: "#4ADE80", topBtn: "#22C55E" },
  premium: { body: "#D97706", bodyDark: "#92400E", accent: "#FDE68A", knob: "#F59E0B", topBtn: "#FBBF24" },
  points: { body: "#7C3AED", bodyDark: "#5B21B6", accent: "#DDD6FE", knob: "#A78BFA", topBtn: "#8B5CF6" },
};

const CAPSULE_COLORS = ["#EF4444", "#3B82F6", "#22C55E", "#A855F7", "#F59E0B", "#EC4899", "#06B6D4", "#F97316"];

interface Props {
  theme?: string;
  spinning?: boolean;
  onKnobClick?: () => void;
}

function Capsule({ position, color, spinning }: { position: [number, number, number]; color: string; spinning?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const offset = useMemo(() => Math.random() * Math.PI * 2, []);
  const speed = useMemo(() => 0.3 + Math.random() * 0.5, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    if (spinning) {
      ref.current.position.y += Math.sin(Date.now() * 0.005 + offset) * delta * 0.3;
      ref.current.rotation.z += delta * speed;
      ref.current.rotation.x += delta * speed * 0.5;
    } else {
      ref.current.rotation.z += delta * 0.05;
    }
  });

  const darkerColor = new THREE.Color(color).multiplyScalar(0.7).getStyle();

  return (
    <group ref={ref} position={position}>
      {/* Top half */}
      <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.18, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Bottom half */}
      <mesh position={[0, -0.05, 0]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[0.18, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={darkerColor} roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Split ring */}
      <mesh>
        <torusGeometry args={[0.18, 0.012, 8, 16]} />
        <meshStandardMaterial color="#222" roughness={0.5} />
      </mesh>
    </group>
  );
}

function GlassDome({ capsulePositions, spinning }: { capsulePositions: [number, number, number][]; spinning?: boolean }) {
  return (
    <group position={[0, 1.1, 0]}>
      {/* Glass cylinder */}
      <mesh>
        <cylinderGeometry args={[0.95, 0.95, 1.6, 32, 1, true]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transparent
          opacity={0.15}
          roughness={0.05}
          metalness={0}
          transmission={0.85}
          thickness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Glass top cap */}
      <mesh position={[0, 0.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.95, 32]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.1} roughness={0.05} transmission={0.9} side={THREE.DoubleSide} />
      </mesh>
      {/* Capsules inside */}
      {capsulePositions.map((pos, i) => (
        <Capsule key={i} position={pos} color={CAPSULE_COLORS[i % CAPSULE_COLORS.length]} spinning={spinning} />
      ))}
    </group>
  );
}

function Knob({ color, spinning, onClick }: { color: string; spinning?: boolean; onClick?: () => void }) {
  const knobRef = useRef<THREE.Group>(null);
  const targetRotation = useRef(0);
  const currentRotation = useRef(0);

  useEffect(() => {
    if (spinning) {
      targetRotation.current += Math.PI * 2;
    }
  }, [spinning]);

  useFrame((_, delta) => {
    if (!knobRef.current) return;
    currentRotation.current += (targetRotation.current - currentRotation.current) * delta * 4;
    knobRef.current.rotation.z = currentRotation.current;
  });

  return (
    <group ref={knobRef} position={[0.55, -0.15, 0.45]} onClick={onClick}>
      {/* Knob sphere */}
      <mesh>
        <sphereGeometry args={[0.2, 24, 24]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.6} />
      </mesh>
      {/* Knob arm */}
      <mesh position={[0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.25, 8]} />
        <meshStandardMaterial color="#333" roughness={0.4} metalness={0.5} />
      </mesh>
      {/* Knob cap */}
      <mesh position={[0.27, 0, 0]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color="#333" roughness={0.3} metalness={0.4} />
      </mesh>
    </group>
  );
}

function MachineBody({ colors, spinning, onKnobClick }: { colors: typeof THEME_COLORS["default"]; spinning?: boolean; onKnobClick?: () => void }) {
  const bodyRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!bodyRef.current) return;
    if (spinning) {
      bodyRef.current.rotation.z = Math.sin(Date.now() * 0.02) * 0.02;
    } else {
      bodyRef.current.rotation.z *= 0.9;
    }
  });

  return (
    <group ref={bodyRef}>
      {/* Main body */}
      <RoundedBox args={[2, 1, 1]} radius={0.08} position={[0, -0.1, 0]}>
        <meshStandardMaterial color={colors.body} roughness={0.4} metalness={0.2} />
      </RoundedBox>

      {/* Gold decorative strip */}
      <mesh position={[0, 0.25, 0.51]}>
        <planeGeometry args={[1.8, 0.08]} />
        <meshStandardMaterial color={colors.accent} roughness={0.3} metalness={0.5} />
      </mesh>

      {/* Dot decorations on strip */}
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={i} position={[-0.8 + i * 0.2, 0.25, 0.52]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color={colors.accent} roughness={0.2} metalness={0.6} />
        </mesh>
      ))}

      {/* Dispensing slot */}
      <mesh position={[-0.5, -0.35, 0.51]}>
        <planeGeometry args={[0.5, 0.25]} />
        <meshStandardMaterial color="#111" roughness={0.8} />
      </mesh>
      {/* Slot frame */}
      <RoundedBox args={[0.55, 0.3, 0.05]} radius={0.02} position={[-0.5, -0.35, 0.5]}>
        <meshStandardMaterial color={colors.bodyDark} roughness={0.4} metalness={0.3} />
      </RoundedBox>

      {/* Knob */}
      <Knob color={colors.knob} spinning={spinning} onClick={onKnobClick} />
    </group>
  );
}

function TopButton({ color }: { color: string }) {
  return (
    <mesh position={[0, 2.05, 0]}>
      <sphereGeometry args={[0.15, 16, 16]} />
      <meshStandardMaterial color={color} roughness={0.3} metalness={0.3} />
    </mesh>
  );
}

function GoldenBase() {
  return (
    <RoundedBox args={[2.2, 0.2, 1.1]} radius={0.04} position={[0, -0.72, 0]}>
      <meshStandardMaterial color="#D4A017" roughness={0.3} metalness={0.5} />
    </RoundedBox>
  );
}

function GachaMachineScene({ theme, spinning, onKnobClick }: Props) {
  const colors = THEME_COLORS[theme || "default"] || THEME_COLORS.default;

  const capsulePositions = useMemo<[number, number, number][]>(() => {
    const positions: [number, number, number][] = [];
    for (let i = 0; i < 12; i++) {
      positions.push([
        (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 1.0,
        (Math.random() - 0.5) * 0.6,
      ]);
    }
    return positions;
  }, []);

  return (
    <>
      <ambientLight intensity={0.5} />
      <spotLight position={[3, 5, 5]} angle={0.5} penumbra={0.5} intensity={1.2} castShadow />
      <pointLight position={[-3, 2, 3]} intensity={0.4} color="#fff" />

      <group position={[0, -0.3, 0]}>
        <TopButton color={colors.topBtn} />
        <GlassDome capsulePositions={capsulePositions} spinning={spinning} />
        <MachineBody colors={colors} spinning={spinning} onKnobClick={onKnobClick} />
        <GoldenBase />
      </group>

      <Environment preset="studio" />
    </>
  );
}

export default function GachaMachine3D({ theme = "default", spinning = false, onKnobClick }: Props) {
  return (
    <div className="w-full aspect-[3/4] max-w-[300px] mx-auto cursor-pointer">
      <Canvas
        camera={{ position: [0, 0.5, 4], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <GachaMachineScene theme={theme} spinning={spinning} onKnobClick={onKnobClick} />
      </Canvas>
    </div>
  );
}
