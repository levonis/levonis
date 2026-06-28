## Scope

Most of the request was already implemented in the previous turn (verified now):

- `IdleRoutePrefetcher` and `navigator.connection` background prefetch — **already removed** from `App.tsx`.
- 12s `recoverFromStuckRoute` / `ROUTE_FALLBACK_TIMEOUT_MS` — **already removed**; `RouteSuspenseFallback` just renders `RouteAwareSkeleton`.
- `AppNavBar` — **already statically imported** (no longer lazy).
- No `queryClient.prefetchQuery` calls exist anywhere in the provider tree.

Per your answers, providers stay at the root (item 2 skipped — moving Island/PageSearch would break the Home page chrome and you confirmed the current setup works). Footer skipped (no global Footer exists).

The only remaining item is **chunk grouping** for admin/* and community/* routes.

## What changes

### `vite.config.ts` — add `manualChunks`

Today every `lazy(() => import("./pages/AdminX"))` becomes its own HTTP request. Visiting the admin panel currently fans out into 70+ tiny chunk requests. Group them by filename prefix so the browser fetches one chunk per area:

```text
output.manualChunks(id):
  if id matches  /src/pages/Admin*          → "admin-pages"
  if id matches  /src/pages/Community*
     or /src/pages/community/*              → "community-pages"
  if id matches  /src/pages/Merchant*
     or /src/pages/Storefront*              → "merchant-pages"
  (everything else: leave to Vite defaults — per-route chunks)
```

Implementation: add a `build.rollupOptions.output.manualChunks` function to `vite.config.ts`. The function inspects the resolved module `id`, returns the chunk name for admin / community / merchant page modules, and returns `undefined` for everything else so Vite keeps its default per-route splitting for public pages (Home, ProductDetail, Cart, etc. stay independent and small).

### Nothing else changes

- `App.tsx` lazy import list stays as-is — grouping is done at the bundler level, not by rewriting imports. This keeps the route table readable and avoids touching 70+ route definitions.
- Providers (`IslandProvider`, `PageSearchProvider`, `ProfileTransitionProvider`) stay at the root per your decision.
- No changes to `main.tsx`, `index.css`, routing logic, auth gates, or the Telegram Mini App init.

## Expected effect

- Home / public pages: unchanged (still small per-route chunks; no admin or community code pulled in).
- Admin panel: first visit downloads one `admin-pages-*.js` chunk instead of 70+ — fewer round trips on slow networks, total bytes roughly the same (slightly less due to shared imports deduped inside the chunk).
- Community pages: same pattern, one chunk for all community routes.

## Risk

- A single admin chunk is larger than one route's worth of JS. The user pays it once on the first admin navigation, then it's cached. Acceptable since regular users never hit admin routes.
- If a community page is very heavy (e.g. a chart-only page), grouping all community pages pulls those libs in even on a lighter community route. Mitigation: shared deps (recharts, etc.) are already in shared vendor chunks, not in page chunks.

## Technical details

- `vite.config.ts` `output.manualChunks` receives the absolute module id. Use `id.includes("/src/pages/Admin")` etc. — works on Windows and Linux because Vite normalizes to forward slashes.
- Return `undefined` (not `null`) for non-matching ids — that's the Rollup contract for "use default chunking".
- Do NOT put `node_modules` into these chunks; only match `/src/pages/...`. Vendor splitting stays default.
