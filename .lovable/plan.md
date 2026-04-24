# Liquid-Glass Metaball Fusion: Profile Orb ↔ Dynamic Island

Replace the current "orb fades out" merge with a real metaball/liquid-glass effect. The orb is never removed — it is magnetically pulled toward the island, joined by a soft elastic neck (gooey bridge), then absorbed so both shapes read as one continuous liquid-glass surface.

## What changes for the user

- Scrolling down: the right (or left, in LTR) circular profile element glides toward the island instead of disappearing.
- A soft, glassy "neck" stretches between the two shapes — like two drops of mercury meeting.
- The neck thickens, the curvature blends, and at the end the orb is fully absorbed into the island as one unified pill.
- Scrolling back up: the process reverses — the island "spits out" the orb through the same liquid bridge.
- Same glassmorphism (blur, sheen, ring, shadows) on both shapes the entire time. No sharp edges, no fades, no pop.

## How it works (technical)

The effect uses the classic SVG **gooey filter** trick: a heavy blur followed by a high-contrast alpha threshold. Any two blurred shapes that overlap visually merge into one organic blob with smooth curvature — this is what produces the liquid bridge automatically, no manual path morphing required.

### 1. New component: `src/components/LiquidIslandBridge.tsx`

A fixed, pointer-events-none SVG layer rendered just above `<DynamicIsland />` and `<ProfileOrb />` in `App.tsx`. It owns:

- An SVG `<filter id="liquid-goo">` with `feGaussianBlur` (stdDeviation animated 6 → 14 with progress) + `feColorMatrix` alpha threshold to create the metaball merge.
- A `<g filter="url(#liquid-goo)">` containing two filled rects/ellipses positioned to mirror the live bounding boxes of the island and the orb. They share one fill (`hsl(var(--card) / 0.55)`) so the merged blob is visually continuous.
- A subtle "neck reinforcement" ellipse that sits between the two shapes and grows in width/height with progress to guarantee the bridge forms even when the gap is large.
- Reads its geometry from a small shared store (`src/island/useLiquidFusion.ts`) updated by `ProfileOrb` on every scroll/resize tick (already computed there: `dx`, `dy`, `gap`, `islandH`, `mergeProgress`, plus orb/island rects).

### 2. New shared store: `src/island/useLiquidFusion.ts`

Tiny zustand-free store using `useSyncExternalStore` (or a simple module-level emitter) exposing:

```ts
type FusionSnapshot = {
  progress: number;       // 0..1 eased
  orbRect: DOMRect | null;
  islandRect: DOMRect | null;
  isRtl: boolean;
};
```

`ProfileOrb` becomes the single producer (it already measures both rects); `LiquidIslandBridge` is the single consumer. This avoids prop drilling and keeps the existing orb logic intact.

### 3. Refactor `src/components/ProfileOrb.tsx`

- Stop hiding the orb. Remove the opacity → 0, blur dissolve, and `visibility: hidden` once `fullyMerged`. The orb stays fully visible all the way to the contact point; the SVG filter handles the visual "absorption".
- Keep the magnetic translate/scale (it's good), but tone down the late-stage stretch since the gooey filter now provides the organic deformation.
- On every compute tick, push `{ progress, orbRect, islandRect, isRtl }` into the new store.
- Once `progress >= ~0.92` (edges in contact), translate the orb's *content* (avatar/icon) opacity to 0 over a short window so only the glass shell remains — that shell is what fuses with the island under the filter. After full merge, the orb keeps occupying its translated position but with `pointer-events: none` so the island handles interaction.

### 4. Refactor `src/components/profileOrbMagnet.ts`

- Remove `opacity` dissolve and `blurPx` (filter handles blur).
- Add `contentOpacity` (avatar/icon fade in the last 15%).
- Add `neckWidth` and `neckHeight` outputs derived from `progress` and live `gap`, consumed by the bridge's reinforcement ellipse.
- Keep stretch/squash but cap it (`scaleX` max ~1.08, `scaleY` min ~0.92) — the gooey filter already exaggerates curvature.

### 5. Update `src/island/DynamicIsland.tsx`

- Add a `data-island-fill` matching color so the bridge SVG can sample the same `hsl(var(--card) / 0.55)`.
- No structural change. The island already exposes `[data-dynamic-island]`; the bridge reads its rect from there.

### 6. Mount order in `src/App.tsx`

```text
<DynamicIsland />
<LiquidIslandBridge />   ← new, sits between island and orb in z-order
<ProfileOrb />
```

Bridge `z-index: 54` (between island `z-50` and orb `z-55` is fine — the filter blob reads correctly because all three are on the same fixed plane and the blob fill matches the island/orb glass).

### 7. Accessibility & performance

- Wrap the filter blur in `@media (prefers-reduced-motion: reduce)` → fall back to the current simple translate (no goo, no stretch).
- The SVG layer is `width: 100vw; height: 80px` (only the top strip), `pointer-events: none`, `will-change: transform`. Filter only re-renders on scroll ticks already throttled by `requestAnimationFrame` in `ProfileOrb`.
- Mobile fallback: if `backdrop-filter` is unsupported, the gooey filter still works (it's pure SVG); only the inner glass tinting degrades, matching the rest of the app's existing fallbacks.

## Out of scope

- No changes to the island's content, search, or marquee logic.
- No new dependencies. All animation is CSS + existing `framer-motion` + native SVG filters.
- No change to the orb's click/navigation behavior or the profile expansion shell.

## Files touched

- `src/components/ProfileOrb.tsx` (refactor merge tail; publish geometry)
- `src/components/profileOrbMagnet.ts` (remove fade, add neck/content outputs)
- `src/components/LiquidIslandBridge.tsx` (new)
- `src/island/useLiquidFusion.ts` (new, ~40 lines)
- `src/island/DynamicIsland.tsx` (1 data attr)
- `src/App.tsx` (mount the bridge)
- `src/index.css` (one keyframe-free `.liquid-goo-svg` block + reduced-motion fallback)
