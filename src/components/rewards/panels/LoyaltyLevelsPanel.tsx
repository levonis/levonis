import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Coins, Star, CheckCircle2, Lock, Zap } from "lucide-react";
import UserLoyaltyCard from "@/components/UserLoyaltyCard";

export default function LoyaltyLevelsPanel() {
  const { user } = useAuth();

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
        .order('xp_required', { ascending: true });
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
  const userName = userProfile?.full_name || userProfile?.username || '';

  // Find current level and next level
  const sortedLevels = levels?.slice().sort((a, b) => ((a as any).xp_required || 0) - ((b as any).xp_required || 0)) || [];
  const currentLevelIndex = sortedLevels.reduce((acc, level, i) => {
    return ((level as any).xp_required || 0) <= totalXp ? i : acc;
  }, 0);
  const currentLevel = sortedLevels[currentLevelIndex];
  const nextLevel = sortedLevels[currentLevelIndex + 1];

  const currentXpRequired = (currentLevel as any)?.xp_required || 0;
  const nextXpRequired = nextLevel ? (nextLevel as any).xp_required : currentXpRequired;
  const xpInLevel = totalXp - currentXpRequired;
  const xpNeeded = nextLevel ? nextXpRequired - currentXpRequired : 1;
  const progressPercent = nextLevel ? Math.min((xpInLevel / xpNeeded) * 100, 100) : 100;

  return (
    <div className="space-y-4">
      {/* XP Overview Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20 overflow-hidden relative">
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
          <div className="text-[10px] text-muted-foreground mb-1">
            كل نقطة تكسبها = 2 XP • استخدام النقاط لا يؤثر على XP
          </div>
        </CardContent>
      </Card>

      {/* Current Level Card */}
      {currentLevel && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground">مستواك الحالي</h3>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              المستوى {currentLevelIndex + 1}
            </span>
          </div>
          <UserLoyaltyCard
            level={{
              id: currentLevel.id,
              name_ar: currentLevel.name_ar,
              name_en: currentLevel.name_en,
              color: currentLevel.color,
              discount_percentage: currentLevel.discount_percentage,
              bonus_points_percentage: currentLevel.bonus_points_percentage,
              free_shipping: currentLevel.free_shipping,
              free_shipping_min_order: currentLevel.free_shipping_min_order,
              duration_days: currentLevel.duration_days,
              vip_support: currentLevel.vip_support,
              priority_shipping: currentLevel.priority_shipping,
              early_access: currentLevel.early_access,
              exclusive_products: currentLevel.exclusive_products,
              special_name_style: currentLevel.special_name_style as any,
              profile_effects: currentLevel.profile_effects as any,
              benefits: currentLevel.benefits as any,
            }}
            userName={userName}
            isActive={true}
            showDetails={false}
          />

          {/* Progress to next level */}
          {nextLevel && (
            <Card className="border-border/50">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">التقدم نحو {nextLevel.name_ar}</span>
                  <span className="font-bold text-primary">{Math.round(progressPercent)}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{totalXp.toLocaleString()} XP</span>
                  <span>{((nextLevel as any).xp_required || 0).toLocaleString()} XP</span>
                </div>
                <p className="text-[10px] text-center text-muted-foreground">
                  تحتاج <strong className="text-foreground">{(nextXpRequired - totalXp).toLocaleString()}</strong> XP إضافية للترقية
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* All Levels */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">جميع المستويات</h3>
        <div className="grid gap-4">
          {sortedLevels.map((level, index) => {
            const xpReq = (level as any).xp_required || 0;
            const isUnlocked = totalXp >= xpReq;
            const isCurrent = index === currentLevelIndex;

            return (
              <div
                key={level.id}
                className={`p-4 rounded-xl border shadow-sm space-y-3 transition-all ${
                  isCurrent 
                    ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20' 
                    : isUnlocked 
                      ? 'bg-card border-border/50 opacity-80' 
                      : 'bg-muted/30 border-border/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: level.color + '20', color: level.color }}
                  >
                    {isUnlocked ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm" style={{ color: level.color }}>
                        {level.name_ar}
                      </p>
                      {isCurrent && (
                        <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-bold">
                          الحالي
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {xpReq > 0 ? `${xpReq.toLocaleString()} XP مطلوب` : 'المستوى الأساسي'}
                    </p>
                  </div>
                  <div className="text-left text-xs">
                    {level.bonus_points_percentage > 0 && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Star className="h-3 w-3" />+{level.bonus_points_percentage}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Benefits */}
                {(level.benefits as any)?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(level.benefits as any).map((b: any, i: number) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                      >
                        {b.text_ar}
                      </span>
                    ))}
                  </div>
                )}

                {/* Progress for locked levels */}
                {!isUnlocked && (
                  <div className="space-y-1">
                    <Progress
                      value={Math.min((totalXp / xpReq) * 100, 100)}
                      className="h-1.5"
                    />
                    <p className="text-[10px] text-muted-foreground text-center">
                      {totalXp.toLocaleString()} / {xpReq.toLocaleString()} XP
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
