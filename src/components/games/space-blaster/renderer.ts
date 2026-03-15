import { Enemy, GameState, Particle, Star, W, H, PLAYER_W, PLAYER_H, BULLET_W, BULLET_H, MAX_WAVES, MAX_MISSILES, PowerUp, LaserBeam } from './types';
import { drawProceduralEnemy, drawBoss as drawBossEnemy } from './enemyRenderer';
import missileSrc from '@/assets/missile-sprite.png';
import missileBaseSrc from '@/assets/missile-base-sprite.png';
import { getPlanetForWave, PLANETS } from './planets';
import playerShipSrc from '@/assets/player-ship.png';
import shipDmg1Src from '@/assets/ship-damage-1.png';
import shipDmg2Src from '@/assets/ship-damage-2.png';
import shipDmg3Src from '@/assets/ship-damage-3.png';
import engineNormalSrc from '@/assets/engine-normal.png';
import engineSuperSrc from '@/assets/engine-supercharge.png';
import shieldAnimSrc from '@/assets/shield-anim.png';

// ── Load player ship images (4 states: healthy → 3 damage levels) ──
const shipImages: HTMLImageElement[] = [];
for (const src of [playerShipSrc, shipDmg1Src, shipDmg2Src, shipDmg3Src]) {
  const img = new Image();
  img.src = src;
  shipImages.push(img);
}

// ── Load engine sprite sheets (4 frames each) ──
const engineNormalImg = new Image();
engineNormalImg.src = engineNormalSrc;
const engineSuperImg = new Image();
engineSuperImg.src = engineSuperSrc;
const ENGINE_FRAMES = 4;
const ENGINE_ANIM_SPEED = 6;

// ── Load shield sprite sheet (10 frames, horizontal strip) ──
const shieldAnimImg = new Image();
shieldAnimImg.src = shieldAnimSrc;
const SHIELD_FRAMES = 10;
const SHIELD_ANIM_SPEED = 6;

const PLAYER_COLOR = '#00e5ff';

export function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, t: number, planetId: number) {
  if (e.spawnDelay > 0) return;
  if (e.type === 'boss') {
    drawBossEnemy(ctx, e, t);
  } else {
    drawProceduralEnemy(ctx, e, t);
  }
}

export function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, inv: number, t: number, shieldActive: number, lives: number = 5, maxLives: number = 5) {
  if (inv > 0 && Math.floor(inv / 4) % 2 === 0) return;
  ctx.save();
  let dmgIndex = 0;
  const ratio = lives / maxLives;
  if (ratio <= 0.25) dmgIndex = 3;
  else if (ratio <= 0.5) dmgIndex = 2;
  else if (ratio <= 0.75) dmgIndex = 1;

  const shipW = PLAYER_W + 8;
  const shipH = PLAYER_H + 8;
  const drawX = x - 4;
  const drawY = y - 4;

  const isSupercharge = shieldActive > 0;
  const spriteSheet = isSupercharge ? engineSuperImg : engineNormalImg;
  if (spriteSheet.complete && spriteSheet.naturalWidth > 0) {
    const frameW = Math.round(spriteSheet.naturalWidth / ENGINE_FRAMES);
    const frameH = spriteSheet.naturalHeight;
    const frameIndex = Math.floor(t / ENGINE_ANIM_SPEED) % ENGINE_FRAMES;
    const engineW = shipW * 0.5;
    const engineH = engineW * (frameH / frameW);
    const engineX = drawX + (shipW - engineW) / 2;
    const engineY = drawY + shipH - engineH;
    ctx.drawImage(
      spriteSheet,
      frameIndex * frameW, 0, frameW, frameH,
      Math.round(engineX), Math.round(engineY), Math.round(engineW), Math.round(engineH)
    );
  }

  const img = shipImages[Math.min(dmgIndex, shipImages.length - 1)];
  if (img.complete && img.naturalWidth > 0) {
    ctx.shadowColor = PLAYER_COLOR;
    ctx.shadowBlur = 10;
    ctx.drawImage(img, drawX, drawY, shipW, shipH);
  }
  ctx.restore();

  if (shieldActive > 0) {
    ctx.save();
    if (shieldAnimImg.complete && shieldAnimImg.naturalWidth > 0) {
      const sFrameW = Math.round(shieldAnimImg.naturalWidth / SHIELD_FRAMES);
      const sFrameH = shieldAnimImg.naturalHeight;
      const sFrameIndex = Math.floor(t / SHIELD_ANIM_SPEED) % SHIELD_FRAMES;
      const shieldSize = shipW + 20;
      const sx = drawX + (shipW - shieldSize) / 2;
      const sy = drawY + (shipH - shieldSize) / 2;
      ctx.globalAlpha = 0.75 + Math.sin(t * 0.15) * 0.2;
      ctx.drawImage(
        shieldAnimImg,
        sFrameIndex * sFrameW, 0, sFrameW, sFrameH,
        Math.round(sx), Math.round(sy), Math.round(shieldSize), Math.round(shieldSize)
      );
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

export function drawBackground(ctx: CanvasRenderingContext2D, s: GameState) {
  const planet = getPlanetForWave(s.wave);
  ctx.fillStyle = planet.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = planet.nebulaColor;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(0, H * 0.3, W, H * 0.4);
  ctx.globalAlpha = 1;
  for (const star of s.stars) {
    ctx.globalAlpha = star.brightness;
    ctx.fillStyle = star.size > 1 ? planet.starColor2 : planet.starColor1;
    ctx.fillRect(Math.floor(star.x), Math.floor(star.y), star.size, star.size);
  }
  ctx.globalAlpha = 1;
}

export function drawBullets(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const b of s.bullets) {
    if (b.isLaser) {
      ctx.fillStyle = '#00ff88';
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 6;
      ctx.fillRect(Math.floor(b.x), Math.floor(b.y), 2, 12);
    } else {
      ctx.fillStyle = b.isEnemy ? '#ff6644' : '#ffff00';
      ctx.shadowColor = b.isEnemy ? '#ff6644' : '#ffff00';
      ctx.shadowBlur = 4;
      ctx.fillRect(Math.floor(b.x), Math.floor(b.y), BULLET_W, BULLET_H);
    }
  }
  ctx.shadowBlur = 0;
}

export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// Helper to get upgrade stage description
function getUpgradeInfo(level: number): { shootBullets: number; laserLevel: number; rockets: number; helpers: number } {
  if (level <= 0) return { shootBullets: 1, laserLevel: 0, rockets: 0, helpers: 0 };
  if (level <= 2) return { shootBullets: 1 + level, laserLevel: 0, rockets: 0, helpers: 0 };
  if (level <= 7) return { shootBullets: 3, laserLevel: level - 2, rockets: 0, helpers: 0 };
  if (level <= 13) return { shootBullets: 3, laserLevel: 5, rockets: level - 7, helpers: 0 };
  return { shootBullets: 3, laserLevel: 5, rockets: 6, helpers: Math.min(level - 13, 2) };
}

export function drawHUD(ctx: CanvasRenderingContext2D, s: GameState) {
  const planet = getPlanetForWave(s.wave);
  ctx.fillStyle = '#00e5ff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  // Hearts display
  let hearts = '';
  for (let i = 0; i < s.maxLives; i++) hearts += i < s.lives ? '♥' : '♡';
  ctx.fillText(hearts, 8, 18);
  ctx.textAlign = 'center';
  ctx.fillText(`${planet.nameAr} | W${s.wave}/${MAX_WAVES}`, W / 2, 18);
  ctx.textAlign = 'right';
  ctx.fillText(`★ ${s.score}`, W - 8, 18);

  // Shield timer
  ctx.textAlign = 'left';
  if (s.shieldActive > 0) {
    ctx.fillStyle = '#00ffff';
    ctx.fillText(`🛡 ${Math.ceil(s.shieldActive / 60)}s`, 8, 34);
  }

  // Upgrade level indicator
  const info = getUpgradeInfo(s.upgradeLevel);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffcc00';
  let upgradeText = `🔫×${info.shootBullets}`;
  if (info.laserLevel > 0) upgradeText += ` ⚡L${info.laserLevel}`;
  if (info.rockets > 0) upgradeText += ` 🚀${info.rockets}`;
  if (info.helpers > 0) upgradeText += ` ✈${info.helpers}`;
  ctx.fillText(upgradeText, W / 2, 34);

  // Missile count
  if (s.missileCount > 0) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff8800';
    ctx.fillText(`🚀 ${s.missileCount}/${MAX_MISSILES}`, W - 8, 34);
  }
}

export function drawPowerUps(ctx: CanvasRenderingContext2D, powerUps: PowerUp[], t: number) {
  for (const p of powerUps) {
    ctx.save();
    const pulse = 0.8 + Math.sin(t * 0.15) * 0.2;
    ctx.globalAlpha = pulse;
    const size = 14;
    const cx = p.x, cy = p.y;
    let color = '#ffcc00';
    let icon = '⬆';
    if (p.type === 'shield') { color = '#00ffff'; icon = '🛡'; }
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size / 2);
    ctx.lineTo(cx + size / 2, cy);
    ctx.lineTo(cx, cy + size / 2);
    ctx.lineTo(cx - size / 2, cy);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, cx, cy);
    ctx.restore();
  }
}

export function drawHelperPlanes(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const hp of s.helperPlanes) {
    ctx.save();
    ctx.shadowColor = '#00ccff';
    ctx.shadowBlur = 4;
    // Small triangle ship
    const cx = hp.x, cy = hp.y;
    ctx.fillStyle = '#0088cc';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx - 5, cy + 4);
    ctx.lineTo(cx + 5, cy + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#00ccff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx - 3, cy + 2);
    ctx.lineTo(cx + 3, cy + 2);
    ctx.closePath();
    ctx.fill();
    // Engine glow
    ctx.fillStyle = '#00ffff';
    ctx.globalAlpha = 0.5 + Math.sin(s.gameTime * 0.3) * 0.3;
    ctx.fillRect(cx - 1, cy + 4, 2, 3);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

export function drawScreenFlash(ctx: CanvasRenderingContext2D, flash: number) {
  if (flash > 0) {
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = Math.min(flash / 15, 0.6);
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

export function drawWaveTransition(ctx: CanvasRenderingContext2D, s: GameState) {
  if (s.waveDelay > 0 && s.enemiesLeftInWave <= 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    if (s.wave >= MAX_WAVES) {
      ctx.fillText('🏆 VICTORY!', W / 2, H / 2);
    } else {
      const nextPlanet = getPlanetForWave(s.wave + 1);
      const curPlanet = getPlanetForWave(s.wave);
      if (nextPlanet.id !== curPlanet.id) {
        ctx.fillText(`🌍 ${nextPlanet.nameAr}`, W / 2, H / 2 - 15);
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`الكوكب التالي...`, W / 2, H / 2 + 15);
      } else {
        ctx.fillText(`WAVE ${s.wave + 1} INCOMING...`, W / 2, H / 2);
      }
    }
  }
}

// ── Missile sprite ──
const missileImg = new Image();
missileImg.src = missileSrc;
const MISSILE_SPRITE_FRAMES = 3;
const MISSILE_ANIM_SPEED = 6;

// ── Missile base sprite ──
const missileBaseImg = new Image();
missileBaseImg.src = missileBaseSrc;
let missileBaseFrameW = 0;
let missileBaseTotalFrames = 0;

function calcMissileBaseFrames() {
  if (missileBaseImg.naturalWidth > 0 && missileBaseImg.naturalHeight > 0) {
    const frameH = missileBaseImg.naturalHeight;
    missileBaseTotalFrames = Math.round(missileBaseImg.naturalWidth / frameH) || 1;
    missileBaseFrameW = Math.round(missileBaseImg.naturalWidth / missileBaseTotalFrames);
  }
}
missileBaseImg.onload = calcMissileBaseFrames;
if (missileBaseImg.complete && missileBaseImg.naturalWidth > 0) {
  calcMissileBaseFrames();
}
const MISSILE_BASE_ANIM_SPEED = 6;

let missileBaseLaunchFrame = 0;
let missileBaseLaunchTimer = 0;
let missileBaseWasFiring = false;
let missileBasePairIndex = -1;
const MISSILE_LAUNCH_PAIRS = () => Math.max(0, Math.floor((missileBaseTotalFrames - 2) / 2));

export function updateMissileBaseAnim(isFiring: boolean): boolean {
  if (isFiring && !missileBaseWasFiring) {
    missileBaseLaunchFrame = 0;
    missileBaseLaunchTimer = 0;
    missileBasePairIndex = -1;
  }
  missileBaseWasFiring = isFiring;
  if (!isFiring) return false;

  missileBaseLaunchTimer++;
  let shouldFire = false;
  if (missileBaseLaunchTimer >= MISSILE_BASE_ANIM_SPEED) {
    missileBaseLaunchTimer = 0;
    missileBaseLaunchFrame++;

    const launchPairs = MISSILE_LAUNCH_PAIRS();
    if (missileBaseLaunchFrame >= 2) {
      const launchIdx = missileBaseLaunchFrame - 2;
      const newPair = Math.floor(launchIdx / 2);
      if (newPair !== missileBasePairIndex && newPair < launchPairs) {
        missileBasePairIndex = newPair;
        shouldFire = true;
      }
      if (launchIdx >= launchPairs * 2) {
        missileBaseLaunchFrame = 0;
        missileBasePairIndex = -1;
      }
    }
  }
  return shouldFire;
}

export function drawMissiles(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const m of s.missiles) {
    ctx.save();
    ctx.translate(Math.round(m.x), Math.round(m.y));
    ctx.rotate(m.angle + Math.PI / 2);

    if (missileImg.complete && missileImg.naturalWidth > 0) {
      const frameW = Math.round(missileImg.naturalWidth / MISSILE_SPRITE_FRAMES);
      const frameH = missileImg.naturalHeight;
      const frameIndex = Math.floor(s.gameTime / MISSILE_ANIM_SPEED) % MISSILE_SPRITE_FRAMES;
      const drawW = 14;
      const drawH = drawW * (frameH / frameW);
      ctx.drawImage(
        missileImg,
        frameIndex * frameW, 0, frameW, frameH,
        Math.round(-drawW / 2), Math.round(-drawH / 2), Math.round(drawW), Math.round(drawH)
      );
    } else {
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(-3, 4);
      ctx.lineTo(3, 4);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#ff6600';
    ctx.globalAlpha = 0.6;
    ctx.fillRect(-1, 4, 2, 3 + Math.random() * 3);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

export function drawMissileBase(ctx: CanvasRenderingContext2D, s: GameState) {
  if (s.missileCount <= 0) return;
  if (!missileBaseImg.complete || missileBaseImg.naturalWidth <= 0) return;
  if (missileBaseTotalFrames < 2) calcMissileBaseFrames();
  if (missileBaseTotalFrames < 2) return;

  const isFiring = s.missileCount > 0 && s.enemies.length > 0;
  const cx = s.player.x + PLAYER_W / 2;
  const cy = s.player.y + PLAYER_H / 2;
  const baseRadius = PLAYER_W + 6;
  const drawSize = baseRadius * 2 + 8;
  const frameH = missileBaseImg.naturalHeight;

  if (isFiring) {
    let frameIndex: number;
    const launchPairs = MISSILE_LAUNCH_PAIRS();
    if (missileBaseLaunchFrame < 2) {
      frameIndex = missileBaseLaunchFrame;
    } else {
      const launchIdx = missileBaseLaunchFrame - 2;
      frameIndex = launchIdx < launchPairs * 2 ? 2 + launchIdx : 0;
    }
    frameIndex = Math.min(frameIndex, missileBaseTotalFrames - 1);
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.drawImage(
      missileBaseImg,
      frameIndex * missileBaseFrameW, 0, missileBaseFrameW, frameH,
      Math.round(cx - drawSize / 2), Math.round(cy - drawSize / 2),
      Math.round(drawSize), Math.round(drawSize)
    );
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  if (s.missileCount > 0) {
    for (let i = 0; i < MAX_MISSILES; i++) {
      const angle = (Math.PI * 2 / MAX_MISSILES) * i - Math.PI / 2 + s.gameTime * 0.02;
      const ix = cx + Math.cos(angle) * (baseRadius + 2);
      const iy = cy + Math.sin(angle) * (baseRadius + 2);
      ctx.fillStyle = i < s.missileCount ? '#ff8800' : '#333333';
      ctx.fillRect(Math.round(ix - 1.5), Math.round(iy - 1.5), 3, 3);
    }
  }
}
