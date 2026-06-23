// Meta Conversions API (CAPI) — server-side event forwarder
// Public endpoint (no JWT). Receives events from the browser and forwards them
// to Meta with hashed user data, enabling reliable attribution alongside the Pixel.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PIXEL_ID = '2669786013369705';
const API_VERSION = 'v21.0';

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input.trim().toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface IncomingEvent {
  event_name: string;
  event_id?: string;
  event_source_url?: string;
  user?: {
    email?: string;
    phone?: string;
    external_id?: string;
    fbp?: string;
    fbc?: string;
  };
  custom_data?: Record<string, unknown>;
  test_event_code?: string;
}

const ALLOWED_EVENTS = new Set([
  'PageView',
  'ViewContent',
  'AddToCart',
  'InitiateCheckout',
  'AddPaymentInfo',
  'Purchase',
  'Lead',
  'CompleteRegistration',
  'Search',
  'Contact',
]);
const MAX_EVENT_VALUE = 10_000_000; // sanity cap

function sanitizeCustomData(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, unknown> = { ...(input as Record<string, unknown>) };
  const val = Number(out.value);
  if (Number.isFinite(val)) {
    out.value = Math.max(0, Math.min(val, MAX_EVENT_VALUE));
  } else if ('value' in out) {
    delete out.value;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get('META_CAPI_ACCESS_TOKEN');
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'META_CAPI_ACCESS_TOKEN not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = (await req.json()) as IncomingEvent;
    if (!body?.event_name || typeof body.event_name !== 'string' || !ALLOWED_EVENTS.has(body.event_name)) {
      return new Response(JSON.stringify({ error: 'invalid_event_name' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('cf-connecting-ip') ||
      undefined;
    const ua = req.headers.get('user-agent') || undefined;

    const user_data: Record<string, string | string[]> = {};
    if (body.user?.email) user_data.em = [await sha256(body.user.email)];
    if (body.user?.phone) {
      user_data.ph = [await sha256(body.user.phone.replace(/\D/g, ''))];
    }
    if (body.user?.external_id) {
      user_data.external_id = [await sha256(body.user.external_id)];
    }
    if (body.user?.fbp) user_data.fbp = body.user.fbp;
    if (body.user?.fbc) user_data.fbc = body.user.fbc;
    if (ip) user_data.client_ip_address = ip;
    if (ua) user_data.client_user_agent = ua;

    const payload: Record<string, unknown> = {
      data: [
        {
          event_name: body.event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: body.event_id,
          event_source_url: body.event_source_url,
          action_source: 'website',
          user_data,
          custom_data: sanitizeCustomData(body.custom_data),
        },
      ],
    };
    if (body.test_event_code) payload.test_event_code = body.test_event_code;

    const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await resp.json();
    if (!resp.ok) {
      console.error('Meta CAPI error', resp.status, json);
      return new Response(JSON.stringify({ error: 'meta_error', code: resp.status }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, meta: json }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('meta-capi exception', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
