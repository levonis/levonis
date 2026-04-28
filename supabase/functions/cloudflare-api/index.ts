import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CF_API = "https://api.cloudflare.com/client/v4";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: Verify caller is an authenticated admin server-side
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  if (!jwt) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleRow) {
    return new Response(
      JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN");
  const ZONE_ID = Deno.env.get("CLOUDFLARE_ZONE_ID");
  const ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");

  if (!API_TOKEN || !ZONE_ID || !ACCOUNT_ID) {
    return new Response(
      JSON.stringify({ error: "Cloudflare credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const headers = {
    Authorization: `Bearer ${API_TOKEN}`,
    "Content-Type": "application/json",
  };

  try {
    const { action, params } = await req.json();

    let url: string;
    let method = "GET";
    let body: string | undefined;

    switch (action) {
      // ===== DNS =====
      case "dns_list":
        url = `${CF_API}/zones/${ZONE_ID}/dns_records`;
        if (params?.type) url += `?type=${params.type}`;
        break;

      case "dns_create":
        url = `${CF_API}/zones/${ZONE_ID}/dns_records`;
        method = "POST";
        body = JSON.stringify({
          type: params.type,
          name: params.name,
          content: params.content,
          ttl: params.ttl || 1,
          proxied: params.proxied ?? false,
        });
        break;

      case "dns_update":
        if (!params?.id) throw new Error("DNS record ID required");
        url = `${CF_API}/zones/${ZONE_ID}/dns_records/${params.id}`;
        method = "PUT";
        body = JSON.stringify({
          type: params.type,
          name: params.name,
          content: params.content,
          ttl: params.ttl || 1,
          proxied: params.proxied ?? false,
        });
        break;

      case "dns_delete":
        if (!params?.id) throw new Error("DNS record ID required");
        url = `${CF_API}/zones/${ZONE_ID}/dns_records/${params.id}`;
        method = "DELETE";
        break;

      // ===== Cache =====
      case "cache_purge_all":
        url = `${CF_API}/zones/${ZONE_ID}/purge_cache`;
        method = "POST";
        body = JSON.stringify({ purge_everything: true });
        break;

      case "cache_purge_urls":
        if (!params?.urls?.length) throw new Error("URLs array required");
        url = `${CF_API}/zones/${ZONE_ID}/purge_cache`;
        method = "POST";
        body = JSON.stringify({ files: params.urls });
        break;

      // ===== Analytics =====
      case "analytics_dashboard":
        url = `${CF_API}/zones/${ZONE_ID}/analytics/dashboard?since=${params?.since || "-1440"}&until=${params?.until || "0"}`;
        break;

      // ===== Security =====
      case "firewall_rules_list":
        url = `${CF_API}/zones/${ZONE_ID}/firewall/rules`;
        break;

      case "security_level_get":
        url = `${CF_API}/zones/${ZONE_ID}/settings/security_level`;
        break;

      case "security_level_set":
        if (!params?.value) throw new Error("Security level value required");
        url = `${CF_API}/zones/${ZONE_ID}/settings/security_level`;
        method = "PATCH";
        body = JSON.stringify({ value: params.value });
        break;

      case "under_attack_enable":
        url = `${CF_API}/zones/${ZONE_ID}/settings/security_level`;
        method = "PATCH";
        body = JSON.stringify({ value: "under_attack" });
        break;

      // ===== Zone Info =====
      case "zone_info":
        url = `${CF_API}/zones/${ZONE_ID}`;
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const cfResponse = await fetch(url, {
      method,
      headers,
      ...(body ? { body } : {}),
    });

    const data = await cfResponse.json();

    return new Response(JSON.stringify(data), {
      status: cfResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Cloudflare API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
