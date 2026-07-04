// Shared pricing helper for tiered subscription durations (Levo cards & protection plans).
// Rounding follows the project standard: floor to nearest 250 IQD.

export interface DurationTier {
  duration_months: number;
  discount_percentage: number;
}

export interface DurationQuote {
  duration_months: number;
  discount_percentage: number;
  base_monthly: number;
  gross: number;      // base_monthly * months (before discount)
  discount: number;   // gross - final
  final: number;      // amount user pays (rounded)
  savings: number;    // == discount
  per_month_effective: number;
}

const ROUND_STEP = 250;

export function computeDurationQuote(baseMonthly: number, tier: DurationTier): DurationQuote {
  const months = Math.max(1, tier.duration_months || 1);
  const disc = Math.max(0, Math.min(90, tier.discount_percentage || 0));
  const base = Math.max(0, Number(baseMonthly) || 0);
  const gross = base * months;
  const rawFinal = (gross * (100 - disc)) / 100;
  const final = Math.max(0, Math.floor(rawFinal / ROUND_STEP) * ROUND_STEP);
  const discount = gross - final;
  return {
    duration_months: months,
    discount_percentage: disc,
    base_monthly: base,
    gross,
    discount,
    final,
    savings: discount,
    per_month_effective: months > 0 ? Math.round(final / months) : final,
  };
}
