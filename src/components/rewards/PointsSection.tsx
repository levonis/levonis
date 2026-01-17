import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, History, ArrowLeft, TrendingUp, Gift } from "lucide-react";
import { SubTabId } from "./RewardsSubTabs";
import { PointsBalanceSkeleton, LevelCardSkeleton } from "./SkeletonLoaders";

interface PointsSectionProps {
  activeSubTab: SubTabId;
}

export default function PointsSection({ activeSubTab }: PointsSectionProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Only fetch when summary tab is active
  const { data: userPoints, isLoading: loadingPoints } = useQuery({
    queryKey: ['user-points-full', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user && activeSubTab === 'summary',
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const { data: loyaltyLevel, isLoading: loadingLevel } = useQuery({
    queryKey: ['user-loyalty-level-full', userPoints?.total_points],
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
    enabled: !!user && activeSubTab === 'summary' && userPoints !== undefined,
    staleTime: 5 * 60 * 1000,
  });

  // Summary sub-tab
  if (activeSubTab === 'summary') {
    const isLoading = loadingPoints || (userPoints && loadingLevel);
    
    return (
      <div className="space-y-4">
        {/* Points Balance Cards */}
        {loadingPoints ? (
          <PointsBalanceSkeleton />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="h-4 w-4 text-amber-500" />
                  <span className="text-xs text-muted-foreground">النقاط المتاحة</span>
                </div>
                <p className="text-2xl font-bold">{(userPoints?.available_points || 0).toLocaleString()}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">إجمالي النقاط</span>
                </div>
                <p className="text-2xl font-bold">{(userPoints?.total_points || 0).toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Current Level */}
        {loadingLevel ? (
          <LevelCardSkeleton />
        ) : loyaltyLevel && (
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: loyaltyLevel.color + '20' }}
                  >
                    <TrendingUp className="h-5 w-5" style={{ color: loyaltyLevel.color }} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">مستواك الحالي</p>
                    <p className="font-bold" style={{ color: loyaltyLevel.color }}>
                      {loyaltyLevel.name_ar}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/my-points')}>
                  تفاصيل
                  <ArrowLeft className="h-4 w-4 mr-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            className="h-auto py-3 flex-col gap-1"
            onClick={() => navigate('/my-points?tab=history')}
          >
            <History className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs">سجل النقاط</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-3 flex-col gap-1"
            onClick={() => navigate('/my-points?tab=earn')}
          >
            <Gift className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs">طرق الربح</span>
          </Button>
        </div>
      </div>
    );
  }

  // Daily Tasks sub-tab
  if (activeSubTab === 'daily-tasks') {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground mb-4">أكمل المهام اليومية لربح نقاط إضافية</p>
            <Button onClick={() => navigate('/my-points?tab=tasks')}>
              عرض المهام
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Redeem sub-tab
  if (activeSubTab === 'redeem') {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <p className="font-medium mb-2">استبدال النقاط</p>
            <p className="text-sm text-muted-foreground mb-4">حوّل نقاطك إلى كوبونات أو رصيد في المحفظة</p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1"
                onClick={() => navigate('/my-points?tab=redeem')}
              >
                كوبون
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1"
                onClick={() => navigate('/my-points?tab=convert')}
              >
                محفظة
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
