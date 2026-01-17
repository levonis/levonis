import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Star, TrendingUp, Gift, ArrowLeft, Check } from "lucide-react";
import { SubTabId } from "./RewardsSubTabs";
import { LevelCardSkeleton } from "./SkeletonLoaders";

interface CardsSectionProps {
  activeSubTab: SubTabId;
}

export default function CardsSection({ activeSubTab }: CardsSectionProps) {
  const navigate = useNavigate();
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
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">سجّل الدخول لعرض بطاقتك</p>
              <Button className="mt-4" onClick={() => navigate('/auth')}>
                تسجيل الدخول
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Upgrade sub-tab
  if (activeSubTab === 'upgrade') {
    const isLoading = loadingPoints || loadingAllLevels;
    const nextLevel = allLevels?.find(l => l.min_points > (userPoints?.total_points || 0));
    const pointsNeeded = nextLevel ? nextLevel.min_points - (userPoints?.total_points || 0) : 0;

    if (isLoading) {
      return (
        <div className="space-y-4">
          <LevelCardSkeleton />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {nextLevel ? (
          <>
            <Card className="border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <p className="font-medium">المستوى التالي</p>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold" style={{ color: nextLevel.color }}>
                    {nextLevel.name_ar}
                  </span>
                  <Badge variant="outline">
                    يتبقى {pointsNeeded.toLocaleString()} نقطة
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  اجمع {nextLevel.min_points.toLocaleString()} نقطة للترقية
                </p>
              </CardContent>
            </Card>

            <Button 
              className="w-full" 
              onClick={() => navigate('/my-points?tab=levels')}
            >
              عرض جميع المستويات
              <ArrowLeft className="h-4 w-4 mr-1" />
            </Button>
          </>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <Star className="h-12 w-12 mx-auto text-amber-500 mb-3" />
              <p className="font-medium">أنت في أعلى مستوى!</p>
              <p className="text-sm text-muted-foreground">تمتع بجميع المزايا الحصرية</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Exclusive Offers sub-tab
  if (activeSubTab === 'exclusive-offers') {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 text-center">
            <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium mb-2">العروض الحصرية</p>
            <p className="text-sm text-muted-foreground mb-4">
              عروض خاصة لحاملي البطاقات المميزة
            </p>
            <Button variant="outline" onClick={() => navigate('/my-points')}>
              استكشف العروض
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
