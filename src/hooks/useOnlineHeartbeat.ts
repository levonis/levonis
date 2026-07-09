import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Sends a heartbeat to update user's last_active_at.
 * - Immediate ping on mount
 * - Every 2 minutes
 * - On visibility change (tab focus)
 * - On user interactions (throttled)
 */
export function useOnlineHeartbeat() {
  const { user } = useAuth();

  const ping = useCallback(async () => {
    if (!user) return;
    try { await supabase.rpc('update_user_last_active'); } catch {}
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    // Immediate ping
    ping();

    // Repeat every 2 minutes — but ONLY when the tab is visible.
    // Keeping timers alive while hidden pins the tab in memory and
    // disqualifies it from bfcache on mobile browsers.
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (interval != null) return;
      interval = setInterval(ping, 2 * 60 * 1000);
    };
    const stop = () => {
      if (interval != null) {
        clearInterval(interval);
        interval = null;
      }
    };
    if (!document.hidden) start();

    // Ping when tab becomes visible (immediate refresh) and manage the timer.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        ping();
        start();
      } else {
        stop();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    // Also stop on pagehide so the tab can enter bfcache cleanly.
    const onPageHide = () => stop();
    window.addEventListener('pagehide', onPageHide);

    // Ping on first interaction (throttled)
    let interactionPinged = false;
    const onInteraction = () => {
      if (!interactionPinged) {
        interactionPinged = true;
        ping();
        setTimeout(() => { interactionPinged = false; }, 60_000);
      }
    };
    window.addEventListener('pointerdown', onInteraction, { passive: true });
    window.addEventListener('keydown', onInteraction, { passive: true });

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pointerdown', onInteraction);
      window.removeEventListener('keydown', onInteraction);
    };
  }, [user?.id, ping]);
}

