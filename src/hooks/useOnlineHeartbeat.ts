import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Sends a heartbeat every 2 minutes to update the user's last_active_at.
 */
export function useOnlineHeartbeat() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const ping = async () => {
      try { await supabase.rpc('update_user_last_active'); } catch {}
    };

    // Immediate ping
    ping();

    // Repeat every 2 minutes
    const interval = setInterval(ping, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user?.id]);
}
