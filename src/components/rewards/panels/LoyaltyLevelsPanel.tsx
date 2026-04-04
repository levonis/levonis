import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Coins, Star, Lock, Zap, CreditCard, Gift, Trophy, ShoppingCart, Wallet, Crown, Truck, Headphones, Package, Gamepad2, TrendingUp, Sparkles, Check } from "lucide-react";
import UserLoyaltyCard from "@/components/UserLoyaltyCard";
import LevelRoadmapModal from "./LevelRoadmapModal";
import { toast } from "sonner";

export default function LoyaltyLevelsPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [purchaseDialog, setPurchaseDialog] = useState<{ open: boolean; level: any | null; method: 'points' | 'wallet' }>({ open: false, level: null, method: 'points' });
  const [purchasing, setPurchasing] = useState(false);

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

  const { data: userWallet } = useQuery({
    queryKey: ['user-wallet-cards', user?.id],
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
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
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

  const handlePurchase = async () => {
    if (!user || !purchaseDialog.level) return;
    setPurchasing(true);
    
    try {
      const rpcName = purchaseDialog.method === 'wallet' ? 'purchase_card_with_wallet' : 'purchase_card_with_points';
      const { data, error } = await supabase.rpc(rpcName, {
        p_user_id: user.id,
        p_level_id: purchaseDialog.level.id,
      });
      
      if (error) throw error;
      const result = data as any;
      
      if (!result?.success) {
        toast.error(result?.error || 'حدث خطأ');
        return;
      }

      toast.success(`تم شراء بطاقة ${purchaseDialog.level.name_ar} بنجاح! 🎉`);
      setPurchaseDialog({ open: false, level: null, method: 'points' });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['user-active-card'] });
      queryClient.invalidateQueries({ queryKey: ['user-active-card-panel'] });
      queryClient.invalidateQueries({ queryKey: ['user-active-card-benefits'] });
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
      queryClient.invalidateQueries({ queryKey: ['user-points-loyalty'] });
      queryClient.invalidateQueries({ queryKey: ['user-wallet'] });
      queryClient.invalidateQueries({ queryKey: ['user-wallet-cards'] });
      queryClient.invalidateQueries({ queryKey: ['user-card-frame'] });
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ في عملية الشراء');
    } finally {
      setPurchasing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    );
  }

  const totalXp = (userPointsData as any)?.total_xp || 0;
  const availablePoints = userPointsData?.available_points || 0;
  const walletBalance = userWallet?.balance || 0;
  const userName = userProfile?.full_name || userProfile?.username || '';
  const activeCardLevel = userCard?.loyalty_levels as any;
  const sortedLevels = levels?.slice().sort((a, b) => a.display_order - b.display_order) || [];

  const currentLevelIndex = sortedLevels.reduce((acc, level, i) => {
    return ((level as any).xp_required || 0) <= totalXp ? i : acc;
  }, 0);

  const getVipPlusBenefits = (level: any) => {
    const benefits: { icon: any; text: string; color: string }[] = [];
    if (level.wholesale_discount_enabled) benefits.push({ icon: TrendingUp, text: 'أسعار الجملة على المنتجات', color: 'text-emerald-600' });
    if (level.free_shipping) benefits.push({ icon: Truck, text: 'توصيل مجاني + أولوية التوصيل', color: 'text-blue-600' });
    if (level.priority_packaging) benefits.push({ icon: Package, text: 'أولوية التغليف', color: 'text-orange-600' });
    if (level.priority_support) benefits.push({ icon: Headphones, text: 'أولوية الدعم الفني', color: 'text-purple-600' });
    if (level.free_daily_games > 0) benefits.push({ icon: Gamepad2, text: `لعب مجاني ${level.free_daily_games} مرة يومياً`, color: 'text-pink-600' });
    if (level.investment_enabled) benefits.push({ icon: TrendingUp, text: 'خيار الاستثمار في التطبيق', color: 'text-amber-600' });
    return benefits;
  };

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
            <span className="flex items-center gap-1">
              <Wallet className="h-3 w-3" />
              المحفظة: <strong className="text-foreground">{walletBalance.toLocaleString()} د.ع</strong>
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            كل نقطة تكسبها = 2 XP • البطاقات تُشترى بالنقاط أو المحفظة
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
          {sortedLevels.filter(l => l.is_purchasable).map((level: any) => {
            const isOwned = activeCardLevel?.id === level.id;
            const canAffordPoints = availablePoints >= (level.purchase_price_points || 0);
            const canAffordWallet = level.wallet_price ? walletBalance >= level.wallet_price : false;
            const hasWalletPrice = level.wallet_price && level.wallet_price > 0;
            const prizesForLevel = levelPrizes?.filter(p => p.level_id === level.id) || [];
            const isVipPlus = level.is_vip_plus;
            const vipBenefits = isVipPlus ? getVipPlusBenefits(level) : [];

            return (
              <Card
                key={level.id}
                className={`overflow-hidden transition-all ${
                  isOwned ? 'border-primary/50 bg-primary/5' : ''
                } ${isVipPlus ? 'border-amber-500/40 relative' : ''}`}
              >
                {/* VIP Plus golden glow */}
                {isVipPlus && (
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-emerald-500/5 pointer-events-none" />
                )}
                
                <CardContent className="p-4 relative">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isVipPlus ? 'ring-2 ring-amber-500/50' : ''}`}
                      style={{ backgroundColor: level.color + '20', color: level.color }}
                    >
                      {isVipPlus ? (
                        <img src="/frames/levo-vip-badge.png" alt="VIP" className="w-7 h-7 object-contain" />
                      ) : (
                        <CreditCard className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-bold text-sm ${isVipPlus ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                          {level.name_ar}
                        </p>
                        {isOwned && (
                          <Badge className="text-[10px] bg-primary/15 text-primary border-0">مملوكة</Badge>
                        )}
                        {isVipPlus && !isOwned && (
                          <Badge className="text-[10px] bg-amber-500/15 text-amber-600 border-0">
                            <Crown className="h-3 w-3 ml-0.5" />
                            مميزة
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{(level.purchase_price_points || 0).toLocaleString()} نقطة</span>
                        {hasWalletPrice && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-600">{level.wallet_price.toLocaleString()} د.ع</span>
                          </>
                        )}
                        <span>• {level.duration_days} يوم</span>
                      </div>
                    </div>
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
                    {level.priority_packaging && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600">
                        أولوية تغليف
                      </span>
                    )}
                    {level.free_daily_games > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-600">
                        لعب مجاني
                      </span>
                    )}
                    {level.wholesale_discount_enabled && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                        أسعار جملة
                      </span>
                    )}
                    {prizesForLevel.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600">
                        <Gift className="h-3 w-3 inline ml-0.5" />{prizesForLevel.length} جائزة
                      </span>
                    )}
                  </div>

                  {/* VIP Plus detailed benefits */}
                  {isVipPlus && vipBenefits.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-amber-500/20 space-y-1.5">
                      {vipBenefits.map((b, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <b.icon className={`h-3.5 w-3.5 shrink-0 ${b.color}`} />
                          <span className="text-muted-foreground">{b.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Purchase buttons */}
                  {!isOwned && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant={canAffordPoints ? "default" : "outline"}
                        disabled={!canAffordPoints || !user}
                        className="flex-1 gap-1 text-xs"
                        onClick={() => setPurchaseDialog({ open: true, level, method: 'points' })}
                      >
                        <Coins className="h-3 w-3" />
                        شراء بالنقاط
                      </Button>
                      {hasWalletPrice && (
                        <Button
                          size="sm"
                          variant={canAffordWallet ? "default" : "outline"}
                          disabled={!canAffordWallet || !user}
                          className={`flex-1 gap-1 text-xs ${canAffordWallet ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                          onClick={() => setPurchaseDialog({ open: true, level, method: 'wallet' })}
                        >
                          <Wallet className="h-3 w-3" />
                          شراء بالمحفظة
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Purchase Confirmation Dialog */}
      <Dialog open={purchaseDialog.open} onOpenChange={(open) => !purchasing && setPurchaseDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد شراء البطاقة</DialogTitle>
            <DialogDescription>
              هل تريد شراء بطاقة <strong>{purchaseDialog.level?.name_ar}</strong>؟
            </DialogDescription>
          </DialogHeader>
          
          {purchaseDialog.level && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">البطاقة:</span>
                  <span className="font-bold">{purchaseDialog.level.name_ar}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">المدة:</span>
                  <span>{purchaseDialog.level.duration_days} يوم</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">طريقة الدفع:</span>
                  <span className="font-bold">
                    {purchaseDialog.method === 'wallet' 
                      ? `${purchaseDialog.level.wallet_price?.toLocaleString()} د.ع (محفظة)` 
                      : `${purchaseDialog.level.purchase_price_points?.toLocaleString()} نقطة`}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">رصيدك:</span>
                  <span>
                    {purchaseDialog.method === 'wallet'
                      ? `${walletBalance.toLocaleString()} د.ع`
                      : `${availablePoints.toLocaleString()} نقطة`}
                  </span>
                </div>
              </div>

              {purchaseDialog.level.is_vip_plus && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">مزايا VIP Plus</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ستحصل على شارة مميزة، أسعار الجملة، توصيل مجاني، أولوية الدعم والتغليف، لعب مجاني في الألعاب، وخيار الاستثمار.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setPurchaseDialog({ open: false, level: null, method: 'points' })}
                  disabled={purchasing}
                >
                  إلغاء
                </Button>
                <Button
                  className="flex-1 gap-1"
                  onClick={handlePurchase}
                  disabled={purchasing}
                >
                  {purchasing ? (
                    <span className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white rounded-full" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  تأكيد الشراء
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
