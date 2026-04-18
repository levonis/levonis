
The user shows the same "اتصالك بطيء" screen on the live site. The previous fixes haven't reached them because:

1. **The published deployment hasn't been updated.** Code changes only reach `levonisiq.com` after pressing Update in the publish dialog. If the user didn't press Update (or it failed), they still see the old broken bundle.
2. **OR** the SW v13 fix is live, but the user's browser already auto-recovered twice (`__levo_recovery_attempts >= 2`), so it now shows the "slow connection" message instead of self-healing again. The localStorage counter blocks further auto-recoveries.

Looking at `index.html` more carefully: the self-heal `selfHealOnce()` uses `sessionStorage` (cleared per tab), but the *other* recovery path uses `localStorage` `__levo_recovery_attempts` capped at 2. After 2 failed attempts ever, the user is permanently stuck on the message until they manually clear storage or hit "إعادة المحاولة" — which calls `__levoRecover()` that wipes SW + caches. That should work... unless the underlying chunk still 404s after reload.

## Real root cause hypothesis

The **published bundle on `levonis.lovable.app` / `levonisiq.com` is still the broken one** (vendor-jspdf TypeError). Self-heal wipes caches and reloads — but reload fetches the same broken HTML referencing the same broken chunk → infinite loop until counter hits 2 → "slow connection" shown.

I need to verify by checking the live site's network requests and console.

## Plan

1. **Check the live published site** with browser tools to see the actual JS error and which chunk is failing right now.
2. **Verify whether the v13 SW + new vite.config are actually deployed** by inspecting the loaded asset filenames.
3. Based on findings:
   - If site still serves old broken bundle → user must press **Update** in publish dialog. Confirm + walk through.
   - If new bundle is deployed but still errors → fix the actual remaining bundling bug (likely another lib being chunked wrong, e.g., `html2canvas`, `three`, or `pako` interaction).
   - If bundle is fine but SW still serves stale → make SW unregister itself unconditionally on next activation (one-shot kill switch).

## Likely fix (pending live inspection)

Add a **one-shot kill switch** in `index.html` that unregisters ALL service workers on every page load for the next deploy cycle, independent of error detection. This guarantees every existing user gets cleaned up on their next visit, even if `__levo_recovery_attempts >= 2`:

```js
// Run BEFORE anything else, on every load, until we remove this block
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
  if ('caches' in window) caches.keys().then(ks => ks.forEach(k => caches.delete(k)));
}
// Also reset the recovery counter so users aren't stuck on "slow connection"
try { localStorage.removeItem('__levo_recovery_attempts'); } catch(e) {}
```

Plus disable SW registration entirely for one deploy cycle (comment out the registration in `src/main.tsx` or wherever it lives) so no new SW takes its place.

## Steps when implementing

1. Inspect live site network/console to confirm the actual failing asset.
2. Add unconditional SW unregister + cache clear + counter reset to `index.html` head.
3. Find and temporarily disable SW registration in app code.
4. Tell user to press **Update** in publish dialog — the kill switch only works once it ships.
5. After 1 week, the kill switch can be removed.

This is a "scorched earth" approach but it's the only way to guarantee every existing user recovers, regardless of which broken state they're stuck in.

<lov-actions>
<lov-suggestion message="Apply the scorched-earth fix: unconditional SW unregister and cache clear on every load, plus disable new SW registration for one deploy cycle">طبّق الإصلاح الجذري</lov-suggestion>
<lov-suggestion message="First inspect the live site at levonisiq.com to confirm exactly which chunk is failing before making more changes">افحص الموقع المباشر أولاً</lov-suggestion>
<lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link>
</lov-actions>
