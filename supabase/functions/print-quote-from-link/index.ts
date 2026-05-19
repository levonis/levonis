// Instant 3D Print Quote from URL — Lovable Edge Function
// Scrapes 3D model metadata (Thingiverse / Printables / MakerWorld / Cults),
// falls back to Lovable AI Gateway estimation, caches results, returns price breakdown.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPPORTED_HOSTS = [
  "thingiverse.com",
  "www.thingiverse.com",
  "printables.com",
  "www.printables.com",
  "makerworld.com",
  "www.makerworld.com",
  "cults3d.com",
  "www.cults3d.com",
];

interface ModelMeta {
  name: string;
  thumbnail: string | null;
  description: string | null;
  weight_g: number | null;
  print_minutes: number | null;
  dimensions_mm: { x: number; y: number; z: number } | null;
  recommended_printer: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
}

interface PricingSettings {
  filament_price_per_kg: number;
  hourly_machine_cost: number;
  base_complexity_fee: number;
  platform_fee_pct: number;
  profit_margin_pct: number;
  min_range_pct: number;
  max_range_pct: number;
}

const round250 = (n: number) => Math.round(n / 250) * 250;

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (!SUPPORTED_HOSTS.includes(u.hostname.toLowerCase())) return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LovableQuoteBot/1.0; +https://lovable.dev)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractMeta(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re);
  if (m) return m[1];
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`,
    "i",
  );
  return html.match(re2)?.[1] ?? null;
}

function extractJsonLd(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch { /* ignore */ }
  }
  return out;
}

function scrapeMeta(html: string, url: string): Partial<ModelMeta> {
  const title =
    extractMeta(html, "og:title") ||
    extractMeta(html, "twitter:title") ||
    html.match(/<title>([^<]+)<\/title>/i)?.[1] ||
    "";
  const description =
    extractMeta(html, "og:description") ||
    extractMeta(html, "description") ||
    null;
  const thumbnail =
    extractMeta(html, "og:image") || extractMeta(html, "twitter:image") || null;

  // Try JSON-LD for structured data
  const jsonLd = extractJsonLd(html);
  let recommended_printer: string | null = null;
  for (const node of jsonLd) {
    const items = Array.isArray(node) ? node : [node];
    for (const it of items) {
      if (it?.["@type"] === "Product" || it?.["@type"] === "CreativeWork") {
        if (typeof it.name === "string" && !title) (it.name as string);
      }
    }
  }

  // Best-effort: scan for printer hints
  const printerMatch = html.match(/(?:printer|machine)[^<]{0,60}?:\s*([A-Za-z0-9 \-+]{3,30})/i);
  if (printerMatch) recommended_printer = printerMatch[1].trim();

  return {
    name: title.replace(/\s*[|–-].*$/, "").trim() || "3D Model",
    description,
    thumbnail,
    recommended_printer,
  };
}

async function aiEstimate(meta: Partial<ModelMeta>, url: string): Promise<ModelMeta> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) {
    // Hard fallback heuristic
    return {
      name: meta.name || "3D Model",
      thumbnail: meta.thumbnail ?? null,
      description: meta.description ?? null,
      weight_g: 35,
      print_minutes: 180,
      dimensions_mm: null,
      recommended_printer: meta.recommended_printer ?? null,
      difficulty: "medium",
    };
  }

  const prompt = `You are a 3D printing estimator. Given this 3D model info, estimate realistic FDM print stats for a typical 0.2mm layer, 15% infill PLA print on a Bambu A1 / Ender 3 class printer. Return STRICT JSON only.

URL: ${url}
Title: ${meta.name || ""}
Description: ${(meta.description || "").slice(0, 600)}

Return JSON with keys:
{
  "weight_g": number (1-2000),
  "print_minutes": integer (10-6000),
  "dimensions_mm": {"x": number, "y": number, "z": number},
  "difficulty": "easy" | "medium" | "hard",
  "category": "toy" | "mechanical" | "decorative" | "tool" | "other"
}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Respond with only valid JSON. No prose." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) throw new Error(`AI gateway ${res.status}`);
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    return {
      name: meta.name || "3D Model",
      thumbnail: meta.thumbnail ?? null,
      description: meta.description ?? null,
      weight_g: Math.max(1, Math.min(2000, Number(parsed.weight_g) || 30)),
      print_minutes: Math.max(10, Math.min(6000, Math.round(Number(parsed.print_minutes) || 180))),
      dimensions_mm: parsed.dimensions_mm ?? null,
      recommended_printer: meta.recommended_printer ?? null,
      difficulty: ["easy", "medium", "hard"].includes(parsed.difficulty)
        ? parsed.difficulty
        : "medium",
    };
  } catch (_e) {
    return {
      name: meta.name || "3D Model",
      thumbnail: meta.thumbnail ?? null,
      description: meta.description ?? null,
      weight_g: 35,
      print_minutes: 180,
      dimensions_mm: null,
      recommended_printer: meta.recommended_printer ?? null,
      difficulty: "medium",
    };
  }
}

function computeBreakdown(meta: ModelMeta, p: PricingSettings) {
  const weight_g = meta.weight_g ?? 30;
  const minutes = meta.print_minutes ?? 180;
  const hours = minutes / 60;

  const filament_cost = (weight_g / 1000) * p.filament_price_per_kg;
  const machine_cost = hours * p.hourly_machine_cost;
  const complexityMult =
    meta.difficulty === "easy" ? 1 : meta.difficulty === "hard" ? 2.2 : 1.5;
  const complexity_fee = p.base_complexity_fee * complexityMult;
  const subtotal = filament_cost + machine_cost + complexity_fee;
  const platform_fee = subtotal * p.platform_fee_pct;
  const profit_margin = subtotal * p.profit_margin_pct;
  const final = subtotal + platform_fee + profit_margin;

  return {
    filament_cost: round250(filament_cost),
    machine_cost: round250(machine_cost),
    complexity_fee: round250(complexity_fee),
    platform_fee: round250(platform_fee),
    profit_margin: round250(profit_margin),
    subtotal: round250(subtotal),
    final: round250(final),
    price_min: round250(final * p.min_range_pct),
    price_max: round250(final * p.max_range_pct),
    inputs: { weight_g, print_minutes: minutes, difficulty: meta.difficulty },
    pricing: p,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    // Require an authenticated caller
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader ?? "" } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const { url, file_meta } = body as {
      url?: string;
      file_meta?: { name?: string; size_bytes?: number };
    };

    // Load pricing settings
    const { data: settingsRow } = await admin
      .from("community_settings")
      .select("value")
      .eq("key", "quote_pricing")
      .maybeSingle();

    const pricing: PricingSettings = (settingsRow?.value as PricingSettings) ?? {
      filament_price_per_kg: 25000,
      hourly_machine_cost: 2000,
      base_complexity_fee: 1500,
      platform_fee_pct: 0.017,
      profit_margin_pct: 0.15,
      min_range_pct: 0.9,
      max_range_pct: 1.15,
    };

    // FILE FALLBACK MODE
    if (!url && file_meta?.size_bytes) {
      const grams = Math.max(5, Math.round(file_meta.size_bytes / 1024 / 25));
      const meta: ModelMeta = {
        name: file_meta.name || "Uploaded model",
        thumbnail: null,
        description: null,
        weight_g: grams,
        print_minutes: Math.max(30, grams * 4),
        dimensions_mm: null,
        recommended_printer: null,
        difficulty: grams > 200 ? "hard" : grams > 60 ? "medium" : "easy",
      };
      const breakdown = computeBreakdown(meta, pricing);
      return new Response(
        JSON.stringify({ source: "file", model: meta, breakdown }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // URL MODE
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalized = normalizeUrl(url);
    if (!normalized) {
      return new Response(
        JSON.stringify({
          error: "Unsupported link. Use Thingiverse, Printables, MakerWorld, or Cults3D.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Cache hit?
    const { data: cached } = await admin
      .from("print_quote_cache")
      .select("payload, expires_at, source")
      .eq("url", normalized)
      .maybeSingle();

    if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
      const meta = cached.payload as ModelMeta;
      const breakdown = computeBreakdown(meta, pricing);
      return new Response(
        JSON.stringify({ source: "cached", model: meta, breakdown }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const html = await fetchPage(normalized);
    const scraped: Partial<ModelMeta> = html ? scrapeMeta(html, normalized) : {};
    const meta = await aiEstimate(scraped, normalized);

    // Upsert cache
    await admin.from("print_quote_cache").upsert(
      {
        url: normalized,
        payload: meta as unknown as Record<string, unknown>,
        source: html ? "scrape+ai" : "ai",
        expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      },
      { onConflict: "url" },
    );

    const breakdown = computeBreakdown(meta, pricing);

    return new Response(
      JSON.stringify({
        source: html ? "scrape" : "ai",
        model: meta,
        breakdown,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("print-quote-from-link error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
