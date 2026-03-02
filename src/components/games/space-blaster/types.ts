export interface Vec2 { x: number; y: number }
export interface Star { x: number; y: number; speed: number; size: number; brightness: number }
export interface Bullet extends Vec2 { dy: number; dx?: number; isEnemy?: boolean }
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

export type PowerUpType = 'missile' | 'shield' | 'fire_rate';
export interface PowerUp {
  x: number; y: number;
  type: PowerUpType;
  vy: number;
  life: number;
}

export type EnemyType = 'drone' | 'fighter' | 'tank' | 'speeder' | 'bomber' | 'boss';
export type Screen = 'start' | 'shop' | 'playing' | 'planet-transition' | 'gameover';

export interface Planet {
  id: number;
  name: string;
  nameAr: string;
  bg: string;
  starColor1: string;
  starColor2: string;
  nebulaColor: string;
  enemyTypes: EnemyType[];
  waves: [number, number]; // start, end
  bossWave: number;
}

export interface ShopItem {
  id: string;
  nameAr: string;
  icon: string;
  cost: number;
  description: string;
  maxLevel: number;
}

export interface GameState {
  screen: Screen;
  player: Vec2;
  lives: number;
  score: number;
  wave: number;
  planet: number;
  enemies: Enemy[];
  bullets: Bullet[];
  particles: Particle[];
  stars: Star[];
  missiles: Missile[];
  powerUps: PowerUp[];
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
  // Shop upgrades
  fireRateLevel: number;
  fireRateBoost: number; // 0-3 from pickups
  fireRateDecayTimer: number; // frames since last pickup (decays after 7s = 420 frames)
  doubleBullets: boolean;
  shieldActive: number;
  shieldInventory: number;
  transitionTimer: number;
  // Missile launcher
  missileBaseActive: boolean;
  missileCount: number;
  missileReloadTimer: number;
  missileFireTimer: number;
  missileDoubleTap: boolean; // flag: double-tap triggers missile volley
}

export const W = 360;
export const H = 640;
export const PLAYER_W = 26;
export const PLAYER_H = 26;
export const BULLET_W = 3;
export const BULLET_H = 8;
export const MAX_WAVES = 20;
export const MAX_MISSILES = 6;
export const MISSILE_RELOAD_RATE = 90; // frames to reload one missile
export const MISSILE_FIRE_RATE = 20; // frames between missile launches
