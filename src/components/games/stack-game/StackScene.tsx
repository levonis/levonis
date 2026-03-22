import { useRef, useState, useCallback, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Text } from "@react-three/drei";

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
}

const COLORS = [
  "#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c",
  "#3498db", "#9b59b6", "#e91e63", "#00bcd4", "#ff5722",
  "#8bc34a", "#ffc107", "#03a9f4", "#673ab7", "#ff9800",
];

const BLOCK_HEIGHT = 0.3;
const INITIAL_SIZE: [number, number, number] = [3, BLOCK_HEIGHT, 3];
const INITIAL_SPEED = 3;
const SPEED_INCREMENT = 0.15;
const MAX_SPEED = 12;
const PERFECT_THRESHOLD = 0.08;

interface Props {
  onGameOver: (score: number, perfects: number, maxCombo: number) => void;
}

export default function StackScene({ onGameOver }: Props) {
  const { camera } = useThree();
  const [stack, setStack] = useState<Block[]>([
    { position: [0, 0, 0], size: [...INITIAL_SIZE], color: COLORS[0] },
  ]);
  const [fallingPieces, setFallingPieces] = useState<FallingPiece[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [perfectCount, setPerfectCount] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [showPerfect, setShowPerfect] = useState(false);

  const movingBlockRef = useRef<THREE.Mesh>(null);
  const movingDir = useRef(1);
  const currentAxis = useRef<"x" | "z">("x");
  const speed = useRef(INITIAL_SPEED);
  const fallingIdCounter = useRef(0);
  const cameraTargetY = useRef(3);
  const hasPlaced = useRef(false);

  const getColor = (index: number) => COLORS[index % COLORS.length];

  const topBlock = stack[stack.length - 1];
  const currentY = stack.length * BLOCK_HEIGHT;
  const axis = currentAxis.current;

  // Play a click sound
  const playPlaceSound = useCallback((perfect: boolean) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = perfect ? "sine" : "square";
      osc.frequency.setValueAtTime(perfect ? 880 : 600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(perfect ? 1760 : 300, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {}
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
    const otherIdx = axis === "x" ? 2 : 0;

    const currentPos = axisIdx === 0 ? pos.x : pos.z;
    const prevCenter = prevPos[axisIdx];
    const prevSz = prevSize[axisIdx];
    const currentSz = axisIdx === 0 ? prevSize[0] : prevSize[2];

    const delta = currentPos - prevCenter;
    const overlap = currentSz - Math.abs(delta);

    if (overlap <= 0) {
      // Missed completely
      setGameOver(true);
      onGameOver(score, perfectCount, maxCombo);
      return;
    }

    const isPerfect = Math.abs(delta) < PERFECT_THRESHOLD;

    let newSize: [number, number, number] = [...prevSize];
    let newPos: [number, number, number] = [...prevPos];
    newPos[1] = currentY;

    let newCombo = combo;
    let newPerfects = perfectCount;
    let newMaxCombo = maxCombo;

    if (isPerfect) {
      // Perfect placement - keep size
      newPos[axisIdx] = prevCenter;
      newCombo = combo + 1;
      newPerfects = perfectCount + 1;
      newMaxCombo = Math.max(maxCombo, newCombo);
      setShowPerfect(true);
      setTimeout(() => setShowPerfect(false), 600);
    } else {
      // Cut the block
      const newCenter = prevCenter + delta / 2;
      newSize[axisIdx] = overlap;
      newPos[axisIdx] = newCenter;
      newCombo = 0;

      // Create falling piece
      const cutSize = currentSz - overlap;
      const cutCenter = currentPos + (delta > 0 ? overlap / 2 : -overlap / 2);
      const fallingPos: [number, number, number] = [...newPos];
      fallingPos[axisIdx] = cutCenter;
      const fallingSize: [number, number, number] = [...newSize];
      fallingSize[axisIdx] = cutSize;

      const vel: [number, number, number] = [0, 0, 0];
      vel[axisIdx] = delta > 0 ? 2 : -2;

      setFallingPieces((prev) => [
        ...prev,
        {
          id: fallingIdCounter.current++,
          position: fallingPos,
          size: fallingSize,
          color: getColor(stack.length),
          velocity: vel,
        },
      ]);
    }

    playPlaceSound(isPerfect);

    const newBlock: Block = {
      position: newPos,
      size: newSize,
      color: getColor(stack.length),
    };

    setStack((prev) => [...prev, newBlock]);
    setScore((s) => s + 1);
    setCombo(newCombo);
    setPerfectCount(newPerfects);
    setMaxCombo(newMaxCombo);

    // Next block setup
    currentAxis.current = axis === "x" ? "z" : "x";
    speed.current = Math.min(INITIAL_SPEED + stack.length * SPEED_INCREMENT, MAX_SPEED);
    movingDir.current = 1;
    cameraTargetY.current = currentY + 3;

    // Allow next placement
    setTimeout(() => {
      hasPlaced.current = false;
    }, 50);
  }, [stack, topBlock, axis, score, combo, perfectCount, maxCombo, gameOver, onGameOver, playPlaceSound, currentY]);

  // Handle click/tap
  useEffect(() => {
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
  }, [placeBlock]);

  // Animate moving block and camera
  useFrame((_, delta) => {
    if (gameOver) return;

    // Move current block
    const mesh = movingBlockRef.current;
    if (mesh && !hasPlaced.current) {
      const range = 5;
      if (axis === "x") {
        mesh.position.x += movingDir.current * speed.current * delta;
        if (mesh.position.x > range) movingDir.current = -1;
        if (mesh.position.x < -range) movingDir.current = 1;
      } else {
        mesh.position.z += movingDir.current * speed.current * delta;
        if (mesh.position.z > range) movingDir.current = -1;
        if (mesh.position.z < -range) movingDir.current = 1;
      }
    }

    // Smooth camera follow
    const targetY = cameraTargetY.current;
    camera.position.y += (targetY - camera.position.y + 5) * delta * 2;
    camera.lookAt(0, targetY - 3, 0);

    // Animate falling pieces
    setFallingPieces((prev) =>
      prev
        .map((p) => ({
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
        }))
        .filter((p) => p.position[1] > -10)
    );
  });

  const nextColor = getColor(stack.length);
  const startPos: [number, number, number] = [
    axis === "x" ? -5 : topBlock.position[0],
    currentY,
    axis === "z" ? -5 : topBlock.position[2],
  ];

  return (
    <>
      {/* Base platform */}
      <mesh position={[0, -0.25, 0]} receiveShadow>
        <boxGeometry args={[6, 0.5, 6]} />
        <meshStandardMaterial color="#16213e" />
      </mesh>

      {/* Stacked blocks */}
      {stack.map((block, i) => (
        <mesh key={i} position={block.position} castShadow receiveShadow>
          <boxGeometry args={block.size} />
          <meshStandardMaterial color={block.color} />
        </mesh>
      ))}

      {/* Moving block */}
      {!gameOver && (
        <mesh ref={movingBlockRef} position={startPos} castShadow>
          <boxGeometry args={topBlock.size} />
          <meshStandardMaterial color={nextColor} transparent opacity={0.9} />
        </mesh>
      )}

      {/* Falling pieces */}
      {fallingPieces.map((piece) => (
        <mesh key={piece.id} position={piece.position}>
          <boxGeometry args={piece.size} />
          <meshStandardMaterial color={piece.color} transparent opacity={0.6} />
        </mesh>
      ))}

      {/* Score text */}
      <Text
        position={[0, cameraTargetY.current + 3, 0]}
        fontSize={1}
        color="white"
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        {score}
      </Text>

      {/* Perfect text */}
      {showPerfect && (
        <Text
          position={[0, currentY + 1.5, 0]}
          fontSize={0.5}
          color="#f1c40f"
          anchorX="center"
          anchorY="middle"
          font={undefined}
        >
          PERFECT!
        </Text>
      )}
    </>
  );
}
