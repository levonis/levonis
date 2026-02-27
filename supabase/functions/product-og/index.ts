import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return new Response("Missing slug", { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: product, error } = await supabase
      .from("products")
      .select("name_ar, description_ar, image_url, price, currency, slug")
      .eq("slug", slug)
      .single();

    if (error || !product) {
      return new Response("Product not found", { status: 404, headers: corsHeaders });
    }

    const siteUrl = "https://levonisiq.com";
    const productUrl = `${siteUrl}/product/${product.slug}`;
    const imageUrl = product.image_url || `${siteUrl}/og-logo.png`;
    const title = product.name_ar || "LEVONIS";
    const description = product.description_ar
      ? product.description_ar.substring(0, 160)
      : `${title} - تسوق الآن من LEVONIS`;

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${title} | LEVONIS</title>
  <meta name="description" content="${description}">
  
  <meta property="og:type" content="product">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${productUrl}">
  <meta property="og:site_name" content="LEVONIS">
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">
  
  <meta http-equiv="refresh" content="0;url=${productUrl}">
</head>
<body>
  <p>Redirecting to <a href="${productUrl}">${title}</a>...</p>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
