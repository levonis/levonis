export interface Vec2 { x: number; y: number }
export interface Star { x: number; y: number; speed: number; size: number; brightness: number }
export interface Bullet extends Vec2 { dy: number; dx?: number; isEnemy?: boolean; isLaser?: boolean; damage?: number; radius?: number; homing?: boolean }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }
export interface Enemy {
  x: number; y: number; w: number; h: number;
  hp: number; maxHp: number;
  type: EnemyType;
  shootTimer: number; speed: number;
  movePattern: MovePattern;
  movePhase: number;
  spawnDelay: number;
  /** visual variant index for procedural drawing */
  variant: number;
  /** tier 0-12 controls visual complexity */
  tier: number;
}

export type MovePattern = 'straight' | 'wave' | 'zigzag' | 'circle' | 'spiral' | 'dash' | 'orbit' | 'teleport' | 'swarm';

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

// 10 base categories × ~15 variants each = 150+ unique enemies + boss
export type EnemyType =
  // Tier 0: Basic (waves 1-20)
  | 'drone' | 'scout' | 'probe' | 'sentry' | 'interceptor'
  // Tier 1: Military (waves 10-40)
  | 'fighter' | 'gunship' | 'corvette' | 'striker' | 'raider'
  // Tier 2: Heavy (waves 20-60)
  | 'tank' | 'fortress' | 'juggernaut' | 'bastion' | 'ironclad'
  // Tier 3: Fast (waves 30-80)
  | 'speeder' | 'phantom' | 'blur' | 'comet' | 'flash'
  // Tier 4: Bomber (waves 40-100)
  | 'bomber' | 'devastator' | 'scorcher' | 'inferno' | 'napalm'
  // Tier 5: Alien (waves 60-120)
  | 'spore' | 'tendril' | 'hivemind' | 'parasite' | 'leech'
  // Tier 6: Mech (waves 80-140)
  | 'mech' | 'titan' | 'colossus' | 'golem' | 'sentinel'
  // Tier 7: Swarm (waves 100-160)
  | 'swarmling' | 'hornet' | 'locust' | 'mosquito' | 'wasp'
  // Tier 8: Elite (waves 120-180)
  | 'elite_drone' | 'elite_fighter' | 'elite_tank' | 'warden' | 'commander'
  // Tier 9: Cosmic (waves 140-200)
  | 'nebula' | 'pulsar' | 'quasar' | 'nova_enemy' | 'singularity'
  // Tier 10: Void (waves 160-220)
  | 'shadow' | 'wraith' | 'specter' | 'revenant' | 'banshee'
  // Tier 11: Omega (waves 180-240)
  | 'omega_drone' | 'omega_fighter' | 'omega_tank' | 'omega_bomber' | 'overlord'
  // Tier 12: Mythic (waves 220-260)
  | 'mythic_eye' | 'mythic_hydra' | 'mythic_phoenix' | 'mythic_kraken' | 'mythic_dragon'
  // Boss
  | 'boss';

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
  upgradeLevel: number;
  shieldActive: number;
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
export const MAX_WAVES = 260;
export const MAX_MISSILES = 6;
export const MISSILE_FIRE_RATE = 20;

/** Get the tier (0-12) for an enemy type */
export function getEnemyTier(type: EnemyType): number {
  const TIER_MAP: Record<string, number> = {
    drone:0,scout:0,probe:0,sentry:0,interceptor:0,
    fighter:1,gunship:1,corvette:1,striker:1,raider:1,
    tank:2,fortress:2,juggernaut:2,bastion:2,ironclad:2,
    speeder:3,phantom:3,blur:3,comet:3,flash:3,
    bomber:4,devastator:4,scorcher:4,inferno:4,napalm:4,
    spore:5,tendril:5,hivemind:5,parasite:5,leech:5,
    mech:6,titan:6,colossus:6,golem:6,sentinel:6,
    swarmling:7,hornet:7,locust:7,mosquito:7,wasp:7,
    elite_drone:8,elite_fighter:8,elite_tank:8,warden:8,commander:8,
    nebula:9,pulsar:9,quasar:9,nova_enemy:9,singularity:9,
    shadow:10,wraith:10,specter:10,revenant:10,banshee:10,
    omega_drone:11,omega_fighter:11,omega_tank:11,omega_bomber:11,overlord:11,
    mythic_eye:12,mythic_hydra:12,mythic_phoenix:12,mythic_kraken:12,mythic_dragon:12,
    boss:0,
  };
  return TIER_MAP[type] ?? 0;
}
