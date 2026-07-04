import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Coins, Ticket, Trophy, Loader2, AlertCircle, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/i18n";
import { useNumberFormat } from "@/lib/i18n/numberFormat";
import { pickLocalized } from "@/lib/i18n/localizedField";

export default function RedeemPointsPanel() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { fmt } = useNumberFormat();
  const queryClient = useQueryClient();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [pointsToRedeem, setPointsToRedeem] = useState('');

  const { data: userPoints } = useQuery({
    queryKey: ['user-points-redeem', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_points')
        .select('available_points')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const { data: redeemOptions, isLoading: loadingOptions } = useQuery({
    queryKey: ['redemption-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('redemption_settings')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: todayRedemption } = useQuery({
    queryKey: ['today-redemption', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_redemption_log')
        .select('points_redeemed, redemption_type')
        .eq('user_id', user.id)
        .eq('redeemed_at', today);
      if (error && error.code !== 'PGRST116') throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 1 * 60 * 1000,
  });

  const getUnitLabel = (type: string) => {
    switch (type) {
      case 'wallet': return t('rp_unit_wallet');
      case 'coupon': return t('rp_unit_coupon');
      case 'tickets': return t('rp_unit_ticket');
      default: return '';
    }
  };

  const redeemMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedOption) throw new Error(t('rp_select_method_required'));
      
      const points = parseInt(pointsToRedeem);
      const option = redeemOptions?.find(o => o.redemption_type === selectedOption);
      if (!option) throw new Error(t('rp_invalid_option'));
      
      // Must be multiples of points_per_unit
      if (isNaN(points) || points < option.min_points || points % option.points_per_unit !== 0) {
        throw new Error(
          t('rp_must_be_multiple')
            .replace('{step}', String(option.points_per_unit))
            .replace('{min}', String(option.min_points))
        );
      }

      const availablePoints = userPoints?.available_points || 0;
      if (points > availablePoints) {
        throw new Error(t('rp_insufficient_points'));
      }

      // Check daily limit
      if (option.max_daily_points) {
        const todayTotal = todayRedemption
          ?.filter(r => r.redemption_type === selectedOption)
          .reduce((sum, r) => sum + Number(r.points_redeemed), 0) || 0;
        
        if (todayTotal + points > option.max_daily_points) {
          throw new Error(t('rp_daily_limit_exceeded').replace('{limit}', String(option.max_daily_points)));
        }
      }

      const value = (points / option.points_per_unit) * option.unit_value;

      if (selectedOption === 'wallet') {
        // Add to wallet
        const { data: wallet } = await supabase
          .from('user_wallets')
          .select('balance')
          .eq('user_id', user.id)
          .maybeSingle();

        if (wallet) {
          const { error: walletError } = await supabase
            .from('user_wallets')
            .update({ balance: (wallet.balance || 0) + value })
            .eq('user_id', user.id);
          if (walletError) throw walletError;
        } else {
          const { error: walletError } = await supabase
            .from('user_wallets')
            .insert({ user_id: user.id, balance: value });
          if (walletError) throw walletError;
        }
      } else if (selectedOption === 'coupon') {
        const couponCode = `PTS${Date.now().toString(36).toUpperCase()}`;
        const { error: couponError } = await supabase
          .from('user_coupons')
          .insert({
            user_id: user.id,
            coupon_code: couponCode,
            discount_value: value,
            discount_type: 'fixed',
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            source: 'points_redemption',
          });
        if (couponError) throw couponError;
      } else if (selectedOption === 'tickets') {
        const desc = t('rp_redeem_description')
          .replace('{points}', String(points))
          .replace('{value}', fmt(value))
          .replace('{unit}', getUnitLabel(selectedOption));
        const { data, error: ticketError } = await supabase.rpc('redeem_points_for_tickets' as any, {
          p_points: points,
          p_tickets: Math.floor(value),
          p_description: desc,
        });
        if (ticketError) throw ticketError;
        const res = data as { success?: boolean; error?: string } | null;
        if (!res?.success) throw new Error(res?.error || 'redemption_failed');
        return; // tickets path handles points + log atomically
      }

      // Deduct points (wallet/coupon paths)
      const { error: pointsError } = await supabase.rpc('deduct_user_points', {
        p_user_id: user.id,
        p_amount: points,
        p_source: 'redemption',
        p_description: t('rp_redeem_description')
          .replace('{points}', String(points))
          .replace('{value}', fmt(value))
          .replace('{unit}', getUnitLabel(selectedOption))
      });
      if (pointsError) throw pointsError;

      // Log daily redemption
      await supabase.from('daily_redemption_log').insert({
        user_id: user.id,
        redemption_type: selectedOption,
        points_redeemed: points,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
      queryClient.invalidateQueries({ queryKey: ['user-points-redeem'] });
      queryClient.invalidateQueries({ queryKey: ['user-coupons'] });
      queryClient.invalidateQueries({ queryKey: ['user-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['user-wallet'] });
      queryClient.invalidateQueries({ queryKey: ['today-redemption'] });
      toast.success(t('rp_redeem_success'));
      setPointsToRedeem('');
      setSelectedOption(null);
    },
    onError: (error: any) => {
      toast.error(error.message || t('rp_generic_error'));
    },
  });

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Ticket': return Ticket;
      case 'Trophy': return Trophy;
      case 'Wallet': return Wallet;
      default: return Coins;
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground mb-4">{t('rp_login_to_redeem')}</p>
        </CardContent>
      </Card>
    );
  }

  const selectedOptionData = redeemOptions?.find(o => o.redemption_type === selectedOption);
  const points = parseInt(pointsToRedeem) || 0;
  const isValidPoints = selectedOptionData && points >= selectedOptionData.min_points && points % selectedOptionData.points_per_unit === 0;
  const calculatedValue = selectedOptionData 
    ? (points / selectedOptionData.points_per_unit) * selectedOptionData.unit_value 
    : 0;

  return (
    <div className="space-y-4">
      {/* Current Balance */}
      <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Coins className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('rp_available_balance_label')}</p>
            <p className="text-2xl font-bold">{fmt(userPoints?.available_points || 0)} {t('rp_points_unit')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Redeem Options */}
      <div className="space-y-3">
        <p className="text-sm font-medium">{t('rp_choose_method')}</p>
        
        {loadingOptions ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : (
          redeemOptions?.map((option) => {
            const Icon = getIcon(option.icon);
            const isSelected = selectedOption === option.redemption_type;
            const todayUsed = todayRedemption
              ?.filter(r => r.redemption_type === option.redemption_type)
              .reduce((sum, r) => sum + Number(r.points_redeemed), 0) || 0;
            const remaining = option.max_daily_points ? option.max_daily_points - todayUsed : null;
            
            return (
              <Card 
                key={option.id}
                className={`cursor-pointer transition-all ${
                  isSelected ? 'ring-2 ring-primary' : 'hover:shadow-md'
                }`}
                onClick={() => {
                  setSelectedOption(option.redemption_type);
                  setPointsToRedeem('');
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{pickLocalized(option, 'name', language)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{pickLocalized(option, 'description', language)}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                          {t('rp_points_eq_unit')
                            .replace('{points}', String(option.points_per_unit))
                            .replace('{value}', fmt(option.unit_value))
                            .replace('{unit}', option.redemption_type === 'tickets' ? t('rp_unit_ticket_short') : t('rp_unit_iqd_short'))}
                        </span>
                      </div>
                      {remaining !== null && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {t('rp_daily_remaining').replace('{remaining}', fmt(remaining))}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {selectedOption && selectedOptionData && (
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-sm font-medium">{t('rp_points_to_redeem')}</label>
            <Input 
              type="number" 
              placeholder={selectedOptionData.min_points.toString()} 
              className="mt-1"
              value={pointsToRedeem}
              onChange={(e) => setPointsToRedeem(e.target.value)}
              min={selectedOptionData.min_points}
              step={selectedOptionData.points_per_unit}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('rp_min_and_multiples')
                .replace('{min}', fmt(selectedOptionData.min_points))
                .replace('{step}', String(selectedOptionData.points_per_unit))}
            </p>
          </div>

          {isValidPoints && (
            <Alert className="border-primary/30 bg-primary/5">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('rp_will_get')} <strong>{fmt(calculatedValue)}</strong> {getUnitLabel(selectedOption)}
              </AlertDescription>
            </Alert>
          )}
          
          <Button 
            className="w-full"
            onClick={() => redeemMutation.mutate()}
            disabled={redeemMutation.isPending || !isValidPoints}
          >
            {redeemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
            {t('rp_confirm_redeem')}
          </Button>
        </div>
      )}
    </div>
  );
}
