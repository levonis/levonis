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

    // Repeat every 2 minutes — runs even when tab is hidden
    const interval = setInterval(ping, 2 * 60 * 1000);

    // Ping when tab becomes visible (immediate refresh)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') ping();
    };
    document.addEventListener('visibilitychange', onVisibility);

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
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointerdown', onInteraction);
      window.removeEventListener('keydown', onInteraction);
    };
  }, [user?.id, ping]);
}
