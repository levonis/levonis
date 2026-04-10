import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameModels } from "./CrossyRoadModels";
import CrossyRoadAudio from "./CrossyRoadAudio";

// ── Types ──
type RowType = "grass" | "road" | "rail" | "river";

interface Obstacle {
  x: number;
  speed: number;
  width: number;
  modelIndex: number;
  isTruck: boolean;
}

interface LogObj {
  x: number;
  speed: number;
  width: number;
  modelIndex: number;
}

interface Coin {
  lane: number;
  collected: boolean;
}

interface Row {
  type: RowType;
  obstacles: Obstacle[];
  logs: LogObj[];
  coin: Coin | null;
  trainWarning: boolean;
  trainTimer: number;
  trainWarningPhase: boolean;
  treeIndices: number[];
  grassDark: boolean;
}

interface GameState {
  playerLane: number;
  playerRow: number;
  score: number;
  maxRow: number;
  steps: number;
  coins: number;
  rows: Row[];
  dead: boolean;
  deathTimer: number;
  moving: boolean;
  moveDir: string | null;
  moveProgress: number;
  fromLane: number;
  fromRow: number;
  hopAnim: number;
  playerOffsetX: number;
  playerRotation: number;
  onRiver: boolean;
}

// ── Render snapshot for declarative rendering ──
interface RenderGround { id: string; x: number; z: number; rowType: RowType; grassDark: boolean; }
interface RenderTrafficLight { id: string; x: number; z: number; isWarning: boolean; intensity: number; }
interface RenderTree { id: string; x: number; z: number; modelIdx: number; }
interface RenderVehicle { id: string; x: number; z: number; modelIdx: number; isTruck: boolean; flipY: boolean; }
interface RenderTrain { id: string; x: number; z: number; }
interface RenderLog { id: string; x: number; z: number; modelIdx: number; }
interface RenderCoin { id: string; x: number; z: number; rotY: number; }
interface PlayerSnapshot { x: number; y: number; z: number; visible: boolean; opacity: number; rotationY: number; }

interface RenderSnapshot {
  grounds: RenderGround[];
  trafficLights: RenderTrafficLight[];
  trees: RenderTree[];
  vehicles: RenderVehicle[];
  trains: RenderTrain[];
  logs: RenderLog[];
  coins: RenderCoin[];
  player: PlayerSnapshot;
}

const LANES = 9;
const CELL = 1;
const MODEL_SCALE = 1.0;
const GROUND_SCALE_X = (LANES * CELL) / 25;
const GROUND_SCALE_Z = CELL / 1;

// Train constants
const TRAIN_PART_WIDTH = 2.5;
const TRAIN_TOTAL_PARTS = 5;
const TRAIN_TOTAL_WIDTH = TRAIN_PART_WIDTH * TRAIN_TOTAL_PARTS;
const TRAIN_SPAWN_X = -TRAIN_TOTAL_WIDTH - 5;
const TRAIN_EXIT_X = LANES * CELL + TRAIN_TOTAL_WIDTH + 5;

// Warning timing
const TRAIN_WARNING_DURATION = 3.0;

// Player on-log Y offset
const LOG_Y_OFFSET = 0.18;

// Log width - matches the visual log model size (wider = chicken lands properly)
const LOG_WIDTH = 2.0;
// Log collision tolerance - generous so chicken doesn't fall off edges
const LOG_TOLERANCE = 0.45;

interface Props {
  onGameOver: (score: number, steps: number, coins: number) => void;
  onScoreUpdate: (score: number, steps: number, coins: number) => void;
}

function generateRow(index: number): Row {
  if (index < 4) {
    return {
      type: "grass", obstacles: [], logs: [], coin: null,
      trainWarning: false, trainTimer: 0, trainWarningPhase: false,
      treeIndices: [], grassDark: index % 2 === 0,
    };
  }
  const difficulty = Math.min(index / 50, 1);
  const rand = Math.random();
  let type: RowType;
  if (rand < 0.35) type = "grass";
  else if (rand < 0.7) type = "road";
  else if (rand < 0.85) type = "rail";
  else type = "river";

  const row: Row = {
    type, obstacles: [], logs: [], coin: null,
    trainWarning: false, trainTimer: 0, trainWarningPhase: false,
    treeIndices: [], grassDark: Math.random() > 0.5,
  };

  if (type === "grass" && index > 3) {
    // Place trees on edges and potentially random interior positions
    // Trees must never overlap with each other or block all paths
    const treePositions: number[] = [];
    if (Math.random() > 0.4) treePositions.push(0);
    if (Math.random() > 0.4) treePositions.push(LANES - 1);
    // Optionally add 1 interior tree (at an odd lane so player can always pass)
    if (Math.random() > 0.6 && treePositions.length < 2) {
      const interiorCandidates = [2, 3, 5, 6];
      const picked = interiorCandidates[Math.floor(Math.random() * interiorCandidates.length)];
      if (!treePositions.includes(picked)) treePositions.push(picked);
    }
    row.treeIndices = treePositions;
  }

  if (type === "road") {
    const dir = Math.random() > 0.5 ? 1 : -1;
    const count = 1 + Math.floor(Math.random() * 2);
    const speed = (2.5 + Math.random() * 3 + difficulty * 2) * dir;
    const isTruck = Math.random() < 0.3;
    // Space cars evenly to prevent overlap
    const segmentWidth = (LANES * CELL) / count;
    for (let i = 0; i < count; i++) {
      const baseX = segmentWidth * i + Math.random() * (segmentWidth - (isTruck ? 2 : 1));
      row.obstacles.push({
        x: baseX,
        speed, width: isTruck ? 2 : 1,
        modelIndex: Math.floor(Math.random() * (isTruck ? 2 : 6)),
        isTruck,
      });
    }
  } else if (type === "rail") {
    row.trainTimer = 3 + Math.random() * 5;
  } else if (type === "river") {
    const dir = Math.random() > 0.5 ? 1 : -1;
    const count = 2 + Math.floor(Math.random() * 2);
    const speed = (1.5 + Math.random() * 2) * dir;
    // Space logs with guaranteed gaps between them
    const segmentWidth = (LANES * CELL) / count;
    for (let i = 0; i < count; i++) {
      // Place log with a gap between logs (logs take up LOG_WIDTH, leave at least 1 unit gap)
      const maxOffset = Math.max(0, segmentWidth - LOG_WIDTH - 1);
      row.logs.push({
        x: segmentWidth * i + Math.random() * maxOffset,
        speed, width: LOG_WIDTH,
        modelIndex: Math.floor(Math.random() * 4),
      });
    }
  }

  if (Math.random() < 0.15 && type !== "river") {
    row.coin = { lane: Math.floor(Math.random() * LANES), collected: false };
  }

  return row;
}

// ── Sub-components ──
function GroundTile({ data }: { data: RenderGround }) {
  const models = useGameModels();
  if (!models) return null;

  let geometry: THREE.BufferGeometry;
  let material: THREE.MeshLambertMaterial;

  if (data.rowType === "grass") {
    geometry = models.grass.obj.geometry;
    const tex = data.grassDark ? models.grass.darkTex : models.grass.lightTex;
    material = new THREE.MeshLambertMaterial({ map: tex });
  } else if (data.rowType === "road") {
    geometry = models.road.obj.geometry;
    const tex = Math.random() > 0.5 ? models.road.stripesTex : models.road.blankTex;
    material = new THREE.MeshLambertMaterial({ map: tex });
  } else if (data.rowType === "rail") {
    geometry = models.railroad.geometry;
    material = models.railroad.material;
  } else {
    geometry = models.river.geometry;
    material = models.river.material;
  }

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[data.x, 0, data.z]}
      scale={[GROUND_SCALE_X, 1, GROUND_SCALE_Z]}
    />
  );
}

// Traffic Light component - pole with 3 lights
function TrafficLight({ data }: { data: RenderTrafficLight }) {
  const pulse = Math.abs(Math.sin(Date.now() * 0.008));
  const redOn = data.isWarning;
  const greenOn = !data.isWarning;

  return (
    <group position={[data.x, 0, data.z]}>
      {/* Pole */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1, 8]} />
        <meshLambertMaterial color={0x333333} />
      </mesh>
      {/* Housing */}
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[0.2, 0.5, 0.15]} />
        <meshLambertMaterial color={0x222222} />
      </mesh>
      {/* Red light */}
      <mesh position={[0, 1.25, 0.08]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial
          color={redOn ? 0xff0000 : 0x330000}
          emissive={redOn ? 0xff0000 : 0x000000}
          emissiveIntensity={redOn ? 1.5 + pulse * 2 : 0}
        />
      </mesh>
      {/* Yellow light */}
      <mesh position={[0, 1.1, 0.08]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial
          color={redOn ? 0xffaa00 : 0x332200}
          emissive={redOn ? 0xffaa00 : 0x000000}
          emissiveIntensity={redOn ? 0.5 + pulse * 0.5 : 0}
        />
      </mesh>
      {/* Green light */}
      <mesh position={[0, 0.95, 0.08]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial
          color={greenOn ? 0x00ff00 : 0x003300}
          emissive={greenOn ? 0x00ff00 : 0x000000}
          emissiveIntensity={greenOn ? 0.8 : 0}
        />
      </mesh>
    </group>
  );
}

function TreeMesh({ data }: { data: RenderTree }) {
  const models = useGameModels();
  if (!models) return null;
  const m = models.trees[data.modelIdx % models.trees.length];
  return (
    <mesh geometry={m.geometry} material={m.material}
      scale={[MODEL_SCALE, MODEL_SCALE, MODEL_SCALE]}
      position={[data.x, 0, data.z]}
    />
  );
}

function VehicleMesh({ data }: { data: RenderVehicle }) {
  const models = useGameModels();
  if (!models) return null;
  const m = data.isTruck
    ? models.trucks[data.modelIdx % models.trucks.length]
    : models.cars[data.modelIdx % models.cars.length];
  const baseRotY = Math.PI / 2;
  const flipRotY = data.flipY ? Math.PI : 0;
  return (
    <mesh geometry={m.geometry} material={m.material}
      scale={[MODEL_SCALE, MODEL_SCALE, MODEL_SCALE]}
      position={[data.x, 0, data.z]}
      rotation={[0, baseRotY + flipRotY, 0]}
    />
  );
}

function TrainMeshGroup({ data }: { data: RenderTrain }) {
  const models = useGameModels();
  if (!models) return null;
  // Train spawns from the left side (obs.x starts very negative and moves right).
  // Part layout from x=0: FRONT at offset 0 (leading edge), middles behind it,
  // BACK at the rear. Parts are spaced by TRAIN_PART_WIDTH.
  // Since the train moves left-to-right, the front is the RIGHTMOST part visually.
  // So: back at 0, middles at 1..3, front at 4 (= leading edge going right).
  return (
    <group position={[data.x, 0, data.z]}>
      {/* Back of train (trailing, lowest x) */}
      <mesh geometry={models.train.back.geometry} material={models.train.back.material}
        scale={[MODEL_SCALE, MODEL_SCALE, MODEL_SCALE]}
        position={[0, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
      />
      {/* Middle cars */}
      {[1, 2, 3].map(ti => (
        <mesh key={ti} geometry={models.train.middle.geometry} material={models.train.middle.material}
          scale={[MODEL_SCALE, MODEL_SCALE, MODEL_SCALE]}
          position={[ti * TRAIN_PART_WIDTH, 0, 0]}
          rotation={[0, Math.PI / 2, 0]}
        />
      ))}
      {/* Front of train (leading edge, highest x) */}
      <mesh geometry={models.train.front.geometry} material={models.train.front.material}
        scale={[MODEL_SCALE, MODEL_SCALE, MODEL_SCALE]}
        position={[4 * TRAIN_PART_WIDTH, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
      />
    </group>
  );
}

function LogMesh({ data }: { data: RenderLog }) {
  const models = useGameModels();
  if (!models) return null;
  const m = models.logs[data.modelIdx % models.logs.length];
  return (
    <mesh geometry={m.geometry} material={m.material}
      scale={[MODEL_SCALE, MODEL_SCALE, MODEL_SCALE]}
      position={[data.x, 0.08, data.z]}
    />
  );
}

function CoinMesh({ data }: { data: RenderCoin }) {
  return (
    <mesh position={[data.x, 0.5, data.z]} rotation={[Math.PI / 2, data.rotY, 0]}>
      <cylinderGeometry args={[0.15, 0.15, 0.05, 16]} />
      <meshLambertMaterial color={0xffd700} emissive={0xaa8800} />
    </mesh>
  );
}

export default function CrossyRoad3DScene({ onGameOver, onScoreUpdate }: Props) {
  const models = useGameModels();
  const { camera } = useThree();
  const audioRef = useRef<CrossyRoadAudio | null>(null);
  const gameRef = useRef<GameState | null>(null);
  const onGameOverRef = useRef(onGameOver);
  const onScoreUpdateRef = useRef(onScoreUpdate);
  onGameOverRef.current = onGameOver;
  onScoreUpdateRef.current = onScoreUpdate;

  const [snapshot, setSnapshot] = useState<RenderSnapshot>({
    grounds: [], trafficLights: [], trees: [], vehicles: [],
    trains: [], logs: [], coins: [],
    player: { x: LANES * CELL / 2, y: 0, z: -3, visible: true, opacity: 1, rotationY: 0 },
  });

  // Initialize game
  useEffect(() => {
    const audio = new CrossyRoadAudio();
    audioRef.current = audio;
    audio.init();

    const rows: Row[] = [];
    for (let i = 0; i < 30; i++) rows.push(generateRow(i));

    gameRef.current = {
      playerLane: Math.floor(LANES / 2),
      playerRow: 3, score: 0, maxRow: 0, steps: 0, coins: 0,
      rows, dead: false, deathTimer: 0,
      moving: false, moveDir: null, moveProgress: 0,
      fromLane: Math.floor(LANES / 2), fromRow: 3,
      hopAnim: 0, playerOffsetX: 0, playerRotation: 0,
      onRiver: false,
    };

    return () => { audio.dispose(); };
  }, []);

  // Input: A=left, S=down, D=right, Space=jump forward
  const handleMove = useCallback((dir: string) => {
    const g = gameRef.current;
    const audio = audioRef.current;
    if (!g || g.dead || g.moving) return;

    const currentRow = g.rows[g.playerRow];
    const wasOnRiver = currentRow && currentRow.type === "river";
    const visualXBefore = g.playerLane * CELL + CELL / 2 + g.playerOffsetX;

    // Check tree collision before moving
    let targetLane = g.playerLane;
    let targetRow = g.playerRow;

    if (dir === "up") { targetRow = g.playerRow + 1; }
    else if (dir === "down") { targetRow = Math.max(0, g.playerRow - 1); }
    else if (dir === "left") { targetLane = Math.max(0, g.playerLane - 1); }
    else if (dir === "right") { targetLane = Math.min(LANES - 1, g.playerLane + 1); }

    // Block movement into trees
    const destRow = g.rows[targetRow];
    if (destRow && destRow.type === "grass" && destRow.treeIndices.includes(targetLane)) {
      return; // blocked by tree
    }

    g.moving = true;
    g.moveDir = dir;
    g.moveProgress = 0;
    g.fromLane = g.playerLane;
    g.fromRow = g.playerRow;

    g.playerLane = targetLane;
    g.playerRow = targetRow;

    if (dir === "up") {
      g.steps++;
      if (g.playerRow > g.maxRow) {
        g.maxRow = g.playerRow;
        g.score = g.maxRow;
      }
    }

    const newRow = g.rows[g.playerRow];
    const nowOnRiver = newRow && newRow.type === "river";

    if (wasOnRiver && !nowOnRiver) {
      const snappedLane = Math.round((visualXBefore - CELL / 2) / CELL);
      g.playerLane = Math.max(0, Math.min(LANES - 1, snappedLane));
      g.playerOffsetX = 0;
      g.onRiver = false;
    } else if (nowOnRiver) {
      let actualPx: number;
      if (wasOnRiver) {
        actualPx = visualXBefore;
        if (dir === "left") actualPx -= CELL;
        else if (dir === "right") actualPx += CELL;
      } else {
        actualPx = g.playerLane * CELL + CELL / 2;
      }

      let foundLog: LogObj | null = null;
      for (const log of newRow.logs) {
        if (actualPx >= log.x - LOG_TOLERANCE && actualPx <= log.x + log.width + LOG_TOLERANCE) {
          foundLog = log;
          break;
        }
      }

      if (foundLog) {
        const logCenter = foundLog.x + foundLog.width / 2;
        g.playerOffsetX = logCenter - (g.playerLane * CELL + CELL / 2);
      }
      g.onRiver = true;
    } else {
      g.playerOffsetX = 0;
      g.onRiver = false;
    }

    // Rotation: flip by Math.PI so chicken face matches direction
    if (dir === "up") g.playerRotation = 0;
    else if (dir === "down") g.playerRotation = Math.PI;
    else if (dir === "left") g.playerRotation = -Math.PI / 2;
    else if (dir === "right") g.playerRotation = Math.PI / 2;

    g.hopAnim = 1;
    audio?.playHop();
    onScoreUpdateRef.current(g.score, g.steps, g.coins);
  }, []);

  useEffect(() => {
    let touchStartX = 0, touchStartY = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      let dir: string | null = null;
      if (key === " " || key === "arrowup") dir = "up";
      else if (key === "s" || key === "arrowdown") dir = "down";
      else if (key === "a" || key === "arrowleft") dir = "left";
      else if (key === "d" || key === "arrowright") dir = "right";
      if (dir) { e.preventDefault(); handleMove(dir); }
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const absDx = Math.abs(dx), absDy = Math.abs(dy);
      if (absDx < 15 && absDy < 15) { handleMove("up"); return; }
      if (absDy > absDx) handleMove(dy < 0 ? "up" : "down");
      else handleMove(dx > 0 ? "right" : "left");
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleMove]);

  // Game loop
  const frameCountRef = useRef(0);

  useFrame((_, delta) => {
    const g = gameRef.current;
    const audio = audioRef.current;
    if (!g || !models) return;

    const dt = Math.min(delta, 0.05);

    if (!g.dead) {
      if (g.moving) {
        g.moveProgress += dt * 8;
        if (g.moveProgress >= 1) {
          g.moving = false;
          g.moveProgress = 0;
        }
      }

      if (g.hopAnim > 0) {
        g.hopAnim -= dt * 6;
        if (g.hopAnim < 0) g.hopAnim = 0;
      }

      while (g.rows.length <= g.playerRow + 20) {
        g.rows.push(generateRow(g.rows.length));
      }

      for (const row of g.rows) {
        if (row.type === "road") {
          for (const obs of row.obstacles) {
            obs.x += obs.speed * dt;
            if (obs.x > LANES * CELL + 3) obs.x = -obs.width;
            if (obs.x < -obs.width - 3) obs.x = LANES * CELL;
          }
        }
        if (row.type === "rail") {
          if (row.obstacles.length === 0) {
            row.trainTimer -= dt;

            if (row.trainTimer <= TRAIN_WARNING_DURATION && !row.trainWarningPhase) {
              row.trainWarningPhase = true;
              row.trainWarning = true;
              audio?.playTrainAlarm();
            }

            if (row.trainTimer <= 0) {
              audio?.playTrainPass();
              row.obstacles.push({
                x: TRAIN_SPAWN_X,
                speed: 8,
                width: TRAIN_TOTAL_WIDTH,
                modelIndex: 0,
                isTruck: false,
              });
            }
          } else {
            for (const obs of row.obstacles) obs.x += obs.speed * dt;
            if (row.obstacles[0].x > TRAIN_EXIT_X) {
              row.obstacles = [];
              row.trainWarning = false;
              row.trainWarningPhase = false;
              row.trainTimer = 4 + Math.random() * 6;
            }
          }
        }
        if (row.type === "river") {
          for (const log of row.logs) {
            log.x += log.speed * dt;
            if (log.x > LANES * CELL + 3) log.x = -log.width;
            if (log.x < -log.width - 3) log.x = LANES * CELL;
          }
        }
      }

      // Collision
      const currentRow = g.rows[g.playerRow];
      if (currentRow) {
        const px = g.playerLane * CELL + CELL / 2 + g.playerOffsetX;
        const pw = 0.4;

        if (currentRow.type === "road" || currentRow.type === "rail") {
          for (const obs of currentRow.obstacles) {
            if (px + pw / 2 > obs.x && px - pw / 2 < obs.x + obs.width) {
              g.dead = true;
              g.deathTimer = 0;
              if (currentRow.type === "road") audio?.playCarHit();
              else audio?.playDeath();
              return;
            }
          }
        }

        if (currentRow.type === "river") {
          let onLog = false;
          // Use a smaller player half-width for river so chicken needs to be more centered
          const riverPw = 0.3;
          for (const log of currentRow.logs) {
            const logLeft = log.x - LOG_TOLERANCE;
            const logRight = log.x + log.width + LOG_TOLERANCE;
            if (px + riverPw / 2 > logLeft && px - riverPw / 2 < logRight) {
              onLog = true;
              // Ride the log — update offset by log speed when not jumping
              if (!g.moving) g.playerOffsetX += log.speed * dt;
              break;
            }
          }
          if (!onLog) { g.dead = true; g.deathTimer = 0; audio?.playWater(); return; }
          // Out of bounds check
          if (px < -CELL || px > LANES * CELL + CELL) { g.dead = true; g.deathTimer = 0; audio?.playWater(); return; }
        }

        if (currentRow.coin && !currentRow.coin.collected && currentRow.coin.lane === g.playerLane) {
          currentRow.coin.collected = true;
          g.coins++;
          audio?.playCoin();
        }
      }
    } else {
      g.deathTimer += dt;
      if (g.deathTimer > 1.5) {
        onGameOverRef.current(g.score, g.steps, g.coins);
        return;
      }
    }

    // Camera follow
    const targetZ = -(g.playerRow - 5) * CELL;
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ + 8, 0.05);
    camera.position.x = (LANES * CELL) / 2;

    // Build render snapshot (throttled to ~30fps)
    frameCountRef.current++;
    if (frameCountRef.current % 2 !== 0) return;

    const startRow = Math.max(0, g.playerRow - 8);
    const endRow = Math.min(g.rows.length - 1, g.playerRow + 15);
    const now = Date.now();

    const grounds: RenderGround[] = [];
    const trafficLights: RenderTrafficLight[] = [];
    const trees: RenderTree[] = [];
    const vehicles: RenderVehicle[] = [];
    const trains: RenderTrain[] = [];
    const logRenders: RenderLog[] = [];
    const coins: RenderCoin[] = [];

    for (let r = startRow; r <= endRow; r++) {
      const row = g.rows[r];
      if (!row) continue;
      const z = -r * CELL;
      const cx = (LANES * CELL) / 2;

      grounds.push({ id: `g${r}`, x: cx, z, rowType: row.type, grassDark: row.grassDark });

      // Traffic lights on rail rows (placed at both sides)
      if (row.type === "rail") {
        const isWarning = row.trainWarningPhase && row.obstacles.length === 0;
        const intensity = isWarning
          ? Math.min(1, (TRAIN_WARNING_DURATION - row.trainTimer) / TRAIN_WARNING_DURATION)
          : 0;
        trafficLights.push({ id: `tl${r}_l`, x: -0.5, z, isWarning, intensity });
        trafficLights.push({ id: `tl${r}_r`, x: LANES * CELL + 0.5, z, isWarning, intensity });
      }

      if (row.type === "grass") {
        for (const laneIdx of row.treeIndices) {
          trees.push({ id: `t${r}_${laneIdx}`, x: laneIdx * CELL + CELL / 2, z, modelIdx: r });
        }
      }

      for (let oi = 0; oi < row.obstacles.length; oi++) {
        const obs = row.obstacles[oi];
        if (row.type === "road") {
          vehicles.push({
            id: `v${r}_${oi}`,
            x: obs.x + obs.width / 2, z,
            modelIdx: obs.modelIndex, isTruck: obs.isTruck,
            flipY: obs.speed < 0,
          });
        } else if (row.type === "rail") {
          trains.push({ id: `tr${r}_${oi}`, x: obs.x, z });
        }
      }

      for (let li = 0; li < row.logs.length; li++) {
        const log = row.logs[li];
        logRenders.push({ id: `l${r}_${li}`, x: log.x + log.width / 2, z, modelIdx: log.modelIndex });
      }

      if (row.coin && !row.coin.collected) {
        coins.push({ id: `c${r}`, x: row.coin.lane * CELL + CELL / 2, z, rotY: now * 0.003 });
      }
    }

    // Player position
    let px: number, pz: number;
    if (g.moving) {
      const t = g.moveProgress;
      const fromX = g.fromLane * CELL + CELL / 2;
      const toX = g.playerLane * CELL + CELL / 2 + g.playerOffsetX;
      px = fromX + (toX - fromX) * t;
      pz = -g.fromRow * CELL + (-g.playerRow * CELL - (-g.fromRow * CELL)) * t;
    } else {
      px = g.playerLane * CELL + CELL / 2 + g.playerOffsetX;
      pz = -g.playerRow * CELL;
    }
    const hopOffset = Math.sin(g.hopAnim * Math.PI) * 0.3;

    const currentRow = g.rows[g.playerRow];
    const isOnRiver = currentRow && currentRow.type === "river";
    const baseY = isOnRiver ? LOG_Y_OFFSET : 0;

    setSnapshot({
      grounds, trafficLights, trees, vehicles, trains, logs: logRenders, coins,
      player: {
        x: px, y: baseY + hopOffset, z: pz,
        visible: !g.dead || g.deathTimer < 1,
        opacity: g.dead ? Math.max(0, 1 - g.deathTimer) : 1,
        rotationY: g.playerRotation,
      },
    });
  });

  const playerMat = useMemo(() => {
    if (!models) return null;
    return models.chicken.material.clone();
  }, [models]);

  if (!models || !playerMat) return null;

  return (
    <>
      {snapshot.grounds.map(d => <GroundTile key={d.id} data={d} />)}
      {snapshot.trafficLights.map(d => <TrafficLight key={d.id} data={d} />)}
      {snapshot.trees.map(d => <TreeMesh key={d.id} data={d} />)}
      {snapshot.vehicles.map(d => <VehicleMesh key={d.id} data={d} />)}
      {snapshot.trains.map(d => <TrainMeshGroup key={d.id} data={d} />)}
      {snapshot.logs.map(d => <LogMesh key={d.id} data={d} />)}
      {snapshot.coins.map(d => <CoinMesh key={d.id} data={d} />)}

      {/* Player */}
      {snapshot.player.visible && (
        <mesh
          geometry={models.chicken.geometry}
          material={playerMat}
          scale={[MODEL_SCALE, MODEL_SCALE, MODEL_SCALE]}
          position={[snapshot.player.x, snapshot.player.y, snapshot.player.z]}
          rotation={[0, snapshot.player.rotationY, 0]}
        >
          {snapshot.player.opacity < 1 && (
            <meshLambertMaterial
              map={models.chicken.material.map}
              transparent
              opacity={snapshot.player.opacity}
            />
          )}
        </mesh>
      )}
    </>
  );
}
