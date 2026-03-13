import { Enemy, EnemyType, W, MovePattern, getEnemyTier } from './types';
import { Planet } from './types';

// ── Enemy Config Generator ──
// Each enemy gets stats based on tier + individual tuning
interface EnemyConfig {
  w: number; h: number; hp: number; speed: number; shootInterval: number;
}

function getEnemyConfig(type: EnemyType): EnemyConfig {
  const tier = getEnemyTier(type);
  // Base stats scale with tier
  const baseHp = 1 + tier * 2;
  const baseSpeed = 0.5 + tier * 0.08;
  const baseShoot = Math.max(20, 90 - tier * 5);

  const configs: Partial<Record<EnemyType, Partial<EnemyConfig>>> = {
    // Tier 0 - Basic
    drone:       { w:14, h:14, hp:1, speed:0.7, shootInterval:90 },
    scout:       { w:12, h:12, hp:1, speed:1.0, shootInterval:100 },
    probe:       { w:10, h:10, hp:1, speed:0.5, shootInterval:120 },
    sentry:      { w:16, h:16, hp:2, speed:0.4, shootInterval:60 },
    interceptor: { w:14, h:16, hp:2, speed:1.2, shootInterval:70 },
    // Tier 1 - Military
    fighter:     { w:18, h:18, hp:3, speed:1.0, shootInterval:55 },
    gunship:     { w:20, h:16, hp:4, speed:0.6, shootInterval:35 },
    corvette:    { w:22, h:18, hp:5, speed:0.7, shootInterval:45 },
    striker:     { w:16, h:20, hp:3, speed:1.3, shootInterval:50 },
    raider:      { w:18, h:14, hp:3, speed:1.1, shootInterval:40 },
    // Tier 2 - Heavy
    tank:        { w:22, h:22, hp:8, speed:0.35, shootInterval:50 },
    fortress:    { w:26, h:26, hp:12, speed:0.25, shootInterval:40 },
    juggernaut:  { w:28, h:24, hp:15, speed:0.2, shootInterval:35 },
    bastion:     { w:24, h:28, hp:14, speed:0.3, shootInterval:45 },
    ironclad:    { w:26, h:22, hp:10, speed:0.35, shootInterval:30 },
    // Tier 3 - Fast
    speeder:     { w:10, h:12, hp:2, speed:2.0, shootInterval:80 },
    phantom:     { w:12, h:14, hp:3, speed:2.2, shootInterval:70 },
    blur:        { w:8, h:10, hp:1, speed:3.0, shootInterval:100 },
    comet:       { w:10, h:16, hp:4, speed:2.5, shootInterval:60 },
    flash:       { w:10, h:10, hp:2, speed:2.8, shootInterval:90 },
    // Tier 4 - Bomber
    bomber:      { w:20, h:16, hp:5, speed:0.5, shootInterval:30 },
    devastator:  { w:22, h:18, hp:7, speed:0.45, shootInterval:25 },
    scorcher:    { w:18, h:20, hp:6, speed:0.6, shootInterval:35 },
    inferno:     { w:24, h:20, hp:8, speed:0.4, shootInterval:20 },
    napalm:      { w:20, h:22, hp:9, speed:0.35, shootInterval:28 },
    // Tier 5 - Alien
    spore:       { w:14, h:14, hp:4, speed:0.8, shootInterval:50 },
    tendril:     { w:12, h:20, hp:6, speed:0.6, shootInterval:40 },
    hivemind:    { w:20, h:20, hp:10, speed:0.4, shootInterval:30 },
    parasite:    { w:10, h:10, hp:3, speed:1.5, shootInterval:60 },
    leech:       { w:12, h:12, hp:5, speed:1.2, shootInterval:45 },
    // Tier 6 - Mech
    mech:        { w:22, h:24, hp:12, speed:0.5, shootInterval:35 },
    titan:       { w:26, h:28, hp:18, speed:0.3, shootInterval:25 },
    colossus:    { w:30, h:30, hp:22, speed:0.2, shootInterval:20 },
    golem:       { w:24, h:26, hp:16, speed:0.35, shootInterval:30 },
    sentinel:    { w:20, h:22, hp:14, speed:0.45, shootInterval:28 },
    // Tier 7 - Swarm
    swarmling:   { w:8, h:8, hp:2, speed:1.8, shootInterval:80 },
    hornet:      { w:10, h:10, hp:3, speed:2.0, shootInterval:60 },
    locust:      { w:8, h:10, hp:2, speed:2.2, shootInterval:70 },
    mosquito:    { w:6, h:8, hp:1, speed:2.5, shootInterval:90 },
    wasp:        { w:10, h:12, hp:4, speed:1.9, shootInterval:50 },
    // Tier 8 - Elite
    elite_drone:   { w:16, h:16, hp:8, speed:1.0, shootInterval:40 },
    elite_fighter: { w:20, h:20, hp:10, speed:1.1, shootInterval:30 },
    elite_tank:    { w:26, h:26, hp:20, speed:0.4, shootInterval:25 },
    warden:        { w:22, h:24, hp:15, speed:0.6, shootInterval:28 },
    commander:     { w:24, h:22, hp:18, speed:0.5, shootInterval:22 },
    // Tier 9 - Cosmic
    nebula:        { w:20, h:20, hp:12, speed:0.7, shootInterval:35 },
    pulsar:        { w:16, h:16, hp:8, speed:1.4, shootInterval:20 },
    quasar:        { w:22, h:22, hp:16, speed:0.5, shootInterval:18 },
    nova_enemy:    { w:18, h:18, hp:10, speed:1.0, shootInterval:25 },
    singularity:   { w:24, h:24, hp:20, speed:0.3, shootInterval:15 },
    // Tier 10 - Void
    shadow:        { w:16, h:18, hp:10, speed:1.2, shootInterval:30 },
    wraith:        { w:14, h:20, hp:12, speed:1.5, shootInterval:25 },
    specter:       { w:18, h:18, hp:14, speed:1.0, shootInterval:28 },
    revenant:      { w:20, h:22, hp:18, speed:0.8, shootInterval:22 },
    banshee:       { w:16, h:16, hp:8, speed:2.0, shootInterval:20 },
    // Tier 11 - Omega
    omega_drone:   { w:18, h:18, hp:15, speed:1.0, shootInterval:25 },
    omega_fighter: { w:22, h:22, hp:20, speed:1.2, shootInterval:20 },
    omega_tank:    { w:28, h:28, hp:30, speed:0.4, shootInterval:18 },
    omega_bomber:  { w:24, h:20, hp:22, speed:0.5, shootInterval:15 },
    overlord:      { w:26, h:26, hp:25, speed:0.6, shootInterval:12 },
    // Tier 12 - Mythic
    mythic_eye:     { w:20, h:20, hp:20, speed:0.8, shootInterval:15 },
    mythic_hydra:   { w:26, h:26, hp:30, speed:0.6, shootInterval:12 },
    mythic_phoenix: { w:22, h:24, hp:25, speed:1.0, shootInterval:18 },
    mythic_kraken:  { w:28, h:28, hp:35, speed:0.5, shootInterval:10 },
    mythic_dragon:  { w:30, h:30, hp:40, speed:0.7, shootInterval:8 },
  };

  const c = configs[type];
  return {
    w: c?.w ?? 16,
    h: c?.h ?? 16,
    hp: c?.hp ?? baseHp,
    speed: c?.speed ?? baseSpeed,
    shootInterval: c?.shootInterval ?? baseShoot,
  };
}

// ── Movement patterns by tier ──
const PATTERNS_BY_TIER: MovePattern[][] = [
  ['straight', 'wave'],                                    // tier 0
  ['straight', 'wave', 'zigzag'],                         // tier 1
  ['straight', 'wave', 'zigzag', 'circle'],               // tier 2
  ['wave', 'zigzag', 'dash'],                             // tier 3
  ['straight', 'wave', 'circle'],                         // tier 4
  ['wave', 'circle', 'spiral'],                           // tier 5
  ['straight', 'zigzag', 'circle'],                       // tier 6
  ['wave', 'zigzag', 'swarm', 'dash'],                   // tier 7
  ['wave', 'circle', 'spiral', 'orbit'],                  // tier 8
  ['spiral', 'orbit', 'teleport'],                        // tier 9
  ['teleport', 'dash', 'spiral'],                         // tier 10
  ['orbit', 'spiral', 'teleport', 'dash'],               // tier 11
  ['spiral', 'teleport', 'orbit', 'swarm', 'dash'],     // tier 12
];

// ── Formations ──
const FORMATIONS = {
  vShape: (count: number, i: number) => ({
    x: W / 2 + (i - count / 2) * 30,
    y: -(30 + Math.abs(i - count / 2) * 25),
  }),
  line: (count: number, i: number) => ({
    x: 30 + (i / (count - 1 || 1)) * (W - 60),
    y: -(30 + Math.random() * 20),
  }),
  staggered: (count: number, i: number) => ({
    x: 20 + Math.random() * (W - 40),
    y: -(30 + i * 40 + Math.random() * 30),
  }),
  diamond: (count: number, i: number) => ({
    x: W / 2 + Math.sin(i / count * Math.PI * 2) * 80,
    y: -(30 + Math.cos(i / count * Math.PI * 2) * 50 + 60),
  }),
  circle: (count: number, i: number) => ({
    x: W / 2 + Math.cos(i / count * Math.PI * 2) * 100,
    y: -(30 + i * 20),
  }),
  pincer: (count: number, i: number) => ({
    x: i < count / 2 ? 10 + i * 20 : W - 10 - (i - Math.floor(count / 2)) * 20,
    y: -(30 + Math.abs(i - count / 2) * 15),
  }),
};

const formationKeys = Object.keys(FORMATIONS) as Array<keyof typeof FORMATIONS>;

export function spawnWaveEnemies(wave: number, planet: Planet): { enemies: Enemy[]; total: number } {
  const isBossWave = wave === planet.bossWave;
  if (isBossWave) {
    const bossNum = Math.ceil(wave / 20);
    const bossHp = 20 + bossNum * 25 + Math.floor(bossNum * bossNum * 2);
    const bossSize = Math.min(56, 40 + bossNum * 2);
    return {
      enemies: [{
        x: W / 2 - bossSize / 2, y: -bossSize - 10,
        w: bossSize, h: bossSize,
        hp: bossHp, maxHp: bossHp,
        type: 'boss', shootTimer: 0, speed: 0.3,
        movePattern: 'wave', movePhase: 0, spawnDelay: 0,
        variant: bossNum, tier: Math.min(12, bossNum - 1),
      }],
      total: 1,
    };
  }

  const localWave = wave - planet.waves[0];
  const tierBase = planet.id - 1;
  // Scale enemy count: starts at 4, grows with waves
  const count = Math.min(20, 4 + Math.floor(localWave * 1.5) + Math.floor(planet.id * 0.5));
  const enemies: Enemy[] = [];
  const formation = FORMATIONS[formationKeys[wave % formationKeys.length]];

  // Difficulty multiplier increases throughout the game
  const globalDiff = 1 + (wave - 1) * 0.02;

  for (let i = 0; i < count; i++) {
    const typeIdx = Math.floor(Math.random() * planet.enemyTypes.length);
    const type = planet.enemyTypes[typeIdx];
    const cfg = getEnemyConfig(type);
    const tier = getEnemyTier(type);
    const pos = formation(count, i);
    const patterns = PATTERNS_BY_TIER[Math.min(tier, PATTERNS_BY_TIER.length - 1)];
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];

    // Scale HP and speed with wave progression
    const hpMult = globalDiff * (1 + localWave * 0.08);
    const spdMult = 1 + localWave * 0.05 + tierBase * 0.03;

    enemies.push({
      x: pos.x, y: pos.y,
      w: cfg.w, h: cfg.h,
      hp: Math.ceil(cfg.hp * hpMult), maxHp: Math.ceil(cfg.hp * hpMult),
      type,
      shootTimer: cfg.shootInterval + Math.random() * 40,
      speed: cfg.speed * spdMult + Math.random() * 0.2,
      movePattern: pattern,
      movePhase: Math.random() * Math.PI * 2,
      spawnDelay: i * 6,
      variant: Math.floor(Math.random() * 4),
      tier,
    });
  }
  return { enemies, total: count };
}

// Scoring: base per tier, caps growth
export function getEnemyScore(type: EnemyType): number {
  if (type === 'boss') return 80;
  const tier = getEnemyTier(type);
  return 2 + tier * 2;
}

/** Get shoot pattern for enemy based on type and tier */
export function getEnemyShootPattern(type: EnemyType, tier: number, wave: number): {
  bulletCount: number; spread: number; bulletSpeed: number; bulletDx: number[];
} {
  // More bullets and spread at higher tiers
  if (tier <= 1) return { bulletCount: 1, spread: 0, bulletSpeed: 3, bulletDx: [0] };
  if (tier <= 3) return { bulletCount: 1 + (wave > 50 ? 1 : 0), spread: 0.3, bulletSpeed: 3.5, bulletDx: [0, -0.5, 0.5].slice(0, 1 + (wave > 50 ? 1 : 0)) };
  if (tier <= 5) {
    const n = Math.min(3, 2 + Math.floor(wave / 80));
    const dxs: number[] = [];
    for (let i = 0; i < n; i++) dxs.push((i - (n - 1) / 2) * 0.8);
    return { bulletCount: n, spread: 0.6, bulletSpeed: 3.5 + tier * 0.2, bulletDx: dxs };
  }
  if (tier <= 8) {
    const n = Math.min(5, 2 + Math.floor(wave / 60));
    const dxs: number[] = [];
    for (let i = 0; i < n; i++) dxs.push((i - (n - 1) / 2) * 0.6);
    return { bulletCount: n, spread: 0.8, bulletSpeed: 4 + tier * 0.15, bulletDx: dxs };
  }
  // Tier 9+: heavy fire patterns
  const n = Math.min(7, 3 + Math.floor(wave / 50));
  const dxs: number[] = [];
  for (let i = 0; i < n; i++) dxs.push((i - (n - 1) / 2) * 0.5);
  return { bulletCount: n, spread: 1.0, bulletSpeed: 4.5 + tier * 0.1, bulletDx: dxs };
}
