/**
 * Space Blaster – Pixel Art Canvas Game
 * 10 waves, boss at wave 5 & 10, parallax stars, touch + keyboard
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useGameSounds } from "./useGameSounds";

// ── Types ──
interface Vec2 { x: number; y: number }
interface Star { x: number; y: number; speed: number; size: number; brightness: number }
interface Bullet extends Vec2 { dy: number; isEnemy?: boolean }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }
interface Enemy { x: number; y: number; w: number; h: number; hp: number; maxHp: number; type: 'drone' | 'fighter' | 'boss'; shootTimer: number; speed: number }

type Screen = 'start' | 'playing' | 'gameover';

const W = 360;
const H = 640;
const PLAYER_W = 20;
const PLAYER_H = 20;
const BULLET_W = 3;
const BULLET_H = 8;
const MAX_WAVES = 10;

// ── Colors (neon pixel palette) ──
const C = {
  bg: '#0a0a1a',
  player: '#00e5ff',
  playerDark: '#0088aa',
  playerGlow: '#00e5ff44',
  enemy: '#ff3d3d',
  enemyDark: '#aa1111',
  boss: '#b040ff',
  bossDark: '#6a1fb0',
  bullet: '#ffff00',
  enemyBullet: '#ff6644',
  star1: '#ffffff',
  star2: '#8888ff',
  hud: '#00e5ff',
  text: '#ffffff',
  explosion: ['#ffff00', '#ff8800', '#ff3300', '#ff0000', '#880000'],
};

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

export default function SpaceBlasterGame({ onBack }: { onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    screen: Screen;
    player: Vec2;
    lives: number;
    score: number;
    wave: number;
    enemies: Enemy[];
    bullets: Bullet[];
    particles: Particle[];
    stars: Star[];
    spawnTimer: number;
    enemiesLeftInWave: number;
    waveDelay: number;
    shootCooldown: number;
    invincible: number;
    touchX: number | null;
    touchY: number | null;
    keys: Set<string>;
    gameTime: number;
    autoShoot: boolean;
  } | null>(null);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef(0);

  const [screen, setScreen] = useState<Screen>('start');
  const [finalScore, setFinalScore] = useState(0);
  const [finalWave, setFinalWave] = useState(0);
  const [pendingPoints, setPendingPoints] = useState(0);

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { playClick, playShoot, playExplosion, playBossExplosion, playHit, playWave, playVictory } = useGameSounds();
  const soundsRef = useRef({ playShoot, playExplosion, playBossExplosion, playHit, playWave, playVictory });
  soundsRef.current = { playShoot, playExplosion, playBossExplosion, playHit, playWave, playVictory };

  // ── Points sync ──
  const syncPoints = useCallback(async (points: number) => {
    if (!user || points === 0) return;
    try {
      await supabase.rpc('admin_adjust_points', {
        p_user_id: user.id,
        p_amount: points,
        p_reason: `Space Blaster: ${points > 0 ? '+' : ''}${points} نقطة`
      });
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
      if (points > 0) toast.success(`+${points} نقطة!`);
    } catch { toast.error('خطأ في حفظ النقاط'); }
  }, [user, queryClient]);

  // ── Init Stars ──
  const initStars = (): Star[] =>
    Array.from({ length: 60 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      speed: 0.3 + Math.random() * 1.5,
      size: Math.random() > 0.7 ? 2 : 1,
      brightness: 0.3 + Math.random() * 0.7,
    }));

  // ── Spawn Wave Enemies ──
  const spawnWaveEnemies = (wave: number): { enemies: Enemy[]; total: number } => {
    const isBossWave = wave === 5 || wave === 10;
    if (isBossWave) {
      return {
        enemies: [{
          x: W / 2 - 20, y: -50,
          w: 40, h: 40,
          hp: 20 + wave * 5, maxHp: 20 + wave * 5,
          type: 'boss', shootTimer: 0,
          speed: 0.3,
        }],
        total: 1,
      };
    }
    const count = 3 + wave * 2;
    const enemies: Enemy[] = [];
    for (let i = 0; i < count; i++) {
      const isFighter = wave > 3 && Math.random() > 0.6;
      enemies.push({
        x: 20 + Math.random() * (W - 40),
        y: -(30 + Math.random() * 200),
        w: isFighter ? 16 : 12, h: isFighter ? 16 : 12,
        hp: isFighter ? 2 : 1, maxHp: isFighter ? 2 : 1,
        type: isFighter ? 'fighter' : 'drone',
        shootTimer: 60 + Math.random() * 120,
        speed: 0.5 + wave * 0.15 + Math.random() * 0.5,
      });
    }
    return { enemies, total: count };
  };

  // ── Start Game ──
  const startGame = useCallback(() => {
    const { enemies, total } = spawnWaveEnemies(1);
    stateRef.current = {
      screen: 'playing',
      player: { x: W / 2 - PLAYER_W / 2, y: H - 60 },
      lives: 3,
      score: 0,
      wave: 1,
      enemies,
      bullets: [],
      particles: [],
      stars: initStars(),
      spawnTimer: 0,
      enemiesLeftInWave: total,
      waveDelay: 0,
      shootCooldown: 0,
      invincible: 120,
      touchX: null,
      touchY: null,
      keys: new Set(),
      gameTime: 0,
      autoShoot: false,
    };
    setScreen('playing');
    lastTimeRef.current = 0;
  }, []);

  // ── Draw Pixel Ship ──
  const drawPlayer = (ctx: CanvasRenderingContext2D, x: number, y: number, inv: number) => {
    if (inv > 0 && Math.floor(inv / 4) % 2 === 0) return; // blink
    ctx.save();
    // glow
    ctx.shadowColor = C.player;
    ctx.shadowBlur = 8;
    // body
    ctx.fillStyle = C.playerDark;
    ctx.fillRect(x + 6, y + 4, 8, 16);
    ctx.fillStyle = C.player;
    ctx.fillRect(x + 8, y, 4, 20);
    // wings
    ctx.fillStyle = C.playerDark;
    ctx.fillRect(x, y + 12, 6, 8);
    ctx.fillRect(x + 14, y + 12, 6, 8);
    ctx.fillStyle = C.player;
    ctx.fillRect(x + 2, y + 14, 4, 4);
    ctx.fillRect(x + 14, y + 14, 4, 4);
    // cockpit
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 9, y + 6, 2, 3);
    // engine glow
    ctx.fillStyle = '#ff8800';
    ctx.fillRect(x + 9, y + 18, 2, 2 + Math.random() * 2);
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(x + 3, y + 20, 2, 1 + Math.random() * 2);
    ctx.fillRect(x + 15, y + 20, 2, 1 + Math.random() * 2);
    ctx.restore();
  };

  // ── Draw Enemy ──
  const drawEnemy = (ctx: CanvasRenderingContext2D, e: Enemy) => {
    ctx.save();
    if (e.type === 'boss') {
      ctx.shadowColor = C.boss;
      ctx.shadowBlur = 12;
      // boss body
      ctx.fillStyle = C.bossDark;
      ctx.fillRect(e.x + 4, e.y + 4, 32, 32);
      ctx.fillStyle = C.boss;
      ctx.fillRect(e.x + 8, e.y, 24, 36);
      ctx.fillRect(e.x, e.y + 12, 40, 16);
      // cores
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(e.x + 14, e.y + 10, 4, 4);
      ctx.fillRect(e.x + 22, e.y + 10, 4, 4);
      ctx.fillRect(e.x + 18, e.y + 20, 4, 4);
      // eye
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(e.x + 17, e.y + 6, 6, 3);
      // hp bar
      const ratio = e.hp / e.maxHp;
      ctx.fillStyle = '#333';
      ctx.fillRect(e.x, e.y - 6, e.w, 3);
      ctx.fillStyle = ratio > 0.5 ? '#00ff00' : ratio > 0.25 ? '#ffff00' : '#ff0000';
      ctx.fillRect(e.x, e.y - 6, e.w * ratio, 3);
    } else {
      ctx.shadowColor = C.enemy;
      ctx.shadowBlur = 6;
      const col = e.type === 'fighter' ? '#ff6600' : C.enemy;
      const colDark = e.type === 'fighter' ? '#aa3300' : C.enemyDark;
      ctx.fillStyle = colDark;
      ctx.fillRect(e.x + 2, e.y + 2, e.w - 4, e.h - 4);
      ctx.fillStyle = col;
      ctx.fillRect(e.x + 4, e.y, e.w - 8, e.h);
      ctx.fillRect(e.x, e.y + 4, e.w, e.h - 8);
      // eye
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(e.x + e.w / 2 - 1, e.y + 3, 3, 2);
    }
    ctx.restore();
  };

  // ── Game Loop ──
  useEffect(() => {
    if (screen !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Input handlers
    const onKeyDown = (e: KeyboardEvent) => { stateRef.current?.keys.add(e.key); };
    const onKeyUp = (e: KeyboardEvent) => { stateRef.current?.keys.delete(e.key); };
    const updateTouch = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      if (stateRef.current) {
        stateRef.current.touchX = (e.touches[0].clientX - rect.left) * scaleX;
        stateRef.current.touchY = (e.touches[0].clientY - rect.top) * scaleY;
        stateRef.current.autoShoot = true;
      }
    };
    const onTouchMove = updateTouch;
    const onTouchStart = updateTouch;
    const onTouchEnd = () => {
      if (stateRef.current) {
        stateRef.current.touchX = null;
        stateRef.current.touchY = null;
        stateRef.current.autoShoot = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    const spawnParticles = (x: number, y: number, count: number, colors: string[]) => {
      const s = stateRef.current;
      if (!s) return;
      for (let i = 0; i < count; i++) {
        s.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          life: 20 + Math.random() * 20,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 1 + Math.random() * 3,
        });
      }
    };

    const loop = (time: number) => {
      const s = stateRef.current;
      if (!s || s.screen !== 'playing') return;

      const dt = lastTimeRef.current ? Math.min((time - lastTimeRef.current) / 16.67, 3) : 1;
      lastTimeRef.current = time;
      s.gameTime += dt;

      // ── Update ──

      // Player movement
      const spd = 4 * dt;
      if (s.keys.has('ArrowLeft') || s.keys.has('a')) s.player.x -= spd;
      if (s.keys.has('ArrowRight') || s.keys.has('d')) s.player.x += spd;
      if (s.keys.has('ArrowUp') || s.keys.has('w')) s.player.y -= spd;
      if (s.keys.has('ArrowDown') || s.keys.has('s')) s.player.y += spd;
      if (s.touchX !== null) {
        const targetX = s.touchX - PLAYER_W / 2;
        s.player.x += clamp(targetX - s.player.x, -spd * 1.5, spd * 1.5);
      }
      if (s.touchY !== null) {
        const targetY = s.touchY - PLAYER_H / 2;
        s.player.y += clamp(targetY - s.player.y, -spd * 1.5, spd * 1.5);
      }
      s.player.x = clamp(s.player.x, 0, W - PLAYER_W);
      s.player.y = clamp(s.player.y, 0, H - PLAYER_H);

      // Shooting
      s.shootCooldown -= dt;
      if ((s.keys.has(' ') || s.keys.has('Space') || s.autoShoot) && s.shootCooldown <= 0) {
        s.bullets.push({ x: s.player.x + PLAYER_W / 2 - BULLET_W / 2, y: s.player.y - BULLET_H, dy: -6 });
        s.shootCooldown = 10;
        soundsRef.current.playShoot();
      }

      // Invincibility
      if (s.invincible > 0) s.invincible -= dt;

      // Stars
      for (const star of s.stars) {
        star.y += star.speed * dt;
        if (star.y > H) { star.y = 0; star.x = Math.random() * W; }
      }

      // Bullets
      for (let i = s.bullets.length - 1; i >= 0; i--) {
        const b = s.bullets[i];
        b.y += b.dy * dt;
        if (b.y < -10 || b.y > H + 10) { s.bullets.splice(i, 1); continue; }

        if (b.isEnemy) {
          // hit player?
          if (s.invincible <= 0 &&
            b.x > s.player.x && b.x < s.player.x + PLAYER_W &&
            b.y > s.player.y && b.y < s.player.y + PLAYER_H) {
            s.lives--;
            s.invincible = 90;
            spawnParticles(s.player.x + PLAYER_W / 2, s.player.y + PLAYER_H / 2, 15, C.explosion);
            soundsRef.current.playHit();
            if (s.lives <= 0) {
              s.screen = 'gameover';
              setScreen('gameover');
              setFinalScore(s.score);
              setFinalWave(s.wave);
              const pts = Math.floor(s.score / 10);
              setPendingPoints(pts);
              syncPoints(pts);
            }
            continue;
          }
        } else {
          // hit enemy?
          for (let j = s.enemies.length - 1; j >= 0; j--) {
            const e = s.enemies[j];
            if (b.x + BULLET_W > e.x && b.x < e.x + e.w &&
              b.y + BULLET_H > e.y && b.y < e.y + e.h) {
              e.hp--;
              s.bullets.splice(i, 1);
              spawnParticles(b.x, b.y, 4, ['#ffff00', '#ffffff']);
              if (e.hp <= 0) {
                const pts = e.type === 'boss' ? 50 : e.type === 'fighter' ? 10 : 5;
                s.score += pts;
                s.enemiesLeftInWave--;
                spawnParticles(e.x + e.w / 2, e.y + e.h / 2, e.type === 'boss' ? 40 : 15, C.explosion);
                e.type === 'boss' ? soundsRef.current.playBossExplosion() : soundsRef.current.playExplosion();
                s.enemies.splice(j, 1);
              }
              break;
            }
          }
        }
      }

      // Enemies
      for (const e of s.enemies) {
        if (e.type === 'boss') {
          e.y = clamp(e.y + e.speed * dt, 20, 80);
          e.x += Math.sin(s.gameTime * 0.03) * 1.5 * dt;
          e.x = clamp(e.x, 0, W - e.w);
        } else {
          e.y += e.speed * dt;
        }
        // enemy shoot
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && e.y > 0) {
          const interval = e.type === 'boss' ? 25 : e.type === 'fighter' ? 50 : 80;
          e.shootTimer = interval + Math.random() * 30;
          if (e.type === 'boss') {
            s.bullets.push({ x: e.x + 10, y: e.y + e.h, dy: 3, isEnemy: true });
            s.bullets.push({ x: e.x + e.w - 12, y: e.y + e.h, dy: 3, isEnemy: true });
          } else {
            s.bullets.push({ x: e.x + e.w / 2, y: e.y + e.h, dy: 3, isEnemy: true });
          }
        }
        // collision with player
        if (s.invincible <= 0 &&
          s.player.x + PLAYER_W > e.x && s.player.x < e.x + e.w &&
          s.player.y + PLAYER_H > e.y && s.player.y < e.y + e.h) {
          s.lives--;
          s.invincible = 90;
          spawnParticles(s.player.x + PLAYER_W / 2, s.player.y + PLAYER_H / 2, 15, C.explosion);
          soundsRef.current.playHit();
          if (s.lives <= 0) {
            s.screen = 'gameover';
            setScreen('gameover');
            setFinalScore(s.score);
            setFinalWave(s.wave);
            const pts = Math.floor(s.score / 10);
            setPendingPoints(pts);
            syncPoints(pts);
          }
        }
        // enemy off screen
        if (e.y > H + 20 && e.type !== 'boss') {
          e.y = -(20 + Math.random() * 100);
          e.x = 20 + Math.random() * (W - 40);
        }
      }

      // Particles
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) s.particles.splice(i, 1);
      }

      // Wave complete?
      if (s.enemiesLeftInWave <= 0 && s.enemies.length === 0) {
        s.waveDelay += dt;
        if (s.waveDelay > 60) {
          if (s.wave >= MAX_WAVES) {
            // Victory!
            s.score += 100;
            s.screen = 'gameover';
            setScreen('gameover');
            setFinalScore(s.score);
            setFinalWave(s.wave);
            const pts = Math.floor(s.score / 10);
            setPendingPoints(pts);
            syncPoints(pts);
            soundsRef.current.playVictory();
            return;
          }
          s.wave++;
          const { enemies, total } = spawnWaveEnemies(s.wave);
          s.enemies = enemies;
          s.enemiesLeftInWave = total;
          s.waveDelay = 0;
          soundsRef.current.playWave();
        }
      }

      // ── Draw ──
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, W, H);

      // Stars
      for (const star of s.stars) {
        ctx.globalAlpha = star.brightness;
        ctx.fillStyle = star.size > 1 ? C.star2 : C.star1;
        ctx.fillRect(Math.floor(star.x), Math.floor(star.y), star.size, star.size);
      }
      ctx.globalAlpha = 1;

      // Enemies
      for (const e of s.enemies) drawEnemy(ctx, e);

      // Player
      drawPlayer(ctx, Math.floor(s.player.x), Math.floor(s.player.y), s.invincible);

      // Bullets
      for (const b of s.bullets) {
        ctx.fillStyle = b.isEnemy ? C.enemyBullet : C.bullet;
        ctx.shadowColor = b.isEnemy ? C.enemyBullet : C.bullet;
        ctx.shadowBlur = 4;
        ctx.fillRect(Math.floor(b.x), Math.floor(b.y), BULLET_W, BULLET_H);
      }
      ctx.shadowBlur = 0;

      // Particles
      for (const p of s.particles) {
        ctx.globalAlpha = clamp(p.life / 20, 0, 1);
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
      }
      ctx.globalAlpha = 1;

      // HUD
      ctx.fillStyle = C.hud;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`♥ ${s.lives}`, 8, 20);
      ctx.textAlign = 'center';
      ctx.fillText(`WAVE ${s.wave}/${MAX_WAVES}`, W / 2, 20);
      ctx.textAlign = 'right';
      ctx.fillText(`★ ${s.score}`, W - 8, 20);

      // Wave transition text
      if (s.waveDelay > 0 && s.enemiesLeftInWave <= 0) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(s.wave >= MAX_WAVES ? '🏆 VICTORY!' : `WAVE ${s.wave + 1} INCOMING...`, W / 2, H / 2);
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [screen, syncPoints]);

  // ── Render ──
  return (
    <div className="flex flex-col items-center gap-4 w-full px-2 py-4" dir="ltr">
      {screen === 'start' && (
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="pixel-frame p-6 space-y-4">
            <div className="text-5xl mb-2">🚀</div>
            <h2 className="text-2xl font-black font-mono text-primary"
              style={{ textShadow: '2px 2px 0 hsl(var(--accent) / 0.4)' }}>
              SPACE BLASTER
            </h2>
            <p className="text-muted-foreground text-sm font-mono">حرب الفضاء</p>
            <div className="space-y-1 text-xs text-muted-foreground font-mono">
              <p>🎯 دمّر الأعداء واجمع النقاط</p>
              <p>🎮 أسهم/WASD + مسافة | لمس للموبايل</p>
              <p>⭐ +5 لكل عدو | +50 للبوس</p>
              <p>❤️ 3 حياة | 10 موجات</p>
            </div>
            <Button onClick={() => { playClick(); startGame(); }} className="pixel-btn-active font-mono text-sm w-full">
              ▶ START GAME
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground font-mono text-xs">
            <ArrowRight className="h-4 w-4" /> رجوع
          </Button>
        </div>
      )}

      {screen === 'playing' && (
        <div className="relative w-full" style={{ maxWidth: W }}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="w-full rounded-lg border-2 border-primary/30"
            style={{ imageRendering: 'pixelated', aspectRatio: `${W}/${H}`, touchAction: 'none' }}
          />
        </div>
      )}

      {screen === 'gameover' && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="pixel-frame p-6 space-y-4">
            <div className="text-5xl mb-2">{finalWave >= MAX_WAVES ? '🏆' : '💥'}</div>
            <h2 className="text-xl font-black font-mono text-primary">
              {finalWave >= MAX_WAVES ? 'VICTORY!' : 'GAME OVER'}
            </h2>
            <div className="space-y-2 text-sm font-mono">
              <p className="text-foreground">النتيجة: <span className="text-primary font-bold">{finalScore}</span></p>
              <p className="text-muted-foreground">الموجة: {finalWave}/{MAX_WAVES}</p>
              {pendingPoints > 0 && (
                <p className="text-green-400 font-bold">+{pendingPoints} نقطة مكافأة! 🎉</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { playClick(); startGame(); }} className="pixel-btn-active font-mono text-xs flex-1 gap-1">
                <RotateCcw className="h-3 w-3" /> إعادة
              </Button>
              <Button variant="ghost" onClick={onBack} className="font-mono text-xs flex-1">
                رجوع
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
