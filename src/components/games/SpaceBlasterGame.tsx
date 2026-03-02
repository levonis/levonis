/**
 * Space Blaster – 20 waves, 4 planets, shop, pro enemies
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { ArrowRight, RotateCcw, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useGameSounds } from "./useGameSounds";
import { useSpaceMusic } from "./space-blaster/useSpaceMusic";
import { GameState, Screen, W, H, PLAYER_W, PLAYER_H, BULLET_W, BULLET_H, MAX_WAVES, Particle, Missile, MAX_MISSILES, MISSILE_RELOAD_RATE, MISSILE_FIRE_RATE } from "./space-blaster/types";
import { getPlanetForWave, PLANETS } from "./space-blaster/planets";
import { spawnWaveEnemies, getEnemyScore } from "./space-blaster/enemies";
import { SHOP_ITEMS } from "./space-blaster/shop";
import { drawEnemy, drawPlayer, drawBackground, drawBullets, drawParticles, drawHUD, drawScreenFlash, drawWaveTransition, drawMissiles, drawMissileBase } from "./space-blaster/renderer";

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

export default function SpaceBlasterGame({ onBack }: { onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef(0);

  const [screen, setScreen] = useState<Screen>('start');
  const [finalScore, setFinalScore] = useState(0);
  const [finalWave, setFinalWave] = useState(0);
  const [pendingPoints, setPendingPoints] = useState(0);
  const [shopLevels, setShopLevels] = useState<Record<string, number>>({});
  const [userPoints, setUserPoints] = useState(0);

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { playClick, playShoot, playExplosion, playBossExplosion, playHit, playWave, playVictory } = useGameSounds();
  const soundsRef = useRef({ playShoot, playExplosion, playBossExplosion, playHit, playWave, playVictory });
  soundsRef.current = { playShoot, playExplosion, playBossExplosion, playHit, playWave, playVictory };
  const { startMusic, stopMusic } = useSpaceMusic();

  // Fetch user points for shop
  useEffect(() => {
    if (!user) return;
    supabase.from('user_points').select('available_points').eq('user_id', user.id).single()
      .then(({ data }) => { if (data) setUserPoints((data as any).available_points ?? 0); });
  }, [user, screen]);

  const syncPoints = useCallback(async (points: number) => {
    if (!user || points === 0) return;
    try {
      await supabase.rpc('admin_adjust_points', {
        p_user_id: user.id, p_amount: points,
        p_reason: `Space Blaster: ${points > 0 ? '+' : ''}${points} نقطة`
      });
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
      if (points > 0) toast.success(`+${points} نقطة!`);
    } catch { toast.error('خطأ في حفظ النقاط'); }
  }, [user, queryClient]);

  const initStars = () =>
    Array.from({ length: 80 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      speed: 0.3 + Math.random() * 1.5,
      size: Math.random() > 0.7 ? 2 : 1,
      brightness: 0.3 + Math.random() * 0.7,
    }));

  const startGame = useCallback(() => {
    const { enemies, total } = spawnWaveEnemies(1, getPlanetForWave(1));
    const extraLives = shopLevels['extra_life'] || 0;
    stateRef.current = {
      screen: 'playing',
      player: { x: W / 2 - PLAYER_W / 2, y: H - 60 },
      lives: 3 + extraLives,
      score: 0, wave: 1, planet: 1,
      enemies, bullets: [], particles: [], stars: initStars(),
      missiles: [],
      spawnTimer: 0, enemiesLeftInWave: total, waveDelay: 0,
      shootCooldown: 0, invincible: 120,
      touchX: null, touchY: null, keys: new Set(), gameTime: 0,
      autoShoot: false, screenFlash: 0,
      fireRateLevel: shopLevels['fire_rate'] || 0,
      doubleBullets: (shopLevels['double_bullets'] || 0) > 0,
      shieldActive: 0,
      shieldInventory: shopLevels['shield'] || 0,
      transitionTimer: 0,
      missileBaseActive: (shopLevels['missile_base'] || 0) > 0,
      missileCount: (shopLevels['missile_base'] || 0) > 0 ? MAX_MISSILES : 0,
      missileReloadTimer: 0,
      missileFireTimer: 0,
    };
    setScreen('playing');
    lastTimeRef.current = 0;
    startMusic();
  }, [shopLevels, startMusic]);

  // Shop buy
  const buyItem = useCallback(async (itemId: string) => {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return;
    const currentLevel = shopLevels[itemId] || 0;
    if (currentLevel >= item.maxLevel) { toast.error('الحد الأقصى!'); return; }
    if (userPoints < item.cost) { toast.error('نقاط غير كافية!'); return; }
    try {
      await supabase.rpc('admin_adjust_points', {
        p_user_id: user!.id, p_amount: -item.cost,
        p_reason: `Shop: ${item.nameAr}`
      });
      setShopLevels(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));
      setUserPoints(prev => prev - item.cost);
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
      toast.success(`تم شراء ${item.nameAr}!`);
      playClick();
    } catch { toast.error('خطأ!'); }
  }, [shopLevels, userPoints, user, queryClient, playClick]);

  // Cleanup music on unmount
  useEffect(() => () => stopMusic(), [stopMusic]);

  // ── Game Loop ──
  useEffect(() => {
    if (screen !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTapTime = 0;

    const onKeyDown = (e: KeyboardEvent) => { stateRef.current?.keys.add(e.key); };
    const onKeyUp = (e: KeyboardEvent) => { stateRef.current?.keys.delete(e.key); };
    const updateTouch = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      if (stateRef.current) {
        stateRef.current.touchX = (e.touches[0].clientX - rect.left) * (W / rect.width);
        stateRef.current.touchY = (e.touches[0].clientY - rect.top) * (H / rect.height);
        stateRef.current.autoShoot = true;
      }
    };
    const onTouchStart = (e: TouchEvent) => {
      updateTouch(e);
      // Double-tap detection for shield
      const now = Date.now();
      if (now - lastTapTime < 300) {
        const s = stateRef.current;
        if (s && s.shieldInventory > 0 && s.shieldActive <= 0) {
          s.shieldActive = 900; // 15 seconds at 60fps
          s.shieldInventory--;
        }
      }
      lastTapTime = now;
    };
    const onTouchEnd = () => {
      if (stateRef.current) { stateRef.current.touchX = null; stateRef.current.touchY = null; stateRef.current.autoShoot = false; }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('touchmove', updateTouch, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    const spawnParticles = (x: number, y: number, count: number, colors: string[]) => {
      const s = stateRef.current;
      if (!s) return;
      for (let i = 0; i < count; i++) {
        s.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          life: 25 + Math.random() * 25,
          maxLife: 50,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 1.5 + Math.random() * 3,
        });
      }
    };

    const explosionColors = ['#ffff00', '#ff8800', '#ff3300', '#ff0000', '#ffffff', '#ff6600'];

    const endGame = (s: GameState, victory: boolean) => {
      if (victory) s.score += 200;
      s.screen = 'gameover';
      setScreen('gameover');
      setFinalScore(s.score);
      setFinalWave(s.wave);
      const pts = Math.floor(s.score / 10);
      setPendingPoints(pts);
      syncPoints(pts);
      stopMusic();
      if (victory) soundsRef.current.playVictory();
    };

    const loop = (time: number) => {
      const s = stateRef.current;
      if (!s || s.screen !== 'playing') return;
      const dt = lastTimeRef.current ? Math.min((time - lastTimeRef.current) / 16.67, 3) : 1;
      lastTimeRef.current = time;
      s.gameTime += dt;

      const planet = getPlanetForWave(s.wave);
      s.planet = planet.id;

      // ── Update ──
      const spd = 4 * dt;
      if (s.keys.has('ArrowLeft') || s.keys.has('a')) s.player.x -= spd;
      if (s.keys.has('ArrowRight') || s.keys.has('d')) s.player.x += spd;
      if (s.keys.has('ArrowUp') || s.keys.has('w')) s.player.y -= spd;
      if (s.keys.has('ArrowDown') || s.keys.has('s')) s.player.y += spd;
      if (s.touchX !== null) s.player.x += clamp(s.touchX - PLAYER_W / 2 - s.player.x, -spd * 1.5, spd * 1.5);
      if (s.touchY !== null) s.player.y += clamp(s.touchY - PLAYER_H / 2 - s.player.y, -spd * 1.5, spd * 1.5);
      s.player.x = clamp(s.player.x, 0, W - PLAYER_W);
      s.player.y = clamp(s.player.y, 0, H - PLAYER_H);

      // Shooting
      s.shootCooldown -= dt;
      const fireRate = 10 - s.fireRateLevel * 2;
      if ((s.keys.has(' ') || s.keys.has('Space') || s.autoShoot) && s.shootCooldown <= 0) {
        s.bullets.push({ x: s.player.x + PLAYER_W / 2 - BULLET_W / 2, y: s.player.y - BULLET_H, dy: -6 });
        if (s.doubleBullets) {
          s.bullets.push({ x: s.player.x + 2, y: s.player.y - BULLET_H + 3, dy: -6 });
          s.bullets.push({ x: s.player.x + PLAYER_W - 4, y: s.player.y - BULLET_H + 3, dy: -6 });
        }
        s.shootCooldown = fireRate;
        soundsRef.current.playShoot();
      }

      if (s.invincible > 0) s.invincible -= dt;
      if (s.shieldActive > 0) s.shieldActive -= dt;
      if (s.screenFlash > 0) s.screenFlash -= dt;

      // Stars
      for (const star of s.stars) {
        star.y += star.speed * dt;
        if (star.y > H) { star.y = 0; star.x = Math.random() * W; }
      }

      // Spawn delays
      for (const e of s.enemies) {
        if (e.spawnDelay > 0) e.spawnDelay -= dt;
      }

      // Bullets
      for (let i = s.bullets.length - 1; i >= 0; i--) {
        const b = s.bullets[i];
        b.y += b.dy * dt;
        if (b.dx) b.x += b.dx * dt;
        if (b.y < -10 || b.y > H + 10 || b.x < -10 || b.x > W + 10) { s.bullets.splice(i, 1); continue; }

        if (b.isEnemy) {
          if (s.invincible <= 0 &&
            b.x > s.player.x && b.x < s.player.x + PLAYER_W &&
            b.y > s.player.y && b.y < s.player.y + PLAYER_H) {
            if (s.shieldActive > 0) {
              // Shield absorbs one hit then breaks
              s.shieldActive = 0;
              s.invincible = 30;
              spawnParticles(s.player.x + PLAYER_W / 2, s.player.y + PLAYER_H / 2, 12, ['#00ffff', '#88ffff', '#ffffff']);
              soundsRef.current.playHit();
              s.bullets.splice(i, 1);
              continue;
            }
            s.lives--;
            s.invincible = 90;
            spawnParticles(s.player.x + PLAYER_W / 2, s.player.y + PLAYER_H / 2, 20, explosionColors);
            soundsRef.current.playHit();
            s.bullets.splice(i, 1);
            if (s.lives <= 0) { endGame(s, false); return; }
            continue;
          }
        } else {
          for (let j = s.enemies.length - 1; j >= 0; j--) {
            const e = s.enemies[j];
            if (e.spawnDelay > 0) continue;
            if (b.x + BULLET_W > e.x && b.x < e.x + e.w && b.y + BULLET_H > e.y && b.y < e.y + e.h) {
              e.hp--;
              s.bullets.splice(i, 1);
              spawnParticles(b.x, b.y, 8, ['#ffff00', '#ffffff', '#ff8800']);
              if (e.hp <= 0) {
                s.score += getEnemyScore(e.type);
                s.enemiesLeftInWave--;
                const pCount = e.type === 'boss' ? 50 : 20;
                spawnParticles(e.x + e.w / 2, e.y + e.h / 2, pCount, explosionColors);
                if (e.type === 'boss') {
                  s.screenFlash = 20;
                  soundsRef.current.playBossExplosion();
                } else {
                  soundsRef.current.playExplosion();
                }
                s.enemies.splice(j, 1);
              }
              break;
            }
          }
        }
      }

      // Enemies
      for (const e of s.enemies) {
        if (e.spawnDelay > 0) continue;
        // Movement patterns
        if (e.type === 'boss') {
          e.y = clamp(e.y + e.speed * dt, 20, 80);
          e.x += Math.sin(s.gameTime * 0.03) * 1.5 * dt;
          e.x = clamp(e.x, 0, W - e.w);
        } else {
          e.movePhase += 0.02 * dt;
          switch (e.movePattern) {
            case 'wave':
              e.y += e.speed * dt;
              e.x += Math.sin(e.movePhase * 3) * 1.2 * dt;
              break;
            case 'zigzag':
              e.y += e.speed * dt;
              e.x += (Math.floor(e.movePhase) % 2 === 0 ? 1.5 : -1.5) * dt;
              break;
            case 'circle':
              e.y += e.speed * 0.5 * dt;
              e.x += Math.cos(e.movePhase * 2) * 1.5 * dt;
              break;
            default:
              e.y += e.speed * dt;
          }
          e.x = clamp(e.x, 0, W - e.w);
        }

        // Enemy shooting
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && e.y > 0) {
          const interval = e.type === 'boss' ? 20 : e.type === 'bomber' ? 35 : e.type === 'fighter' ? 50 : 80;
          e.shootTimer = interval + Math.random() * 30;
          if (e.type === 'boss') {
            s.bullets.push({ x: e.x + 8, y: e.y + e.h, dy: 3.5, isEnemy: true });
            s.bullets.push({ x: e.x + e.w - 10, y: e.y + e.h, dy: 3.5, isEnemy: true });
            // Spread on later planets
            if (planet.id >= 3) {
              s.bullets.push({ x: e.x + e.w / 2, y: e.y + e.h, dy: 3, dx: -1, isEnemy: true });
              s.bullets.push({ x: e.x + e.w / 2, y: e.y + e.h, dy: 3, dx: 1, isEnemy: true });
            }
          } else if (e.type === 'bomber') {
            s.bullets.push({ x: e.x + e.w / 2, y: e.y + e.h, dy: 2, isEnemy: true });
            s.bullets.push({ x: e.x + e.w / 2 - 4, y: e.y + e.h, dy: 2, dx: -0.5, isEnemy: true });
            s.bullets.push({ x: e.x + e.w / 2 + 4, y: e.y + e.h, dy: 2, dx: 0.5, isEnemy: true });
          } else {
            s.bullets.push({ x: e.x + e.w / 2, y: e.y + e.h, dy: 3, isEnemy: true });
          }
        }

        // Collision with player
        if (s.invincible <= 0 &&
          s.player.x + PLAYER_W > e.x && s.player.x < e.x + e.w &&
          s.player.y + PLAYER_H > e.y && s.player.y < e.y + e.h) {
          if (s.shieldActive > 0) {
            // Shield absorbs one hit then breaks
            s.shieldActive = 0;
            s.invincible = 30;
            spawnParticles(s.player.x + PLAYER_W / 2, s.player.y + PLAYER_H / 2, 12, ['#00ffff', '#88ffff', '#ffffff']);
            soundsRef.current.playHit();
          } else {
            s.lives--;
            s.invincible = 90;
            spawnParticles(s.player.x + PLAYER_W / 2, s.player.y + PLAYER_H / 2, 20, explosionColors);
            soundsRef.current.playHit();
            if (s.lives <= 0) { endGame(s, false); return; }
          }
        }

        // Off-screen respawn (non-boss)
        if (e.y > H + 20 && e.type !== 'boss') {
          e.y = -(20 + Math.random() * 100);
          e.x = 20 + Math.random() * (W - 40);
        }
      }

      // ── Missile system ──
      if (s.missileBaseActive) {
        // Reload missiles
        if (s.missileCount < MAX_MISSILES) {
          s.missileReloadTimer += dt;
          if (s.missileReloadTimer >= MISSILE_RELOAD_RATE) {
            s.missileReloadTimer = 0;
            s.missileCount++;
          }
        }
        // Auto-fire missiles at nearest enemy
        s.missileFireTimer -= dt;
        if (s.missileFireTimer <= 0 && s.missileCount > 0 && s.enemies.length > 0) {
          // Find nearest enemy
          const px = s.player.x + PLAYER_W / 2, py = s.player.y + PLAYER_H / 2;
          let nearestIdx = -1, nearestDist = Infinity;
          for (let i = 0; i < s.enemies.length; i++) {
            const e = s.enemies[i];
            if (e.spawnDelay > 0) continue;
            const dx = (e.x + e.w / 2) - px, dy = (e.y + e.h / 2) - py;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
          }
          if (nearestIdx >= 0) {
            const e = s.enemies[nearestIdx];
            const dx = (e.x + e.w / 2) - px, dy = (e.y + e.h / 2) - py;
            s.missiles.push({
              x: px, y: py,
              targetId: nearestIdx,
              speed: 4,
              angle: Math.atan2(dy, dx),
              life: 180,
            });
            s.missileCount--;
            s.missileFireTimer = MISSILE_FIRE_RATE;
            soundsRef.current.playShoot();
          }
        }
        // Update missiles
        for (let i = s.missiles.length - 1; i >= 0; i--) {
          const m = s.missiles[i];
          m.life -= dt;
          if (m.life <= 0) { s.missiles.splice(i, 1); continue; }
          // Re-acquire nearest target
          let tx = m.x + Math.cos(m.angle) * 100, ty = m.y + Math.sin(m.angle) * 100;
          if (s.enemies.length > 0) {
            let best = -1, bestD = Infinity;
            for (let j = 0; j < s.enemies.length; j++) {
              const e = s.enemies[j];
              if (e.spawnDelay > 0) continue;
              const dx = (e.x + e.w / 2) - m.x, dy = (e.y + e.h / 2) - m.y;
              const d = Math.sqrt(dx * dx + dy * dy);
              if (d < bestD) { bestD = d; best = j; }
            }
            if (best >= 0) {
              tx = s.enemies[best].x + s.enemies[best].w / 2;
              ty = s.enemies[best].y + s.enemies[best].h / 2;
            }
          }
          // Steer towards target
          const desired = Math.atan2(ty - m.y, tx - m.x);
          let diff = desired - m.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          m.angle += Math.sign(diff) * Math.min(Math.abs(diff), 0.12 * dt);
          m.x += Math.cos(m.angle) * m.speed * dt;
          m.y += Math.sin(m.angle) * m.speed * dt;
          // Off screen
          if (m.x < -20 || m.x > W + 20 || m.y < -20 || m.y > H + 20) { s.missiles.splice(i, 1); continue; }
          // Hit detection
          for (let j = s.enemies.length - 1; j >= 0; j--) {
            const e = s.enemies[j];
            if (e.spawnDelay > 0) continue;
            if (m.x > e.x && m.x < e.x + e.w && m.y > e.y && m.y < e.y + e.h) {
              e.hp -= 2; // missiles do double damage
              s.missiles.splice(i, 1);
              spawnParticles(m.x, m.y, 12, ['#ff8800', '#ffcc00', '#ff3300']);
              if (e.hp <= 0) {
                s.score += getEnemyScore(e.type);
                s.enemiesLeftInWave--;
                const pCount = e.type === 'boss' ? 50 : 20;
                spawnParticles(e.x + e.w / 2, e.y + e.h / 2, pCount, explosionColors);
                if (e.type === 'boss') {
                  s.screenFlash = 20;
                  soundsRef.current.playBossExplosion();
                } else {
                  soundsRef.current.playExplosion();
                }
                s.enemies.splice(j, 1);
              }
              break;
            }
          }
        }
      }

      // Particles
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.life <= 0) s.particles.splice(i, 1);
      }

      // Wave complete?
      if (s.enemiesLeftInWave <= 0 && s.enemies.length === 0) {
        s.waveDelay += dt;
        if (s.waveDelay > 80) {
          if (s.wave >= MAX_WAVES) { endGame(s, true); return; }
          s.wave++;
          const newPlanet = getPlanetForWave(s.wave);
          const { enemies, total } = spawnWaveEnemies(s.wave, newPlanet);
          s.enemies = enemies;
          s.enemiesLeftInWave = total;
          s.waveDelay = 0;
          soundsRef.current.playWave();
        }
      }

      // ── Draw ──
      drawBackground(ctx, s);
      for (const e of s.enemies) drawEnemy(ctx, e, s.gameTime, planet.id);
      if (s.missileBaseActive) drawMissileBase(ctx, s);
      drawPlayer(ctx, Math.floor(s.player.x), Math.floor(s.player.y), s.invincible, s.gameTime, s.shieldActive, s.lives, 3 + (shopLevels['extra_life'] || 0));
      drawBullets(ctx, s);
      drawMissiles(ctx, s);
      drawParticles(ctx, s.particles);
      drawHUD(ctx, s);
      drawWaveTransition(ctx, s);
      drawScreenFlash(ctx, s.screenFlash);

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('touchmove', updateTouch);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [screen, syncPoints, stopMusic]);

  // ── Render ──
  return (
    <div className="flex flex-col items-center gap-4 w-full px-2 py-4" dir="ltr">
      {screen === 'start' && (
        <div className="flex flex-col items-center gap-4 text-center w-full max-w-xs">
          <div className="pixel-frame p-5 space-y-3 w-full">
            <div className="text-5xl mb-1">🚀</div>
            <h2 className="text-2xl font-black font-mono text-primary" style={{ textShadow: '2px 2px 0 hsl(var(--accent) / 0.4)' }}>
              SPACE BLASTER
            </h2>
            <p className="text-muted-foreground text-sm font-mono">حرب الفضاء</p>
            <div className="space-y-1 text-xs text-muted-foreground font-mono text-right" dir="rtl">
              <p>🌍 4 كواكب | 20 موجة</p>
              <p>🎮 أسهم/WASD + مسافة | لمس</p>
              <p>⭐ أعداء متنوعون وبوسات عملاقة</p>
              <p>❤️ {3 + (shopLevels['extra_life'] || 0)} حياة</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { playClick(); startGame(); }} className="pixel-btn-active font-mono text-sm flex-1">
                ▶ START
              </Button>
              <Button variant="outline" onClick={() => { playClick(); setScreen('shop'); }} className="font-mono text-sm gap-1">
                <ShoppingCart className="h-3 w-3" /> متجر
              </Button>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground font-mono text-xs">
            <ArrowRight className="h-4 w-4" /> رجوع
          </Button>
        </div>
      )}

      {screen === 'shop' && (
        <div className="flex flex-col items-center gap-4 text-center w-full max-w-xs" dir="rtl">
          <div className="pixel-frame p-5 space-y-4 w-full">
            <h2 className="text-xl font-black font-mono text-primary">🛒 المتجر</h2>
            <p className="text-xs text-muted-foreground font-mono">نقاطك: <span className="text-primary font-bold">{userPoints}</span></p>
            <div className="space-y-2">
              {SHOP_ITEMS.map(item => {
                const level = shopLevels[item.id] || 0;
                const maxed = level >= item.maxLevel;
                return (
                  <div key={item.id} className="pixel-frame p-3 flex items-center justify-between gap-2">
                    <div className="text-right flex-1">
                      <div className="font-mono text-sm font-bold">{item.icon} {item.nameAr}</div>
                      <div className="text-xs text-muted-foreground">{item.description}</div>
                      {item.id === 'shield' && <div className="text-xs text-primary">المخزون: {level}/{item.maxLevel}</div>}
                      {item.maxLevel > 1 && item.id !== 'shield' && <div className="text-xs text-primary">المستوى: {level}/{item.maxLevel}</div>}
                    </div>
                    <Button
                      size="sm"
                      disabled={maxed || userPoints < item.cost || !user}
                      onClick={() => buyItem(item.id)}
                      className="font-mono text-xs pixel-btn-active"
                    >
                      {maxed ? '✓' : `${item.cost} ★`}
                    </Button>
                  </div>
                );
              })}
            </div>
            <Button variant="ghost" onClick={() => { playClick(); setScreen('start'); }} className="font-mono text-xs w-full">
              ← رجوع
            </Button>
          </div>
        </div>
      )}

      {screen === 'playing' && (
        <div className="relative w-full" style={{ maxWidth: W }}>
          <canvas
            ref={canvasRef} width={W} height={H}
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
            <div className="space-y-2 text-sm font-mono" dir="rtl">
              <p>النتيجة: <span className="text-primary font-bold">{finalScore}</span></p>
              <p className="text-muted-foreground">الموجة: {finalWave}/{MAX_WAVES}</p>
              <p className="text-muted-foreground">الكوكب: {getPlanetForWave(finalWave).nameAr}</p>
              {pendingPoints > 0 && <p className="text-green-400 font-bold">+{pendingPoints} نقطة مكافأة! 🎉</p>}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { playClick(); startGame(); }} className="pixel-btn-active font-mono text-xs flex-1 gap-1">
                <RotateCcw className="h-3 w-3" /> إعادة
              </Button>
              <Button variant="ghost" onClick={onBack} className="font-mono text-xs flex-1">رجوع</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
