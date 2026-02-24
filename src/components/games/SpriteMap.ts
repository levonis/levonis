/**
 * Sprite coordinate map for BDragon1727 pixel UI asset pack.
 * Each sprite defines: sheet name, x/y offset, width/height in source pixels.
 * For animated sprites: frames count + direction.
 *
 * Sheet reference:
 *   00.png — buttons, health bars, stars, hearts, diamonds, icons
 *   01.png — colored badges/shields, wings
 *   02.png — pixel frames (various colors)
 *   03.png — loading spinners (animated)
 *   04.png — scroll bars
 *   05.png — segmented health bars
 *   06.png — loading/health bars (various colors)
 *   07.png — indicators, lines, dots
 */

export interface SpriteCoords {
  sheet: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AnimatedSpriteCoords extends SpriteCoords {
  frames: number;
  /** Direction frames are laid out: 'horizontal' (default) or 'vertical' */
  direction?: "horizontal" | "vertical";
  /** ms per frame */
  speed?: number;
}

// ── 00.png: Buttons, stars, hearts, diamonds, misc icons ──────

export const SPRITE_BUTTONS = {
  // Top row: button states (normal, hover, pressed) in different colors
  BLUE_NORMAL: { sheet: "00", x: 0, y: 0, w: 16, h: 16 } as SpriteCoords,
  BLUE_HOVER: { sheet: "00", x: 16, y: 0, w: 16, h: 16 } as SpriteCoords,
  GREEN_NORMAL: { sheet: "00", x: 32, y: 0, w: 16, h: 16 } as SpriteCoords,
  RED_NORMAL: { sheet: "00", x: 48, y: 0, w: 16, h: 16 } as SpriteCoords,
};

export const SPRITE_ICONS = {
  // Stars row
  STAR_EMPTY: { sheet: "00", x: 0, y: 48, w: 16, h: 16 } as SpriteCoords,
  STAR_HALF: { sheet: "00", x: 16, y: 48, w: 16, h: 16 } as SpriteCoords,
  STAR_FULL: { sheet: "00", x: 32, y: 48, w: 16, h: 16 } as SpriteCoords,
  // Hearts
  HEART_EMPTY: { sheet: "00", x: 0, y: 32, w: 16, h: 16 } as SpriteCoords,
  HEART_FULL: { sheet: "00", x: 16, y: 32, w: 16, h: 16 } as SpriteCoords,
  HEART_HALF: { sheet: "00", x: 32, y: 32, w: 16, h: 16 } as SpriteCoords,
  // Diamonds (difficulty indicators)
  DIAMOND_GRAY: { sheet: "00", x: 0, y: 64, w: 16, h: 16 } as SpriteCoords,
  DIAMOND_GREEN: { sheet: "00", x: 16, y: 64, w: 16, h: 16 } as SpriteCoords,
  DIAMOND_YELLOW: { sheet: "00", x: 32, y: 64, w: 16, h: 16 } as SpriteCoords,
  DIAMOND_RED: { sheet: "00", x: 48, y: 64, w: 16, h: 16 } as SpriteCoords,
  // Coins/gems
  COIN: { sheet: "00", x: 0, y: 80, w: 16, h: 16 } as SpriteCoords,
  GEM_BLUE: { sheet: "00", x: 16, y: 80, w: 16, h: 16 } as SpriteCoords,
  GEM_GREEN: { sheet: "00", x: 32, y: 80, w: 16, h: 16 } as SpriteCoords,
  // Trophy
  TROPHY: { sheet: "00", x: 48, y: 80, w: 16, h: 16 } as SpriteCoords,
};

// ── 01.png: Badges / shields ──────────────────────────────────

export const SPRITE_BADGES = {
  SHIELD_GOLD: { sheet: "01", x: 0, y: 0, w: 32, h: 32 } as SpriteCoords,
  SHIELD_SILVER: { sheet: "01", x: 32, y: 0, w: 32, h: 32 } as SpriteCoords,
  SHIELD_BRONZE: { sheet: "01", x: 64, y: 0, w: 32, h: 32 } as SpriteCoords,
  SHIELD_BLUE: { sheet: "01", x: 0, y: 32, w: 32, h: 32 } as SpriteCoords,
  SHIELD_GREEN: { sheet: "01", x: 32, y: 32, w: 32, h: 32 } as SpriteCoords,
  SHIELD_RED: { sheet: "01", x: 64, y: 32, w: 32, h: 32 } as SpriteCoords,
};

// ── 02.png: Pixel frames ─────────────────────────────────────

export const SPRITE_FRAMES = {
  FRAME_GOLD: { sheet: "02", x: 0, y: 0, w: 48, h: 48 } as SpriteCoords,
  FRAME_SILVER: { sheet: "02", x: 48, y: 0, w: 48, h: 48 } as SpriteCoords,
  FRAME_GREEN: { sheet: "02", x: 0, y: 48, w: 48, h: 48 } as SpriteCoords,
  FRAME_BLUE: { sheet: "02", x: 48, y: 48, w: 48, h: 48 } as SpriteCoords,
};

// ── 03.png: Loading spinners (animated) ──────────────────────

export const SPRITE_SPINNERS = {
  SPINNER_GOLD: {
    sheet: "03", x: 0, y: 0, w: 16, h: 16,
    frames: 8, direction: "horizontal", speed: 100,
  } as AnimatedSpriteCoords,
  SPINNER_GREEN: {
    sheet: "03", x: 0, y: 16, w: 16, h: 16,
    frames: 8, direction: "horizontal", speed: 100,
  } as AnimatedSpriteCoords,
  SPINNER_BLUE: {
    sheet: "03", x: 0, y: 32, w: 16, h: 16,
    frames: 8, direction: "horizontal", speed: 100,
  } as AnimatedSpriteCoords,
  SPINNER_RED: {
    sheet: "03", x: 0, y: 48, w: 16, h: 16,
    frames: 8, direction: "horizontal", speed: 100,
  } as AnimatedSpriteCoords,
};

// ── 04.png: Scroll bars ──────────────────────────────────────

export const SPRITE_SCROLLBARS = {
  SCROLLBAR_GOLD: { sheet: "04", x: 0, y: 0, w: 48, h: 8 } as SpriteCoords,
  SCROLLBAR_TRACK: { sheet: "04", x: 0, y: 8, w: 48, h: 8 } as SpriteCoords,
};

// ── 05.png: Segmented health bars ────────────────────────────

export const SPRITE_HEALTH = {
  BAR_FRAME: { sheet: "05", x: 0, y: 0, w: 64, h: 16 } as SpriteCoords,
  BAR_GREEN_FILL: { sheet: "05", x: 0, y: 16, w: 64, h: 16 } as SpriteCoords,
  BAR_RED_FILL: { sheet: "05", x: 0, y: 32, w: 64, h: 16 } as SpriteCoords,
  BAR_YELLOW_FILL: { sheet: "05", x: 0, y: 48, w: 64, h: 16 } as SpriteCoords,
};

// ── 06.png: Loading/progress bars ────────────────────────────

export const SPRITE_PROGRESS = {
  PROGRESS_FRAME: { sheet: "06", x: 0, y: 0, w: 80, h: 16 } as SpriteCoords,
  PROGRESS_GREEN: { sheet: "06", x: 0, y: 16, w: 80, h: 16 } as SpriteCoords,
  PROGRESS_BLUE: { sheet: "06", x: 0, y: 32, w: 80, h: 16 } as SpriteCoords,
  PROGRESS_RED: { sheet: "06", x: 0, y: 48, w: 80, h: 16 } as SpriteCoords,
  PROGRESS_GOLD: { sheet: "06", x: 0, y: 64, w: 80, h: 16 } as SpriteCoords,
};

// ── 07.png: Indicators, dots, lines ──────────────────────────

export const SPRITE_INDICATORS = {
  DOT_GREEN: { sheet: "07", x: 0, y: 0, w: 8, h: 8 } as SpriteCoords,
  DOT_RED: { sheet: "07", x: 8, y: 0, w: 8, h: 8 } as SpriteCoords,
  DOT_YELLOW: { sheet: "07", x: 16, y: 0, w: 8, h: 8 } as SpriteCoords,
  LINE_GOLD: { sheet: "07", x: 0, y: 8, w: 48, h: 4 } as SpriteCoords,
  ARROW_RIGHT: { sheet: "07", x: 0, y: 16, w: 16, h: 16 } as SpriteCoords,
  ARROW_LEFT: { sheet: "07", x: 16, y: 16, w: 16, h: 16 } as SpriteCoords,
};
