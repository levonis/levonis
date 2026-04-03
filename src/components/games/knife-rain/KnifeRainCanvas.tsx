import { useRef, useEffect, useCallback } from "react";
import {
  playThrow, playStick, playHitKnife, playStageClear,
  playBossDefeat, playCoinCollect, playShieldWarn, playShieldBlock,
} from "./KnifeRainAudio";

import knifeImg from "@/assets/knife-rain/knife_new.png";
import woodNew1 from "@/assets/knife-rain/wood_new_1.png";
import woodNew2 from "@/assets/knife-rain/wood_new_2.png";
import woodNew3 from "@/assets/knife-rain/wood_new_3.png";
import back1 from "@/assets/knife-rain/Back_1.png";
import back2 from "@/assets/knife-rain/Back_2.png";

import bossApple from "@/assets/knife-rain/boss_apple.png";
import bossRock1 from "@/assets/knife-rain/boss_rock_1.png";
import bossRock2 from "@/assets/knife-rain/boss_rock_2.png";
import bossRock3 from "@/assets/knife-rain/boss_rock_3.png";
import bossRock4 from "@/assets/knife-rain/boss_rock_4.png";
import mineralCrystal from "@/assets/knife-rain/mineral_crystal.png";

interface Props {
  onGameOver: (score: number, stage: number, knivesThrown: number) => void;
  onScoreUpdate?: (score: number, stage: number, knivesThrown: number) => void;
  scoreSettings?: {
    game_points_per_knife: number;
    game_combo_multiplier: number;
  };
}

/* ─── Types ─── */
type SpeedVariation = "none" | "accel" | "decel" | "wave";
type BossType = "apple" | "rock" | "cake" | null;

interface StageConfig {
  targetImg: string;
  bgImg: string;
  rotationSpeed: number;
  knivesNeeded: number;
  isBoss: boolean;
  bossType: BossType;
  label: string;
  preplacedKnives: number;
  reverseRotation: boolean;
  speedVariation: SpeedVariation;
  hasShield: boolean;
  coinCount: number;
  obstacleCount: number;
}

interface StuckKnife { angle: number }
interface FlyingKnife { x: number; y: number; vy: number }
interface Coin { angle: number; collected: boolean }
interface CoinAnim { x: number; y: number; timer: number }
interface Obstacle { angle: number; type: "branch" | "mineral" | "knife" }

type ShieldPhase = "none" | "warn1" | "warn2" | "active";

/* ─── Boss rotation ─── */
const BOSS_ROTATION: BossType[] = ["apple", "rock", "cake", "rock", "apple", "rock"];
const ROCK_IMGS = [bossRock1, bossRock2, bossRock3, bossRock4];

function getBossTargetImg(bossType: BossType, roundIdx: number): string {
  if (bossType === "apple") return bossApple;
  if (bossType === "rock") return ROCK_IMGS[roundIdx % ROCK_IMGS.length];
  return ""; // cake = canvas-drawn
}

/* ─── Stages ─── */
function buildStages(): StageConfig[] {
  const stages: StageConfig[] = [];
  const woodImgs = [woodNew1, woodNew2, woodNew3];
  const bgs = [back1, back2];

  for (let round = 0; round < 10; round++) {
    const baseSpeed = 1.5 + round * 0.4;
    const baseKnives = 4 + round;

    for (let i = 0; i < 3; i++) {
      const stageIdx = round * 4 + i;
      let preplaced = 0;
      let reverse = false;
      let variation: SpeedVariation = "none";

      if (stageIdx >= 5) preplaced = Math.min(Math.floor((stageIdx - 3) / 3), 4);
      if (stageIdx >= 10) reverse = i % 2 === 1;
      if (stageIdx >= 15) variation = i % 2 === 0 ? "wave" : "accel";

      stages.push({
        targetImg: woodImgs[i],
        bgImg: bgs[round % 2],
        rotationSpeed: baseSpeed + i * 0.15,
        knivesNeeded: baseKnives + Math.floor(i / 2),
        isBoss: false,
        bossType: null,
        label: `المرحلة ${stageIdx + 1}`,
        preplacedKnives: preplaced,
        reverseRotation: reverse,
        speedVariation: variation,
        hasShield: false,
        coinCount: Math.min(1 + Math.floor(stageIdx / 5), 3),
        obstacleCount: 0,
      });
    }

    // Boss
    const bt = BOSS_ROTATION[round % BOSS_ROTATION.length];
    const obstCount = bt === "apple" ? 2 + Math.floor(round / 2)
                    : bt === "rock" ? 2 + Math.floor(round / 2)
                    : bt === "cake" ? 3 + Math.floor(round / 2)
                    : 0;

    stages.push({
      targetImg: getBossTargetImg(bt, round),
      bgImg: bgs[(round + 1) % 2],
      rotationSpeed: baseSpeed + 1.2,
      knivesNeeded: baseKnives + 3,
      isBoss: true,
      bossType: bt,
      label: bt === "apple" ? `بوس التفاحة 🍎` : bt === "rock" ? `بوس الصخرة 🪨` : `بوس الكيكة 🎂`,
      preplacedKnives: bt === "cake" ? 0 : Math.min(round, 4),
      reverseRotation: round >= 2,
      speedVariation: round >= 3 ? "wave" : round >= 1 ? "accel" : "none",
      hasShield: bt === "apple",
      coinCount: 2,
      obstacleCount: obstCount,
    });
  }
  return stages;
}

const ALL_STAGES = buildStages();
const KNIFE_COLLISION_ANGLE = 0.22;
const OBSTACLE_COLLISION_ANGLE = 0.25;
const KNIFE_SPEED = 2200;
const COIN_COLLECT_ANGLE = 0.3;
const MAX_GAME_W = 500;

export default function KnifeRainCanvas({ onGameOver, onScoreUpdate, scoreSettings }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    stage: 0,
    score: 0,
    coins: 0,
    knivesThrown: 0,
    stuckKnives: [] as StuckKnife[],
    flyingKnife: null as FlyingKnife | null,
    targetAngle: 0,
    knivesRemaining: ALL_STAGES[0].knivesNeeded,
    gameOver: false,
    stageClearAnim: 0,
    canThrow: true,
    lastTime: 0,
    stageCoins: [] as Coin[],
    coinAnims: [] as CoinAnim[],
    obstacles: [] as Obstacle[],
    shieldPhase: "none" as ShieldPhase,
    shieldTimer: 0,
    shieldCooldown: 5 + Math.random() * 5,
    shieldWarnPlayed: false,
    bossHitTimer: 0,
    stageTime: 0,
    rotDir: 1,
  });

  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const loadedRef = useRef(false);

  useEffect(() => {
    const srcs = [
      knifeImg, woodNew1, woodNew2, woodNew3, back1, back2,
      bossApple, bossRock1, bossRock2, bossRock3, bossRock4, mineralCrystal,
    ];
    let loaded = 0;
    srcs.forEach(src => {
      const img = new Image();
      img.onload = () => {
        imagesRef.current.set(src, img);
        loaded++;
        if (loaded === srcs.length) loadedRef.current = true;
      };
      img.src = src;
    });
  }, []);

  const getImg = (src: string) => imagesRef.current.get(src);

  const initStageCoins = useCallback((stage: StageConfig) => {
    const coins: Coin[] = [];
    for (let i = 0; i < stage.coinCount; i++) {
      coins.push({ angle: Math.random() * Math.PI * 2, collected: false });
    }
    return coins;
  }, []);

  const initPreplacedKnives = useCallback((count: number) => {
    const knives: StuckKnife[] = [];
    const spacing = (Math.PI * 2) / Math.max(count + 2, 6);
    for (let i = 0; i < count; i++) {
      knives.push({ angle: spacing * i + Math.random() * 0.2 });
    }
    return knives;
  }, []);

  const initObstacles = useCallback((stage: StageConfig) => {
    const obs: Obstacle[] = [];
    if (!stage.isBoss || stage.obstacleCount <= 0) return obs;
    const type: Obstacle["type"] = stage.bossType === "apple" ? "branch"
      : stage.bossType === "rock" ? "mineral"
      : "knife";
    const spacing = (Math.PI * 2) / Math.max(stage.obstacleCount + 2, 5);
    for (let i = 0; i < stage.obstacleCount; i++) {
      obs.push({ angle: spacing * i + Math.random() * 0.3 + 0.5, type });
    }
    return obs;
  }, []);

  const throwKnife = useCallback(() => {
    const s = stateRef.current;
    if (s.gameOver || s.flyingKnife || !s.canThrow || s.stageClearAnim > 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasW = canvas.width;
    const gw = Math.min(canvasW, MAX_GAME_W);
    const gx = (canvasW - gw) / 2;

    playThrow();
    s.flyingKnife = {
      x: gx + gw / 2,
      y: canvas.height - 140,
      vy: -KNIFE_SPEED,
    };
    s.canThrow = false;
    s.knivesThrown++;
  }, []);

  // Initialize first stage
  useEffect(() => {
    const s = stateRef.current;
    const stage = ALL_STAGES[0];
    s.stuckKnives = initPreplacedKnives(stage.preplacedKnives);
    s.stageCoins = initStageCoins(stage);
    s.obstacles = initObstacles(stage);
    s.rotDir = 1;
    s.stageTime = 0;
  }, [initPreplacedKnives, initStageCoins, initObstacles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const handleInput = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      throwKnife();
    };
    canvas.addEventListener("mousedown", handleInput);
    canvas.addEventListener("touchstart", handleInput, { passive: false });

    const ctx = canvas.getContext("2d")!;
    let animId: number;

    const gameLoop = (time: number) => {
      const s = stateRef.current;
      if (!loadedRef.current) { animId = requestAnimationFrame(gameLoop); return; }

      const dt = s.lastTime ? Math.min((time - s.lastTime) / 1000, 0.05) : 0.016;
      s.lastTime = time;
      if (s.gameOver) return;

      const canvasW = canvas.width;
      const H = canvas.height;
      const gw = Math.min(canvasW, MAX_GAME_W);
      const gx = (canvasW - gw) / 2;
      const stage = ALL_STAGES[Math.min(s.stage, ALL_STAGES.length - 1)];
      const cx = gx + gw / 2;
      const cy = H * 0.30;
      const targetR = gw * 0.28;
      const knifeLen = gw * 0.22;
      const knifeW = knifeLen * 0.28;

      s.stageTime += dt;

      // Compute effective rotation speed
      let effSpeed = stage.rotationSpeed;
      switch (stage.speedVariation) {
        case "accel":
          effSpeed *= 1 + Math.min(s.stageTime * 0.05, 1.5);
          break;
        case "decel":
          effSpeed *= Math.max(1 - s.stageTime * 0.03, 0.3);
          break;
        case "wave":
          effSpeed *= 0.5 + Math.abs(Math.sin(s.stageTime * 0.8)) * 1.5;
          break;
      }
      if (stage.reverseRotation && Math.floor(s.stageTime / 3) % 2 === 1) {
        s.rotDir = -1;
      } else if (stage.reverseRotation) {
        s.rotDir = 1;
      }
      s.targetAngle += effSpeed * s.rotDir * dt;

      // Shield logic (apple boss only)
      if (stage.hasShield && s.stageClearAnim <= 0) {
        if (s.shieldPhase === "none") {
          s.shieldCooldown -= dt;
          if (s.shieldCooldown <= 0) {
            s.shieldPhase = "warn1";
            s.shieldTimer = 1;
            s.shieldWarnPlayed = false;
          }
        } else if (s.shieldPhase === "warn1") {
          if (!s.shieldWarnPlayed) { playShieldWarn(); s.shieldWarnPlayed = true; }
          s.shieldTimer -= dt;
          if (s.shieldTimer <= 0) { s.shieldPhase = "warn2"; s.shieldTimer = 1; }
        } else if (s.shieldPhase === "warn2") {
          s.shieldTimer -= dt;
          if (s.shieldTimer <= 0) { s.shieldPhase = "active"; s.shieldTimer = 2; }
        } else if (s.shieldPhase === "active") {
          s.shieldTimer -= dt;
          if (s.shieldTimer <= 0) {
            s.shieldPhase = "none";
            s.shieldCooldown = 5 + Math.random() * 5;
          }
        }
      }

      if (s.bossHitTimer > 0) s.bossHitTimer -= dt;

      // Draw background (full canvas width)
      const bgImg = getImg(stage.bgImg);
      if (bgImg) {
        ctx.drawImage(bgImg, 0, 0, canvasW, H);
      } else {
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(0, 0, canvasW, H);
      }

      // Darken sides on desktop
      if (gx > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(0, 0, gx, H);
        ctx.fillRect(gx + gw, 0, gx + 1, H);
      }

      // Stage clear animation
      if (s.stageClearAnim > 0) {
        s.stageClearAnim -= dt;
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(0, 0, canvasW, H);
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.min(32, gw * 0.06)}px monospace`;
        ctx.textAlign = "center";
        const clearText = stage.isBoss
          ? stage.bossType === "apple" ? "🍎 تم هزيمة التفاحة!"
          : stage.bossType === "rock" ? "🪨 تم تحطيم الصخرة!"
          : "🎂 تم تقطيع الكيكة!"
          : "✅ مرحلة مكتملة!";
        ctx.fillText(clearText, cx, cy);
        ctx.font = `${Math.min(20, gw * 0.04)}px monospace`;
        ctx.fillText(`المرحلة ${s.stage + 1}`, cx, cy + 35);
        animId = requestAnimationFrame(gameLoop);
        return;
      }

      /* ─── Draw target + stuck knives (knives behind target) ─── */
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(s.targetAngle);

      // 1) Stuck knives FIRST (behind target)
      const knifeImgEl = getImg(knifeImg);
      s.stuckKnives.forEach(k => {
        ctx.save();
        ctx.rotate(k.angle);
        if (knifeImgEl) {
          ctx.save();
          ctx.translate(0, -targetR - knifeLen * 0.35);
          ctx.drawImage(knifeImgEl, -knifeW / 2, -knifeLen / 2, knifeW, knifeLen);
          ctx.restore();
        } else {
          ctx.fillStyle = "#ccc";
          ctx.fillRect(-3, -targetR - knifeLen + 8, 6, knifeLen);
        }
        ctx.restore();
      });

      // 2) Obstacles (behind target too)
      s.obstacles.forEach(obs => {
        ctx.save();
        ctx.rotate(obs.angle);
        if (obs.type === "branch") {
          // Green branch placeholder
          ctx.translate(0, -targetR - 12);
          ctx.fillStyle = "#2d7a2d";
          ctx.fillRect(-4, -18, 8, 24);
          ctx.fillStyle = "#3a9e3a";
          ctx.beginPath();
          ctx.ellipse(0, -18, 10, 6, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (obs.type === "mineral") {
          const mImg = getImg(mineralCrystal);
          ctx.translate(0, -targetR - 8);
          if (mImg) {
            ctx.drawImage(mImg, -14, -14, 28, 28);
          } else {
            ctx.fillStyle = "#4fc3f7";
            ctx.beginPath();
            ctx.moveTo(0, -14);
            ctx.lineTo(10, 0);
            ctx.lineTo(0, 14);
            ctx.lineTo(-10, 0);
            ctx.closePath();
            ctx.fill();
          }
        } else if (obs.type === "knife") {
          // Pre-placed knife obstacle (cake boss)
          if (knifeImgEl) {
            ctx.translate(0, -targetR - knifeLen * 0.35);
            ctx.drawImage(knifeImgEl, -knifeW / 2, -knifeLen / 2, knifeW, knifeLen);
          } else {
            ctx.fillStyle = "#ff4444";
            ctx.fillRect(-3, -targetR - knifeLen + 8, 6, knifeLen);
          }
        }
        ctx.restore();
      });

      // 3) Target ON TOP
      if (stage.isBoss && stage.bossType === "cake") {
        // Cake boss drawn on canvas
        const cakeR = targetR;
        // Base layers
        ctx.fillStyle = "#f8c8dc";
        ctx.beginPath();
        ctx.ellipse(0, 10, cakeR, cakeR * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#e8a0b8";
        ctx.lineWidth = 3;
        ctx.stroke();
        // Icing drips
        ctx.fillStyle = "#fff";
        for (let a = 0; a < Math.PI * 2; a += 0.5) {
          const dripH = 8 + Math.sin(a * 3) * 6;
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * cakeR * 0.85, Math.sin(a) * cakeR * 0.75 + 10, 8, dripH, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        // Cherry on top
        ctx.fillStyle = "#e53935";
        ctx.beginPath();
        ctx.arc(0, -cakeR * 0.6, cakeR * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#2e7d32";
        ctx.fillRect(-2, -cakeR * 0.75, 4, 10);
      } else {
        const tImg = getImg(stage.targetImg);
        if (tImg) {
          const tSize = targetR * 2;
          ctx.drawImage(tImg, -tSize / 2, -tSize / 2, tSize, tSize);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, targetR, 0, Math.PI * 2);
          ctx.fillStyle = "#8B4513";
          ctx.fill();
        }
      }

      // 4) Coins on target edge
      s.stageCoins.forEach(coin => {
        if (coin.collected) return;
        ctx.save();
        ctx.rotate(coin.angle);
        ctx.translate(0, -targetR * 0.7);
        ctx.beginPath();
        ctx.arc(0, 0, gw * 0.025, 0, Math.PI * 2);
        ctx.fillStyle = "#FFD700";
        ctx.fill();
        ctx.strokeStyle = "#B8860B";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#8B6914";
        ctx.font = `bold ${Math.max(10, gw * 0.025)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("$", 0, 1);
        ctx.restore();
      });

      // 5) Shield overlay (apple boss)
      if (stage.isBoss && stage.bossType === "apple" && s.shieldPhase !== "none") {
        const alpha = s.shieldPhase === "warn1" ? 0.4 : s.shieldPhase === "warn2" ? 0.7 : 1;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(0, 0, targetR * 1.2, 0, Math.PI * 2);
        ctx.strokeStyle = s.shieldPhase === "active" ? "#ff0000" : "#ff9900";
        ctx.lineWidth = s.shieldPhase === "active" ? 6 : 3;
        ctx.stroke();
        if (s.shieldPhase === "active") {
          ctx.fillStyle = "rgba(255,0,0,0.15)";
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      ctx.restore(); // end target group

      /* ─── Coin collect animations ─── */
      s.coinAnims = s.coinAnims.filter(a => {
        a.y -= 60 * dt;
        a.timer -= dt;
        if (a.timer <= 0) return false;
        ctx.globalAlpha = Math.min(a.timer * 2, 1);
        ctx.fillStyle = "#FFD700";
        ctx.font = `bold ${Math.min(18, gw * 0.04)}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText("+1 🪙", a.x, a.y);
        ctx.globalAlpha = 1;
        return true;
      });

      /* ─── Flying knife ─── */
      if (s.flyingKnife) {
        const fk = s.flyingKnife;
        fk.y += fk.vy * dt;

        const distToCenter = Math.sqrt((fk.x - cx) ** 2 + (fk.y - cy) ** 2);

        if (distToCenter <= targetR + knifeLen * 0.3) {
          // Shield check (apple boss)
          if (stage.isBoss && stage.bossType === "apple" && s.shieldPhase === "active") {
            playShieldBlock();
            s.gameOver = true;
            s.flyingKnife = null;
            onScoreUpdate?.(s.score, s.stage, s.knivesThrown);
            onGameOver(s.score, s.stage, s.knivesThrown);
            return;
          }

          const rawAngle = Math.atan2(fk.y - cy, fk.x - cx);
          const landingAngle = rawAngle - s.targetAngle + Math.PI / 2;
          const normalizedAngle = ((landingAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

          // Check collision with stuck knives
          const knifeCollision = s.stuckKnives.some(k => {
            const nk = ((k.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            let diff = Math.abs(normalizedAngle - nk);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            return diff < KNIFE_COLLISION_ANGLE;
          });

          // Check collision with obstacles
          const obsCollision = s.obstacles.some(ob => {
            const no = ((ob.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            let diff = Math.abs(normalizedAngle - no);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            return diff < OBSTACLE_COLLISION_ANGLE;
          });

          if (knifeCollision || obsCollision) {
            playHitKnife();
            s.gameOver = true;
            s.flyingKnife = null;
            onScoreUpdate?.(s.score, s.stage, s.knivesThrown);
            onGameOver(s.score, s.stage, s.knivesThrown);
            return;
          }

          playStick();
          s.stuckKnives.push({ angle: normalizedAngle });
          s.flyingKnife = null;
          s.canThrow = true;

          if (stage.isBoss) s.bossHitTimer = 0.3;

          // Coin collection
          s.stageCoins.forEach(coin => {
            if (coin.collected) return;
            const nc = ((coin.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            let diff = Math.abs(normalizedAngle - nc);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (diff < COIN_COLLECT_ANGLE) {
              coin.collected = true;
              s.coins++;
              s.score += 2;
              playCoinCollect();
              const coinWorldAngle = coin.angle + s.targetAngle;
              s.coinAnims.push({
                x: cx + Math.cos(coinWorldAngle - Math.PI / 2) * targetR * 0.7,
                y: cy + Math.sin(coinWorldAngle - Math.PI / 2) * targetR * 0.7,
                timer: 0.8,
              });
            }
          });

          const ptsPerKnife = scoreSettings?.game_points_per_knife ?? 1;
          s.score += ptsPerKnife;
          s.knivesRemaining--;
          onScoreUpdate?.(s.score, s.stage, s.knivesThrown);

          if (s.knivesRemaining <= 0) {
            if (stage.isBoss) playBossDefeat(); else playStageClear();
            s.stageClearAnim = 1.5;
            s.canThrow = false;
            setTimeout(() => {
              const st = stateRef.current;
              st.stage++;
              const nextStage = ALL_STAGES[Math.min(st.stage, ALL_STAGES.length - 1)];
              st.stuckKnives = initPreplacedKnives(nextStage.preplacedKnives);
              st.knivesRemaining = nextStage.knivesNeeded;
              st.stageCoins = initStageCoins(nextStage);
              st.obstacles = initObstacles(nextStage);
              st.stageClearAnim = 0;
              st.canThrow = true;
              st.stageTime = 0;
              st.rotDir = 1;
              st.shieldPhase = "none";
              st.shieldCooldown = 5 + Math.random() * 5;
              st.bossHitTimer = 0;
            }, 1500);
          }
        } else if (fk.y < -50) {
          s.flyingKnife = null;
          s.canThrow = true;
        } else {
          // Draw flying knife (blade pointing UP toward target)
          if (knifeImgEl) {
            ctx.save();
            ctx.translate(fk.x, fk.y);
            ctx.drawImage(knifeImgEl, -knifeW / 2, -knifeLen / 2, knifeW, knifeLen);
            ctx.restore();
          } else {
            ctx.fillStyle = "#ccc";
            ctx.fillRect(fk.x - 3, fk.y - knifeLen / 2, 6, knifeLen);
          }
        }
      }

      /* ─── Waiting knife at bottom ─── */
      if (!s.flyingKnife && s.canThrow && s.knivesRemaining > 0) {
        if (knifeImgEl) {
          ctx.save();
          ctx.translate(cx, H - 130);
          ctx.drawImage(knifeImgEl, -knifeW / 2, -knifeLen / 2, knifeW, knifeLen);
          ctx.restore();
        }
      }

      /* ─── HUD ─── */
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(gx, H - 90, gw, 90);

      // Stage label
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.min(14, gw * 0.03)}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText(stage.label, cx, H - 72);

      if (stage.isBoss) {
        ctx.fillStyle = "#ff6b6b";
        ctx.font = `bold ${Math.min(12, gw * 0.025)}px monospace`;
        ctx.fillText("BOSS", cx, H - 12);
      }

      // Remaining knives as mini knife images
      const miniKW = 6;
      const miniKH = 20;
      const spacing = miniKW + 6;
      const totalW = s.knivesRemaining * spacing;
      const startX = cx - totalW / 2;
      for (let i = 0; i < s.knivesRemaining; i++) {
        if (knifeImgEl) {
          ctx.drawImage(knifeImgEl, startX + i * spacing, H - 60, miniKW, miniKH);
        } else {
          ctx.fillStyle = "#fff";
          ctx.fillRect(startX + i * spacing, H - 60, miniKW / 2, miniKH);
        }
      }

      // Coins counter
      ctx.fillStyle = "#FFD700";
      ctx.font = `bold ${Math.min(14, gw * 0.03)}px monospace`;
      ctx.textAlign = "left";
      ctx.fillText(`🪙 ${s.coins}`, gx + 12, H - 30);

      // Shield warning text (apple boss)
      if (stage.isBoss && stage.bossType === "apple" && s.shieldPhase === "warn1") {
        ctx.fillStyle = "#ff9900";
        ctx.font = `bold ${Math.min(18, gw * 0.04)}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText("⚠️ درع قادم!", cx, cy + targetR + 40);
      } else if (stage.isBoss && stage.bossType === "apple" && s.shieldPhase === "warn2") {
        ctx.fillStyle = "#ff4400";
        ctx.font = `bold ${Math.min(18, gw * 0.04)}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText("🛡️ انتبه!", cx, cy + targetR + 40);
      } else if (stage.isBoss && stage.bossType === "apple" && s.shieldPhase === "active") {
        ctx.fillStyle = "#ff0000";
        ctx.font = `bold ${Math.min(20, gw * 0.045)}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText("🛡️ الدرع فعال!", cx, cy + targetR + 40);
      }

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousedown", handleInput);
      canvas.removeEventListener("touchstart", handleInput);
    };
  }, [throwKnife, onGameOver, onScoreUpdate, scoreSettings, initPreplacedKnives, initStageCoins, initObstacles]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full touch-none"
      style={{ zIndex: 10 }}
    />
  );
}
