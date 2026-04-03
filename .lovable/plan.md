

# Knife Rain Game - Build Plan

A new 2D canvas game where players throw knives at a rotating wooden target. The target progresses through damage stages, with boss rounds featuring special targets (candy). Uses the uploaded assets for knife, wood stages, boss, and backgrounds.

## Game Concept
- A wooden log rotates in the center of the screen
- Player taps to throw knives that stick into the log
- Each knife stuck = points. Hit all required knives without hitting another knife = stage complete
- Wood shows progressive damage (normal → 1 hit → 2 hits → 3 hits) across stages
- Boss stages use the candy target (harder, faster rotation)
- Backgrounds alternate between Back_1 (green) and Back_2 (orange)
- Web Audio API sound effects (knife throw, stick, hit-knife fail, stage clear, boss defeat)

## Implementation Steps

### 1. Copy Assets to Project
Copy all 8 uploaded images into `src/assets/knife-rain/`:
- `Normal_Knif.png`, `Normal_Wood_1.png`, `Wood_1-_1_Hit.png`, `Wood_1_2Hits.png`, `Wood_1_3Hits.png`, `Candy_4.png`, `Back_1.png`, `Back_2.png`

### 2. Database Setup (Migration)
Create tables mirroring the Stack Game pattern:
- **`knife_rain_settings`** — game_enabled, entry_fee_tickets, points_per_knife, stage_clear_bonus, boss_bonus, game_points_per_knife, game_combo_multiplier, total_plays, total_points_distributed
- **`knife_rain_sessions`** — user_id, session_token, status, score, started_at, ended_at
- **`knife_rain_high_scores`** — user_id, high_score, best_stage
- **`knife_rain_milestones`** — target_score, prize_name_ar, product_id, selected_color, selected_option_id, stock, claimed_count, is_active
- **`knife_rain_leaderboard_prizes`** — position, prize_name_ar, product_id, etc., is_active
- **`knife_rain_winners`** — user_id, prize_type, prize_name, awarded_at
- RPC functions: `start_knife_rain`, `end_knife_rain`, `update_knife_rain_high_score`, `check_knife_rain_milestone`, `claim_knife_rain_prize_to_cart`
- RLS policies following the same pattern as stack_game (public read settings, authenticated play, admin update)

### 3. Build Game Component (`src/components/games/knife-rain/`)
- **KnifeRainGame.tsx** — Main wrapper (menu / playing / gameover states), ticket logic, leaderboard, milestones, winners — mirrors StackGame.tsx structure
- **KnifeRainCanvas.tsx** — HTML5 Canvas 2D game engine:
  - Rotating target (wood/boss image) in center
  - Knife throwing on tap/click from bottom
  - Collision detection (knife hits target vs knife hits existing knife)
  - Stage progression system with damage visuals
  - Boss rounds every N stages
  - Background image switching per stage group
- **KnifeRainAudio.ts** — Web Audio API sounds (throw whoosh, stick thud, fail buzz, stage clear chime, boss defeat)

### 4. Admin Tab (`src/components/admin/KnifeRainTab.tsx`)
Following SpaceBlasterTab/StackGameTab pattern:
- Toggle game on/off
- Entry fee (tickets), points per knife, stage bonus, boss bonus
- Game score multipliers
- Milestone prizes management (with ProductPicker)
- Leaderboard prizes management
- Stats display (total plays, total points distributed)

### 5. Wire Into Existing Systems
- **GamesData.ts** — Add `knife_rain` GameResource node (status: LIVE, category: STRATEGY)
- **MiniGames.tsx** — Add lazy import for KnifeRainGame, add to activeGame render, add settings query for enabled check
- **AdminGamesSettings.tsx** — Add KnifeRainTab to tabs array with a knife/target icon
- **Route** — No new route needed (renders inline like other games)

### 6. Leaderboard & Rewards
- Same season-based leaderboard pattern as Stack Game
- Mid-game milestone checks via RPC (prize popup during gameplay)
- Game-over score submission and high score tracking
- Points awarded to user's website points balance

## Technical Details

**Canvas approach**: HTML5 Canvas 2D (no Three.js needed — this is a 2D game). Uses `requestAnimationFrame` loop with image sprites for knife/target/background.

**Stage system**: Array of stage configs defining target image, rotation speed, knives required, and whether it's a boss stage. Difficulty increases with faster rotation and more knives needed.

**Collision**: Angular collision — each stuck knife occupies an angle on the circle. New knife fails if it lands within a threshold angle of any existing knife.

**Files created**: ~6 new files, 4 files modified, 1 migration

