export interface Vec2 { x: number; y: number }
export interface Star { x: number; y: number; speed: number; size: number; brightness: number }
export interface Bullet extends Vec2 { dy: number; dx?: number; isEnemy?: boolean; isLaser?: boolean }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }
export interface Enemy {
  x: number; y: number; w: number; h: number;
  hp: number; maxHp: number;
  type: EnemyType;
  shootTimer: number; speed: number;
  movePattern: 'straight' | 'wave' | 'zigzag' | 'circle';
  movePhase: number;
  spawnDelay: number;
}

export interface Missile {
  x: number; y: number;
  targetId: number;
  speed: number;
  angle: number;
  life: number;
}

export interface HelperPlane {
  x: number; y: number;
  side: 'left' | 'right';
  shootTimer: number;
}

export type PowerUpType = 'upgrade' | 'shield';
export interface PowerUp {
  x: number; y: number;
  type: PowerUpType;
  vy: number;
  life: number;
}

export type EnemyType = 'drone' | 'fighter' | 'tank' | 'speeder' | 'bomber' | 'boss';
export type Screen = 'start' | 'playing' | 'gameover';

export interface Planet {
  id: number;
  name: string;
  nameAr: string;
  bg: string;
  starColor1: string;
  starColor2: string;
  nebulaColor: string;
  enemyTypes: EnemyType[];
  waves: [number, number];
  bossWave: number;
}

export interface GameState {
  screen: Screen;
  player: Vec2;
  lives: number;
  maxLives: number;
  score: number;
  wave: number;
  planet: number;
  enemies: Enemy[];
  bullets: Bullet[];
  particles: Particle[];
  stars: Star[];
  missiles: Missile[];
  powerUps: PowerUp[];
  helperPlanes: HelperPlane[];
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
  screenFlash: number;
  // Progressive upgrade system
  upgradeLevel: number; // 0-15 total upgrades collected
  // Upgrade breakdown:
  // 0: single shot
  // 1: double shot
  // 2: triple shot
  // 3-7: laser levels 1-5
  // 8-13: rockets (1-6 rockets loaded)
  // 14-15: helper planes (1-2)
  // Shield
  shieldActive: number; // frames remaining (600 = 10sec)
  // Missile system (from upgrade level 8-13)
  missileCount: number;
  missileFireTimer: number;
  missileDoubleTap: boolean;
  transitionTimer: number;
}

export const W = 360;
export const H = 640;
export const PLAYER_W = 26;
export const PLAYER_H = 26;
export const BULLET_W = 3;
export const BULLET_H = 8;
export const MAX_WAVES = 20;
export const MAX_MISSILES = 6;
export const MISSILE_FIRE_RATE = 20;
