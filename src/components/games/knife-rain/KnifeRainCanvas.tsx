import { useRef, useEffect, useCallback } from "react";
import { playThrow, playStick, playHitKnife, playStageClear, playBossDefeat } from "./KnifeRainAudio";

import knifeImg from "@/assets/knife-rain/Normal_Knif.png";
import wood1 from "@/assets/knife-rain/Normal_Wood_1.png";
import wood1hit from "@/assets/knife-rain/Wood_1-_1_Hit.png";
import wood2hits from "@/assets/knife-rain/Wood_1_2Hits.png";
import wood3hits from "@/assets/knife-rain/Wood_1_3Hits.png";
import candy4 from "@/assets/knife-rain/Candy_4.png";
import back1 from "@/assets/knife-rain/Back_1.png";
import back2 from "@/assets/knife-rain/Back_2.png";

interface Props {
  onGameOver: (score: number, stage: number, knivesThrown: number) => void;
  onScoreUpdate?: (score: number, stage: number, knivesThrown: number) => void;
  scoreSettings?: {
    game_points_per_knife: number;
    game_combo_multiplier: number;
  };
}

// Stage definitions
interface StageConfig {
  targetImg: string;
  bgImg: string;
  rotationSpeed: number;   // radians per second
  knivesNeeded: number;
  isBoss: boolean;
  label: string;
}

function buildStages(): StageConfig[] {
  const stages: StageConfig[] = [];
  // Pattern: 4 normal stages then 1 boss, repeating with increasing difficulty
  const woodImgs = [wood1, wood1hit, wood2hits, wood3hits];
  const bgs = [back1, back2];
  
  for (let round = 0; round < 10; round++) {
    const baseSpeed = 1.5 + round * 0.4;
    const baseKnives = 4 + round;
    
    // 4 normal stages
    for (let i = 0; i < 4; i++) {
      stages.push({
        targetImg: woodImgs[i],
        bgImg: bgs[round % 2],
        rotationSpeed: baseSpeed + i * 0.15,
        knivesNeeded: baseKnives + Math.floor(i / 2),
        isBoss: false,
        label: `المرحلة ${round * 5 + i + 1}`,
      });
    }
    // Boss stage
    stages.push({
      targetImg: candy4,
      bgImg: bgs[(round + 1) % 2],
      rotationSpeed: baseSpeed + 1.2,
      knivesNeeded: baseKnives + 3,
      isBoss: true,
      label: `بوس ${round + 1} 🍬`,
    });
  }
  return stages;
}

const ALL_STAGES = buildStages();
const KNIFE_COLLISION_ANGLE = 0.22; // ~12.6 degrees threshold
const KNIFE_SPEED = 2200; // px per second

interface StuckKnife {
  angle: number;
}

interface FlyingKnife {
  x: number;
  y: number;
  vy: number;
}

export default function KnifeRainCanvas({ onGameOver, onScoreUpdate, scoreSettings }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    stage: 0,
    score: 0,
    knivesThrown: 0,
    stuckKnives: [] as StuckKnife[],
    flyingKnife: null as FlyingKnife | null,
    targetAngle: 0,
    knivesRemaining: ALL_STAGES[0].knivesNeeded,
    gameOver: false,
    stageClearAnim: 0, // countdown frames for stage clear animation
    canThrow: true,
    lastTime: 0,
  });

  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const loadedRef = useRef(false);

  // Preload all images
  useEffect(() => {
    const srcs = [knifeImg, wood1, wood1hit, wood2hits, wood3hits, candy4, back1, back2];
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

  const throwKnife = useCallback(() => {
    const s = stateRef.current;
    if (s.gameOver || s.flyingKnife || !s.canThrow || s.stageClearAnim > 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    playThrow();
    s.flyingKnife = {
      x: canvas.width / 2,
      y: canvas.height - 140,
      vy: -KNIFE_SPEED,
    };
    s.canThrow = false;
    s.knivesThrown++;
  }, []);

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
      if (!loadedRef.current) {
        animId = requestAnimationFrame(gameLoop);
        return;
      }

      const dt = s.lastTime ? Math.min((time - s.lastTime) / 1000, 0.05) : 0.016;
      s.lastTime = time;

      if (s.gameOver) return;

      const W = canvas.width;
      const H = canvas.height;
      const stage = ALL_STAGES[Math.min(s.stage, ALL_STAGES.length - 1)];
      const cx = W / 2;
      const cy = H * 0.30;
      const targetR = W * 0.28; // ~56% of screen width diameter
      const knifeLen = W * 0.22;
      const knifeW = knifeLen * 0.28;

      // Update rotation
      s.targetAngle += stage.rotationSpeed * dt;

      // Draw background
      const bgImg = getImg(stage.bgImg);
      if (bgImg) {
        ctx.drawImage(bgImg, 0, 0, W, H);
      } else {
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(0, 0, W, H);
      }

      // Stage clear animation overlay
      if (s.stageClearAnim > 0) {
        s.stageClearAnim -= dt;
        ctx.fillStyle = `rgba(0,0,0,0.4)`;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.min(32, W * 0.06)}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(stage.isBoss ? "🍬 تم هزيمة البوس!" : "✅ مرحلة مكتملة!", cx, cy);
        ctx.font = `${Math.min(20, W * 0.04)}px monospace`;
        ctx.fillText(`المرحلة ${s.stage + 1}`, cx, cy + 35);
        animId = requestAnimationFrame(gameLoop);
        return;
      }

      // Draw target (rotating)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(s.targetAngle);
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

      // Draw stuck knives
      const knifeImgEl = getImg(knifeImg);
      s.stuckKnives.forEach(k => {
        ctx.save();
        ctx.rotate(k.angle);
        if (knifeImgEl) {
          ctx.save();
          ctx.translate(0, -targetR - knifeLen * 0.35);
          ctx.rotate(Math.PI);
          ctx.drawImage(knifeImgEl, -knifeW / 2, -knifeLen / 2, knifeW, knifeLen);
          ctx.restore();
        } else {
          ctx.fillStyle = "#ccc";
          ctx.fillRect(-3, -targetR - knifeLen + 8, 6, knifeLen);
        }
        ctx.restore();
      });
      ctx.restore();

      // Update and draw flying knife
      if (s.flyingKnife) {
        const fk = s.flyingKnife;
        fk.y += fk.vy * dt;

        // Check if knife reached the target
        const distToCenter = Math.sqrt((fk.x - cx) ** 2 + (fk.y - cy) ** 2);
        
        if (distToCenter <= targetR + knifeLen * 0.3) {
          // Calculate the angle where the knife lands relative to target rotation
          const rawAngle = Math.atan2(fk.y - cy, fk.x - cx);
          const landingAngle = rawAngle - s.targetAngle + Math.PI / 2;
          const normalizedAngle = ((landingAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

          // Check collision with existing knives
          const collision = s.stuckKnives.some(k => {
            const nk = ((k.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            let diff = Math.abs(normalizedAngle - nk);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            return diff < KNIFE_COLLISION_ANGLE;
          });

          if (collision) {
            playHitKnife();
            s.gameOver = true;
            s.flyingKnife = null;
            onScoreUpdate?.(s.score, s.stage, s.knivesThrown);
            onGameOver(s.score, s.stage, s.knivesThrown);
            return;
          }

          // Stick the knife
          playStick();
          s.stuckKnives.push({ angle: normalizedAngle });
          s.flyingKnife = null;
          s.canThrow = true;
          
          // Score
          const ptsPerKnife = scoreSettings?.game_points_per_knife ?? 1;
          s.score += ptsPerKnife;
          s.knivesRemaining--;
          onScoreUpdate?.(s.score, s.stage, s.knivesThrown);

          // Check stage complete
          if (s.knivesRemaining <= 0) {
            if (stage.isBoss) {
              playBossDefeat();
            } else {
              playStageClear();
            }
            s.stageClearAnim = 1.5;
            s.canThrow = false;
            
            // Advance stage
            setTimeout(() => {
              const st = stateRef.current;
              st.stage++;
              st.stuckKnives = [];
              st.knivesRemaining = ALL_STAGES[Math.min(st.stage, ALL_STAGES.length - 1)].knivesNeeded;
              st.stageClearAnim = 0;
              st.canThrow = true;
            }, 1500);
          }
        } else if (fk.y < -50) {
          // Knife went off screen (shouldn't happen normally)
          s.flyingKnife = null;
          s.canThrow = true;
        } else {
          // Draw flying knife
          if (knifeImgEl) {
            ctx.save();
            ctx.translate(fk.x, fk.y);
            ctx.rotate(Math.PI);
            ctx.drawImage(knifeImgEl, -KNIFE_WIDTH / 2, -KNIFE_LENGTH / 2, KNIFE_WIDTH, KNIFE_LENGTH);
            ctx.restore();
          } else {
            ctx.fillStyle = "#ccc";
            ctx.fillRect(fk.x - 2, fk.y - KNIFE_LENGTH / 2, 4, KNIFE_LENGTH);
          }
        }
      }

      // HUD - Knives remaining
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, H - 80, W, 80);
      
      // Draw remaining knife indicators
      const indicatorSize = 8;
      const spacing = 14;
      const totalW = s.knivesRemaining * spacing;
      const startX = cx - totalW / 2;
      for (let i = 0; i < s.knivesRemaining; i++) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(startX + i * spacing, H - 50, indicatorSize / 2, indicatorSize * 2);
      }

      // Stage label
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.min(14, W * 0.03)}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText(stage.label, cx, H - 60);
      
      if (stage.isBoss) {
        ctx.fillStyle = "#ff6b6b";
        ctx.font = `bold ${Math.min(12, W * 0.025)}px monospace`;
        ctx.fillText("BOSS", cx, H - 20);
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
  }, [throwKnife, onGameOver, onScoreUpdate, scoreSettings]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full touch-none"
      style={{ zIndex: 1 }}
    />
  );
}
