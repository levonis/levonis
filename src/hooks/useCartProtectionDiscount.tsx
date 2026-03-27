import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { CartItem } from './useCart';

export interface CartProtectionDiscount {
  planId: string;
  planNameAr: string;
  subscriptionId: string;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  limitType: 'weekly' | 'monthly';
  limitCount: number;
  usedCount: number;
  canUse: boolean;
  eligibleItemIds: string[]; // cart item IDs that qualify
  totalDiscount: number; // total discount amount for eligible items
}

export const useCartProtectionDiscount = (items: CartItem[], getItemPrice: (item: CartItem) => number) => {
  const { user } = useAuth();

  const categoryIds = [...new Set(items
    .filter(i => i.products?.category_id)
    .map(i => i.products!.category_id!)
  )];

  const { data: cartDiscount, isLoading } = useQuery({
    queryKey: ['cart-protection-discount', user?.id, categoryIds.join(','), items.map(i => `${i.id}:${i.quantity}`).join(',')],
    queryFn: async (): Promise<CartProtectionDiscount | null> => {
      if (!user || categoryIds.length === 0) return null;

      // Get active subscriptions with plan details
      const { data: subscriptions } = await supabase
        .from('printer_subscriptions' as any)
        .select('id, plan_id, protection_plans(id, name_ar, parts_discount_categories, parts_discount_type, parts_discount_value, parts_discount_limit_type, parts_discount_limit_count)')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (!subscriptions || subscriptions.length === 0) return null;

      for (const sub of subscriptions as any[]) {
        const plan = sub.protection_plans;
        if (!plan || !plan.parts_discount_value || plan.parts_discount_value <= 0) continue;

        const planCategories: string[] = plan.parts_discount_categories || [];
        if (planCategories.length === 0) continue;

        // Find eligible cart items
        const eligibleItems = items.filter(item =>
          item.products?.category_id && planCategories.includes(item.products.category_id)
        );
        if (eligibleItems.length === 0) continue;

        // Check usage limits
        const limitType = plan.parts_discount_limit_type || 'monthly';
        const limitCount = plan.parts_discount_limit_count || 1;

        const now = new Date();
        let periodStart: Date;
        if (limitType === 'weekly') {
          const dayOfWeek = now.getDay();
          periodStart = new Date(now);
          periodStart.setDate(now.getDate() - dayOfWeek);
          periodStart.setHours(0, 0, 0, 0);
        } else {
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const { count } = await supabase
          .from('plan_discount_usage' as any)
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('subscription_id', sub.id)
          .gte('used_at', periodStart.toISOString());

        const usedCount = count || 0;
        const canUse = usedCount < limitCount;

        if (!canUse) continue;

        // Calculate total discount for eligible items
        let totalDiscount = 0;
        for (const item of eligibleItems) {
          const itemPrice = getItemPrice(item);
          if (plan.parts_discount_type === 'percentage') {
            totalDiscount += Math.round(itemPrice * item.quantity * (plan.parts_discount_value / 100));
          } else {
            totalDiscount += Math.min(plan.parts_discount_value, itemPrice) * item.quantity;
          }
        }

        return {
          planId: plan.id,
          planNameAr: plan.name_ar,
          subscriptionId: sub.id,
          discountType: plan.parts_discount_type || 'fixed',
          discountValue: plan.parts_discount_value,
          limitType,
          limitCount,
          usedCount,
          canUse,
          eligibleItemIds: eligibleItems.map(i => i.id),
          totalDiscount,
        };
      }

      return null;
    },
    enabled: !!user && items.length > 0 && categoryIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  return { cartDiscount, isLoading };
};
