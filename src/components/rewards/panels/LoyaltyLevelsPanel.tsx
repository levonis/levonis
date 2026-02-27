import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Coins, Star, CheckCircle2, Lock, Zap, CreditCard, Gift, Trophy, ChevronLeft, ShoppingCart } from "lucide-react";
import UserLoyaltyCard from "@/components/UserLoyaltyCard";
import LevelRoadmapModal from "./LevelRoadmapModal";

export default function LoyaltyLevelsPanel() {
  const { user } = useAuth();
  const [showRoadmap, setShowRoadmap] = useState(false);

  const { data: userPointsData } = useQuery({
    queryKey: ['user-points-loyalty', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_points')
        .select('total_points, available_points, total_xp')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const { data: userCard } = useQuery({
    queryKey: ['user-active-card-panel', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_cards')
        .select('*, loyalty_levels:level_id(*)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const { data: userProfile } = useQuery({
    queryKey: ['user-profile-name-panel', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  const { data: levels, isLoading } = useQuery({
    queryKey: ['all-loyalty-levels-panel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_levels')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: levelPrizes } = useQuery({
    queryKey: ['level-prizes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('level_prizes')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    );
  }

  const totalXp = (userPointsData as any)?.total_xp || 0;
  const totalPoints = userPointsData?.total_points || 0;
  const availablePoints = userPointsData?.available_points || 0;
  const userName = userProfile?.full_name || userProfile?.username || '';
  const activeCardLevel = userCard?.loyalty_levels as any;
  const sortedLevels = levels?.slice().sort((a, b) => a.display_order - b.display_order) || [];

  // Current level based on XP
  const currentLevelIndex = sortedLevels.reduce((acc, level, i) => {
    return ((level as any).xp_required || 0) <= totalXp ? i : acc;
  }, 0);

  return (
    <div className="space-y-4">
      {/* XP & Points Overview */}
      <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20 overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">نقاط الخبرة (XP)</p>
              <p className="text-2xl font-bold">{totalXp.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">XP</span></p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Coins className="h-3 w-3" />
              النقاط المتاحة: <strong className="text-foreground">{availablePoints.toLocaleString()}</strong>
            </span>
            <span>المستوى: <strong className="text-foreground">{currentLevelIndex + 1}</strong></span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            كل نقطة تكسبها = 2 XP • البطاقات تُشترى بالنقاط
          </p>
        </CardContent>
      </Card>

      {/* Active Card */}
      {activeCardLevel && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">بطاقتك الحالية</h3>
          <UserLoyaltyCard
            level={{
              id: activeCardLevel.id,
              name_ar: activeCardLevel.name_ar,
              name_en: activeCardLevel.name_en,
              color: activeCardLevel.color,
              discount_percentage: activeCardLevel.discount_percentage,
              bonus_points_percentage: activeCardLevel.bonus_points_percentage,
              free_shipping: activeCardLevel.free_shipping,
              free_shipping_min_order: activeCardLevel.free_shipping_min_order,
              duration_days: activeCardLevel.duration_days,
              vip_support: activeCardLevel.vip_support,
              priority_shipping: activeCardLevel.priority_shipping,
              early_access: activeCardLevel.early_access,
              exclusive_products: activeCardLevel.exclusive_products,
              special_name_style: activeCardLevel.special_name_style,
              profile_effects: activeCardLevel.profile_effects,
              benefits: activeCardLevel.benefits,
            }}
            userName={userName}
            expiresAt={userCard?.expires_at}
            isActive={true}
            showDetails={true}
          />
        </div>
      )}

      {/* View Roadmap Button */}
      <Button
        onClick={() => setShowRoadmap(true)}
        className="w-full gap-2"
        variant="outline"
        size="lg"
      >
        <Trophy className="h-5 w-5 text-amber-500" />
        خريطة المستويات والجوائز
      </Button>

      {/* Purchasable Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">البطاقات المتاحة للشراء</h3>
        <div className="grid gap-3">
          {sortedLevels.filter(l => l.is_purchasable).map((level) => {
            const isOwned = activeCardLevel?.id === level.id;
            const canAfford = availablePoints >= (level.purchase_price_points || 0);
            const prizesForLevel = levelPrizes?.filter(p => p.level_id === level.id) || [];

            return (
              <Card
                key={level.id}
                className={`overflow-hidden transition-all ${
                  isOwned ? 'border-primary/50 bg-primary/5' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: level.color + '20', color: level.color }}
                    >
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm">{level.name_ar}</p>
                        {isOwned && (
                          <Badge className="text-[10px] bg-primary/15 text-primary border-0">مملوكة</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {level.purchase_price_points?.toLocaleString()} نقطة • {level.duration_days} يوم
                      </p>
                    </div>
                    {!isOwned && (
                      <Button
                        size="sm"
                        variant={canAfford ? "default" : "outline"}
                        disabled={!canAfford || !user}
                        className="shrink-0 gap-1 text-xs"
                      >
                        <ShoppingCart className="h-3 w-3" />
                        شراء
                      </Button>
                    )}
                  </div>

                  {/* Quick benefits */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {level.bonus_points_percentage > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
                        +{level.bonus_points_percentage}% نقاط
                      </span>
                    )}
                    {level.free_shipping && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">
                        شحن مجاني
                      </span>
                    )}
                    {prizesForLevel.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600">
                        <Gift className="h-3 w-3 inline ml-0.5" />{prizesForLevel.length} جائزة
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Roadmap Modal */}
      <LevelRoadmapModal
        open={showRoadmap}
        onOpenChange={setShowRoadmap}
        levels={sortedLevels}
        levelPrizes={levelPrizes || []}
        currentLevelIndex={currentLevelIndex}
        totalXp={totalXp}
        activeCardLevelId={activeCardLevel?.id}
      />
    </div>
  );
}
