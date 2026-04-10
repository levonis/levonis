
I checked the current Crossy Road code, and your complaint is valid: the last attempt changed the movement logic, but the real problem is mostly visual alignment/orientation.

Plan:

1. Restore movement controls and fix only the player visual facing
- Revert `A/D` and left/right lane movement in `handleMove` so controls stay normal.
- Fix the chicken “design direction” by adjusting `playerRotation` only.
- Add a single base yaw offset for the chicken model so its mesh faces the correct world direction without changing gameplay movement.

2. Fix log landing and leaving using real visual X, not nearest-log snapping
- Stop snapping to the “nearest log” when landing on a river row, because that is what pulls the player into the wrong log.
- Use the player’s actual carried X position when jumping between river rows.
- Only attach to a log if that actual X is inside that log’s real bounds.
- When leaving the river, compute the real visual X and snap that to the correct lane with clamp.

3. Fix player height while standing on logs
- The player is currently always rendered at ground height, while logs are raised meshes.
- Add a player base Y offset when the player is on a log so the chicken stands on top of the log instead of intersecting it.
- Interpolate that height cleanly during jump/landing so it does not pop.

4. Fix train model orientation and segment spacing from the actual OBJ dimensions
- The train models are already long on the X axis, so the current 90° Y rotation is incorrect.
- Remove/correct the train rotation so the train length aligns with movement on X.
- Replace the fake `partWidth = 1.5` spacing with spacing based on the real train model size.
- Update spawn X, rendered group length, collision width, and off-screen reset threshold so the visuals and hitbox match.

5. Make train warning guaranteed before the train appears
- Replace the current “same timer does everything” behavior with a clear warning phase before spawn.
- Keep the warning visible for a guaranteed duration before the train is created.
- Make the warning more visible by raising it above the track and strengthening the pulse/opacity.

6. Improve large-screen desktop framing
- The fullscreen container is already correct; the issue is the orthographic framing on wide screens.
- Update `useResponsiveZoom` to consider wide desktop aspect ratios instead of only `innerHeight / 10`.
- Increase the allowed desktop zoom range so the playfield fills more of a 1790px-wide screen.
- If needed, slightly tune camera position/look target to keep the board centered after the zoom change.

Files to update
- `src/components/games/crossy-road/CrossyRoad3DScene.tsx`
  - restore normal left/right lane movement
  - fix player mesh facing
  - fix log attach/leave logic with real X
  - add standing-on-log height
  - fix train rotation, spacing, spawn, width, warning phase
- `src/components/games/crossy-road/CrossyRoadCanvas.tsx`
  - improve desktop orthographic zoom calculation

Technical notes
- The current bug is not mainly input mapping; it is the mesh orientation plus bad river/train rendering logic.
- The biggest log bug is that the code still falls back to the nearest log and keeps the player at ground Y.
- The biggest train bug is that the train OBJ appears to already be oriented along X, so rotating it by 90° makes the segments align incorrectly.
- `MiniGames.tsx` already gives Crossy Road a fullscreen route path, so I would not change that unless verification proves otherwise.
