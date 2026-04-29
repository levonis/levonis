import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { CartItem } from "./useCart";
import { useActiveSubscriptionBenefits } from "./useCartSubscriptionBenefits";

export type WarrantyBenefitsSource = "warranty" | "subscription";

export interface WarrantyBenefitsResult {
  // Identity
  source: WarrantyBenefitsSource;
  /** When source === 'subscription' */
  subscriptionId?: string | null;
  /** When source === 'subscription' */
  planNameAr?: string | null;
  userPrinterId: string;
  productId: string | null;
  modelNameAr: string | null;
  // Period
  periodStart: string | null;
  periodEnd: string | null;
  activationDay: number;
  // Percentage discount with monthly cap
  percentageRate: number;
  percentageMaxAmountMonthly: number;
  percentageUsedSoFar: number;
  percentageRemaining: number;
  percentageDiscount: number; // computed for current cart
  // Free shipping with monthly count
  freeShipping: boolean;
  freeShippingMinOrder: number;
  freeShippingMethods: string[];
  freeShippingMaxUsesMonthly: number;
  freeShippingUsedSoFar: number;
  freeShippingRemainingUses: number;
  // Category whitelists (empty/null = applies to all)
  discountApplicableCategoryIds: string[];
  freeShippingApplicableCategoryIds: string[];
  // Aggregate
  totalDiscount: number;
  hasDiscount: boolean;
}

interface ActiveWarrantyRow {
  user_printer_id: string;
  store_printer_id: string;
  product_id: string | null;
  model_name_ar: string | null;
  serial_number: string | null;
  activation_date: string | null;
  expiry_date: string | null;
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

export function useActiveWarrantyBenefits() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["active-warranty-benefits", user?.id],
    queryFn: async (): Promise<ActiveWarrantyRow[]> => {
      if (!user) return [];
      const { data, error } = await (supabase as any).rpc(
        "get_active_warranty_benefits_for_user",
        { p_user_id: user.id }
      );
      if (error) throw error;
      return (data || []) as ActiveWarrantyRow[];
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}

function computeDiscount(
  rate: number,
  remaining: number,
  discountCats: string[],
  items: CartItem[],
  getItemPrice: (item: CartItem) => number,
  cartSubtotal: number
): number {
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
  if (rate > 0 && remaining > 0 && eligibleSubtotal > 0) {
    return Math.min(Math.floor((eligibleSubtotal * rate) / 100), remaining);
  }
  return 0;
}

export function useCartWarrantyBenefits(
  items: CartItem[],
  getItemPrice: (item: CartItem) => number,
  cartSubtotal: number
): { warrantyBenefits: WarrantyBenefitsResult | null; isLoading: boolean } {
  const { data: warranties, isLoading: loadingW } = useActiveWarrantyBenefits();
  const { data: subscriptions, isLoading: loadingS } = useActiveSubscriptionBenefits();

  if (loadingW || loadingS) return { warrantyBenefits: null, isLoading: true };

  const candidates: WarrantyBenefitsResult[] = [];

  // 1) Warranty (purchase warranty) candidates
  for (const w of (warranties || []).filter((x) => x.is_benefits_active)) {
    const rate = Number(w.discount_percentage) || 0;
    const cap = Number(w.discount_max_amount_monthly) || 0;
    const used = Number(w.discount_used) || 0;
    const remaining = Math.max(0, cap - used);

    const discountCats = Array.isArray(w.discount_applicable_category_ids)
      ? (w.discount_applicable_category_ids as string[]).filter(Boolean)
      : [];
    const shippingCats = Array.isArray(w.free_shipping_applicable_category_ids)
      ? (w.free_shipping_applicable_category_ids as string[]).filter(Boolean)
      : [];

    const percentageDiscount = computeDiscount(rate, remaining, discountCats, items, getItemPrice, cartSubtotal);

    candidates.push({
      source: "warranty",
      userPrinterId: w.user_printer_id,
      productId: w.product_id,
      modelNameAr: w.model_name_ar,
      periodStart: w.period_start,
      periodEnd: w.period_end,
      activationDay: w.activation_date ? new Date(w.activation_date).getDate() : 1,
      percentageRate: rate,
      percentageMaxAmountMonthly: cap,
      percentageUsedSoFar: used,
      percentageRemaining: remaining,
      percentageDiscount,
      freeShipping: Number(w.free_shipping_max_uses_monthly) > 0,
      freeShippingMinOrder: Number(w.free_shipping_min_order) || 0,
      freeShippingMethods: Array.isArray(w.free_shipping_methods)
        ? (w.free_shipping_methods as any[]).filter((m) => typeof m === "string")
        : ["standard"],
      freeShippingMaxUsesMonthly: Number(w.free_shipping_max_uses_monthly) || 0,
      freeShippingUsedSoFar: Number(w.free_shipping_used) || 0,
      freeShippingRemainingUses: Math.max(
        0,
        (Number(w.free_shipping_max_uses_monthly) || 0) - (Number(w.free_shipping_used) || 0)
      ),
      discountApplicableCategoryIds: discountCats,
      freeShippingApplicableCategoryIds: shippingCats,
      totalDiscount: percentageDiscount,
      hasDiscount: percentageDiscount > 0,
    });
  }

  // 2) Subscription (paid plan) candidates — same shape, exposed as warranty-like
  for (const s of (subscriptions || []).filter((x) => x.is_benefits_active)) {
    const rate = Number(s.discount_percentage) || 0;
    const cap = Number(s.discount_max_amount_monthly) || 0;
    const used = Number(s.discount_used) || 0;
    const remaining = Math.max(0, cap - used);

    const discountCats = Array.isArray(s.discount_applicable_category_ids)
      ? (s.discount_applicable_category_ids as string[]).filter(Boolean)
      : [];
    const shippingCats = Array.isArray(s.free_shipping_applicable_category_ids)
      ? (s.free_shipping_applicable_category_ids as string[]).filter(Boolean)
      : [];

    const percentageDiscount = computeDiscount(rate, remaining, discountCats, items, getItemPrice, cartSubtotal);

    candidates.push({
      source: "subscription",
      subscriptionId: s.subscription_id,
      planNameAr: s.plan_name_ar,
      userPrinterId: s.user_printer_id,
      productId: s.product_id,
      modelNameAr: s.model_name_ar,
      periodStart: s.period_start,
      periodEnd: s.period_end,
      activationDay: s.start_date ? new Date(s.start_date).getDate() : 1,
      percentageRate: rate,
      percentageMaxAmountMonthly: cap,
      percentageUsedSoFar: used,
      percentageRemaining: remaining,
      percentageDiscount,
      freeShipping: Number(s.free_shipping_max_uses_monthly) > 0,
      freeShippingMinOrder: Number(s.free_shipping_min_order) || 0,
      freeShippingMethods: Array.isArray(s.free_shipping_methods)
        ? (s.free_shipping_methods as any[]).filter((m) => typeof m === "string")
        : ["standard"],
      freeShippingMaxUsesMonthly: Number(s.free_shipping_max_uses_monthly) || 0,
      freeShippingUsedSoFar: Number(s.free_shipping_used) || 0,
      freeShippingRemainingUses: Math.max(
        0,
        (Number(s.free_shipping_max_uses_monthly) || 0) - (Number(s.free_shipping_used) || 0)
      ),
      discountApplicableCategoryIds: discountCats,
      freeShippingApplicableCategoryIds: shippingCats,
      totalDiscount: percentageDiscount,
      hasDiscount: percentageDiscount > 0,
    });
  }

  if (candidates.length === 0) return { warrantyBenefits: null, isLoading: false };

  // Best-of: pick by totalDiscount, tiebreak by free-shipping availability
  let best: WarrantyBenefitsResult | null = null;
  for (const c of candidates) {
    if (!best) { best = c; continue; }
    if (c.totalDiscount > best.totalDiscount) { best = c; continue; }
    if (c.totalDiscount === best.totalDiscount && c.freeShippingRemainingUses > best.freeShippingRemainingUses) {
      best = c;
    }
  }

  return { warrantyBenefits: best, isLoading: false };
}

