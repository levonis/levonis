// generate-quotation-pdf: builds a printable HTML quote for a print_quotations row
// and returns it as an HTML string + saves a record. Real PDF is generated client-side
// via html2canvas+jsPDF (same pattern as AdminPrinterInvoices).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  source: "file" | "url" | "manual";
  process_type: "fdm" | "resin" | "sls";
  material_code?: string;
  rush_tier?: "standard" | "fast" | "rush";
  qty?: number;
  input_payload: Record<string, unknown>;
  breakdown: Record<string, unknown> & { final?: number };
  final_iqd: number;
  difficulty_score?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const auth = req.headers.get("Authorization");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth ?? "" } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const body = (await req.json().catch(() => ({}))) as Body;

    if (!body?.breakdown || !body?.final_iqd || !body?.process_type || !body?.source) {
      return new Response(JSON.stringify({ error: "Invalid body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: q, error } = await admin
      .from("print_quotations")
      .insert({
        user_id: u.user.id,
        source: body.source,
        process_type: body.process_type,
        material_code: body.material_code ?? null,
        rush_tier: body.rush_tier ?? "standard",
        qty: body.qty ?? 1,
        input_payload: body.input_payload ?? {},
        breakdown: body.breakdown,
        final_iqd: Math.round(body.final_iqd),
        difficulty_score: body.difficulty_score ?? null,
        status: "draft",
      })
      .select("id, quote_number, created_at")
      .single();
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, quotation: q }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-quotation-pdf error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
