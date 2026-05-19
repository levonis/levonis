import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save, RefreshCw, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface QuotePricingCfg {
  base: Record<string, number>;
  risk: Record<string, any>;
  rush: Record<string, { mult: number; days: number }>;
  bulk_tiers: Array<{ min_qty: number; discount_pct: number }>;
  load_balancing: { enabled: boolean; queue_low_mult: number; queue_high_mult: number; high_threshold_pending: number };
  processes: Record<"fdm" | "resin" | "sls", Record<string, number | boolean>>;
}

const NUM = (v: any) => (v === "" || v == null ? 0 : Number(v));

export default function PricingEngineTab() {
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<QuotePricingCfg | null>(null);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewInput, setPreviewInput] = useState({
    volume_cm3: 50, bbox_z_mm: 80, overhang_pct: 10, complexity: 35,
    material_code: "pla", qty: 1, rush_tier: "standard" as "standard" | "fast" | "rush",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["quote_pricing_cfg"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_settings" as any)
        .select("value").eq("key", "quote_pricing").maybeSingle();
      if (error) throw error;
      return (data?.value ?? null) as QuotePricingCfg | null;
    },
  });

  useEffect(() => { if (data) setCfg(JSON.parse(JSON.stringify(data))); }, [data]);

  const save = useMutation({
    mutationFn: async (v: QuotePricingCfg) => {
      const { error } = await supabase.from("community_settings" as any)
        .upsert({ key: "quote_pricing", value: v as any }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ إعدادات التسعير");
      qc.invalidateQueries({ queryKey: ["quote_pricing_cfg"] });
      setDirty(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const runPreview = async () => {
    setPreviewing(true);
    try {
      const { data, error } = await supabase.functions.invoke("price-3d-model", {
        body: {
          metrics: {
            volume_cm3: previewInput.volume_cm3,
            surface_area_cm2: previewInput.volume_cm3 * 6,
            bbox_mm: { x: 50, y: 50, z: previewInput.bbox_z_mm },
            triangle_count: 20000, complexity: previewInput.complexity,
          },
          quality: {
            non_manifold_edges: 0, non_manifold_pct: 0, flipped_normals_pct: 0,
            overhang_pct: previewInput.overhang_pct / 100, min_wall_mm: 1.2,
            thin_wall_warning: false, support_required: previewInput.overhang_pct > 5, watertight: true,
          },
          material_code: previewInput.material_code,
          qty: previewInput.qty, rush_tier: previewInput.rush_tier,
        },
      });
      if (error) throw error;
      setPreview(data);
    } catch (e: any) {
      toast.error(e?.message ?? "Preview failed");
    } finally { setPreviewing(false); }
  };

  const setBase = (k: string, v: number) => { setCfg((c) => c ? ({ ...c, base: { ...c.base, [k]: v } }) : c); setDirty(true); };
  const setRisk = (k: string, v: number) => { setCfg((c) => c ? ({ ...c, risk: { ...c.risk, [k]: v } }) : c); setDirty(true); };
  const setRushVal = (tier: string, k: "mult" | "days", v: number) => {
    setCfg((c) => c ? ({ ...c, rush: { ...c.rush, [tier]: { ...c.rush[tier], [k]: v } } }) : c); setDirty(true);
  };
  const setLB = (k: string, v: any) => { setCfg((c) => c ? ({ ...c, load_balancing: { ...c.load_balancing, [k]: v } }) : c); setDirty(true); };
  const setProc = (p: "fdm" | "resin" | "sls", k: string, v: any) => {
    setCfg((c) => c ? ({ ...c, processes: { ...c.processes, [p]: { ...c.processes[p], [k]: v } } }) : c); setDirty(true);
  };
  const setComplexityMult = (k: "easy" | "medium" | "hard", v: number) => {
    setCfg((c) => c ? ({ ...c, risk: { ...c.risk, complexity_mult: { ...(c.risk.complexity_mult ?? {}), [k]: v } } }) : c); setDirty(true);
  };
  const addBulk = () => { setCfg((c) => c ? ({ ...c, bulk_tiers: [...c.bulk_tiers, { min_qty: 50, discount_pct: 0.20 }] }) : c); setDirty(true); };
  const updBulk = (i: number, k: "min_qty" | "discount_pct", v: number) => {
    setCfg((c) => { if (!c) return c; const t = [...c.bulk_tiers]; t[i] = { ...t[i], [k]: v }; return { ...c, bulk_tiers: t }; }); setDirty(true);
  };
  const rmBulk = (i: number) => { setCfg((c) => c ? ({ ...c, bulk_tiers: c.bulk_tiers.filter((_, j) => j !== i) }) : c); setDirty(true); };

  if (isLoading || !cfg) return <Loader2 className="h-5 w-5 animate-spin" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">محرك التسعير الصناعي</h2>
          <p className="text-xs text-muted-foreground">جميع المتغيرات قابلة للتعديل وتُطبّق فورًا على كل التسعيرات الجديدة</p>
        </div>
        <Button disabled={!dirty || save.isPending} onClick={() => cfg && save.mutate(cfg)}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 me-1" />} حفظ
        </Button>
      </div>

      <Card><CardHeader><CardTitle>التكاليف الأساسية</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <F label="كهرباء IQD/kWh" value={cfg.base.electricity_kwh_iqd} onChange={(v) => setBase("electricity_kwh_iqd", v)} />
          <F label="عمل يدوي IQD/ساعة" value={cfg.base.labor_per_hour_iqd} onChange={(v) => setBase("labor_per_hour_iqd", v)} />
          <F label="تغليف IQD" value={cfg.base.packaging_iqd} onChange={(v) => setBase("packaging_iqd", v)} />
          <F label="شحن افتراضي IQD" value={cfg.base.shipping_default_iqd} onChange={(v) => setBase("shipping_default_iqd", v)} />
          <F label="إهلاك %" step="0.01" value={cfg.base.depreciation_pct} onChange={(v) => setBase("depreciation_pct", v)} />
          <F label="رسوم المنصة %" step="0.001" value={cfg.base.platform_fee_pct} onChange={(v) => setBase("platform_fee_pct", v)} />
          <F label="هامش الربح %" step="0.01" value={cfg.base.profit_margin_pct} onChange={(v) => setBase("profit_margin_pct", v)} />
          <F label="نطاق أدنى %" step="0.01" value={cfg.base.min_range_pct} onChange={(v) => setBase("min_range_pct", v)} />
          <F label="نطاق أعلى %" step="0.01" value={cfg.base.max_range_pct} onChange={(v) => setBase("max_range_pct", v)} />
          <F label="حد أدنى للطلب IQD" value={cfg.base.min_order_iqd} onChange={(v) => setBase("min_order_iqd", v)} />
          <F label="تقريب IQD" value={cfg.base.round_to_iqd} onChange={(v) => setBase("round_to_iqd", v)} />
          <F label="رسوم تعقيد قاعدية IQD" value={cfg.base.base_complexity_fee} onChange={(v) => setBase("base_complexity_fee", v)} />
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle>عوامل الخطر والتعقيد</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <F label="مضاعف سهل" step="0.05" value={NUM(cfg.risk.complexity_mult?.easy)} onChange={(v) => setComplexityMult("easy", v)} />
          <F label="مضاعف متوسط" step="0.05" value={NUM(cfg.risk.complexity_mult?.medium)} onChange={(v) => setComplexityMult("medium", v)} />
          <F label="مضاعف صعب" step="0.05" value={NUM(cfg.risk.complexity_mult?.hard)} onChange={(v) => setComplexityMult("hard", v)} />
          <F label="مضاعف overhang لكل 10%" step="0.01" value={cfg.risk.overhang_mult_per_10pct} onChange={(v) => setRisk("overhang_mult_per_10pct", v)} />
          <F label="حد النموذج الكبير cm³" value={cfg.risk.large_model_threshold_cm3} onChange={(v) => setRisk("large_model_threshold_cm3", v)} />
          <F label="مضاعف نموذج كبير" step="0.05" value={cfg.risk.large_model_mult} onChange={(v) => setRisk("large_model_mult", v)} />
          <F label="عمل إضافي لكل قطعة IQD" value={cfg.risk.multipart_labor_per_part_iqd} onChange={(v) => setRisk("multipart_labor_per_part_iqd", v)} />
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle>سرعات التسليم (Rush)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(["standard", "fast", "rush"] as const).map((tier) => (
            <div key={tier} className="rounded-lg border border-border/40 p-3 space-y-2">
              <div className="font-medium text-sm capitalize">{tier}</div>
              <F label="مضاعف السعر" step="0.05" value={cfg.rush[tier]?.mult ?? 1} onChange={(v) => setRushVal(tier, "mult", v)} />
              <F label="أيام التسليم" value={cfg.rush[tier]?.days ?? 7} onChange={(v) => setRushVal(tier, "days", v)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="flex items-center justify-between">خصومات الجملة
        <Button size="sm" variant="outline" onClick={addBulk}><Plus className="h-3 w-3 me-1" />إضافة فئة</Button>
      </CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {cfg.bulk_tiers.map((t, i) => (
            <div key={i} className="flex items-end gap-2">
              <F label="حد أدنى للكمية" value={t.min_qty} onChange={(v) => updBulk(i, "min_qty", v)} />
              <F label="خصم %" step="0.01" value={t.discount_pct} onChange={(v) => updBulk(i, "discount_pct", v)} />
              <Button size="sm" variant="ghost" onClick={() => rmBulk(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle>موازنة الحمل (Load Balancing)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={cfg.load_balancing.enabled} onChange={(e) => setLB("enabled", e.target.checked)} />
            مفعّل
          </label>
          <F label="مضاعف الحمل المنخفض" step="0.01" value={cfg.load_balancing.queue_low_mult} onChange={(v) => setLB("queue_low_mult", v)} />
          <F label="مضاعف الحمل المرتفع" step="0.01" value={cfg.load_balancing.queue_high_mult} onChange={(v) => setLB("queue_high_mult", v)} />
          <F label="حد الطابور المرتفع" value={cfg.load_balancing.high_threshold_pending} onChange={(v) => setLB("high_threshold_pending", v)} />
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle>إعدادات حسب التقنية</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(["fdm", "resin", "sls"] as const).map((p) => (
            <div key={p} className="rounded-lg border border-border/40 p-3">
              <div className="font-medium text-sm mb-2 uppercase">{p}</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <F label="استهلاك كهرباء kW" step="0.01" value={NUM(cfg.processes[p].machine_kw)} onChange={(v) => setProc(p, "machine_kw", v)} />
                <F label="معدل الفشل %" step="0.01" value={NUM(cfg.processes[p].failure_rate_pct)} onChange={(v) => setProc(p, "failure_rate_pct", v)} />
                <F label="مضاعف الدعامات" step="0.05" value={NUM(cfg.processes[p].support_mult)} onChange={(v) => setProc(p, "support_mult", v)} />
                <F label="معالجة لاحقة (دقيقة)" value={NUM(cfg.processes[p].post_processing_min)} onChange={(v) => setProc(p, "post_processing_min", v)} />
                {p === "resin" && (<>
                  <F label="غسيل ومعالجة IQD" value={NUM(cfg.processes.resin.wash_cure_iqd)} onChange={(v) => setProc("resin", "wash_cure_iqd", v)} />
                  <F label="هدر الراتنج %" step="0.01" value={NUM(cfg.processes.resin.resin_waste_pct)} onChange={(v) => setProc("resin", "resin_waste_pct", v)} />
                </>)}
                {p === "sls" && (<>
                  <F label="تجديد المسحوق %" step="0.05" value={NUM(cfg.processes.sls.powder_refresh_pct)} onChange={(v) => setProc("sls", "powder_refresh_pct", v)} />
                  <F label="كثافة التعبئة" step="0.01" value={NUM(cfg.processes.sls.packing_density)} onChange={(v) => setProc("sls", "packing_density", v)} />
                </>)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle>معاينة حية</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <F label="الحجم cm³" value={previewInput.volume_cm3} onChange={(v) => setPreviewInput({ ...previewInput, volume_cm3: v })} />
            <F label="ارتفاع mm" value={previewInput.bbox_z_mm} onChange={(v) => setPreviewInput({ ...previewInput, bbox_z_mm: v })} />
            <F label="overhang %" value={previewInput.overhang_pct} onChange={(v) => setPreviewInput({ ...previewInput, overhang_pct: v })} />
            <F label="التعقيد 0-100" value={previewInput.complexity} onChange={(v) => setPreviewInput({ ...previewInput, complexity: v })} />
            <F label="الكمية" value={previewInput.qty} onChange={(v) => setPreviewInput({ ...previewInput, qty: v })} />
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">رمز المادة</label>
              <Input value={previewInput.material_code} onChange={(e) => setPreviewInput({ ...previewInput, material_code: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">السرعة</label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={previewInput.rush_tier}
                onChange={(e) => setPreviewInput({ ...previewInput, rush_tier: e.target.value as any })}>
                <option value="standard">Standard</option><option value="fast">Fast</option><option value="rush">Rush</option>
              </select>
            </div>
          </div>
          <Button onClick={runPreview} disabled={previewing} size="sm">
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 me-1" />} احسب المعاينة
          </Button>
          {preview && (
            <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1 font-mono">
              <div className="font-semibold text-sm">السعر النهائي: {preview.breakdown.final.toLocaleString()} IQD</div>
              <div>النطاق: {preview.breakdown.price_min.toLocaleString()} – {preview.breakdown.price_max.toLocaleString()}</div>
              <div>الصعوبة: {preview.model.difficulty_score}/10 ({preview.model.difficulty})</div>
              <div>الوزن: {preview.model.weight_g}g · الوقت: {preview.model.print_minutes}min</div>
              <details className="mt-2"><summary className="cursor-pointer">المكوّنات</summary>
                <pre className="text-[10px] overflow-auto">{JSON.stringify(preview.breakdown.components, null, 2)}</pre>
                <pre className="text-[10px] overflow-auto">المضاعفات: {JSON.stringify(preview.breakdown.multipliers, null, 2)}</pre>
              </details>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function F({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input type="number" step={step ?? "1"} value={String(value)} onChange={(e) => onChange(NUM(e.target.value))} />
    </div>
  );
}
