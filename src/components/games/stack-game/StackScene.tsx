import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Text, Float } from "@react-three/drei";
import StackEnvironment, { getStage } from "./StackEnvironment";
import { useStageAudio } from "./StackStageAudio";
import { getTowerAudio, disposeTowerAudio } from "./TowerAudioPro";

interface Block {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  emissive: string;
}

interface FallingPiece {
  id: number;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  velocity: [number, number, number];
  rotation: [number, number, number];
  rotVel: [number, number, number];
}

interface Particle {
  id: number;
  position: [number, number, number];
  velocity: [number, number, number];
  color: string;
  life: number;
  maxLife: number;
  size: number;
  type: "spark" | "ring" | "trail";
}

// Enhanced color palette with gradients
const PALETTES = [
  { color: "#6366f1", emissive: "#4f46e5", glow: "#818cf8" },
  { color: "#8b5cf6", emissive: "#7c3aed", glow: "#a78bfa" },
  { color: "#a78bfa", emissive: "#8b5cf6", glow: "#c4b5fd" },
  { color: "#c084fc", emissive: "#a855f7", glow: "#d8b4fe" },
  { color: "#e879f9", emissive: "#d946ef", glow: "#f0abfc" },
  { color: "#f472b6", emissive: "#ec4899", glow: "#f9a8d4" },
  { color: "#fb7185", emissive: "#f43f5e", glow: "#fda4af" },
  { color: "#f97316", emissive: "#ea580c", glow: "#fb923c" },
  { color: "#fbbf24", emissive: "#f59e0b", glow: "#fcd34d" },
  { color: "#34d399", emissive: "#10b981", glow: "#6ee7b7" },
  { color: "#22d3ee", emissive: "#06b6d4", glow: "#67e8f9" },
  { color: "#60a5fa", emissive: "#3b82f6", glow: "#93c5fd" },
];

const BLOCK_HEIGHT = 0.25;
const INITIAL_SIZE: [number, number, number] = [2.5, BLOCK_HEIGHT, 2.5];
const INITIAL_SPEED = 3;
const SPEED_INCREMENT = 0.12;
const MAX_SPEED = 10;
const PERFECT_THRESHOLD = 0.1;

interface Props {
  onGameOver: (score: number, perfects: number, maxCombo: number) => void;
  onScoreUpdate?: (score: number, combo: number, perfectCount: number) => void;
  debugScoreOverride?: number | null;
  speedMultiplier?: number;
  autoPlay?: boolean;
}

export default function StackScene({ onGameOver, onScoreUpdate, debugScoreOverride, speedMultiplier = 1, autoPlay = false }: Props) {
  const { camera } = useThree();
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;
  const [stack, setStack] = useState<Block[]>([
    { position: [0, 0, 0], size: [...INITIAL_SIZE], color: PALETTES[0].color, emissive: PALETTES[0].emissive },
  ]);
  const [fallingPieces, setFallingPieces] = useState<FallingPiece[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [perfectCount, setPerfectCount] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [showPerfect, setShowPerfect] = useState(false);
  const [comboText, setComboText] = useState("");
  const [shakeIntensity, setShakeIntensity] = useState(0);

  const movingBlockRef = useRef<THREE.Mesh>(null);
  const movingDir = useRef(1);
  const currentAxis = useRef<"x" | "z">("x");
  const speed = useRef(INITIAL_SPEED);
  const fallingIdCounter = useRef(0);
  const particleIdCounter = useRef(0);
  const cameraTargetY = useRef(3);
  const hasPlaced = useRef(false);
  const perfectTextOpacity = useRef(0);
  const comboTextOpacity = useRef(0);
  const time = useRef(0);
  const autoPlayTimer = useRef(0);

  // Audio systems
  const audioSystem = useMemo(() => getTowerAudio(), []);
  const { setStage: setAudioStage } = useStageAudio();

  useEffect(() => {
    audioSystem.startAmbient();
    return () => {
      audioSystem.stopAmbient();
    };
  }, [audioSystem]);

  const effectiveScore = debugScoreOverride ?? score;
  useEffect(() => {
    setAudioStage(getStage(effectiveScore));
  }, [effectiveScore, setAudioStage]);

  const getPalette = (index: number) => PALETTES[index % PALETTES.length];
  const topBlock = stack[stack.length - 1];
  const currentY = stack.length * BLOCK_HEIGHT;
  const axis = currentAxis.current;

  const spawnParticles = useCallback((pos: [number, number, number], color: string, count: number, type: "spark" | "ring" | "trail" = "spark") => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      if (type === "ring") {
        const angle = (i / count) * Math.PI * 2;
        const ringSpeed = 3 + Math.random() * 2;
        newParticles.push({
          id: particleIdCounter.current++,
          position: [...pos],
          velocity: [Math.cos(angle) * ringSpeed, Math.random() * 1.5, Math.sin(angle) * ringSpeed],
          color,
          life: 1,
          maxLife: 0.8 + Math.random() * 0.4,
          size: 0.03 + Math.random() * 0.04,
          type,
        });
      } else if (type === "trail") {
        newParticles.push({
          id: particleIdCounter.current++,
          position: [pos[0] + (Math.random() - 0.5) * 2, pos[1], pos[2] + (Math.random() - 0.5) * 2],
          velocity: [0, 2 + Math.random() * 3, 0],
          color,
          life: 1,
          maxLife: 1.5 + Math.random() * 1,
          size: 0.02 + Math.random() * 0.03,
          type,
        });
      } else {
        newParticles.push({
          id: particleIdCounter.current++,
          position: [...pos],
          velocity: [
            (Math.random() - 0.5) * 5,
            Math.random() * 4 + 1.5,
            (Math.random() - 0.5) * 5,
          ],
          color,
          life: 1,
          maxLife: 0.8 + Math.random() * 0.6,
          size: 0.03 + Math.random() * 0.06,
          type,
        });
      }
    }
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  const placeBlock = useCallback(() => {
    if (gameOver || hasPlaced.current) return;
    hasPlaced.current = true;

    const mesh = movingBlockRef.current;
    if (!mesh) return;

    const pos = mesh.position;
    const prevBlock = topBlock;
    const prevPos = prevBlock.position;
    const prevSize = prevBlock.size;

    const axisIdx = axis === "x" ? 0 : 2;
    const currentPos = axisIdx === 0 ? pos.x : pos.z;
    const prevCenter = prevPos[axisIdx];
    const currentSz = prevSize[axisIdx];
    const delta = currentPos - prevCenter;
    const overlap = currentSz - Math.abs(delta);

    if (overlap <= 0) {
      setGameOver(true);
      audioSystem.playGameOver();
      setShakeIntensity(0.4);
      // Explosion particles
      spawnParticles([pos.x, currentY, pos.z], "#ff4444", 40, "spark");
      onGameOverRef.current(score, perfectCount, maxCombo);
      return;
    }

    const isPerfect = Math.abs(delta) < PERFECT_THRESHOLD;
    const palette = getPalette(stack.length);

    let newSize: [number, number, number] = [...prevSize];
    let newPos: [number, number, number] = [...prevPos];
    newPos[1] = currentY;

    let newCombo = combo;
    let newPerfects = perfectCount;
    let newMaxCombo = maxCombo;

    if (isPerfect) {
      newPos[axisIdx] = prevCenter;
      newCombo = combo + 1;
      newPerfects = perfectCount + 1;
      newMaxCombo = Math.max(maxCombo, newCombo);
      setShowPerfect(true);
      perfectTextOpacity.current = 1;

      if (newCombo >= 3) {
        setComboText(`${newCombo}x COMBO!`);
        comboTextOpacity.current = 1;
      }

      setTimeout(() => setShowPerfect(false), 1500);
      // Multi-layer particles for perfect
      spawnParticles([newPos[0], currentY, newPos[2]], palette.emissive, 20, "ring");
      spawnParticles([newPos[0], currentY, newPos[2]], palette.glow || palette.color, 15, "trail");
      spawnParticles([newPos[0], currentY, newPos[2]], "#fbbf24", 25, "spark");
      setShakeIntensity(0.06);
    } else {
      const newCenter = prevCenter + delta / 2;
      newSize[axisIdx] = overlap;
      newPos[axisIdx] = newCenter;
      newCombo = 0;

      const cutSize = currentSz - overlap;
      const cutCenter = currentPos + (delta > 0 ? overlap / 2 : -overlap / 2);
      const fallingPos: [number, number, number] = [...newPos];
      fallingPos[axisIdx] = cutCenter;
      const fallingSize: [number, number, number] = [...newSize];
      fallingSize[axisIdx] = cutSize;

      const vel: [number, number, number] = [0, 0, 0];
      vel[axisIdx] = delta > 0 ? 3 : -3;

      setFallingPieces(prev => [
        ...prev,
        {
          id: fallingIdCounter.current++,
          position: fallingPos,
          size: fallingSize,
          color: palette.color,
          velocity: vel,
          rotation: [0, 0, 0],
          rotVel: [
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5,
          ],
        },
      ]);
      spawnParticles([newPos[0], currentY, newPos[2]], palette.color, 15, "spark");
      setShakeIntensity(0.12);
    }

    audioSystem.playPlace(isPerfect, newCombo);

    const newBlock: Block = {
      position: newPos,
      size: newSize,
      color: palette.color,
      emissive: palette.emissive,
    };

    setStack(prev => [...prev, newBlock]);
    const newScore = score + 1;
    setScore(newScore);
    setCombo(newCombo);
    setPerfectCount(newPerfects);
    setMaxCombo(newMaxCombo);
    onScoreUpdate?.(newScore, newCombo, newPerfects);

    currentAxis.current = axis === "x" ? "z" : "x";
    speed.current = Math.min(INITIAL_SPEED + stack.length * SPEED_INCREMENT, MAX_SPEED);
    movingDir.current = 1;
    cameraTargetY.current = currentY + 2.5;

    setTimeout(() => {
      hasPlaced.current = false;
    }, 50);
  }, [stack, topBlock, axis, score, combo, perfectCount, maxCombo, gameOver, currentY, spawnParticles, audioSystem]);

  useEffect(() => {
    if (autoPlay) return; // Don't bind manual controls in autoplay
    const handleClick = () => placeBlock();
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space") placeBlock();
    };
    window.addEventListener("pointerdown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointerdown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [placeBlock, autoPlay]);

  // Glow ring geometry (memoized)
  const ringGeo = useMemo(() => new THREE.RingGeometry(1.8, 2.2, 64), []);
  const baseRingGeo = useMemo(() => new THREE.RingGeometry(2.6, 2.9, 64), []);

  useFrame((state, delta) => {
    time.current += delta;

    // Auto-play: place block when crossing near center
    if (autoPlay && !gameOver && !hasPlaced.current) {
      autoPlayTimer.current += delta;
      const mesh = movingBlockRef.current;
      if (mesh) {
        const axisIdx = axis === "x" ? 0 : 2;
        const prevCenter = topBlock.position[axisIdx];
        const currentPos = axisIdx === 0 ? mesh.position.x : mesh.position.z;
        const movePerFrame = speed.current * speedMultiplier * delta;
        // Dynamic tolerance: scales with speed so we never overshoot
        const tolerance = Math.max(0.15, movePerFrame * 2);
        const distFromCenter = Math.abs(currentPos - prevCenter);
        if (distFromCenter < tolerance && autoPlayTimer.current > 0.08) {
          autoPlayTimer.current = 0;
          placeBlock();
        }
      }
    }

    if (!gameOver && !autoPlay) {
      const mesh = movingBlockRef.current;
      if (mesh && !hasPlaced.current) {
        const range = 4;
        if (axis === "x") {
          mesh.position.x += movingDir.current * speed.current * speedMultiplier * delta;
          if (mesh.position.x > range) movingDir.current = -1;
          if (mesh.position.x < -range) movingDir.current = 1;
        } else {
          mesh.position.z += movingDir.current * speed.current * speedMultiplier * delta;
          if (mesh.position.z > range) movingDir.current = -1;
          if (mesh.position.z < -range) movingDir.current = 1;
        }
      }
    }

    // Auto-play also needs block movement
    if (autoPlay && !gameOver) {
      const mesh = movingBlockRef.current;
      if (mesh && !hasPlaced.current) {
        const range = 4;
        const moveSpeed = speed.current * speedMultiplier;
        if (axis === "x") {
          mesh.position.x += movingDir.current * moveSpeed * delta;
          if (mesh.position.x > range) movingDir.current = -1;
          if (mesh.position.x < -range) movingDir.current = 1;
        } else {
          mesh.position.z += movingDir.current * moveSpeed * delta;
          if (mesh.position.z > range) movingDir.current = -1;
          if (mesh.position.z < -range) movingDir.current = 1;
        }
      }
    }

    // Camera with smooth shake
    const targetY = cameraTargetY.current;
    const shakeX = shakeIntensity * Math.sin(time.current * 50) * Math.cos(time.current * 33);
    const shakeZ = shakeIntensity * Math.cos(time.current * 47) * Math.sin(time.current * 29);
    camera.position.y += (targetY - camera.position.y + 4) * delta * 2.5;
    camera.position.x = 3.5 + shakeX;
    camera.position.z = 3.5 + shakeZ;
    camera.lookAt(0, targetY - 2, 0);

    // Decay shake
    if (shakeIntensity > 0.001) {
      setShakeIntensity(prev => prev * 0.9);
    }

    // Animate falling pieces
    setFallingPieces(prev =>
      prev
        .map(p => ({
          ...p,
          position: [
            p.position[0] + p.velocity[0] * delta,
            p.position[1] + p.velocity[1] * delta,
            p.position[2] + p.velocity[2] * delta,
          ] as [number, number, number],
          velocity: [
            p.velocity[0],
            p.velocity[1] - 15 * delta,
            p.velocity[2],
          ] as [number, number, number],
          rotation: [
            p.rotation[0] + p.rotVel[0] * delta,
            p.rotation[1] + p.rotVel[1] * delta,
            p.rotation[2] + p.rotVel[2] * delta,
          ] as [number, number, number],
        }))
        .filter(p => p.position[1] > -15)
    );

    // Animate particles
    setParticles(prev =>
      prev
        .map(p => ({
          ...p,
          position: [
            p.position[0] + p.velocity[0] * delta,
            p.position[1] + p.velocity[1] * delta,
            p.position[2] + p.velocity[2] * delta,
          ] as [number, number, number],
          velocity: [
            p.velocity[0] * (p.type === "trail" ? 0.99 : 0.96),
            p.velocity[1] - (p.type === "trail" ? 2 : 6) * delta,
            p.velocity[2] * (p.type === "trail" ? 0.99 : 0.96),
          ] as [number, number, number],
          life: p.life - delta / p.maxLife,
        }))
        .filter(p => p.life > 0)
    );

    // Fade text
    if (perfectTextOpacity.current > 0) {
      perfectTextOpacity.current -= delta * 1.5;
    }
    if (comboTextOpacity.current > 0) {
      comboTextOpacity.current -= delta * 1.2;
    }
  });

  const nextPalette = getPalette(stack.length);
  const startPos: [number, number, number] = [
    axis === "x" ? -4 : topBlock.position[0],
    currentY,
    axis === "z" ? -4 : topBlock.position[2],
  ];

  return (
    <>
      {/* Dynamic Environment */}
      <StackEnvironment score={effectiveScore} cameraY={cameraTargetY.current} />

      {/* Lighting - enhanced */}
      <directionalLight position={[5, 12, 5]} intensity={0.9} color="#ffffff" castShadow shadow-mapSize={2048} />
      <directionalLight position={[-3, 8, -3]} intensity={0.3} color="#6366f1" />

      {/* Base platform - hexagonal with glow layers */}
      <group>
        {/* Main platform */}
        <mesh position={[0, -0.35, 0]} receiveShadow>
          <cylinderGeometry args={[2.8, 3.2, 0.7, 6]} />
          <meshPhysicalMaterial
            color="#0f0a2e"
            metalness={0.9}
            roughness={0.15}
            clearcoat={1}
            clearcoatRoughness={0.05}
          />
        </mesh>
        {/* Inner ring */}
        <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <primitive object={ringGeo} />
          <meshBasicMaterial
            color="#6366f1"
            transparent
            opacity={0.4 + Math.sin(time.current * 2) * 0.15}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Outer ring pulse */}
        <mesh position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <primitive object={baseRingGeo} />
          <meshBasicMaterial
            color="#8b5cf6"
            transparent
            opacity={0.2 + Math.sin(time.current * 3 + 1) * 0.1}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Bottom glow */}
        <pointLight position={[0, -0.5, 0]} color="#6366f1" intensity={0.8} distance={5} />
        {/* Edge lights */}
        {[0, 1, 2, 3, 4, 5].map(i => {
          const angle = (i / 6) * Math.PI * 2;
          return (
            <pointLight
              key={i}
              position={[Math.cos(angle) * 3, -0.1, Math.sin(angle) * 3]}
              color="#4f46e5"
              intensity={0.3 + Math.sin(time.current * 2 + i) * 0.1}
              distance={3}
            />
          );
        })}
      </group>

      {/* Stacked blocks - enhanced materials */}
      {stack.map((block, i) => {
        const isTop = i === stack.length - 1;
        return (
          <mesh key={i} position={block.position} castShadow receiveShadow>
            <boxGeometry args={block.size} />
            <meshPhysicalMaterial
              color={block.color}
              emissive={block.emissive}
              emissiveIntensity={isTop ? 0.25 : 0.1}
              metalness={0.5}
              roughness={0.2}
              clearcoat={1}
              clearcoatRoughness={0.08}
              envMapIntensity={1.2}
            />
          </mesh>
        );
      })}

      {/* Edge glow lines on top block */}
      {!gameOver && (
        <lineSegments position={[topBlock.position[0], topBlock.position[1] + BLOCK_HEIGHT / 2 + 0.005, topBlock.position[2]]}>
          <edgesGeometry args={[new THREE.BoxGeometry(topBlock.size[0], 0.01, topBlock.size[2])]} />
          <lineBasicMaterial color={nextPalette.emissive} transparent opacity={0.6 + Math.sin(time.current * 4) * 0.3} />
        </lineSegments>
      )}

      {/* Ghost guide on top block showing target zone */}
      {!gameOver && !autoPlay && (
        <mesh
          position={[topBlock.position[0], currentY + 0.001, topBlock.position[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[topBlock.size[0], topBlock.size[2]]} />
          <meshBasicMaterial
            color={nextPalette.color}
            transparent
            opacity={0.08 + Math.sin(time.current * 3) * 0.04}
          />
        </mesh>
      )}

      {/* Moving block */}
      {!gameOver && (
        <mesh ref={movingBlockRef} position={startPos} castShadow>
          <boxGeometry args={topBlock.size} />
          <meshPhysicalMaterial
            color={nextPalette.color}
            emissive={nextPalette.emissive}
            emissiveIntensity={0.35 + Math.sin(time.current * 6) * 0.1}
            metalness={0.6}
            roughness={0.15}
            clearcoat={1}
            clearcoatRoughness={0.05}
            transparent
            opacity={0.9}
          />
        </mesh>
      )}

      {/* Trail behind moving block */}
      {!gameOver && movingBlockRef.current && (
        <mesh
          position={[
            movingBlockRef.current.position.x,
            movingBlockRef.current.position.y,
            movingBlockRef.current.position.z,
          ]}
        >
          <boxGeometry args={[topBlock.size[0] * 1.05, BLOCK_HEIGHT * 0.5, topBlock.size[2] * 1.05]} />
          <meshBasicMaterial color={nextPalette.glow || nextPalette.color} transparent opacity={0.08} />
        </mesh>
      )}

      {/* Falling pieces with rotation */}
      {fallingPieces.map(piece => (
        <mesh key={piece.id} position={piece.position} rotation={piece.rotation}>
          <boxGeometry args={piece.size} />
          <meshPhysicalMaterial
            color={piece.color}
            metalness={0.3}
            roughness={0.4}
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}

      {/* Particles - multi-type */}
      {particles.map(p => (
        <mesh key={p.id} position={p.position} scale={p.size * p.life * (p.type === "ring" ? 1.5 : 1)}>
          {p.type === "trail" ? (
            <boxGeometry args={[1, 3, 1]} />
          ) : (
            <sphereGeometry args={[1, p.type === "ring" ? 8 : 6, p.type === "ring" ? 8 : 6]} />
          )}
          <meshBasicMaterial
            color={p.color}
            transparent
            opacity={p.life * (p.type === "trail" ? 0.5 : 0.9)}
          />
        </mesh>
      ))}

      {/* Score - floating */}
      <Float speed={1} rotationIntensity={0} floatIntensity={0.3}>
        <Text
          position={[0, cameraTargetY.current + 2.5, 0]}
          fontSize={0.8}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          font={undefined}
          outlineWidth={0.03}
          outlineColor="#6366f1"
        >
          {effectiveScore}
        </Text>
      </Float>

      {/* Perfect text */}
      {showPerfect && (
        <Float speed={3} floatIntensity={0.5}>
          <Text
            position={[0, currentY + 1, 0]}
            fontSize={0.45}
            color="#fbbf24"
            anchorX="center"
            anchorY="middle"
            font={undefined}
            outlineWidth={0.02}
            outlineColor="#f59e0b"
          >
            ✦ PERFECT ✦
          </Text>
        </Float>
      )}

      {/* Combo text */}
      {comboText && comboTextOpacity.current > 0.1 && (
        <Float speed={4} floatIntensity={0.4}>
          <Text
            position={[0, currentY + 1.6, 0]}
            fontSize={0.4}
            color="#e879f9"
            anchorX="center"
            anchorY="middle"
            font={undefined}
            outlineWidth={0.015}
            outlineColor="#d946ef"
          >
            {comboText}
          </Text>
        </Float>
      )}
    </>
  );
}
