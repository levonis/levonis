import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Text, Float, Environment, Stars } from "@react-three/drei";

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
}

// Elegant color palette - gradient tower
const PALETTES = [
  { color: "#6366f1", emissive: "#4f46e5" }, // Indigo
  { color: "#8b5cf6", emissive: "#7c3aed" }, // Violet
  { color: "#a78bfa", emissive: "#8b5cf6" }, // Purple
  { color: "#c084fc", emissive: "#a855f7" }, // Fuchsia
  { color: "#e879f9", emissive: "#d946ef" }, // Pink
  { color: "#f472b6", emissive: "#ec4899" }, // Rose
  { color: "#fb7185", emissive: "#f43f5e" }, // Red
  { color: "#f97316", emissive: "#ea580c" }, // Orange
  { color: "#fbbf24", emissive: "#f59e0b" }, // Amber
  { color: "#34d399", emissive: "#10b981" }, // Emerald
  { color: "#22d3ee", emissive: "#06b6d4" }, // Cyan
  { color: "#60a5fa", emissive: "#3b82f6" }, // Blue
];

const BLOCK_HEIGHT = 0.25;
const INITIAL_SIZE: [number, number, number] = [2.5, BLOCK_HEIGHT, 2.5];
const INITIAL_SPEED = 3;
const SPEED_INCREMENT = 0.12;
const MAX_SPEED = 10;
const PERFECT_THRESHOLD = 0.1;

interface Props {
  onGameOver: (score: number, perfects: number, maxCombo: number) => void;
}

// Sound system
class TowerAudio {
  private ctx: AudioContext | null = null;
  private musicOsc: OscillatorNode | null = null;
  private musicGain: GainNode | null = null;
  private musicPlaying = false;

  private getCtx() {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playPlace(perfect: boolean, combo: number) {
    try {
      const ctx = this.getCtx();
      const now = ctx.currentTime;
      
      if (perfect) {
        // Bright harmonious chime for perfect
        const baseFreq = 523.25 + combo * 50; // C5 + escalating
        [1, 1.5, 2].forEach((mult, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(baseFreq * mult, now);
          gain.gain.setValueAtTime(0.08 / (i + 1), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now + i * 0.05);
          osc.stop(now + 0.5);
        });
        // Sparkle
        const noise = ctx.createOscillator();
        const nGain = ctx.createGain();
        noise.type = "sine";
        noise.frequency.setValueAtTime(2000 + combo * 100, now);
        noise.frequency.exponentialRampToValueAtTime(4000, now + 0.15);
        nGain.gain.setValueAtTime(0.03, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        noise.connect(nGain).connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 0.2);
      } else {
        // Soft thud for regular placement
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch {}
  }

  playGameOver() {
    try {
      const ctx = this.getCtx();
      const now = ctx.currentTime;
      // Descending sad chord
      [440, 349.23, 293.66].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.15);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + i * 0.15 + 0.8);
        gain.gain.setValueAtTime(0.06, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 1);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 1);
      });
    } catch {}
  }

  startAmbient() {
    if (this.musicPlaying) return;
    try {
      const ctx = this.getCtx();
      this.musicPlaying = true;
      
      // Gentle ambient pad
      const playPad = () => {
        if (!this.musicPlaying) return;
        const now = ctx.currentTime;
        const chords = [
          [261.63, 329.63, 392.00], // C maj
          [293.66, 369.99, 440.00], // D maj  
          [246.94, 311.13, 369.99], // B min
          [220.00, 277.18, 329.63], // A min
        ];
        const chord = chords[Math.floor(Math.random() * chords.length)];
        
        chord.forEach(freq => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq * 0.5, now);
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(800, now);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.015, now + 1);
          gain.gain.linearRampToValueAtTime(0, now + 4);
          osc.connect(filter).connect(gain).connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 4.5);
        });
        
        if (this.musicPlaying) {
          setTimeout(playPad, 3500);
        }
      };
      playPad();
    } catch {}
  }

  stopAmbient() {
    this.musicPlaying = false;
  }

  dispose() {
    this.stopAmbient();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
  }
}

const audioSystem = new TowerAudio();

export default function StackScene({ onGameOver }: Props) {
  const { camera } = useThree();
  // Use ref to always have latest callback (avoids stale closure in R3F)
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

  // Start ambient music
  useEffect(() => {
    audioSystem.startAmbient();
    return () => {
      audioSystem.stopAmbient();
    };
  }, []);

  const getPalette = (index: number) => PALETTES[index % PALETTES.length];
  const topBlock = stack[stack.length - 1];
  const currentY = stack.length * BLOCK_HEIGHT;
  const axis = currentAxis.current;

  const spawnParticles = useCallback((pos: [number, number, number], color: string, count: number) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: particleIdCounter.current++,
        position: [...pos],
        velocity: [
          (Math.random() - 0.5) * 4,
          Math.random() * 3 + 1,
          (Math.random() - 0.5) * 4,
        ],
        color,
        life: 1,
        maxLife: 0.6 + Math.random() * 0.4,
        size: 0.03 + Math.random() * 0.05,
      });
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
      setShakeIntensity(0.3);
      onGameOver(score, perfectCount, maxCombo);
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
      
      setTimeout(() => setShowPerfect(false), 800);
      spawnParticles([newPos[0], currentY, newPos[2]], palette.emissive, 20);
      setShakeIntensity(0.05);
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
      spawnParticles([newPos[0], currentY, newPos[2]], palette.color, 8);
      setShakeIntensity(0.1);
    }

    audioSystem.playPlace(isPerfect, newCombo);

    const newBlock: Block = {
      position: newPos,
      size: newSize,
      color: palette.color,
      emissive: palette.emissive,
    };

    setStack(prev => [...prev, newBlock]);
    setScore(s => s + 1);
    setCombo(newCombo);
    setPerfectCount(newPerfects);
    setMaxCombo(newMaxCombo);

    currentAxis.current = axis === "x" ? "z" : "x";
    speed.current = Math.min(INITIAL_SPEED + stack.length * SPEED_INCREMENT, MAX_SPEED);
    movingDir.current = 1;
    cameraTargetY.current = currentY + 2.5;

    setTimeout(() => {
      hasPlaced.current = false;
    }, 50);
  }, [stack, topBlock, axis, score, combo, perfectCount, maxCombo, gameOver, onGameOver, currentY, spawnParticles]);

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

  // Glow ring geometry (memoized)
  const ringGeo = useMemo(() => new THREE.RingGeometry(1.8, 2.2, 64), []);

  useFrame((state, delta) => {
    time.current += delta;
    
    if (!gameOver) {
      const mesh = movingBlockRef.current;
      if (mesh && !hasPlaced.current) {
        const range = 4;
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
    }

    // Camera with shake
    const targetY = cameraTargetY.current;
    const shake = shakeIntensity * Math.sin(time.current * 50);
    camera.position.y += (targetY - camera.position.y + 4) * delta * 2.5;
    camera.position.x = 3.5 + shake;
    camera.position.z = 3.5 + shake * 0.5;
    camera.lookAt(0, targetY - 2, 0);
    
    // Decay shake
    if (shakeIntensity > 0.001) {
      setShakeIntensity(prev => prev * 0.92);
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
            p.velocity[1] - 12 * delta,
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
            p.velocity[0] * 0.98,
            p.velocity[1] - 5 * delta,
            p.velocity[2] * 0.98,
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
      {/* Environment */}
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={0.5} />
      <fog attach="fog" args={["#0f0a1e", 8, 35]} />
      
      {/* Lighting */}
      <ambientLight intensity={0.4} color="#8b5cf6" />
      <directionalLight position={[5, 12, 5]} intensity={0.8} color="#ffffff" castShadow shadow-mapSize={2048} />
      <pointLight position={[0, currentY + 2, 0]} intensity={0.6} color={nextPalette.emissive} distance={8} />
      <pointLight position={[-3, currentY, 3]} intensity={0.3} color="#6366f1" distance={6} />

      {/* Base platform - glass effect */}
      <mesh position={[0, -0.3, 0]} receiveShadow>
        <cylinderGeometry args={[2.5, 3, 0.6, 32]} />
        <meshPhysicalMaterial
          color="#1e1b4b"
          metalness={0.8}
          roughness={0.2}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Glow ring at base */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <primitive object={ringGeo} />
        <meshBasicMaterial color="#6366f1" transparent opacity={0.3 + Math.sin(time.current * 2) * 0.1} side={THREE.DoubleSide} />
      </mesh>

      {/* Stacked blocks - with glass/metallic material */}
      {stack.map((block, i) => (
        <mesh key={i} position={block.position} castShadow receiveShadow>
          <boxGeometry args={block.size} />
          <meshPhysicalMaterial
            color={block.color}
            emissive={block.emissive}
            emissiveIntensity={0.15}
            metalness={0.4}
            roughness={0.3}
            clearcoat={0.8}
            clearcoatRoughness={0.1}
          />
        </mesh>
      ))}

      {/* Edge glow lines on top block */}
      {!gameOver && (
        <lineSegments position={[topBlock.position[0], topBlock.position[1] + BLOCK_HEIGHT / 2 + 0.005, topBlock.position[2]]}>
          <edgesGeometry args={[new THREE.BoxGeometry(topBlock.size[0], 0.01, topBlock.size[2])]} />
          <lineBasicMaterial color={nextPalette.emissive} transparent opacity={0.5 + Math.sin(time.current * 4) * 0.3} />
        </lineSegments>
      )}

      {/* Moving block */}
      {!gameOver && (
        <mesh ref={movingBlockRef} position={startPos} castShadow>
          <boxGeometry args={topBlock.size} />
          <meshPhysicalMaterial
            color={nextPalette.color}
            emissive={nextPalette.emissive}
            emissiveIntensity={0.3 + Math.sin(time.current * 6) * 0.1}
            metalness={0.5}
            roughness={0.2}
            clearcoat={1}
            clearcoatRoughness={0.05}
            transparent
            opacity={0.85}
          />
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
            opacity={0.5}
          />
        </mesh>
      ))}

      {/* Particles */}
      {particles.map(p => (
        <mesh key={p.id} position={p.position} scale={p.size * p.life}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial color={p.color} transparent opacity={p.life * 0.8} />
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
          outlineWidth={0.02}
          outlineColor="#6366f1"
        >
          {score}
        </Text>
      </Float>

      {/* Perfect text */}
      {showPerfect && (
        <Text
          position={[0, currentY + 1, 0]}
          fontSize={0.4}
          color="#fbbf24"
          anchorX="center"
          anchorY="middle"
          font={undefined}
          outlineWidth={0.015}
          outlineColor="#f59e0b"
        >
          ✦ PERFECT ✦
        </Text>
      )}

      {/* Combo text */}
      {comboText && comboTextOpacity.current > 0.1 && (
        <Text
          position={[0, currentY + 1.5, 0]}
          fontSize={0.35}
          color="#e879f9"
          anchorX="center"
          anchorY="middle"
          font={undefined}
          outlineWidth={0.01}
          outlineColor="#d946ef"
        >
          {comboText}
        </Text>
      )}
    </>
  );
}
