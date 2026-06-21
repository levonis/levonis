import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";
import { ArrowRight, Plus, Trash2, Sparkles, Save } from "lucide-react";
import { toast } from "sonner";
import { ADMIN_BASE_PATH } from "@/config/adminConfig";

const PRINTER_CATEGORY_SLUG = "printers";

export default function AdminPrinterAdvisor() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: categoryId } = useQuery({
    queryKey: ["printers-category-id"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", PRINTER_CATEGORY_SLUG)
        .maybeSingle();
      return data?.id as string | undefined;
    },
  });

  const { data: printers, isLoading: printersLoading } = useQuery({
    queryKey: ["admin-printers-advisor", categoryId],
    queryFn: async () => {
      if (!categoryId) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, name_ar, name, image_url, price, brand, advisor_priority_boost, advisor_recommended, advisor_notes")
        .eq("category_id", categoryId)
        .order("name_ar");
      if (error) throw error;
      return data || [];
    },
    enabled: !!categoryId,
  });

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ["printer-advisor-budget-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("printer_advisor_budget_rules")
        .select("*")
        .order("priority", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const updateProduct = useMutation({
    mutationFn: async (payload: { id: string; patch: any }) => {
      const { error } = await supabase.from("products").update(payload.patch).eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-printers-advisor"] });
      toast.success("تم الحفظ");
    },
    onError: (e: any) => toast.error(e.message || "فشل الحفظ"),
  });

  const upsertRule = useMutation({
    mutationFn: async (rule: any) => {
      if (rule.id) {
        const { error } = await supabase
          .from("printer_advisor_budget_rules")
          .update(rule)
          .eq("id", rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("printer_advisor_budget_rules").insert(rule);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["printer-advisor-budget-rules"] });
      toast.success("تم حفظ القاعدة");
    },
    onError: (e: any) => toast.error(e.message || "فشل الحفظ"),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("printer_advisor_budget_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["printer-advisor-budget-rules"] });
      toast.success("تم الحذف");
    },
  });

  const [newRule, setNewRule] = useState<any>({
    min_budget_iqd: 0,
    max_budget_iqd: 0,
    recommended_product_id: "",
    upgrade_suggestion_product_id: "",
    message_ar: "",
    priority: 0,
    is_active: true,
  });

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-primary flex items-center gap-2">
              <Sparkles className="h-6 w-6" />
              مستشار الطابعات
            </h1>
            <p className="text-sm text-muted-foreground">إدارة تفضيلات الطابعات وقواعد الميزانية</p>
          </div>
          <Button variant="outline" onClick={() => navigate(ADMIN_BASE_PATH)} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
        </header>

        <Tabs defaultValue="products">
          <TabsList className="mb-4">
            <TabsTrigger value="products">تفضيلات الطابعات</TabsTrigger>
            <TabsTrigger value="rules">قواعد الميزانية</TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">قائمة الطابعات</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {printersLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>}
                {printers?.map((p: any) => (
                  <PrinterRow key={p.id} product={p} onSave={(patch) => updateProduct.mutate({ id: p.id, patch })} />
                ))}
                {printers?.length === 0 && <p className="text-sm text-muted-foreground">لا توجد طابعات</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rules">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">إضافة قاعدة جديدة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>الحد الأدنى للميزانية (د.ع)</Label>
                      <FormattedNumberInput
                        value={newRule.min_budget_iqd}
                        onChange={(v) => setNewRule({ ...newRule, min_budget_iqd: v })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>الحد الأعلى للميزانية (د.ع)</Label>
                      <FormattedNumberInput
                        value={newRule.max_budget_iqd}
                        onChange={(v) => setNewRule({ ...newRule, max_budget_iqd: v })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>الطابعة الموصى بها</Label>
                      <ProductPicker
                        printers={printers || []}
                        value={newRule.recommended_product_id}
                        onChange={(v) => setNewRule({ ...newRule, recommended_product_id: v })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>اقتراح ترقية (اختياري)</Label>
                      <ProductPicker
                        printers={printers || []}
                        value={newRule.upgrade_suggestion_product_id}
                        onChange={(v) => setNewRule({ ...newRule, upgrade_suggestion_product_id: v })}
                        allowNone
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>رسالة مخصصة (تظهر للأدمن في الـ AI)</Label>
                    <Textarea
                      value={newRule.message_ar}
                      onChange={(e) => setNewRule({ ...newRule, message_ar: e.target.value })}
                      maxLength={300}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="space-y-1.5 w-32">
                      <Label>الأولوية</Label>
                      <Input
                        type="number"
                        value={newRule.priority}
                        onChange={(e) => setNewRule({ ...newRule, priority: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <Switch
                        checked={newRule.is_active}
                        onCheckedChange={(v) => setNewRule({ ...newRule, is_active: v })}
                      />
                      <Label>مفعّلة</Label>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      if (!newRule.recommended_product_id) {
                        toast.error("اختر طابعة موصى بها");
                        return;
                      }
                      if (newRule.max_budget_iqd <= newRule.min_budget_iqd) {
                        toast.error("الحد الأعلى يجب أن يكون أكبر من الأدنى");
                        return;
                      }
                      upsertRule.mutate({
                        ...newRule,
                        upgrade_suggestion_product_id: newRule.upgrade_suggestion_product_id || null,
                      });
                    }}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    إضافة القاعدة
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">القواعد الحالية ({rules?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {rulesLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>}
                  {rules?.map((r: any) => {
                    const rec = printers?.find((p: any) => p.id === r.recommended_product_id);
                    const up = printers?.find((p: any) => p.id === r.upgrade_suggestion_product_id);
                    return (
                      <div key={r.id} className="border rounded-xl p-3 bg-card flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0 text-sm space-y-1">
                          <p className="font-bold">
                            {Number(r.min_budget_iqd).toLocaleString()} - {Number(r.max_budget_iqd).toLocaleString()} د.ع
                            {!r.is_active && <span className="text-xs text-muted-foreground"> (معطّلة)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            موصى به: <span className="font-medium text-foreground">{rec?.name_ar || rec?.name || "—"}</span>
                            {up && <> · ترقية: <span className="font-medium text-foreground">{up.name_ar || up.name}</span></>}
                          </p>
                          {r.message_ar && <p className="text-xs text-muted-foreground">{r.message_ar}</p>}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("حذف القاعدة؟")) deleteRule.mutate(r.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                  {rules?.length === 0 && <p className="text-sm text-muted-foreground">لا توجد قواعد بعد</p>}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function PrinterRow({ product, onSave }: { product: any; onSave: (patch: any) => void }) {
  const [recommended, setRecommended] = useState(!!product.advisor_recommended);
  const [boost, setBoost] = useState<number>(product.advisor_priority_boost || 0);
  const [notes, setNotes] = useState<string>(product.advisor_notes || "");
  const dirty =
    recommended !== !!product.advisor_recommended ||
    boost !== (product.advisor_priority_boost || 0) ||
    notes !== (product.advisor_notes || "");

  return (
    <div className="border rounded-xl p-3 bg-card">
      <div className="flex items-center gap-3 mb-3">
        <img
          src={product.image_url || "/placeholder.svg"}
          alt={product.name_ar || product.name}
          className="w-14 h-14 object-contain rounded-lg bg-background"
          loading="lazy"
        />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">{product.name_ar || product.name}</p>
          {product.brand && <p className="text-xs text-muted-foreground">{product.brand}</p>}
          {product.price > 0 && (
            <p className="text-xs text-primary">{Number(product.price).toLocaleString()} د.ع</p>
          )}
        </div>
        <Button
          size="sm"
          disabled={!dirty}
          onClick={() =>
            onSave({
              advisor_recommended: recommended,
              advisor_priority_boost: boost,
              advisor_notes: notes || null,
            })
          }
          className="gap-1"
        >
          <Save className="h-3.5 w-3.5" />
          حفظ
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="flex items-center gap-2">
          <Switch checked={recommended} onCheckedChange={setRecommended} id={`rec-${product.id}`} />
          <Label htmlFor={`rec-${product.id}`} className="text-sm">موصى بها</Label>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">أولوية الترتيب</Label>
          <Input
            type="number"
            value={boost}
            onChange={(e) => setBoost(Number(e.target.value) || 0)}
            className="h-8"
          />
        </div>
        <div className="space-y-1 md:col-span-1">
          <Label className="text-xs">ملاحظة للذكاء الاصطناعي</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={300}
            placeholder="مثال: الأفضل للمبتدئين"
            className="h-8"
          />
        </div>
      </div>
    </div>
  );
}

function ProductPicker({
  printers,
  value,
  onChange,
  allowNone,
}: {
  printers: any[];
  value: string;
  onChange: (v: string) => void;
  allowNone?: boolean;
}) {
  return (
    <Select value={value || "__none"} onValueChange={(v) => onChange(v === "__none" ? "" : v)}>
      <SelectTrigger>
        <SelectValue placeholder="اختر طابعة" />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="__none">— لا شيء —</SelectItem>}
        {printers.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name_ar || p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
