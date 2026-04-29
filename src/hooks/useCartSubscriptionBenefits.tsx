import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { CartItem } from "./useCart";

/**
 * Mirrors useCartWarrantyBenefits but pulls data from the user's ACTIVE
 * paid printer subscriptions (protection_plans). Each subscription carries
 * its own discount + free shipping benefit settings, scoped to the printer
 * it covers.
 *
 * Identical shape to WarrantyBenefitsResult so callers can merge / pick best.
 */
export interface SubscriptionBenefitsResult {
  // Identity
  source: "subscription";
  subscriptionId: string;
  userPrinterId: string;
  productId: string | null;
  modelNameAr: string | null;
  planId: string;
  planNameAr: string;
  planBadgeText: string | null;
  // Period (calendar month)
  periodStart: string | null;
  periodEnd: string | null;
  // Percentage discount with monthly cap
  percentageRate: number;
  percentageMaxAmountMonthly: number;
  percentageUsedSoFar: number;
  percentageRemaining: number;
  percentageDiscount: number;
  // Free shipping with monthly count
  freeShipping: boolean;
  freeShippingMinOrder: number;
  freeShippingMethods: string[];
  freeShippingMaxUsesMonthly: number;
  freeShippingUsedSoFar: number;
  freeShippingRemainingUses: number;
  // Category whitelists
  discountApplicableCategoryIds: string[];
  freeShippingApplicableCategoryIds: string[];
  // Aggregate
  totalDiscount: number;
  hasDiscount: boolean;
}

interface ActiveSubscriptionRow {
  subscription_id: string;
  user_printer_id: string;
  store_printer_id: string;
  product_id: string | null;
  model_name_ar: string | null;
  serial_number: string | null;
  plan_id: string;
  plan_name_ar: string;
  plan_badge_text: string | null;
  start_date: string;
  end_date: string | null;
  is_benefits_active: boolean;
  discount_percentage: number;
  discount_max_amount_monthly: number;
  free_shipping_max_uses_monthly: number;
  free_shipping_min_order: number;
  free_shipping_methods: string[];
  period_start: string | null;
  period_end: string | null;
  discount_used: number;
  free_shipping_used: number;
  discount_applicable_category_ids: string[] | null;
  free_shipping_applicable_category_ids: string[] | null;
}

export function useActiveSubscriptionBenefits() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["active-subscription-benefits", user?.id],
    queryFn: async (): Promise<ActiveSubscriptionRow[]> => {
      if (!user) return [];
      const { data, error } = await (supabase as any).rpc(
        "get_active_subscription_benefits_for_user",
        { p_user_id: user.id }
      );
      if (error) throw error;
      return (data || []) as ActiveSubscriptionRow[];
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}

export function useCartSubscriptionBenefits(
  items: CartItem[],
  getItemPrice: (item: CartItem) => number,
  cartSubtotal: number
): { subscriptionBenefits: SubscriptionBenefitsResult | null; allSubscriptionBenefits: SubscriptionBenefitsResult[]; isLoading: boolean } {
  const { data: rows, isLoading } = useActiveSubscriptionBenefits();

  if (isLoading) return { subscriptionBenefits: null, allSubscriptionBenefits: [], isLoading: true };
  if (!rows || rows.length === 0) return { subscriptionBenefits: null, allSubscriptionBenefits: [], isLoading: false };

  const candidates = rows.filter((r) => r.is_benefits_active);
  const computed: SubscriptionBenefitsResult[] = [];

  for (const r of candidates) {
    const rate = Number(r.discount_percentage) || 0;
    const cap = Number(r.discount_max_amount_monthly) || 0;
    const used = Number(r.discount_used) || 0;
    const remaining = Math.max(0, cap - used);

    const discountCats = Array.isArray(r.discount_applicable_category_ids)
      ? (r.discount_applicable_category_ids as string[]).filter(Boolean)
      : [];
    const shippingCats = Array.isArray(r.free_shipping_applicable_category_ids)
      ? (r.free_shipping_applicable_category_ids as string[]).filter(Boolean)
      : [];

    // Eligible subtotal for percentage discount
    let eligibleSubtotal = cartSubtotal;
    if (discountCats.length > 0) {
      eligibleSubtotal = 0;
      for (const item of items) {
        if ((item as any).is_gift) continue;
        const catId = (item.products as any)?.category_id;
        if (catId && discountCats.includes(catId)) {
          eligibleSubtotal += getItemPrice(item) * item.quantity;
        }
      }
    }

    let percentageDiscount = 0;
    if (rate > 0 && remaining > 0 && eligibleSubtotal > 0) {
      const raw = Math.floor((eligibleSubtotal * rate) / 100);
      percentageDiscount = Math.min(raw, remaining);
    }

    computed.push({
      source: "subscription",
      subscriptionId: r.subscription_id,
      userPrinterId: r.user_printer_id,
      productId: r.product_id,
      modelNameAr: r.model_name_ar,
      planId: r.plan_id,
      planNameAr: r.plan_name_ar,
      planBadgeText: r.plan_badge_text,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      percentageRate: rate,
      percentageMaxAmountMonthly: cap,
      percentageUsedSoFar: used,
      percentageRemaining: remaining,
      percentageDiscount,
      freeShipping: Number(r.free_shipping_max_uses_monthly) > 0,
      freeShippingMinOrder: Number(r.free_shipping_min_order) || 0,
      freeShippingMethods: Array.isArray(r.free_shipping_methods)
        ? (r.free_shipping_methods as any[]).filter((m) => typeof m === "string")
        : ["standard"],
      freeShippingMaxUsesMonthly: Number(r.free_shipping_max_uses_monthly) || 0,
      freeShippingUsedSoFar: Number(r.free_shipping_used) || 0,
      freeShippingRemainingUses: Math.max(
        0,
        (Number(r.free_shipping_max_uses_monthly) || 0) - (Number(r.free_shipping_used) || 0)
      ),
      discountApplicableCategoryIds: discountCats,
      freeShippingApplicableCategoryIds: shippingCats,
      totalDiscount: percentageDiscount,
      hasDiscount: percentageDiscount > 0,
    });
  }

  // Best-of by total discount
  const best = computed.reduce<SubscriptionBenefitsResult | null>((acc, cur) => {
    if (!acc) return cur;
    return cur.totalDiscount > acc.totalDiscount ? cur : acc;
  }, null);

  return { subscriptionBenefits: best, allSubscriptionBenefits: computed, isLoading: false };
}
