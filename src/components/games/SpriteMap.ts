/**
 * Sprite coordinate map for BDragon1727 pixel UI asset pack.
 * Each sprite defines: sheet name, x/y offset, width/height in source pixels.
 *
 * Actual sheet dimensions (verified):
 *   00.png — 320×160  buttons, bars, stars, hearts, diamonds, icons
 *   01.png — 272×144  badges/shields (4 cols × 3 rows, each ~68×48)
 *   02.png — 256×160  pixel frames
 *   03.png — 240×144  loading spinners (5 cols × 3 rows, each ~48×48)
 *   04.png — 336×240  scroll bars
 *   05.png — 384×32   segmented health bars
 *   06.png — 256×240  loading/progress bars
 *   07.png — 144×288  indicators, lines, dots
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
  direction?: "horizontal" | "vertical";
  speed?: number;
}

// ── 00.png (320×160): Bars, stars, hearts, icons ──────────────

export const SPRITE_BUTTONS = {
  BLUE_NORMAL: { sheet: "00", x: 0, y: 80, w: 48, h: 16 } as SpriteCoords,
  BLUE_HOVER:  { sheet: "00", x: 48, y: 80, w: 48, h: 16 } as SpriteCoords,
  GREEN_NORMAL:{ sheet: "00", x: 0, y: 96, w: 48, h: 16 } as SpriteCoords,
  RED_NORMAL:  { sheet: "00", x: 48, y: 96, w: 48, h: 16 } as SpriteCoords,
};

export const SPRITE_ICONS = {
  // Stars row — y=112, 16×16 each
  STAR_EMPTY:  { sheet: "00", x: 0,  y: 112, w: 16, h: 16 } as SpriteCoords,
  STAR_HALF:   { sheet: "00", x: 16, y: 112, w: 16, h: 16 } as SpriteCoords,
  STAR_FULL:   { sheet: "00", x: 64, y: 112, w: 16, h: 16 } as SpriteCoords,
  // Hearts — same row, after stars
  HEART_EMPTY: { sheet: "00", x: 80, y: 112, w: 16, h: 16 } as SpriteCoords,
  HEART_HALF:  { sheet: "00", x: 96, y: 112, w: 16, h: 16 } as SpriteCoords,
  HEART_FULL:  { sheet: "00", x: 112, y: 112, w: 16, h: 16 } as SpriteCoords,
  // Colored gems/shapes — right side of sheet
  DIAMOND_GRAY:   { sheet: "00", x: 208, y: 48, w: 16, h: 16 } as SpriteCoords,
  DIAMOND_GREEN:  { sheet: "00", x: 224, y: 48, w: 16, h: 16 } as SpriteCoords,
  DIAMOND_YELLOW: { sheet: "00", x: 240, y: 48, w: 16, h: 16 } as SpriteCoords,
  DIAMOND_RED:    { sheet: "00", x: 256, y: 48, w: 16, h: 16 } as SpriteCoords,
  // Coins/gems — right columns
  COIN:      { sheet: "00", x: 176, y: 48, w: 16, h: 16 } as SpriteCoords,
  GEM_BLUE:  { sheet: "00", x: 192, y: 48, w: 16, h: 16 } as SpriteCoords,
  GEM_GREEN: { sheet: "00", x: 176, y: 64, w: 16, h: 16 } as SpriteCoords,
  // Trophy — face/badge icon
  TROPHY:    { sheet: "00", x: 160, y: 112, w: 16, h: 16 } as SpriteCoords,
  // Large stars (32×32 at bottom)
  STAR_LARGE_EMPTY: { sheet: "00", x: 0,  y: 128, w: 32, h: 32 } as SpriteCoords,
  STAR_LARGE_FULL:  { sheet: "00", x: 96, y: 128, w: 32, h: 32 } as SpriteCoords,
};

// ── 01.png (272×144): Badges/shields — 4 cols × 3 rows, each 68×48 ──

export const SPRITE_BADGES = {
  // Row 0: Wing shapes + shield outlines
  SHIELD_GOLD:   { sheet: "01", x: 0,   y: 0,  w: 68, h: 48 } as SpriteCoords,
  SHIELD_SILVER: { sheet: "01", x: 204, y: 0,  w: 68, h: 48 } as SpriteCoords,
  SHIELD_BRONZE: { sheet: "01", x: 68,  y: 0,  w: 68, h: 48 } as SpriteCoords,
  // Row 1: Colored shield blobs
  SHIELD_BLUE:   { sheet: "01", x: 204, y: 48, w: 68, h: 48 } as SpriteCoords,
  SHIELD_GREEN:  { sheet: "01", x: 136, y: 48, w: 68, h: 48 } as SpriteCoords,
  SHIELD_RED:    { sheet: "01", x: 68,  y: 48, w: 68, h: 48 } as SpriteCoords,
  // Row 2: Detailed winged badges
  BADGE_GOLD:    { sheet: "01", x: 0,   y: 96, w: 68, h: 48 } as SpriteCoords,
  BADGE_RED:     { sheet: "01", x: 68,  y: 96, w: 68, h: 48 } as SpriteCoords,
  BADGE_BLUE:    { sheet: "01", x: 136, y: 96, w: 68, h: 48 } as SpriteCoords,
  BADGE_SILVER:  { sheet: "01", x: 204, y: 96, w: 68, h: 48 } as SpriteCoords,
};

// ── 02.png (256×160): Pixel frames ───────────────────────────

export const SPRITE_FRAMES = {
  FRAME_GOLD:   { sheet: "02", x: 0,  y: 0,  w: 32, h: 32 } as SpriteCoords,
  FRAME_SILVER: { sheet: "02", x: 32, y: 0,  w: 32, h: 32 } as SpriteCoords,
  FRAME_GREEN:  { sheet: "02", x: 0,  y: 32, w: 32, h: 32 } as SpriteCoords,
  FRAME_BLUE:   { sheet: "02", x: 32, y: 32, w: 32, h: 32 } as SpriteCoords,
};

// ── 03.png (240×144): Loading spinners — 5 cols × 3 rows, each 48×48 ──

export const SPRITE_SPINNERS = {
  SPINNER_GOLD: {
    sheet: "03", x: 0, y: 0, w: 48, h: 48,
    frames: 5, direction: "horizontal", speed: 150,
  } as AnimatedSpriteCoords,
  SPINNER_GREEN: {
    sheet: "03", x: 0, y: 48, w: 48, h: 48,
    frames: 5, direction: "horizontal", speed: 150,
  } as AnimatedSpriteCoords,
  SPINNER_BLUE: {
    sheet: "03", x: 0, y: 96, w: 48, h: 48,
    frames: 5, direction: "horizontal", speed: 150,
  } as AnimatedSpriteCoords,
};

// ── 04.png (336×240): Scroll bars ────────────────────────────

export const SPRITE_SCROLLBARS = {
  SCROLLBAR_GOLD:  { sheet: "04", x: 0, y: 0,  w: 48, h: 16 } as SpriteCoords,
  SCROLLBAR_TRACK: { sheet: "04", x: 0, y: 16, w: 48, h: 16 } as SpriteCoords,
};

// ── 05.png (384×32): Segmented health bars ───────────────────

export const SPRITE_HEALTH = {
  BAR_FRAME:       { sheet: "05", x: 0,  y: 0,  w: 48, h: 16 } as SpriteCoords,
  BAR_GREEN_FILL:  { sheet: "05", x: 48, y: 0,  w: 48, h: 16 } as SpriteCoords,
  BAR_RED_FILL:    { sheet: "05", x: 96, y: 0,  w: 48, h: 16 } as SpriteCoords,
  BAR_YELLOW_FILL: { sheet: "05", x: 144, y: 0, w: 48, h: 16 } as SpriteCoords,
};

// ── 06.png (256×240): Loading/progress bars ──────────────────

export const SPRITE_PROGRESS = {
  PROGRESS_FRAME: { sheet: "06", x: 0, y: 0,  w: 64, h: 16 } as SpriteCoords,
  PROGRESS_GREEN: { sheet: "06", x: 0, y: 32, w: 64, h: 16 } as SpriteCoords,
  PROGRESS_BLUE:  { sheet: "06", x: 0, y: 64, w: 64, h: 16 } as SpriteCoords,
  PROGRESS_RED:   { sheet: "06", x: 0, y: 96, w: 64, h: 16 } as SpriteCoords,
  PROGRESS_GOLD:  { sheet: "06", x: 0, y: 128, w: 64, h: 16 } as SpriteCoords,
};

// ── 07.png (144×288): Indicators, dots, lines ────────────────

export const SPRITE_INDICATORS = {
  DOT_GREEN:    { sheet: "07", x: 0,  y: 0,  w: 16, h: 16 } as SpriteCoords,
  DOT_RED:      { sheet: "07", x: 16, y: 0,  w: 16, h: 16 } as SpriteCoords,
  DOT_YELLOW:   { sheet: "07", x: 32, y: 0,  w: 16, h: 16 } as SpriteCoords,
  LINE_GOLD:    { sheet: "07", x: 48, y: 0,  w: 48, h: 8 } as SpriteCoords,
  ARROW_RIGHT:  { sheet: "07", x: 0,  y: 128, w: 16, h: 16 } as SpriteCoords,
  ARROW_LEFT:   { sheet: "07", x: 16, y: 128, w: 16, h: 16 } as SpriteCoords,
};
