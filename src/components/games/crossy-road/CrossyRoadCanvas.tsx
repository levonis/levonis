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
  x: number; speed: number; width: number; colorKey: string;
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
  grassIndex: number;
}

// ── Constants ──
const CELL = 48;
const LANES = 9;
const CANVAS_W = LANES * CELL;
const PLAYER_SIZE = 32;

const CAR_COLORS = ["red", "blue", "green", "yellow"];

// ── Sprite loader ──
const SPRITE_NAMES = [
  "chicken", "car-red", "car-blue", "car-green", "car-yellow",
  "tree", "log", "coin", "train",
  "grass-0", "grass-1", "grass-2", "road", "rail", "water",
];

function loadSprites(): Promise<Record<string, HTMLImageElement>> {
  return new Promise((resolve) => {
    const sprites: Record<string, HTMLImageElement> = {};
    let loaded = 0;
    for (const name of SPRITE_NAMES) {
      const img = new Image();
      img.src = `/games/crossy-road/sprites/${name}.png`;
      img.onload = img.onerror = () => {
        sprites[name] = img;
        loaded++;
        if (loaded >= SPRITE_NAMES.length) resolve(sprites);
      };
    }
  });
}

export default function CrossyRoadCanvas({ onGameOver, onScoreUpdate, scoreSettings }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<any>(null);
  const audioRef = useRef<CrossyRoadAudio | null>(null);

  const initGame = useCallback(() => {
    const rows: Row[] = [];
    for (let i = 0; i < 30; i++) {
      rows.push(generateRow(i));
    }
    return {
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
      moveDir: null as string | null,
      moveProgress: 0,
      fromLane: Math.floor(LANES / 2),
      fromRow: 3,
      cameraY: 0,
      targetCameraY: 0,
      hopAnim: 0,
      playerOffsetX: 0,
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
    let spritesLoaded: Record<string, HTMLImageElement> = {};

    // ── Input ──
    let touchStartX = 0, touchStartY = 0;
    const handleMove = (dir: string) => {
      if (g.dead || g.moving) return;
      g.moving = true;
      g.moveDir = dir;
      g.moveProgress = 0;
      g.fromLane = g.playerLane;
      g.fromRow = g.playerRow;

      // Reset log offset when player jumps
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
      render(ctx, g, canvasH, spritesLoaded);
      raf = requestAnimationFrame(tick);
    };

    // Load sprites then start
    loadSprites().then((sprites) => {
      spritesLoaded = sprites;
      raf = requestAnimationFrame(tick);
    });

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
    return { type: "grass", obstacles: [], logs: [], coin: null, trainWarning: false, trainTimer: 0, grassIndex: index % 3 };
  }
  const difficulty = Math.min(index / 50, 1);
  const rand = Math.random();
  let type: RowType;
  if (rand < 0.35) type = "grass";
  else if (rand < 0.7) type = "road";
  else if (rand < 0.85) type = "rail";
  else type = "river";

  const row: Row = { type, obstacles: [], logs: [], coin: null, trainWarning: false, trainTimer: 0, grassIndex: Math.floor(Math.random() * 3) };

  if (type === "road") {
    const dir = Math.random() > 0.5 ? 1 : -1;
    const count = 1 + Math.floor(Math.random() * 2);
    const speed = (40 + Math.random() * 80 + difficulty * 60) * dir;
    for (let i = 0; i < count; i++) {
      row.obstacles.push({
        x: Math.random() * CANVAS_W,
        speed,
        width: 48,
        colorKey: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
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
        width: 64,
      });
    }
  }

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
        if (row.obstacles.length === 0) {
          audio.playTrainPass();
          row.obstacles.push({ x: -200, speed: 350, width: CANVAS_W + 200, colorKey: "train" });
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

  const px = g.playerLane * CELL + CELL / 2 + g.playerOffsetX;
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
        // Drag player with the log
        if (!g.moving) {
          g.playerOffsetX += log.speed * dt;
        }
        break;
      }
    }
    if (!onLog) {
      g.dead = true;
      g.deathTimer = 0;
      audio.playWater();
      return;
    }
    // Die if dragged off screen
    if (px < -CELL || px > CANVAS_W + CELL) {
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
function render(ctx: CanvasRenderingContext2D, g: any, canvasH: number, sprites: Record<string, HTMLImageElement>) {
  ctx.clearRect(0, 0, CANVAS_W, canvasH);

  // background
  ctx.fillStyle = "#2d5a1e";
  ctx.fillRect(0, 0, CANVAS_W, canvasH);

  const startRow = Math.max(0, Math.floor(g.cameraY / CELL) - 2);
  const endRow = Math.min(g.rows.length - 1, startRow + Math.ceil(canvasH / CELL) + 4);

  for (let r = startRow; r <= endRow; r++) {
    const row = g.rows[r];
    if (!row) continue;
    const y = canvasH - (r * CELL - g.cameraY) - CELL;

    // row background using sprites
    const bgSprite = row.type === "grass" ? sprites[`grass-${row.grassIndex}`]
      : row.type === "road" ? sprites["road"]
      : row.type === "rail" ? sprites["rail"]
      : sprites["water"];

    if (bgSprite) {
      for (let tx = 0; tx < CANVAS_W; tx += CELL) {
        ctx.drawImage(bgSprite, tx, y, CELL, CELL);
      }
    }

    // warning flash for rail
    if (row.type === "rail" && row.trainWarning && row.trainTimer > 0) {
      ctx.fillStyle = `rgba(255, 0, 0, ${0.3 + Math.sin(Date.now() / 100) * 0.2})`;
      ctx.fillRect(0, y, CANVAS_W, CELL);
    }

    // water shimmer
    if (row.type === "river") {
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      for (let wx = 0; wx < CANVAS_W; wx += 30) {
        const wy = y + 10 + Math.sin((wx + Date.now() / 300) * 0.1) * 5;
        ctx.fillRect(wx, wy, 15, 2);
      }
    }

    // trees on grass
    if (row.type === "grass" && r > 3 && r % 3 === 0 && sprites["tree"]) {
      ctx.drawImage(sprites["tree"], 4, y + 4, 24, 40);
      ctx.drawImage(sprites["tree"], CANVAS_W - 28, y + 4, 24, 40);
    }

    // obstacles
    for (const obs of row.obstacles) {
      if (row.type === "road") {
        const carSprite = sprites[`car-${obs.colorKey}`];
        if (carSprite) {
          ctx.drawImage(carSprite, obs.x, y + 8, 48, 32);
        }
      } else if (row.type === "rail") {
        const trainSprite = sprites["train"];
        if (trainSprite) {
          for (let tx = obs.x; tx < obs.x + obs.width; tx += 48) {
            ctx.drawImage(trainSprite, tx, y + 2, 48, 44);
          }
        }
      }
    }

    // logs
    for (const log of row.logs) {
      const logSprite = sprites["log"];
      if (logSprite) {
        ctx.drawImage(logSprite, log.x, y + 12, log.width, 24);
      }
    }

    // coin
    if (row.coin && !row.coin.collected && sprites["coin"]) {
      const cx = row.coin.lane * CELL + CELL / 2 - 8;
      const cy = y + CELL / 2 - 8;
      ctx.drawImage(sprites["coin"], cx, cy, 16, 16);
    }
  }

  // draw player
  if (!g.dead || g.deathTimer < 1) {
    let px: number, py: number;
    if (g.moving) {
      const t = g.moveProgress;
      const fromX = g.fromLane * CELL + CELL / 2;
      const fromY = canvasH - (g.fromRow * CELL - g.cameraY) - CELL + CELL / 2;
      const toX = g.playerLane * CELL + CELL / 2 + g.playerOffsetX;
      const toY = canvasH - (g.playerRow * CELL - g.cameraY) - CELL + CELL / 2;
      px = fromX + (toX - fromX) * t;
      py = fromY + (toY - fromY) * t;
    } else {
      px = g.playerLane * CELL + CELL / 2 + g.playerOffsetX;
      py = canvasH - (g.playerRow * CELL - g.cameraY) - CELL + CELL / 2;
    }

    const hopOffset = Math.sin(g.hopAnim * Math.PI) * 8;

    if (g.dead) {
      ctx.globalAlpha = 1 - g.deathTimer;
    }

    const chickenSprite = sprites["chicken"];
    if (chickenSprite) {
      ctx.drawImage(chickenSprite, px - PLAYER_SIZE / 2, py - hopOffset - PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
    }

    if (g.dead) {
      ctx.globalAlpha = 1;
    }
  }
}
