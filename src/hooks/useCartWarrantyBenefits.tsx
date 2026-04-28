import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { CartItem } from "./useCart";

export interface WarrantyBenefitsResult {
  // Identity
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

export function useCartWarrantyBenefits(
  items: CartItem[],
  getItemPrice: (item: CartItem) => number,
  cartSubtotal: number
): { warrantyBenefits: WarrantyBenefitsResult | null; isLoading: boolean } {
  const { data: warranties, isLoading } = useActiveWarrantyBenefits();

  if (isLoading) return { warrantyBenefits: null, isLoading: true };
  if (!warranties || warranties.length === 0) return { warrantyBenefits: null, isLoading: false };

  let best: WarrantyBenefitsResult | null = null;

  const candidates = warranties.filter((w) => w.is_benefits_active);
  for (const w of candidates) {
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

    // Eligible subtotal: if whitelist is empty, use full cart; otherwise sum only eligible items
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

    const result: WarrantyBenefitsResult = {
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
    };

    if (!best || result.totalDiscount > best.totalDiscount) {
      best = result;
    }
  }

  return { warrantyBenefits: best, isLoading: false };
}
