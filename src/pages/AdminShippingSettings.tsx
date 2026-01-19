import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Ship, Plane, Save, Loader2, Package, DollarSign, Percent, Calculator } from "lucide-react";
import AdminLayout, { AdminSection, AdminCard, AdminCardHeader, AdminCardContent, AdminLoading } from "@/components/admin/AdminLayout";

interface ShippingSetting {
  id: string;
  setting_key: string;
  setting_value: number;
  description_ar: string | null;
}

export default function AdminShippingSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<Record<string, number>>({
    sea_cbm_price: 350000,
    sea_padding_cm: 5,
    air_usa_kg_price: 30000,
    air_usa_weight_buffer_percent: 20,
    air_china_volumetric_price: 15000,
    air_china_volumetric_divider: 5000,
    air_china_weight_safety_margin: 20,
    commission_fee: 1000,
    local_delivery_baghdad: 6000,
    local_delivery_provinces: 5000,
    usd_to_iqd_rate: 1410,
  });

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

  // Fetch settings
  const { data: shippingSettings, isLoading } = useQuery({
    queryKey: ["shipping-settings-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_settings")
        .select("*");
      if (error) throw error;
      return data as ShippingSetting[];
    },
  });

  // Load settings into state
  useEffect(() => {
    if (shippingSettings) {
      const newSettings: Record<string, number> = {};
      shippingSettings.forEach((s) => {
        newSettings[s.setting_key] = Number(s.setting_value);
      });
      setSettings((prev) => ({ ...prev, ...newSettings }));
    }
  }, [shippingSettings]);

  // Save settings mutation
  const saveSettings = useMutation({
    mutationFn: async () => {
      setIsSaving(true);
      const updates = Object.entries(settings).map(([key, value]) => ({
        setting_key: key,
        setting_value: value,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("shipping_settings")
          .update({ setting_value: update.setting_value })
          .eq("setting_key", update.setting_key);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-settings-admin"] });
      queryClient.invalidateQueries({ queryKey: ["shipping-settings"] });
      toast.success("تم حفظ إعدادات الشحن بنجاح");
      setIsSaving(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ أثناء حفظ الإعدادات");
      setIsSaving(false);
    },
  });

  const updateSetting = (key: string, value: number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return <AdminLoading />;
  }

  return (
    <AdminLayout
      title="إعدادات الشحن"
      description="إدارة أسعار وإعدادات حساب الشحن"
      icon={<Package className="h-5 w-5" />}
      actions={
        <Button onClick={() => saveSettings.mutate()} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          حفظ الإعدادات
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Sea Shipping from China */}
        <AdminSection>
          <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-cyan-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-500">
                <Ship className="h-5 w-5" />
                الشحن البحري من الصين
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  سعر المتر المكعب (CBM)
                </Label>
                <Input
                  type="number"
                  value={settings.sea_cbm_price}
                  onChange={(e) => updateSetting("sea_cbm_price", Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  السعر الحالي: {settings.sea_cbm_price.toLocaleString()} دينار عراقي لكل CBM
                </p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  الهامش الإضافي للأبعاد (سم)
                </Label>
                <Input
                  type="number"
                  value={settings.sea_padding_cm}
                  onChange={(e) => updateSetting("sea_padding_cm", Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  يضاف {settings.sea_padding_cm} سم لكل بعد كاحتياط للتغليف
                </p>
              </div>
            </CardContent>
          </Card>
        </AdminSection>

        {/* Air Shipping from USA */}
        <AdminSection>
          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-pink-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-500">
                <Plane className="h-5 w-5" />
                الشحن الجوي من أمريكا
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  سعر الكيلو الواحد
                </Label>
                <Input
                  type="number"
                  value={settings.air_usa_kg_price}
                  onChange={(e) => updateSetting("air_usa_kg_price", Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  السعر الحالي: {settings.air_usa_kg_price.toLocaleString()} دينار عراقي/كغ
                </p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  نسبة الزيادة على الوزن (%)
                </Label>
                <Input
                  type="number"
                  value={settings.air_usa_weight_buffer_percent}
                  onChange={(e) => updateSetting("air_usa_weight_buffer_percent", Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  يضاف {settings.air_usa_weight_buffer_percent}% للوزن كاحتياط للتغليف
                </p>
              </div>
            </CardContent>
          </Card>
        </AdminSection>

        {/* Air Shipping from China */}
        <AdminSection>
          <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-500">
                <Plane className="h-5 w-5" />
                الشحن الجوي من الصين
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  سعر الكيلو
                </Label>
                <Input
                  type="number"
                  value={settings.air_china_volumetric_price}
                  onChange={(e) => updateSetting("air_china_volumetric_price", Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  السعر: {settings.air_china_volumetric_price.toLocaleString()} دينار/كغ
                </p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  المقسوم عليه للوزن الحجمي
                </Label>
                <Input
                  type="number"
                  value={settings.air_china_volumetric_divider}
                  onChange={(e) => updateSetting("air_china_volumetric_divider", Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  الوزن الحجمي = (ط × ع × ا) ÷ {settings.air_china_volumetric_divider}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  نسبة الاحتياط (%)
                </Label>
                <Input
                  type="number"
                  value={settings.air_china_weight_safety_margin}
                  onChange={(e) => updateSetting("air_china_weight_safety_margin", Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  يضاف {settings.air_china_weight_safety_margin}% للوزن المستخدم
                </p>
              </div>
            </CardContent>
            <div className="px-6 pb-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 text-sm">
                <p className="text-amber-800 dark:text-amber-200">
                  <strong>ملاحظة:</strong> يتم استخدام الوزن الأكبر (الحجمي أو الفعلي) ثم يضاف إليه نسبة الاحتياط
                </p>
              </div>
            </div>
          </Card>
        </AdminSection>

        {/* Currency Settings */}
        <AdminSection>
          <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-emerald-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-500">
                <DollarSign className="h-5 w-5" />
                إعدادات العملة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-w-md">
                <Label className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  سعر الدولار بالدينار العراقي
                </Label>
                <Input
                  type="number"
                  value={settings.usd_to_iqd_rate}
                  onChange={(e) => updateSetting("usd_to_iqd_rate", Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  1 دولار = {settings.usd_to_iqd_rate.toLocaleString()} دينار عراقي (يستخدم في حساب سعر المنتج بالذكاء الاصطناعي)
                </p>
              </div>
            </CardContent>
          </Card>
        </AdminSection>

        {/* General Settings */}
        <AdminSection>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                الإعدادات العامة
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>عمولتنا (تظهر منفصلة للزبون)</Label>
                <Input
                  type="number"
                  value={settings.commission_fee}
                  onChange={(e) => updateSetting("commission_fee", Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  تظهر منفصلة عن تكلفة الشحن باسم "عمولتنا"
                </p>
              </div>
              <div className="space-y-2">
                <Label>تكلفة التوصيل - بغداد</Label>
                <Input
                  type="number"
                  value={settings.local_delivery_baghdad}
                  onChange={(e) => updateSetting("local_delivery_baghdad", Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  تكلفة التوصيل داخل بغداد
                </p>
              </div>
              <div className="space-y-2">
                <Label>تكلفة التوصيل - المحافظات</Label>
                <Input
                  type="number"
                  value={settings.local_delivery_provinces}
                  onChange={(e) => updateSetting("local_delivery_provinces", Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  تكلفة التوصيل للمحافظات الأخرى
                </p>
              </div>
            </CardContent>
          </Card>
        </AdminSection>

        {/* Formula Explanation */}
        <AdminSection>
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base">معادلات الحساب</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="p-3 rounded-lg bg-background border">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Ship className="h-4 w-4 text-blue-500" />
                  الشحن البحري (الصين فقط)
                </h4>
                <code className="text-xs block bg-muted p-2 rounded">
                  CBM = ((الطول + {settings.sea_padding_cm}) × (العرض + {settings.sea_padding_cm}) × (الارتفاع + {settings.sea_padding_cm})) ÷ 1,000,000
                  <br />
                  تكلفة الشحن = CBM × {settings.sea_cbm_price.toLocaleString()} + {settings.commission_fee.toLocaleString()} عمولة
                </code>
              </div>
              <div className="p-3 rounded-lg bg-background border">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Plane className="h-4 w-4 text-purple-500" />
                  الشحن الجوي (أمريكا)
                </h4>
                <code className="text-xs block bg-muted p-2 rounded">
                  الوزن الفعلي = الوزن × (1 + {settings.air_usa_weight_buffer_percent}%)
                  <br />
                  تكلفة الشحن = الوزن الفعلي × {settings.air_usa_kg_price.toLocaleString()} + {settings.commission_fee.toLocaleString()} عمولة
                </code>
              </div>
              <div className="p-3 rounded-lg bg-background border">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Plane className="h-4 w-4 text-orange-500" />
                  الشحن الجوي (الصين)
                </h4>
                <code className="text-xs block bg-muted p-2 rounded">
                  الوزن الحجمي = ((الطول + {settings.sea_padding_cm}) × (العرض + {settings.sea_padding_cm}) × (الارتفاع + {settings.sea_padding_cm})) ÷ {settings.air_china_volumetric_divider}
                  <br />
                  الوزن المستخدم = الأكبر من (الوزن الحجمي، الوزن الفعلي)
                  <br />
                  الوزن مع الاحتياط = الوزن المستخدم × (1 + {settings.air_china_weight_safety_margin}%)
                  <br />
                  تكلفة الشحن = الوزن مع الاحتياط × {settings.air_china_volumetric_price.toLocaleString()}
                  <br />
                  <span className="text-primary">+ عمولتنا: {settings.commission_fee.toLocaleString()} دينار (منفصلة)</span>
                </code>
              </div>
              <div className="p-3 rounded-lg bg-background border">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  تحويل سعر المنتج (الذكاء الاصطناعي)
                </h4>
                <code className="text-xs block bg-muted p-2 rounded">
                  سعر المنتج بالدينار = سعر المنتج بالدولار × {settings.usd_to_iqd_rate.toLocaleString()}
                </code>
              </div>
            </CardContent>
          </Card>
        </AdminSection>
      </div>
    </AdminLayout>
  );
}
