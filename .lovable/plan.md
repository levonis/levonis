
## Glassmorphism Skeletons + Smooth Page Reveal

Goal: upgrade skeleton placeholders to a frosted-glass look that matches the app's glassmorphism style, and make real content fade/slide in gracefully (no abrupt swap).

### 1. Glass skeleton primitive
File: `src/components/ui/skeleton.tsx`

Replace the flat `bg-muted` block with a frosted-glass shimmer:
- Translucent base: `bg-white/5` (auto-adapts in light/dark via theme tokens)
- `backdrop-blur-xl` + subtle border `border-white/10`
- Soft inner highlight: `before:` overlay with a moving white→transparent gradient (shimmer sweep, 1.6s)
- Keep `animate-pulse` as a low-opacity pulse beneath the shimmer
- Exposed via the same `<Skeleton>` API → every existing skeleton instantly gains the glass look with zero refactors

Add the shimmer keyframe in `tailwind.config.ts` (`shimmer: translateX(-100% → 100%)`) and a utility class `.skeleton-glass` in `src/index.css` for the gradient mask, so it works site-wide.

### 2. Refined page-shaped skeletons
File: `src/components/ui/PageSkeletons.tsx`

- Wrap each page skeleton root in a `bg-transparent` container and add a faint vignette so the shimmer reads on any background.
- Replace generic card wrappers (`Card`/`CardContent`) used in `GridCardsSkeleton`, `ListCardsSkeleton`, `CartSkeleton`, `OrderListSkeleton`, `NotificationsSkeleton`, `CompetitionGridSkeleton`, `ProductGridSkeleton`, `HomePageSkeleton`'s category tiles, etc., with a glass shell:
  ```
  rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl
  ```
  matching the real product/category cards (per `mem://ui/styling/product-card-glassmorphism`).
- Keep all existing dimensions (no layout-shift regressions).

### 3. Smooth reveal of real content
File: `src/components/RouteAwareSkeleton.tsx` and a new `src/components/PageFade.tsx`

- Bump skeleton fade duration to 250ms with `ease-out`.
- Create `PageFade`: a tiny wrapper using Tailwind `animate-in fade-in slide-in-from-bottom-1 duration-300` that pages mount inside. Apply it once at the `<Suspense>` boundary by wrapping `<Routes>` output via a small `<RouteFade>` keyed on `location.pathname` in `src/App.tsx`. This gives every route a uniform graceful entrance without touching individual pages.
- Cross-fade feel: skeleton fades out (200ms) while page fades+slides in (300ms) — perceived as a single smooth reveal, not a jump.

### 4. Respect reduced motion
In `src/index.css`, gate the shimmer and slide-in under `@media (prefers-reduced-motion: no-preference)` so accessibility is preserved.

### Files touched
- `src/components/ui/skeleton.tsx` (glass + shimmer)
- `src/components/ui/PageSkeletons.tsx` (glass card shells)
- `src/components/RouteAwareSkeleton.tsx` (smoother fade-out)
- `src/components/PageFade.tsx` (new — route entrance animation)
- `src/App.tsx` (wrap `<Routes>` with `<RouteFade>`)
- `tailwind.config.ts` (shimmer keyframe + animation)
- `src/index.css` (`.skeleton-glass` utility + reduced-motion guard)

### Out of scope
- No data-fetch refactors; pages still mount as soon as React Query/Suspense resolves. The "fully loaded before swap" feel is achieved by the cross-fade timing, not by holding pages back (which would feel slower).
