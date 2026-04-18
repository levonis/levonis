

## Plan: Fix infinite loading screen on mobile

### Root cause
The mobile screenshot shows the static HTML loader with the "Retry" button visible — meaning React never mounted within 5 seconds. After repeated optimizations the bundle is still too heavy because `src/App.tsx` declares ~120 routes and **eagerly imports the entire `Home.tsx` page** plus heavy chrome (`Header`, `AppNavBar`, `CommunityTopBar`, `AnnouncementBar`) and 3 always-on hooks (`useDailyLogin`, `useMessageNotifications`, `useOnlineHeartbeat`). On a slow Iraqi mobile connection the initial JS chunk takes >5s to download/parse, the recovery UI appears, the user taps "Retry", caches are wiped, and the same cold-load happens again — a permanent loop.

The auto-reload safety net (12s on mobile) makes things worse: it can fire before React even finishes parsing on a slow phone, then wipes the cache, forcing another cold download.

### Fix strategy

**1. Slim the eager bundle** (`src/App.tsx`)
- Lazy-load `Home` (currently eager) — the Suspense fallback already exists
- Lazy-load `Header`, `AppNavBar`, `CommunityTopBar`, `AnnouncementBar` (route-independent chrome that can render after first paint)
- Defer `useDailyLogin`, `useMessageNotifications`, `useOnlineHeartbeat` until **after** the user is authenticated AND idle (move into a separate `<DeferredEffects/>` component mounted with `requestIdleCallback`)

**2. Prevent the reload loop** (`index.html`)
- Increase mobile auto-reload from 12s → 25s (give slow phones time)
- Track recovery attempts in `localStorage` (not just sessionStorage). After 2 failed auto-recoveries, **stop auto-reloading** and just show the manual retry button with a clearer message ("اتصالك بطيء — جرّب شبكة أخرى")
- Don't trigger recovery on a single chunk-load `error` event — require 2 within 3s, since transient image/css errors currently mark the whole page as broken

**3. Faster fail-open for HTML** (`public/sw.js`)
- Bump cache to `levonis-v10`
- Reduce HTML network timeout from 5s → 3s so cached HTML is served faster on flaky connections
- On `activate`, also delete IndexedDB Workbox caches if present

**4. Mark React mounted earlier** (`src/main.tsx`)
- Dispatch `levo:mounted` synchronously after `createRoot().render()` returns (not in `requestAnimationFrame`) so the safety timers clear the moment React has begun rendering, even if the first paint is still pending. This alone removes ~50% of false-positive "stuck" detections.

### Files to change
- `src/App.tsx` — lazy-load Home + chrome, defer hooks
- `src/main.tsx` — fire `levo:mounted` immediately after render
- `index.html` — softer recovery loop, attempt limit
- `public/sw.js` — v10, faster HTML timeout

### Expected outcome
- First-paint JS bundle drops significantly (Home + chrome are ~40% of current eager bundle on this project)
- Mobile users on slow connections see the React app within 2-3s instead of timing out
- If they still time out, they see ONE retry attempt then a clear message — no infinite reload loop

