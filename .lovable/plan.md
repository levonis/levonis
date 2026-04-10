

# Crossy Road — Comprehensive Fix Plan

## Issues & Fixes

### 1. Controls: Use A/S/D + Space
**Current**: W/A/S/D mapped to up/left/down/right. No space support.
**Fix**: Remap keys — `A` = left, `S` = down, `D` = right, `Space` = jump (forward/up). Remove `W` mapping.

### 2. Chicken face direction reversed
**Current**: `playerRotation` uses `Math.PI` for up, `0` for down, etc. The chicken model's default facing direction is likely opposite.
**Fix**: Add `Math.PI` offset to all rotation values so the chicken's front face matches the movement direction. If the model faces +Z by default, we flip the base:
- up → `0` (not `Math.PI`)
- down → `Math.PI`
- left → `-Math.PI/2`
- right → `Math.PI/2`

### 3. Train warning: Traffic light instead of red tile
**Current**: Warning is a red box on the ground. User wants a visual traffic light that glows.
**Fix**: Replace `WarningTile` with a `TrafficLight` component — a pole with 3 circles (red/yellow/green). During warning phase, red light glows with emissive pulsing. When no warning, green light is on. Place it at the side of each rail row. Keep the alarm sound.

### 4. Cars spawning overlapping (2 stuck together)
**Current**: Cars spawn at `Math.random() * LANES * CELL` — two cars can land on same position.
**Fix**: Space car spawn positions by dividing the lane width evenly and adding random offset within segments, ensuring minimum gap of `2 * CELL` between any two cars.

### 5. Train segments stuck/overlapping
**Current**: `TRAIN_PART_WIDTH = 2.0` may not match actual model size. Train models might need rotation to align along X.
**Fix**: Add `rotation={[0, Math.PI/2, 0]}` to each train mesh so they face the correct direction along X. Increase `TRAIN_PART_WIDTH` to `2.5` to prevent overlap. Adjust `TRAIN_SPAWN_X` accordingly.

### 6. Log issues (player inside log, fake long logs)
**Current**: `log.width = 1.2` but log mesh is scaled by `data.logWidth` on X, stretching arbitrarily. The `playerOffsetX` snapping logic uses a wide tolerance `±0.5`.
**Fix**:
- Set `log.width` to `1.0` (natural model width) — remove the X-scale stretch (`logWidth`) from `LogMesh`, use uniform `MODEL_SCALE` instead.
- Tighten log collision tolerance to `±0.3`.
- When landing on a log, calculate offset so the player stands at the log's center, not stretched edge.

### 7. Objects too big on mobile
**Current**: `computeZoom` uses `h / 10` which gives high zoom on mobile (e.g. 812/10 = 81).
**Fix**: Detect mobile via aspect ratio (`w < h`). For mobile, use `h / 14` instead of `h / 10` to shrink objects. Cap mobile zoom at ~65.

### 8. Canvas not filling very large screens
**Current**: Zoom capped at 140, wide-screen boost uses `w / 18`.
**Fix**: For ultra-wide screens (`w > 1600`), use `w / 14` and raise max cap to 160.

### 9. Trees are not solid — chicken passes through
**Current**: Trees are visual only, no collision check.
**Fix**: In the collision section of the game loop, check if the player's current row is grass and the player's lane matches a `treeIndices` entry. If so, block the move — revert `playerLane`/`playerRow` to `fromLane`/`fromRow` in `handleMove`.

## Files to Edit

### `CrossyRoad3DScene.tsx`
- Remap keys: A=left, S=down, D=right, Space=up
- Fix chicken rotation values (reverse all by π)
- Replace `WarningTile` with `TrafficLight` component (pole + 3 lights)
- Fix car spawn spacing (minimum gap)
- Add train mesh rotation and adjust part width
- Fix log width to 1.0, remove X-stretch scale
- Add tree collision blocking in `handleMove`

### `CrossyRoadCanvas.tsx`
- Update `computeZoom` for mobile (smaller zoom) and ultra-wide (larger zoom)

