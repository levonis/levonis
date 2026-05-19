// Production-grade 3D model URL analyzer + instant quote.
// Cascade: cache → MakerWorld OpenAPI → Firecrawl → fetch+regex → AI fallback.
// Caches results 7 days, logs analytics, returns unified payload + pricing.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPPORTED_HOSTS = [
  "thingiverse.com", "www.thingiverse.com",
  "printables.com", "www.printables.com",
  "makerworld.com", "www.makerworld.com",
  "cults3d.com", "www.cults3d.com",
];

const UAS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) Gecko/20100101 Firefox/124.0",
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Edg/123.0.0.0",
];

// in-memory rate limiter per (user, urlHash) → 30s
const RECENT = new Map<string, number>();
const RECENT_TTL = 30_000;
const ANALYZER_VERSION = 2;

interface Creator { name: string | null; url: string | null }
interface PrintProfile {
  name: string;
  filament_g?: number | null;
  print_minutes?: number | null;
  layer_height?: number | null;
  infill?: number | null;
  supports?: boolean | null;
  ams?: boolean | null;
  color_count?: number | null;
}
interface UnifiedModel {
  sourcePlatform: "makerworld" | "printables" | "thingiverse" | "cults3d" | "other";
  title: string;
  creator: Creator;
  description: string | null;
  images: string[];
  thumbnail: string | null;
  tags: string[];
  category: string | null;
  stats: { downloads: number; likes: number; prints: number };
  printProfiles: PrintProfile[];
  bambuCompatible: boolean | null;
  estimatedWeight: number | null;
  printTime: number | null; // minutes
  colorCount: number;
  complexityScore: number;
  confidenceLevel: "high" | "medium" | "low";
  source: { engine: string; scrapedAt: string };
}

// ---------- helpers ----------
const detectPlatform = (host: string): UnifiedModel["sourcePlatform"] => {
  const h = host.toLowerCase().replace(/^www\./, "");
  if (h.includes("makerworld")) return "makerworld";
  if (h.includes("printables")) return "printables";
  if (h.includes("thingiverse")) return "thingiverse";
  if (h.includes("cults3d")) return "cults3d";
  return "other";
};

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (!SUPPORTED_HOSTS.includes(u.hostname.toLowerCase())) return null;
    u.hash = "";
    // strip UTM and tracking params
    [...u.searchParams.keys()].forEach((k) => {
      if (/^(utm_|fbclid|gclid|ref|source)/i.test(k)) u.searchParams.delete(k);
    });
    return u.toString();
  } catch {
    return null;
  }
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function extractMeta(html: string, name: string): string | null {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i");
  const m1 = html.match(re1);
  if (m1) return m1[1];
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`, "i");
  return html.match(re2)?.[1] ?? null;
}

function extractJsonLd(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try { out.push(JSON.parse(m[1].trim())); } catch { /* ignore */ }
  }
  return out;
}

function htmlText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseLooseNumber(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const normalized = raw.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractSourceMetrics(text: string) {
  const grams: number[] = [];
  for (const m of text.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:g|gram|grams|غ|غم)\b/gi)) {
    const n = parseLooseNumber(m[1]);
    if (n && n >= 1 && n <= 10000) grams.push(n);
  }
  const hours: number[] = [];
  for (const m of text.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hour|hours|ساعة|س)\b/gi)) {
    const n = parseLooseNumber(m[1]);
    if (n && n <= 240) hours.push(n);
  }
  const minutes: number[] = [];
  for (const m of text.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:min|mins|minute|minutes|دقيقة|د)\b/gi)) {
    const n = parseLooseNumber(m[1]);
    if (n && n <= 6000) minutes.push(n);
  }
  const plateMatch = text.match(/(\d+)\s*(?:plates?|لوحات|صواني)/i);
  const colorCount = detectColorCount(text);
  return {
    weight_g: grams.length ? Math.max(...grams) : null,
    print_minutes: hours.length ? Math.round(Math.max(...hours) * 60) : (minutes.length ? Math.round(Math.max(...minutes)) : null),
    plates: plateMatch ? Number(plateMatch[1]) : null,
    color_count: colorCount,
  };
}

function detectColorCount(text: string, profiles: PrintProfile[] = []): number {
  const profileColors = profiles.map((p) => Number(p.color_count ?? 0)).filter((n) => Number.isFinite(n) && n > 0);
  const materialTags = new Set<string>();
  for (const m of text.matchAll(/\b(PLA|PETG|ABS|ASA|TPU|AMS|PA12|NYLON|RESIN)\b\s*(?:[|:]\s*)?(\d+(?:[.,]\d+)?)?\s*g?/gi)) {
    materialTags.add(`${m[1].toUpperCase()}-${m[2] ?? materialTags.size}`);
  }
  const explicit = text.match(/(\d+)\s*(?:colors?|colours?|ألوان|لون)/i);
  const explicitCount = explicit ? Number(explicit[1]) : 0;
  const inferred = Math.max(explicitCount, materialTags.size, ...profileColors, 1);
  return clamp(Math.floor(inferred), 1, 16);
}

function validateAgainstSource(partial: Partial<UnifiedModel>, sourceText: string): Partial<UnifiedModel> {
  const metrics = extractSourceMetrics(sourceText);
  const next = { ...partial };
  if (metrics.weight_g && (!next.estimatedWeight || Math.abs(next.estimatedWeight - metrics.weight_g) / metrics.weight_g > 0.35)) {
    next.estimatedWeight = metrics.weight_g;
  }
  if (metrics.print_minutes && (!next.printTime || Math.abs(next.printTime - metrics.print_minutes) / metrics.print_minutes > 0.35)) {
    next.printTime = metrics.print_minutes;
  }
  next.colorCount = Math.max(Number(next.colorCount ?? 1), metrics.color_count);
  if (metrics.plates && Array.isArray(next.printProfiles) && next.printProfiles.length) {
    next.printProfiles = next.printProfiles.slice(0, Math.max(1, metrics.plates));
  }
  return next;
}

async function fetchHtmlRotating(url: string, retries = 3): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    const ua = UAS[(Date.now() + i) % UAS.length];
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": ua,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });
      if (res.ok) return await res.text();
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
        continue;
      }
      return null;
    } catch {
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  return null;
}

// ---------- Engine 1: MakerWorld OpenAPI (best when key available) ----------
// Extract distinct filament slots actually used (weight > 0) and total weight
// Handles several MakerWorld payload shapes: filaments[], filament_slots[], bom[]
function summarizeFilaments(p: any): { totalWeight: number | null; colorCount: number | null } {
  const arr: any[] = Array.isArray(p?.filaments) ? p.filaments
    : Array.isArray(p?.filament_slots) ? p.filament_slots
    : Array.isArray(p?.bom) ? p.bom
    : Array.isArray(p?.materials) ? p.materials
    : [];
  if (!arr.length) return { totalWeight: null, colorCount: null };
  let total = 0;
  const usedSlots: string[] = [];
  for (const f of arr) {
    const w = Number(f?.weight_g ?? f?.weight ?? f?.grams ?? f?.filament_weight_g ?? 0) || 0;
    if (w > 0.1) {
      total += w;
      const key = `${f?.type ?? f?.material ?? "?"}|${f?.color ?? f?.color_hex ?? f?.hex ?? usedSlots.length}`;
      usedSlots.push(key);
    }
  }
  // de-duplicate identical (material+color) slots — same color reused in AMS counts as 1
  const distinct = new Set(usedSlots).size;
  return {
    totalWeight: total > 0 ? Math.round(total) : null,
    colorCount: distinct > 0 ? distinct : null,
  };
}

function pickBestProfile(profiles: any[]): any | null {
  if (!Array.isArray(profiles) || !profiles.length) return null;
  // Prefer default, else most popular (likes/downloads/prints), else first
  const sorted = [...profiles].sort((a, b) => {
    const ad = (a?.is_default || a?.default) ? 1 : 0;
    const bd = (b?.is_default || b?.default) ? 1 : 0;
    if (ad !== bd) return bd - ad;
    const ap = Number(a?.like_count ?? a?.download_count ?? a?.print_count ?? 0);
    const bp = Number(b?.like_count ?? b?.download_count ?? b?.print_count ?? 0);
    return bp - ap;
  });
  return sorted[0];
}

async function tryMakerWorld(url: string, platform: string): Promise<Partial<UnifiedModel> | null> {
  if (platform !== "makerworld") return null;
  const idMatch = url.match(/\/models\/(\d+)/);
  if (!idMatch) return null;
  const id = idMatch[1];
  const apiKey = Deno.env.get("MAKERWORLD_API_KEY");
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://api.makerworld.com/v1/design/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const rawProfiles: any[] = j?.print_profiles || j?.printProfiles || [];
    const profiles: PrintProfile[] = rawProfiles.map((p: any) => {
      const filSummary = summarizeFilaments(p);
      const apiColorCount = Number(p.color_count ?? p.colorCount ?? p.filament_count ?? 0);
      return {
        name: p.name || "Profile",
        filament_g: filSummary.totalWeight ?? Number(p.filament_weight_g ?? p.total_filament_g) || null,
        print_minutes: Number(p.print_time_minutes ?? p.print_time_min ?? p.printTime) || null,
        layer_height: Number(p.layer_height_mm ?? p.layerHeight) || null,
        infill: Number(p.infill_pct ?? p.sparseInfillDensity) || null,
        supports: !!(p.supports ?? p.useSupports),
        ams: !!(p.uses_ams ?? p.useAms),
        // Prefer distinct-slot count from filaments[] over potentially-inflated API field (often AMS slot count = 16)
        color_count: filSummary.colorCount ?? (apiColorCount > 0 && apiColorCount <= 8 ? apiColorCount : null),
      };
    });
    const best = pickBestProfile(rawProfiles);
    const bestSummary = best ? summarizeFilaments(best) : { totalWeight: null, colorCount: null };
    const bestFil = bestSummary.totalWeight
      ?? Number(best?.filament_weight_g ?? best?.total_filament_g)
      ?? profiles.find((p) => p.filament_g)?.filament_g
      ?? null;
    const bestTime = Number(best?.print_time_minutes ?? best?.print_time_min ?? best?.printTime)
      || profiles.find((p) => p.print_minutes)?.print_minutes
      || null;
    const bestColors = bestSummary.colorCount
      ?? (best?.color_count && best.color_count <= 8 ? Number(best.color_count) : null)
      ?? Math.max(...profiles.map((p) => Number(p.color_count ?? 1)).filter((n) => n > 0 && n <= 8), 1);

    return {
      title: j.title || j.name,
      creator: { name: j.designer?.name ?? null, url: j.designer?.profile_url ?? null },
      description: j.description ?? null,
      images: (j.images || []).slice(0, 8),
      thumbnail: j.cover_image_url ?? j.images?.[0] ?? null,
      tags: j.tags || [],
      category: j.category ?? null,
      stats: {
        downloads: Number(j.download_count) || 0,
        likes: Number(j.like_count) || 0,
        prints: Number(j.print_count) || 0,
      },
      printProfiles: profiles,
      bambuCompatible: true,
      estimatedWeight: bestFil ? (bestFil as number) : null,
      printTime: bestTime ? (bestTime as number) : null,
      colorCount: clamp(Math.floor(Number(bestColors) || 1), 1, 8),
      source: { engine: "openapi", scrapedAt: new Date().toISOString() },
    };
  } catch { return null; }
}

// ---------- Engine 2: Firecrawl ----------
async function tryFirecrawl(url: string): Promise<Partial<UnifiedModel> | null> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) return null;
  try {
    const body = {
      url,
      formats: [
        "markdown",
        {
          type: "json",
          prompt: "Extract only facts visible on the page for this 3D model. Return title, creator name, description (max 1500 chars), tags list, category, image URLs (max 8), download_count, like_count, print_count, list of print profiles with name+filament_grams+print_minutes+layer_height_mm+infill_pct+supports+uses_ams+color_count/material_count, total color_count/material_count if visible, and whether it is compatible with Bambu Studio. Do not invent weight, time, colors, or stats if not visible.",
        },
      ],
      onlyMainContent: true,
      waitFor: 1500,
    };
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const root = data?.data ?? data;
    const j = root?.json ?? {};
    const md: string = root?.markdown ?? "";
    const meta = root?.metadata ?? {};
    const profiles: PrintProfile[] = Array.isArray(j.print_profiles)
      ? j.print_profiles.map((p: any) => ({
          name: p.name || "Profile",
          filament_g: Number(p.filament_grams ?? p.filament_g) || null,
          print_minutes: Number(p.print_minutes) || null,
          layer_height: Number(p.layer_height_mm) || null,
          infill: Number(p.infill_pct) || null,
          supports: !!p.supports,
          ams: !!p.uses_ams,
          color_count: Number(p.color_count ?? p.material_count ?? p.colors_count ?? 0) || null,
        }))
      : [];
    const bestFil = profiles.find((p) => p.filament_g)?.filament_g ?? null;
    const bestTime = profiles.find((p) => p.print_minutes)?.print_minutes ?? null;
    const extracted = {
      title: j.title || meta.title || meta.ogTitle || "",
      creator: { name: j.creator || j.creator_name || null, url: null },
      description: (j.description || meta.description || md.slice(0, 1500)) ?? null,
      images: Array.isArray(j.images) ? j.images.slice(0, 8) : (meta.ogImage ? [meta.ogImage] : []),
      thumbnail: (Array.isArray(j.images) ? j.images[0] : null) ?? meta.ogImage ?? null,
      tags: Array.isArray(j.tags) ? j.tags : [],
      category: j.category ?? null,
      stats: {
        downloads: Number(j.download_count) || 0,
        likes: Number(j.like_count) || 0,
        prints: Number(j.print_count) || 0,
      },
      printProfiles: profiles,
      bambuCompatible: typeof j.bambu_compatible === "boolean" ? j.bambu_compatible : null,
      estimatedWeight: bestFil,
      printTime: bestTime,
      colorCount: detectColorCount(`${md} ${JSON.stringify(j)}`, profiles),
      source: { engine: "firecrawl", scrapedAt: new Date().toISOString() },
    };
    return validateAgainstSource(extracted, md);
  } catch { return null; }
}

// ---------- Engine 3: plain fetch + regex ----------
async function tryFetchScrape(url: string): Promise<Partial<UnifiedModel> | null> {
  const html = await fetchHtmlRotating(url);
  if (!html) return null;
  const text = htmlText(html);
  const sourceMetrics = extractSourceMetrics(text);
  const title = extractMeta(html, "og:title") || extractMeta(html, "twitter:title")
    || html.match(/<title>([^<]+)<\/title>/i)?.[1] || "";
  const description = extractMeta(html, "og:description") || extractMeta(html, "description");
  const ogImage = extractMeta(html, "og:image") || extractMeta(html, "twitter:image");
  const images: string[] = [];
  if (ogImage) images.push(ogImage);
  const imgMatches = [...html.matchAll(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/gi)];
  for (const m of imgMatches) if (!images.includes(m[1])) images.push(m[1]);

  let creatorName: string | null = null;
  const ldNodes = extractJsonLd(html);
  for (const node of ldNodes) {
    const arr = Array.isArray(node) ? node : [node];
    for (const it of arr) {
      if (!creatorName) {
        const a = it?.author;
        if (typeof a === "string") creatorName = a;
        else if (a?.name) creatorName = a.name;
      }
    }
  }

  return {
    title: title.replace(/\s*[|–-].*$/, "").trim(),
    creator: { name: creatorName, url: null },
    description: description ?? null,
    images: images.slice(0, 8),
    thumbnail: ogImage ?? null,
    tags: [],
    category: null,
    stats: { downloads: 0, likes: 0, prints: 0 },
    printProfiles: [],
    bambuCompatible: null,
    estimatedWeight: sourceMetrics.weight_g,
    printTime: sourceMetrics.print_minutes,
    colorCount: sourceMetrics.color_count,
    source: { engine: "fetch", scrapedAt: new Date().toISOString() },
  };
}

// ---------- Engine 4: AI fallback ----------
async function aiFill(partial: Partial<UnifiedModel>, url: string): Promise<Partial<UnifiedModel>> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return partial;
  const prompt = `You are a 3D printing estimator. Based on the following partial info, estimate REASONABLE values for a typical 0.20mm PLA FDM print. Return STRICT JSON only.
URL: ${url}
Title: ${partial.title || ""}
Description: ${(partial.description || "").slice(0, 600)}
Tags: ${(partial.tags || []).join(", ")}

Return JSON:
{ "weight_g": number(1-2000), "print_minutes": int(10-6000), "complexity": int(0-100), "category": string }`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Respond with only valid JSON. No prose." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return partial;
    const d = await res.json();
    const j = JSON.parse(d?.choices?.[0]?.message?.content ?? "{}");
    return {
      ...partial,
      estimatedWeight: partial.estimatedWeight ?? Math.max(1, Math.min(2000, Number(j.weight_g) || 30)),
      printTime: partial.printTime ?? Math.max(10, Math.min(6000, Math.round(Number(j.print_minutes) || 180))),
      category: partial.category ?? (j.category || null),
      source: { engine: "ai", scrapedAt: new Date().toISOString() },
    };
  } catch { return partial; }
}

// ---------- Scoring ----------
function computeComplexity(m: Partial<UnifiedModel>): number {
  const minutes = m.printTime ?? 120;
  const grams = m.estimatedWeight ?? 30;
  const tags = (m.tags || []).length;
  const supports = (m.printProfiles || []).some((p) => p.supports);
  let s = 0;
  s += Math.min(40, minutes / 12);
  s += Math.min(30, grams / 5);
  s += Math.min(15, tags * 2);
  if (supports) s += 15;
  return Math.round(Math.max(0, Math.min(100, s)));
}

function confidenceFrom(m: Partial<UnifiedModel>, engine: string): "high" | "medium" | "low" {
  const have = (k: any) => k !== null && k !== undefined && k !== "" && !(Array.isArray(k) && k.length === 0);
  const score =
    (have(m.title) ? 1 : 0) +
    (have(m.thumbnail) ? 1 : 0) +
    (have(m.description) ? 1 : 0) +
    (have((m.images || []).length) ? 1 : 0) +
    (have(m.creator?.name) ? 1 : 0) +
    (have(m.estimatedWeight) ? 1.5 : 0) +
    (have(m.printTime) ? 1.5 : 0) +
    ((m.printProfiles || []).length > 0 ? 1.5 : 0) +
    (have(m.tags?.length) ? 0.5 : 0);
  if (engine === "openapi" || score >= 7) return "high";
  if (engine === "ai" && score < 4) return "low";
  if (score >= 4) return "medium";
  return "low";
}

// ---------- Pricing ----------
const round250 = (n: number) => Math.round(n / 250) * 250;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

async function computePricing(
  admin: any,
  weight_g: number,
  print_minutes: number,
  complexity: number,
  materialCode: string,
  colorCount = 1,
) {
  const { data: material } = await admin
    .from("print_materials")
    .select("*").eq("code", materialCode).eq("is_active", true).maybeSingle();
  const { data: machine } = await admin
    .from("print_machine_profiles")
    .select("*").eq("is_active", true).order("is_default", { ascending: false }).limit(1).maybeSingle();
  const { data: settingsRow } = await admin
    .from("community_settings").select("value").eq("key", "quote_pricing").maybeSingle();

  const cfg: any = settingsRow?.value ?? {};
  const base: any = cfg.base ?? {};

  const filamentPrice = Number(material?.cost_per_kg_iqd ?? base.filament_price_per_kg ?? 25000);
  const hourlyCost = Number(machine?.hourly_cost_iqd ?? base.hourly_machine_cost ?? 2000);
  const baseComplexityFee = Number(base.base_complexity_fee ?? 1500);
  const platformFeePct = Number(base.platform_fee_pct ?? 0.017);
  const profitPct = Number(base.profit_margin_pct ?? 0.15);
  const minRangePct = Number(base.min_range_pct ?? 0.9);
  const maxRangePct = Number(base.max_range_pct ?? 1.15);
  const minOrderIqd = Number(base.min_order_iqd ?? 5000);
  const safeColorCount = clamp(Math.floor(Number(colorCount) || 1), 1, 16);
  const extraColors = Math.max(0, safeColorCount - 1);
  const multiColorFixed = Number(base.multi_color_fixed_iqd ?? 1000);
  const multiColorPerHour = Number(base.multi_color_per_hour_iqd ?? 350);
  const multiColorMaterialWastePct = Number(base.multi_color_material_waste_pct ?? 0.06);

  const difficulty: "easy" | "medium" | "hard" =
    complexity > 60 ? "hard" : complexity > 30 ? "medium" : "easy";
  const complexityMult = difficulty === "easy" ? 1 : difficulty === "hard" ? 2.2 : 1.5;

  const filament_cost = (weight_g / 1000) * filamentPrice;
  const machine_cost = (print_minutes / 60) * hourlyCost;
  const complexity_fee = baseComplexityFee * complexityMult;
  const multi_color_cost = extraColors * (multiColorFixed + multiColorPerHour * (print_minutes / 60) + filament_cost * multiColorMaterialWastePct);
  const subtotal = filament_cost + machine_cost + complexity_fee + multi_color_cost;
  const platform_fee = subtotal * platformFeePct;
  const profit_margin = subtotal * profitPct;
  let final = subtotal + platform_fee + profit_margin;
  if (final < minOrderIqd) final = minOrderIqd;

  return {
    breakdown: {
      filament_cost: round250(filament_cost),
      machine_cost: round250(machine_cost),
      complexity_fee: round250(complexity_fee),
      multi_color_cost: round250(multi_color_cost),
      platform_fee: round250(platform_fee),
      profit_margin: round250(profit_margin),
      subtotal: round250(subtotal),
      final: round250(final),
      price_min: round250(final * minRangePct),
      price_max: round250(final * maxRangePct),
      color_count: safeColorCount,
      components: [
        { key: "material", label_ar: "المادة", label_en: "Material", value: round250(filament_cost) },
        { key: "machine", label_ar: "تشغيل الماكينة", label_en: "Machine runtime", value: round250(machine_cost) },
        { key: "complexity", label_ar: "التعقيد", label_en: "Complexity", value: round250(complexity_fee) },
        ...(multi_color_cost > 0 ? [{ key: "multi_color", label_ar: "تعدد الألوان", label_en: "Multi-color", value: round250(multi_color_cost) }] : []),
      ],
      multipliers: { extra_colors: extraColors },
      inputs: { weight_g, print_minutes, difficulty },
      pricing: { filament_price_per_kg: filamentPrice, hourly_machine_cost: hourlyCost, base_complexity_fee: baseComplexityFee, platform_fee_pct: platformFeePct, profit_margin_pct: profitPct, min_range_pct: minRangePct, max_range_pct: maxRangePct, min_order_iqd: minOrderIqd, multi_color_fixed_iqd: multiColorFixed, multi_color_per_hour_iqd: multiColorPerHour, multi_color_material_waste_pct: multiColorMaterialWastePct },
    },
    material: material ? {
      code: material.code, name_en: material.name_en, name_ar: material.name_ar,
      density: Number(material.density_g_cm3), cost_per_kg: filamentPrice,
    } : { code: materialCode, name_en: materialCode.toUpperCase(), name_ar: materialCode.toUpperCase(), density: 1.24, cost_per_kg: filamentPrice },
  };
}

// ---------- main ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const t0 = Date.now();
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader ?? "" } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const { url, file_meta, material_code = "pla", mark_converted } = body as {
      url?: string;
      file_meta?: { name?: string; size_bytes?: number };
      material_code?: string;
      mark_converted?: { url_hash: string };
    };

    // Special: mark conversion (called after creating a print request)
    if (mark_converted?.url_hash) {
      await admin.rpc("mark_url_analytics_converted", { _url_hash: mark_converted.url_hash });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // FILE FALLBACK MODE (unchanged behavior — quick estimation by size)
    if (!url && file_meta?.size_bytes) {
      const grams = Math.max(5, Math.round(file_meta.size_bytes / 1024 / 25));
      const print_minutes = Math.max(30, grams * 4);
      const complexity = computeComplexity({ estimatedWeight: grams, printTime: print_minutes, colorCount: 1, tags: [], printProfiles: [] });
      const { breakdown, material } = await computePricing(admin, grams, print_minutes, complexity, material_code, 1);
      return new Response(JSON.stringify({
        source: "file",
        model: {
          name: file_meta.name || "Uploaded model",
          thumbnail: null, description: null,
          weight_g: grams, print_minutes,
          dimensions_mm: null, recommended_printer: null,
          difficulty: breakdown.inputs.difficulty,
          color_count: 1,
        },
        breakdown, material,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing url" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (url.length > 2048) {
      return new Response(JSON.stringify({ error: "URL too long" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const normalized = normalizeUrl(url);
    if (!normalized) {
      return new Response(JSON.stringify({
        error: "Unsupported link. Use Thingiverse, Printables, MakerWorld, or Cults3D.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const platform = detectPlatform(new URL(normalized).hostname);
    const url_hash = await sha256(normalized);

    // mini per-user rate limit (in-memory)
    const rkey = `${userData.user.id}:${url_hash}`;
    const last = RECENT.get(rkey);
    if (last && Date.now() - last < RECENT_TTL && (Date.now() - last) > 100) {
      // allow second call to fall through but skip remote network — return cache if available
    }
    RECENT.set(rkey, Date.now());
    if (RECENT.size > 500) {
      for (const [k, v] of RECENT) if (Date.now() - v > RECENT_TTL) RECENT.delete(k);
    }

    // 1) CACHE
    const { data: cached } = await admin
      .from("print_quote_cache")
      .select("payload, expires_at, extraction_engine, confidence_level, platform")
      .eq("url", normalized).maybeSingle();
    if (cached && new Date(cached.expires_at).getTime() > Date.now() && (cached.payload as any)?.analyzer_version === ANALYZER_VERSION) {
      const cachedPayload = cached.payload as any;
      // re-price (material may differ)
      const m = cachedPayload.unified ?? cachedPayload;
      const weight = m.estimatedWeight ?? cachedPayload.model?.weight_g ?? 30;
      const minutes = m.printTime ?? cachedPayload.model?.print_minutes ?? 180;
      const complexity = m.complexityScore ?? 50;
      const colorCount = Math.max(Number(m.colorCount ?? cachedPayload.breakdown?.color_count ?? 1), 1);
      const { breakdown, material } = await computePricing(admin, weight, minutes, complexity, material_code, colorCount);
      const responsePayload = {
        source: "cached",
        url_hash,
        cacheHit: true,
        unified: m,
        model: {
          name: m.title, thumbnail: m.thumbnail, description: m.description,
          weight_g: weight, print_minutes: minutes,
          dimensions_mm: null, recommended_printer: null,
          difficulty: breakdown.inputs.difficulty,
          color_count: colorCount,
        },
        breakdown, material,
      };
      // analytics (non-blocking)
      admin.from("print_url_analytics").insert({
        url_hash, source_url: normalized, platform,
        user_id: userData.user.id,
        engine_used: cached.extraction_engine ?? "cache",
        confidence_level: cached.confidence_level ?? "medium",
        cache_hit: true, duration_ms: Date.now() - t0,
      }).then(() => {}, () => {});
      return new Response(JSON.stringify(responsePayload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2-4) Cascade
    let partial: Partial<UnifiedModel> = {
      sourcePlatform: platform,
      title: "", creator: { name: null, url: null }, description: null,
      images: [], thumbnail: null, tags: [], category: null,
      stats: { downloads: 0, likes: 0, prints: 0 },
      printProfiles: [], bambuCompatible: null,
      estimatedWeight: null, printTime: null, colorCount: 1, complexityScore: 0,
      confidenceLevel: "low",
      source: { engine: "none", scrapedAt: new Date().toISOString() },
    };

    let engineUsed = "none";
    const mw = await tryMakerWorld(normalized, platform);
    if (mw) { partial = { ...partial, ...mw }; engineUsed = "openapi"; }

    if (!partial.title || !partial.estimatedWeight) {
      const fc = await tryFirecrawl(normalized);
      if (fc) {
        partial = { ...partial, ...fc, images: fc.images?.length ? fc.images : partial.images };
        engineUsed = engineUsed === "openapi" ? "openapi+firecrawl" : "firecrawl";
      }
    }
    if (!partial.title || !partial.thumbnail || !partial.estimatedWeight || engineUsed.includes("firecrawl")) {
      const fs = await tryFetchScrape(normalized);
      if (fs) {
        partial = {
          ...partial,
          title: fs.title || partial.title,
          description: fs.description || partial.description,
          images: fs.images?.length ? fs.images : partial.images,
          thumbnail: fs.thumbnail || partial.thumbnail,
          estimatedWeight: fs.estimatedWeight ?? partial.estimatedWeight,
          printTime: fs.printTime ?? partial.printTime,
          colorCount: Math.max(Number(partial.colorCount ?? 1), Number(fs.colorCount ?? 1)),
        };
        engineUsed = engineUsed === "none" ? "fetch" : `${engineUsed}+fetch`;
      }
    }
    if (!partial.estimatedWeight || !partial.printTime) {
      const ai = await aiFill(partial, normalized);
      partial = { ...partial, ...ai };
      engineUsed = engineUsed === "none" ? "ai" : `${engineUsed}+ai`;
    }

    if (!partial.title) partial.title = "3D Model";
    partial.sourcePlatform = platform;
    partial.complexityScore = computeComplexity(partial);
    partial.confidenceLevel = confidenceFrom(partial, engineUsed);
    partial.source = { engine: engineUsed, scrapedAt: new Date().toISOString() };

    const weight = partial.estimatedWeight ?? 30;
    const minutes = partial.printTime ?? 180;
    const colorCount = Math.max(Number(partial.colorCount ?? 1), detectColorCount(`${partial.description ?? ""} ${(partial.tags ?? []).join(" ")}`, partial.printProfiles), 1);
    partial.colorCount = colorCount;
    const { breakdown, material } = await computePricing(
      admin, weight, minutes, partial.complexityScore, material_code, colorCount,
    );

    const responsePayload = {
      analyzer_version: ANALYZER_VERSION,
      source: engineUsed.includes("ai") && engineUsed === "ai" ? "ai" : "scrape",
      url_hash,
      cacheHit: false,
      unified: partial as UnifiedModel,
      model: {
        name: partial.title,
        thumbnail: partial.thumbnail ?? null,
        description: partial.description ?? null,
        weight_g: weight, print_minutes: minutes,
        dimensions_mm: null, recommended_printer: null,
        difficulty: breakdown.inputs.difficulty,
        color_count: colorCount,
      },
      breakdown, material,
    };

    // Save to cache (7 days)
    admin.from("print_quote_cache").upsert({
      url: normalized,
      payload: responsePayload as unknown as Record<string, unknown>,
      source: engineUsed,
      platform,
      extraction_engine: engineUsed,
      confidence_level: partial.confidenceLevel,
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    }, { onConflict: "url" }).then(() => {}, () => {});

    // Analytics
    admin.from("print_url_analytics").insert({
      url_hash, source_url: normalized, platform,
      user_id: userData.user.id,
      engine_used: engineUsed,
      confidence_level: partial.confidenceLevel,
      cache_hit: false, duration_ms: Date.now() - t0,
    }).then(() => {}, () => {});

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("print-quote-from-link error", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
