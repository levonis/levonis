import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { getStage } from "./StackEnvironment";
import { useStageAudio } from "./StackStageAudio";
import { getTowerAudio } from "./TowerAudioPro";

// ─── Types ─────────────────────────────────────────────────

interface Block {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
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

interface PerfectEffect {
  id: number;
  y: number;
  sizeX: number;
  sizeZ: number;
  opacity: number;
}

// ─── Constants (matching artginzburg/stack) ─────────────────

const TILE_HEIGHT = 0.2;
const INITIAL_SIZE: [number, number, number] = [3, TILE_HEIGHT, 3];
const INITIAL_SPEED = 3;
const SPEED_INCREMENT = 0.12;
const MAX_SPEED = 10;
const PERFECT_THRESHOLD = 0.15; // ~5% error like original

/** HSL color cycling - exact match with reference theme "Stack" */
function getTileColor(index: number): string {
  const hue = ((index + 1) * 5) % 360;
  return `hsl(${hue}, 50%, 50%)`;
}

// ─── Perfect Effect Border ──────────────────────────────────

function PerfectBorderEffect({ y, sizeX, sizeZ, opacity }: { y: number; sizeX: number; sizeZ: number; opacity: number }) {
  if (opacity <= 0) return null;

  const borderWidth = 0.06;
  const addedSize = borderWidth * 2;
  const totalW = sizeX + addedSize;
  const totalH = sizeZ + addedSize;
  const yPos = y + TILE_HEIGHT / 2 + 0.005;

  return (
    <group position={[0, yPos, 0]}>
      {/* Top border */}
      <mesh position={[0, 0, -(totalH / 2 - borderWidth / 2)]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[totalW, borderWidth]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Bottom border */}
      <mesh position={[0, 0, totalH / 2 - borderWidth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[totalW, borderWidth]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Left border */}
      <mesh position={[-(totalW / 2 - borderWidth / 2), 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[borderWidth, sizeZ]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Right border */}
      <mesh position={[totalW / 2 - borderWidth / 2, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[borderWidth, sizeZ]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─── Main Scene ─────────────────────────────────────────────

interface Props {
  onGameOver: (score: number, perfects: number, maxCombo: number) => void;
  onScoreUpdate?: (score: number, combo: number, perfectCount: number) => void;
  speedMultiplier?: number;
  autoPlay?: boolean;
}

export default function StackScene({ onGameOver, onScoreUpdate, speedMultiplier = 1, autoPlay = false }: Props) {
  const { camera } = useThree();
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const [stack, setStack] = useState<Block[]>([
    { position: [0, 0, 0], size: [...INITIAL_SIZE], color: getTileColor(0) },
  ]);
  const [fallingPieces, setFallingPieces] = useState<FallingPiece[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [perfectCount, setPerfectCount] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [showPerfect, setShowPerfect] = useState(false);
  const [comboText, setComboText] = useState("");
  const [perfectEffects, setPerfectEffects] = useState<PerfectEffect[]>([]);

  const movingBlockRef = useRef<THREE.Mesh>(null);
  const movingDir = useRef(1);
  const currentAxis = useRef<"x" | "z">("x");
  const speed = useRef(INITIAL_SPEED);
  const fallingIdCounter = useRef(0);
  const perfectEffectId = useRef(0);
  const cameraTargetY = useRef(3);
  const hasPlaced = useRef(false);
  const time = useRef(0);
  const autoPlayTimer = useRef(0);
  const blockSpawned = useRef(false);

  // Audio
  const audioSystem = useMemo(() => getTowerAudio(), []);
  const { setStage: setAudioStage } = useStageAudio();

  useEffect(() => {
    audioSystem.startAmbient();
    return () => { audioSystem.stopAmbient(); };
  }, [audioSystem]);

  useEffect(() => {
    setAudioStage(getStage(score));
  }, [score, setAudioStage]);

  const topBlock = stack[stack.length - 1];
  const currentY = stack.length * TILE_HEIGHT;
  const axis = currentAxis.current;

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
      // Miss - falling full piece then game over
      const fallingPos: [number, number, number] = [pos.x, currentY, pos.z];
      setFallingPieces(prev => [...prev, {
        id: fallingIdCounter.current++,
        position: fallingPos,
        size: [...prevSize],
        color: getTileColor(stack.length),
        velocity: [0, 0, 0],
        rotation: [0, 0, 0],
        rotVel: [(Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3],
      }]);
      setGameOver(true);
      audioSystem.playGameOver();
      onGameOverRef.current(score, perfectCount, maxCombo);
      return;
    }

    const errorFraction = Math.abs(delta) / prevSize[axisIdx];
    const isPerfect = errorFraction <= 0.05; // 5% threshold like original
    const tileColor = getTileColor(stack.length);

    let newSize: [number, number, number] = [...prevSize];
    let newPos: [number, number, number] = [...prevPos];
    newPos[1] = currentY;

    let newCombo = combo;
    let newPerfects = perfectCount;
    let newMaxCombo = maxCombo;

    if (isPerfect) {
      // Perfect - snap to center, don't cut
      newPos[axisIdx] = prevCenter;
      newCombo = combo + 1;
      newPerfects = perfectCount + 1;
      newMaxCombo = Math.max(maxCombo, newCombo);
      setShowPerfect(true);
      if (newCombo >= 3) {
        setComboText(`${newCombo}x COMBO!`);
      }
      setTimeout(() => setShowPerfect(false), 1200);

      // Spawn white border effect
      setPerfectEffects(prev => [...prev, {
        id: perfectEffectId.current++,
        y: currentY,
        sizeX: prevSize[0],
        sizeZ: prevSize[2],
        opacity: 1,
      }]);
    } else {
      // Cut
      const newCenter = prevCenter + delta / 2;
      newSize[axisIdx] = overlap;
      newPos[axisIdx] = newCenter;
      newCombo = 0;

      const cutSize = currentSz - overlap;
      const cutCenter = currentPos + (delta > 0 ? overlap / 2 : -overlap / 2);
      const fallingPos: [number, number, number] = [...newPos];
      fallingPos[axisIdx] = cutCenter;
      fallingPos[1] = currentY;
      const fallingSize: [number, number, number] = [...newSize];
      fallingSize[axisIdx] = cutSize;

      setFallingPieces(prev => [...prev, {
        id: fallingIdCounter.current++,
        position: fallingPos,
        size: fallingSize,
        color: tileColor,
        velocity: [0, 0, 0],
        rotation: [0, 0, 0],
        rotVel: [(Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4],
      }]);
    }

    audioSystem.playPlace(isPerfect, newCombo);

    const newBlock: Block = { position: newPos, size: newSize, color: tileColor };
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
    blockSpawned.current = false;

    setTimeout(() => { hasPlaced.current = false; }, 50);
  }, [stack, topBlock, axis, score, combo, perfectCount, maxCombo, gameOver, currentY, audioSystem]);

  // Input handling
  useEffect(() => {
    if (autoPlay) return;
    const handleClick = () => placeBlock();
    const handleKey = (e: KeyboardEvent) => { if (e.code === "Space") placeBlock(); };
    window.addEventListener("pointerdown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointerdown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [placeBlock, autoPlay]);

  // Game loop
  useFrame((state, delta) => {
    time.current += delta;

    const mesh = movingBlockRef.current;
    if (mesh && !gameOver && !hasPlaced.current) {
      // Spawn new block at start position
      if (!blockSpawned.current) {
        const newAxis = currentAxis.current;
        const tb = stack[stack.length - 1];
        const cy = stack.length * TILE_HEIGHT;
        const startOffset = INITIAL_SIZE[0] + INITIAL_SIZE[0] / 4; // 3.75
        if (newAxis === "x") {
          mesh.position.set(-startOffset, cy, tb.position[2]);
        } else {
          mesh.position.set(tb.position[0], cy, -startOffset);
        }
        movingDir.current = 1;
        blockSpawned.current = true;
      }

      // Move
      const range = INITIAL_SIZE[0] + INITIAL_SIZE[0] / 4;
      const moveSpeed = speed.current * speedMultiplier;
      const currentAxisVal = currentAxis.current;
      if (currentAxisVal === "x") {
        mesh.position.x += movingDir.current * moveSpeed * delta;
        if (mesh.position.x > range) { mesh.position.x = range; movingDir.current = -1; }
        if (mesh.position.x < -range) { mesh.position.x = -range; movingDir.current = 1; }
      } else {
        mesh.position.z += movingDir.current * moveSpeed * delta;
        if (mesh.position.z > range) { mesh.position.z = range; movingDir.current = -1; }
        if (mesh.position.z < -range) { mesh.position.z = -range; movingDir.current = 1; }
      }
    }

    // Auto-play
    if (autoPlay && !gameOver && !hasPlaced.current && mesh) {
      autoPlayTimer.current += delta;
      if (autoPlayTimer.current > 0.08) {
        autoPlayTimer.current = 0;
        const tb = stack[stack.length - 1];
        if (currentAxis.current === "x") {
          mesh.position.x = tb.position[0];
        } else {
          mesh.position.z = tb.position[2];
        }
        placeBlock();
      }
    }

    // Camera - smooth follow with easing (like original CameraController)
    const targetY = cameraTargetY.current;
    camera.position.y += (targetY - camera.position.y + 4) * delta * 2.5;
    camera.position.x = 2;
    camera.position.z = 2;
    camera.lookAt(0, targetY - 2, 0);

    // Falling pieces - gravity
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
        .filter(p => p.position[1] > -20)
    );

    // Perfect effects - fade out (speed 0.7 like original)
    setPerfectEffects(prev =>
      prev
        .map(e => ({ ...e, opacity: e.opacity - delta * 0.7 }))
        .filter(e => e.opacity > 0)
    );
  });

  const nextColor = getTileColor(stack.length);

  return (
    <>
      {/* Lighting - clean directional + ambient */}
      <ambientLight intensity={0.65} color="#ffffff" />
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.8}
        color="#ffffff"
        castShadow
        shadow-mapSize={1024}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />

      {/* Base tile - large box like original's BaseTile */}
      <mesh position={[0, -TILE_HEIGHT * 5, 0]} receiveShadow>
        <boxGeometry args={[INITIAL_SIZE[0], TILE_HEIGHT * 10, INITIAL_SIZE[2]]} />
        <meshLambertMaterial color={getTileColor(0)} />
      </mesh>

      {/* Stacked blocks */}
      {stack.map((block, i) => (
        <mesh key={i} position={block.position} castShadow receiveShadow>
          <boxGeometry args={block.size} />
          <meshLambertMaterial color={block.color} />
        </mesh>
      ))}

      {/* Moving block */}
      {!gameOver && (
        <mesh ref={movingBlockRef} castShadow>
          <boxGeometry args={topBlock.size} />
          <meshLambertMaterial color={nextColor} />
        </mesh>
      )}

      {/* Falling pieces */}
      {fallingPieces.map(piece => (
        <mesh key={piece.id} position={piece.position} rotation={piece.rotation}>
          <boxGeometry args={piece.size} />
          <meshLambertMaterial color={piece.color} />
        </mesh>
      ))}

      {/* Perfect border effects - white fading borders */}
      {perfectEffects.map(effect => (
        <PerfectBorderEffect
          key={effect.id}
          y={effect.y}
          sizeX={effect.sizeX}
          sizeZ={effect.sizeZ}
          opacity={effect.opacity}
        />
      ))}

      {/* Score - white, clean, centered */}
      <Text
        position={[0, cameraTargetY.current + 3, 0]}
        fontSize={1.2}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        {score || ""}
      </Text>

      {/* Perfect text */}
      {showPerfect && (
        <Text
          position={[0, currentY + 1, 0]}
          fontSize={0.35}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          font={undefined}
        >
          PERFECT
        </Text>
      )}

      {/* Combo text */}
      {comboText && combo >= 3 && (
        <Text
          position={[0, currentY + 1.5, 0]}
          fontSize={0.3}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          font={undefined}
        >
          {comboText}
        </Text>
      )}
    </>
  );
}
