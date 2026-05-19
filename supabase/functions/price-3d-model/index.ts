// price-3d-model: computes the IQD price for a 3D print given client-side
// computed geometry metrics. Reads materials + machine profile + global
// quote_pricing settings from the DB. Uses file_hash for caching.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Metrics {
  volume_cm3: number;
  surface_area_cm2: number;
  bbox_mm: { x: number; y: number; z: number };
  triangle_count: number;
  complexity: number;
}

interface Quality {
  non_manifold_edges: number;
  non_manifold_pct: number;
  flipped_normals_pct: number;
  overhang_pct: number;
  min_wall_mm: number | null;
  thin_wall_warning: boolean;
  support_required: boolean;
  watertight: boolean;
}

interface Pricing {
  filament_price_per_kg: number;
  hourly_machine_cost: number;
  base_complexity_fee: number;
  platform_fee_pct: number;
  profit_margin_pct: number;
  min_range_pct: number;
  max_range_pct: number;
}

const round250 = (n: number) => Math.round(n / 250) * 250;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function difficultyFromQuality(q: Quality, complexity: number): "easy" | "medium" | "hard" {
  if (complexity > 60 || q.overhang_pct > 0.15 || q.non_manifold_edges > 100) return "hard";
  if (complexity > 30 || q.overhang_pct > 0.05) return "medium";
  return "easy";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    const metrics = body.metrics as Metrics | undefined;
    const quality = (body.quality as Quality | undefined) ?? {
      non_manifold_edges: 0, non_manifold_pct: 0, flipped_normals_pct: 0,
      overhang_pct: 0, min_wall_mm: null, thin_wall_warning: false,
      support_required: false, watertight: true,
    };
    const materialCode = (body.material_code as string | undefined) ?? "pla";
    const infillPctOverride = body.infill_pct as number | undefined;
    const fileHash = body.file_hash as string | undefined;
    const fileName = (body.file_name as string | undefined) ?? "model";

    if (!metrics || typeof metrics.volume_cm3 !== "number" || metrics.volume_cm3 <= 0) {
      return new Response(JSON.stringify({ error: "Invalid metrics" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cache lookup by file_hash + material_code.
    if (fileHash) {
      const { data: cached } = await admin
        .from("print_quote_cache")
        .select("payload, analysis_payload, material_code, expires_at")
        .eq("file_hash", fileHash)
        .maybeSingle();
      if (
        cached &&
        cached.material_code === materialCode &&
        new Date(cached.expires_at as string).getTime() > Date.now()
      ) {
        return new Response(JSON.stringify({ source: "cached", ...(cached.payload as object) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Load material.
    const { data: material } = await admin
      .from("print_materials")
      .select("*")
      .eq("code", materialCode)
      .eq("is_active", true)
      .maybeSingle();
    if (!material) {
      return new Response(JSON.stringify({ error: `Unknown material: ${materialCode}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load default machine profile.
    const { data: machine } = await admin
      .from("print_machine_profiles")
      .select("*")
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Global pricing config.
    const { data: settingsRow } = await admin
      .from("community_settings")
      .select("value")
      .eq("key", "quote_pricing")
      .maybeSingle();

    const pricing: Pricing = (settingsRow?.value as Pricing) ?? {
      filament_price_per_kg: Number(material.cost_per_kg_iqd),
      hourly_machine_cost: 2000,
      base_complexity_fee: 1500,
      platform_fee_pct: 0.017,
      profit_margin_pct: 0.15,
      min_range_pct: 0.9,
      max_range_pct: 1.15,
    };

    const density = Number(material.density_g_cm3);
    const filamentPrice = Number(material.cost_per_kg_iqd);
    const infillPct = clamp(infillPctOverride ?? Number(material.default_infill_pct), 5, 100);
    const hourlyCost = Number(machine?.hourly_cost_iqd ?? pricing.hourly_machine_cost);
    const flowRate = Number(machine?.nozzle_flow_rate_cm3_min ?? 8); // cm³/min
    const layerHeight = Number(material.default_layer_height_mm);
    const travelOverheadSec = Number(machine?.travel_overhead_per_layer_sec ?? 1.5);

    // Effective volume: shell at ~100% + infill density.
    const infillFactor = 0.2 + 0.8 * (infillPct / 100);
    const effectiveVolume = metrics.volume_cm3 * infillFactor;
    const weight_g = effectiveVolume * density;

    // Print time: extrusion + travel overhead per layer.
    const extrusionMin = effectiveVolume / Math.max(1, flowRate);
    const layers = Math.max(1, Math.ceil(metrics.bbox_mm.z / Math.max(0.05, layerHeight)));
    const travelMin = (layers * travelOverheadSec) / 60;
    const print_minutes = Math.max(5, Math.round(extrusionMin + travelMin));

    const difficulty = difficultyFromQuality(quality, metrics.complexity);
    const complexityMult = difficulty === "easy" ? 1 : difficulty === "hard" ? 2.2 : 1.5;

    const filament_cost = (weight_g / 1000) * filamentPrice;
    const machine_cost = (print_minutes / 60) * hourlyCost;
    const complexity_fee = pricing.base_complexity_fee * complexityMult;
    const subtotal = filament_cost + machine_cost + complexity_fee;
    const platform_fee = subtotal * pricing.platform_fee_pct;
    const profit_margin = subtotal * pricing.profit_margin_pct;
    const final = subtotal + platform_fee + profit_margin;

    const payload = {
      model: {
        name: fileName,
        thumbnail: null,
        description: null,
        weight_g: Math.round(weight_g),
        print_minutes,
        dimensions_mm: metrics.bbox_mm,
        recommended_printer: null,
        difficulty,
      },
      breakdown: {
        filament_cost: round250(filament_cost),
        machine_cost: round250(machine_cost),
        complexity_fee: round250(complexity_fee),
        platform_fee: round250(platform_fee),
        profit_margin: round250(profit_margin),
        subtotal: round250(subtotal),
        final: round250(final),
        price_min: round250(final * pricing.min_range_pct),
        price_max: round250(final * pricing.max_range_pct),
        inputs: { weight_g: Math.round(weight_g), print_minutes, difficulty },
        pricing,
      },
      metrics,
      quality,
      material: {
        code: material.code,
        name_en: material.name_en,
        name_ar: material.name_ar,
        density: density,
        cost_per_kg: filamentPrice,
        infill_pct: infillPct,
      },
    };

    if (fileHash) {
      await admin.from("print_quote_cache").upsert(
        {
          url: `file://${fileHash}`,
          file_hash: fileHash,
          material_code: materialCode,
          payload: payload as unknown as Record<string, unknown>,
          analysis_payload: { metrics, quality } as unknown as Record<string, unknown>,
          source: "geometry",
          expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        },
        { onConflict: "file_hash" },
      );
    }

    return new Response(JSON.stringify({ source: "geometry", ...payload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("price-3d-model error", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Internal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
