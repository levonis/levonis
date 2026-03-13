/**
 * Procedural enemy drawing system for 150+ enemy types.
 * Uses tier-based shape generation with color palettes per tier.
 */
import { Enemy, W, H, getEnemyTier } from './types';

// ── Tier Color Palettes ──
const TIER_COLORS: { main: string; dark: string; glow: string; eye: string; accent: string }[] = [
  { main:'#ff3d3d', dark:'#aa1111', glow:'#ff3d3d', eye:'#ff0000', accent:'#ff8888' },  // 0 Basic
  { main:'#ff8800', dark:'#aa4400', glow:'#ff6600', eye:'#ffcc00', accent:'#ffaa44' },  // 1 Military
  { main:'#44aaff', dark:'#225588', glow:'#44aaff', eye:'#00ffff', accent:'#88ccff' },  // 2 Heavy
  { main:'#00ff88', dark:'#008844', glow:'#00ff88', eye:'#88ffcc', accent:'#44ffaa' },  // 3 Fast
  { main:'#ff44ff', dark:'#882288', glow:'#ff44ff', eye:'#ff88ff', accent:'#ff88cc' },  // 4 Bomber
  { main:'#88ff00', dark:'#448800', glow:'#88ff00', eye:'#ccff88', accent:'#aaff44' },  // 5 Alien
  { main:'#8888cc', dark:'#444488', glow:'#aaaaff', eye:'#ffffff', accent:'#bbbbff' },  // 6 Mech
  { main:'#ffcc00', dark:'#886600', glow:'#ffcc00', eye:'#ffff88', accent:'#ffdd44' },  // 7 Swarm
  { main:'#ff4444', dark:'#881111', glow:'#ff6666', eye:'#ffffff', accent:'#ff8888' },  // 8 Elite
  { main:'#aa44ff', dark:'#662299', glow:'#cc66ff', eye:'#ff00ff', accent:'#dd88ff' },  // 9 Cosmic
  { main:'#4444aa', dark:'#222266', glow:'#6666cc', eye:'#8888ff', accent:'#7777bb' },  // 10 Void
  { main:'#ff2222', dark:'#880000', glow:'#ff4444', eye:'#ffff00', accent:'#ff6644' },  // 11 Omega
  { main:'#ffaa00', dark:'#885500', glow:'#ffcc44', eye:'#ffffff', accent:'#ffdd88' },  // 12 Mythic
];

// ── Shape Index within tier (0-4 maps to different shapes) ──
type ShapeType = 'hex' | 'triangle' | 'diamond' | 'rect' | 'circle' | 'cross' | 'star' | 'pentagon' | 'arrow' | 'claw';
const TIER_SHAPES: ShapeType[][] = [
  ['hex','triangle','diamond','circle','rect'],         // 0
  ['triangle','arrow','diamond','hex','pentagon'],      // 1
  ['rect','hex','cross','rect','diamond'],             // 2
  ['diamond','triangle','arrow','diamond','circle'],   // 3
  ['rect','cross','pentagon','hex','rect'],            // 4
  ['circle','claw','star','hex','diamond'],            // 5
  ['rect','cross','hex','pentagon','rect'],            // 6
  ['circle','diamond','triangle','hex','arrow'],       // 7
  ['hex','star','pentagon','cross','diamond'],         // 8
  ['star','circle','pentagon','diamond','claw'],       // 9
  ['diamond','triangle','star','hex','claw'],          // 10
  ['star','cross','pentagon','hex','arrow'],           // 11
  ['star','claw','pentagon','cross','diamond'],        // 12
];

function drawShape(ctx: CanvasRenderingContext2D, shape: ShapeType, cx: number, cy: number, r: number) {
  ctx.beginPath();
  switch (shape) {
    case 'hex':
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 3 * i - Math.PI / 6;
        i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
                 : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      break;
    case 'triangle':
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx - r, cy + r * 0.8);
      ctx.lineTo(cx + r, cy + r * 0.8);
      break;
    case 'diamond':
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      break;
    case 'rect':
      ctx.rect(cx - r, cy - r * 0.7, r * 2, r * 1.4);
      break;
    case 'circle':
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      break;
    case 'cross':
      const cw = r * 0.35;
      ctx.moveTo(cx - cw, cy - r); ctx.lineTo(cx + cw, cy - r);
      ctx.lineTo(cx + cw, cy - cw); ctx.lineTo(cx + r, cy - cw);
      ctx.lineTo(cx + r, cy + cw); ctx.lineTo(cx + cw, cy + cw);
      ctx.lineTo(cx + cw, cy + r); ctx.lineTo(cx - cw, cy + r);
      ctx.lineTo(cx - cw, cy + cw); ctx.lineTo(cx - r, cy + cw);
      ctx.lineTo(cx - r, cy - cw); ctx.lineTo(cx - cw, cy - cw);
      break;
    case 'star':
      for (let i = 0; i < 5; i++) {
        const a1 = Math.PI * 2 / 5 * i - Math.PI / 2;
        const a2 = a1 + Math.PI / 5;
        i === 0 ? ctx.moveTo(cx + r * Math.cos(a1), cy + r * Math.sin(a1))
                 : ctx.lineTo(cx + r * Math.cos(a1), cy + r * Math.sin(a1));
        ctx.lineTo(cx + r * 0.4 * Math.cos(a2), cy + r * 0.4 * Math.sin(a2));
      }
      break;
    case 'pentagon':
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * 2 / 5 * i - Math.PI / 2;
        i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
                 : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      break;
    case 'arrow':
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy + r * 0.3);
      ctx.lineTo(cx + r * 0.4, cy + r * 0.3);
      ctx.lineTo(cx + r * 0.4, cy + r);
      ctx.lineTo(cx - r * 0.4, cy + r);
      ctx.lineTo(cx - r * 0.4, cy + r * 0.3);
      ctx.lineTo(cx - r, cy + r * 0.3);
      break;
    case 'claw':
      ctx.moveTo(cx, cy + r);
      ctx.lineTo(cx - r, cy - r * 0.5);
      ctx.lineTo(cx - r * 0.3, cy - r * 0.2);
      ctx.lineTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.3, cy - r * 0.2);
      ctx.lineTo(cx + r, cy - r * 0.5);
      break;
  }
  ctx.closePath();
}

/** Draw any non-boss enemy procedurally based on tier and variant */
export function drawProceduralEnemy(ctx: CanvasRenderingContext2D, e: Enemy, t: number) {
  if (e.spawnDelay > 0) return;
  const tier = e.tier;
  const colors = TIER_COLORS[Math.min(tier, TIER_COLORS.length - 1)];
  const shapes = TIER_SHAPES[Math.min(tier, TIER_SHAPES.length - 1)];
  const varIdx = e.variant % shapes.length;
  const shape = shapes[varIdx];
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;
  const r = Math.min(e.w, e.h) / 2;

  ctx.save();
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 4 + tier;

  // Outer body
  ctx.fillStyle = colors.dark;
  drawShape(ctx, shape, cx, cy, r + 1);
  ctx.fill();

  // Inner body
  ctx.fillStyle = colors.main;
  drawShape(ctx, shape, cx, cy, r - 1);
  ctx.fill();

  // Eye/core (animated)
  const eyeOff = Math.sin(t * 0.15 + e.movePhase) * 2;
  ctx.fillStyle = colors.eye;
  ctx.shadowBlur = 0;
  const eyeSize = Math.max(1.5, r * 0.2);
  ctx.fillRect(cx - eyeSize / 2 + eyeOff, cy - eyeSize / 2, eyeSize, eyeSize);

  // Tier-specific decorations
  if (tier >= 2) {
    // Side guns
    ctx.fillStyle = colors.accent;
    ctx.fillRect(e.x - 2, cy - 1, 3, 2);
    ctx.fillRect(e.x + e.w - 1, cy - 1, 3, 2);
  }
  if (tier >= 4) {
    // Engine glow
    ctx.fillStyle = colors.glow;
    ctx.globalAlpha = 0.4 + Math.sin(t * 0.2) * 0.3;
    ctx.fillRect(cx - 2, e.y, 4, 3);
    ctx.globalAlpha = 1;
  }
  if (tier >= 6) {
    // Armor plates
    ctx.fillStyle = colors.dark;
    ctx.fillRect(e.x + 2, e.y + 2, e.w - 4, 2);
    ctx.fillRect(e.x + 2, e.y + e.h - 4, e.w - 4, 2);
  }
  if (tier >= 8) {
    // Shield shimmer
    ctx.strokeStyle = colors.accent;
    ctx.globalAlpha = 0.3 + Math.sin(t * 0.1) * 0.2;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (tier >= 10) {
    // Dark matter particles
    ctx.fillStyle = colors.glow;
    for (let p = 0; p < 3; p++) {
      const pa = t * 0.05 + p * 2.1;
      const px = cx + Math.cos(pa) * (r + 4);
      const py = cy + Math.sin(pa) * (r + 4);
      ctx.globalAlpha = 0.5;
      ctx.fillRect(px - 1, py - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  // HP bar for tougher enemies
  if (e.maxHp > 3 && e.hp < e.maxHp) {
    const ratio = e.hp / e.maxHp;
    ctx.fillStyle = '#111';
    ctx.fillRect(e.x, e.y - 4, e.w, 2);
    ctx.fillStyle = ratio > 0.5 ? '#00ff00' : ratio > 0.25 ? '#ffff00' : '#ff0000';
    ctx.fillRect(e.x, e.y - 4, e.w * ratio, 2);
  }

  ctx.restore();
}

// ── Boss Colors by index ──
const BOSS_THEMES = [
  { main:'#4488ff', dark:'#224488', core:'#00ffff', glow:'#4488ff' },
  { main:'#ff6600', dark:'#aa3300', core:'#ffcc00', glow:'#ff8800' },
  { main:'#aa44ff', dark:'#662299', core:'#ff00ff', glow:'#cc66ff' },
  { main:'#ff2222', dark:'#880000', core:'#ffff00', glow:'#ff4444' },
  { main:'#00cc88', dark:'#006644', core:'#88ffcc', glow:'#00ff88' },
  { main:'#8888cc', dark:'#444488', core:'#ffffff', glow:'#aaaaff' },
  { main:'#ffcc00', dark:'#886600', core:'#ffffff', glow:'#ffdd44' },
  { main:'#ff4488', dark:'#882244', core:'#ffaacc', glow:'#ff66aa' },
  { main:'#44ccff', dark:'#226688', core:'#aaeeff', glow:'#66ddff' },
  { main:'#cc44ff', dark:'#662288', core:'#ff88ff', glow:'#dd66ff' },
  { main:'#4444aa', dark:'#222266', core:'#8888ff', glow:'#6666cc' },
  { main:'#ff8844', dark:'#884422', core:'#ffcc88', glow:'#ffaa66' },
  { main:'#ffaa00', dark:'#885500', core:'#ffffff', glow:'#ffcc44' },
];

/** Draw boss enemy - unique visuals per boss number */
export function drawBoss(ctx: CanvasRenderingContext2D, e: Enemy, t: number) {
  if (e.spawnDelay > 0) return;
  const bossNum = e.variant;
  const c = BOSS_THEMES[(bossNum - 1) % BOSS_THEMES.length];

  ctx.save();
  ctx.shadowColor = c.glow;
  ctx.shadowBlur = 12 + bossNum;

  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;

  // Outer hull
  ctx.fillStyle = c.dark;
  ctx.fillRect(e.x, e.y + 6, e.w, e.h - 6);
  ctx.fillRect(e.x + 6, e.y, e.w - 12, e.h);

  // Inner hull
  ctx.fillStyle = c.main;
  ctx.fillRect(e.x + 3, e.y + 9, e.w - 6, e.h - 12);
  ctx.fillRect(e.x + 9, e.y + 3, e.w - 18, e.h - 6);

  // Pulsing cores (more with higher boss number)
  ctx.fillStyle = c.core;
  const coreCount = Math.min(6, 2 + Math.floor(bossNum / 3));
  for (let i = 0; i < coreCount; i++) {
    const angle = (Math.PI * 2 / coreCount) * i + t * 0.02;
    const coreR = e.w * 0.3;
    const coreX = cx + Math.cos(angle) * coreR;
    const coreY = cy + Math.sin(angle) * coreR;
    ctx.globalAlpha = 0.5 + Math.sin(t * 0.1 + i) * 0.4;
    ctx.fillRect(coreX - 2, coreY - 2, 4, 4);
  }
  ctx.globalAlpha = 1;

  // Rotating eye
  const eyeX = cx + Math.sin(t * 0.04) * (e.w * 0.15);
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(eyeX - 3, e.y + 6, 6, 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(eyeX - 1, e.y + 7, 2, 2);

  // Cannons (more with higher boss)
  ctx.fillStyle = c.core;
  const cannonCount = Math.min(4, 1 + Math.floor(bossNum / 4));
  for (let i = 0; i < cannonCount; i++) {
    const cannonX = e.x + (e.w / (cannonCount + 1)) * (i + 1) - 2;
    ctx.fillRect(cannonX, e.y + e.h - 2, 4, 5);
  }

  // Shield ring for later bosses
  if (bossNum >= 5) {
    ctx.strokeStyle = c.glow;
    ctx.globalAlpha = 0.3 + Math.sin(t * 0.08) * 0.2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, e.w / 2 + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Orbiting satellites for very late bosses
  if (bossNum >= 9) {
    const satCount = Math.min(4, bossNum - 7);
    for (let i = 0; i < satCount; i++) {
      const sa = t * 0.03 + (Math.PI * 2 / satCount) * i;
      const sx = cx + Math.cos(sa) * (e.w / 2 + 10);
      const sy = cy + Math.sin(sa) * (e.h / 2 + 10);
      ctx.fillStyle = c.core;
      ctx.fillRect(sx - 2, sy - 2, 4, 4);
    }
  }

  // HP bar
  const ratio = e.hp / e.maxHp;
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#111';
  ctx.fillRect(e.x, e.y - 6, e.w, 4);
  ctx.fillStyle = ratio > 0.5 ? '#00ff00' : ratio > 0.25 ? '#ffff00' : '#ff0000';
  ctx.fillRect(e.x, e.y - 6, e.w * ratio, 4);

  ctx.restore();
}
