import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Coins, Star, Lock, Zap, CreditCard, Gift, Trophy, ShoppingCart, Wallet, Crown, Truck, Headphones, Package, Gamepad2, TrendingUp, Sparkles, Check, Search, User, Send } from "lucide-react";
import UserLoyaltyCard from "@/components/UserLoyaltyCard";
import LevelRoadmapModal from "./LevelRoadmapModal";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { useNumberFormat } from "@/lib/i18n/numberFormat";
import { pickLocalized } from "@/lib/i18n/localizedField";

export default function LoyaltyLevelsPanel() {
  const { t, language } = useLanguage();
  const { fmt } = useNumberFormat();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [purchaseDialog, setPurchaseDialog] = useState<{ open: boolean; level: any | null; method: 'points' | 'wallet' }>({ open: false, level: null, method: 'points' });
  const [purchasing, setPurchasing] = useState(false);
  
  // Gift state
  const [giftDialog, setGiftDialog] = useState<{ open: boolean; level: any | null; method: 'points' | 'wallet' }>({ open: false, level: null, method: 'points' });
  const [giftSearch, setGiftSearch] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [gifting, setGifting] = useState(false);

  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data, error } = await supabase.rpc('search_users_for_gift', { p_query: query });
      if (error) throw error;
      setSearchResults((data || []).filter((u: any) => u.id !== user?.id));
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }, [user?.id]);

  const handleGift = async () => {
    if (!user || !giftDialog.level || !selectedRecipient) return;
    setGifting(true);
    try {
      const rpcName = giftDialog.method === 'wallet' ? 'gift_card_with_wallet' : 'gift_card_with_points';
      const { data, error } = await supabase.rpc(rpcName, {
        p_gifter_id: user.id,
        p_recipient_id: selectedRecipient.id,
        p_card_id: giftDialog.level.id,
        p_message: giftMessage || null,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) { toast.error(result?.error || t('ll_error_generic')); return; }
      toast.success(t('ll_success_gift', { name: pickLocalized(giftDialog.level, 'name', language) }));
      setGiftDialog({ open: false, level: null, method: 'points' });
      setSelectedRecipient(null); setGiftSearch(''); setGiftMessage(''); setSearchResults([]);
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
      queryClient.invalidateQueries({ queryKey: ['user-points-loyalty'] });
      queryClient.invalidateQueries({ queryKey: ['user-wallet'] });
      queryClient.invalidateQueries({ queryKey: ['user-wallet-cards'] });
    } catch (err: any) { toast.error(err.message || t('ll_error_gift')); }
    finally { setGifting(false); }
  };

  const { data: userPointsData } = useQuery({
    queryKey: ['user-points-loyalty', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_points')
        .select('total_points, available_points, total_xp, current_level_xp, current_level_number')
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
        .select('*, membership_cards:card_id(*)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const { data: prizeStats } = useQuery({
    queryKey: ['my-level-prize-stats', user?.id],
    queryFn: async () => {
      if (!user) return { total: 0, pending: 0 };
      const { data, error } = await supabase
        .from('user_level_prize_claims')
        .select('id,status')
        .eq('user_id', user.id);
      if (error) throw error;
      const total = data?.length || 0;
      const pending = (data || []).filter((c: any) => c.status === 'pending').length;
      return { total, pending };
    },
    enabled: !!user,
    staleTime: 60 * 1000,
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

  // Membership cards (purchasable products) - separate from XP levels
  const { data: membershipCards } = useQuery({
    queryKey: ['membership-cards-panel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membership_cards')
        .select('*')
        .eq('is_active', true)
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
        p_card_id: purchaseDialog.level.id,
      });
      
      if (error) throw error;
      const result = data as any;
      
      if (!result?.success) {
        toast.error(result?.error || t('ll_error_generic'));
        return;
      }

      toast.success(t('ll_success_purchase', { name: pickLocalized(purchaseDialog.level, 'name', language) }));
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
      toast.error(err.message || t('ll_error_purchase'));
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
  const currentLevelXp = (userPointsData as any)?.current_level_xp || 0;
  const currentLevelNumber = (userPointsData as any)?.current_level_number || 1;
  const availablePoints = userPointsData?.available_points || 0;
  const walletBalance = userWallet?.balance || 0;
  const userName = userProfile?.full_name || userProfile?.username || '';
  const activeCardLevel = userCard?.membership_cards as any;
  const sortedLevels = levels?.slice().sort((a, b) => a.display_order - b.display_order) || [];

  // Find the actual current level entity (matches level_number)
  const currentLevelEntity = sortedLevels.find(
    (l: any) => (l.level_number ?? l.display_order) === currentLevelNumber
  ) as any;
  const currentLevelXpRequired = Number(currentLevelEntity?.xp_required ?? currentLevelEntity?.min_points ?? 0);
  const currentLevelProgress = currentLevelXpRequired > 0
    ? Math.min((currentLevelXp / currentLevelXpRequired) * 100, 100)
    : 0;

  const currentLevelIndex = sortedLevels.findIndex(
    (l: any) => (l.level_number ?? l.display_order) === currentLevelNumber
  );

  const getVipPlusBenefits = (level: any) => {
    const benefits: { icon: any; text: string; color: string }[] = [];
    if (level.wholesale_discount_enabled) benefits.push({ icon: TrendingUp, text: t('ll_benefit_wholesale'), color: 'text-emerald-600' });
    if (level.free_shipping) benefits.push({ icon: Truck, text: t('ll_benefit_free_shipping'), color: 'text-blue-600' });
    if (level.priority_packaging) benefits.push({ icon: Package, text: t('ll_benefit_priority_packaging'), color: 'text-orange-600' });
    if (level.priority_support) benefits.push({ icon: Headphones, text: t('ll_benefit_priority_support'), color: 'text-purple-600' });
    if (level.free_daily_games > 0) benefits.push({ icon: Gamepad2, text: t('ll_benefit_free_games', { count: level.free_daily_games }), color: 'text-pink-600' });
    // استبدال الاستثمار بكود الإحالة الخاص
    benefits.push({ icon: TrendingUp, text: t('ll_benefit_referral_code'), color: 'text-amber-600' });
    return benefits;
  };

  return (
    <div className="space-y-4">
      {/* Level + XP Overview */}
      <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20 overflow-hidden">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center font-extrabold text-xl shrink-0"
              style={{
                backgroundColor: (currentLevelEntity?.color || 'hsl(var(--primary))') + '25',
                color: currentLevelEntity?.color || 'hsl(var(--primary))',
                border: `2px solid ${currentLevelEntity?.color || 'hsl(var(--primary))'}55`,
              }}
            >
              {currentLevelNumber}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground">المستوى الحالي</p>
              <p className="text-base font-bold truncate" style={{ color: currentLevelEntity?.color || undefined }}>
                {currentLevelEntity ? pickLocalized(currentLevelEntity, 'name', language) : `المستوى ${currentLevelNumber}`}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">إجمالي عمري: {fmt(totalXp)} XP</p>
            </div>
            <div className="text-left shrink-0">
              <Zap className="h-5 w-5 text-primary inline-block" />
            </div>
          </div>

          {/* Progress within current level */}
          {currentLevelXpRequired > 0 && currentLevelNumber < 100 && (
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-muted-foreground">للمستوى {currentLevelNumber + 1}</span>
                <span className="font-semibold">{fmt(currentLevelXp)} / {fmt(currentLevelXpRequired)} XP</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${currentLevelProgress}%`,
                    backgroundColor: currentLevelEntity?.color || 'hsl(var(--primary))',
                  }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                باقي {fmt(Math.max(currentLevelXpRequired - currentLevelXp, 0))} XP — جوائز كل 5 مستويات 🎁
              </p>
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border/40">
            <span className="flex items-center gap-1">
              <Coins className="h-3 w-3" />
              {t('ll_available_points')}: <strong className="text-foreground">{fmt(availablePoints)}</strong>
            </span>
            <span className="flex items-center gap-1">
              <Wallet className="h-3 w-3" />
              {t('ll_wallet')}: <strong className="text-foreground">{fmt(walletBalance)} {t('ll_currency_iqd')}</strong>
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            كل 1 د.ع تنفقه = 1 نقطة XP لرفع المستوى
          </p>
        </CardContent>
      </Card>

      {/* My Prizes — prominent CTA */}
      <Link to="/my-prizes" className="block group">
        <Card className="relative overflow-hidden border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-yellow-500/15 hover:border-amber-500/70 hover:shadow-lg hover:shadow-amber-500/20 transition-all">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-amber-400/20 blur-2xl pointer-events-none" />
          <CardContent className="p-4 flex items-center gap-3 relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-md group-hover:scale-110 transition-transform">
              <Trophy className="h-6 w-6 text-white drop-shadow" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-foreground">جوائزي</p>
                {prizeStats && prizeStats.pending > 0 && (
                  <Badge className="bg-red-500 hover:bg-red-500 text-white text-[10px] h-5 px-1.5 animate-pulse">
                    {fmt(prizeStats.pending)} بانتظار الاستلام
                  </Badge>
                )}
                {prizeStats && prizeStats.total > 0 && prizeStats.pending === 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                    {fmt(prizeStats.total)}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                جوائز المستويات والكوبونات الممنوحة لك — اعرض، استلم، واستخدم
              </p>
            </div>
            <Sparkles className="h-5 w-5 text-amber-500 shrink-0 group-hover:rotate-12 transition-transform" />
          </CardContent>
        </Card>
      </Link>

      {/* Active Card */}

      {activeCardLevel && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{t('ll_your_current_card')}</h3>
          <UserLoyaltyCard
            level={{
              id: activeCardLevel.id,
              name_ar: activeCardLevel.name_ar,
              name_en: activeCardLevel.name_en,
              name_ku: (activeCardLevel as any).name_ku,
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
        {t('ll_roadmap_button')}
      </Button>

      {/* Purchasable Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">{t('ll_purchasable_cards')}</h3>
        <div className="grid gap-3">
          {(membershipCards || []).map((rawCard: any) => {
            // Adapt new schema (price_points) to legacy field names used below
            const level: any = { ...rawCard, purchase_price_points: rawCard.price_points };
            const isOwned = activeCardLevel?.id === level.id;
            const canAffordPoints = availablePoints >= (level.purchase_price_points || 0);
            const canAffordWallet = level.wallet_price ? walletBalance >= level.wallet_price : false;
            const hasWalletPrice = level.wallet_price && level.wallet_price > 0;
            const prizesForLevel: any[] = [];
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
                        <img src="/frames/levo-vip-badge.png" alt="VIP" className="w-7 h-7 object-contain" loading="lazy" decoding="async" />
                      ) : (
                        <CreditCard className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-bold text-sm ${isVipPlus ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                          {pickLocalized(level, 'name', language)}
                        </p>
                        {isOwned && (
                          <Badge className="text-[10px] bg-primary/15 text-primary border-0">{t('ll_owned_badge')}</Badge>
                        )}
                        {isVipPlus && !isOwned && (
                          <Badge className="text-[10px] bg-amber-500/15 text-amber-600 border-0">
                            <Crown className="h-3 w-3 ml-0.5" />
                            {t('ll_premium_badge')}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{fmt(level.purchase_price_points || 0)} {t('ll_points_unit')}</span>
                        {hasWalletPrice && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-600">{fmt(level.wallet_price)} {t('ll_currency_iqd')}</span>
                          </>
                        )}
                        <span>• {level.duration_days} {t('ll_days_unit')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick benefits */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {level.bonus_points_percentage > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
                        +{level.bonus_points_percentage}% {t('ll_points_unit')}
                      </span>
                    )}
                    {level.free_shipping && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">
                        {t('ll_free_shipping_chip')}
                      </span>
                    )}
                    {level.priority_packaging && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600">
                        {t('ll_priority_packaging_chip')}
                      </span>
                    )}
                    {level.free_daily_games > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-600">
                        {t('ll_free_games_chip')}
                      </span>
                    )}
                    {level.wholesale_discount_enabled && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                        {t('ll_wholesale_chip')}
                      </span>
                    )}
                    {prizesForLevel.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600">
                        <Gift className="h-3 w-3 inline ml-0.5" />{t('ll_prize_count_chip', { count: prizesForLevel.length })}
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
                    <>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant={canAffordPoints ? "default" : "outline"}
                          disabled={!canAffordPoints || !user}
                          className="flex-1 gap-1 text-xs"
                          onClick={() => setPurchaseDialog({ open: true, level, method: 'points' })}
                        >
                          <Coins className="h-3 w-3" />
                          {t('ll_buy_with_points')}
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
                            {t('ll_buy_with_wallet')}
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1 text-xs border-pink-500/30 text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/20"
                          disabled={!user || (!canAffordPoints && !canAffordWallet)}
                          onClick={() => {
                            const method = hasWalletPrice && canAffordWallet ? 'wallet' : 'points';
                            setGiftDialog({ open: true, level, method });
                            setSelectedRecipient(null); setGiftSearch(''); setGiftMessage(''); setSearchResults([]);
                          }}
                        >
                          <Gift className="h-3 w-3" />
                          {t('ll_gift_to_other')}
                        </Button>
                      </div>
                    </>
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
            <DialogTitle>{t('ll_purchase_dialog_title')}</DialogTitle>
            <DialogDescription>
              {t('ll_purchase_dialog_desc', { name: pickLocalized(purchaseDialog.level, 'name', language) })}
            </DialogDescription>
          </DialogHeader>
          
          {purchaseDialog.level && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('ll_field_card')}</span>
                  <span className="font-bold">{pickLocalized(purchaseDialog.level, 'name', language)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('ll_field_duration')}</span>
                  <span>{purchaseDialog.level.duration_days} {t('ll_days_unit')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('ll_field_payment_method')}</span>
                  <span className="font-bold">
                    {purchaseDialog.method === 'wallet' 
                      ? t('ll_payment_wallet_label', { amount: fmt(purchaseDialog.level.wallet_price ?? 0) })
                      : t('ll_payment_points_label', { amount: fmt(purchaseDialog.level.purchase_price_points ?? 0) })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('ll_field_balance')}</span>
                  <span>
                    {purchaseDialog.method === 'wallet'
                      ? `${fmt(walletBalance)} ${t('ll_currency_iqd')}`
                      : `${fmt(availablePoints)} ${t('ll_points_unit')}`}
                  </span>
                </div>
              </div>

              {purchaseDialog.level.is_vip_plus && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{t('ll_vip_plus_title')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('ll_vip_plus_desc')}
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
                  {t('ll_btn_cancel')}
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
                  {t('ll_btn_confirm_purchase')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Gift Dialog */}
      <Dialog open={giftDialog.open} onOpenChange={(open) => !gifting && setGiftDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-pink-500" />
              {t('ll_gift_dialog_title')}
            </DialogTitle>
            <DialogDescription>
              {t('ll_gift_dialog_desc', { name: pickLocalized(giftDialog.level, 'name', language) })}
            </DialogDescription>
          </DialogHeader>

          {giftDialog.level && (
            <div className="space-y-4">
              {/* User search */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('ll_search_user_label')}</label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('ll_search_user_placeholder')}
                    value={giftSearch}
                    onChange={(e) => {
                      setGiftSearch(e.target.value);
                      searchUsers(e.target.value);
                    }}
                    className="pr-9"
                  />
                </div>

                {/* Search results */}
                {searching && <p className="text-xs text-muted-foreground text-center">{t('ll_searching')}</p>}
                {searchResults.length > 0 && !selectedRecipient && (
                  <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
                    {searchResults.map((u) => (
                      <button
                        key={u.id}
                        className="w-full flex items-center gap-3 p-2.5 hover:bg-muted/50 transition-colors text-right"
                        onClick={() => { setSelectedRecipient(u); setSearchResults([]); }}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={u.avatar_url} />
                          <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.full_name || u.username || t('ll_default_user')}</p>
                          {u.username && <p className="text-xs text-muted-foreground">@{u.username}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected recipient */}
                {selectedRecipient && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={selectedRecipient.avatar_url} />
                      <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedRecipient.full_name || selectedRecipient.username}</p>
                      {selectedRecipient.username && <p className="text-xs text-muted-foreground">@{selectedRecipient.username}</p>}
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedRecipient(null)}>{t('ll_change')}</Button>
                  </div>
                )}
              </div>

              {/* Payment method toggle */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('ll_payment_method_label')}</label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={giftDialog.method === 'points' ? 'default' : 'outline'}
                    className="flex-1 gap-1 text-xs"
                    onClick={() => setGiftDialog(prev => ({ ...prev, method: 'points' }))}
                  >
                    <Coins className="h-3 w-3" />
                    {t('ll_points_btn', { amount: fmt((giftDialog.level?.purchase_price_points || 0)) })}
                  </Button>
                  {giftDialog.level?.wallet_price > 0 && (
                    <Button
                      size="sm"
                      variant={giftDialog.method === 'wallet' ? 'default' : 'outline'}
                      className={`flex-1 gap-1 text-xs ${giftDialog.method === 'wallet' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                      onClick={() => setGiftDialog(prev => ({ ...prev, method: 'wallet' }))}
                    >
                      <Wallet className="h-3 w-3" />
                      {t('ll_wallet_btn', { amount: fmt(giftDialog.level?.wallet_price ?? 0) })}
                    </Button>
                  )}
                </div>
              </div>

              {/* Message */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('ll_message_label')}</label>
                <Textarea
                  placeholder={t('ll_message_placeholder')}
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value)}
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>

              {/* Summary */}
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('ll_field_card')}</span>
                  <span className="font-bold">{pickLocalized(giftDialog.level, 'name', language)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('ll_field_cost')}</span>
                  <span className="font-bold">
                    {giftDialog.method === 'wallet'
                      ? `${fmt(giftDialog.level.wallet_price ?? 0)} ${t('ll_currency_iqd')}`
                      : `${fmt(giftDialog.level.purchase_price_points || 0)} ${t('ll_points_unit')}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('ll_field_balance')}</span>
                  <span>{giftDialog.method === 'wallet' ? `${fmt(walletBalance)} ${t('ll_currency_iqd')}` : `${fmt(availablePoints)} ${t('ll_points_unit')}`}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setGiftDialog({ open: false, level: null, method: 'points' })} disabled={gifting}>{t('ll_btn_cancel')}</Button>
                <Button
                  className="flex-1 gap-1 bg-pink-600 hover:bg-pink-700"
                  onClick={handleGift}
                  disabled={gifting || !selectedRecipient}
                >
                  {gifting ? <span className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white rounded-full" /> : <Send className="h-4 w-4" />}
                  {t('ll_btn_send_gift')}
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
        currentLevelXp={currentLevelXp}
        currentLevelNumber={currentLevelNumber}
        activeCardLevelId={activeCardLevel?.id}
      />
    </div>
  );
}
