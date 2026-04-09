import { useRef, useEffect, useCallback, useMemo } from "react";
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
}

// ── Constants ──
const LANES = 9;
const CELL = 1; // 1 unit per cell in 3D
const MODEL_SCALE = 0.009; // OBJ models are large, scale them down

interface Props {
  onGameOver: (score: number, steps: number, coins: number) => void;
  onScoreUpdate: (score: number, steps: number, coins: number) => void;
}

function generateRow(index: number): Row {
  if (index < 4) {
    return {
      type: "grass",
      obstacles: [],
      logs: [],
      coin: null,
      trainWarning: false,
      trainTimer: 0,
      treeIndices: [],
      grassDark: index % 2 === 0,
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
    type,
    obstacles: [],
    logs: [],
    coin: null,
    trainWarning: false,
    trainTimer: 0,
    treeIndices: [],
    grassDark: Math.random() > 0.5,
  };

  if (type === "grass" && index > 3) {
    // Random trees on edges
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
        speed,
        width: isTruck ? 2 : 1,
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
        speed,
        width: 2,
        modelIndex: Math.floor(Math.random() * 4),
      });
    }
  }

  if (Math.random() < 0.15 && type !== "river") {
    row.coin = { lane: Math.floor(Math.random() * LANES), collected: false };
  }

  return row;
}

export default function CrossyRoad3DScene({ onGameOver, onScoreUpdate }: Props) {
  const models = useGameModels();
  const { camera } = useThree();
  const audioRef = useRef<CrossyRoadAudio | null>(null);
  const gameRef = useRef<GameState | null>(null);
  const meshGroupRef = useRef<THREE.Group>(null);
  const playerMeshRef = useRef<THREE.Mesh>(null);
  const coinMeshesRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const onGameOverRef = useRef(onGameOver);
  const onScoreUpdateRef = useRef(onScoreUpdate);
  onGameOverRef.current = onGameOver;
  onScoreUpdateRef.current = onScoreUpdate;

  // Initialize game state
  useEffect(() => {
    const audio = new CrossyRoadAudio();
    audioRef.current = audio;
    audio.init();

    const rows: Row[] = [];
    for (let i = 0; i < 30; i++) rows.push(generateRow(i));

    gameRef.current = {
      playerLane: Math.floor(LANES / 2),
      playerRow: 3,
      score: 0,
      maxRow: 0,
      steps: 0,
      coins: 0,
      rows,
      dead: false,
      deathTimer: 0,
      moving: false,
      moveDir: null,
      moveProgress: 0,
      fromLane: Math.floor(LANES / 2),
      fromRow: 3,
      hopAnim: 0,
      playerOffsetX: 0,
    };

    return () => {
      audio.dispose();
    };
  }, []);

  // Input handling
  const handleMove = useCallback((dir: string) => {
    const g = gameRef.current;
    const audio = audioRef.current;
    if (!g || g.dead || g.moving) return;

    g.moving = true;
    g.moveDir = dir;
    g.moveProgress = 0;
    g.fromLane = g.playerLane;
    g.fromRow = g.playerRow;
    g.playerOffsetX = 0;

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
      if (absDy > absDx) {
        handleMove(dy < 0 ? "up" : "down");
      } else {
        handleMove(dx > 0 ? "right" : "left");
      }
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

  // Coin geometry
  const coinGeometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16);
    geo.rotateX(Math.PI / 2);
    return geo;
  }, []);
  const coinMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: 0xffd700, emissive: 0xaa8800 }), []);

  // Ground plane materials
  const grassDarkMat = useMemo(() => new THREE.MeshLambertMaterial({ color: 0x4a7a2e }), []);
  const grassLightMat = useMemo(() => new THREE.MeshLambertMaterial({ color: 0x5a9a3e }), []);
  const roadMat = useMemo(() => new THREE.MeshLambertMaterial({ color: 0x555555 }), []);
  const railMat = useMemo(() => new THREE.MeshLambertMaterial({ color: 0x8B7355 }), []);
  const riverMat = useMemo(() => new THREE.MeshLambertMaterial({ color: 0x4488cc, transparent: true, opacity: 0.8 }), []);
  const warningMat = useMemo(() => new THREE.MeshLambertMaterial({ color: 0xff0000, transparent: true, opacity: 0.3 }), []);

  const groundGeo = useMemo(() => new THREE.BoxGeometry(LANES * CELL, 0.1, CELL), []);

  // Game loop
  useFrame((_, delta) => {
    const g = gameRef.current;
    const audio = audioRef.current;
    if (!g || !models) return;

    const dt = Math.min(delta, 0.05);

    if (!g.dead) {
      // Move animation
      if (g.moving) {
        g.moveProgress += dt * 8;
        if (g.moveProgress >= 1) {
          g.moving = false;
          g.moveProgress = 0;
        }
      }

      // Hop animation
      if (g.hopAnim > 0) {
        g.hopAnim -= dt * 6;
        if (g.hopAnim < 0) g.hopAnim = 0;
      }

      // Ensure enough rows
      while (g.rows.length <= g.playerRow + 20) {
        g.rows.push(generateRow(g.rows.length));
      }

      // Update obstacles
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
            for (const obs of row.obstacles) {
              obs.x += obs.speed * dt;
            }
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
              if (!g.moving) {
                g.playerOffsetX += log.speed * dt;
              }
              break;
            }
          }
          if (!onLog) {
            g.dead = true;
            g.deathTimer = 0;
            audio?.playWater();
            return;
          }
          if (px < -CELL || px > LANES * CELL + CELL) {
            g.dead = true;
            g.deathTimer = 0;
            audio?.playWater();
            return;
          }
        }

        // Coin
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
    (camera as THREE.OrthographicCamera).position.z += (targetZ + 8) * 0.05;
    (camera as THREE.OrthographicCamera).position.x = (LANES * CELL) / 2;

    // ── Render: update meshes ──
    const group = meshGroupRef.current;
    if (!group) return;

    // Clear previous meshes
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
    coinMeshesRef.current.clear();

    const startRow = Math.max(0, g.playerRow - 8);
    const endRow = Math.min(g.rows.length - 1, g.playerRow + 15);

    for (let r = startRow; r <= endRow; r++) {
      const row = g.rows[r];
      if (!row) continue;
      const z = -r * CELL;

      // Ground
      const groundMat = row.type === "grass" ? (row.grassDark ? grassDarkMat : grassLightMat)
        : row.type === "road" ? roadMat
        : row.type === "rail" ? railMat
        : riverMat;
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.position.set((LANES * CELL) / 2, -0.05, z);
      group.add(ground);

      // Warning flash
      if (row.type === "rail" && row.trainWarning && row.trainTimer > 0) {
        const warn = new THREE.Mesh(groundGeo, warningMat);
        warn.position.set((LANES * CELL) / 2, 0, z);
        group.add(warn);
      }

      // Trees
      if (row.type === "grass" && row.treeIndices.length > 0) {
        for (const laneIdx of row.treeIndices) {
          const treeModel = models.trees[r % models.trees.length];
          const treeMesh = new THREE.Mesh(treeModel.geometry, treeModel.material);
          treeMesh.scale.setScalar(MODEL_SCALE);
          treeMesh.position.set(laneIdx * CELL + CELL / 2, 0, z);
          group.add(treeMesh);
        }
      }

      // Obstacles (cars/trucks/trains)
      for (const obs of row.obstacles) {
        if (row.type === "road") {
          const modelAsset = obs.isTruck
            ? models.trucks[obs.modelIndex % models.trucks.length]
            : models.cars[obs.modelIndex % models.cars.length];
          const mesh = new THREE.Mesh(modelAsset.geometry, modelAsset.material);
          mesh.scale.setScalar(MODEL_SCALE);
          mesh.position.set(obs.x + obs.width / 2, 0, z);
          if (obs.speed < 0) mesh.rotation.y = Math.PI;
          group.add(mesh);
        } else if (row.type === "rail") {
          // Train
          const frontMesh = new THREE.Mesh(models.train.front.geometry, models.train.front.material);
          frontMesh.scale.setScalar(MODEL_SCALE);
          frontMesh.position.set(obs.x + 1, 0, z);
          group.add(frontMesh);

          for (let ti = 1; ti < 4; ti++) {
            const midMesh = new THREE.Mesh(models.train.middle.geometry, models.train.middle.material);
            midMesh.scale.setScalar(MODEL_SCALE);
            midMesh.position.set(obs.x + 1 + ti * 1.5, 0, z);
            group.add(midMesh);
          }

          const backMesh = new THREE.Mesh(models.train.back.geometry, models.train.back.material);
          backMesh.scale.setScalar(MODEL_SCALE);
          backMesh.position.set(obs.x + 7, 0, z);
          group.add(backMesh);
        }
      }

      // Logs
      for (const log of row.logs) {
        const logModel = models.logs[log.modelIndex % models.logs.length];
        const logMesh = new THREE.Mesh(logModel.geometry, logModel.material);
        logMesh.scale.setScalar(MODEL_SCALE);
        logMesh.position.set(log.x + log.width / 2, 0.05, z);
        group.add(logMesh);
      }

      // Coin
      if (row.coin && !row.coin.collected) {
        const coinMesh = new THREE.Mesh(coinGeometry, coinMaterial);
        coinMesh.position.set(row.coin.lane * CELL + CELL / 2, 0.5, z);
        coinMesh.rotation.y = Date.now() * 0.003;
        group.add(coinMesh);
      }
    }

    // Player
    if (playerMeshRef.current && (!g.dead || g.deathTimer < 1)) {
      let px: number, pz: number;
      if (g.moving) {
        const t = g.moveProgress;
        const fromX = g.fromLane * CELL + CELL / 2;
        const fromZ = -g.fromRow * CELL;
        const toX = g.playerLane * CELL + CELL / 2 + g.playerOffsetX;
        const toZ = -g.playerRow * CELL;
        px = fromX + (toX - fromX) * t;
        pz = fromZ + (toZ - fromZ) * t;
      } else {
        px = g.playerLane * CELL + CELL / 2 + g.playerOffsetX;
        pz = -g.playerRow * CELL;
      }

      const hopOffset = Math.sin(g.hopAnim * Math.PI) * 0.3;
      playerMeshRef.current.position.set(px, hopOffset, pz);
      playerMeshRef.current.visible = true;

      if (g.dead) {
        const mat = playerMeshRef.current.material as THREE.Material;
        mat.opacity = 1 - g.deathTimer;
        mat.transparent = true;
      }
    }
  });

  if (!models) return null;

  const playerMat = models.chicken.material.clone();

  return (
    <>
      <group ref={meshGroupRef} />
      <mesh
        ref={playerMeshRef}
        geometry={models.chicken.geometry}
        material={playerMat}
        scale={[MODEL_SCALE, MODEL_SCALE, MODEL_SCALE]}
        position={[LANES * CELL / 2, 0, -3 * CELL]}
      />
    </>
  );
}
