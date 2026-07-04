---
name: Subscription Duration Tiers
description: 1/3/6/12 month subscription options with admin-controlled discounts for Levo cards and protection plans
type: feature
---
Table `subscription_duration_tiers` (target_type='card'|'protection_plan', duration_months, discount_percentage, is_active) drives 4 durations. Seed defaults: 1m=0%, 3m=5%, 6m=10%, 12m=20%.

Frontend:
- `computeDurationQuote(baseMonthly, tier)` in `src/lib/subscriptionPricing.ts` — floor to nearest 250 IQD.
- `SubscriptionDurationDialog` reusable, `requirePrinter` for protection plans.
- Admin at `${ADMIN_BASE_PATH}/subscription-tiers` — edit discount % + is_active with Verify-and-Rollback.

Backend RPCs:
- `levo_subscribe_card(..., p_duration_months, p_discount_percentage)` — multiplies expires_at by months.
- `subscribe_protection_plan(p_plan_id, p_user_printer_id, p_duration_months, p_expected_total, p_discount_percentage)` — locks wallet, verifies price ± 250, creates `printer_subscriptions` with end_date = start + months.

Both subscription tables now carry `duration_months`, `discount_percentage_applied` (+ `total_paid` on printer_subscriptions).
