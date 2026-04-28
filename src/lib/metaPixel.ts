// Meta Pixel + Conversions API helper
// Fires both browser-side (fbq) and server-side (CAPI) with the same event_id
// for proper deduplication. All calls are non-blocking and silently fail.

import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : undefined;
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as Crypto).randomUUID();
  }
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface MetaEventOptions {
  eventName: string;
  customData?: Record<string, unknown>;
  user?: { email?: string; phone?: string; externalId?: string };
}

export async function trackMetaEvent({
  eventName,
  customData = {},
  user,
}: MetaEventOptions): Promise<void> {
  const eventId = uuid();

  // 1) Browser pixel (with eventID for dedup)
  try {
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', eventName, customData, { eventID: eventId });
    }
  } catch {
    // ignore
  }

  // 2) Server-side CAPI (non-blocking)
  try {
    let resolvedUser = user;
    if (!resolvedUser?.email || !resolvedUser?.externalId) {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          resolvedUser = {
            email: resolvedUser?.email || data.user.email || undefined,
            phone: resolvedUser?.phone,
            externalId: resolvedUser?.externalId || data.user.id,
          };
        }
      } catch {
        // ignore
      }
    }

    void supabase.functions
      .invoke('meta-capi', {
        body: {
          event_name: eventName,
          event_id: eventId,
          event_source_url: typeof window !== 'undefined' ? window.location.href : undefined,
          user: {
            email: resolvedUser?.email,
            phone: resolvedUser?.phone,
            external_id: resolvedUser?.externalId,
            fbp: getCookie('_fbp'),
            fbc: getCookie('_fbc'),
          },
          custom_data: customData,
        },
      })
      .catch(() => {});
  } catch {
    // ignore
  }
}
