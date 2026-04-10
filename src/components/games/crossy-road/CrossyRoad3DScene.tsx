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
}

// ── Render snapshot for declarative rendering ──
interface RenderGround { key: string; x: number; z: number; rowType: RowType; grassDark: boolean; }
interface RenderWarning { key: string; x: number; z: number; }
interface RenderTree { key: string; x: number; z: number; modelIdx: number; }
interface RenderVehicle { key: string; x: number; z: number; modelIdx: number; isTruck: boolean; flipY: boolean; }
interface RenderTrain { key: string; x: number; z: number; }
interface RenderLog { key: string; x: number; z: number; modelIdx: number; logWidth: number; }
interface RenderCoin { key: string; x: number; z: number; rotY: number; }
interface PlayerSnapshot { x: number; y: number; z: number; visible: boolean; opacity: number; rotationY: number; }

interface RenderSnapshot {
  grounds: RenderGround[];
  warnings: RenderWarning[];
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
// OBJ ground models are 25 units wide, we need them to cover LANES (9) units
const GROUND_SCALE_X = (LANES * CELL) / 25;
const GROUND_SCALE_Z = CELL / 1; // depth is 1 unit in OBJ, maps to CELL

interface Props {
  onGameOver: (score: number, steps: number, coins: number) => void;
  onScoreUpdate: (score: number, steps: number, coins: number) => void;
}

function generateRow(index: number): Row {
  if (index < 4) {
    return {
      type: "grass", obstacles: [], logs: [], coin: null,
      trainWarning: false, trainTimer: 0, treeIndices: [], grassDark: index % 2 === 0,
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
    trainWarning: false, trainTimer: 0, treeIndices: [], grassDark: Math.random() > 0.5,
  };

  if (type === "grass" && index > 3) {
    if (Math.random() > 0.5) row.treeIndices.push(0);
    if (Math.random() > 0.5) row.treeIndices.push(LANES - 1);
  }

  if (type === "road") {
    const dir = Math.random() > 0.5 ? 1 : -1;
    const count = 1 + Math.floor(Math.random() * 2);
    const speed = (2.5 + Math.random() * 3 + difficulty * 2) * dir;
    const isTruck = Math.random() < 0.3;
    for (let i = 0; i < count; i++) {
      row.obstacles.push({
        x: Math.random() * LANES * CELL,
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
    for (let i = 0; i < count; i++) {
      row.logs.push({
        x: ((LANES * CELL) / count) * i + Math.random() * 2,
        speed, width: 1.2,
        modelIndex: Math.floor(Math.random() * 4),
      });
    }
  }

  if (Math.random() < 0.15 && type !== "river") {
    row.coin = { lane: Math.floor(Math.random() * LANES), collected: false };
  }

  return row;
}

// ── Sub-components for declarative rendering ──
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
    // Alternate between striped and blank roads
    const tex = Math.random() > 0.5 ? models.road.stripesTex : models.road.blankTex;
    material = new THREE.MeshLambertMaterial({ map: tex });
  } else if (data.rowType === "rail") {
    geometry = models.railroad.geometry;
    material = models.railroad.material;
  } else {
    // river
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

function WarningTile({ data }: { data: RenderWarning }) {
  return (
    <mesh position={[data.x, 0.01, data.z]}>
      <boxGeometry args={[LANES * CELL, 0.05, CELL]} />
      <meshLambertMaterial color={0xff0000} transparent opacity={0.3} />
    </mesh>
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
  // Vehicles need 90° rotation: their long axis is Z in the OBJ but they move along X
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
  // After 90° rotation, the OBJ depth (~4.875) becomes the X-axis span of each part
  const partWidth = 1;
  return (
    <group position={[data.x, 0, data.z]}>
      <mesh geometry={models.train.front.geometry} material={models.train.front.material}
        scale={[MODEL_SCALE, MODEL_SCALE, MODEL_SCALE]}
        position={[0, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
      />
      {[1, 2, 3].map(ti => (
        <mesh key={ti} geometry={models.train.middle.geometry} material={models.train.middle.material}
          scale={[MODEL_SCALE, MODEL_SCALE, MODEL_SCALE]}
          position={[ti * partWidth, 0, 0]}
          rotation={[0, Math.PI / 2, 0]}
        />
      ))}
      <mesh geometry={models.train.back.geometry} material={models.train.back.material}
        scale={[MODEL_SCALE, MODEL_SCALE, MODEL_SCALE]}
        position={[4 * partWidth, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
      />
    </group>
  );
}

function LogMesh({ data }: { data: RenderLog }) {
  const models = useGameModels();
  if (!models) return null;
  const m = models.logs[data.modelIdx % models.logs.length];
  // Scale X to match the log's logical width (OBJ log is ~1 unit wide)
  return (
    <mesh geometry={m.geometry} material={m.material}
      scale={[data.logWidth, MODEL_SCALE, MODEL_SCALE]}
      position={[data.x, 0.05, data.z]}
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
    grounds: [], warnings: [], trees: [], vehicles: [],
    trains: [], logs: [], coins: [],
    player: { x: LANES * CELL / 2, y: 0, z: -3, visible: true, opacity: 1, rotationY: Math.PI },
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
      hopAnim: 0, playerOffsetX: 0, playerRotation: Math.PI,
    };

    return () => { audio.dispose(); };
  }, []);

  // Input
  const handleMove = useCallback((dir: string) => {
    const g = gameRef.current;
    const audio = audioRef.current;
    if (!g || g.dead || g.moving) return;

    // Check if player is currently on a river row (on a log)
    const currentRow = g.rows[g.playerRow];
    const wasOnRiver = currentRow && currentRow.type === "river";

    g.moving = true;
    g.moveDir = dir;
    g.moveProgress = 0;
    g.fromLane = g.playerLane;
    g.fromRow = g.playerRow;

    if (dir === "up") {
      g.playerRow++;
      g.steps++;
      if (g.playerRow > g.maxRow) {
        g.maxRow = g.playerRow;
        g.score = g.maxRow;
      }
    } else if (dir === "down") {
      g.playerRow = Math.max(0, g.playerRow - 1);
    } else if (dir === "left") {
      g.playerLane = Math.max(0, g.playerLane - 1);
    } else if (dir === "right") {
      g.playerLane = Math.min(LANES - 1, g.playerLane + 1);
    }

    // Only reset playerOffsetX when leaving a river row
    // When staying on river or moving within, preserve the offset
    const newRow = g.rows[g.playerRow];
    const nowOnRiver = newRow && newRow.type === "river";
    if (!nowOnRiver) {
      g.playerOffsetX = 0;
    }
    // If moving from river to river, keep offset; if arriving at river fresh, reset
    if (nowOnRiver && !wasOnRiver) {
      g.playerOffsetX = 0;
    }

    // Set player rotation based on direction
    if (dir === "up") g.playerRotation = Math.PI;
    else if (dir === "down") g.playerRotation = 0;
    else if (dir === "left") g.playerRotation = Math.PI / 2;
    else if (dir === "right") g.playerRotation = -Math.PI / 2;

    g.hopAnim = 1;
    audio?.playHop();
    onScoreUpdateRef.current(g.score, g.steps, g.coins);
  }, []);

  useEffect(() => {
    let touchStartX = 0, touchStartY = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      const map: Record<string, string> = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
        w: "up", s: "down", a: "left", d: "right",
      };
      const dir = map[e.key];
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

  // Game loop - only updates state, rendering is declarative
  const frameCountRef = useRef(0);
  // Cache road texture choice per row to avoid flickering
  const roadTexChoiceRef = useRef<Map<number, boolean>>(new Map());
  
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
          row.trainTimer -= dt;
          if (row.trainTimer <= 1.5 && row.trainTimer > 0 && !row.trainWarning) {
            row.trainWarning = true;
            audio?.playTrainAlarm();
          }
          if (row.trainTimer <= 0) {
            if (row.obstacles.length === 0) {
              audio?.playTrainPass();
              row.obstacles.push({ x: -5, speed: 8, width: LANES + 5, modelIndex: 0, isTruck: false });
            }
            for (const obs of row.obstacles) obs.x += obs.speed * dt;
            if (row.obstacles.length > 0 && row.obstacles[0].x > LANES * CELL + 8) {
              row.obstacles = [];
              row.trainWarning = false;
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
          for (const log of currentRow.logs) {
            if (px + pw / 2 > log.x && px - pw / 2 < log.x + log.width) {
              onLog = true;
              if (!g.moving) g.playerOffsetX += log.speed * dt;
              break;
            }
          }
          if (!onLog) { g.dead = true; g.deathTimer = 0; audio?.playWater(); return; }
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

    // Build render snapshot (throttled to ~30fps to reduce React re-renders)
    frameCountRef.current++;
    if (frameCountRef.current % 2 !== 0) return;

    const startRow = Math.max(0, g.playerRow - 8);
    const endRow = Math.min(g.rows.length - 1, g.playerRow + 15);
    const now = Date.now();

    const grounds: RenderGround[] = [];
    const warnings: RenderWarning[] = [];
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

      grounds.push({ key: `g${r}`, x: cx, z, rowType: row.type, grassDark: row.grassDark });

      if (row.type === "rail" && row.trainWarning && row.trainTimer > 0) {
        warnings.push({ key: `w${r}`, x: cx, z });
      }

      if (row.type === "grass") {
        for (const laneIdx of row.treeIndices) {
          trees.push({ key: `t${r}_${laneIdx}`, x: laneIdx * CELL + CELL / 2, z, modelIdx: r });
        }
      }

      for (let oi = 0; oi < row.obstacles.length; oi++) {
        const obs = row.obstacles[oi];
        if (row.type === "road") {
          vehicles.push({
            key: `v${r}_${oi}`,
            x: obs.x + obs.width / 2, z,
            modelIdx: obs.modelIndex, isTruck: obs.isTruck,
            flipY: obs.speed < 0,
          });
        } else if (row.type === "rail") {
          trains.push({ key: `tr${r}_${oi}`, x: obs.x, z });
        }
      }

      for (let li = 0; li < row.logs.length; li++) {
        const log = row.logs[li];
        logRenders.push({ key: `l${r}_${li}`, x: log.x + log.width / 2, z, modelIdx: log.modelIndex, logWidth: log.width });
      }

      if (row.coin && !row.coin.collected) {
        coins.push({ key: `c${r}`, x: row.coin.lane * CELL + CELL / 2, z, rotY: now * 0.003 });
      }
    }

    // Player position
    let px: number, pz: number;
    if (g.moving) {
      const t = g.moveProgress;
      px = g.fromLane * CELL + CELL / 2 + (g.playerLane * CELL + CELL / 2 + g.playerOffsetX - (g.fromLane * CELL + CELL / 2)) * t;
      pz = -g.fromRow * CELL + (-g.playerRow * CELL - (-g.fromRow * CELL)) * t;
    } else {
      px = g.playerLane * CELL + CELL / 2 + g.playerOffsetX;
      pz = -g.playerRow * CELL;
    }
    const hopOffset = Math.sin(g.hopAnim * Math.PI) * 0.3;

    setSnapshot({
      grounds, warnings, trees, vehicles, trains, logs: logRenders, coins,
      player: {
        x: px, y: hopOffset, z: pz,
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
      {/* Ground tiles */}
      {snapshot.grounds.map(d => <GroundTile key={d.key} data={d} />)}
      
      {/* Warning flashes */}
      {snapshot.warnings.map(d => <WarningTile key={d.key} data={d} />)}
      
      {/* Trees */}
      {snapshot.trees.map(d => <TreeMesh key={d.key} data={d} />)}
      
      {/* Vehicles */}
      {snapshot.vehicles.map(d => <VehicleMesh key={d.key} data={d} />)}
      
      {/* Trains */}
      {snapshot.trains.map(d => <TrainMeshGroup key={d.key} data={d} />)}
      
      {/* Logs */}
      {snapshot.logs.map(d => <LogMesh key={d.key} data={d} />)}
      
      {/* Coins */}
      {snapshot.coins.map(d => <CoinMesh key={d.key} data={d} />)}
      
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
