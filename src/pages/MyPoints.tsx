import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Coins, Gift, DollarSign, ArrowRight, History, Award, CheckSquare } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import LoyaltyLevelCard from "@/components/LoyaltyLevelCard";
import DailyTaskCard from "@/components/DailyTaskCard";
import ReferralCard from "@/components/ReferralCard";
import { useLanguage } from "@/lib/i18n";
import { ar as arLocale, enUS } from "date-fns/locale";
import { format } from "date-fns";

export default function MyPoints() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, language, dir } = useLanguage();
  const dateLocale = language === 'en' ? enUS : arLocale;
  const [redeemAmount, setRedeemAmount] = useState("");
  const [convertAmount, setConvertAmount] = useState("");
  const [completingTask, setCompletingTask] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  const { data: userPoints, isLoading: loadingPoints } = useQuery({
    queryKey: ["userPoints", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.from("user_points").select("*").eq("user_id", user.id).single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: transactions, isLoading: loadingTransactions } = useQuery({
    queryKey: ["pointsTransactions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.from("points_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: pointsSettings } = useQuery({
    queryKey: ["pointsSettings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("default_settings").select("setting_value").eq("setting_key", "points_settings").single();
      if (error && error.code !== "PGRST116") throw error;
      return (data?.setting_value as any) || { points_per_order: 10, points_per_review: 5, points_to_money_rate: 100, points_to_coupon_rate: 50 };
    },
  });

  const { data: loyaltyLevels, isLoading: loadingLevels } = useQuery({
    queryKey: ["loyaltyLevels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("loyalty_levels").select("*").order("display_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: dailyTasks, isLoading: loadingTasks } = useQuery({
    queryKey: ["dailyTasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("daily_tasks").select("*").eq("is_active", true).order("display_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: completedTasks, refetch: refetchCompletedTasks } = useQuery({
    queryKey: ["completedTasks", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.from("user_task_completions").select("*").eq("user_id", user.id).gte("completed_at", new Date().toISOString().split('T')[0]);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: referralData, refetch: refetchReferral } = useQuery({
    queryKey: ["referralCode", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.from("user_referrals").select("referral_code, status, points_awarded").eq("referrer_user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const redeemToCoupon = useMutation({
    mutationFn: async (points: number) => {
      if (!user?.id) throw new Error("User not found");
      if (!userPoints || userPoints.available_points < points) {
        throw new Error(t('mp_err_insufficient'));
      }

      const couponValue = points / (pointsSettings?.points_to_coupon_rate || 50);
      const couponCode = `${t('mp_coupon_code_prefix')}-${Date.now()}`;
      const { error: couponError } = await supabase.from("coupons").insert({
        code: couponCode,
        discount_type: "fixed",
        discount_value: couponValue,
        max_uses: 1,
        current_uses: 0,
        active: true,
      });
      if (couponError) throw couponError;

      const { error: pointsError } = await supabase.from("user_points").update({
        available_points: userPoints.available_points - points,
        redeemed_points: userPoints.redeemed_points + points,
      }).eq("user_id", user.id);
      if (pointsError) throw pointsError;

      await supabase.from("points_transactions").insert({
        user_id: user.id,
        points: -points,
        type: "redeemed",
        source: "coupon",
        description: t('mp_tx_desc_coupon', { points: points.toLocaleString(), value: couponValue.toLocaleString() }),
      });

      return couponCode;
    },
    onSuccess: (couponCode) => {
      queryClient.invalidateQueries({ queryKey: ["userPoints"] });
      queryClient.invalidateQueries({ queryKey: ["pointsTransactions"] });
      toast.success(t('mp_success_coupon', { code: couponCode }));
      setRedeemAmount("");
    },
    onError: (error: any) => {
      toast.error(error.message || t('mp_err_redeem'));
    },
  });

  const convertToMoney = useMutation({
    mutationFn: async (points: number) => {
      const { data, error } = await supabase.rpc('convert_points_to_wallet', { points_amount: points });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || t('mp_err_convert'));
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userPoints"] });
      queryClient.invalidateQueries({ queryKey: ["pointsTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
      toast.success(t('mp_success_convert'));
      setConvertAmount("");
    },
    onError: (error: any) => {
      toast.error(error.message || t('mp_err_convert'));
    },
  });

  const handleRedeemToCoupon = () => {
    const points = parseFloat(redeemAmount);
    if (isNaN(points) || points <= 0) {
      toast.error(t('mp_err_invalid_amount'));
      return;
    }
    redeemToCoupon.mutate(points);
  };

  const handleConvertToMoney = () => {
    const points = parseFloat(convertAmount);
    if (isNaN(points) || points <= 0) {
      toast.error(t('mp_err_invalid_amount'));
      return;
    }
    convertToMoney.mutate(points);
  };

  const handleCompleteTask = async (taskKey: string) => {
    if (!user?.id) return;
    setCompletingTask(taskKey);
    try {
      const { data, error } = await supabase.rpc("complete_daily_task", { task_key_param: taskKey });
      if (error) throw error;
      const result = data as any;
      if (result.success) {
        toast.success(t('mp_success_task', { points: result.points_earned }));
        queryClient.invalidateQueries({ queryKey: ["userPoints"] });
        queryClient.invalidateQueries({ queryKey: ["pointsTransactions"] });
        refetchCompletedTasks();
      } else {
        toast.error(result.error || t('mp_err_task'));
      }
    } catch (error: any) {
      toast.error(error.message || t('mp_err_task'));
    } finally {
      setCompletingTask(null);
    }
  };

  const handleGenerateReferralCode = async () => {
    if (!user?.id) return;
    try {
      const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
      if (!profile?.username) {
        toast.error(t('mp_err_username_missing'));
        return;
      }
      const referralCode = `${t('mp_referral_code_prefix')}-${profile.username.toUpperCase()}`;
      const { data: existingReferral } = await supabase.from("user_referrals").select("referral_code").eq("referrer_user_id", user.id).maybeSingle();
      if (existingReferral) {
        toast.info(t('mp_info_referral_exists'));
        refetchReferral();
        return;
      }
      const { error } = await supabase.from("user_referrals").insert({
        referrer_user_id: user.id,
        referral_code: referralCode,
      });
      if (error) throw error;
      toast.success(t('mp_success_referral_created'));
      refetchReferral();
    } catch (error: any) {
      toast.error(error.message || t('mp_err_referral'));
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background" dir={dir}>
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('mp_title')}</h1>
          <p className="text-muted-foreground">{t('mp_subtitle')}</p>
        </div>

        {loadingPoints ? (
          <div className="text-center py-12">{t('mp_loading')}</div>
        ) : (
          <>
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="h-4 w-4" />
                    {t('mp_available_points')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold">{userPoints?.available_points || 0}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    {t('mp_total_points')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold">{userPoints?.total_points || 0}</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border-yellow-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    {t('mp_your_level')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold capitalize">
                    {loyaltyLevels?.find(l => l.level_key === userPoints?.level)?.name_ar || t('mp_default_level')}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="tasks" className="space-y-6">
              <ScrollArea className="w-full whitespace-nowrap">
                <TabsList className="inline-flex w-auto min-w-full p-1">
                  <TabsTrigger value="tasks" className="text-xs sm:text-sm px-3 sm:px-4">{t('mp_tab_tasks')}</TabsTrigger>
                  <TabsTrigger value="levels" className="text-xs sm:text-sm px-3 sm:px-4">{t('mp_tab_levels')}</TabsTrigger>
                  <TabsTrigger value="earn" className="text-xs sm:text-sm px-3 sm:px-4">{t('mp_tab_earn')}</TabsTrigger>
                  <TabsTrigger value="redeem" className="text-xs sm:text-sm px-3 sm:px-4">{t('mp_tab_redeem')}</TabsTrigger>
                  <TabsTrigger value="convert" className="text-xs sm:text-sm px-3 sm:px-4">{t('mp_tab_convert')}</TabsTrigger>
                  <TabsTrigger value="history" className="text-xs sm:text-sm px-3 sm:px-4">{t('mp_tab_history')}</TabsTrigger>
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>

              <TabsContent value="tasks" className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <CheckSquare className="h-5 w-5 text-primary" />
                      {t('mp_daily_tasks')}
                    </h3>
                    {loadingTasks ? (
                      <div className="text-center py-8">{t('mp_loading')}</div>
                    ) : dailyTasks && dailyTasks.length > 0 ? (
                      <div className="space-y-3">
                        {dailyTasks.map((task) => (
                          <DailyTaskCard
                            key={task.task_key}
                            task={task}
                            isCompleted={completedTasks?.some(ct => ct.task_key === task.task_key) || false}
                            onComplete={handleCompleteTask}
                            isLoading={completingTask === task.task_key}
                          />
                        ))}
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          {t('mp_no_tasks')}
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                      <Gift className="h-5 w-5 text-primary" />
                      {t('mp_referral_program')}
                    </h3>
                    <ReferralCard
                      referralCode={referralData?.[0]?.referral_code || ""}
                      referralCount={referralData?.filter(r => r.status === 'completed').length || 0}
                      totalPointsEarned={referralData?.reduce((sum, r) => sum + (r.points_awarded || 0), 0) || 0}
                      onGenerateCode={handleGenerateReferralCode}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="levels" className="space-y-6">
                {loadingLevels ? (
                  <div className="text-center py-8">{t('mp_loading')}</div>
                ) : loyaltyLevels && loyaltyLevels.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-6">
                    {loyaltyLevels.map((level, index) => (
                      <LoyaltyLevelCard
                        key={level.level_key}
                        level={level as any}
                        userPoints={userPoints?.total_points || 0}
                        currentLevel={userPoints?.level || "bronze"}
                        nextLevel={loyaltyLevels[index + 1] as any}
                      />
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      {t('mp_no_levels')}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="earn" className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="border-2 border-primary/30">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Gift className="h-5 w-5 text-primary" />
                        {t('mp_earn_methods_title')}
                      </CardTitle>
                      <CardDescription>{t('mp_earn_methods_desc')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                        <p className="font-semibold">{t('mp_earn_orders_title')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('mp_earn_orders_desc', { points: pointsSettings?.points_per_order || 10 })}
                          {pointsSettings?.order_value_multiplier > 0 && (
                            <span> {t('mp_earn_orders_extra')}</span>
                          )}
                        </p>
                      </div>

                      <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                        <p className="font-semibold">{t('mp_earn_reviews_title')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('mp_earn_reviews_desc', { points: pointsSettings?.points_per_review || 5 })}
                        </p>
                      </div>

                      <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                        <p className="font-semibold">{t('mp_earn_verified_reviews_title')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('mp_earn_verified_reviews_desc', { points: pointsSettings?.points_per_verified_review || 10 })}
                        </p>
                      </div>

                      <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                        <p className="font-semibold">{t('mp_earn_ads_title')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('mp_earn_ads_desc', { points: pointsSettings?.points_per_ad || 2 })}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-green-500/30">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-green-500" />
                        {t('mp_watch_ad_title')}
                      </CardTitle>
                      <CardDescription>
                        {t('mp_watch_ad_desc', { points: pointsSettings?.points_per_ad || 2 })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                        <p className="text-muted-foreground">{t('mp_watch_ad_placeholder')}</p>
                      </div>
                      <Button className="w-full" variant="default">
                        {t('mp_watch_ad_btn')}
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        {t('mp_watch_ad_note')}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="redeem" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gift className="h-4 w-4" />
                      {t('mp_redeem_title')}
                    </CardTitle>
                    <CardDescription>
                      {t('mp_redeem_desc', { rate: pointsSettings?.points_to_coupon_rate || 50 })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="redeemAmount">{t('mp_points_count_label')}</Label>
                      <Input
                        id="redeemAmount"
                        type="number"
                        placeholder={t('mp_points_count_placeholder')}
                        value={redeemAmount}
                        onChange={(e) => setRedeemAmount(e.target.value)}
                      />
                      {redeemAmount && (
                        <p className="text-sm text-muted-foreground mt-2">
                          = {(parseFloat(redeemAmount) / (pointsSettings?.points_to_coupon_rate || 50)).toFixed(2)} {t('mp_iqd')}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={handleRedeemToCoupon}
                      disabled={redeemToCoupon.isPending || !redeemAmount}
                      className="w-full"
                    >
                      {redeemToCoupon.isPending ? t('mp_redeem_loading') : t('mp_redeem_btn')}
                      <ArrowRight className="mx-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="convert" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      {t('mp_convert_title')}
                    </CardTitle>
                    <CardDescription>
                      {t('mp_convert_desc', { rate: pointsSettings?.points_to_money_rate || 100 })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="convertAmount">{t('mp_points_count_label')}</Label>
                      <Input
                        id="convertAmount"
                        type="number"
                        placeholder={t('mp_points_count_placeholder')}
                        value={convertAmount}
                        onChange={(e) => setConvertAmount(e.target.value)}
                      />
                      {convertAmount && (
                        <p className="text-sm text-muted-foreground mt-2">
                          = {(parseFloat(convertAmount) / (pointsSettings?.points_to_money_rate || 100)).toFixed(2)} {t('mp_iqd')}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={handleConvertToMoney}
                      disabled={convertToMoney.isPending || !convertAmount}
                      className="w-full"
                    >
                      {convertToMoney.isPending ? t('mp_convert_loading') : t('mp_convert_btn')}
                      <ArrowRight className="mx-2 h-4 w-4" />
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      {t('mp_convert_note')}
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('mp_history_title')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingTransactions ? (
                      <p className="text-center py-4">{t('mp_loading')}</p>
                    ) : transactions && transactions.length > 0 ? (
                      <div className="space-y-4">
                        {transactions.map((transaction) => (
                          <div
                            key={transaction.id}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div className="flex-1">
                              <p className="font-medium">{transaction.description}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(transaction.created_at), 'PPP - p', { locale: dateLocale })}
                              </p>
                            </div>
                            <div
                              className={`text-xl font-bold ${
                                transaction.type === "earned"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {transaction.type === "earned" ? "+" : ""}
                              {transaction.points}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">
                        {t('mp_no_transactions')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
