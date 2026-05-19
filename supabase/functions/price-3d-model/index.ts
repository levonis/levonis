// price-3d-model v2: Industrial Craftcloud-style pricing engine.
// Supports FDM / Resin / SLS, with full breakdown, rush tiers, bulk discounts,
// load balancing, difficulty 1-10, and cache.

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
  parts_count?: number;
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

const round = (n: number, step = 250) => Math.round(n / step) * step;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function difficultyTier(q: Quality, complexity: number): "easy" | "medium" | "hard" {
  if (complexity > 60 || q.overhang_pct > 0.15 || q.non_manifold_edges > 100) return "hard";
  if (complexity > 30 || q.overhang_pct > 0.05) return "medium";
  return "easy";
}

function difficultyScore(q: Quality, complexity: number): number {
  const raw =
    complexity / 10 +
    q.overhang_pct * 30 +
    q.non_manifold_pct * 10 +
    (q.thin_wall_warning ? 1 : 0) +
    (q.flipped_normals_pct > 0.05 ? 1 : 0);
  return clamp(Math.round(raw), 1, 10);
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
    const qtyRaw = Number(body.qty ?? 1);
    const qty = clamp(Math.floor(qtyRaw), 1, 1000);
    const rushTier = (["standard", "fast", "rush"].includes(body.rush_tier)
      ? body.rush_tier
      : "standard") as "standard" | "fast" | "rush";
    const partsCount = clamp(Math.floor(Number(body.parts_count ?? metrics?.parts_count ?? 1)), 1, 50);
    const colorCount = clamp(Math.floor(Number(body.color_count ?? 1)), 1, 16);

    if (!metrics || typeof metrics.volume_cm3 !== "number" || metrics.volume_cm3 <= 0) {
      return new Response(JSON.stringify({ error: "Invalid metrics" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cache lookup
    if (fileHash) {
      const { data: cached } = await admin
        .from("print_quote_cache")
        .select("payload, material_code, expires_at")
        .eq("file_hash", fileHash)
        .maybeSingle();
      if (
        cached &&
        cached.material_code === materialCode &&
        new Date(cached.expires_at as string).getTime() > Date.now() &&
        (cached.payload as any)?.breakdown?.rush_tier === rushTier &&
        (cached.payload as any)?.breakdown?.qty === qty &&
        Number((cached.payload as any)?.breakdown?.color_count ?? 1) === colorCount
      ) {
        return new Response(JSON.stringify({ source: "cached", ...(cached.payload as object) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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
    const processType = (material.process_type as string) ?? "fdm";

    // Best machine for this process; fallback to any default machine
    const { data: machineRows } = await admin
      .from("print_machine_profiles")
      .select("*")
      .eq("is_active", true)
      .order("is_default", { ascending: false });
    const machine =
      (machineRows ?? []).find((m: any) => m.process_type === processType) ??
      (machineRows ?? [])[0];

    // Global config
    const { data: settingsRow } = await admin
      .from("community_settings")
      .select("value")
      .eq("key", "quote_pricing")
      .maybeSingle();
    const cfg: any = settingsRow?.value ?? {};
    const base = cfg.base ?? {};
    const risk = cfg.risk ?? {};
    const rush = cfg.rush ?? { standard: { mult: 1 }, fast: { mult: 1.25 }, rush: { mult: 1.6 } };
    const bulkTiers: Array<{ min_qty: number; discount_pct: number }> = cfg.bulk_tiers ?? [];
    const lb = cfg.load_balancing ?? { enabled: false };
    const proc = (cfg.processes ?? {})[processType] ?? {};

    const density = Number(material.density_g_cm3);
    const materialPricePerKg = Number(material.cost_per_kg_iqd);
    const infillPct = clamp(
      infillPctOverride ?? Number(material.default_infill_pct),
      processType === "fdm" ? 5 : 100,
      100,
    );
    const hourlyCost = Number(machine?.hourly_cost_iqd ?? 2000);
    const flowRate = Number(machine?.nozzle_flow_rate_cm3_min ?? 8);
    const layerHeight = Number(material.default_layer_height_mm);
    const travelOverheadSec = Number(machine?.travel_overhead_per_layer_sec ?? 1.5);
    const electricityKwh = Number(base.electricity_kwh_iqd ?? 250);
    const machineKw = Number(proc.machine_kw ?? 0.15);
    const failureRate = Number(proc.failure_rate_pct ?? 0.05);
    const supportMult = Number(proc.support_mult ?? 1.0);
    const postProcessingMin = Number(proc.post_processing_min ?? 5);
    const laborPerHour = Number(base.labor_per_hour_iqd ?? 3000);
    const packaging = Number(base.packaging_iqd ?? 1500);
    const depreciationPct = Number(base.depreciation_pct ?? 0.05);
    const platformFeePct = Number(base.platform_fee_pct ?? 0.017);
    const profitPct = Number(base.profit_margin_pct ?? 0.15);
    const minRange = Number(base.min_range_pct ?? 0.9);
    const maxRange = Number(base.max_range_pct ?? 1.15);
    const minOrder = Number(base.min_order_iqd ?? 5000);
    const roundStep = Number(base.round_to_iqd ?? 250);
    const baseComplexityFee = Number(base.base_complexity_fee ?? 1500);
    const extraColors = Math.max(0, colorCount - 1);
    const multiColorFixed = Number(base.multi_color_fixed_iqd ?? 1000);
    const multiColorPerHour = Number(base.multi_color_per_hour_iqd ?? 350);
    const multiColorMaterialWastePct = Number(base.multi_color_material_waste_pct ?? 0.06);

    // === Weight & print time per process ===
    let weight_g = 0;
    let print_minutes = 0;
    let unusedVolume = 0;

    if (processType === "fdm") {
      const infillFactor = 0.2 + 0.8 * (infillPct / 100);
      const effectiveVolume = metrics.volume_cm3 * infillFactor;
      weight_g = effectiveVolume * density;
      const extrusionMin = effectiveVolume / Math.max(1, flowRate);
      const layers = Math.max(1, Math.ceil(metrics.bbox_mm.z / Math.max(0.05, layerHeight)));
      const travelMin = (layers * travelOverheadSec) / 60;
      print_minutes = Math.max(5, Math.round(extrusionMin + travelMin));
    } else if (processType === "resin") {
      const waste = Number(proc.resin_waste_pct ?? 0.15);
      weight_g = metrics.volume_cm3 * density * (1 + waste);
      const layers = Math.max(1, Math.ceil(metrics.bbox_mm.z / Math.max(0.02, layerHeight)));
      const curePerLayerSec = Number(machine?.travel_overhead_per_layer_sec ?? 6);
      print_minutes = Math.max(10, Math.round((layers * curePerLayerSec) / 60 + postProcessingMin));
    } else {
      // SLS: weight uses powder packing density to account for refresh
      const packingDensity = Number(proc.packing_density ?? 0.08);
      const refresh = Number(proc.powder_refresh_pct ?? 0.30);
      weight_g = metrics.volume_cm3 * density;
      const buildVolumeUsed = metrics.volume_cm3 / Math.max(0.02, packingDensity);
      unusedVolume = Math.max(0, buildVolumeUsed - metrics.volume_cm3) * refresh;
      // Build time ~ 20mm height per hour typical
      const buildHours = Math.max(0.5, metrics.bbox_mm.z / 20);
      print_minutes = Math.round(buildHours * 60 + postProcessingMin);
    }

    weight_g = weight_g * qty;
    const print_hours = print_minutes / 60;

    // === Base costs (per total order) ===
    const materialCost =
      processType === "sls"
        ? ((weight_g + unusedVolume * density) / 1000) * materialPricePerKg
        : (weight_g / 1000) * materialPricePerKg;
    const machineCost = print_hours * hourlyCost * qty;
    const electricityCost = print_hours * machineKw * electricityKwh * qty;
    const supportsCost = quality.support_required
      ? materialCost * 0.1 * supportMult
      : 0;
    const depreciationCost = machineCost * depreciationPct;
    const laborMinutes = (postProcessingMin + (partsCount - 1) * 2) * qty;
    const laborCost = (laborMinutes / 60) * laborPerHour;
    const multipartLabor = (partsCount - 1) * Number(risk.multipart_labor_per_part_iqd ?? 0) * qty;
    const packagingCost = packaging * qty;
    const washCureCost = processType === "resin" ? Number(proc.wash_cure_iqd ?? 0) * qty : 0;
    const multiColorCost = processType === "fdm"
      ? extraColors * (multiColorFixed * qty + multiColorPerHour * print_hours * qty + materialCost * multiColorMaterialWastePct)
      : 0;

    const rawSubtotal =
      materialCost +
      machineCost +
      electricityCost +
      supportsCost +
      depreciationCost +
      laborCost +
      multipartLabor +
      packagingCost +
      washCureCost +
      multiColorCost +
      baseComplexityFee;

    const failureRiskCost = rawSubtotal * failureRate;
    let subtotal = rawSubtotal + failureRiskCost;

    // === Dynamic multipliers ===
    const tier = difficultyTier(quality, metrics.complexity);
    const complexityMult = Number((risk.complexity_mult ?? {})[tier] ?? (tier === "hard" ? 2.2 : tier === "medium" ? 1.5 : 1));
    const overhangMult = 1 + (quality.overhang_pct * 10) * Number(risk.overhang_mult_per_10pct ?? 0.08);
    const largeThreshold = Number(risk.large_model_threshold_cm3 ?? 200);
    const largeMult = metrics.volume_cm3 > largeThreshold ? Number(risk.large_model_mult ?? 1.15) : 1;
    subtotal = subtotal * complexityMult * overhangMult * largeMult;

    // === Rush ===
    const rushMult = Number((rush[rushTier] ?? {}).mult ?? 1);
    const rushDays = Number((rush[rushTier] ?? {}).days ?? 7);
    subtotal = subtotal * rushMult;

    // === Load balancing ===
    let loadMult = 1;
    if (lb?.enabled && machine) {
      const queue = Number(machine.current_queue_count ?? 0);
      loadMult = queue >= Number(lb.high_threshold_pending ?? 5)
        ? Number(lb.queue_high_mult ?? 1.1)
        : Number(lb.queue_low_mult ?? 0.95);
      subtotal = subtotal * loadMult;
    }

    // === Bulk discount (by qty) ===
    let bulkDiscountPct = 0;
    for (const tierRow of bulkTiers.sort((a, b) => b.min_qty - a.min_qty)) {
      if (qty >= tierRow.min_qty) { bulkDiscountPct = tierRow.discount_pct; break; }
    }
    const bulkDiscountAmount = subtotal * bulkDiscountPct;
    subtotal = subtotal - bulkDiscountAmount;

    const platformFee = subtotal * platformFeePct;
    const profitMargin = subtotal * profitPct;
    let final = subtotal + platformFee + profitMargin;
    if (final < minOrder) final = minOrder;

    const recommended = round(final, roundStep);
    const price_min = round(final * minRange, roundStep);
    const price_max = round(final * maxRange, roundStep);

    const score = difficultyScore(quality, metrics.complexity);

    // Rush previews (for UI without recompute)
    const rushOptions = (["standard", "fast", "rush"] as const).map((k) => ({
      tier: k,
      mult: Number((rush[k] ?? {}).mult ?? 1),
      days: Number((rush[k] ?? {}).days ?? 7),
      preview_iqd: round((final / rushMult) * Number((rush[k] ?? {}).mult ?? 1), roundStep),
    }));

    const bulkPreview = bulkTiers.map((t) => ({
      min_qty: t.min_qty,
      discount_pct: t.discount_pct,
      preview_iqd_per_unit: round((final / qty) * (1 - t.discount_pct), roundStep),
    }));

    const payload = {
      model: {
        name: fileName,
        thumbnail: null,
        description: null,
        weight_g: Math.round(weight_g),
        print_minutes,
        dimensions_mm: metrics.bbox_mm,
        recommended_printer: machine?.name ?? null,
        difficulty: tier,
        difficulty_score: score,
        color_count: colorCount,
        process: processType,
      },
      breakdown: {
        // legacy keys kept for backward compatibility
        filament_cost: round(materialCost, roundStep),
        machine_cost: round(machineCost, roundStep),
        complexity_fee: round(baseComplexityFee * complexityMult, roundStep),
        platform_fee: round(platformFee, roundStep),
        profit_margin: round(profitMargin, roundStep),
        subtotal: round(subtotal, roundStep),
        final: recommended,
        price_min,
        price_max,
        // new fields
        components: [
          { key: "material", label_ar: "المادة", label_en: "Material", value: round(materialCost, roundStep) },
          { key: "machine", label_ar: "تشغيل الماكينة", label_en: "Machine runtime", value: round(machineCost, roundStep) },
          { key: "electricity", label_ar: "الكهرباء", label_en: "Electricity", value: round(electricityCost, roundStep) },
          { key: "supports", label_ar: "الدعامات", label_en: "Supports", value: round(supportsCost, roundStep) },
          { key: "depreciation", label_ar: "إهلاك الماكينة", label_en: "Depreciation", value: round(depreciationCost, roundStep) },
          { key: "labor", label_ar: "العمل اليدوي", label_en: "Labor", value: round(laborCost + multipartLabor, roundStep) },
          { key: "packaging", label_ar: "التغليف", label_en: "Packaging", value: round(packagingCost, roundStep) },
          ...(washCureCost > 0 ? [{ key: "wash_cure", label_ar: "غسيل ومعالجة", label_en: "Wash & cure", value: round(washCureCost, roundStep) }] : []),
          ...(multiColorCost > 0 ? [{ key: "multi_color", label_ar: "تعدد الألوان", label_en: "Multi-color", value: round(multiColorCost, roundStep) }] : []),
          { key: "failure_risk", label_ar: "احتمال الفشل", label_en: "Failure risk", value: round(failureRiskCost, roundStep) },
          { key: "complexity_fee", label_ar: "رسم التعقيد", label_en: "Complexity fee", value: round(baseComplexityFee, roundStep) },
        ],
        multipliers: {
          complexity: complexityMult,
          overhang: overhangMult,
          large_model: largeMult,
          rush: rushMult,
          load_balancing: loadMult,
          bulk_discount_pct: bulkDiscountPct,
          extra_colors: extraColors,
        },
        platform_fee_amount: round(platformFee, roundStep),
        profit_margin_amount: round(profitMargin, roundStep),
        rush_tier: rushTier,
        rush_days: rushDays,
        qty,
        parts_count: partsCount,
        color_count: colorCount,
        rush_options: rushOptions,
        bulk_preview: bulkPreview,
        inputs: { weight_g: Math.round(weight_g), print_minutes, difficulty: tier },
      },
      metrics,
      quality,
      material: {
        code: material.code,
        name_en: material.name_en,
        name_ar: material.name_ar,
        density: density,
        cost_per_kg: materialPricePerKg,
        infill_pct: infillPct,
        process_type: processType,
      },
    };

    if (fileHash) {
      try {
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
      } catch (_) { /* non-blocking */ }
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
