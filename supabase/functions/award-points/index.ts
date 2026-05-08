import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AwardSource =
  | 'daily_task'
  | 'review'
  | 'verified_review'
  | 'qa_answer';

// Per-source caps (per single award call). Admins are capped higher.
const USER_CAPS: Record<string, number> = {
  daily_task: 200,
  review: 50,
  qa_answer: 5,
};

const ADMIN_ONLY_SOURCES = new Set<string>(['verified_review']);
const ADMIN_CAPS: Record<string, number> = {
  daily_task: 1000,
  review: 200,
  verified_review: 200,
  qa_answer: 50,
};

// points_transactions.source check constraint allows these
const TX_SOURCE_MAP: Record<string, string> = {
  daily_task: 'daily_task',
  review: 'review',
  verified_review: 'verified_review',
  qa_answer: 'review_answer',
};

interface Payload {
  source: AwardSource;
  amount: number;
  target_user_id?: string; // admin only; defaults to caller
  related_id?: string;
  description?: string;
}

function bad(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return bad(405, 'method not allowed');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('VITE_SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('VITE_SUPABASE_PUBLISHABLE_KEY')!;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return bad(401, 'missing auth');

  // Identify the caller
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return bad(401, 'invalid auth');
  const callerId = userData.user.id;

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return bad(400, 'invalid json');
  }

  const source = body?.source;
  const amount = Number(body?.amount);
  if (!source || !TX_SOURCE_MAP[source]) return bad(400, 'invalid source');
  if (!Number.isFinite(amount) || amount <= 0) return bad(400, 'invalid amount');

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Check admin role
  const { data: isAdminRow } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', callerId)
    .eq('role', 'admin')
    .maybeSingle();
  const isAdmin = !!isAdminRow;

  // Resolve target user
  const targetUserId = body.target_user_id && body.target_user_id !== callerId
    ? body.target_user_id
    : callerId;
  if (targetUserId !== callerId && !isAdmin) {
    return bad(403, 'cross-user awards require admin');
  }

  if (ADMIN_ONLY_SOURCES.has(source) && !isAdmin) {
    return bad(403, 'admin-only source');
  }

  // Enforce per-source caps
  const cap = isAdmin ? (ADMIN_CAPS[source] ?? 50) : (USER_CAPS[source] ?? 0);
  if (amount > cap) return bad(400, `amount exceeds cap (${cap})`);

  // Source-specific server-side validation + idempotency
  const txSource = TX_SOURCE_MAP[source];

  if (source === 'qa_answer') {
    // Caller must have answered a question recently and not already awarded for it
    if (targetUserId !== callerId) return bad(400, 'qa_answer: target must be self');
    if (!body.related_id) return bad(400, 'qa_answer: related_id required (answer id)');
    const { data: ans } = await admin
      .from('review_answers')
      .select('id, answerer_id, created_at')
      .eq('id', body.related_id)
      .maybeSingle();
    if (!ans || ans.answerer_id !== callerId) return bad(404, 'answer not found');
    const { data: dup } = await admin
      .from('points_transactions')
      .select('id')
      .eq('user_id', targetUserId)
      .eq('source', 'review_answer')
      .eq('related_id', body.related_id)
      .maybeSingle();
    if (dup) return new Response(JSON.stringify({ ok: true, deduped: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (source === 'review' && !isAdmin) {
    // Self-awarded review: ensure a review row exists for this user+product (related_id=product_id) and no prior tx
    if (targetUserId !== callerId) return bad(400, 'review: target must be self');
    if (!body.related_id) return bad(400, 'review: related_id (product_id) required');
    const { data: rev } = await admin
      .from('reviews')
      .select('id')
      .eq('user_id', callerId)
      .eq('product_id', body.related_id)
      .limit(1)
      .maybeSingle();
    if (!rev) return bad(404, 'review not found');
    const { data: dup } = await admin
      .from('points_transactions')
      .select('id')
      .eq('user_id', callerId)
      .in('source', ['review', 'verified_review'])
      .eq('related_id', body.related_id)
      .maybeSingle();
    if (dup) return new Response(JSON.stringify({ ok: true, deduped: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Insert points_transactions then atomic balance update
  const { error: txErr } = await admin.from('points_transactions').insert({
    user_id: targetUserId,
    points: amount,
    type: 'earned',
    source: txSource,
    related_id: body.related_id ?? null,
    description: body.description ?? null,
  });
  if (txErr) return bad(500, `tx insert failed: ${txErr.message}`);

  const { error: rpcErr } = await admin.rpc('add_user_points', {
    p_user_id: targetUserId,
    p_amount: amount,
    p_source: txSource,
  });
  if (rpcErr) return bad(500, `award failed: ${rpcErr.message}`);

  return new Response(JSON.stringify({ ok: true, awarded: amount }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
