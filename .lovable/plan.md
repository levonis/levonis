## Refactor: performance, reload loops, hydration, and mobile blur

Apply the five fixes exactly as requested, scoped to the named files. No routing, auth, or Telegram logic touched.

### 1. `src/main.tsx` — stop wiping browser caches on chunk errors
In `recoverFromStaleChunk`:
- Remove the `caches.keys()` + `caches.delete(...)` block.
- Keep the one-shot `sessionStorage` guard and the `serviceWorker.unregister()` step (SW must go, since it's what serves stale HTML referencing the missing chunk).
- End with a plain `window.location.reload()`.

No prompt UI is added (out of scope of the named file and would touch React tree). The reload remains one-shot, guarded against loops.

### 2. `src/App.tsx` — remove 12s route timeout self-reload
- Delete `ROUTE_FALLBACK_TIMEOUT_MS`, `recoverFromStuckRoute`, and the timer/visibility logic inside `RouteSuspenseFallback`.
- Simplify `RouteSuspenseFallback` to just `return <RouteAwareSkeleton />;` so Suspense waits for chunks naturally on slow networks.

### 3. `src/App.tsx` — un-lazy the navbar + lighten provider tree
- Replace `const AppNavBar = lazy(() => import("@/components/AppNavBar"));` with a static `import AppNavBar from "@/components/AppNavBar";` so it ships in the initial bundle and renders without a Suspense gap.
- Keep `IslandProvider` and `PageSearchProvider` (they own context other components read), but ensure they don't block initial paint:
  - Move `useGlobalNavSearchItems()` out of the synchronous render path — call it inside a small child component that mounts after first paint (e.g. `useEffect` + state flag) so the global search index build doesn't run during the first render pass.
  - Confirm no provider does sync work in its body beyond `useState`/`useMemo` of stable values; if any does, wrap the heavy bit in `useEffect`.

### 4. `src/App.tsx` + `src/components/IdleRoutePrefetcher.tsx` — disable background route prefetch
- Remove the `IdleRoutePrefetcher` mount from `App.tsx` (and its import).
- Remove the `useEffect` in `AppContent` (lines ~341+) that uses `navigator.connection` to prefetch Cart/ProductDetail/etc.
- Leave `PrefetchOnHover` intact — it only runs on explicit user intent, which is not "background prefetching."

### 5. `src/index.css` — kill mobile backdrop-filter
Append at the end of the file:

```css
@media (max-width: 768px) {
  .glass-floating,
  .glass-panel,
  [class*="backdrop-blur"] {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    background-color: rgba(15, 15, 18, 0.95) !important;
  }
}
```

### Out of scope / preserved
- Telegram Mini App init in `main.tsx` — untouched.
- Capacitor init, SW registration guards, `installFriendlyFunctionErrorMessages`, auth flow, routing table — untouched.
- `PrefetchOnHover` (user-intent only) — kept.
- Service worker file itself — kept (only runtime cache wipes on chunk error are removed).

### Risk notes
- Removing the 12s fallback means a genuinely broken chunk on a dead deploy will show the skeleton indefinitely instead of self-healing. The kept one-shot SW unregister + reload in `main.tsx` still recovers from the most common cause (stale SW serving HTML with missing chunks).
- The solid `rgba(15,15,18,0.95)` mobile fallback assumes a dark theme. On the Light theme it will look out of place on mobile; if that matters, say the word and I'll switch to a theme-token-driven fallback.
