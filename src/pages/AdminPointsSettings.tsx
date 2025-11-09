import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, Save } from "lucide-react";

export default function AdminPointsSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [pointsPerOrder, setPointsPerOrder] = useState("10");
  const [pointsPerReview, setPointsPerReview] = useState("5");
  const [pointsPerAd, setPointsPerAd] = useState("2");
  const [pointsPerVerifiedReview, setPointsPerVerifiedReview] = useState("10");
  const [orderValueMultiplier, setOrderValueMultiplier] = useState("0");
  const [pointsToMoneyRate, setPointsToMoneyRate] = useState("100");
  const [pointsToCouponRate, setPointsToCouponRate] = useState("50");

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      if (!data) {
        navigate("/");
        toast.error("غير مصرح لك بالوصول إلى هذه الصفحة");
      }
    };

    checkAdmin();
  }, [user, navigate]);

  // جلب إعدادات النقاط
  const { data: pointsSettings, isLoading } = useQuery({
    queryKey: ["pointsSettings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("default_settings")
        .select("*")
        .eq("setting_key", "points_settings")
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  useEffect(() => {
    if (pointsSettings?.setting_value) {
      const settings = pointsSettings.setting_value as any;
      setPointsPerOrder(settings.points_per_order?.toString() || "10");
      setPointsPerReview(settings.points_per_review?.toString() || "5");
      setPointsPerAd(settings.points_per_ad?.toString() || "2");
      setPointsPerVerifiedReview(settings.points_per_verified_review?.toString() || "10");
      setOrderValueMultiplier(settings.order_value_multiplier?.toString() || "0");
      setPointsToMoneyRate(settings.points_to_money_rate?.toString() || "100");
      setPointsToCouponRate(settings.points_to_coupon_rate?.toString() || "50");
    }
  }, [pointsSettings]);

  // حفظ الإعدادات
  const saveSettings = useMutation({
    mutationFn: async () => {
      const settingsValue = {
        points_per_order: parseFloat(pointsPerOrder),
        points_per_review: parseFloat(pointsPerReview),
        points_per_ad: parseFloat(pointsPerAd),
        points_per_verified_review: parseFloat(pointsPerVerifiedReview),
        order_value_multiplier: parseFloat(orderValueMultiplier),
        points_to_money_rate: parseFloat(pointsToMoneyRate),
        points_to_coupon_rate: parseFloat(pointsToCouponRate),
      };

      if (pointsSettings) {
        const { error } = await supabase
          .from("default_settings")
          .update({ setting_value: settingsValue })
          .eq("setting_key", "points_settings");

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("default_settings")
          .insert({
            setting_key: "points_settings",
            setting_value: settingsValue,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pointsSettings"] });
      toast.success("تم حفظ الإعدادات بنجاح");
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ أثناء حفظ الإعدادات");
    },
  });

  const handleSave = () => {
    const order = parseFloat(pointsPerOrder);
    const review = parseFloat(pointsPerReview);
    const ad = parseFloat(pointsPerAd);
    const verifiedReview = parseFloat(pointsPerVerifiedReview);
    const orderMultiplier = parseFloat(orderValueMultiplier);
    const moneyRate = parseFloat(pointsToMoneyRate);
    const couponRate = parseFloat(pointsToCouponRate);

    if (isNaN(order) || order < 0) {
      toast.error("الرجاء إدخال عدد نقاط صحيح للطلب");
      return;
    }
    if (isNaN(review) || review < 0) {
      toast.error("الرجاء إدخال عدد نقاط صحيح للتقييم");
      return;
    }
    if (isNaN(ad) || ad < 0) {
      toast.error("الرجاء إدخال عدد نقاط صحيح للإعلان");
      return;
    }
    if (isNaN(verifiedReview) || verifiedReview < 0) {
      toast.error("الرجاء إدخال عدد نقاط صحيح لتقييم الطلب");
      return;
    }
    if (isNaN(orderMultiplier) || orderMultiplier < 0) {
      toast.error("الرجاء إدخال معامل صحيح لقيمة الطلب");
      return;
    }
    if (isNaN(moneyRate) || moneyRate <= 0) {
      toast.error("الرجاء إدخال نسبة تحويل صحيحة للأموال");
      return;
    }
    if (isNaN(couponRate) || couponRate <= 0) {
      toast.error("الرجاء إدخال نسبة تحويل صحيحة للكوبونات");
      return;
    }

    saveSettings.mutate();
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Settings className="h-8 w-8" />
            إعدادات نظام النقاط
          </h1>
          <p className="text-muted-foreground">إدارة إعدادات المكافآت والنقاط</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">جاري التحميل...</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>نقاط الكسب الأساسية</CardTitle>
                <CardDescription>عدد النقاط التي يحصل عليها المستخدم</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="pointsPerOrder">نقاط ثابتة لكل طلب</Label>
                  <Input
                    id="pointsPerOrder"
                    type="number"
                    min="0"
                    step="1"
                    value={pointsPerOrder}
                    onChange={(e) => setPointsPerOrder(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    نقاط ثابتة عند تسليم الطلب بنجاح
                  </p>
                </div>

                <div>
                  <Label htmlFor="orderValueMultiplier">نقاط إضافية حسب قيمة الطلب</Label>
                  <Input
                    id="orderValueMultiplier"
                    type="number"
                    min="0"
                    step="0.01"
                    value={orderValueMultiplier}
                    onChange={(e) => setOrderValueMultiplier(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    معامل النقاط حسب قيمة الطلب (مثال: 0.01 = 1 نقطة لكل 100 دينار)
                  </p>
                </div>

                <div>
                  <Label htmlFor="pointsPerReview">نقاط لكل تقييم عادي</Label>
                  <Input
                    id="pointsPerReview"
                    type="number"
                    min="0"
                    step="1"
                    value={pointsPerReview}
                    onChange={(e) => setPointsPerReview(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    نقاط عند كتابة تقييم لأي منتج
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>نقاط الكسب المتقدمة</CardTitle>
                <CardDescription>طرق إضافية لكسب النقاط</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="pointsPerVerifiedReview">نقاط لتقييم الطلب المؤكد</Label>
                  <Input
                    id="pointsPerVerifiedReview"
                    type="number"
                    min="0"
                    step="1"
                    value={pointsPerVerifiedReview}
                    onChange={(e) => setPointsPerVerifiedReview(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    نقاط عند تقييم طلب تم تأكيد استلامه من الإدارة
                  </p>
                </div>

                <div>
                  <Label htmlFor="pointsPerAd">نقاط لكل إعلان</Label>
                  <Input
                    id="pointsPerAd"
                    type="number"
                    min="0"
                    step="1"
                    value={pointsPerAd}
                    onChange={(e) => setPointsPerAd(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    نقاط عند مشاهدة إعلان كامل
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>نسب التحويل</CardTitle>
                <CardDescription>معدلات تحويل النقاط إلى قيمة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="pointsToMoneyRate">نقاط = 1 دينار عراقي (نقدي)</Label>
                  <Input
                    id="pointsToMoneyRate"
                    type="number"
                    min="1"
                    step="1"
                    value={pointsToMoneyRate}
                    onChange={(e) => setPointsToMoneyRate(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    مثال: 100 نقطة = 1 دينار عراقي نقدي
                  </p>
                </div>

                <div>
                  <Label htmlFor="pointsToCouponRate">نقاط = 1 دينار عراقي (كوبون)</Label>
                  <Input
                    id="pointsToCouponRate"
                    type="number"
                    min="1"
                    step="1"
                    value={pointsToCouponRate}
                    onChange={(e) => setPointsToCouponRate(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    مثال: 50 نقطة = 1 دينار عراقي كوبون
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>معاينة الإعدادات</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg mb-3">طرق كسب النقاط:</h3>
                  <p>✓ طلب ناجح = {pointsPerOrder} نقطة ثابتة</p>
                  {parseFloat(orderValueMultiplier) > 0 && (
                    <p>✓ نقاط إضافية = {orderValueMultiplier} × قيمة الطلب</p>
                  )}
                  <p>✓ تقييم عادي = {pointsPerReview} نقطة</p>
                  <p>✓ تقييم طلب مؤكد = {pointsPerVerifiedReview} نقطة</p>
                  <p>✓ مشاهدة إعلان = {pointsPerAd} نقطة</p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg mb-3">تحويل النقاط:</h3>
                  <p>✓ كل {pointsToMoneyRate} نقطة = 1 دينار عراقي نقدي</p>
                  <p>✓ كل {pointsToCouponRate} نقطة = 1 دينار عراقي كوبون</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saveSettings.isPending}
            size="lg"
            className="gap-2"
          >
            <Save className="h-5 w-5" />
            {saveSettings.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
          </Button>
        </div>
      </main>
    </div>
  );
}