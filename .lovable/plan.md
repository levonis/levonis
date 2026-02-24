

# Plan: Pixel Art Games Hub Enhancement

## Summary

Four major changes to the `/games` page: hide the chat bubble, add a pixel-art background music radio system, redesign the page with pixel art aesthetics and a loading screen, and restructure game files for modularity.

---

## Technical Details

### 1. Hide Chat Bubble on `/games`

**File: `src/components/UnifiedChatButton.tsx`**
- Add `/games` to the `restrictedPaths` array (line 63-70). This immediately hides the chat bubble on the games page.

### 2. Pixel Art Background Music Radio

**New file: `src/components/games/PixelMusicRadio.tsx`**

A compact floating radio widget with pixel-art styling:
- **Web Audio API** generates 8-bit chiptune-style background music programmatically (no external audio files needed). Uses `OscillatorNode` with square/triangle waves and a simple melody sequencer to create retro pixel music.
- **3 "stations"** (channels): Calm Pixel, Retro Adventure, Chiptune Chill — each with a different tempo/melody pattern.
- **UI**: A small pixel-art styled radio panel in the corner with:
  - ON/OFF toggle (radio-style circle buttons using RadioGroup from radix)
  - Station selector buttons (3 stations)
  - Volume slider
  - Pixelated border and monospace font
- **Button click sounds**: Short beep via `OscillatorNode` (50ms square wave burst) on every button/filter click across the games page.
- State managed with `useState` + `useRef` for AudioContext.

### 3. Pixel Art Background & Loading Screen

**File: `src/pages/MiniGames.tsx`** — Major redesign:

**Loading Screen (new):**
- A `useState` controls a 2-3 second loading phase on mount.
- Shows a pixel-art loading animation: a progress bar made of pixel blocks that fills up, with "LOADING..." text in monospace, and animated pixel sprites.
- After loading completes, fades into the main games grid.

**Background redesign:**
- Animated pixel grid overlay using CSS (repeating gradients for grid lines).
- Floating pixel particles (small colored squares) animated with CSS keyframes moving slowly across the screen.
- Scanline effect overlay (semi-transparent horizontal lines).
- Stars/sparkle pixels that twinkle randomly.

**Page header:**
- Pixel-art styled title with text-shadow for a retro look.
- Monospace fonts throughout.

### 4. Separate Game Files

**Current structure:**
```text
src/components/games/
  RockPaperScissorsGame.tsx   (existing, 539 lines)
```

**New structure:**
```text
src/components/games/
  RockPaperScissorsGame.tsx   (stays as-is, already separate)
  PixelMusicRadio.tsx         (new - music radio widget)
  PixelLoadingScreen.tsx      (new - loading animation)
  PixelBackground.tsx         (new - animated background)
  GameSoundEffects.tsx        (new - hook for button click sounds)
```

Each component is self-contained for easy future modification. The `MiniGames.tsx` page composes them together.

### 5. Game Asset Design (itch.io reference)

Since itch.io game assets cannot be directly downloaded/hotlinked programmatically, all pixel art will be **CSS/Canvas-drawn** matching the aesthetic of popular itch.io pixel art packs:
- Game cards get pixelated borders (box-shadow steps instead of smooth shadows).
- Icons drawn with CSS pixel art technique (box-shadow pixel grids) or emoji with pixel filters.
- Color palette: dark greens, golds, and warm tones matching the site theme.

### 6. CSS Additions

**File: `src/index.css`** — New keyframes:
- `pixel-load`: Progress bar block animation
- `pixel-scanline`: Moving scanline effect
- `pixel-twinkle`: Star blinking
- `pixel-float-bg`: Background particle drift

---

## Files to Create
1. `src/components/games/PixelMusicRadio.tsx` — Radio widget with Web Audio API
2. `src/components/games/PixelLoadingScreen.tsx` — Loading animation component
3. `src/components/games/PixelBackground.tsx` — Animated pixel background
4. `src/components/games/useGameSounds.ts` — Hook for button click sounds

## Files to Edit
1. `src/components/UnifiedChatButton.tsx` — Add `/games` to restricted paths
2. `src/pages/MiniGames.tsx` — Integrate loading screen, background, music radio, sound effects
3. `src/index.css` — Add new pixel art keyframes

