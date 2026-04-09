import { useEffect, useRef, useCallback } from "react";
import CrossyRoadAudio from "./CrossyRoadAudio";

interface Props {
  onGameOver: (score: number, steps: number, coins: number) => void;
  onScoreUpdate: (score: number, steps: number, coins: number) => void;
  scoreSettings?: { points_per_step: number; bonus_coin_points: number };
}

// ── Types ──
type RowType = "grass" | "road" | "rail" | "river";

interface Obstacle {
  x: number; speed: number; width: number; color: string;
}

interface LogObj {
  x: number; speed: number; width: number;
}

interface Coin {
  lane: number; collected: boolean;
}

interface Row {
  type: RowType;
  obstacles: Obstacle[];
  logs: LogObj[];
  coin: Coin | null;
  trainWarning: boolean;
  trainTimer: number;
  grassColor: string;
}

// ── Constants ──
const CELL = 48;
const LANES = 9;
const CANVAS_W = LANES * CELL;
const PLAYER_SIZE = 32;
const COLORS = {
  grass: ["#4a7c2e", "#5a8c3e", "#3d6b24"],
  road: "#555",
  roadLine: "#777",
  rail: "#8B7355",
  railTrack: "#444",
  river: "#3498db",
  player: "#FFD700",
  playerEye: "#333",
  playerBeak: "#FF6B35",
  coin: "#FFD700",
  coinShine: "#FFF8DC",
  tree: "#2d5a1e",
  treeTrunk: "#5a3a1a",
  log: "#8B6914",
  logDark: "#6B4F12",
};

export default function CrossyRoadCanvas({ onGameOver, onScoreUpdate, scoreSettings }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<any>(null);
  const audioRef = useRef<CrossyRoadAudio | null>(null);

  const initGame = useCallback(() => {
    const rows: Row[] = [];
    // start with 6 grass rows, then generate
    for (let i = 0; i < 30; i++) {
      rows.push(generateRow(i));
    }
    return {
      playerLane: Math.floor(LANES / 2),
      playerRow: 3, // visual row on screen
      score: 0,
      maxRow: 0,
      steps: 0,
      coins: 0,
      rows,
      dead: false,
      deathTimer: 0,
      moving: false,
      moveDir: null as string | null,
      moveProgress: 0,
      fromLane: Math.floor(LANES / 2),
      fromRow: 3,
      cameraY: 0,
      targetCameraY: 0,
      hopAnim: 0,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const audio = new CrossyRoadAudio();
    audioRef.current = audio;
    audio.init();

    const dpr = window.devicePixelRatio || 1;
    const canvasH = window.innerHeight;
    canvas.width = CANVAS_W * dpr;
    canvas.height = canvasH * dpr;
    canvas.style.width = `${CANVAS_W}px`;
    canvas.style.height = `${canvasH}px`;
    ctx.scale(dpr, dpr);

    const g = initGame();
    gameRef.current = g;

    let raf: number;
    let lastTime = 0;

    // ── Input ──
    let touchStartX = 0, touchStartY = 0;
    const handleMove = (dir: string) => {
      if (g.dead || g.moving) return;
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
      g.hopAnim = 1;
      audio.playHop();
      onScoreUpdate(g.score, g.steps, g.coins);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const map: Record<string, string> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "right", ArrowRight: "left", w: "up", s: "down", a: "right", d: "left" };
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
        // RTL: swipe right = move left in grid
        handleMove(dx > 0 ? "left" : "right");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvas.addEventListener("touchend", handleTouchEnd);

    // ── Game Loop ──
    const tick = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

      if (!g.dead) {
        update(g, dt, audio);
      } else {
        g.deathTimer += dt;
        if (g.deathTimer > 1.5) {
          onGameOver(g.score, g.steps, g.coins);
          return;
        }
      }
      render(ctx, g, canvasH);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", handleKeyDown);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchend", handleTouchEnd);
      audio.dispose();
    };
  }, [initGame, onGameOver, onScoreUpdate]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <canvas ref={canvasRef} className="block max-w-full" style={{ imageRendering: "pixelated" }} />
    </div>
  );
}

// ── Row Generation ──
function generateRow(index: number): Row {
  if (index < 4) {
    return { type: "grass", obstacles: [], logs: [], coin: null, trainWarning: false, trainTimer: 0, grassColor: COLORS.grass[index % 3] };
  }
  const difficulty = Math.min(index / 50, 1);
  const rand = Math.random();
  let type: RowType;
  if (rand < 0.35) type = "grass";
  else if (rand < 0.7) type = "road";
  else if (rand < 0.85) type = "rail";
  else type = "river";

  const row: Row = { type, obstacles: [], logs: [], coin: null, trainWarning: false, trainTimer: 0, grassColor: COLORS.grass[Math.floor(Math.random() * 3)] };

  if (type === "road") {
    const dir = Math.random() > 0.5 ? 1 : -1;
    const count = 1 + Math.floor(Math.random() * 2);
    const speed = (40 + Math.random() * 80 + difficulty * 60) * dir;
    for (let i = 0; i < count; i++) {
      const carColors = ["#e74c3c", "#2ecc71", "#3498db", "#f39c12", "#9b59b6", "#1abc9c"];
      row.obstacles.push({
        x: Math.random() * CANVAS_W,
        speed,
        width: 36 + Math.random() * 20,
        color: carColors[Math.floor(Math.random() * carColors.length)],
      });
    }
  } else if (type === "rail") {
    row.trainTimer = 3 + Math.random() * 5;
  } else if (type === "river") {
    const dir = Math.random() > 0.5 ? 1 : -1;
    const count = 2 + Math.floor(Math.random() * 2);
    const speed = (25 + Math.random() * 40) * dir;
    for (let i = 0; i < count; i++) {
      row.logs.push({
        x: (CANVAS_W / count) * i + Math.random() * 40,
        speed,
        width: 50 + Math.random() * 30,
      });
    }
  }

  // random coin
  if (Math.random() < 0.15 && type !== "river") {
    row.coin = { lane: Math.floor(Math.random() * LANES), collected: false };
  }

  return row;
}

// ── Update ──
function update(g: any, dt: number, audio: CrossyRoadAudio) {
  // move animation
  if (g.moving) {
    g.moveProgress += dt * 8;
    if (g.moveProgress >= 1) {
      g.moving = false;
      g.moveProgress = 0;
    }
  }

  // hop animation
  if (g.hopAnim > 0) {
    g.hopAnim -= dt * 6;
    if (g.hopAnim < 0) g.hopAnim = 0;
  }

  // camera follow
  g.targetCameraY = Math.max(0, (g.playerRow - 5) * CELL);
  g.cameraY += (g.targetCameraY - g.cameraY) * dt * 6;

  // ensure enough rows
  while (g.rows.length <= g.playerRow + 20) {
    g.rows.push(generateRow(g.rows.length));
  }

  // update obstacles
  for (const row of g.rows) {
    if (row.type === "road") {
      for (const obs of row.obstacles) {
        obs.x += obs.speed * dt;
        if (obs.x > CANVAS_W + 60) obs.x = -obs.width;
        if (obs.x < -obs.width - 60) obs.x = CANVAS_W;
      }
    }
    if (row.type === "rail") {
      row.trainTimer -= dt;
      if (row.trainTimer <= 1.5 && row.trainTimer > 0 && !row.trainWarning) {
        row.trainWarning = true;
        audio.playTrainAlarm();
      }
      if (row.trainTimer <= 0) {
        // spawn train
        if (row.obstacles.length === 0) {
          audio.playTrainPass();
          row.obstacles.push({ x: -200, speed: 350, width: CANVAS_W + 200, color: "#666" });
        }
        for (const obs of row.obstacles) {
          obs.x += obs.speed * dt;
        }
        if (row.obstacles.length > 0 && row.obstacles[0].x > CANVAS_W + 300) {
          row.obstacles = [];
          row.trainWarning = false;
          row.trainTimer = 4 + Math.random() * 6;
        }
      }
    }
    if (row.type === "river") {
      for (const log of row.logs) {
        log.x += log.speed * dt;
        if (log.x > CANVAS_W + 60) log.x = -log.width;
        if (log.x < -log.width - 60) log.x = CANVAS_W;
      }
    }
  }

  // collision check
  const currentRow = g.rows[g.playerRow];
  if (!currentRow) return;

  const px = g.playerLane * CELL + CELL / 2;
  const pw = PLAYER_SIZE * 0.6;

  if (currentRow.type === "road" || currentRow.type === "rail") {
    for (const obs of currentRow.obstacles) {
      if (px + pw / 2 > obs.x && px - pw / 2 < obs.x + obs.width) {
        g.dead = true;
        g.deathTimer = 0;
        if (currentRow.type === "road") audio.playCarHit();
        else audio.playDeath();
        return;
      }
    }
  }

  if (currentRow.type === "river") {
    let onLog = false;
    for (const log of currentRow.logs) {
      if (px + pw / 2 > log.x && px - pw / 2 < log.x + log.width) {
        onLog = true;
        // move player with log
        // (visual only, lane stays)
        break;
      }
    }
    if (!onLog) {
      g.dead = true;
      g.deathTimer = 0;
      audio.playWater();
      return;
    }
  }

  // coin collection
  if (currentRow.coin && !currentRow.coin.collected && currentRow.coin.lane === g.playerLane) {
    currentRow.coin.collected = true;
    g.coins++;
    audio.playCoin();
  }
}

// ── Render ──
function render(ctx: CanvasRenderingContext2D, g: any, canvasH: number) {
  ctx.clearRect(0, 0, CANVAS_W, canvasH);

  // background
  ctx.fillStyle = "#2d5a1e";
  ctx.fillRect(0, 0, CANVAS_W, canvasH);

  const startRow = Math.max(0, Math.floor(g.cameraY / CELL) - 2);
  const endRow = Math.min(g.rows.length - 1, startRow + Math.ceil(canvasH / CELL) + 4);

  // draw rows bottom to top
  for (let r = startRow; r <= endRow; r++) {
    const row = g.rows[r];
    if (!row) continue;
    const y = canvasH - (r * CELL - g.cameraY) - CELL;

    // row background
    if (row.type === "grass") {
      ctx.fillStyle = row.grassColor;
      ctx.fillRect(0, y, CANVAS_W, CELL);
      // random trees
      if (r > 3 && r % 3 === 0) {
        drawTree(ctx, 10, y + 5);
        drawTree(ctx, CANVAS_W - 30, y + 8);
      }
    } else if (row.type === "road") {
      ctx.fillStyle = COLORS.road;
      ctx.fillRect(0, y, CANVAS_W, CELL);
      // lane lines
      ctx.strokeStyle = COLORS.roadLine;
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(0, y + CELL / 2);
      ctx.lineTo(CANVAS_W, y + CELL / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (row.type === "rail") {
      ctx.fillStyle = COLORS.rail;
      ctx.fillRect(0, y, CANVAS_W, CELL);
      // tracks
      ctx.fillStyle = COLORS.railTrack;
      ctx.fillRect(0, y + 10, CANVAS_W, 4);
      ctx.fillRect(0, y + CELL - 14, CANVAS_W, 4);
      // ties
      for (let tx = 0; tx < CANVAS_W; tx += 20) {
        ctx.fillRect(tx, y + 8, 6, CELL - 16);
      }
      // warning flash
      if (row.trainWarning && row.trainTimer > 0) {
        ctx.fillStyle = `rgba(255, 0, 0, ${0.3 + Math.sin(Date.now() / 100) * 0.2})`;
        ctx.fillRect(0, y, CANVAS_W, CELL);
      }
    } else if (row.type === "river") {
      ctx.fillStyle = COLORS.river;
      ctx.fillRect(0, y, CANVAS_W, CELL);
      // water animation
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      for (let wx = 0; wx < CANVAS_W; wx += 30) {
        const wy = y + 10 + Math.sin((wx + Date.now() / 300) * 0.1) * 5;
        ctx.fillRect(wx, wy, 15, 2);
      }
    }

    // draw obstacles
    for (const obs of row.obstacles) {
      if (row.type === "road") {
        drawCar(ctx, obs.x, y + 6, obs.width, CELL - 12, obs.color);
      } else if (row.type === "rail") {
        ctx.fillStyle = "#444";
        ctx.fillRect(obs.x, y + 2, obs.width, CELL - 4);
        // train windows
        ctx.fillStyle = "#FFE";
        for (let wx = obs.x + 10; wx < obs.x + obs.width - 10; wx += 25) {
          ctx.fillRect(wx, y + 10, 12, 12);
        }
      }
    }

    // draw logs
    for (const log of row.logs) {
      ctx.fillStyle = COLORS.log;
      ctx.beginPath();
      ctx.roundRect(log.x, y + 8, log.width, CELL - 16, 6);
      ctx.fill();
      ctx.fillStyle = COLORS.logDark;
      ctx.fillRect(log.x + 5, y + 14, log.width - 10, 3);
      ctx.fillRect(log.x + 5, y + CELL - 22, log.width - 10, 3);
    }

    // draw coin
    if (row.coin && !row.coin.collected) {
      const cx = row.coin.lane * CELL + CELL / 2;
      const cy = y + CELL / 2;
      ctx.fillStyle = COLORS.coin;
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.coinShine;
      ctx.beginPath();
      ctx.arc(cx - 2, cy - 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // draw player
  if (!g.dead || g.deathTimer < 1) {
    let px: number, py: number;
    if (g.moving) {
      const t = g.moveProgress;
      const fromX = g.fromLane * CELL + CELL / 2;
      const fromY = canvasH - (g.fromRow * CELL - g.cameraY) - CELL + CELL / 2;
      const toX = g.playerLane * CELL + CELL / 2;
      const toY = canvasH - (g.playerRow * CELL - g.cameraY) - CELL + CELL / 2;
      px = fromX + (toX - fromX) * t;
      py = fromY + (toY - fromY) * t;
    } else {
      px = g.playerLane * CELL + CELL / 2;
      py = canvasH - (g.playerRow * CELL - g.cameraY) - CELL + CELL / 2;
    }

    const hopOffset = Math.sin(g.hopAnim * Math.PI) * 8;

    if (g.dead) {
      // death animation
      ctx.globalAlpha = 1 - g.deathTimer;
      ctx.fillStyle = "#f00";
      ctx.beginPath();
      ctx.arc(px, py - hopOffset, PLAYER_SIZE / 2 + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    drawChicken(ctx, px, py - hopOffset, PLAYER_SIZE);
  }
}

function drawChicken(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const s = size / 2;
  // body
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.ellipse(x, y + 2, s * 0.7, s * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  // head
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x, y - s * 0.5, s * 0.45, 0, Math.PI * 2);
  ctx.fill();
  // eyes
  ctx.fillStyle = COLORS.playerEye;
  ctx.beginPath();
  ctx.arc(x - 4, y - s * 0.55, 2, 0, Math.PI * 2);
  ctx.arc(x + 4, y - s * 0.55, 2, 0, Math.PI * 2);
  ctx.fill();
  // beak
  ctx.fillStyle = COLORS.playerBeak;
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.35);
  ctx.lineTo(x - 4, y - s * 0.2);
  ctx.lineTo(x + 4, y - s * 0.2);
  ctx.closePath();
  ctx.fill();
  // comb
  ctx.fillStyle = "#e74c3c";
  ctx.beginPath();
  ctx.arc(x - 3, y - s * 0.85, 3, 0, Math.PI * 2);
  ctx.arc(x + 3, y - s * 0.85, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  // windows
  ctx.fillStyle = "rgba(200,230,255,0.7)";
  ctx.fillRect(x + 6, y + 3, w * 0.25, h - 6);
  ctx.fillRect(x + w - 6 - w * 0.2, y + 3, w * 0.2, h - 6);
  // wheels
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(x + 8, y + h, 4, 0, Math.PI * 2);
  ctx.arc(x + w - 8, y + h, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = COLORS.treeTrunk;
  ctx.fillRect(x + 6, y + 20, 6, 16);
  ctx.fillStyle = COLORS.tree;
  ctx.beginPath();
  ctx.moveTo(x, y + 22);
  ctx.lineTo(x + 9, y);
  ctx.lineTo(x + 18, y + 22);
  ctx.closePath();
  ctx.fill();
}
