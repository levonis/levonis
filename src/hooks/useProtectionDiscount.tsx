import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ProtectionDiscount {
  planId: string;
  planNameAr: string;
  subscriptionId: string;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  limitType: 'weekly' | 'monthly';
  limitCount: number;
  usedCount: number;
  canUse: boolean;
  categoryIds: string[];
}

export const useProtectionDiscount = (categoryId?: string | null) => {
  const { user } = useAuth();

  const { data: discount, isLoading } = useQuery({
    queryKey: ['protection-discount', user?.id, categoryId],
    queryFn: async (): Promise<ProtectionDiscount | null> => {
      if (!user || !categoryId) return null;

      // 1. Get user's active subscriptions with plan details
      const { data: subscriptions } = await supabase
        .from('printer_subscriptions' as any)
        .select('id, plan_id, protection_plans(id, name_ar, parts_discount_categories, parts_discount_type, parts_discount_value, parts_discount_limit_type, parts_discount_limit_count)')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (!subscriptions || subscriptions.length === 0) return null;

      // 2. Find a plan that covers this category
      for (const sub of subscriptions as any[]) {
        const plan = sub.protection_plans;
        if (!plan) continue;
        
        const categories: string[] = plan.parts_discount_categories || [];
        if (!categories.includes(categoryId)) continue;
        if (!plan.parts_discount_value || plan.parts_discount_value <= 0) continue;

        // 3. Check usage limits
        const limitType = plan.parts_discount_limit_type || 'monthly';
        const limitCount = plan.parts_discount_limit_count || 1;

        // Calculate the start of the current period
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
          categoryIds: categories,
        };
      }

      return null;
    },
    enabled: !!user && !!categoryId,
    staleTime: 2 * 60 * 1000,
  });

  return { discount, isLoading };
};

// Helper to calculate the discounted price
export const calculateProtectionDiscountedPrice = (
  originalPrice: number,
  discount: ProtectionDiscount | null | undefined
): number => {
  if (!discount || !discount.canUse) return originalPrice;
  
  if (discount.discountType === 'percentage') {
    return Math.round(originalPrice * (1 - discount.discountValue / 100));
  }
  return Math.max(0, originalPrice - discount.discountValue);
};
