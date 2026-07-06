import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Save, Recycle } from "lucide-react";
import { useEligiblePrinters, useValuationRules } from "@/hooks/useTradeInEligibility";

export default function AdminTradeInPrinters() {
  const qc = useQueryClient();
  const { data: printers = [] } = useEligiblePrinters({ includeInactive: true });
  const { data: rules = [] } = useValuationRules();

  const [newP, setNewP] = useState({ brand: "", printer_model: "", base_trade_in_value: 0, max_operating_hours: null as number | null });

  const addPrinter = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("trade_in_eligible_printers").insert(newP);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade-in-eligible-printers"] });
      setNewP({ brand: "", printer_model: "", base_trade_in_value: 0, max_operating_hours: null });
      toast.success("تمت الإضافة");
    },
    onError: (e: any) => toast.error("فشل: " + e.message),
  });

  const updatePrinter = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase.from("trade_in_eligible_printers").update({
        brand: p.brand, printer_model: p.printer_model,
        base_trade_in_value: p.base_trade_in_value,
        max_operating_hours: p.max_operating_hours,
        is_active: p.is_active,
      }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade-in-eligible-printers"] });
      toast.success("تم الحفظ");
    },
  });

  const deletePrinter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trade_in_eligible_printers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trade-in-eligible-printers"] }); toast.success("تم الحذف"); },
  });

  const updateRule = useMutation({
    mutationFn: async (r: any) => {
      const { error } = await supabase.from("trade_in_valuation_rules").update({
        multiplier_percent: r.multiplier_percent, adjust_percent: r.adjust_percent, is_active: r.is_active,
      }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trade-in-valuation-rules"] }); toast.success("تم الحفظ"); },
  });

  return (
    <div className="container max-w-5xl mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Recycle className="h-6 w-6 text-primary" />
        إعدادات استبدال الطابعات
      </h1>

      <Card>
        <CardHeader><CardTitle>الطابعات المؤهلة للاستبدال</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 border rounded-lg p-3">
            <div><Label className="text-xs">الشركة</Label><Input value={newP.brand} onChange={(e) => setNewP({ ...newP, brand: e.target.value })} /></div>
            <div><Label className="text-xs">الموديل</Label><Input value={newP.printer_model} onChange={(e) => setNewP({ ...newP, printer_model: e.target.value })} /></div>
            <div><Label className="text-xs">القيمة الأساسية</Label><Input type="number" value={newP.base_trade_in_value} onChange={(e) => setNewP({ ...newP, base_trade_in_value: +e.target.value })} /></div>
            <div><Label className="text-xs">حد الساعات</Label><Input type="number" value={newP.max_operating_hours ?? ""} onChange={(e) => setNewP({ ...newP, max_operating_hours: e.target.value ? +e.target.value : null })} /></div>
            <div className="flex items-end">
              <Button onClick={() => addPrinter.mutate()} disabled={!newP.brand || !newP.printer_model} className="w-full">
                <Plus className="h-4 w-4 ml-1" /> إضافة
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {printers.map((p) => <PrinterRow key={p.id} p={p} onSave={(v) => updatePrinter.mutate(v)} onDelete={() => deletePrinter.mutate(p.id)} />)}
            {printers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد طابعات مضافة</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>قواعد تقييم الحالة</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-2">شرائح ساعات التشغيل</p>
            {rules.filter((r) => r.rule_type === "hours_tier").map((r) => (
              <RuleRow key={r.id} rule={r} field="multiplier_percent" onSave={(v) => updateRule.mutate(v)} suffix="%" />
            ))}
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">عوامل الحالة</p>
            {rules.filter((r) => r.rule_type === "condition_adjust").map((r) => (
              <RuleRow key={r.id} rule={r} field="adjust_percent" onSave={(v) => updateRule.mutate(v)} suffix="%" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PrinterRow({ p, onSave, onDelete }: any) {
  const [state, setState] = useState(p);
  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end border rounded-lg p-2">
      <Input value={state.brand} onChange={(e) => setState({ ...state, brand: e.target.value })} />
      <Input value={state.printer_model} onChange={(e) => setState({ ...state, printer_model: e.target.value })} />
      <Input type="number" value={state.base_trade_in_value} onChange={(e) => setState({ ...state, base_trade_in_value: +e.target.value })} />
      <Input type="number" value={state.max_operating_hours ?? ""} onChange={(e) => setState({ ...state, max_operating_hours: e.target.value ? +e.target.value : null })} placeholder="حد الساعات" />
      <div className="flex items-center gap-2"><Switch checked={state.is_active} onCheckedChange={(v) => setState({ ...state, is_active: v })} /><span className="text-xs">مفعّل</span></div>
      <div className="flex gap-1">
        <Button size="sm" onClick={() => onSave(state)}><Save className="h-3 w-3" /></Button>
        <Button size="sm" variant="destructive" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
      </div>
    </div>
  );
}

function RuleRow({ rule, field, onSave, suffix }: any) {
  const [val, setVal] = useState(rule[field] ?? 0);
  const [active, setActive] = useState(rule.is_active);
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-sm flex-1">{rule.label_ar}</span>
      <Badge variant="outline" className="text-xs">{rule.rule_key}</Badge>
      <Input type="number" value={val} onChange={(e) => setVal(+e.target.value)} className="w-24 h-8" />
      <span className="text-xs">{suffix}</span>
      <Switch checked={active} onCheckedChange={setActive} />
      <Button size="sm" variant="outline" onClick={() => onSave({ ...rule, [field]: val, is_active: active })}>
        <Save className="h-3 w-3" />
      </Button>
    </div>
  );
}
