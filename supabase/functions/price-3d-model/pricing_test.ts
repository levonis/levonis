// Deno unit tests for the pure pricing engine.
// Run: deno test supabase/functions/price-3d-model/pricing_test.ts

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeQuote,
  difficultyScore,
  difficultyTier,
  type MachineRow,
  type MaterialRow,
  type PricingConfig,
  type Quality,
} from "./pricing.ts";

const baseConfig: PricingConfig = {
  base: {
    electricity_kwh_iqd: 250,
    labor_per_hour_iqd: 3000,
    packaging_iqd: 1500,
    depreciation_pct: 0.05,
    platform_fee_pct: 0.017,
    profit_margin_pct: 0.15,
    min_range_pct: 0.9,
    max_range_pct: 1.15,
    min_order_iqd: 5000,
    round_to_iqd: 250,
    base_complexity_fee: 1500,
  },
  risk: {
    complexity_mult: { easy: 1, medium: 1.5, hard: 2.2 },
    overhang_mult_per_10pct: 0.08,
    large_model_threshold_cm3: 200,
    large_model_mult: 1.15,
    multipart_labor_per_part_iqd: 500,
  },
  rush: {
    standard: { mult: 1, days: 7 },
    fast: { mult: 1.25, days: 4 },
    rush: { mult: 1.6, days: 2 },
  },
  bulk_tiers: [
    { min_qty: 5, discount_pct: 0.05 },
    { min_qty: 10, discount_pct: 0.10 },
    { min_qty: 25, discount_pct: 0.18 },
  ],
  load_balancing: { enabled: false },
  processes: {
    fdm: { machine_kw: 0.15, failure_rate_pct: 0.05, support_mult: 1, post_processing_min: 5 },
    resin: { machine_kw: 0.12, failure_rate_pct: 0.08, support_mult: 1.2, post_processing_min: 15, resin_waste_pct: 0.15, wash_cure_iqd: 2000 },
    sls: { machine_kw: 1.5, failure_rate_pct: 0.03, post_processing_min: 20, packing_density: 0.08, powder_refresh_pct: 0.3 },
  },
};

const PLA: MaterialRow = {
  code: "pla", process_type: "fdm",
  density_g_cm3: 1.24, cost_per_kg_iqd: 25000,
  default_infill_pct: 20, default_layer_height_mm: 0.2,
};
const RESIN: MaterialRow = {
  code: "resin_std", process_type: "resin",
  density_g_cm3: 1.1, cost_per_kg_iqd: 60000,
  default_infill_pct: 100, default_layer_height_mm: 0.05,
};
const NYLON: MaterialRow = {
  code: "pa12", process_type: "sls",
  density_g_cm3: 1.01, cost_per_kg_iqd: 120000,
  default_infill_pct: 100, default_layer_height_mm: 0.1,
};

const fdmMachine: MachineRow = { hourly_cost_iqd: 2000, nozzle_flow_rate_cm3_min: 8, travel_overhead_per_layer_sec: 1.5, process_type: "fdm" };
const resinMachine: MachineRow = { hourly_cost_iqd: 2500, travel_overhead_per_layer_sec: 6, process_type: "resin" };
const slsMachine: MachineRow = { hourly_cost_iqd: 8000, process_type: "sls" };

const simpleMetrics = (vol = 20, z = 30) => ({
  volume_cm3: vol, surface_area_cm2: 60, bbox_mm: { x: 40, y: 40, z },
  triangle_count: 5000, complexity: 10, parts_count: 1,
});

Deno.test("FDM: produces a sane breakdown with positive components and sorted range", () => {
  const r = computeQuote({ metrics: simpleMetrics(), material: PLA, machine: fdmMachine, config: baseConfig });
  assert(r.weight_g > 0, "weight should be > 0");
  assert(r.print_minutes >= 5);
  assert(r.components.material > 0);
  assert(r.components.machine > 0);
  assert(r.components.electricity > 0);
  assert(r.components.packaging > 0);
  assertEquals(r.components.wash_cure, 0, "FDM has no wash/cure");
  assert(r.price_min <= r.recommended && r.recommended <= r.price_max, "min <= recommended <= max");
  assertEquals(r.recommended % 250, 0, "recommended rounded to 250");
});

Deno.test("FDM: infill override increases weight & material cost", () => {
  const low = computeQuote({ metrics: simpleMetrics(), material: PLA, machine: fdmMachine, config: baseConfig, infill_pct_override: 10 });
  const high = computeQuote({ metrics: simpleMetrics(), material: PLA, machine: fdmMachine, config: baseConfig, infill_pct_override: 100 });
  assert(high.weight_g > low.weight_g);
  assert(high.components.material > low.components.material);
  assert(high.recommended > low.recommended);
});

Deno.test("Resin: includes waste in weight and wash_cure component", () => {
  const r = computeQuote({ metrics: simpleMetrics(), material: RESIN, machine: resinMachine, config: baseConfig });
  assertEquals(r.process, "resin");
  // 20 cm3 * 1.1 g/cm3 * 1.15 = 25.3 g
  assertEquals(r.weight_g, 25);
  assert(r.components.wash_cure > 0);
  assert(r.print_minutes >= 10);
});

Deno.test("SLS: adds unused powder refresh to material cost", () => {
  const r = computeQuote({ metrics: simpleMetrics(), material: NYLON, machine: slsMachine, config: baseConfig });
  assertEquals(r.process, "sls");
  // Just nylon weight: 20 * 1.01 = 20.2
  // Material cost should exceed pure (weight_g/1000)*pricePerKg because of refresh
  const pureMaterial = (r.weight_g / 1000) * 120000;
  assert(r.components.material > pureMaterial, "SLS material includes refresh overhead");
});

Deno.test("Min order floor enforced for tiny prints", () => {
  const tiny = { volume_cm3: 0.1, surface_area_cm2: 1, bbox_mm: { x: 5, y: 5, z: 5 }, triangle_count: 100, complexity: 1, parts_count: 1 };
  const r = computeQuote({ metrics: tiny, material: PLA, machine: fdmMachine, config: baseConfig });
  assert(r.final >= 5000, `final ${r.final} must be >= min_order_iqd 5000`);
  assert(r.recommended >= 5000);
});

Deno.test("Price range: min < recommended < max for normal prints", () => {
  const r = computeQuote({ metrics: simpleMetrics(50, 60), material: PLA, machine: fdmMachine, config: baseConfig });
  // For a non-floored final, min should be strictly below max
  if (r.recommended > 5000) {
    assert(r.price_min < r.price_max, "min < max");
    assert(r.price_min <= r.recommended);
    assert(r.recommended <= r.price_max);
  }
});

Deno.test("Rush tier multiplies final price", () => {
  const std = computeQuote({ metrics: simpleMetrics(80, 80), material: PLA, machine: fdmMachine, config: baseConfig, rush_tier: "standard" });
  const fast = computeQuote({ metrics: simpleMetrics(80, 80), material: PLA, machine: fdmMachine, config: baseConfig, rush_tier: "fast" });
  const rush = computeQuote({ metrics: simpleMetrics(80, 80), material: PLA, machine: fdmMachine, config: baseConfig, rush_tier: "rush" });
  assert(fast.final > std.final);
  assert(rush.final > fast.final);
});

Deno.test("Bulk discount triggers at qty thresholds", () => {
  const m = simpleMetrics(30, 40);
  const q1 = computeQuote({ metrics: m, material: PLA, machine: fdmMachine, config: baseConfig, qty: 1 });
  const q10 = computeQuote({ metrics: m, material: PLA, machine: fdmMachine, config: baseConfig, qty: 10 });
  const q25 = computeQuote({ metrics: m, material: PLA, machine: fdmMachine, config: baseConfig, qty: 25 });
  assertEquals(q1.multipliers.bulk_discount_pct, 0);
  assertEquals(q10.multipliers.bulk_discount_pct, 0.10);
  assertEquals(q25.multipliers.bulk_discount_pct, 0.18);
  // qty-25 unit price should be cheaper than qty-1
  assert(q25.final / 25 < q1.final, "bulk per-unit cheaper than single");
});

Deno.test("Complexity tier multipliers escalate", () => {
  const easy = computeQuote({
    metrics: { ...simpleMetrics(60, 50), complexity: 10 },
    quality: { overhang_pct: 0.01 },
    material: PLA, machine: fdmMachine, config: baseConfig,
  });
  const medium = computeQuote({
    metrics: { ...simpleMetrics(60, 50), complexity: 40 },
    quality: { overhang_pct: 0.07 },
    material: PLA, machine: fdmMachine, config: baseConfig,
  });
  const hard = computeQuote({
    metrics: { ...simpleMetrics(60, 50), complexity: 80 },
    quality: { overhang_pct: 0.2 },
    material: PLA, machine: fdmMachine, config: baseConfig,
  });
  assertEquals(easy.tier, "easy");
  assertEquals(medium.tier, "medium");
  assertEquals(hard.tier, "hard");
  assert(easy.multipliers.complexity < medium.multipliers.complexity);
  assert(medium.multipliers.complexity < hard.multipliers.complexity);
  assert(easy.final < medium.final);
  assert(medium.final < hard.final);
});

Deno.test("Large-model multiplier kicks in above threshold", () => {
  const small = computeQuote({ metrics: simpleMetrics(100, 50), material: PLA, machine: fdmMachine, config: baseConfig });
  const large = computeQuote({ metrics: simpleMetrics(300, 50), material: PLA, machine: fdmMachine, config: baseConfig });
  assertEquals(small.multipliers.large_model, 1);
  assertEquals(large.multipliers.large_model, 1.15);
});

Deno.test("difficultyScore clamped between 1 and 10", () => {
  const easyQ: Quality = {
    non_manifold_edges: 0, non_manifold_pct: 0, flipped_normals_pct: 0,
    overhang_pct: 0, min_wall_mm: null, thin_wall_warning: false,
    support_required: false, watertight: true,
  };
  assertEquals(difficultyScore(easyQ, 0), 1);
  const brutalQ: Quality = {
    ...easyQ, overhang_pct: 0.9, non_manifold_pct: 1, thin_wall_warning: true, flipped_normals_pct: 0.5,
  };
  assertEquals(difficultyScore(brutalQ, 100), 10);
  const mid = difficultyScore(easyQ, 35);
  assert(mid >= 1 && mid <= 10);
});

Deno.test("difficultyTier boundaries", () => {
  const q: Quality = {
    non_manifold_edges: 0, non_manifold_pct: 0, flipped_normals_pct: 0,
    overhang_pct: 0, min_wall_mm: null, thin_wall_warning: false,
    support_required: false, watertight: true,
  };
  assertEquals(difficultyTier(q, 10), "easy");
  assertEquals(difficultyTier(q, 31), "medium");
  assertEquals(difficultyTier(q, 61), "hard");
  assertEquals(difficultyTier({ ...q, overhang_pct: 0.2 }, 0), "hard");
});

Deno.test("Support required adds a non-zero supports cost", () => {
  const noSup = computeQuote({ metrics: simpleMetrics(), material: PLA, machine: fdmMachine, config: baseConfig });
  const withSup = computeQuote({ metrics: simpleMetrics(), quality: { support_required: true }, material: PLA, machine: fdmMachine, config: baseConfig });
  assertEquals(noSup.components.supports, 0);
  assert(withSup.components.supports > 0);
  assert(withSup.final > noSup.final);
});
