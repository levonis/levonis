// Pure pricing engine — no IO, fully unit-testable.
// Mirrors the equations used by price-3d-model edge function.

export interface Metrics {
  volume_cm3: number;
  surface_area_cm2: number;
  bbox_mm: { x: number; y: number; z: number };
  triangle_count: number;
  complexity: number;
  parts_count?: number;
}

export interface Quality {
  non_manifold_edges: number;
  non_manifold_pct: number;
  flipped_normals_pct: number;
  overhang_pct: number;
  min_wall_mm: number | null;
  thin_wall_warning: boolean;
  support_required: boolean;
  watertight: boolean;
}

export interface MaterialRow {
  code: string;
  name_en?: string;
  name_ar?: string;
  process_type?: "fdm" | "resin" | "sls" | string;
  density_g_cm3: number;
  cost_per_kg_iqd: number;
  default_infill_pct: number;
  default_layer_height_mm: number;
}

export interface MachineRow {
  name?: string;
  process_type?: string;
  hourly_cost_iqd?: number;
  nozzle_flow_rate_cm3_min?: number;
  travel_overhead_per_layer_sec?: number;
  current_queue_count?: number;
  is_active?: boolean;
  is_default?: boolean;
}

export interface PricingConfig {
  base?: Record<string, number>;
  risk?: Record<string, any>;
  rush?: Record<string, { mult?: number; days?: number }>;
  bulk_tiers?: Array<{ min_qty: number; discount_pct: number }>;
  load_balancing?: { enabled?: boolean; high_threshold_pending?: number; queue_high_mult?: number; queue_low_mult?: number };
  processes?: Record<string, Record<string, number>>;
}

export interface QuoteInputs {
  metrics: Metrics;
  quality?: Partial<Quality>;
  material: MaterialRow;
  machine?: MachineRow | null;
  config?: PricingConfig;
  qty?: number;
  rush_tier?: "standard" | "fast" | "rush";
  parts_count?: number;
  color_count?: number;
  infill_pct_override?: number;
}

export const round = (n: number, step = 250) => Math.round(n / step) * step;
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function defaultQuality(q?: Partial<Quality>): Quality {
  return {
    non_manifold_edges: q?.non_manifold_edges ?? 0,
    non_manifold_pct: q?.non_manifold_pct ?? 0,
    flipped_normals_pct: q?.flipped_normals_pct ?? 0,
    overhang_pct: q?.overhang_pct ?? 0,
    min_wall_mm: q?.min_wall_mm ?? null,
    thin_wall_warning: q?.thin_wall_warning ?? false,
    support_required: q?.support_required ?? false,
    watertight: q?.watertight ?? true,
  };
}

export function difficultyTier(q: Quality, complexity: number): "easy" | "medium" | "hard" {
  if (complexity > 60 || q.overhang_pct > 0.15 || q.non_manifold_edges > 100) return "hard";
  if (complexity > 30 || q.overhang_pct > 0.05) return "medium";
  return "easy";
}

export function difficultyScore(q: Quality, complexity: number): number {
  const raw =
    complexity / 10 +
    q.overhang_pct * 30 +
    q.non_manifold_pct * 10 +
    (q.thin_wall_warning ? 1 : 0) +
    (q.flipped_normals_pct > 0.05 ? 1 : 0);
  return clamp(Math.round(raw), 1, 10);
}

export interface QuoteResult {
  weight_g: number;
  print_minutes: number;
  tier: "easy" | "medium" | "hard";
  difficulty_score: number;
  process: string;
  components: {
    material: number;
    machine: number;
    electricity: number;
    supports: number;
    depreciation: number;
    labor: number;
    packaging: number;
    wash_cure: number;
    multi_color: number;
    failure_risk: number;
    complexity_fee: number;
  };
  multipliers: {
    complexity: number;
    overhang: number;
    large_model: number;
    rush: number;
    load_balancing: number;
    bulk_discount_pct: number;
    extra_colors: number;
  };
  platform_fee: number;
  profit_margin: number;
  final: number;
  price_min: number;
  price_max: number;
  recommended: number;
}

export function computeQuote(inp: QuoteInputs): QuoteResult {
  const metrics = inp.metrics;
  const quality = defaultQuality(inp.quality);
  const material = inp.material;
  const machine = inp.machine ?? null;
  const cfg = inp.config ?? {};
  const qty = clamp(Math.floor(inp.qty ?? 1), 1, 1000);
  const rushTier = (["standard", "fast", "rush"] as const).includes(inp.rush_tier as any)
    ? (inp.rush_tier as "standard" | "fast" | "rush")
    : "standard";
  const partsCount = clamp(Math.floor(inp.parts_count ?? metrics.parts_count ?? 1), 1, 50);
  const colorCount = clamp(Math.floor(inp.color_count ?? 1), 1, 16);

  const processType = (material.process_type as string) ?? "fdm";

  const base = cfg.base ?? {};
  const risk = cfg.risk ?? {};
  const rush = cfg.rush ?? { standard: { mult: 1 }, fast: { mult: 1.25 }, rush: { mult: 1.6 } };
  const bulkTiers = cfg.bulk_tiers ?? [];
  const lb = cfg.load_balancing ?? { enabled: false };
  const proc = (cfg.processes ?? {})[processType] ?? {};

  const density = Number(material.density_g_cm3);
  const materialPricePerKg = Number(material.cost_per_kg_iqd);
  const infillPct = clamp(
    inp.infill_pct_override ?? Number(material.default_infill_pct),
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
    const packingDensity = Number(proc.packing_density ?? 0.08);
    const refresh = Number(proc.powder_refresh_pct ?? 0.30);
    weight_g = metrics.volume_cm3 * density;
    const buildVolumeUsed = metrics.volume_cm3 / Math.max(0.02, packingDensity);
    unusedVolume = Math.max(0, buildVolumeUsed - metrics.volume_cm3) * refresh;
    const buildHours = Math.max(0.5, metrics.bbox_mm.z / 20);
    print_minutes = Math.round(buildHours * 60 + postProcessingMin);
  }

  weight_g = weight_g * qty;
  const print_hours = print_minutes / 60;

  const materialCost =
    processType === "sls"
      ? ((weight_g + unusedVolume * density) / 1000) * materialPricePerKg
      : (weight_g / 1000) * materialPricePerKg;
  const machineCost = print_hours * hourlyCost * qty;
  const electricityCost = print_hours * machineKw * electricityKwh * qty;
  const supportsCost = quality.support_required ? materialCost * 0.1 * supportMult : 0;
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

  const tier = difficultyTier(quality, metrics.complexity);
  const complexityMult = Number(
    (risk.complexity_mult ?? {})[tier] ?? (tier === "hard" ? 2.2 : tier === "medium" ? 1.5 : 1),
  );
  const overhangMult = 1 + quality.overhang_pct * 10 * Number(risk.overhang_mult_per_10pct ?? 0.08);
  const largeThreshold = Number(risk.large_model_threshold_cm3 ?? 200);
  const largeMult = metrics.volume_cm3 > largeThreshold ? Number(risk.large_model_mult ?? 1.15) : 1;
  subtotal = subtotal * complexityMult * overhangMult * largeMult;

  const rushMult = Number((rush[rushTier] ?? {}).mult ?? 1);
  subtotal = subtotal * rushMult;

  let loadMult = 1;
  if (lb?.enabled && machine) {
    const queue = Number(machine.current_queue_count ?? 0);
    loadMult = queue >= Number(lb.high_threshold_pending ?? 5)
      ? Number(lb.queue_high_mult ?? 1.1)
      : Number(lb.queue_low_mult ?? 0.95);
    subtotal = subtotal * loadMult;
  }

  let bulkDiscountPct = 0;
  for (const tierRow of [...bulkTiers].sort((a, b) => b.min_qty - a.min_qty)) {
    if (qty >= tierRow.min_qty) { bulkDiscountPct = tierRow.discount_pct; break; }
  }
  subtotal = subtotal * (1 - bulkDiscountPct);

  const platformFee = subtotal * platformFeePct;
  const profitMargin = subtotal * profitPct;
  let final = subtotal + platformFee + profitMargin;
  if (final < minOrder) final = minOrder;

  const recommended = round(final, roundStep);
  const price_min = round(final * minRange, roundStep);
  const price_max = round(final * maxRange, roundStep);
  const score = difficultyScore(quality, metrics.complexity);

  return {
    weight_g: Math.round(weight_g),
    print_minutes,
    tier,
    difficulty_score: score,
    process: processType,
    components: {
      material: materialCost,
      machine: machineCost,
      electricity: electricityCost,
      supports: supportsCost,
      depreciation: depreciationCost,
      labor: laborCost + multipartLabor,
      packaging: packagingCost,
      wash_cure: washCureCost,
      multi_color: multiColorCost,
      failure_risk: failureRiskCost,
      complexity_fee: baseComplexityFee,
    },
    multipliers: {
      complexity: complexityMult,
      overhang: overhangMult,
      large_model: largeMult,
      rush: rushMult,
      load_balancing: loadMult,
      bulk_discount_pct: bulkDiscountPct,
      extra_colors: extraColors,
    },
    platform_fee: platformFee,
    profit_margin: profitMargin,
    final,
    price_min,
    price_max,
    recommended,
  };
}
