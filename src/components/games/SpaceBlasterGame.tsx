/**
 * Space Blaster – 260 waves, 13 planets, 150+ enemies, progressive upgrades
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { ArrowRight, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useGameSounds } from "./useGameSounds";
import { useSpaceMusic } from "./space-blaster/useSpaceMusic";
import { GameState, Screen, W, H, PLAYER_W, PLAYER_H, BULLET_W, BULLET_H, MAX_WAVES, Particle, Missile, MAX_MISSILES, MISSILE_FIRE_RATE, PowerUp, PowerUpType, HelperPlane, LaserBeam, getEnemyTier } from "./space-blaster/types";
import { getPlanetForWave } from "./space-blaster/planets";
import { spawnWaveEnemies, getEnemyScore, getEnemyShootPattern } from "./space-blaster/enemies";
import { drawEnemy, drawPlayer, drawBackground, drawBullets, drawParticles, drawHUD, drawScreenFlash, drawWaveTransition, drawMissiles, drawMissileBase, drawPowerUps, drawHelperPlanes, updateMissileBaseAnim, drawLaserBeams } from "./space-blaster/renderer";

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

// Get upgrade breakdown from level
function getUpgradeInfo(level: number) {
  if (level <= 0) return { shootBullets: 1, laserLevel: 0, rockets: 0, helpers: 0 };
  if (level <= 2) return { shootBullets: 1 + level, laserLevel: 0, rockets: 0, helpers: 0 };
  if (level <= 7) return { shootBullets: 3, laserLevel: level - 2, rockets: 0, helpers: 0 };
  if (level <= 13) return { shootBullets: 3, laserLevel: 5, rockets: level - 7, helpers: 0 };
  return { shootBullets: 3, laserLevel: 5, rockets: 6, helpers: Math.min(level - 13, 2) };
}

export default function SpaceBlasterGame({ onBack }: { onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
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
  const { startMusic, stopMusic } = useSpaceMusic();

  // Fetch game settings
  const { data: gameSettings } = useQuery({
    queryKey: ["space-blaster-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("space_blaster_settings")
        .select("*")
        .limit(1)
        .single();
      return data as any;
    },
  });

  // Fetch user tickets for entry fee
  const { data: ticketData, refetch: refetchTickets } = useQuery({
    queryKey: ["user-tickets", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_tickets")
        .select("ticket_count")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const userTickets = ticketData?.ticket_count || 0;
  const entryFee = gameSettings?.entry_fee_tickets || 0;
  const settingsRef = useRef(gameSettings);
  settingsRef.current = gameSettings;

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

  const startGame = useCallback(async () => {
    // Deduct entry fee if required
    if (entryFee > 0 && user) {
      if (userTickets < entryFee) {
        toast.error(`تحتاج ${entryFee} تذكرة للعب`);
        return;
      }
      try {
        const { data: result } = await supabase.rpc("deduct_user_tickets", {
          p_user_id: user.id,
          p_amount: entryFee,
        });
        if (!result) {
          toast.error("فشل خصم التذاكر");
          return;
        }
        refetchTickets();
      } catch {
        toast.error("خطأ في خصم التذاكر");
        return;
      }
    }

    const { enemies, total } = spawnWaveEnemies(1, getPlanetForWave(1));
    stateRef.current = {
      screen: 'playing',
      player: { x: W / 2 - PLAYER_W / 2, y: H - 60 },
      lives: 5,
      maxLives: 5,
      score: 0, wave: 1, planet: 1,
      enemies, bullets: [], particles: [], stars: initStars(),
      missiles: [],
      powerUps: [],
      helperPlanes: [],
      laserBeams: [],
      spawnTimer: 0, enemiesLeftInWave: total, waveDelay: 0,
      shootCooldown: 0, invincible: 120,
      touchX: null, touchY: null, keys: new Set(), gameTime: 0,
      autoShoot: false, screenFlash: 0,
      upgradeLevel: 0,
      shieldActive: 0,
      missileCount: 0,
      missileFireTimer: 0,
      missileAutoFire: false,
      transitionTimer: 0,
    };
    setScreen('playing');
    lastTimeRef.current = 0;
    startMusic();
  }, [startMusic, entryFee, user, userTickets, refetchTickets]);

  // Cleanup music on unmount
  useEffect(() => () => stopMusic(), [stopMusic]);

  // ── Game Loop ──
  useEffect(() => {
    if (screen !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;


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

    // Power-up drop chances based on enemy type
    const DROP_CHANCES: Record<string, number> = {
      drone: 0.08, fighter: 0.12, tank: 0.18, speeder: 0.10, bomber: 0.20, boss: 0.8,
    };
    const spawnPowerUp = (x: number, y: number, enemyType: string) => {
      const s = stateRef.current;
      if (!s) return;
      const chance = DROP_CHANCES[enemyType] || 0.08;
      if (Math.random() > chance) return;
      // 70% upgrade, 30% shield
      const type: PowerUpType = Math.random() < 0.7 ? 'upgrade' : 'shield';
      s.powerUps.push({ x, y, type, vy: 1.2, life: 600 });
    };
    const explosionColors = ['#ffff00', '#ff8800', '#ff3300', '#ff0000', '#ffffff', '#ff6600'];

    const endGame = (s: GameState, victory: boolean) => {
      s.screen = 'gameover';
      setScreen('gameover');
      setFinalScore(s.score);
      setFinalWave(s.wave);

      const gs = settingsRef.current;
      const pps = gs?.points_per_score ?? 0.03;
      const victoryBonus = victory ? (gs?.victory_bonus_points ?? 5) : 0;
      const waveBonus = (s.wave - 1) * (gs?.wave_bonus_points ?? 0);

      const scorePoints = Math.floor(s.score * pps);
      const totalPts = scorePoints + waveBonus + victoryBonus;

      setPendingPoints(totalPts);
      syncPoints(totalPts);
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
      const info = getUpgradeInfo(s.upgradeLevel);

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

      // Shooting based on upgrade level
      s.shootCooldown -= dt;
      const fireRate = Math.max(4, 10 - info.laserLevel);
      const isShooting = s.keys.has(' ') || s.keys.has('Space') || s.autoShoot;
      if (isShooting && s.shootCooldown <= 0) {
        const cx = s.player.x + PLAYER_W / 2;
        // Main bullets
        s.bullets.push({ x: cx - BULLET_W / 2, y: s.player.y - BULLET_H, dy: -6 });
        if (info.shootBullets >= 2) {
          s.bullets.push({ x: s.player.x + 2, y: s.player.y - BULLET_H + 3, dy: -6 });
        }
        if (info.shootBullets >= 3) {
          s.bullets.push({ x: s.player.x + PLAYER_W - 4, y: s.player.y - BULLET_H + 3, dy: -6 });
        }
        s.shootCooldown = fireRate;
        soundsRef.current.playShoot();
      }

      // ── Laser beam system (continuous beams, not bullets) ──
      s.laserBeams = [];
      if (info.laserLevel > 0 && isShooting) {
        const cx = s.player.x + PLAYER_W / 2;
        for (let li = 0; li < info.laserLevel; li++) {
          const spread = (li - (info.laserLevel - 1) / 2) * 10;
          const beamX = cx + spread;
          let endY = 0; // beam goes to top by default
          let hitIdx = -1;
          // Check collision with enemies (find closest)
          let closestY = -1;
          for (let ei = 0; ei < s.enemies.length; ei++) {
            const e = s.enemies[ei];
            if (e.spawnDelay > 0) continue;
            if (beamX > e.x && beamX < e.x + e.w && e.y + e.h > 0 && e.y < s.player.y) {
              const ey = e.y + e.h;
              if (hitIdx === -1 || ey > closestY) {
                closestY = ey;
                hitIdx = ei;
                endY = e.y + e.h / 2;
              }
            }
          }
          // Apply continuous damage to hit enemy
          if (hitIdx >= 0) {
            const e = s.enemies[hitIdx];
            const laserDps = 0.08 * (1 + info.laserLevel * 0.3); // damage per frame
            e.hp -= laserDps * dt;
            // Spark particles every few frames
            if (Math.random() < 0.3) {
              spawnParticles(beamX, endY, 2, ['#00ff88', '#88ffff', '#ffffff']);
            }
            if (e.hp <= 0) {
              s.score += getEnemyScore(e.type);
              s.enemiesLeftInWave--;
              const pCount = e.type === 'boss' ? 50 : 20;
              spawnParticles(e.x + e.w / 2, e.y + e.h / 2, pCount, explosionColors);
              spawnPowerUp(e.x + e.w / 2, e.y + e.h / 2, e.type);
              if (e.type === 'boss') {
                s.screenFlash = 20;
                soundsRef.current.playBossExplosion();
              } else {
                soundsRef.current.playExplosion();
              }
              s.enemies.splice(hitIdx, 1);
            }
          }
          s.laserBeams.push({ x: beamX, endY: hitIdx >= 0 ? endY : 0, width: 2 + info.laserLevel * 0.5, hitEnemyIdx: hitIdx, active: true });
        }
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

      // ── Helper planes update ──
      // Sync helper plane count with upgrade
      while (s.helperPlanes.length < info.helpers) {
        const side = s.helperPlanes.length === 0 ? 'left' : 'right';
        s.helperPlanes.push({ x: s.player.x, y: s.player.y, side, shootTimer: 0 });
      }
      while (s.helperPlanes.length > info.helpers) {
        s.helperPlanes.pop();
      }
      // Move and shoot
      for (const hp of s.helperPlanes) {
        const offsetX = hp.side === 'left' ? -20 : PLAYER_W + 12;
        const targetX = s.player.x + offsetX;
        const targetY = s.player.y + 8;
        hp.x += clamp(targetX - hp.x, -spd * 2, spd * 2);
        hp.y += clamp(targetY - hp.y, -spd * 2, spd * 2);
        hp.shootTimer -= dt;
        if (hp.shootTimer <= 0) {
          s.bullets.push({ x: hp.x, y: hp.y - 6, dy: -5 });
          hp.shootTimer = 18; // slower fire rate than player
        }
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
            const bw = b.isLaser ? 2 : BULLET_W;
            const bh = b.isLaser ? 12 : BULLET_H;
            if (b.x + bw > e.x && b.x < e.x + e.w && b.y + bh > e.y && b.y < e.y + e.h) {
              e.hp -= b.isLaser ? 0.5 : 1;
              s.bullets.splice(i, 1);
              spawnParticles(b.x, b.y, 8, b.isLaser ? ['#00ff88', '#ffffff'] : ['#ffff00', '#ffffff', '#ff8800']);
              if (e.hp <= 0) {
                s.score += getEnemyScore(e.type);
                s.enemiesLeftInWave--;
                const pCount = e.type === 'boss' ? 50 : 20;
                spawnParticles(e.x + e.w / 2, e.y + e.h / 2, pCount, explosionColors);
                spawnPowerUp(e.x + e.w / 2, e.y + e.h / 2, e.type);
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
        if (e.type === 'boss') {
          e.y = clamp(e.y + e.speed * dt, 20, 80);
          e.x += Math.sin(s.gameTime * 0.03) * (1.5 + e.tier * 0.2) * dt;
          e.x = clamp(e.x, 0, W - e.w);
        } else {
          e.movePhase += 0.02 * dt;
          switch (e.movePattern) {
            case 'wave':
              e.y += e.speed * dt; e.x += Math.sin(e.movePhase * 3) * 1.2 * dt; break;
            case 'zigzag':
              e.y += e.speed * dt; e.x += (Math.floor(e.movePhase) % 2 === 0 ? 1.5 : -1.5) * dt; break;
            case 'circle':
              e.y += e.speed * 0.5 * dt; e.x += Math.cos(e.movePhase * 2) * 1.5 * dt; break;
            case 'spiral':
              e.y += e.speed * 0.6 * dt; e.x += Math.sin(e.movePhase * 4) * 2 * dt; break;
            case 'dash':
              e.y += e.speed * (Math.sin(e.movePhase * 5) > 0.7 ? 3 : 0.5) * dt; break;
            case 'orbit':
              e.y += e.speed * 0.3 * dt;
              e.x += Math.cos(e.movePhase * 2.5) * 2.5 * dt; break;
            case 'teleport':
              e.y += e.speed * dt;
              if (Math.random() < 0.003) { e.x = 20 + Math.random() * (W - 40); }
              break;
            case 'swarm':
              e.y += e.speed * dt;
              e.x += Math.sin(e.movePhase * 6 + e.y * 0.1) * 1.5 * dt; break;
            default:
              e.y += e.speed * dt;
          }
          e.x = clamp(e.x, 0, W - e.w);
        }

        // Shooting — uses tier-based patterns
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && e.y > 0) {
          const tier = e.tier;
          const pattern = getEnemyShootPattern(e.type, tier, s.wave);
          e.shootTimer = Math.max(15, (e.type === 'boss' ? 15 : 40) - tier * 2) + Math.random() * 20;
          if (e.type === 'boss') {
            // Boss fires spread based on tier
            const bossN = Math.min(7, 2 + Math.floor(e.variant / 2));
            for (let bi = 0; bi < bossN; bi++) {
              const dx = (bi - (bossN - 1) / 2) * 0.6;
              s.bullets.push({ x: e.x + e.w / 2, y: e.y + e.h, dy: 3.5 + tier * 0.1, dx, isEnemy: true });
            }
          } else {
            for (let bi = 0; bi < pattern.bulletCount; bi++) {
              s.bullets.push({
                x: e.x + e.w / 2 + (bi - (pattern.bulletCount - 1) / 2) * 4,
                y: e.y + e.h,
                dy: pattern.bulletSpeed,
                dx: pattern.bulletDx[bi] || 0,
                isEnemy: true,
              });
            }
          }
        }

        // Collision with player
        if (s.invincible <= 0 &&
          s.player.x + PLAYER_W > e.x && s.player.x < e.x + e.w &&
          s.player.y + PLAYER_H > e.y && s.player.y < e.y + e.h) {
          if (s.shieldActive > 0) {
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

        if (e.y > H + 20 && e.type !== 'boss') {
          e.y = -(20 + Math.random() * 100);
          e.x = 20 + Math.random() * (W - 40);
        }
      }

      // ── Missile system (auto-fire when available) ──
      if (s.missileCount > 0 && s.enemies.length > 0) {
        s.missileFireTimer -= dt;
        if (s.missileFireTimer <= 0) {
          const shouldFireMissile = updateMissileBaseAnim(true);
          if (shouldFireMissile) {
            const px = s.player.x + PLAYER_W / 2, py = s.player.y + PLAYER_H / 2;
            let bestIdx = -1, bestHp = -1;
            for (let i = 0; i < s.enemies.length; i++) {
              const e = s.enemies[i];
              if (e.spawnDelay > 0) continue;
              if (e.hp > bestHp) { bestHp = e.hp; bestIdx = i; }
            }
            if (bestIdx >= 0) {
              const e = s.enemies[bestIdx];
              const dx = (e.x + e.w / 2) - px, dy = (e.y + e.h / 2) - py;
              s.missiles.push({
                x: px, y: py,
                targetId: bestIdx,
                speed: 4,
                angle: Math.atan2(dy, dx),
                life: 180,
              });
              s.missileCount--;
              s.missileFireTimer = MISSILE_FIRE_RATE;
              soundsRef.current.playShoot();
            }
          }
        }
      } else {
        updateMissileBaseAnim(false);
      }

      // Update missiles (always, regardless of missileCount)
      for (let i = s.missiles.length - 1; i >= 0; i--) {
        const m = s.missiles[i];
        m.life -= dt;
        if (m.life <= 0) { s.missiles.splice(i, 1); continue; }
        let tx = m.x + Math.cos(m.angle) * 100, ty = m.y + Math.sin(m.angle) * 100;
        if (s.enemies.length > 0) {
          let best = -1, bestHp = -1;
          for (let j = 0; j < s.enemies.length; j++) {
            const e = s.enemies[j];
            if (e.spawnDelay > 0) continue;
            if (e.hp > bestHp) { bestHp = e.hp; best = j; }
          }
          if (best >= 0) {
            tx = s.enemies[best].x + s.enemies[best].w / 2;
            ty = s.enemies[best].y + s.enemies[best].h / 2;
          }
        }
        const desired = Math.atan2(ty - m.y, tx - m.x);
        let diff = desired - m.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        m.angle += Math.sign(diff) * Math.min(Math.abs(diff), 0.12 * dt);
        m.x += Math.cos(m.angle) * m.speed * dt;
        m.y += Math.sin(m.angle) * m.speed * dt;
        if (m.x < -20 || m.x > W + 20 || m.y < -20 || m.y > H + 20) { s.missiles.splice(i, 1); continue; }
        for (let j = s.enemies.length - 1; j >= 0; j--) {
          const e = s.enemies[j];
          if (e.spawnDelay > 0) continue;
          if (m.x > e.x && m.x < e.x + e.w && m.y > e.y && m.y < e.y + e.h) {
            e.hp -= 2;
            s.missiles.splice(i, 1);
            spawnParticles(m.x, m.y, 12, ['#ff8800', '#ffcc00', '#ff3300']);
            if (e.hp <= 0) {
              s.score += getEnemyScore(e.type);
              s.enemiesLeftInWave--;
              const pCount = e.type === 'boss' ? 50 : 20;
              spawnParticles(e.x + e.w / 2, e.y + e.h / 2, pCount, explosionColors);
              spawnPowerUp(e.x + e.w / 2, e.y + e.h / 2, e.type);
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

      // ── Power-up update & pickup ──
      const px = s.player.x + PLAYER_W / 2, py = s.player.y + PLAYER_H / 2;
      for (let i = s.powerUps.length - 1; i >= 0; i--) {
        const pu = s.powerUps[i];
        pu.y += pu.vy * dt;
        pu.life -= dt;
        if (pu.y > H + 20 || pu.life <= 0) { s.powerUps.splice(i, 1); continue; }
        const dx = pu.x - px, dy = pu.y - py;
        if (Math.abs(dx) < 18 && Math.abs(dy) < 18) {
          s.powerUps.splice(i, 1);
          switch (pu.type) {
            case 'upgrade':
              if (s.upgradeLevel < 15) {
                s.upgradeLevel++;
                const newInfo = getUpgradeInfo(s.upgradeLevel);
                // Grant rockets when entering rocket stage
                if (newInfo.rockets > 0 && getUpgradeInfo(s.upgradeLevel - 1).rockets < newInfo.rockets) {
                  s.missileCount = Math.min(s.missileCount + 1, MAX_MISSILES);
                }
              }
              break;
            case 'shield':
              // Shield 10 sec (600 frames). Collecting again refills to 10 sec.
              s.shieldActive = 600;
              break;
          }
          spawnParticles(pu.x, pu.y, 10, ['#ffffff', '#ffcc00', '#00ffff']);
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
      if (s.missileCount > 0) drawMissileBase(ctx, s);
      drawPlayer(ctx, Math.floor(s.player.x), Math.floor(s.player.y), s.invincible, s.gameTime, s.shieldActive, s.lives, s.maxLives);
      drawHelperPlanes(ctx, s);
      drawBullets(ctx, s);
      drawLaserBeams(ctx, s);
      drawMissiles(ctx, s);
      drawPowerUps(ctx, s.powerUps, s.gameTime);
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
          {gameSettings?.game_enabled === false ? (
            <div className="pixel-frame p-5 space-y-3 w-full">
              <p className="text-muted-foreground font-mono">اللعبة غير متاحة حالياً</p>
              <Button variant="ghost" onClick={onBack} className="font-mono text-xs">
                <ArrowRight className="h-4 w-4 ml-1" /> رجوع
              </Button>
            </div>
          ) : (
            <div className="pixel-frame p-5 space-y-3 w-full">
              <div className="text-5xl mb-1">🚀</div>
              <h2 className="text-2xl font-black font-mono text-primary" style={{ textShadow: '2px 2px 0 hsl(var(--accent) / 0.4)' }}>
                SPACE BLASTER
              </h2>
              <p className="text-muted-foreground text-sm font-mono">حرب الفضاء</p>
              <div className="space-y-1 text-xs text-muted-foreground font-mono text-right" dir="rtl">
                <p>🌍 13 كوكب | 260 موجة</p>
                <p>🎮 أسهم/WASD + مسافة | لمس</p>
                <p>⭐ اجمع الترقيات لتقوية سفينتك</p>
                <p>❤️ 5 حياة | 🛡 درع 10 ثواني</p>
                {entryFee > 0 && (
                  <p className="flex items-center justify-end gap-1">
                    <Ticket className="h-3 w-3" /> رسوم الدخول: {entryFee} تذكرة
                    <span className={userTickets >= entryFee ? "text-green-400" : "text-destructive"}>
                      ({userTickets} متاح)
                    </span>
                  </p>
                )}
              </div>
              <Button
                onClick={() => { playClick(); startGame(); }}
                disabled={!user || (entryFee > 0 && userTickets < entryFee)}
                className="pixel-btn-active font-mono text-sm w-full"
              >
                {entryFee > 0 ? `▶ START (${entryFee} 🎫)` : '▶ START'}
              </Button>
              {!user && (
                <p className="text-xs text-destructive font-mono">يجب تسجيل الدخول للعب</p>
              )}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground font-mono text-xs">
            <ArrowRight className="h-4 w-4" /> رجوع
          </Button>
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
            <Button variant="ghost" onClick={onBack} className="font-mono text-xs w-full">رجوع</Button>
          </div>
        </div>
      )}
    </div>
  );
}
