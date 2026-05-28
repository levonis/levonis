// Edge function: proxy-download
// Streams a remote model file (STL/3MF/OBJ/GLB/GLTF) to the client to bypass CORS.
// Authenticated-only — read-only download proxy with strict size + extension guard.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BYTES = 200 * 1024 * 1024; // 200MB
const ALLOWED_EXT = /\.(stl|3mf|obj|glb|gltf)(\?.*)?$/i;
const ALLOWED_HOSTS = new Set([
  "thingiverse.com", "www.thingiverse.com", "cdn.thingiverse.com",
  "makerworld.com", "www.makerworld.com", "public-cdn.bambulab.cn", "public-cdn.bblmw.com",
  "printables.com", "www.printables.com", "media.printables.com", "cdn.printables.com",
  "cults3d.com", "www.cults3d.com", "images.cults3d.com",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Require authenticated caller to prevent bandwidth/IP abuse
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }

    const u = new URL(req.url);
    const target = u.searchParams.get("url");
    if (!target) return json({ error: "Missing url" }, 400);
    let parsed: URL;
    try { parsed = new URL(target); } catch { return json({ error: "Invalid url" }, 400); }
    if (!/^https?:$/.test(parsed.protocol)) return json({ error: "Only http(s)" }, 400);
    if (!ALLOWED_EXT.test(parsed.pathname)) {
      return json({ error: "URL must point to .stl/.3mf/.obj/.glb/.gltf" }, 400);
    }

    const upstream = await fetch(parsed.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 LevoModelProxy/1.0" },
      redirect: "follow",
    });
    if (!upstream.ok || !upstream.body) {
      return json({ error: `Upstream ${upstream.status}` }, 502);
    }
    const len = Number(upstream.headers.get("content-length") || "0");
    if (len && len > MAX_BYTES) return json({ error: "File exceeds 200MB" }, 413);

    const fileName = parsed.pathname.split("/").pop() || "model.stl";
    return new Response(upstream.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
