import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Coins, History, TrendingUp, Wallet, Ticket } from "lucide-react";
import { SubTabId } from "./RewardsSubTabs";
import { PointsBalanceSkeleton, LevelCardSkeleton } from "./SkeletonLoaders";
import PointsHistoryPanel from "./panels/PointsHistoryPanel";
import DailyTasksPanel from "./panels/DailyTasksPanel";
import RedeemPointsPanel from "./panels/RedeemPointsPanel";

interface PointsSectionProps {
  activeSubTab: SubTabId;
}

export default function PointsSection({ activeSubTab }: PointsSectionProps) {
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
    staleTime: 5 * 60 * 1000,
  });

  const { data: userWallet } = useQuery({
    queryKey: ['user-wallet-summary', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user && activeSubTab === 'summary',
    staleTime: 5 * 60 * 1000,
  });

  const { data: userCoupons } = useQuery({
    queryKey: ['user-coupons-summary', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_coupons')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_used', false)
        .gte('expires_at', new Date().toISOString());
      if (error && error.code !== 'PGRST116') throw error;
      return data || [];
    },
    enabled: !!user && activeSubTab === 'summary',
    staleTime: 5 * 60 * 1000,
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

  const { data: userCard } = useQuery({
    queryKey: ['user-active-card', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_cards')
        .select('*, loyalty_levels(*)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString())
        .order('purchased_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user && activeSubTab === 'summary',
    staleTime: 5 * 60 * 1000,
  });

  // Summary sub-tab
  if (activeSubTab === 'summary') {
    return (
      <div className="space-y-4">
        {/* Points & Wallet Balance Cards */}
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
            
            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">رصيد المحفظة</span>
                </div>
                <p className="text-2xl font-bold">{(userWallet?.balance || 0).toLocaleString()} <span className="text-sm font-normal">د.ع</span></p>
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
                    {userCard?.expires_at && (
                      <p className="text-[10px] text-muted-foreground">
                        متبقي {Math.ceil((new Date(userCard.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} يوم
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Coupons */}
        {userCoupons && userCoupons.length > 0 && (
          <Card className="border-purple-500/20 bg-purple-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Ticket className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">كوبوناتك ({userCoupons.length})</span>
              </div>
              <div className="space-y-2">
                {userCoupons.slice(0, 3).map((coupon: any) => (
                  <div key={coupon.id} className="flex items-center justify-between text-sm bg-background/50 rounded-lg p-2">
                    <code className="text-xs font-mono">{coupon.coupon_code}</code>
                    <span className="text-primary font-bold">{coupon.discount_value.toLocaleString()} د.ع</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Points History Inline */}
        <div className="mt-4">
          <p className="text-sm font-medium mb-3">آخر المعاملات</p>
          <PointsHistoryPanel />
        </div>
      </div>
    );
  }

  // Daily Tasks sub-tab
  if (activeSubTab === 'daily-tasks') {
    return <DailyTasksPanel />;
  }

  // Redeem sub-tab
  if (activeSubTab === 'redeem') {
    return <RedeemPointsPanel />;
  }

  return null;
}
