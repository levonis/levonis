import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Star, TrendingUp, Gift, Check } from "lucide-react";
import { SubTabId } from "./RewardsSubTabs";
import { LevelCardSkeleton } from "./SkeletonLoaders";
import LoyaltyLevelsPanel from "./panels/LoyaltyLevelsPanel";

interface CardsSectionProps {
  activeSubTab: SubTabId;
}

export default function CardsSection({ activeSubTab }: CardsSectionProps) {
  const { user } = useAuth();

  // Only fetch when benefits or upgrade tab is active
  const shouldFetchUserData = activeSubTab === 'benefits' || activeSubTab === 'upgrade';

  const { data: userPoints, isLoading: loadingPoints } = useQuery({
    queryKey: ['user-points-cards', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_points')
        .select('total_points, level')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user && shouldFetchUserData,
    staleTime: 5 * 60 * 1000,
  });

  const { data: currentLevel, isLoading: loadingLevel } = useQuery({
    queryKey: ['current-loyalty-level', userPoints?.total_points],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_levels')
        .select('*')
        .lte('min_points', userPoints?.total_points || 0)
        .order('min_points', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && shouldFetchUserData && userPoints !== undefined,
    staleTime: 5 * 60 * 1000,
  });

  // Only fetch when upgrade tab is active
  const { data: allLevels, isLoading: loadingAllLevels } = useQuery({
    queryKey: ['all-loyalty-levels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_levels')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: activeSubTab === 'upgrade',
    staleTime: 5 * 60 * 1000,
  });

  // Benefits sub-tab
  if (activeSubTab === 'benefits') {
    const isLoading = loadingPoints || (userPoints && loadingLevel);

    return (
      <div className="space-y-4">
        {/* Current Card */}
        {isLoading ? (
          <LevelCardSkeleton />
        ) : currentLevel ? (
          <Card 
            className="overflow-hidden"
            style={{ 
              background: `linear-gradient(135deg, ${currentLevel.color}15, ${currentLevel.color}05)`,
              borderColor: currentLevel.color + '40'
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: currentLevel.color + '25' }}
                >
                  <CreditCard className="h-6 w-6" style={{ color: currentLevel.color }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">بطاقتك الحالية</p>
                  <p className="text-lg font-bold" style={{ color: currentLevel.color }}>
                    {currentLevel.name_ar}
                  </p>
                </div>
              </div>

              {/* Benefits */}
              <div className="space-y-2">
                {currentLevel.discount_percentage && currentLevel.discount_percentage > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>خصم {currentLevel.discount_percentage}% على المشتريات</span>
                  </div>
                )}
                {currentLevel.bonus_points_percentage && currentLevel.bonus_points_percentage > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>نقاط إضافية {currentLevel.bonus_points_percentage}%</span>
                  </div>
                )}
                {currentLevel.free_shipping && (
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>شحن مجاني</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : !user ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">سجّل الدخول لعرض بطاقتك</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  // Upgrade sub-tab - Show all levels inline
  if (activeSubTab === 'upgrade') {
    return <LoyaltyLevelsPanel />;
  }

  // Exclusive Offers sub-tab
  if (activeSubTab === 'exclusive-offers') {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 text-center">
            <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium mb-2">العروض الحصرية</p>
            <p className="text-sm text-muted-foreground">
              عروض خاصة لحاملي البطاقات المميزة - قريباً
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
