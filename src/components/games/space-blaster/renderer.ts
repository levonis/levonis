import { Enemy, GameState, Particle, Star, W, H, PLAYER_W, PLAYER_H, BULLET_W, BULLET_H, MAX_WAVES, MAX_MISSILES, PowerUp } from './types';
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
const ENGINE_ANIM_SPEED = 6; // ticks per frame

// ── Load shield sprite sheet (10 frames, horizontal strip) ──
const shieldAnimImg = new Image();
shieldAnimImg.src = shieldAnimSrc;
const SHIELD_FRAMES = 10;
const SHIELD_ANIM_SPEED = 6;

// ── Enemy Colors by type ──
const ENEMY_COLORS: Record<string, { main: string; dark: string; glow: string; eye: string }> = {
  drone:   { main: '#ff3d3d', dark: '#aa1111', glow: '#ff3d3d', eye: '#ff0000' },
  fighter: { main: '#ff8800', dark: '#aa4400', glow: '#ff6600', eye: '#ffcc00' },
  tank:    { main: '#44aaff', dark: '#225588', glow: '#44aaff', eye: '#00ffff' },
  speeder: { main: '#00ff88', dark: '#008844', glow: '#00ff88', eye: '#88ffcc' },
  bomber:  { main: '#ff44ff', dark: '#882288', glow: '#ff44ff', eye: '#ff88ff' },
  boss:    { main: '#b040ff', dark: '#6a1fb0', glow: '#b040ff', eye: '#ff0000' },
};

const PLAYER_COLOR = '#00e5ff';
const PLAYER_DARK = '#0088aa';

// Old pixel ship removed — sprite images are used exclusively now

function drawDrone(ctx: CanvasRenderingContext2D, e: Enemy, t: number) {
  const c = ENEMY_COLORS.drone;
  ctx.save();
  ctx.shadowColor = c.glow; ctx.shadowBlur = 6;
  // Hex body
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2, r = e.w / 2;
  ctx.fillStyle = c.dark;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i - Math.PI / 6;
    const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
  // Core
  ctx.fillStyle = c.main;
  ctx.fillRect(cx - 3, cy - 3, 6, 6);
  // Blinking eye
  ctx.fillStyle = c.eye;
  ctx.fillRect(cx - 1, cy - 1, 2 + (Math.sin(t * 0.2) > 0.5 ? 1 : 0), 2);
  // Wing antennas
  const wingY = Math.sin(t * 0.15) * 2;
  ctx.fillStyle = c.dark;
  ctx.fillRect(e.x - 2, cy - 1 + wingY, 3, 2);
  ctx.fillRect(e.x + e.w - 1, cy - 1 - wingY, 3, 2);
  ctx.restore();
}

function drawFighter(ctx: CanvasRenderingContext2D, e: Enemy, t: number) {
  const c = ENEMY_COLORS.fighter;
  ctx.save();
  ctx.shadowColor = c.glow; ctx.shadowBlur = 8;
  const cx = e.x + e.w / 2;
  // Triangle body
  ctx.fillStyle = c.dark;
  ctx.beginPath();
  ctx.moveTo(cx, e.y);
  ctx.lineTo(e.x, e.y + e.h);
  ctx.lineTo(e.x + e.w, e.y + e.h);
  ctx.closePath(); ctx.fill();
  // Inner armor
  ctx.fillStyle = c.main;
  ctx.beginPath();
  ctx.moveTo(cx, e.y + 4);
  ctx.lineTo(e.x + 4, e.y + e.h - 2);
  ctx.lineTo(e.x + e.w - 4, e.y + e.h - 2);
  ctx.closePath(); ctx.fill();
  // Side guns
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(e.x - 1, e.y + e.h - 6, 3, 6);
  ctx.fillRect(e.x + e.w - 2, e.y + e.h - 6, 3, 6);
  // Engine glow
  ctx.fillStyle = c.glow;
  ctx.globalAlpha = 0.5 + Math.sin(t * 0.3) * 0.3;
  ctx.fillRect(cx - 2, e.y + 2, 4, 3);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawTank(ctx: CanvasRenderingContext2D, e: Enemy, _t: number) {
  const c = ENEMY_COLORS.tank;
  ctx.save();
  ctx.shadowColor = c.glow; ctx.shadowBlur = 8;
  // Heavy body
  ctx.fillStyle = c.dark;
  ctx.fillRect(e.x, e.y, e.w, e.h);
  ctx.fillStyle = c.main;
  ctx.fillRect(e.x + 2, e.y + 2, e.w - 4, e.h - 4);
  // Armor plates
  ctx.fillStyle = c.dark;
  ctx.fillRect(e.x + 4, e.y + 4, e.w - 8, 3);
  ctx.fillRect(e.x + 4, e.y + e.h - 7, e.w - 8, 3);
  // Cannon
  ctx.fillStyle = '#88ccff';
  ctx.fillRect(e.x + e.w / 2 - 2, e.y + e.h - 2, 4, 6);
  // Eye
  ctx.fillStyle = c.eye;
  ctx.fillRect(e.x + e.w / 2 - 2, e.y + e.h / 2 - 2, 4, 4);
  // HP bar
  const ratio = e.hp / e.maxHp;
  ctx.fillStyle = '#222';
  ctx.fillRect(e.x, e.y - 5, e.w, 3);
  ctx.fillStyle = ratio > 0.5 ? '#00ff00' : ratio > 0.25 ? '#ffff00' : '#ff0000';
  ctx.fillRect(e.x, e.y - 5, e.w * ratio, 3);
  ctx.restore();
}

function drawSpeeder(ctx: CanvasRenderingContext2D, e: Enemy, t: number) {
  const c = ENEMY_COLORS.speeder;
  ctx.save();
  ctx.shadowColor = c.glow; ctx.shadowBlur = 6;
  const cx = e.x + e.w / 2;
  // Slim diamond
  ctx.fillStyle = c.main;
  ctx.beginPath();
  ctx.moveTo(cx, e.y);
  ctx.lineTo(e.x + e.w, e.y + e.h / 2);
  ctx.lineTo(cx, e.y + e.h);
  ctx.lineTo(e.x, e.y + e.h / 2);
  ctx.closePath(); ctx.fill();
  // Trail
  ctx.fillStyle = c.glow;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(cx - 1, e.y - 4 - Math.random() * 3, 2, 4);
  ctx.globalAlpha = 1;
  // Eye
  ctx.fillStyle = c.eye;
  ctx.fillRect(cx - 1, e.y + e.h / 2 - 1, 2, 2);
  ctx.restore();
}

function drawBomber(ctx: CanvasRenderingContext2D, e: Enemy, t: number) {
  const c = ENEMY_COLORS.bomber;
  ctx.save();
  ctx.shadowColor = c.glow; ctx.shadowBlur = 8;
  // Wide body
  ctx.fillStyle = c.dark;
  ctx.fillRect(e.x, e.y + 4, e.w, e.h - 4);
  ctx.fillStyle = c.main;
  ctx.fillRect(e.x + 2, e.y + 2, e.w - 4, e.h - 4);
  // Bomb bay (pulsing)
  ctx.fillStyle = '#ff00ff';
  ctx.globalAlpha = 0.5 + Math.sin(t * 0.2) * 0.4;
  ctx.fillRect(e.x + e.w / 2 - 3, e.y + e.h - 4, 6, 4);
  ctx.globalAlpha = 1;
  // Side engines
  ctx.fillStyle = '#ff88ff';
  ctx.fillRect(e.x - 2, e.y + 6, 3, 4);
  ctx.fillRect(e.x + e.w - 1, e.y + 6, 3, 4);
  ctx.restore();
}

function drawBoss(ctx: CanvasRenderingContext2D, e: Enemy, t: number, planetId: number) {
  const colors = [
    { main: '#4488ff', dark: '#224488', core: '#00ffff' },
    { main: '#ff6600', dark: '#aa3300', core: '#ffcc00' },
    { main: '#aa44ff', dark: '#662299', core: '#ff00ff' },
    { main: '#ff2222', dark: '#880000', core: '#ffff00' },
  ];
  const c = colors[(planetId - 1) % colors.length];
  ctx.save();
  ctx.shadowColor = c.main; ctx.shadowBlur = 15;
  // Outer hull
  ctx.fillStyle = c.dark;
  ctx.fillRect(e.x, e.y + 8, e.w, e.h - 8);
  ctx.fillRect(e.x + 8, e.y, e.w - 16, e.h);
  // Inner hull
  ctx.fillStyle = c.main;
  ctx.fillRect(e.x + 4, e.y + 12, e.w - 8, e.h - 16);
  ctx.fillRect(e.x + 12, e.y + 4, e.w - 24, e.h - 8);
  // Pulsing cores
  ctx.fillStyle = c.core;
  ctx.globalAlpha = 0.6 + Math.sin(t * 0.1) * 0.4;
  ctx.fillRect(e.x + 10, e.y + 14, 5, 5);
  ctx.fillRect(e.x + e.w - 15, e.y + 14, 5, 5);
  ctx.fillRect(e.x + e.w / 2 - 3, e.y + 24, 6, 6);
  ctx.globalAlpha = 1;
  // Rotating eye
  const eyeX = e.x + e.w / 2 + Math.sin(t * 0.05) * 6;
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(eyeX - 3, e.y + 8, 6, 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(eyeX - 1, e.y + 9, 2, 2);
  // Cannons
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(e.x + 4, e.y + e.h - 2, 4, 6);
  ctx.fillRect(e.x + e.w - 8, e.y + e.h - 2, 4, 6);
  // HP bar
  const ratio = e.hp / e.maxHp;
  ctx.fillStyle = '#111';
  ctx.fillRect(e.x, e.y - 7, e.w, 4);
  ctx.fillStyle = ratio > 0.5 ? '#00ff00' : ratio > 0.25 ? '#ffff00' : '#ff0000';
  ctx.fillRect(e.x, e.y - 7, e.w * ratio, 4);
  ctx.restore();
}

export function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, t: number, planetId: number) {
  if (e.spawnDelay > 0) return;
  switch (e.type) {
    case 'drone':   drawDrone(ctx, e, t); break;
    case 'fighter': drawFighter(ctx, e, t); break;
    case 'tank':    drawTank(ctx, e, t); break;
    case 'speeder': drawSpeeder(ctx, e, t); break;
    case 'bomber':  drawBomber(ctx, e, t); break;
    case 'boss':    drawBoss(ctx, e, t, planetId); break;
  }
}

export function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, inv: number, t: number, shieldActive: number, lives: number = 3, maxLives: number = 3) {
  if (inv > 0 && Math.floor(inv / 4) % 2 === 0) return;
  ctx.save();
  // Pick damage stage
  let dmgIndex = 0;
  const ratio = lives / maxLives;
  if (ratio <= 0.25) dmgIndex = 3;
  else if (ratio <= 0.5) dmgIndex = 2;
  else if (ratio <= 0.75) dmgIndex = 1;

  const shipW = PLAYER_W + 8;
  const shipH = PLAYER_H + 8;
  const drawX = x - 4;
  const drawY = y - 4;

  // ── Engine animation (frame-based, exits from ship bottom) ──
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

  // ── Ship sprite ──
  const img = shipImages[Math.min(dmgIndex, shipImages.length - 1)];
  if (img.complete && img.naturalWidth > 0) {
    ctx.shadowColor = PLAYER_COLOR;
    ctx.shadowBlur = 10;
    ctx.drawImage(img, drawX, drawY, shipW, shipH);
  }
  ctx.restore();

  // ── Shield animation (frame-based sprite sheet) ──
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
  // Background
  ctx.fillStyle = planet.bg;
  ctx.fillRect(0, 0, W, H);
  // Nebula effect
  ctx.fillStyle = planet.nebulaColor;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(0, H * 0.3, W, H * 0.4);
  ctx.globalAlpha = 1;
  // Stars
  for (const star of s.stars) {
    ctx.globalAlpha = star.brightness;
    ctx.fillStyle = star.size > 1 ? planet.starColor2 : planet.starColor1;
    ctx.fillRect(Math.floor(star.x), Math.floor(star.y), star.size, star.size);
  }
  ctx.globalAlpha = 1;
}

export function drawBullets(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const b of s.bullets) {
    ctx.fillStyle = b.isEnemy ? '#ff6644' : '#ffff00';
    ctx.shadowColor = b.isEnemy ? '#ff6644' : '#ffff00';
    ctx.shadowBlur = 4;
    ctx.fillRect(Math.floor(b.x), Math.floor(b.y), BULLET_W, BULLET_H);
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

export function drawHUD(ctx: CanvasRenderingContext2D, s: GameState) {
  const planet = getPlanetForWave(s.wave);
  ctx.fillStyle = '#00e5ff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`♥ ${s.lives}`, 8, 18);
  ctx.textAlign = 'center';
  ctx.fillText(`${planet.nameAr} | W${s.wave}/${MAX_WAVES}`, W / 2, 18);
  ctx.textAlign = 'right';
  ctx.fillText(`★ ${s.score}`, W - 8, 18);
  // Shield info
  ctx.textAlign = 'left';
  if (s.shieldActive > 0) {
    ctx.fillStyle = '#00ffff';
    ctx.fillText(`🛡 ${Math.ceil(s.shieldActive / 60)}s`, 8, 34);
    if (s.shieldInventory > 0) {
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText(`+${s.shieldInventory}`, 70, 34);
    }
  } else if (s.shieldInventory > 0) {
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(`🛡 ×${s.shieldInventory}`, 8, 34);
  }
  // Fire rate boost indicator
  if (s.fireRateBoost > 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffcc00';
    ctx.fillText(`⚡×${s.fireRateBoost}`, W / 2, 34);
  }
  // Missile info
  if (s.missileBaseActive) {
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
    // Glow
    let color = '#ffcc00';
    let icon = '⚡';
    if (p.type === 'missile') { color = '#ff8800'; icon = '🚀'; }
    else if (p.type === 'shield') { color = '#00ffff'; icon = '🛡'; }
    else { color = '#ffcc00'; icon = '⚡'; }
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    // Background diamond
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size / 2);
    ctx.lineTo(cx + size / 2, cy);
    ctx.lineTo(cx, cy + size / 2);
    ctx.lineTo(cx - size / 2, cy);
    ctx.closePath();
    ctx.fill();
    // Icon
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
const MISSILE_SPRITE_FRAMES = 3; // 3 frames in horizontal strip
const MISSILE_ANIM_SPEED = 6;

// ── Missile base sprite ──
const missileBaseImg = new Image();
missileBaseImg.src = missileBaseSrc;
// The base sprite sheet has multiple frames in horizontal strip
let missileBaseFrames = 0; // computed on load
missileBaseImg.onload = () => {
  // Estimate frames: assume square-ish frames
  const frameH = missileBaseImg.naturalHeight;
  missileBaseFrames = Math.round(missileBaseImg.naturalWidth / frameH) || 1;
};
const MISSILE_BASE_ANIM_SPEED = 8;

export function drawMissiles(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const m of s.missiles) {
    ctx.save();
    ctx.translate(Math.round(m.x), Math.round(m.y));
    ctx.rotate(m.angle + Math.PI / 2); // rotate so sprite points in direction of travel

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
      // Fallback: simple triangle
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(-3, 4);
      ctx.lineTo(3, 4);
      ctx.closePath();
      ctx.fill();
    }

    // Trail particles
    ctx.fillStyle = '#ff6600';
    ctx.globalAlpha = 0.6;
    ctx.fillRect(-1, 4, 2, 3 + Math.random() * 3);
    ctx.globalAlpha = 1;

    ctx.restore();
  }
}

export function drawMissileBase(ctx: CanvasRenderingContext2D, s: GameState) {
  if (!s.missileBaseActive) return;

  const cx = s.player.x + PLAYER_W / 2;
  const cy = s.player.y + PLAYER_H / 2;
  const baseRadius = PLAYER_W + 6;

  if (missileBaseImg.complete && missileBaseImg.naturalWidth > 0 && missileBaseFrames > 0) {
    const frameW = Math.round(missileBaseImg.naturalWidth / missileBaseFrames);
    const frameH = missileBaseImg.naturalHeight;
    const frameIndex = Math.floor(s.gameTime / MISSILE_BASE_ANIM_SPEED) % missileBaseFrames;
    const drawSize = baseRadius * 2 + 8;

    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.drawImage(
      missileBaseImg,
      frameIndex * frameW, 0, frameW, frameH,
      Math.round(cx - drawSize / 2), Math.round(cy - drawSize / 2),
      Math.round(drawSize), Math.round(drawSize)
    );
    ctx.globalAlpha = 1;
    ctx.restore();
  } else {
    // Fallback: rotating ring of dots
    ctx.save();
    ctx.strokeStyle = '#ff8800';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Draw missile count indicators around the base
  for (let i = 0; i < MAX_MISSILES; i++) {
    const angle = (Math.PI * 2 / MAX_MISSILES) * i - Math.PI / 2 + s.gameTime * 0.02;
    const ix = cx + Math.cos(angle) * (baseRadius + 2);
    const iy = cy + Math.sin(angle) * (baseRadius + 2);
    ctx.fillStyle = i < s.missileCount ? '#ff8800' : '#333333';
    ctx.fillRect(Math.round(ix - 1.5), Math.round(iy - 1.5), 3, 3);
  }
}
