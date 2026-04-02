import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
// drei not needed for this clean design
import { getStage } from "./StackEnvironment";
import { useStageAudio } from "./StackStageAudio";
import { getTowerAudio, disposeTowerAudio } from "./TowerAudioPro";

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

const BLOCK_HEIGHT = 0.5;
const INITIAL_SIZE: [number, number, number] = [3, BLOCK_HEIGHT, 3];
const INITIAL_SPEED = 3;
const SPEED_INCREMENT = 0.12;
const MAX_SPEED = 10;
const PERFECT_THRESHOLD = 0.1;

function getTileColor(index: number): string {
  const hue = ((index + 1) * 5) % 360;
  return `hsl(${hue}, 50%, 50%)`;
}

interface Props {
  onGameOver: (score: number, perfects: number, maxCombo: number) => void;
  onScoreUpdate?: (score: number, combo: number, perfectCount: number) => void;
}

export default function StackScene({ onGameOver, onScoreUpdate }: Props) {
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
  const [perfectEffects, setPerfectEffects] = useState<{ id: number; y: number; size: [number, number]; time: number }[]>([]);

  const movingBlockRef = useRef<THREE.Mesh>(null);
  const movingDir = useRef(1);
  const currentAxis = useRef<"x" | "z">("x");
  const speed = useRef(INITIAL_SPEED);
  const fallingIdCounter = useRef(0);
  const perfectEffectId = useRef(0);
  const cameraTargetY = useRef(3);
  const hasPlaced = useRef(false);
  const time = useRef(0);
  
  const blockSpawned = useRef(false);

  // Audio systems
  const audioSystem = useMemo(() => getTowerAudio(), []);
  const { setStage: setAudioStage } = useStageAudio();

  useEffect(() => {
    audioSystem.startAmbient();
    return () => {
      audioSystem.stopAmbient();
    };
  }, [audioSystem]);

  useEffect(() => {
    setAudioStage(getStage(score));
  }, [score, setAudioStage]);

  const topBlock = stack[stack.length - 1];
  const currentY = stack.length * BLOCK_HEIGHT;
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
      setGameOver(true);
      audioSystem.playGameOver();
      onGameOverRef.current(score, perfectCount, maxCombo);
      return;
    }

    const isPerfect = Math.abs(delta) < PERFECT_THRESHOLD;
    const tileColor = getTileColor(stack.length);

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
      if (newCombo >= 3) {
        setComboText(`${newCombo}x COMBO!`);
      }
      setTimeout(() => setShowPerfect(false), 1500);
      // Add perfect border effect
      setPerfectEffects(prev => [...prev, {
        id: perfectEffectId.current++,
        y: currentY,
        size: [prevSize[0], prevSize[2]],
        time: 0,
      }]);
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
          position: fallingPos, size: fallingSize, color: tileColor,
          velocity: vel, rotation: [0, 0, 0],
          rotVel: [(Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5],
        },
      ]);
    }

    audioSystem.playPlace(isPerfect, newCombo);

    const newBlock: Block = {
      position: newPos, size: newSize, color: tileColor,
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
    blockSpawned.current = false;

    setTimeout(() => {
      hasPlaced.current = false;
    }, 50);
  }, [stack, topBlock, axis, score, combo, perfectCount, maxCombo, gameOver, currentY, audioSystem]);

  useEffect(() => {
    const handleClick = () => placeBlock();
    const handleKey = (e: KeyboardEvent) => { if (e.code === "Space") placeBlock(); };
    window.addEventListener("pointerdown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointerdown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [placeBlock]);

  useFrame((state, delta) => {
    time.current += delta;

    const mesh = movingBlockRef.current;
    if (mesh && !gameOver && !hasPlaced.current) {
      if (!blockSpawned.current) {
        const newAxis = currentAxis.current;
        const tb = stack[stack.length - 1];
        const cy = stack.length * BLOCK_HEIGHT;
        if (newAxis === "x") {
          mesh.position.set(-5, cy, tb.position[2]);
        } else {
          mesh.position.set(tb.position[0], cy, -5);
        }
        movingDir.current = 1;
        blockSpawned.current = true;
      }

      const range = 5;
      const moveSpeed = speed.current;
      const currentAxisVal = currentAxis.current;
      if (currentAxisVal === "x") {
        mesh.position.x += movingDir.current * moveSpeed * delta;
        if (mesh.position.x > range) movingDir.current = -1;
        if (mesh.position.x < -range) movingDir.current = 1;
      } else {
        mesh.position.z += movingDir.current * moveSpeed * delta;
        if (mesh.position.z > range) movingDir.current = -1;
        if (mesh.position.z < -range) movingDir.current = 1;
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

    // Camera follow - match original Stack game: camera from bottom-left
    const targetY = cameraTargetY.current;
    camera.position.y += (targetY - camera.position.y + 2) * delta * 2.5;
    camera.position.x = -2;
    camera.position.z = -2;
    camera.lookAt(0, targetY - 1.5, 0);

    // Falling pieces
    setFallingPieces(prev =>
      prev
        .map(p => ({
          ...p,
          position: [p.position[0] + p.velocity[0] * delta, p.position[1] + p.velocity[1] * delta, p.position[2] + p.velocity[2] * delta] as [number, number, number],
          velocity: [p.velocity[0], p.velocity[1] - 15 * delta, p.velocity[2]] as [number, number, number],
          rotation: [p.rotation[0] + p.rotVel[0] * delta, p.rotation[1] + p.rotVel[1] * delta, p.rotation[2] + p.rotVel[2] * delta] as [number, number, number],
        }))
        .filter(p => p.position[1] > -15)
    );

    // Perfect effects
    setPerfectEffects(prev =>
      prev
        .map(e => ({ ...e, time: e.time + delta }))
        .filter(e => e.time < 1.0)
    );
  });

  const nextColor = getTileColor(stack.length);

  return (
    <>
      {/* Lighting - match original Stack game look */}
      <ambientLight intensity={0.45} color="#ffffff" />
      <directionalLight
        position={[1, 10, 1]}
        intensity={1.4}
        color="#ffffff"
        castShadow
        shadow-mapSize={1024}
      />

      {/* Base tile - tall column extending below like original */}
      <mesh position={[0, -5, 0]} receiveShadow>
        <boxGeometry args={[INITIAL_SIZE[0], 10, INITIAL_SIZE[2]]} />
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
          <meshLambertMaterial color={piece.color} transparent opacity={0.7} />
        </mesh>
      ))}

      {/* Perfect border effects - white expanding planes */}
      {perfectEffects.map(effect => {
        const progress = effect.time / 1.0;
        const scale = 1 + progress * 0.5;
        const opacity = 1 - progress;
        const w = effect.size[0] * scale;
        const h = effect.size[1] * scale;
        const thickness = 0.04;
        return (
          <group key={effect.id} position={[0, effect.y + BLOCK_HEIGHT * 0.501, 0]}>
            {/* Top edge */}
            <mesh position={[0, 0, -h / 2]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[w, thickness]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={opacity} side={THREE.DoubleSide} />
            </mesh>
            {/* Bottom edge */}
            <mesh position={[0, 0, h / 2]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[w, thickness]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={opacity} side={THREE.DoubleSide} />
            </mesh>
            {/* Left edge */}
            <mesh position={[-w / 2, 0, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[h, thickness]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={opacity} side={THREE.DoubleSide} />
            </mesh>
            {/* Right edge */}
            <mesh position={[w / 2, 0, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[h, thickness]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={opacity} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}

      {/* Score and text handled by HTML overlay in StackGame.tsx */}
    </>
  );
}
