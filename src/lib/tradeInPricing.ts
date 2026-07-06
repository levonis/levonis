// Client-side estimator for the trade-in coupon value.
// Mirrors the SQL RPC `estimate_trade_in_value` so the user sees a preview
// before submitting. The final authoritative value comes from the server.

export interface HoursTier {
  rule_key: string;
  min_hours: number | null;
  max_hours: number | null;
  multiplier_percent: number;
}

export interface ConditionRule {
  rule_key: string;
  adjust_percent: number;
}

export interface EstimateInput {
  baseValue: number;
  operatingHours: number;
  hasOriginalBox: boolean;
  hasReceipt: boolean;
  hasScratches: boolean;
  hasDefects: boolean;
  hoursTiers: HoursTier[];
  conditionRules: ConditionRule[];
}

export interface EstimateBreakdown {
  base: number;
  multiplier: number; // as percent (100 = 100%)
  adjust: number;    // sum of adjust_percent
  raw: number;
  final: number;    // rounded down to nearest 250 IQD
}

function pickTier(hours: number, tiers: HoursTier[]): HoursTier | null {
  const active = tiers
    .filter((t) => (t.min_hours ?? 0) <= (hours ?? 0))
    .filter((t) => t.max_hours == null || (hours ?? 0) < t.max_hours)
    .sort((a, b) => (b.min_hours ?? 0) - (a.min_hours ?? 0));
  return active[0] ?? null;
}

export function estimateTradeInValue(input: EstimateInput): EstimateBreakdown {
  const tier = pickTier(input.operatingHours ?? 0, input.hoursTiers);
  const multiplier = tier?.multiplier_percent ?? 100;

  const flags: Record<string, boolean> = {
    has_original_box: input.hasOriginalBox,
    has_receipt: input.hasReceipt,
    has_scratches: input.hasScratches,
    has_defects: input.hasDefects,
  };
  const adjust = input.conditionRules
    .filter((r) => flags[r.rule_key])
    .reduce((sum, r) => sum + (r.adjust_percent ?? 0), 0);

  const raw = Math.max(0, input.baseValue * (multiplier / 100) * (1 + adjust / 100));
  const final = Math.floor(raw / 250) * 250;

  return { base: input.baseValue, multiplier, adjust, raw, final };
}
