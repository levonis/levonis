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
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoyaltyLevelCard from "@/components/LoyaltyLevelCard";
import DailyTaskCard from "@/components/DailyTaskCard";
import ReferralCard from "@/components/ReferralCard";

export default function MyPoints() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [redeemAmount, setRedeemAmount] = useState("");
  const [convertAmount, setConvertAmount] = useState("");
  const [completingTask, setCompletingTask] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  // جلب رصيد النقاط
  const { data: userPoints, isLoading: loadingPoints } = useQuery({
    queryKey: ["userPoints", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("user_points")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // جلب المعاملات
  const { data: transactions, isLoading: loadingTransactions } = useQuery({
    queryKey: ["pointsTransactions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("points_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // جلب إعدادات النقاط
  const { data: pointsSettings } = useQuery({
    queryKey: ["pointsSettings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("default_settings")
        .select("setting_value")
        .eq("setting_key", "points_settings")
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      const settings = data?.setting_value as any || { 
        points_per_order: 10, 
        points_per_review: 5,
        points_to_money_rate: 100,
        points_to_coupon_rate: 50
      };
      return settings;
    },
  });

  // جلب المستويات
  const { data: loyaltyLevels, isLoading: loadingLevels } = useQuery({
    queryKey: ["loyaltyLevels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_levels")
        .select("*")
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  // جلب المهام اليومية
  const { data: dailyTasks, isLoading: loadingTasks } = useQuery({
    queryKey: ["dailyTasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_tasks")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  // جلب المهام المكتملة اليوم
  const { data: completedTasks, refetch: refetchCompletedTasks } = useQuery({
    queryKey: ["completedTasks", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_task_completions")
        .select("*")
        .eq("user_id", user.id)
        .gte("completed_at", new Date().toISOString().split('T')[0]);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // جلب كود الدعوة
  const { data: referralData, refetch: refetchReferral } = useQuery({
    queryKey: ["referralCode", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("user_referrals")
        .select("referral_code, status, points_awarded")
        .eq("referrer_user_id", user.id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // تحويل النقاط إلى كوبون
  const redeemToCoupon = useMutation({
    mutationFn: async (points: number) => {
      if (!user?.id) throw new Error("User not found");
      if (!userPoints || userPoints.available_points < points) {
        throw new Error("رصيد نقاط غير كافٍ");
      }

      const couponValue = points / (pointsSettings?.points_to_coupon_rate || 50);
      
      // إنشاء كوبون
      const couponCode = `POINTS-${Date.now()}`;
      const { error: couponError } = await supabase
        .from("coupons")
        .insert({
          code: couponCode,
          discount_type: "fixed",
          discount_value: couponValue,
          max_uses: 1,
          current_uses: 0,
          active: true,
        });

      if (couponError) throw couponError;

      // تحديث النقاط
      const { error: pointsError } = await supabase
        .from("user_points")
        .update({
          available_points: userPoints.available_points - points,
          redeemed_points: userPoints.redeemed_points + points,
        })
        .eq("user_id", user.id);

      if (pointsError) throw pointsError;

      // إضافة معاملة
      await supabase.from("points_transactions").insert({
        user_id: user.id,
        points: -points,
        type: "redeemed",
        source: "coupon",
        description: `تحويل ${points} نقطة إلى كوبون بقيمة ${couponValue} دينار عراقي`,
      });

      return couponCode;
    },
    onSuccess: (couponCode) => {
      queryClient.invalidateQueries({ queryKey: ["userPoints"] });
      queryClient.invalidateQueries({ queryKey: ["pointsTransactions"] });
      toast.success(`تم إنشاء الكوبون بنجاح: ${couponCode}`);
      setRedeemAmount("");
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ أثناء تحويل النقاط");
    },
  });

  // تحويل النقاط إلى أموال
  const convertToMoney = useMutation({
    mutationFn: async (points: number) => {
      if (!user?.id) throw new Error("User not found");
      if (!userPoints || userPoints.available_points < points) {
        throw new Error("رصيد نقاط غير كافٍ");
      }

      const moneyValue = points / (pointsSettings?.points_to_money_rate || 100);

      // تحديث النقاط
      const { error: pointsError } = await supabase
        .from("user_points")
        .update({
          available_points: userPoints.available_points - points,
          redeemed_points: userPoints.redeemed_points + points,
        })
        .eq("user_id", user.id);

      if (pointsError) throw pointsError;

      // إضافة معاملة
      await supabase.from("points_transactions").insert({
        user_id: user.id,
        points: -points,
        type: "converted",
        source: "cash",
        description: `تحويل ${points} نقطة إلى ${moneyValue} دينار عراقي`,
      });

      return moneyValue;
    },
    onSuccess: (moneyValue) => {
      queryClient.invalidateQueries({ queryKey: ["userPoints"] });
      queryClient.invalidateQueries({ queryKey: ["pointsTransactions"] });
      toast.success(`تم طلب تحويل النقاط إلى ${moneyValue} دينار عراقي. سيتم التواصل معك قريباً.`);
      setConvertAmount("");
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ أثناء تحويل النقاط");
    },
  });

  const handleRedeemToCoupon = () => {
    const points = parseFloat(redeemAmount);
    if (isNaN(points) || points <= 0) {
      toast.error("الرجاء إدخال عدد نقاط صحيح");
      return;
    }
    redeemToCoupon.mutate(points);
  };

  const handleConvertToMoney = () => {
    const points = parseFloat(convertAmount);
    if (isNaN(points) || points <= 0) {
      toast.error("الرجاء إدخال عدد نقاط صحيح");
      return;
    }
    convertToMoney.mutate(points);
  };

  // إكمال مهمة يومية
  const handleCompleteTask = async (taskKey: string) => {
    if (!user?.id) return;
    
    setCompletingTask(taskKey);
    try {
      const { data, error } = await supabase.rpc("complete_daily_task", {
        task_key_param: taskKey,
      });

      if (error) throw error;

      const result = data as any;
      if (result.success) {
        toast.success(`تم إكمال المهمة! حصلت على ${result.points_earned} نقطة`);
        queryClient.invalidateQueries({ queryKey: ["userPoints"] });
        queryClient.invalidateQueries({ queryKey: ["pointsTransactions"] });
        refetchCompletedTasks();
      } else {
        toast.error(result.error || "حدث خطأ");
      }
    } catch (error: any) {
      toast.error(error.message || "حدث خطأ أثناء إكمال المهمة");
    } finally {
      setCompletingTask(null);
    }
  };

  // إنشاء كود دعوة
  const handleGenerateReferralCode = async () => {
    if (!user?.id) return;

    try {
      const { data: codeData } = await supabase.rpc("generate_referral_code");
      
      const { error } = await supabase
        .from("user_referrals")
        .insert({
          referrer_user_id: user.id,
          referral_code: codeData as string,
        });

      if (error) throw error;

      toast.success("تم إنشاء كود الدعوة بنجاح!");
      refetchReferral();
    } catch (error: any) {
      toast.error(error.message || "حدث خطأ أثناء إنشاء كود الدعوة");
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">النقاط</h1>
          <p className="text-muted-foreground">إدارة نقاط المكافآت الخاصة بك</p>
        </div>

        {loadingPoints ? (
          <div className="text-center py-12">جاري التحميل...</div>
        ) : (
          <>
            {/* رصيد النقاط */}
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="h-5 w-5" />
                    النقاط المتاحة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold">{userPoints?.available_points || 0}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    إجمالي النقاط
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold">{userPoints?.total_points || 0}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="h-5 w-5" />
                    النقاط المستخدمة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold">{userPoints?.redeemed_points || 0}</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border-yellow-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    مستواك
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold capitalize">
                    {loyaltyLevels?.find(l => l.level_key === userPoints?.level)?.name_ar || "برونزي"}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="tasks" className="space-y-6">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="tasks">المهام</TabsTrigger>
                <TabsTrigger value="levels">المستويات</TabsTrigger>
                <TabsTrigger value="earn">ربح النقاط</TabsTrigger>
                <TabsTrigger value="redeem">تحويل لكوبون</TabsTrigger>
                <TabsTrigger value="convert">تحويل لأموال</TabsTrigger>
                <TabsTrigger value="history">السجل</TabsTrigger>
              </TabsList>

              <TabsContent value="tasks" className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <CheckSquare className="h-5 w-5 text-primary" />
                      المهام اليومية
                    </h3>
                    {loadingTasks ? (
                      <div className="text-center py-8">جاري التحميل...</div>
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
                          لا توجد مهام متاحة حالياً
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                      <Gift className="h-5 w-5 text-primary" />
                      برنامج الدعوات
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
                  <div className="text-center py-8">جاري التحميل...</div>
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
                      لا توجد مستويات متاحة حالياً
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
                        طرق كسب النقاط
                      </CardTitle>
                      <CardDescription>اكسب نقاط إضافية بطرق متعددة</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                        <p className="font-semibold">✓ إتمام الطلبات</p>
                        <p className="text-sm text-muted-foreground">
                          احصل على {pointsSettings?.points_per_order || 10} نقطة لكل طلب يتم توصيله
                          {pointsSettings?.order_value_multiplier > 0 && (
                            <span> + نقاط إضافية حسب قيمة الطلب</span>
                          )}
                        </p>
                      </div>

                      <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                        <p className="font-semibold">✓ كتابة التقييمات</p>
                        <p className="text-sm text-muted-foreground">
                          احصل على {pointsSettings?.points_per_review || 5} نقطة لكل تقييم تكتبه
                        </p>
                      </div>

                      <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                        <p className="font-semibold">✓ تقييم الطلبات المؤكدة</p>
                        <p className="text-sm text-muted-foreground">
                          احصل على {pointsSettings?.points_per_verified_review || 10} نقطة عند تقييم طلب مؤكد من الإدارة
                        </p>
                      </div>

                      <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                        <p className="font-semibold">✓ مشاهدة الإعلانات</p>
                        <p className="text-sm text-muted-foreground">
                          احصل على {pointsSettings?.points_per_ad || 2} نقطة لكل إعلان تشاهده بالكامل
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-green-500/30">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-green-500" />
                        مشاهدة إعلان
                      </CardTitle>
                      <CardDescription>اكسب {pointsSettings?.points_per_ad || 2} نقطة بمشاهدة إعلان</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                        <p className="text-muted-foreground">سيتم عرض الإعلان هنا</p>
                      </div>
                      <Button className="w-full" variant="default">
                        ابدأ مشاهدة الإعلان
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        * يجب مشاهدة الإعلان بالكامل للحصول على النقاط
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="redeem" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gift className="h-5 w-5" />
                      تحويل النقاط إلى كوبون
                    </CardTitle>
                    <CardDescription>
                      كل {pointsSettings?.points_to_coupon_rate || 50} نقطة = 1 دينار عراقي
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="redeemAmount">عدد النقاط</Label>
                      <Input
                        id="redeemAmount"
                        type="number"
                        placeholder="أدخل عدد النقاط"
                        value={redeemAmount}
                        onChange={(e) => setRedeemAmount(e.target.value)}
                      />
                      {redeemAmount && (
                        <p className="text-sm text-muted-foreground mt-2">
                          = {(parseFloat(redeemAmount) / (pointsSettings?.points_to_coupon_rate || 50)).toFixed(2)} دينار عراقي
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={handleRedeemToCoupon}
                      disabled={redeemToCoupon.isPending || !redeemAmount}
                      className="w-full"
                    >
                      {redeemToCoupon.isPending ? "جاري التحويل..." : "تحويل إلى كوبون"}
                      <ArrowRight className="mr-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="convert" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      تحويل النقاط إلى أموال
                    </CardTitle>
                    <CardDescription>
                      كل {pointsSettings?.points_to_money_rate || 100} نقطة = 1 دينار عراقي
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="convertAmount">عدد النقاط</Label>
                      <Input
                        id="convertAmount"
                        type="number"
                        placeholder="أدخل عدد النقاط"
                        value={convertAmount}
                        onChange={(e) => setConvertAmount(e.target.value)}
                      />
                      {convertAmount && (
                        <p className="text-sm text-muted-foreground mt-2">
                          = {(parseFloat(convertAmount) / (pointsSettings?.points_to_money_rate || 100)).toFixed(2)} دينار عراقي
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={handleConvertToMoney}
                      disabled={convertToMoney.isPending || !convertAmount}
                      className="w-full"
                    >
                      {convertToMoney.isPending ? "جاري التحويل..." : "طلب تحويل إلى أموال"}
                      <ArrowRight className="mr-2 h-4 w-4" />
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      * سيتم التواصل معك من قبل الإدارة لإتمام عملية التحويل
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>سجل المعاملات</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingTransactions ? (
                      <p className="text-center py-4">جاري التحميل...</p>
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
                                {new Date(transaction.created_at).toLocaleDateString("ar-IQ", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
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
                        لا توجد معاملات بعد
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
      
      <Footer />
    </div>
  );
}