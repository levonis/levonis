import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CreditCard, Star, TrendingUp, Gift, Check, ChevronDown, ChevronUp, TicketPercent, Copy } from "lucide-react";
import { SubTabId } from "./RewardsSubTabs";
import { LevelCardSkeleton } from "./SkeletonLoaders";
import LoyaltyLevelsPanel from "./panels/LoyaltyLevelsPanel";
import UserLoyaltyCard from "@/components/UserLoyaltyCard";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";

interface CardsSectionProps {
  activeSubTab: SubTabId;
}

export default function CardsSection({ activeSubTab }: CardsSectionProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [expandedCoupons, setExpandedCoupons] = useState(false);

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

  const { data: userProfile } = useQuery({
    queryKey: ['user-profile-name', user?.id],
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
    enabled: !!user && shouldFetchUserData,
    staleTime: 10 * 60 * 1000,
  });

  const { data: userCard } = useQuery({
    queryKey: ['user-active-card-benefits', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_cards')
        .select(`*, loyalty_levels:level_id(*)`)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user && shouldFetchUserData,
    staleTime: 2 * 60 * 1000,
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

  const { data: userCoupons, isLoading: loadingCoupons } = useQuery({
    queryKey: ['user-coupons', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('letter_prize_coupons')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_used', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && activeSubTab === 'benefits',
    staleTime: 2 * 60 * 1000,
  });

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

  const copyCouponCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(t('cards_code_copied'));
  };

  if (activeSubTab === 'benefits') {
    const isLoading = loadingPoints || (userPoints && loadingLevel);
    const totalCouponValue = userCoupons?.reduce((sum, c) => sum + (c.prize_value || 0), 0) || 0;
    const activeCardLevel = userCard?.loyalty_levels;
    const displayLevel = activeCardLevel;
    const userName = userProfile?.full_name || userProfile?.username || '';

    return (
      <div className="space-y-4">
        {isLoading ? (
          <LevelCardSkeleton />
        ) : displayLevel ? (
          <UserLoyaltyCard 
            level={{
              id: displayLevel.id,
              name_ar: displayLevel.name_ar,
              name_en: displayLevel.name_en,
              color: displayLevel.color,
              discount_percentage: displayLevel.discount_percentage,
              bonus_points_percentage: displayLevel.bonus_points_percentage,
              free_shipping: displayLevel.free_shipping,
              free_shipping_min_order: displayLevel.free_shipping_min_order,
              duration_days: displayLevel.duration_days,
              vip_support: displayLevel.vip_support,
              priority_shipping: displayLevel.priority_shipping,
              early_access: displayLevel.early_access,
              exclusive_products: displayLevel.exclusive_products,
              special_name_style: displayLevel.special_name_style as any,
              profile_effects: displayLevel.profile_effects as any,
              benefits: displayLevel.benefits as any,
            }}
            userName={userName}
            expiresAt={userCard?.expires_at}
            isActive={true}
            showDetails={true}
          />
        ) : !user ? (
          <Card>
            <CardContent className="p-6 text-center">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{t('cards_login_required')}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">{t('cards_no_card')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('cards_no_card_desc')}</p>
            </CardContent>
          </Card>
        )}

        {user && (
          <Card>
            <Collapsible open={expandedCoupons} onOpenChange={setExpandedCoupons}>
              <CollapsibleTrigger asChild>
                <CardContent className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <TicketPercent className="h-5 w-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="font-medium">{t('cards_my_coupons')}</p>
                        <p className="text-xs text-muted-foreground">
                          {loadingCoupons ? t('cards_loading') : 
                            userCoupons?.length ? t('cards_coupon_available').replace('{count}', String(userCoupons.length)) : t('cards_no_coupons')
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {totalCouponValue > 0 && (
                        <Badge className="bg-amber-500">
                          {totalCouponValue.toLocaleString()} {t('common_iqd')}
                        </Badge>
                      )}
                      {expandedCoupons ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </CardContent>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="px-4 pb-4 border-t pt-3 space-y-2 max-h-64 overflow-y-auto">
                  {loadingCoupons ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">{t('cards_loading')}</div>
                  ) : userCoupons?.length === 0 ? (
                    <div className="text-center py-4">
                      <TicketPercent className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">{t('cards_no_coupons_available')}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('cards_no_coupons_hint')}</p>
                    </div>
                  ) : (
                    userCoupons?.map((coupon) => (
                      <div 
                        key={coupon.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{coupon.prize_name_ar}</p>
                          <p className="text-xs text-muted-foreground font-mono">{coupon.coupon_code}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="shrink-0">
                            {coupon.prize_value?.toLocaleString()} {t('common_iqd')}
                          </Badge>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 p-0"
                            onClick={() => copyCouponCode(coupon.coupon_code)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}
      </div>
    );
  }

  if (activeSubTab === 'upgrade') {
    return <LoyaltyLevelsPanel />;
  }

  if (activeSubTab === 'exclusive-offers') {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 text-center">
            <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium mb-2">{t('cards_exclusive_offers')}</p>
            <p className="text-sm text-muted-foreground">
              {t('cards_exclusive_offers_desc')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
