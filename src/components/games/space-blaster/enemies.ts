import { Enemy, EnemyType, W } from './types';
import { Planet } from './types';

interface EnemyConfig {
  w: number; h: number; hp: number; speed: number; shootInterval: number;
}

const ENEMY_CONFIGS: Record<Exclude<EnemyType, 'boss'>, EnemyConfig> = {
  drone:   { w: 14, h: 14, hp: 1, speed: 0.7, shootInterval: 90 },
  fighter: { w: 18, h: 18, hp: 2, speed: 1.0, shootInterval: 55 },
  tank:    { w: 22, h: 22, hp: 5, speed: 0.35, shootInterval: 70 },
  speeder: { w: 10, h: 12, hp: 1, speed: 2.0, shootInterval: 100 },
  bomber:  { w: 20, h: 16, hp: 3, speed: 0.5, shootInterval: 40 },
};

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
};

const PATTERNS: Array<'straight' | 'wave' | 'zigzag' | 'circle'> = ['straight', 'wave', 'zigzag', 'circle'];

export function spawnWaveEnemies(wave: number, planet: Planet): { enemies: Enemy[]; total: number } {
  const isBossWave = wave === planet.bossWave;
  if (isBossWave) {
    const bossHp = 15 + planet.id * 15;
    return {
      enemies: [{
        x: W / 2 - 24, y: -60,
        w: 48, h: 48,
        hp: bossHp, maxHp: bossHp,
        type: 'boss', shootTimer: 0, speed: 0.3,
        movePattern: 'wave', movePhase: 0, spawnDelay: 0,
      }],
      total: 1,
    };
  }

  const localWave = wave - planet.waves[0]; // 0-4 within planet
  const count = 4 + localWave * 2 + planet.id;
  const enemies: Enemy[] = [];
  const formKeys = Object.keys(FORMATIONS) as Array<keyof typeof FORMATIONS>;
  const formation = FORMATIONS[formKeys[wave % formKeys.length]];

  for (let i = 0; i < count; i++) {
    const typeIdx = Math.floor(Math.random() * planet.enemyTypes.length);
    const type = planet.enemyTypes[typeIdx];
    const cfg = ENEMY_CONFIGS[type];
    const pos = formation(count, i);
    const pattern = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
    const diffMult = 1 + localWave * 0.15 + (planet.id - 1) * 0.1;

    enemies.push({
      x: pos.x, y: pos.y,
      w: cfg.w, h: cfg.h,
      hp: cfg.hp, maxHp: cfg.hp,
      type,
      shootTimer: cfg.shootInterval + Math.random() * 60,
      speed: cfg.speed * diffMult + Math.random() * 0.3,
      movePattern: pattern,
      movePhase: Math.random() * Math.PI * 2,
      spawnDelay: i * 8,
    });
  }
  return { enemies, total: count };
}

export function getEnemyScore(type: EnemyType): number {
  switch (type) {
    case 'boss': return 100;
    case 'tank': return 15;
    case 'fighter': return 10;
    case 'bomber': return 12;
    case 'speeder': return 8;
    default: return 5;
  }
}
