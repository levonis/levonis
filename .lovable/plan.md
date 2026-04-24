## Plan

I will replace the current merge approach because the issue is real: the effect is being drawn as a separate fixed SVG layer (`LiquidIslandBridge`) above the base island, so it reads as an added sheet instead of one continuous material.

### What I will change

1. Remove the extra overlay merge layer
- Delete the shell-level `LiquidIslandBridge` render from `App.tsx`.
- Remove the shared `useLiquidFusion` bridge store if it is no longer needed.
- Stop using the current gooey SVG bridge that sits on top of the main island.

2. Rebuild the interaction as one visual surface
- Move the right orb merge rendering into the same visual system as the island instead of a separate layer.
- Keep the orb visible while scrolling, but make its motion and deformation happen as part of one coordinated composition.
- Use one host/container and one stacking context so the island and orb feel like the same glass body.

3. Replace the fake “bridge overlay” with a cleaner morph
- Use either a shared SVG/path or a single in-component masked shape so the neck/connection is part of the main shape, not painted above it.
- Match the same blur, highlight, border sheen, and shadow model across the orb and island.
- Remove any geometry that creates a visible “second skin” or floating layer.

4. Retune the motion
- Keep the right circular element present during scroll.
- Make the attraction slower and more controlled so it reads as absorption, not as a separate object sliding under/over another one.
- Reduce the exaggerated goo so the result is closer to Apple-like precision than a blob effect.

5. Preserve interaction and accessibility
- Keep the orb clickable before the merge threshold.
- Preserve RTL positioning and responsive behavior.
- Keep `prefers-reduced-motion` as a simplified non-morph translation.
- Keep the glass effect stable without extra transparency artifacts.

### Files likely affected
- `src/App.tsx`
- `src/components/ProfileOrb.tsx`
- `src/components/profileOrbMagnet.ts`
- `src/island/DynamicIsland.tsx`
- `src/index.css`
- Remove or stop using:
  - `src/components/LiquidIslandBridge.tsx`
  - `src/island/useLiquidFusion.ts`

### Technical details
- Root cause: the current implementation uses a separate fixed SVG layer at `z-[54]` between the island and orb, while the orb itself remains another independent glass surface at `z-[55]`. That creates the visible “layer above the original” artifact.
- Fix direction: use a single render pipeline for the island + orb morph so the merge is composed once, not stacked visually in multiple translucent layers.
- Result: cleaner material continuity, no extra floating sheet, and a more correct premium merge behavior.

Once approved, I’ll implement this refactor directly.