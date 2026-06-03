import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/components/ui/use-toast';

export interface InsurancePlan {
  id: string;
  name_ar: string;
  name_en: string | null;
  name_ku: string | null;
  coverage_months: number;
  price_percentage: number;
  eligible_category_ids: string[] | null;
  min_price_iqd: number | null;
  max_price_iqd: number | null;
  info_description_ar: string | null;
  info_description_en: string | null;
  info_description_ku: string | null;
  requires_active_card: boolean;
  is_active: boolean;
}

export interface CartInsuranceAddon {
  id: string;
  user_id: string;
  cart_item_id: string;
  plan_id: string;
  printer_product_id: string | null;
  coverage_months: number;
  price_iqd: number;
}

export function computeInsurancePrice(plan: Pick<InsurancePlan, 'price_percentage' | 'min_price_iqd' | 'max_price_iqd'>, printerPriceIqd: number): number {
  const raw = Math.round((printerPriceIqd * (plan.price_percentage || 0)) / 100);
  const min = plan.min_price_iqd != null ? Number(plan.min_price_iqd) : 0;
  const max = plan.max_price_iqd != null ? Number(plan.max_price_iqd) : Infinity;
  const clamped = Math.min(Math.max(raw, min), max);
  // Round to nearest 250 IQD as per project standard
  return Math.round(clamped / 250) * 250;
}

export function useInsurancePlans(categoryId?: string | null) {
  return useQuery({
    queryKey: ['insurance-plans-addon', categoryId || 'all'],
    queryFn: async (): Promise<InsurancePlan[]> => {
      const { data, error } = await supabase
        .from('protection_plans' as any)
        .select('id, name_ar, name_en, name_ku, coverage_months, price_percentage, eligible_category_ids, min_price_iqd, max_price_iqd, info_description_ar, info_description_en, info_description_ku, requires_active_card, is_active')
        .eq('is_addon_insurance', true)
        .eq('is_active', true)
        .order('coverage_months', { ascending: true });
      if (error) throw error;
      const all = (data as any[]) as InsurancePlan[];
      if (!categoryId) return all;
      return all.filter(p => !p.eligible_category_ids || p.eligible_category_ids.length === 0 || p.eligible_category_ids.includes(categoryId));
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useCartInsuranceAddons() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: addons = [] } = useQuery({
    queryKey: ['cart-insurance-addons', user?.id],
    queryFn: async (): Promise<CartInsuranceAddon[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('cart_insurance_addons' as any)
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const addMutation = useMutation({
    mutationFn: async (payload: { cartItemId: string; planId: string; printerProductId: string; coverageMonths: number; priceIqd: number; }) => {
      if (!user) throw new Error('not authenticated');
      const { error } = await supabase.from('cart_insurance_addons' as any).upsert({
        user_id: user.id,
        cart_item_id: payload.cartItemId,
        plan_id: payload.planId,
        printer_product_id: payload.printerProductId,
        coverage_months: payload.coverageMonths,
        price_iqd: payload.priceIqd,
      }, { onConflict: 'cart_item_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart-insurance-addons', user?.id] });
      toast({ title: 'تمت إضافة التأمين' });
    },
    onError: (e: any) => toast({ title: 'تعذّر إضافة التأمين', description: e?.message, variant: 'destructive' as any }),
  });

  const removeMutation = useMutation({
    mutationFn: async (cartItemId: string) => {
      if (!user) throw new Error('not authenticated');
      const { error } = await supabase.from('cart_insurance_addons' as any).delete().eq('cart_item_id', cartItemId).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart-insurance-addons', user?.id] });
      toast({ title: 'تمت إزالة التأمين' });
    },
  });

  // Index by cart_item_id for quick lookup
  const byCartItemId = new Map<string, CartInsuranceAddon>();
  for (const a of addons) byCartItemId.set(a.cart_item_id, a);

  return {
    addons,
    byCartItemId,
    addInsurance: addMutation.mutate,
    removeInsurance: removeMutation.mutate,
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}

/**
 * Calculates the total insurance amount for the cart based on addons and per-item quantities.
 */
export function calcInsuranceTotal(addons: CartInsuranceAddon[], itemQuantities: Map<string, number>): number {
  let total = 0;
  for (const a of addons) {
    const qty = itemQuantities.get(a.cart_item_id) ?? 0;
    if (qty <= 0) continue;
    total += a.price_iqd * qty;
  }
  return total;
}
