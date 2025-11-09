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
import { Settings, Save, Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function AdminPointsSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [earningMethods, setEarningMethods] = useState<Array<{
    key: string;
    label: string;
    value: string;
  }>>([
    { key: 'points_per_order', label: 'نقاط ثابتة لكل طلب', value: '10' },
    { key: 'points_per_review', label: 'نقاط لكل تقييم عادي', value: '5' },
    { key: 'points_per_verified_review', label: 'نقاط لتقييم الطلب المؤكد', value: '10' },
    { key: 'points_per_ad', label: 'نقاط لكل إعلان', value: '2' },
  ]);
  
  const [orderValueMultiplier, setOrderValueMultiplier] = useState("0");
  const [pointsToMoneyRate, setPointsToMoneyRate] = useState("100");
  const [pointsToCouponRate, setPointsToCouponRate] = useState("50");
  const [referrerPoints, setReferrerPoints] = useState("50");
  const [referredPoints, setReferredPoints] = useState("20");
  const [pointsEnabled, setPointsEnabled] = useState(true);

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

  // جلب إعدادات الدعوة
  const { data: referralSettings } = useQuery({
    queryKey: ["referralSettings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("default_settings")
        .select("*")
        .eq("setting_key", "referral_settings")
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  useEffect(() => {
    if (pointsSettings?.setting_value) {
      const settings = pointsSettings.setting_value as any;
      
      // تحميل طرق الكسب
      const methods = [];
      if (settings.points_per_order !== undefined) {
        methods.push({ key: 'points_per_order', label: 'نقاط ثابتة لكل طلب', value: settings.points_per_order.toString() });
      }
      if (settings.points_per_review !== undefined) {
        methods.push({ key: 'points_per_review', label: 'نقاط لكل تقييم عادي', value: settings.points_per_review.toString() });
      }
      if (settings.points_per_verified_review !== undefined) {
        methods.push({ key: 'points_per_verified_review', label: 'نقاط لتقييم الطلب المؤكد', value: settings.points_per_verified_review.toString() });
      }
      if (settings.points_per_ad !== undefined) {
        methods.push({ key: 'points_per_ad', label: 'نقاط لكل إعلان', value: settings.points_per_ad.toString() });
      }
      
      if (methods.length > 0) {
        setEarningMethods(methods);
      }
      
      setOrderValueMultiplier(settings.order_value_multiplier?.toString() || "0");
      setPointsToMoneyRate(settings.points_to_money_rate?.toString() || "100");
      setPointsToCouponRate(settings.points_to_coupon_rate?.toString() || "50");
      setPointsEnabled(settings.points_enabled !== undefined ? settings.points_enabled : true);
    }
  }, [pointsSettings]);

  useEffect(() => {
    if (referralSettings?.setting_value) {
      const settings = referralSettings.setting_value as any;
      setReferrerPoints(settings.points_for_referrer?.toString() || "50");
      setReferredPoints(settings.points_for_referred?.toString() || "20");
    }
  }, [referralSettings]);

  // حفظ الإعدادات
  const saveSettings = useMutation({
    mutationFn: async () => {
      const settingsValue: any = {
        points_enabled: pointsEnabled,
        order_value_multiplier: parseFloat(orderValueMultiplier),
        points_to_money_rate: parseFloat(pointsToMoneyRate),
        points_to_coupon_rate: parseFloat(pointsToCouponRate),
      };
      
      // إضافة طرق الكسب
      earningMethods.forEach(method => {
        settingsValue[method.key] = parseFloat(method.value);
      });

      // حفظ إعدادات النقاط
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

      // حفظ إعدادات الدعوة
      const referralSettingsValue = {
        points_for_referrer: parseFloat(referrerPoints),
        points_for_referred: parseFloat(referredPoints),
      };

      if (referralSettings) {
        const { error } = await supabase
          .from("default_settings")
          .update({ setting_value: referralSettingsValue })
          .eq("setting_key", "referral_settings");

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("default_settings")
          .insert({
            setting_key: "referral_settings",
            setting_value: referralSettingsValue,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pointsSettings"] });
      queryClient.invalidateQueries({ queryKey: ["referralSettings"] });
      toast.success("تم حفظ الإعدادات بنجاح");
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ أثناء حفظ الإعدادات");
    },
  });

  const handleSave = () => {
    // التحقق من طرق الكسب
    for (const method of earningMethods) {
      const value = parseFloat(method.value);
      if (isNaN(value) || value < 0) {
        toast.error(`الرجاء إدخال قيمة صحيحة لـ ${method.label}`);
        return;
      }
    }
    
    const orderMultiplier = parseFloat(orderValueMultiplier);
    const moneyRate = parseFloat(pointsToMoneyRate);
    const couponRate = parseFloat(pointsToCouponRate);

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

    const refererPts = parseFloat(referrerPoints);
    const referedPts = parseFloat(referredPoints);
    
    if (isNaN(refererPts) || refererPts < 0) {
      toast.error("الرجاء إدخال قيمة صحيحة لنقاط المُحيل");
      return;
    }
    if (isNaN(referedPts) || referedPts < 0) {
      toast.error("الرجاء إدخال قيمة صحيحة لنقاط المُحال");
      return;
    }

    saveSettings.mutate();
  };
  
  const addEarningMethod = () => {
    setEarningMethods([...earningMethods, { key: `custom_${Date.now()}`, label: '', value: '0' }]);
  };
  
  const removeEarningMethod = (index: number) => {
    setEarningMethods(earningMethods.filter((_, i) => i !== index));
  };
  
  const updateEarningMethod = (index: number, field: 'label' | 'value', newValue: string) => {
    const updated = [...earningMethods];
    updated[index][field] = newValue;
    setEarningMethods(updated);
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
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>تفعيل/تعطيل نظام النقاط</CardTitle>
                <CardDescription>التحكم في تشغيل نظام النقاط بالكامل</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="points-enabled" className="text-base font-medium">
                      حالة نظام النقاط
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {pointsEnabled ? "النظام مفعّل حالياً - يمكن للمستخدمين كسب واستخدام النقاط" : "النظام معطّل حالياً - لن يتمكن المستخدمون من كسب أو استخدام النقاط"}
                    </p>
                  </div>
                  <Switch
                    id="points-enabled"
                    checked={pointsEnabled}
                    onCheckedChange={setPointsEnabled}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>طرق كسب النقاط</span>
                  <Button onClick={addEarningMethod} size="sm" variant="outline">
                    <Plus className="h-4 w-4 ml-2" />
                    إضافة طريقة
                  </Button>
                </CardTitle>
                <CardDescription>إدارة طرق كسب النقاط المختلفة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {earningMethods.map((method, index) => (
                  <div key={method.key} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-2">
                      <Label>الوصف</Label>
                      <Input
                        value={method.label}
                        onChange={(e) => updateEarningMethod(index, 'label', e.target.value)}
                        placeholder="مثال: نقاط لكل طلب"
                      />
                    </div>
                    <div className="w-32 space-y-2">
                      <Label>النقاط</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={method.value}
                        onChange={(e) => updateEarningMethod(index, 'value', e.target.value)}
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => removeEarningMethod(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <div className="pt-4 border-t">
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

            <Card>
              <CardHeader>
                <CardTitle>إعدادات برنامج الدعوة</CardTitle>
                <CardDescription>إدارة نقاط دعوة الأصدقاء</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="referrerPoints">نقاط المُحيل (من يدعو)</Label>
                  <Input
                    id="referrerPoints"
                    type="number"
                    min="0"
                    step="1"
                    value={referrerPoints}
                    onChange={(e) => setReferrerPoints(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    النقاط التي يحصل عليها المستخدم عند دعوة صديق
                  </p>
                </div>

                <div>
                  <Label htmlFor="referredPoints">نقاط المُحال (المدعو)</Label>
                  <Input
                    id="referredPoints"
                    type="number"
                    min="0"
                    step="1"
                    value={referredPoints}
                    onChange={(e) => setReferredPoints(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    النقاط التي يحصل عليها المستخدم الجديد عند التسجيل بكود دعوة
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>معاينة الإعدادات</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg mb-3">طرق كسب النقاط:</h3>
                  {earningMethods.map(method => (
                    <p key={method.key}>✓ {method.label} = {method.value} نقطة</p>
                  ))}
                  {parseFloat(orderValueMultiplier) > 0 && (
                    <p>✓ نقاط إضافية = {orderValueMultiplier} × قيمة الطلب</p>
                  )}
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg mb-3">تحويل النقاط:</h3>
                  <p>✓ كل {pointsToMoneyRate} نقطة = 1 دينار عراقي نقدي</p>
                  <p>✓ كل {pointsToCouponRate} نقطة = 1 دينار عراقي كوبون</p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg mb-3">برنامج الدعوة:</h3>
                  <p>✓ المُحيل يحصل على {referrerPoints} نقطة</p>
                  <p>✓ المُحال يحصل على {referredPoints} نقطة</p>
                </div>
              </CardContent>
            </Card>
            </div>
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