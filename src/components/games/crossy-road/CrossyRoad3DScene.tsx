// @ts-nocheck
import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameModels } from "./CrossyRoadModels";
import CrossyRoadAudio from "./CrossyRoadAudio";

// ── Types ──
type RowType = "grass" | "road" | "rail" | "river";
type Biome = "green" | "desert" | "snow" | "dark_forest";

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
  biome: Biome;
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
  fromOffsetX: number;
  playerRotation: number;
  onRiver: boolean;
  riderLogIndex: number | null;
  riderLogRowIndex: number | null;
  riderLogStickX: number;
  pendingRiderLogIndex: number | null;
  pendingRiderRowIndex: number | null;
  pendingRiderStickX: number;
  fromRiderLogIndex: number | null;
  fromRiderRowIndex: number | null;
  fromRiderStickX: number;
  pendingExitSnap: boolean;
}

// ── Render snapshot for declarative rendering ──
interface RenderGround { id: string; x: number; z: number; rowType: RowType; grassDark: boolean; biome: Biome; }
interface RenderTrafficLight { id: string; x: number; z: number; isWarning: boolean; intensity: number; }
interface RenderTree { id: string; x: number; z: number; modelIdx: number; biome: Biome; groundY: number; }
interface RenderVehicle { id: string; x: number; z: number; modelIdx: number; isTruck: boolean; flipY: boolean; }
interface RenderTrain { id: string; x: number; z: number; }
interface RenderLog { id: string; x: number; z: number; modelIdx: number; width: number; }
interface RenderCoin { id: string; x: number; z: number; rotY: number; groundY: number; }
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

// Extended playable horizontal range (player can walk between these lanes).
// LANES (=9) remains the visual "core" tile group used for ground rendering.
const MIN_LANE = -6;
const MAX_LANE = 14; // inclusive → 21 playable columns
const PLAY_LEFT_X = MIN_LANE * CELL;
const PLAY_RIGHT_X = (MAX_LANE + 1) * CELL;
const PLAY_WIDTH = PLAY_RIGHT_X - PLAY_LEFT_X;

// Spawn margin — cars/logs appear from well off-screen
const SPAWN_MARGIN = 6;

// Train constants
const TRAIN_PART_WIDTH = 4.6;
const TRAIN_TOTAL_PARTS = 5;
const TRAIN_TOTAL_WIDTH = TRAIN_PART_WIDTH * TRAIN_TOTAL_PARTS;
const TRAIN_SPAWN_X = PLAY_LEFT_X - TRAIN_TOTAL_WIDTH - 5;
const TRAIN_EXIT_X = PLAY_RIGHT_X + TRAIN_TOTAL_WIDTH + 5;

// Warning timing
const TRAIN_WARNING_DURATION = 3.0;

// Grass top elevation (matches grass model height)
const GRASS_TOP = 0.375;

// Player on-log Y offset (above the log surface)
const LOG_Y_OFFSET = 0.45;

// Log collision tolerance (small grace edge after visual/logical width unification)
const LOG_TOLERANCE = 0.15;

// Returns the visual top elevation of a row's ground for placing objects
function rowTopY(rowType: RowType): number {
  return rowType === "grass" ? GRASS_TOP : 0.01;
}

// ── Biome colors ──
const BIOME_COLORS: Record<Biome, { ground: number; groundDark: number; tree: number; sky: string }> = {
  green:       { ground: 0x7ec850, groundDark: 0x6ab040, tree: 0x2d6b1e, sky: "#87CEEB" },
  desert:      { ground: 0xd4a847, groundDark: 0xc49535, tree: 0x8b6914, sky: "#E8C87A" },
  snow:        { ground: 0xe8eef0, groundDark: 0xc8d8e0, tree: 0x4a7a6a, sky: "#B8D4E8" },
  dark_forest: { ground: 0x3a5a2a, groundDark: 0x2a4420, tree: 0x1a3010, sky: "#4A6848" },
};

function getBiome(index: number): Biome {
  if (index < 100) return "green";
  const adjusted = index - 100;
  const biomes: Biome[] = ["desert", "snow", "dark_forest"];
  return biomes[Math.floor(adjusted / 20) % biomes.length];
}

function getDifficulty(index: number): number {
  // Safe "learning" zone for first 15 rows, then slow ramp.
  // Reaches 1.0 only around row 165, then continues very slowly.
  if (index < 15) return 0;
  const ramp = (index - 15) / 150; // 0 → 1 across 150 rows
  const base = Math.min(ramp, 1);
  const tail = Math.max(0, (index - 165) / 400); // very slow growth past 1
  return Math.min(base + tail, 1.6); // hard cap (was effectively higher)
}

interface Props {
  onGameOver: (score: number, steps: number, coins: number) => void;
  onScoreUpdate: (score: number, steps: number, coins: number) => void;
}

function generateRow(index: number): Row {
  const biome = getBiome(index);
  const diff = getDifficulty(index);

  // Extended safe zone: first 8 rows are guaranteed grass (was 4)
  if (index < 8) {
    return {
      type: "grass", obstacles: [], logs: [], coin: null,
      trainWarning: false, trainTimer: 0, trainWarningPhase: false,
      treeIndices: [], grassDark: index % 2 === 0, biome,
    };
  }

  const rand = Math.random();
  let type: RowType;

  // Early rows (8-25) heavily favor grass; danger ramps slowly afterwards
  const earlyFactor = Math.max(0, Math.min(1, (index - 8) / 20)); // 0 → 1 across rows 8-28
  const grassChance = Math.max(0.25, 0.55 - diff * 0.15) * (1 - earlyFactor * 0.3 + 0.3);
  const roadChance = grassChance + (0.20 + diff * 0.05) * earlyFactor + 0.05;
  const railChance = roadChance + (0.10 + diff * 0.05) * earlyFactor;

  if (rand < grassChance) type = "grass";
  else if (rand < roadChance) type = "road";
  else if (rand < railChance) type = "rail";
  else type = "river";

  const row: Row = {
    type, obstacles: [], logs: [], coin: null,
    trainWarning: false, trainTimer: 0, trainWarningPhase: false,
    treeIndices: [], grassDark: Math.random() > 0.5, biome,
  };

  if (type === "grass" && index > 3) {
    const treePositions: number[] = [];
    // More trees in dark_forest
    const treeChance = biome === "dark_forest" ? 0.25 : 0.4;
    if (Math.random() > treeChance) treePositions.push(0);
    if (Math.random() > treeChance) treePositions.push(LANES - 1);

    // More interior trees at higher difficulty and in dark_forest
    const interiorCount = biome === "dark_forest" ? 2 : (diff > 0.5 ? 1 : 0);
    const interiorCandidates = [2, 3, 4, 5, 6];
    for (let t = 0; t < interiorCount; t++) {
      if (Math.random() > 0.4) {
        const picked = interiorCandidates[Math.floor(Math.random() * interiorCandidates.length)];
        if (!treePositions.includes(picked)) treePositions.push(picked);
      }
    }
    // Ensure at least 3 free lanes
    if (treePositions.length > LANES - 3) {
      treePositions.length = LANES - 3;
    }
    row.treeIndices = treePositions;
  }

  if (type === "road") {
    const dir = Math.random() > 0.5 ? 1 : -1;
    // Scale car count up with the wider playfield
    const baseCount = 2 + Math.floor(Math.random() * 3);
    const count = Math.min(6, baseCount + (diff > 0.8 ? 1 : 0));
    // ~30% slower base speed and gentler difficulty growth, capped lower
    const baseSpeed = 1.7 + Math.random() * 1.4;
    const rawSpeed = baseSpeed + diff * 1.8;
    const speed = Math.min(rawSpeed, 5.5) * dir;
    const isTruck = Math.random() < 0.3;

    // Spawn cars spread across full extended range
    const totalRange = PLAY_WIDTH + SPAWN_MARGIN * 2;
    const spacing = totalRange / count;
    for (let i = 0; i < count; i++) {
      const startX = PLAY_LEFT_X - SPAWN_MARGIN + spacing * i + Math.random() * (spacing * 0.5);
      row.obstacles.push({
        x: startX,
        speed, width: isTruck ? 2 : 1,
        modelIndex: Math.floor(Math.random() * (isTruck ? 2 : 6)),
        isTruck,
      });
    }
  } else if (type === "rail") {
    // Much longer first train cooldown (7-10s), shrinking slowly with difficulty
    row.trainTimer = Math.max(4, (7 + Math.random() * 3) - diff * 1.5);
  } else if (type === "river") {
    const dir = Math.random() > 0.5 ? 1 : -1;
    // More logs early on; scaled to wider playfield
    const baseLogCount = 5 - Math.floor(diff * 1);
    const count = Math.max(4, baseLogCount);
    const baseSpeed = 1.0 + Math.random() * 1.0;
    const rawSpeed = baseSpeed + diff * 0.9;
    const speed = Math.min(rawSpeed, 3.0) * dir;

    const logWidth = 1.5 + Math.random() * 1.0;
    const totalRange = PLAY_WIDTH + SPAWN_MARGIN * 2;
    const spacing = totalRange / count;
    const minGap = 2.5;

    for (let i = 0; i < count; i++) {
      const maxJitter = Math.max(0, spacing - logWidth - minGap);
      const startX = PLAY_LEFT_X - SPAWN_MARGIN + spacing * i + Math.random() * maxJitter;
      row.logs.push({
        x: startX,
        speed, width: logWidth,
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

  const biomeColors = BIOME_COLORS[data.biome];

  if (data.rowType === "grass") {
    geometry = models.grass.obj.geometry;
    const tex = data.grassDark ? models.grass.darkTex : models.grass.lightTex;
    material = new THREE.MeshLambertMaterial({ map: tex, color: data.grassDark ? biomeColors.groundDark : biomeColors.ground });
  } else if (data.rowType === "road") {
    geometry = models.road.obj.geometry;
    // Deterministic texture choice per tile id — prevents flicker between
    // re-renders (stripes vs blank flipping randomly each snapshot).
    let h = 0;
    for (let i = 0; i < data.id.length; i++) h = (h * 31 + data.id.charCodeAt(i)) >>> 0;
    const useStripes = (h & 1) === 1;
    const tex = useStripes ? models.road.stripesTex : models.road.blankTex;
    material = new THREE.MeshLambertMaterial({
      map: tex,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
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

// Traffic Light component
function TrafficLight({ data }: { data: RenderTrafficLight }) {
  const pulse = Math.abs(Math.sin(Date.now() * 0.008));
  const redOn = data.isWarning;
  const greenOn = !data.isWarning;

  return (
    <group position={[data.x, 0, data.z]} scale={[2, 2, 2]}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1, 8]} />
        <meshLambertMaterial color={0x333333} />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[0.2, 0.5, 0.15]} />
        <meshLambertMaterial color={0x222222} />
      </mesh>
      <mesh position={[0, 1.25, 0.08]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial
          color={redOn ? 0xff0000 : 0x330000}
          emissive={redOn ? 0xff0000 : 0x000000}
          emissiveIntensity={redOn ? 1.5 + pulse * 2 : 0}
        />
      </mesh>
      <mesh position={[0, 1.1, 0.08]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial
          color={redOn ? 0xffaa00 : 0x332200}
          emissive={redOn ? 0xffaa00 : 0x000000}
          emissiveIntensity={redOn ? 0.5 + pulse * 0.5 : 0}
        />
      </mesh>
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
  const biomeColor = BIOME_COLORS[data.biome].tree;
  const tintedMat = useMemo(() => {
    if (!models) return null;
    const m = models.trees[data.modelIdx % models.trees.length];
    const mat = m.material.clone();
    mat.color = new THREE.Color(biomeColor);
    return mat;
  }, [models, data.modelIdx, biomeColor]);

  if (!models || !tintedMat) return null;
  const m = models.trees[data.modelIdx % models.trees.length];

  return (
    <mesh geometry={m.geometry} material={tintedMat}
      scale={[MODEL_SCALE, MODEL_SCALE, MODEL_SCALE]}
      position={[data.x, data.groundY, data.z]}
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
      position={[data.x, 0.05, data.z]}
      rotation={[0, baseRotY + flipRotY, 0]}
    />
  );
}

function TrainMeshGroup({ data }: { data: RenderTrain }) {
  const models = useGameModels();
  if (!models) return null;
  const offset = TRAIN_PART_WIDTH / 2;
  return (
    <group position={[data.x, 0.05, data.z]}>
      <mesh geometry={models.train.back.geometry} material={models.train.back.material}
        scale={[MODEL_SCALE, MODEL_SCALE, MODEL_SCALE]}
        position={[offset, 0, 0]}
      />
      {[1, 2, 3].map(ti => (
        <mesh key={ti} geometry={models.train.middle.geometry} material={models.train.middle.material}
          scale={[MODEL_SCALE, MODEL_SCALE, MODEL_SCALE]}
          position={[offset + ti * TRAIN_PART_WIDTH, 0, 0]}
        />
      ))}
      <mesh geometry={models.train.front.geometry} material={models.train.front.material}
        scale={[MODEL_SCALE, MODEL_SCALE, MODEL_SCALE]}
        position={[offset + 4 * TRAIN_PART_WIDTH, 0, 0]}
      />
    </group>
  );
}

function LogMesh({ data }: { data: RenderLog }) {
  const models = useGameModels();
  // Hooks must be called unconditionally — compute native width even if models null.
  const m = models ? models.logs[data.modelIdx % models.logs.length] : null;
  const nativeWidth = useMemo(() => {
    if (!m) return 1;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox!;
    return Math.max(0.001, (bb.max.x - bb.min.x) * MODEL_SCALE);
  }, [m]);
  if (!m) return null;

  // Tile enough segments to cover the logical width without visual stretching.
  const segments = Math.max(1, Math.ceil(data.width / nativeWidth));
  const totalNative = segments * nativeWidth;
  // Slight uniform X scale so tiled segments exactly fit data.width (≤1, no stretching).
  const fitScale = data.width / totalNative;
  const segWidthRendered = nativeWidth * fitScale;
  const startX = -data.width / 2 + segWidthRendered / 2;

  return (
    <group position={[data.x, 0.18, data.z]}>
      {Array.from({ length: segments }).map((_, i) => (
        <mesh
          key={i}
          geometry={m.geometry}
          material={m.material}
          scale={[fitScale * MODEL_SCALE, MODEL_SCALE, MODEL_SCALE]}
          position={[startX + i * segWidthRendered, 0, 0]}
        />
      ))}
    </group>
  );
}

function CoinMesh({ data }: { data: RenderCoin }) {
  return (
    <mesh position={[data.x, data.groundY + 0.5, data.z]} rotation={[Math.PI / 2, data.rotY, 0]}>
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
      hopAnim: 0, playerOffsetX: 0, fromOffsetX: 0, playerRotation: 0,
      onRiver: false,
      riderLogIndex: null, riderLogRowIndex: null, riderLogStickX: 0,
      pendingRiderLogIndex: null, pendingRiderRowIndex: null, pendingRiderStickX: 0,
      fromRiderLogIndex: null, fromRiderRowIndex: null, fromRiderStickX: 0,
      pendingExitSnap: false,
    };

    return () => { audio.dispose(); };
  }, []);

  // Input
  const handleMove = useCallback((dir: string) => {
    const g = gameRef.current;
    const audio = audioRef.current;
    if (!g || g.dead || g.moving) return;

    const currentRow = g.rows[g.playerRow];
    const wasOnRiver = currentRow && currentRow.type === "river";
    const visualXBefore = g.playerLane * CELL + CELL / 2 + g.playerOffsetX;

    let targetLane = g.playerLane;
    let targetRow = g.playerRow;

    if (dir === "up") { targetRow = g.playerRow + 1; }
    else if (dir === "down") { targetRow = Math.max(0, g.playerRow - 1); }
    else if (dir === "left") { targetLane = Math.max(MIN_LANE, g.playerLane - 1); }
    else if (dir === "right") { targetLane = Math.min(MAX_LANE, g.playerLane + 1); }

    const destRow = g.rows[targetRow];
    if (destRow && destRow.type === "grass" && destRow.treeIndices.includes(targetLane)) {
      return;
    }

    g.moving = true;
    g.moveDir = dir;
    g.moveProgress = 0;
    g.fromLane = g.playerLane;
    g.fromRow = g.playerRow;
    g.fromOffsetX = g.playerOffsetX; // remember actual visual start
    // Preserve current rider state as the "from" so camera/player visual interpolation
    // begins exactly at the player's current visual position (prevents camera snap).
    g.fromRiderLogIndex = g.riderLogIndex;
    g.fromRiderRowIndex = g.riderLogRowIndex;
    g.fromRiderStickX = g.riderLogStickX;
    g.playerLane = targetLane;
    g.playerRow = targetRow;
    g.pendingRiderLogIndex = null;
    g.pendingRiderRowIndex = null;
    g.pendingRiderStickX = 0;
    g.pendingExitSnap = false;

    if (dir === "up") {
      // Only count a step when the player advances beyond their furthest row
      if (g.playerRow > g.maxRow) {
        g.steps++;
        g.maxRow = g.playerRow;
        g.score = g.maxRow;
      }
    }

    const newRow = g.rows[g.playerRow];
    const nowOnRiver = newRow && newRow.type === "river";

    if (wasOnRiver && !nowOnRiver) {
      // Defer snap to grass center until animation completes,
      // so the jump animates from the actual log position.
      let snappedLane = Math.round((visualXBefore - CELL / 2) / CELL);
      snappedLane = Math.max(MIN_LANE, Math.min(MAX_LANE, snappedLane));
      // If destination grass lane has a tree, pick nearest free lane in playable range.
      if (newRow && newRow.type === "grass" && newRow.treeIndices.includes(snappedLane)) {
        let found = snappedLane;
        for (let off = 1; off <= (MAX_LANE - MIN_LANE); off++) {
          const left = snappedLane - off;
          const right = snappedLane + off;
          if (left >= MIN_LANE && !newRow.treeIndices.includes(left)) { found = left; break; }
          if (right <= MAX_LANE && !newRow.treeIndices.includes(right)) { found = right; break; }
        }
        snappedLane = found;
      }
      g.playerLane = snappedLane;
      // Keep playerOffsetX as-is (relative to old lane center).
      // Recompute relative to new lane so visualXBefore is preserved.
      g.playerOffsetX = visualXBefore - (g.playerLane * CELL + CELL / 2);
      g.pendingExitSnap = true;
      // Save the departing log so the hop start tracks it dynamically while it drifts.
      if (currentRow && currentRow.type === "river" && g.riderLogIndex !== null) {
        const fromLog = currentRow.logs[g.riderLogIndex];
        if (fromLog) {
          g.fromRiderLogIndex = g.riderLogIndex;
          g.fromRiderRowIndex = g.fromRow;
          // Clamp stickX strictly inside the visible log bounds.
          g.fromRiderStickX = Math.max(0, Math.min(fromLog.width, g.riderLogStickX));
        }
      }
      // Clear rider lock immediately — we're leaving the river.
      g.riderLogIndex = null;
      g.riderLogRowIndex = null;
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

      // Find best (closest center) log on the destination row
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < newRow.logs.length; i++) {
        const log = newRow.logs[i];
        const logLeft = log.x;
        const logRight = log.x + log.width;
        const center = (logLeft + logRight) / 2;
        const inside = actualPx >= logLeft - LOG_TOLERANCE && actualPx <= logRight + LOG_TOLERANCE;
        const d = Math.abs(actualPx - center);
        if (inside && d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0) {
        const log = newRow.logs[bestIdx];
        // Clamp stickX strictly inside log bounds — no phantom edges.
        const stickX = Math.max(0, Math.min(log.width, actualPx - log.x));
        g.pendingRiderLogIndex = bestIdx;
        g.pendingRiderRowIndex = g.playerRow;
        g.pendingRiderStickX = stickX;
        const lockedPx = log.x + stickX;
        g.playerOffsetX = lockedPx - (g.playerLane * CELL + CELL / 2);
      } else {
        g.playerOffsetX = actualPx - (g.playerLane * CELL + CELL / 2);
      }
      if (wasOnRiver && currentRow && g.riderLogIndex !== null) {
        const fromLog = currentRow.logs[g.riderLogIndex];
        if (fromLog) {
          g.fromRiderLogIndex = g.riderLogIndex;
          g.fromRiderRowIndex = g.fromRow;
          g.fromRiderStickX = Math.max(0, Math.min(fromLog.width, g.riderLogStickX));
        }
      }
      // Don't lock riderLog yet; clear previous lock so river-check uses pending logic.
      g.riderLogIndex = null;
      g.riderLogRowIndex = null;
      g.onRiver = true;
    } else {
      g.playerOffsetX = 0;
      g.onRiver = false;
      g.riderLogIndex = null;
      g.riderLogRowIndex = null;
    }

    if (dir === "up") g.playerRotation = Math.PI;
    else if (dir === "down") g.playerRotation = 0;
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
          // Commit pending rider lock now that the hop has finished — validate the player is still over the log.
          if (g.pendingRiderLogIndex !== null && g.pendingRiderRowIndex === g.playerRow) {
            const dRow = g.rows[g.playerRow];
            const log = dRow?.logs[g.pendingRiderLogIndex];
            if (log) {
              const lockedPx = log.x + g.pendingRiderStickX;
              const stillOnLog = lockedPx >= log.x - LOG_TOLERANCE && lockedPx <= log.x + log.width + LOG_TOLERANCE;
              if (stillOnLog) {
                g.riderLogIndex = g.pendingRiderLogIndex;
                g.riderLogRowIndex = g.pendingRiderRowIndex;
                g.riderLogStickX = g.pendingRiderStickX;
                g.playerOffsetX = lockedPx - (g.playerLane * CELL + CELL / 2);
              } else {
                // Log drifted away mid-hop → fall in the water.
                g.dead = true;
                audio?.playWater();
              }
            } else {
              g.dead = true;
              audio?.playWater();
            }
          }
          g.pendingRiderLogIndex = null;
          g.pendingRiderRowIndex = null;
          // Snap to grass center after dismount animation completed.
          if (g.pendingExitSnap) {
            g.playerOffsetX = 0;
            g.pendingExitSnap = false;
          }
          g.fromOffsetX = 0;
          g.fromRiderLogIndex = null;
          g.fromRiderRowIndex = null;
          g.fromRiderStickX = 0;
        }
      }

      if (g.hopAnim > 0) {
        g.hopAnim -= dt * 6;
        if (g.hopAnim < 0) g.hopAnim = 0;
      }

      while (g.rows.length <= g.playerRow + 20) {
        g.rows.push(generateRow(g.rows.length));
      }

      // Update obstacles — cars and logs spawn from off-screen like trains
      for (const row of g.rows) {
        if (row.type === "road") {
          for (const obs of row.obstacles) {
            obs.x += obs.speed * dt;
            if (obs.speed > 0 && obs.x > PLAY_RIGHT_X + SPAWN_MARGIN) {
              obs.x = PLAY_LEFT_X - obs.width - SPAWN_MARGIN;
            }
            if (obs.speed < 0 && obs.x < PLAY_LEFT_X - obs.width - SPAWN_MARGIN) {
              obs.x = PLAY_RIGHT_X + SPAWN_MARGIN;
            }
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
                speed: 8 + getDifficulty(g.playerRow) * 4,
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
              row.trainTimer = Math.max(4, (8 + Math.random() * 4) - getDifficulty(g.playerRow) * 1.5);
            }
          }
        }
        if (row.type === "river") {
          for (const log of row.logs) {
            log.x += log.speed * dt;
            if (log.speed > 0 && log.x > PLAY_RIGHT_X + SPAWN_MARGIN) {
              log.x = PLAY_LEFT_X - log.width - SPAWN_MARGIN;
            }
            if (log.speed < 0 && log.x < PLAY_LEFT_X - log.width - SPAWN_MARGIN) {
              log.x = PLAY_RIGHT_X + SPAWN_MARGIN;
            }
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

        if (currentRow.type === "river" && !g.moving) {
          let onLog = false;

          // If we have a tracked rider log, follow it precisely
          if (
            !g.moving &&
            g.riderLogIndex !== null &&
            g.riderLogRowIndex === g.playerRow &&
            currentRow.logs[g.riderLogIndex]
          ) {
            const log = currentRow.logs[g.riderLogIndex];
            const lockedPx = log.x + g.riderLogStickX;
            g.playerOffsetX = lockedPx - (g.playerLane * CELL + CELL / 2);
            // Verify still on log
            const logLeft = log.x;
            const logRight = log.x + log.width;
            if (lockedPx >= logLeft - LOG_TOLERANCE && lockedPx <= logRight + LOG_TOLERANCE) {
              onLog = true;
            }
          } else {
            const riverPw = 0.3;
            for (let li = 0; li < currentRow.logs.length; li++) {
              const log = currentRow.logs[li];
              const logLeft = log.x;
              const logRight = log.x + log.width;
              if (px + riverPw / 2 > logLeft - LOG_TOLERANCE && px - riverPw / 2 < logRight + LOG_TOLERANCE) {
                onLog = true;
                if (!g.moving) {
                  // Lock onto this log
                  g.riderLogIndex = li;
                  g.riderLogRowIndex = g.playerRow;
                  g.riderLogStickX = px - log.x;
                }
                break;
              }
            }
          }

          if (!onLog) { g.dead = true; g.deathTimer = 0; audio?.playWater(); return; }
          if (px < PLAY_LEFT_X - CELL || px > PLAY_RIGHT_X + CELL) { g.dead = true; g.deathTimer = 0; audio?.playWater(); return; }
        }

        if (currentRow.coin && !currentRow.coin.collected && currentRow.coin.lane === g.playerLane) {
          currentRow.coin.collected = true;
          g.coins++;
          console.log("[CrossyRoad] Coin collected! Total coins:", g.coins);
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

    // Camera follow — compute eased visual row (matches player render position) so the camera
    // glides smoothly during hops instead of snapping when playerRow updates.
    let visualRow = g.playerRow;
    if (g.moving) {
      const dz = g.moveDir === "up" ? 1 : g.moveDir === "down" ? -1 : 0;
      visualRow = g.fromRow + dz * g.moveProgress;
    }
    const targetZ = -(visualRow - 3) * CELL;
    const targetCamZ = targetZ + 8;
    const baseCamX = (LANES * CELL) / 2; // 4.5

    // Compute eased visual X (matches the player's render position) so the camera
    // glides smoothly during side hops instead of snapping when playerOffsetX updates.
    let playerVisualX: number;
    if (g.moving) {
      let fromXc: number;
      if (g.fromRiderLogIndex !== null && g.fromRiderRowIndex !== null) {
        const sRow = g.rows[g.fromRiderRowIndex];
        const sLog = sRow?.logs[g.fromRiderLogIndex];
        fromXc = sLog
          ? sLog.x + g.fromRiderStickX
          : g.fromLane * CELL + CELL / 2 + g.fromOffsetX;
      } else {
        fromXc = g.fromLane * CELL + CELL / 2 + g.fromOffsetX;
      }
      let toXc: number;
      if (g.pendingRiderLogIndex !== null && g.pendingRiderRowIndex === g.playerRow) {
        const dRow = g.rows[g.playerRow];
        const log = dRow?.logs[g.pendingRiderLogIndex];
        toXc = log
          ? log.x + g.pendingRiderStickX
          : g.playerLane * CELL + CELL / 2 + g.playerOffsetX;
      } else {
        toXc = g.playerLane * CELL + CELL / 2 + g.playerOffsetX;
      }
      // Ease the X interpolation (smoothstep) so lateral hops glide instead of starting/ending abruptly.
      const t = g.moveProgress;
      const easedX = t * t * (3 - 2 * t);
      playerVisualX = fromXc + (toXc - fromXc) * easedX;
    } else {
      playerVisualX = g.playerLane * CELL + CELL / 2 + g.playerOffsetX;
    }

    // Track logical lane center on X (not visual) to avoid jitter from log drift & jump easing.
    const targetCamX = g.playerLane * CELL + CELL / 2;
    const smoothZ = 1 - Math.exp(-18 * dt);
    const smoothX = 1 - Math.exp(-8 * dt);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, smoothZ);
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, smoothX);
    // Look straight ahead (same X as camera) to prevent the camera from yawing/tilting sideways with the player.
    camera.lookAt(camera.position.x, 0, targetZ - 4);

    // Build render snapshot (throttled to ~30fps)
    frameCountRef.current++;
    if (frameCountRef.current % 2 !== 0) return;

    const startRow = Math.max(0, g.playerRow - 14);
    const endRow = Math.min(g.rows.length - 1, g.playerRow + 18);
    const now = Date.now();

    // Side-fill widths (in CELL units) to extend ground tiles off-playfield.
    // Generous to cover ultra-wide / landscape viewports + horizontal camera
    // tracking without exposing sky/black gaps at the edges.
    const SIDE_EXTEND_TILES = 10; // each side tile spans LANES*CELL width

    const grounds: RenderGround[] = [];
    const trafficLights: RenderTrafficLight[] = [];
    const trees: RenderTree[] = [];
    const vehicles: RenderVehicle[] = [];
    const trains: RenderTrain[] = [];
    const logRenders: RenderLog[] = [];
    const coins: RenderCoin[] = [];

    // Deterministic hash → tree placement decision (stable across frames).
    const seededTree = (col: number, rowIdx: number, density: number): boolean => {
      let h = (col * 73856093) ^ (rowIdx * 19349663);
      h = (h ^ (h >>> 13)) * 1274126177;
      h = h ^ (h >>> 16);
      const v = (h >>> 0) / 0xffffffff;
      return v < density;
    };

    // Decorative back-fill rows behind row 0 — pure grass with deterministic trees.
    if (startRow === 0) {
      const cx = (LANES * CELL) / 2;
      for (let br = 1; br <= 14; br++) {
        const z = br * CELL;
        const dark = br % 2 === 0;
        grounds.push({ id: `gB${br}`, x: cx, z, rowType: "grass", grassDark: dark, biome: "green" });
        for (let s = 1; s <= SIDE_EXTEND_TILES; s++) {
          const offset = s * LANES * CELL;
          grounds.push({ id: `gBL${br}_${s}`, x: cx - offset, z, rowType: "grass", grassDark: !dark, biome: "green" });
          grounds.push({ id: `gBR${br}_${s}`, x: cx + offset, z, rowType: "grass", grassDark: !dark, biome: "green" });
        }
        const backRowVirtual = -br;
        const density = Math.max(0.12, 0.32 - br * 0.015);
        const minCol = -SIDE_EXTEND_TILES * LANES;
        const maxCol = (SIDE_EXTEND_TILES + 1) * LANES;
        for (let col = minCol; col < maxCol; col++) {
          if (col >= MIN_LANE && col <= MAX_LANE) continue;
          if (seededTree(col, backRowVirtual, density)) {
            trees.push({
              id: `tB${br}_${col}`,
              x: col * CELL + CELL / 2,
              z,
              modelIdx: ((col * 7 + br * 13) >>> 0) % 8,
              biome: "green",
              groundY: GRASS_TOP,
            });
          }
        }
      }
    }

    for (let r = startRow; r <= endRow; r++) {
      const row = g.rows[r];
      if (!row) continue;
      const z = -r * CELL;
      const cx = (LANES * CELL) / 2;

      grounds.push({ id: `g${r}`, x: cx, z, rowType: row.type, grassDark: row.grassDark, biome: row.biome });

      // Mirror ground tiles on both sides — continue SAME row type for clean
      // road/rail/river continuity to the edges.
      for (let s = 1; s <= SIDE_EXTEND_TILES; s++) {
        const offset = s * LANES * CELL;
        const sideDark = (row.type === "grass") ? (row.grassDark !== (s % 2 === 0)) : row.grassDark;
        grounds.push({
          id: `gL${r}_${s}`, x: cx - offset, z,
          rowType: row.type, grassDark: sideDark, biome: row.biome,
        });
        grounds.push({
          id: `gR${r}_${s}`, x: cx + offset, z,
          rowType: row.type, grassDark: sideDark, biome: row.biome,
        });
      }

      // Decorative side trees ONLY on grass rows — deterministic, regular.
      // Skip the extended playable zone so the player always has free lanes.
      if (row.type === "grass") {
        const density = row.biome === "dark_forest" ? 0.42 : 0.28;
        for (let s = 1; s <= SIDE_EXTEND_TILES; s++) {
          for (let lane = 0; lane < LANES; lane++) {
            const colL = -s * LANES + lane;
            if (colL < MIN_LANE && seededTree(colL, r, density)) {
              trees.push({
                id: `dl${r}_${s}_${lane}`,
                x: colL * CELL + CELL / 2, z,
                modelIdx: ((colL * 7 + r * 13) >>> 0) % 8,
                biome: row.biome, groundY: GRASS_TOP,
              });
            }
            const colR = LANES + (s - 1) * LANES + lane;
            if (colR > MAX_LANE && seededTree(colR, r, density)) {
              trees.push({
                id: `dr${r}_${s}_${lane}`,
                x: colR * CELL + CELL / 2, z,
                modelIdx: ((colR * 7 + r * 13) >>> 0) % 8,
                biome: row.biome, groundY: GRASS_TOP,
              });
            }
          }
        }
      }

      // Traffic lights on rail rows — positioned just outside playfield edges
      // but close enough to remain visible on narrow (mobile) viewports.
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
          trees.push({ id: `t${r}_${laneIdx}`, x: laneIdx * CELL + CELL / 2, z, modelIdx: r, biome: row.biome, groundY: GRASS_TOP });
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
        logRenders.push({ id: `l${r}_${li}`, x: log.x + log.width / 2, z, modelIdx: log.modelIndex, width: log.width });
      }

      if (row.coin && !row.coin.collected) {
        const coinGroundY = rowTopY(row.type);
        coins.push({ id: `c${r}`, x: row.coin.lane * CELL + CELL / 2, z, rotY: now * 0.003, groundY: coinGroundY });
      }
    }

    // Player position
    let px: number, pz: number;
    if (g.moving) {
      const t = g.moveProgress;
      // Track the departing log dynamically if we were standing on one.
      let fromX: number;
      if (g.fromRiderLogIndex !== null && g.fromRiderRowIndex !== null) {
        const sRow = g.rows[g.fromRiderRowIndex];
        const sLog = sRow?.logs[g.fromRiderLogIndex];
        if (sLog) {
          fromX = sLog.x + g.fromRiderStickX;
        } else {
          fromX = g.fromLane * CELL + CELL / 2 + g.fromOffsetX;
        }
      } else {
        fromX = g.fromLane * CELL + CELL / 2 + g.fromOffsetX;
      }
      // Dynamically track moving log destination so the player lands on it.
      let toX: number;
      if (g.pendingRiderLogIndex !== null && g.pendingRiderRowIndex === g.playerRow) {
        const dRow = g.rows[g.playerRow];
        const log = dRow?.logs[g.pendingRiderLogIndex];
        if (log) {
          const lockedPx = log.x + g.pendingRiderStickX;
          g.playerOffsetX = lockedPx - (g.playerLane * CELL + CELL / 2);
          toX = lockedPx;
        } else {
          toX = g.playerLane * CELL + CELL / 2 + g.playerOffsetX;
        }
      } else {
        toX = g.playerLane * CELL + CELL / 2 + g.playerOffsetX;
      }
      px = fromX + (toX - fromX) * t;
      pz = -g.fromRow * CELL + (-g.playerRow * CELL - (-g.fromRow * CELL)) * t;
    } else {
      px = g.playerLane * CELL + CELL / 2 + g.playerOffsetX;
      pz = -g.playerRow * CELL;
    }
    const hopOffset = Math.sin(g.hopAnim * Math.PI) * 0.3;

    const currentRow = g.rows[g.playerRow];
    const fromRow = g.rows[g.fromRow];
    const isOnRiver = currentRow && currentRow.type === "river";
    const destBaseY = isOnRiver ? LOG_Y_OFFSET + 0.05 : rowTopY(currentRow?.type ?? "grass") + 0.05;
    const srcIsRiver = fromRow && fromRow.type === "river";
    const srcBaseY = srcIsRiver ? LOG_Y_OFFSET + 0.05 : rowTopY(fromRow?.type ?? "grass") + 0.05;
    const baseY = g.moving
      ? srcBaseY + (destBaseY - srcBaseY) * g.moveProgress
      : destBaseY;

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
