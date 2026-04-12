

# Fix Crossy Road — Traffic Light, Player Height, Camera, Difficulty, Biomes, Score

## Issues Found

1. **Traffic lights hidden on mobile**: Scale is too small (pole 0.04 radius, total height ~1.3 units). On mobile zoom they're invisible.
2. **Player legs inside grass**: Player Y position is `0` on grass — the model origin is likely at the feet, needs a small Y offset (~0.15).
3. **Score/points not calculated from DB settings**: `end_crossy_road` RPC still uses `points_per_step`/`bonus_coin_points` only for site points. It returns `p_score` raw without computing `game_score` from `score_per_step`/`score_per_coin`. Also `max_daily_points` is never checked.
4. **Camera position**: Player appears at center — should be 25% from bottom (camera `lookAt` needs to shift so player appears lower on screen).
5. **Difficulty starts too late**: Currently ramps over 80 rows. Should increase noticeably after row 50.
6. **Biomes start too early**: Currently every 18 rows. Should start at row 100+.

---

## Changes

### 1. Traffic Lights — Scale Up (`CrossyRoad3DScene.tsx`)
- Scale up the entire `TrafficLight` group by ~2x (`<group scale={[2,2,2]}>`)
- Move position slightly outward so it doesn't overlap the road

### 2. Player Y Offset (`CrossyRoad3DScene.tsx`)
- Add `PLAYER_Y_OFFSET = 0.15` for grass/road/rail rows
- On river, keep existing `LOG_Y_OFFSET + PLAYER_Y_OFFSET`
- Line ~804: `const baseY = isOnRiver ? LOG_Y_OFFSET + 0.15 : 0.15;`

### 3. Camera — Player at 25% from Bottom (`CrossyRoad3DScene.tsx` + `CrossyRoadCanvas.tsx`)
- Camera follow: change `targetZ = -(g.playerRow - 5) * CELL` → `-(g.playerRow - 3) * CELL` (shifts view so player is lower on screen)
- `lookAt` in Canvas: shift from `(4.5, 0, -2)` → `(4.5, 0, -4)` to look further ahead

### 4. Score/Points RPC Fix (Migration)
Update `end_crossy_road` to:
```sql
-- Calculate game_score from score settings
v_game_score := (p_steps * COALESCE(v_settings.score_per_step, 1)) 
              + (p_coins * COALESCE(v_settings.score_per_coin, 5));
-- Calculate site points  
v_points := (p_steps * v_settings.points_per_step) 
           + (p_coins * v_settings.bonus_coin_points);
-- Check daily points limit
IF v_settings.max_daily_points IS NOT NULL THEN
  SELECT COALESCE(SUM(points_awarded),0) INTO v_today 
  FROM crossy_road_sessions 
  WHERE user_id = v_user_id AND ended_at::date = CURRENT_DATE AND status='completed';
  IF v_today >= v_settings.max_daily_points THEN v_points := 0; END IF;
END IF;
-- Return v_game_score as game_score
```

### 5. Difficulty — Earlier Ramp (`CrossyRoad3DScene.tsx`)
Change `getDifficulty`:
```ts
// Ramps from 0→1 over 50 rows (was 80), continues after
return Math.min(index / 50, 1) + Math.max(0, (index - 50) / 150);
```

### 6. Biomes — Start at Row 100 (`CrossyRoad3DScene.tsx`)
Change `getBiome`:
```ts
if (index < 100) return "green";
const adjusted = index - 100;
const biomes = ["desert", "snow", "dark_forest"];
return biomes[Math.floor(adjusted / 20) % biomes.length];
```

---

## Files
- `CrossyRoad3DScene.tsx` — traffic light scale, player Y, camera follow, difficulty, biomes
- `CrossyRoadCanvas.tsx` — lookAt adjustment
- **New migration** — fix `end_crossy_road` for `score_per_step`, `score_per_coin`, `max_daily_points`

