import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import AdminLayout from "@/components/admin/AdminLayout";
import { ADMIN_ROUTES } from "@/config/adminConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, Crown, Diamond, Gem, Medal, Save, Sparkles, Info } from "lucide-react";

const SETTING_KEY = "merchant_badge_thresholds";

const thresholdsSchema = z.object({
  silver_min: z.number().min(1),
  silver_max: z.number().min(1),
  gold_min: z.number().min(1),
  gold_max: z.number().min(1),
  diamond_1_min: z.number().min(1),
  diamond_2_min: z.number().min(1),
  diamond_2_months: z.number().min(1),
  diamond_3_min: z.number().min(1),
  diamond_3_months: z.number().min(1),
  diamond_4_min: z.number().min(1),
  diamond_4_months: z.number().min(1),
  emerald_min: z.number().min(1),
  emerald_months: z.number().min(1),
});

type Thresholds = z.infer<typeof thresholdsSchema>;

const defaultThresholds: Thresholds = {
  silver_min: 11,
  silver_max: 50,
  gold_min: 51,
  gold_max: 100,
  diamond_1_min: 101,
  diamond_2_min: 500,
  diamond_2_months: 2,
  diamond_3_min: 1000,
  diamond_3_months: 2,
  diamond_4_min: 2000,
  diamond_4_months: 2,
  emerald_min: 3000,
  emerald_months: 2,
};

const tierIcons: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  silver: { icon: <Medal className="h-5 w-5" />, color: "text-slate-500", bgColor: "bg-slate-100" },
  gold: { icon: <Crown className="h-5 w-5" />, color: "text-amber-500", bgColor: "bg-amber-100" },
  diamond_1: { icon: <Diamond className="h-5 w-5" />, color: "text-sky-500", bgColor: "bg-sky-100" },
  diamond_2: { icon: <Diamond className="h-5 w-5" />, color: "text-sky-600", bgColor: "bg-sky-100" },
  diamond_3: { icon: <Diamond className="h-5 w-5" />, color: "text-indigo-500", bgColor: "bg-indigo-100" },
  diamond_4: { icon: <Diamond className="h-5 w-5" />, color: "text-indigo-600", bgColor: "bg-indigo-100" },
  emerald: { icon: <Gem className="h-5 w-5" />, color: "text-emerald-500", bgColor: "bg-emerald-100" },
};

export default function AdminBadgeSettings() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [thresholds, setThresholds] = useState<Thresholds>(defaultThresholds);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/");
      toast.error("ليس لديك صلاحية الوصول");
    }
  }, [isAdmin, authLoading, navigate]);

  const { data: savedSettings, isLoading } = useQuery({
    queryKey: ["badge-thresholds-settings"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("default_settings")
        .select("setting_value")
        .eq("setting_key", SETTING_KEY)
        .maybeSingle();

      if (error) throw error;
      return data?.setting_value as Thresholds | null;
    },
  });

  useEffect(() => {
    if (savedSettings) {
      setThresholds({ ...defaultThresholds, ...savedSettings });
    }
  }, [savedSettings]);

  const saveMutation = useMutation({
    mutationFn: async (values: Thresholds) => {
      const parsed = thresholdsSchema.parse(values);

      const { error } = await supabase
        .from("default_settings")
        .upsert(
          { setting_key: SETTING_KEY, setting_value: parsed },
          { onConflict: "setting_key" }
        );

      if (error) throw error;
      return parsed;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["badge-thresholds-settings"] });
      toast.success("تم حفظ إعدادات الشارات بنجاح");
    },
    onError: (err: any) => {
      toast.error(err?.message || "حدث خطأ أثناء الحفظ");
    },
  });

  const handleChange = (key: keyof Thresholds, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setThresholds((prev) => ({ ...prev, [key]: num }));
    }
  };

  const handleSave = () => {
    saveMutation.mutate(thresholds);
  };

  if (authLoading || !isAdmin) return null;

  return (
    <AdminLayout
      title="إعدادات الشارات"
      description="تعديل قيم عتبات شارات التجار (فضي، ذهبي، ماسي، زمردة)"
      backTo={ADMIN_ROUTES.levoCommunity}
    >
      <div className="space-y-6">
        {/* Info Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm text-foreground/80">
                <p className="font-medium mb-1">كيف تعمل الشارات؟</p>
                <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                  <li>الشارات الأساسية (فضي، ذهبي، ماسي 1) تُحسب بناءً على إجمالي الطلبات المكتملة</li>
                  <li>الشارات المتقدمة (ماسي 2-4، زمردة) تتطلب استمرارية الأداء لعدة أشهر متتالية</li>
                  <li>يتم حساب الشارات تلقائياً كل يوم في منتصف الليل</li>
                  <li>يمكن للأدمن تجاوز الحساب التلقائي لأي تاجر</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4">
            {/* Silver */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className={`h-8 w-8 rounded-xl ${tierIcons.silver.bgColor} flex items-center justify-center ${tierIcons.silver.color}`}>
                    {tierIcons.silver.icon}
                  </div>
                  شارة فضية
                  <Badge variant="outline" className="mr-auto">Silver</Badge>
                </CardTitle>
                <CardDescription>للتجار مع 11-50 طلب مكتمل</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الحد الأدنى للطلبات</Label>
                    <Input
                      type="number"
                      min={1}
                      value={thresholds.silver_min}
                      onChange={(e) => handleChange("silver_min", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الحد الأقصى للطلبات</Label>
                    <Input
                      type="number"
                      min={1}
                      value={thresholds.silver_max}
                      onChange={(e) => handleChange("silver_max", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gold */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className={`h-8 w-8 rounded-xl ${tierIcons.gold.bgColor} flex items-center justify-center ${tierIcons.gold.color}`}>
                    {tierIcons.gold.icon}
                  </div>
                  شارة ذهبية
                  <Badge variant="outline" className="mr-auto">Gold</Badge>
                </CardTitle>
                <CardDescription>للتجار مع 51-100 طلب مكتمل</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الحد الأدنى للطلبات</Label>
                    <Input
                      type="number"
                      min={1}
                      value={thresholds.gold_min}
                      onChange={(e) => handleChange("gold_min", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الحد الأقصى للطلبات</Label>
                    <Input
                      type="number"
                      min={1}
                      value={thresholds.gold_max}
                      onChange={(e) => handleChange("gold_max", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Diamond 1 */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className={`h-8 w-8 rounded-xl ${tierIcons.diamond_1.bgColor} flex items-center justify-center ${tierIcons.diamond_1.color}`}>
                    {tierIcons.diamond_1.icon}
                  </div>
                  شارة ماسية 1
                  <Badge variant="outline" className="mr-auto">Diamond 1</Badge>
                </CardTitle>
                <CardDescription>للتجار مع أكثر من 100 طلب مكتمل</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>الحد الأدنى للطلبات</Label>
                  <Input
                    type="number"
                    min={1}
                    value={thresholds.diamond_1_min}
                    onChange={(e) => handleChange("diamond_1_min", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Diamond 2 */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className={`h-8 w-8 rounded-xl ${tierIcons.diamond_2.bgColor} flex items-center justify-center ${tierIcons.diamond_2.color}`}>
                    {tierIcons.diamond_2.icon}
                  </div>
                  شارة ماسية 2
                  <Badge variant="outline" className="mr-auto">Diamond 2</Badge>
                </CardTitle>
                <CardDescription>تتطلب استمرارية الأداء لعدة أشهر</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الحد الأدنى للطلبات الشهرية</Label>
                    <Input
                      type="number"
                      min={1}
                      value={thresholds.diamond_2_min}
                      onChange={(e) => handleChange("diamond_2_min", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>عدد الأشهر المتتالية المطلوبة</Label>
                    <Input
                      type="number"
                      min={1}
                      value={thresholds.diamond_2_months}
                      onChange={(e) => handleChange("diamond_2_months", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Diamond 3 */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className={`h-8 w-8 rounded-xl ${tierIcons.diamond_3.bgColor} flex items-center justify-center ${tierIcons.diamond_3.color}`}>
                    {tierIcons.diamond_3.icon}
                  </div>
                  شارة ماسية 3
                  <Badge variant="outline" className="mr-auto">Diamond 3</Badge>
                </CardTitle>
                <CardDescription>تتطلب استمرارية الأداء لعدة أشهر</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الحد الأدنى للطلبات الشهرية</Label>
                    <Input
                      type="number"
                      min={1}
                      value={thresholds.diamond_3_min}
                      onChange={(e) => handleChange("diamond_3_min", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>عدد الأشهر المتتالية المطلوبة</Label>
                    <Input
                      type="number"
                      min={1}
                      value={thresholds.diamond_3_months}
                      onChange={(e) => handleChange("diamond_3_months", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Diamond 4 */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className={`h-8 w-8 rounded-xl ${tierIcons.diamond_4.bgColor} flex items-center justify-center ${tierIcons.diamond_4.color}`}>
                    {tierIcons.diamond_4.icon}
                  </div>
                  شارة ماسية 4
                  <Badge variant="outline" className="mr-auto">Diamond 4</Badge>
                </CardTitle>
                <CardDescription>تتطلب استمرارية الأداء لعدة أشهر</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الحد الأدنى للطلبات الشهرية</Label>
                    <Input
                      type="number"
                      min={1}
                      value={thresholds.diamond_4_min}
                      onChange={(e) => handleChange("diamond_4_min", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>عدد الأشهر المتتالية المطلوبة</Label>
                    <Input
                      type="number"
                      min={1}
                      value={thresholds.diamond_4_months}
                      onChange={(e) => handleChange("diamond_4_months", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Emerald */}
            <Card className="border-border bg-emerald-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className={`h-8 w-8 rounded-xl ${tierIcons.emerald.bgColor} flex items-center justify-center ${tierIcons.emerald.color} relative`}>
                    <Sparkles className="h-3 w-3 absolute -top-1 -right-1 text-emerald-400" />
                    {tierIcons.emerald.icon}
                  </div>
                  شارة زمردة
                  <Badge variant="outline" className="mr-auto border-emerald-300 text-emerald-600">Emerald</Badge>
                </CardTitle>
                <CardDescription>أعلى مستوى - تتطلب أداء استثنائي مستمر</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الحد الأدنى للطلبات الشهرية</Label>
                    <Input
                      type="number"
                      min={1}
                      value={thresholds.emerald_min}
                      onChange={(e) => handleChange("emerald_min", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>عدد الأشهر المتتالية المطلوبة</Label>
                    <Input
                      type="number"
                      min={1}
                      value={thresholds.emerald_months}
                      onChange={(e) => handleChange("emerald_months", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <Button
                size="lg"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="gap-2"
              >
                {saveMutation.isPending ? (
                  <>جارٍ الحفظ...</>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    حفظ الإعدادات
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
