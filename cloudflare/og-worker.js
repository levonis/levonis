/**
 * Cloudflare Worker: SEO/Social-crawler OG head injector
 *
 * Runs in front of levonisiq.com. For social/search crawlers it fetches
 * server-rendered <head> from the `product-og` Supabase Edge Function and
 * injects it into the SPA HTML — real users hit the SPA unchanged.
 *
 * Routes handled (edit URL_MAP below to change):
 *   /product/:slug            -> product-og?type=product&slug=:slug
 *   /stl/:id                  -> product-og?type=stl&id=:id
 *   /s/:slug                  -> product-og?type=merchant&slug=:slug
 *
 * Deploy:
 *   1) npm i -g wrangler && wrangler login
 *   2) Set env vars in wrangler.toml (see below):
 *        SUPABASE_PROJECT_REF = "<your-project-ref>"
 *   3) wrangler deploy
 *   4) In Cloudflare dashboard, add a Worker Route:
 *        Route:   levonisiq.com/*
 *        Worker:  levonis-og
 *
 * wrangler.toml (put next to this file):
 *   name = "levonis-og"
 *   main = "og-worker.js"
 *   compatibility_date = "2024-10-01"
 *   [vars]
 *   SUPABASE_PROJECT_REF = "REPLACE_ME"
 *   ORIGIN = "https://levonis.lovable.app"
 */

const BOT_UA = /bot|crawler|spider|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|embedly|quora link preview|pinterest|redditbot|applebot|bingpreview|googleimageproxy|google-inspectiontool|vkshare|w3c_validator|yahoo|yandex|duckduckbot|petalbot|semrushbot|ahrefsbot/i;

const URL_MAP = [
  { re: /^\/product\/([^\/?#]+)/, type: "product", key: "slug" },
  { re: /^\/stl\/([^\/?#]+)/, type: "stl", key: "id" },
  { re: /^\/s\/([^\/?#]+)/, type: "merchant", key: "slug" },
];

function matchRoute(pathname) {
  for (const r of URL_MAP) {
    const m = pathname.match(r.re);
    if (m) return { type: r.type, key: r.key, value: m[1] };
  }
  return null;
}

async function fetchOgHead(env, route) {
  const u = new URL(`https://${env.SUPABASE_PROJECT_REF}.supabase.co/functions/v1/product-og`);
  u.searchParams.set("type", route.type);
  u.searchParams.set(route.key, route.value);
  u.searchParams.set("redirect", "0");
  const res = await fetch(u.toString(), { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) return null;
  const html = await res.text();
  const m = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  return m ? m[1] : null;
}

class HeadRewriter {
  constructor(injected) { this.injected = injected; this.done = false; }
  element(el) {
    if (this.done) return;
    // Strip existing OG/Twitter/description/title so injected ones win.
    el.onEndTag(async (end) => {
      // no-op; per-element removal happens below via a second rewriter
    });
  }
}

class StripTagRewriter {
  element(el) { el.remove(); }
}

class HeadInjector {
  constructor(injected) { this.injected = injected; }
  element(el) {
    // Prepend our server-rendered meta at the very top of <head>.
    el.prepend(this.injected, { html: true });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const ua = request.headers.get("user-agent") || "";
    const isBot = BOT_UA.test(ua) || url.searchParams.has("_og_debug");
    const route = matchRoute(url.pathname);

    // Pass-through: not a bot OR not an OG-eligible route.
    if (!isBot || !route) return fetch(request);

    // Fetch upstream SPA HTML from the Lovable-hosted origin.
    const originUrl = new URL(url.pathname + url.search, env.ORIGIN || url.origin);
    const upstream = await fetch(originUrl.toString(), {
      headers: { "user-agent": ua, accept: "text/html" },
    });
    const ct = upstream.headers.get("content-type") || "";
    if (!ct.includes("text/html")) return upstream;

    const injected = await fetchOgHead(env, route);
    if (!injected) return upstream;

    // Remove default <title>, description, og:*, twitter:* from the SPA head,
    // then prepend the server-rendered head fragment.
    const rewriter = new HTMLRewriter()
      .on("head > title", new StripTagRewriter())
      .on('head > meta[name="description"]', new StripTagRewriter())
      .on('head > meta[property^="og:"]', new StripTagRewriter())
      .on('head > meta[name^="twitter:"]', new StripTagRewriter())
      .on('head > link[rel="canonical"]', new StripTagRewriter())
      .on("head", new HeadInjector(injected));

    const res = new Response(upstream.body, upstream);
    res.headers.set("x-og-injected", "1");
    res.headers.set("cache-control", "public, max-age=300, s-maxage=3600");
    return rewriter.transform(res);
  },
};
