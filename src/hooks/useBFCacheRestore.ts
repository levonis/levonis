import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Handles browser bfcache (back/forward cache) restore.
 *
 * When mobile browsers freeze a tab and later restore it from bfcache,
 * `pageshow` fires with `event.persisted === true`. React state (including
 * open Dialogs/Sheets) is preserved automatically — we only need to refresh
 * stale query data so the UI doesn't show ghost values.
 *
 * Also listens for `pagehide` to release long-lived connections so the tab
 * qualifies for bfcache in the first place (WebSockets etc. must be closed).
 */
export function useBFCacheRestore() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        // Tab was restored from bfcache — refresh stale data quietly.
        try { queryClient.invalidateQueries(); } catch {}
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [queryClient]);
}

export default useBFCacheRestore;
