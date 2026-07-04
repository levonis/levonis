import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://levonisiq.com";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;

// Escape HTML special chars to prevent injection in the rendered meta tags.
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function absUrl(u: string | null | undefined): string {
  const v = (u || "").trim();
  if (!v) return DEFAULT_OG_IMAGE;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/")) return `${SITE_URL}${v}`;
  return `${SITE_URL}/${v}`;
}

function truncate(s: string, n: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > n ? `${clean.slice(0, n - 1)}…` : clean;
}

type Meta = {
  title: string;
  description: string;
  image: string;
  url: string;
  type: "website" | "product" | "article";
};

function render(meta: Meta, redirect: boolean): string {
  const t = esc(meta.title);
  const d = esc(meta.description);
  const img = esc(meta.image);
  const u = esc(meta.url);
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t} | LEVONIS</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${u}">
<meta property="og:type" content="${esc(meta.type)}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${u}">
<meta property="og:site_name" content="LEVONIS">
<meta property="og:locale" content="ar_IQ">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${img}">
${redirect ? `<meta http-equiv="refresh" content="0;url=${u}">` : ""}
</head>
<body>
<h1>${t}</h1>
<p>${d}</p>
<p><a href="${u}">${t}</a></p>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const params = url.searchParams;
    const type = (params.get("type") || "product").toLowerCase();
    const slug = params.get("slug");
    const id = params.get("id");
    // If ?redirect=0 (bots), skip the meta-refresh — the CF Worker injects
    // the head into the real HTML and lets the SPA handle navigation.
    const redirect = params.get("redirect") !== "0";

    if (!slug && !id) {
      return new Response("Missing slug or id", { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let meta: Meta | null = null;

    if (type === "product") {
      const q = supabase
        .from("products")
        .select("id, slug, name_ar, description_ar, image_url")
        .limit(1);
      const { data } = slug ? await q.eq("slug", slug).maybeSingle() : await q.eq("id", id!).maybeSingle();
      if (data) {
        meta = {
          title: data.name_ar || "LEVONIS",
          description: truncate(data.description_ar || `${data.name_ar} - تسوق الآن من LEVONIS`, 160),
          image: absUrl(data.image_url),
          url: `${SITE_URL}/product/${data.slug || data.id}`,
          type: "product",
        };
      }
    } else if (type === "stl") {
      const q = supabase
        .from("stl_files")
        .select("id, title, description, thumbnail_url")
        .limit(1);
      const { data } = id ? await q.eq("id", id).maybeSingle() : await q.eq("slug", slug!).maybeSingle();
      if (data) {
        meta = {
          title: data.title || "LEVONIS STL",
          description: truncate(data.description || "ملف STL من LEVONIS", 160),
          image: absUrl(data.thumbnail_url),
          url: `${SITE_URL}/stl/${data.id}`,
          type: "article",
        };
      }
    } else if (type === "merchant") {
      const q = supabase
        .from("merchant_public_profiles")
        .select("id, store_slug, store_name, store_description, store_logo_url")
        .limit(1);
      const { data } = slug ? await q.eq("store_slug", slug).maybeSingle() : await q.eq("id", id!).maybeSingle();
      if (data) {
        meta = {
          title: data.store_name || "متجر LEVONIS",
          description: truncate(data.store_description || `${data.store_name} على LEVONIS`, 160),
          image: absUrl(data.store_logo_url),
          url: `${SITE_URL}/s/${data.store_slug || data.id}`,
          type: "website",
        };
      }
    }

    if (!meta) {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    return new Response(render(meta, redirect), {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (err) {
    console.error("product-og error:", err);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
