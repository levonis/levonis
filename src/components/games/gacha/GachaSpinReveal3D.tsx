import { useState, useEffect, useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Text } from "@react-three/drei";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface SpinResult {
  spin_id: string;
  prize_type: string;
  prize_name: string;
  prize_name_ar: string;
  prize_image_url?: string;
  points_value?: number;
  rarity?: { name: string; name_ar: string; color: string; glow_color: string } | null;
  is_guaranteed: boolean;
}

type Phase = "knob" | "drop" | "center" | "split" | "revealed";

const PRIZE_EMOJI: Record<string, string> = {
  doll: "🧸",
  coupon: "🎟️",
  points: "⭐",
  advice: "💡",
};

/* ---------- 3D Sub-components ---------- */

function CapsuleHalf({ color, isTop, splitOffset }: { color: string; isTop: boolean; splitOffset: number }) {
  const darkerColor = useMemo(() => new THREE.Color(color).multiplyScalar(isTop ? 1 : 0.7).getStyle(), [color, isTop]);

  return (
    <mesh position={[0, isTop ? splitOffset : -splitOffset, 0]} rotation={isTop ? [0, 0, 0] : [Math.PI, 0, 0]}>
      <sphereGeometry args={[0.8, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color={darkerColor} roughness={0.25} metalness={0.15} />
    </mesh>
  );
}

function CapsuleRing({ splitOffset }: { splitOffset: number }) {
  return splitOffset < 0.1 ? (
    <mesh>
      <torusGeometry args={[0.8, 0.04, 8, 32]} />
      <meshStandardMaterial color="#222" roughness={0.5} />
    </mesh>
  ) : null;
}

function Particles({ color, active }: { color: string; active: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const count = 60;

  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0;
      vel.push(new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4
      ));
    }
    return [pos, vel];
  }, []);

  useFrame((_, delta) => {
    if (!ref.current || !active) return;
    const geom = ref.current.geometry;
    const posAttr = geom.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      posAttr.array[i * 3] += velocities[i].x * delta;
      posAttr.array[i * 3 + 1] += velocities[i].y * delta;
      posAttr.array[i * 3 + 2] += velocities[i].z * delta;
    }
    posAttr.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.06} transparent opacity={0.8} />
    </points>
  );
}

function RevealLight({ color, active }: { color: string; active: boolean }) {
  if (!active) return null;
  return (
    <>
      <pointLight position={[0, 0, 1]} color={color} intensity={3} distance={5} />
      <pointLight position={[0, 0, -1]} color={color} intensity={2} distance={4} />
    </>
  );
}

function AnimatedCapsule({ phase, rarityColor, glowColor }: { phase: Phase; rarityColor: string; glowColor: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const splitRef = useRef(0);
  const dropY = useRef(4);
  const scaleRef = useRef(0.5);
  const rotRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    switch (phase) {
      case "drop":
        dropY.current += (0 - dropY.current) * delta * 3;
        scaleRef.current += (1 - scaleRef.current) * delta * 4;
        rotRef.current += delta * 8;
        groupRef.current.position.y = dropY.current;
        groupRef.current.scale.setScalar(scaleRef.current);
        groupRef.current.rotation.z = Math.sin(rotRef.current) * 0.3;
        break;
      case "center":
        groupRef.current.position.y += (0 - groupRef.current.position.y) * delta * 5;
        const targetScale = 1.2;
        scaleRef.current += (targetScale - scaleRef.current) * delta * 4;
        groupRef.current.scale.setScalar(scaleRef.current);
        groupRef.current.rotation.z *= 0.9;
        break;
      case "split":
        splitRef.current += (1.5 - splitRef.current) * delta * 3;
        groupRef.current.rotation.z = 0;
        break;
      case "revealed":
        splitRef.current += (2.0 - splitRef.current) * delta * 2;
        break;
      default:
        dropY.current = 4;
        scaleRef.current = 0.5;
        splitRef.current = 0;
        groupRef.current.position.y = 4;
        groupRef.current.scale.setScalar(0.5);
    }
  });

  const showSplit = phase === "split" || phase === "revealed";

  return (
    <group ref={groupRef}>
      <CapsuleHalf color={rarityColor} isTop={true} splitOffset={showSplit ? splitRef.current : 0} />
      <CapsuleHalf color={rarityColor} isTop={false} splitOffset={showSplit ? splitRef.current : 0} />
      <CapsuleRing splitOffset={showSplit ? splitRef.current : 0} />
      <Particles color={glowColor} active={phase === "revealed"} />
      <RevealLight color={glowColor} active={phase === "split" || phase === "revealed"} />
    </group>
  );
}

function CameraController({ phase }: { phase: Phase }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 0));

  useFrame((_, delta) => {
    let targetPos: THREE.Vector3;
    switch (phase) {
      case "knob":
        targetPos = new THREE.Vector3(0, 1, 5);
        break;
      case "drop":
        targetPos = new THREE.Vector3(0, 0, 4);
        break;
      case "center":
        targetPos = new THREE.Vector3(0, 0, 3);
        break;
      case "split":
      case "revealed":
        targetPos = new THREE.Vector3(0, 0, 3.5);
        break;
      default:
        targetPos = new THREE.Vector3(0, 0, 5);
    }
    camera.position.lerp(targetPos, delta * 3);
    target.current.lerp(new THREE.Vector3(0, 0, 0), delta * 3);
    camera.lookAt(target.current);
  });

  return null;
}

function MiniMachine({ phase }: { phase: Phase }) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!ref.current) return;
    if (phase === "knob") {
      ref.current.rotation.z = Math.sin(Date.now() * 0.02) * 0.03;
    }
    // Fade out after knob phase
    const targetOpacity = phase === "knob" ? 1 : 0;
    ref.current.visible = phase === "knob";
  });

  return (
    <group ref={ref} position={[0, 1.5, 0]} scale={0.4}>
      {/* Simple machine silhouette */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2, 1, 0.8]} />
        <meshStandardMaterial color="#DC2626" roughness={0.4} />
      </mesh>
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 1.2, 16]} />
        <meshPhysicalMaterial color="#fff" transparent opacity={0.2} transmission={0.8} />
      </mesh>
      {/* Spinning knob */}
      <mesh position={[0.6, -0.1, 0.5]}>
        <sphereGeometry args={[0.2, 12, 12]} />
        <meshStandardMaterial color="#FBBF24" metalness={0.5} roughness={0.2} />
      </mesh>
    </group>
  );
}

function SpinRevealScene({ phase, rarityColor, glowColor }: { phase: Phase; rarityColor: string; glowColor: string }) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <spotLight position={[3, 5, 5]} angle={0.5} penumbra={0.5} intensity={0.8} />
      <CameraController phase={phase} />
      <MiniMachine phase={phase} />
      {phase !== "knob" && (
        <AnimatedCapsule phase={phase} rarityColor={rarityColor} glowColor={glowColor} />
      )}
      <Environment preset="studio" />
    </>
  );
}

/* ---------- Main Component ---------- */

interface Props {
  results: SpinResult[];
  onDone: () => void;
  onSpinAgain: () => void;
}

export default function GachaSpinReveal3D({ results, onDone, onSpinAgain }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("knob");

  const current = results[currentIndex];
  const isLast = currentIndex === results.length - 1;
  const rarityColor = current?.rarity?.color || "#9CA3AF";
  const glowColor = current?.rarity?.glow_color || "#9CA3AF";

  useEffect(() => {
    setPhase("knob");
    const timers = [
      setTimeout(() => setPhase("drop"), 800),
      setTimeout(() => setPhase("center"), 2000),
      setTimeout(() => setPhase("split"), 2500),
      setTimeout(() => setPhase("revealed"), 3400),
    ];
    return () => timers.forEach(clearTimeout);
  }, [currentIndex]);

  const handleNext = () => {
    if (isLast) onDone();
    else setCurrentIndex(i => i + 1);
  };

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center" dir="rtl">
      {/* 3D Canvas */}
      <div className="w-full h-[55vh] max-w-lg">
        <Canvas
          camera={{ position: [0, 0, 5], fov: 40 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: "transparent" }}
        >
          <SpinRevealScene phase={phase} rarityColor={rarityColor} glowColor={glowColor} />
        </Canvas>
      </div>

      {/* Counter */}
      {results.length > 1 && (
        <div className="text-sm text-white/40 font-mono mb-2">
          {currentIndex + 1} / {results.length}
        </div>
      )}

      {/* Prize Info (HTML overlay) */}
      {phase === "revealed" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center px-6 text-center"
        >
          {/* Prize image/emoji */}
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center mb-3"
            style={{
              boxShadow: `0 0 50px ${glowColor}40`,
              background: `radial-gradient(circle, ${rarityColor}20, transparent 70%)`,
            }}
          >
            {current.prize_image_url ? (
              <img src={current.prize_image_url} alt={current.prize_name_ar} className="w-18 h-18 object-contain drop-shadow-2xl" loading="lazy" decoding="async" />
            ) : (
              <span className="text-5xl">{PRIZE_EMOJI[current.prize_type] || "🎁"}</span>
            )}
          </div>

          {/* Rarity badge */}
          {current.rarity && (
            <span
              className="px-3 py-1 rounded-full text-xs font-bold mb-2"
              style={{
                backgroundColor: `${rarityColor}25`,
                color: rarityColor,
                border: `1px solid ${rarityColor}40`,
              }}
            >
              {current.rarity.name_ar}
            </span>
          )}

          {current.is_guaranteed && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-[10px] text-amber-400 font-medium mb-2">
              ⭐ مكافأة مضمونة
            </span>
          )}

          <h2 className="text-lg font-bold text-white mb-1">{current.prize_name_ar}</h2>

          {current.prize_type === "points" && current.points_value && (
            <p className="text-primary font-bold text-sm">+{current.points_value} نقطة</p>
          )}
        </motion.div>
      )}

      {/* Action Buttons */}
      {phase === "revealed" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 flex flex-col gap-2 w-full max-w-xs px-6"
        >
          <Button onClick={handleNext} className="w-full bg-primary hover:bg-primary/90">
            {isLast ? "إغلاق" : "التالي ➜"}
          </Button>
          {isLast && (
            <Button onClick={onSpinAgain} variant="outline" className="w-full border-primary/30 text-primary">
              🔄 لف مرة أخرى
            </Button>
          )}
        </motion.div>
      )}
    </div>
  );
}
