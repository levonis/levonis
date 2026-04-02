import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import StackEnvironment, { getStage } from "./StackEnvironment";
import { useStageAudio } from "./StackStageAudio";

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
  const [perfectEffects, setPerfectEffects] = useState<{ id: number; y: number; size: [number, number]; time: number }[]>([]);

  const movingBlockRef = useRef<THREE.Mesh>(null);
  const movingDir = useRef(1);
  const currentAxis = useRef<"x" | "z">("x");
  const speed = useRef(INITIAL_SPEED);
  const fallingIdCounter = useRef(0);
  const perfectEffectId = useRef(0);
  const cameraTargetY = useRef(3);
  const hasPlaced = useRef(false);
  const blockSpawned = useRef(false);
  const cameraYSmooth = useRef(3);

  // Stage audio (new ambient system)
  const { setStage: setAudioStage } = useStageAudio();

  useEffect(() => {
    setAudioStage(getStage(score));
  }, [score, setAudioStage]);

  const topBlock = stack[stack.length - 1];
  const currentY = stack.length * BLOCK_HEIGHT;
  const axis = currentAxis.current;

  // Simple placement sound using Web Audio
  const playPlaceSound = useCallback((perfect: boolean, comboCount: number) => {
    try {
      const ctx = new AudioContext();
      const now = ctx.currentTime;

      if (perfect) {
        // Bright chord for perfect
        const freqs = [523.25, 659.25, 783.99];
        freqs.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq * (comboCount >= 5 ? 2 : 1), now + i * 0.02);
          gain.gain.setValueAtTime(0.08, now + i * 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now + i * 0.02);
          osc.stop(now + 0.6);
        });

        // Sparkles for high combo
        if (comboCount >= 3) {
          for (let i = 0; i < Math.min(comboCount, 6); i++) {
            const s = ctx.createOscillator();
            const sg = ctx.createGain();
            s.type = "sine";
            s.frequency.setValueAtTime(2000 + Math.random() * 2000, now + 0.1 + i * 0.04);
            sg.gain.setValueAtTime(0.03, now + 0.1 + i * 0.04);
            sg.gain.exponentialRampToValueAtTime(0.001, now + 0.2 + i * 0.04);
            s.connect(sg).connect(ctx.destination);
            s.start(now + 0.1 + i * 0.04);
            s.stop(now + 0.25 + i * 0.04);
          }
        }
      } else {
        // Simple thud for normal
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);

        // Click
        const click = ctx.createOscillator();
        const cg = ctx.createGain();
        click.type = "square";
        click.frequency.setValueAtTime(1500, now);
        click.frequency.exponentialRampToValueAtTime(500, now + 0.03);
        cg.gain.setValueAtTime(0.03, now);
        cg.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        click.connect(cg).connect(ctx.destination);
        click.start(now);
        click.stop(now + 0.05);
      }

      setTimeout(() => ctx.close().catch(() => {}), 2000);
    } catch {}
  }, []);

  const playGameOverSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const now = ctx.currentTime;

      // Deep boom
      const boom = ctx.createOscillator();
      const bg = ctx.createGain();
      boom.type = "sawtooth";
      boom.frequency.setValueAtTime(80, now);
      boom.frequency.exponentialRampToValueAtTime(20, now + 0.6);
      bg.gain.setValueAtTime(0.15, now);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(200, now);
      boom.connect(filter).connect(bg).connect(ctx.destination);
      boom.start(now);
      boom.stop(now + 0.9);

      // Sad descending notes
      [392, 349, 311, 262].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        const t = now + 0.2 + i * 0.15;
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.connect(g).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.45);
      });

      setTimeout(() => ctx.close().catch(() => {}), 3000);
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
    const currentPos = axisIdx === 0 ? pos.x : pos.z;
    const prevCenter = prevPos[axisIdx];
    const currentSz = prevSize[axisIdx];
    const delta = currentPos - prevCenter;
    const overlap = currentSz - Math.abs(delta);

    if (overlap <= 0) {
      setGameOver(true);
      playGameOverSound();
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

    playPlaceSound(isPerfect, newCombo);

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
  }, [stack, topBlock, axis, score, combo, perfectCount, maxCombo, gameOver, currentY, playPlaceSound, playGameOverSound]);

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

    // Camera follow
    const targetY = cameraTargetY.current;
    cameraYSmooth.current += (targetY - cameraYSmooth.current) * delta * 2.5;
    camera.position.y = cameraYSmooth.current + 2;
    camera.position.x = -2;
    camera.position.z = -2;
    camera.lookAt(0, cameraYSmooth.current - 1.5, 0);

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
      {/* New Environment System */}
      <StackEnvironment score={score} cameraY={cameraYSmooth.current} />

      {/* Main directional light */}
      <directionalLight
        position={[1, 10, 1]}
        intensity={1.2}
        color="#ffffff"
        castShadow
        shadow-mapSize={1024}
      />

      {/* Base tile */}
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

      {/* Perfect border effects */}
      {perfectEffects.map(effect => {
        const progress = effect.time / 1.0;
        const scale = 1 + progress * 0.5;
        const opacity = 1 - progress;
        const w = effect.size[0] * scale;
        const h = effect.size[1] * scale;
        const thickness = 0.04;
        return (
          <group key={effect.id} position={[0, effect.y + BLOCK_HEIGHT / 2 + 0.001, 0]}>
            <mesh position={[0, 0, -h / 2]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[w, thickness]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={opacity} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0, h / 2]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[w, thickness]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={opacity} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[-w / 2, 0, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[h, thickness]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={opacity} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[w / 2, 0, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[h, thickness]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={opacity} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
