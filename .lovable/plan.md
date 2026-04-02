

# Plan: Replace Tower Game Design with artginzburg/stack Style

## Summary
Replace the current "Glass/Neon" cyberpunk tower design with the clean, minimal design from the artginzburg/stack game: HSL color-cycling tiles on a black background, orthographic camera, proper shadows, white UI elements, and no environment stages (buildings, planets, etc.).

## What Changes

### Visual Design Changes
- **Background**: Solid black (#000) instead of dynamic gradient environments
- **Tiles**: HSL color-cycling (hue increments by 5 per block, 50% saturation, 50% lightness) instead of neon palette array
- **Camera**: Orthographic (isometric-like) instead of perspective, matching the original iOS game's feel
- **Lighting**: Single directional light with proper shadow casting, clean ambient light
- **Base tile**: Simple large box at the bottom (matching the tile color scheme) instead of hexagonal neon platform
- **No environment stages**: Remove StackEnvironment entirely (no cities, clouds, space, planets, stars)
- **Materials**: Simple MeshLambertMaterial/MeshStandardMaterial instead of MeshPhysicalMaterial with clearcoat
- **Perfect effect**: White expanding border planes instead of particle explosions
- **Score text**: White, clean, no outline glow

### Files to Modify
1. **`StackScene.tsx`** (major rewrite) - Core game rendering:
   - Replace PALETTES array with HSL color function
   - Switch to orthographic camera
   - Remove neon platform, replace with simple colored base box
   - Remove ring geometries, point lights around base
   - Remove edge glow, ghost guide
   - Simplify block materials (no clearcoat, no metalness)
   - Replace particle system with simple white perfect-effect planes
   - Simplify falling piece materials
   - Remove StackEnvironment import and usage
   - Clean score display (white text, no outline)

2. **`StackGameCanvas.tsx`** - Canvas setup:
   - Switch from perspective to orthographic camera
   - Change background from `#0f0a1e` to `#000`
   - Remove tone mapping (set to NoToneMapping)

3. **`StackEnvironment.tsx`** - Will no longer be imported by StackScene (can keep file but won't be used, or remove import)

### What Stays the Same
- All game logic (cutting, scoring, combos, perfect detection)
- StackGame.tsx (UI layer, backend integration, points, milestones)
- Audio systems (TowerAudioPro, StackStageAudio)
- onGameOver / onScoreUpdate callbacks
- autoPlay and debug features
- Speed multiplier logic
- All database/backend functionality

## Technical Details

### Color System
```typescript
function getTileColor(index: number): string {
  const hue = ((index + 1) * 5) % 360;
  return `hsl(${hue}, 50%, 50%)`;
}
function getBackgroundColor(index: number): string {
  return '#000';
}
```

### Camera (Orthographic)
```typescript
// In StackGameCanvas.tsx
<Canvas orthographic camera={{ position: [2, 5, 2], zoom: 40 }} ...>
```
The orthographic camera gives the flat, isometric look matching the original Stack game.

### Simplified Materials
```typescript
// Tiles use basic standard material, no clearcoat/metalness
<meshStandardMaterial color={tileColor} />
```

### Perfect Effect
Instead of particle explosions, use expanding white border planes (4 thin planes forming a rectangle border around the tile that fade out), matching the reference's `PerfectEffect.tsx` / `PlaneBorder.tsx` approach.

