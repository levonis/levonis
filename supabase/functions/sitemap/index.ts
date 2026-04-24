// Public Sitemap edge function — no JWT required.
// Lists static pages + active products + categories so Google/AI can discover everything.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SITE = "https://levonisiq.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATIC_URLS: { loc: string; priority: string; changefreq: string }[] = [
  { loc: "/", priority: "1.0", changefreq: "daily" },
  { loc: "/about", priority: "0.7", changefreq: "monthly" },
  { loc: "/faq", priority: "0.7", changefreq: "monthly" },
  { loc: "/privacy", priority: "0.3", changefreq: "yearly" },
  { loc: "/terms", priority: "0.3", changefreq: "yearly" },
  { loc: "/community", priority: "0.8", changefreq: "daily" },
  { loc: "/bundles", priority: "0.8", changefreq: "weekly" },
  { loc: "/offers", priority: "0.8", changefreq: "daily" },
];

function escapeXml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [{ data: products }, { data: categories }] = await Promise.all([
      supabase
        .from("products")
        .select("id, slug, updated_at")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(2000),
      supabase
        .from("categories")
        .select("slug")
        .limit(200),
    ]);

    const urls: string[] = [];

    for (const s of STATIC_URLS) {
      urls.push(
        `<url><loc>${SITE}${s.loc}</loc><changefreq>${s.changefreq}</changefreq><priority>${s.priority}</priority></url>`,
      );
    }

    for (const c of categories || []) {
      if (!c.slug) continue;
      urls.push(
        `<url><loc>${SITE}/category/${escapeXml(c.slug)}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
      );
    }

    for (const p of products || []) {
      const slug = p.slug || p.id;
      const lastmod = p.updated_at ? new Date(p.updated_at).toISOString().split("T")[0] : "";
      urls.push(
        `<url><loc>${SITE}/product/${escapeXml(String(slug))}</loc>${
          lastmod ? `<lastmod>${lastmod}</lastmod>` : ""
        }<changefreq>weekly</changefreq><priority>0.9</priority></url>`,
      );
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join(
      "\n",
    )}\n</urlset>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (e) {
    console.error("sitemap error", e);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/xml; charset=utf-8" },
      },
    );
  }
});
