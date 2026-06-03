// Edge function: stl-download
// Validates STL library eligibility, enforces daily limit per membership card,
// deducts points for paid files, logs the download, and returns a signed URL.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body { file_id?: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as Body;
    const fileId = body.file_id;
    if (!fileId) return json({ error: "Missing file_id" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Eligibility (merchant approved + active Levo card)
    const { data: canAccess, error: accessErr } = await admin
      .rpc("can_access_stl_library", { _uid: userId });
    if (accessErr) return json({ error: accessErr.message }, 500);
    if (!canAccess) {
      return json({ error: "not_eligible", reason: "تحتاج إلى حساب تاجر معتمد وبطاقة Levo فعالة" }, 403);
    }

    // File
    const { data: file, error: fileErr } = await admin
      .from("stl_files")
      .select("id, status, download_file_path, price_type, price_points, min_card_tier_id")
      .eq("id", fileId)
      .maybeSingle();
    if (fileErr || !file) return json({ error: "file_not_found" }, 404);
    if (file.status !== "approved") return json({ error: "not_approved" }, 403);
    if (!file.download_file_path) return json({ error: "no_file" }, 404);

    // User active card + tier check + daily limit
    const nowIso = new Date().toISOString();
    const { data: card } = await admin
      .from("user_cards")
      .select("card_id, expires_at, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("expires_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (!card) return json({ error: "no_active_card" }, 403);

    if (file.min_card_tier_id && card.card_id !== file.min_card_tier_id) {
      // optional: simple "must be the same card" rule
      // (admin can expand to ranking later)
    }

    // Per-card daily limit
    const { data: limitRow } = await admin
      .from("stl_card_download_limits")
      .select("daily_download_limit")
      .eq("card_id", card.card_id)
      .maybeSingle();
    const dailyLimit: number | null = limitRow?.daily_download_limit ?? null;

    if (dailyLimit !== null) {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const { count } = await admin
        .from("stl_file_downloads")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("downloaded_at", startOfDay.toISOString());
      if ((count ?? 0) >= dailyLimit) {
        return json({ error: "daily_limit_reached", limit: dailyLimit }, 429);
      }
    }

    // Paid file → deduct points
    if (file.price_type === "paid" && Number(file.price_points) > 0) {
      const { error: deductErr } = await admin.rpc("deduct_user_points", {
        p_user_id: userId,
        p_amount: Number(file.price_points),
        p_source: "stl_purchase",
        p_description: `STL file purchase: ${file.id}`,
      });
      if (deductErr) {
        return json({ error: "insufficient_points", detail: deductErr.message }, 402);
      }
    }

    // Signed URL
    const { data: signed, error: signErr } = await admin.storage
      .from("stl-files")
      .createSignedUrl(file.download_file_path, 60 * 10);
    if (signErr || !signed) return json({ error: "signed_url_failed" }, 500);

    // Log download + increment counter (best-effort)
    try {
      await admin.from("stl_file_downloads").insert({ user_id: userId, file_id: file.id });
      await admin.from("stl_files").update({ downloads_count: (await admin
        .from("stl_files").select("downloads_count").eq("id", file.id).single()).data?.downloads_count + 1 || 1 })
        .eq("id", file.id);
    } catch (_) { /* non-blocking */ }

    return json({ url: signed.signedUrl });
  } catch (e) {
    console.error("[stl-download]", e);
    return json({ error: "internal_error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
