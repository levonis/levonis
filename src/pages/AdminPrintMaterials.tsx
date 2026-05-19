import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import PricingEngineTab from "@/components/admin/pricing/PricingEngineTab";

interface Material {
  id: string; code: string; name_ar: string; name_en: string; name_ku?: string | null;
  density_g_cm3: number; cost_per_kg_iqd: number; shrinkage_pct: number;
  default_infill_pct: number; default_layer_height_mm: number; default_nozzle_mm: number;
  default_print_speed_mm_s: number; is_active: boolean; display_order: number;
}

interface Machine {
  id: string; name: string; hourly_cost_iqd: number;
  nozzle_flow_rate_cm3_min: number; travel_overhead_per_layer_sec: number;
  is_default: boolean; is_active: boolean;
}

export default function AdminPrintMaterials() {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Partial<Material>>>({});
  const [machineDraft, setMachineDraft] = useState<Partial<Machine> | null>(null);

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["admin-print-materials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("print_materials" as any).select("*").order("display_order");
      if (error) throw error;
      return ((data ?? []) as unknown) as Material[];
    },
  });

  const { data: machine } = useQuery({
    queryKey: ["admin-print-machine"],
    queryFn: async () => {
      const { data, error } = await supabase.from("print_machine_profiles" as any).select("*")
        .order("is_default", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return (data as unknown) as Machine | null;
    },
  });

  const saveMaterial = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Material> }) => {
      const { error } = await supabase.from("print_materials" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["admin-print-materials"] });
      qc.invalidateQueries({ queryKey: ["print-materials"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveMachine = useMutation({
    mutationFn: async (patch: Partial<Machine>) => {
      if (!machine) return;
      const { error } = await supabase.from("print_machine_profiles" as any).update(patch).eq("id", machine.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["admin-print-machine"] });
      setMachineDraft(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const num = (v: any) => (v === "" || v == null ? 0 : Number(v));

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">إدارة طباعة 3D — المواد والتسعير</h1>
        <p className="text-sm text-muted-foreground mt-1">المواد، الماكينات، ومحرك التسعير الصناعي الكامل.</p>
      </div>

      <Tabs defaultValue="materials">
        <TabsList className="grid grid-cols-3 w-full sm:w-auto">
          <TabsTrigger value="materials">المواد والماكينات</TabsTrigger>
          <TabsTrigger value="engine">محرك التسعير</TabsTrigger>
          <TabsTrigger value="quotations">عروض الأسعار</TabsTrigger>
        </TabsList>

        <TabsContent value="materials" className="space-y-6 pt-4">


      <Card>
        <CardHeader><CardTitle>المواد (Filaments)</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الرمز</TableHead><TableHead>الاسم</TableHead>
                    <TableHead>الكثافة g/cm³</TableHead><TableHead>السعر IQD/kg</TableHead>
                    <TableHead>انكماش %</TableHead><TableHead>Infill %</TableHead>
                    <TableHead>Layer mm</TableHead><TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.map((m) => {
                    const d = drafts[m.id] ?? {};
                    const merged = { ...m, ...d };
                    const dirty = Object.keys(d).length > 0;
                    const upd = (k: keyof Material, v: any) =>
                      setDrafts((p) => ({ ...p, [m.id]: { ...p[m.id], [k]: v } }));
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">{m.code}</TableCell>
                        <TableCell><Input className="w-28" value={merged.name_ar} onChange={(e) => upd("name_ar", e.target.value)} /></TableCell>
                        <TableCell><Input className="w-20" type="number" step="0.01" value={String(merged.density_g_cm3)} onChange={(e) => upd("density_g_cm3", num(e.target.value))} /></TableCell>
                        <TableCell><Input className="w-24" type="number" value={String(merged.cost_per_kg_iqd)} onChange={(e) => upd("cost_per_kg_iqd", num(e.target.value))} /></TableCell>
                        <TableCell><Input className="w-16" type="number" step="0.1" value={String(merged.shrinkage_pct)} onChange={(e) => upd("shrinkage_pct", num(e.target.value))} /></TableCell>
                        <TableCell><Input className="w-16" type="number" value={String(merged.default_infill_pct)} onChange={(e) => upd("default_infill_pct", num(e.target.value))} /></TableCell>
                        <TableCell><Input className="w-16" type="number" step="0.05" value={String(merged.default_layer_height_mm)} onChange={(e) => upd("default_layer_height_mm", num(e.target.value))} /></TableCell>
                        <TableCell>
                          <Button size="sm" disabled={!dirty || saveMaterial.isPending}
                            onClick={() => saveMaterial.mutate({ id: m.id, patch: d }, {
                              onSuccess: () => setDrafts((p) => { const n = { ...p }; delete n[m.id]; return n; }),
                            })}>
                            <Save className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {machine && (
        <Card>
          <CardHeader><CardTitle>ملف الماكنة الافتراضي</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="التكلفة بالساعة (IQD)" value={machineDraft?.hourly_cost_iqd ?? machine.hourly_cost_iqd}
                onChange={(v) => setMachineDraft((p) => ({ ...(p ?? {}), hourly_cost_iqd: num(v) }))} />
              <Field label="معدل التدفق cm³/min" step="0.1" value={machineDraft?.nozzle_flow_rate_cm3_min ?? machine.nozzle_flow_rate_cm3_min}
                onChange={(v) => setMachineDraft((p) => ({ ...(p ?? {}), nozzle_flow_rate_cm3_min: num(v) }))} />
              <Field label="عبء سفر/طبقة (ثانية)" step="0.1" value={machineDraft?.travel_overhead_per_layer_sec ?? machine.travel_overhead_per_layer_sec}
                onChange={(v) => setMachineDraft((p) => ({ ...(p ?? {}), travel_overhead_per_layer_sec: num(v) }))} />
            </div>
            <Button disabled={!machineDraft || saveMachine.isPending} onClick={() => machineDraft && saveMachine.mutate(machineDraft)}>
              {saveMachine.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 me-1" />}
              حفظ
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, onChange, step }: { label: string; value: number; onChange: (v: string) => void; step?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input type="number" step={step ?? "1"} value={String(value)} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
