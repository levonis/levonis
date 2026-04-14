import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, Settings, Gift, Package, Lightbulb, BarChart3 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SubTab = "machines" | "prizes" | "dolls" | "coupons" | "advice" | "guaranteed" | "rarity" | "settings" | "analytics";

export default function GachaAdminTab() {
  const [subTab, setSubTab] = useState<SubTab>("machines");

  const SUB_TABS: { id: SubTab; label: string; icon: typeof Settings }[] = [
    { id: "machines", label: "الآلات", icon: Settings },
    { id: "prizes", label: "الجوائز", icon: Gift },
    { id: "dolls", label: "الدُمى", icon: Package },
    { id: "rarity", label: "الندرة", icon: BarChart3 },
    { id: "coupons", label: "كوبونات", icon: Gift },
    { id: "advice", label: "نصائح", icon: Lightbulb },
    { id: "guaranteed", label: "مضمونة", icon: Gift },
    { id: "settings", label: "إعدادات", icon: Settings },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              subTab === tab.id ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <tab.icon className="h-3 w-3" /> {tab.label}
          </button>
        ))}
      </div>

      {subTab === "machines" && <MachinesManager />}
      {subTab === "prizes" && <PrizesManager />}
      {subTab === "dolls" && <DollsManager />}
      {subTab === "rarity" && <RarityManager />}
      {subTab === "coupons" && <CouponsManager />}
      {subTab === "advice" && <AdviceManager />}
      {subTab === "guaranteed" && <GuaranteedManager />}
      {subTab === "settings" && <GachaSettingsManager />}
    </div>
  );
}

// ─── Machines Manager ───────────────────────────────
function MachinesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  const { data: machines = [] } = useQuery({
    queryKey: ["admin-gacha-machines"],
    queryFn: async () => {
      const { data } = await supabase.from("gacha_machines" as any).select("*").order("display_order");
      return (data ?? []) as any[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      if (editItem) {
        await supabase.from("gacha_machines" as any).update(values).eq("id", editItem.id);
      } else {
        await supabase.from("gacha_machines" as any).insert(values);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gacha-machines"] });
      toast({ title: editItem ? "تم التحديث" : "تم الإضافة" });
      setShowForm(false);
      setEditItem(null);
    },
  });

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("gacha_machines" as any).update({ is_active: !current }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-gacha-machines"] });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">إدارة الآلات</h3>
        <Button size="sm" onClick={() => { setEditItem(null); setShowForm(true); }}>
          <Plus className="h-3 w-3 ml-1" /> إضافة آلة
        </Button>
      </div>

      {machines.map((m: any) => (
        <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/20">
          <span className="text-2xl">{m.theme === "coupon" ? "🎟️" : m.theme === "doll" ? "🧸" : m.theme === "premium" ? "💎" : "🎰"}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">{m.name_ar}</p>
            <p className="text-[10px] text-muted-foreground">تكلفة: {m.ticket_cost} تذكرة</p>
          </div>
          <Switch checked={m.is_active} onCheckedChange={() => toggleActive(m.id, m.is_active)} />
          <Button size="icon" variant="ghost" onClick={() => { setEditItem(m); setShowForm(true); }}>
            <Edit2 className="h-3 w-3" />
          </Button>
        </div>
      ))}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? "تعديل الآلة" : "إضافة آلة جديدة"}</DialogTitle>
          </DialogHeader>
          <MachineForm
            initial={editItem}
            onSave={(values: any) => saveMutation.mutate(values)}
            loading={saveMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MachineForm({ initial, onSave, loading }: { initial?: any; onSave: (v: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    name_ar: initial?.name_ar || "",
    description_ar: initial?.description_ar || "",
    theme: initial?.theme || "default",
    ticket_cost: initial?.ticket_cost || 1,
    image_url: initial?.image_url || "",
    is_active: initial?.is_active ?? true,
    is_limited: initial?.is_limited ?? false,
    display_order: initial?.display_order || 0,
  });

  return (
    <div className="space-y-3">
      <div><Label className="text-xs">الاسم (عربي)</Label><Input value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} /></div>
      <div><Label className="text-xs">الاسم (إنجليزي)</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
      <div><Label className="text-xs">الوصف</Label><Textarea value={form.description_ar} onChange={e => setForm(f => ({ ...f, description_ar: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">النوع</Label>
          <Select value={form.theme} onValueChange={v => setForm(f => ({ ...f, theme: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">عام</SelectItem>
              <SelectItem value="coupon">كوبونات</SelectItem>
              <SelectItem value="doll">دُمى</SelectItem>
              <SelectItem value="event">حدث</SelectItem>
              <SelectItem value="premium">مميز</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">التكلفة</Label><Input type="number" value={form.ticket_cost} onChange={e => setForm(f => ({ ...f, ticket_cost: parseInt(e.target.value) || 1 }))} /></div>
      </div>
      <div><Label className="text-xs">رابط الصورة</Label><Input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} /></div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label className="text-xs">نشطة</Label></div>
        <div className="flex items-center gap-2"><Switch checked={form.is_limited} onCheckedChange={v => setForm(f => ({ ...f, is_limited: v }))} /><Label className="text-xs">محدودة الوقت</Label></div>
      </div>
      <Button onClick={() => onSave(form)} disabled={loading || !form.name_ar} className="w-full">
        {loading ? "جاري الحفظ..." : "حفظ"}
      </Button>
    </div>
  );
}

// ─── Prizes Manager ────────────────────────────────
function PrizesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [machineId, setMachineId] = useState<string>("");
  const [showForm, setShowForm] = useState(false);

  const { data: machines = [] } = useQuery({
    queryKey: ["admin-gacha-machines"],
    queryFn: async () => {
      const { data } = await supabase.from("gacha_machines" as any).select("id, name_ar").order("display_order");
      return (data ?? []) as any[];
    },
  });

  const { data: prizes = [] } = useQuery({
    queryKey: ["admin-gacha-prizes", machineId],
    queryFn: async () => {
      if (!machineId) return [];
      const { data } = await supabase.from("gacha_machine_prizes" as any).select("*, gacha_rarity_tiers(name_ar, color)").eq("machine_id", machineId);
      return (data ?? []) as any[];
    },
    enabled: !!machineId,
  });

  const { data: rarityTiers = [] } = useQuery({
    queryKey: ["admin-gacha-rarity"],
    queryFn: async () => {
      const { data } = await supabase.from("gacha_rarity_tiers" as any).select("*").order("display_order");
      return (data ?? []) as any[];
    },
  });

  const deletePrize = async (id: string) => {
    await supabase.from("gacha_machine_prizes" as any).delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-gacha-prizes"] });
    toast({ title: "تم الحذف" });
  };

  const totalWeight = prizes.reduce((s: number, p: any) => s + Number(p.drop_weight), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={machineId} onValueChange={setMachineId}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="اختر آلة" /></SelectTrigger>
          <SelectContent>
            {machines.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name_ar}</SelectItem>)}
          </SelectContent>
        </Select>
        {machineId && <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-3 w-3 ml-1" /> إضافة</Button>}
      </div>

      {prizes.map((p: any) => {
        const chance = totalWeight > 0 ? ((Number(p.drop_weight) / totalWeight) * 100).toFixed(1) : "0";
        return (
          <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border/20">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.gacha_rarity_tiers?.color || "#888" }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{p.prize_name_ar}</p>
              <p className="text-[10px] text-muted-foreground">{p.prize_type} • {chance}%</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => deletePrize(p.id)}><Trash2 className="h-3 w-3 text-red-400" /></Button>
          </div>
        );
      })}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>إضافة جائزة</DialogTitle></DialogHeader>
          <PrizeForm machineId={machineId} rarityTiers={rarityTiers} onDone={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ["admin-gacha-prizes"] }); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PrizeForm({ machineId, rarityTiers, onDone }: { machineId: string; rarityTiers: any[]; onDone: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ prize_type: "points", prize_name: "", prize_name_ar: "", rarity_tier_id: "", drop_weight: 100, points_value: 0, prize_image_url: "" });

  const save = async () => {
    await supabase.from("gacha_machine_prizes" as any).insert({ ...form, machine_id: machineId, rarity_tier_id: form.rarity_tier_id || null });
    toast({ title: "تم الإضافة" });
    onDone();
  };

  return (
    <div className="space-y-3">
      <div><Label className="text-xs">النوع</Label>
        <Select value={form.prize_type} onValueChange={v => setForm(f => ({ ...f, prize_type: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="points">نقاط</SelectItem>
            <SelectItem value="doll">دمية</SelectItem>
            <SelectItem value="coupon">كوبون</SelectItem>
            <SelectItem value="advice">نصيحة</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><Label className="text-xs">الاسم (عربي)</Label><Input value={form.prize_name_ar} onChange={e => setForm(f => ({ ...f, prize_name_ar: e.target.value }))} /></div>
      <div><Label className="text-xs">الاسم (إنجليزي)</Label><Input value={form.prize_name} onChange={e => setForm(f => ({ ...f, prize_name: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">وزن السقوط</Label><Input type="number" value={form.drop_weight} onChange={e => setForm(f => ({ ...f, drop_weight: parseInt(e.target.value) || 1 }))} /></div>
        <div><Label className="text-xs">قيمة النقاط</Label><Input type="number" value={form.points_value} onChange={e => setForm(f => ({ ...f, points_value: parseInt(e.target.value) || 0 }))} /></div>
      </div>
      <div><Label className="text-xs">الندرة</Label>
        <Select value={form.rarity_tier_id} onValueChange={v => setForm(f => ({ ...f, rarity_tier_id: v }))}>
          <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
          <SelectContent>
            {rarityTiers.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name_ar}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={save} disabled={!form.prize_name_ar} className="w-full">حفظ</Button>
    </div>
  );
}

// ─── Simplified managers for dolls, rarity, coupons, advice, guaranteed, settings ───
function DollsManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);

  const { data: dolls = [] } = useQuery({
    queryKey: ["admin-gacha-dolls"],
    queryFn: async () => {
      const { data } = await supabase.from("gacha_dolls" as any).select("*, gacha_rarity_tiers(name_ar, color)").order("doll_number");
      return (data ?? []) as any[];
    },
  });

  const deleteDoll = async (id: string) => {
    await supabase.from("gacha_dolls" as any).delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-gacha-dolls"] });
    toast({ title: "تم الحذف" });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">كتالوج الدُمى ({dolls.length})</h3>
        <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-3 w-3 ml-1" /> إضافة</Button>
      </div>
      {dolls.map((d: any) => (
        <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border/20">
          <span className="text-xl">{d.image_url ? "🧸" : "🧸"}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">#{d.doll_number} {d.name_ar}</p>
            <p className="text-[10px] text-muted-foreground">سعر: {d.current_price} • طلب: {d.demand_score}</p>
          </div>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.gacha_rarity_tiers?.color || "#888" }} />
          <Button size="icon" variant="ghost" onClick={() => deleteDoll(d.id)}><Trash2 className="h-3 w-3 text-red-400" /></Button>
        </div>
      ))}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent dir="rtl"><DialogHeader><DialogTitle>إضافة دمية</DialogTitle></DialogHeader>
          <DollForm onDone={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ["admin-gacha-dolls"] }); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DollForm({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const { data: rarities = [] } = useQuery({
    queryKey: ["admin-gacha-rarity"],
    queryFn: async () => {
      const { data } = await supabase.from("gacha_rarity_tiers" as any).select("*").order("display_order");
      return (data ?? []) as any[];
    },
  });
  const [form, setForm] = useState({ doll_number: 1, name: "", name_ar: "", description_ar: "", base_price: 100, current_price: 100, rarity_tier_id: "", image_url: "", is_tradable: true });

  const save = async () => {
    await supabase.from("gacha_dolls" as any).insert({ ...form, rarity_tier_id: form.rarity_tier_id || null });
    toast({ title: "تم الإضافة" });
    onDone();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">رقم الدمية</Label><Input type="number" value={form.doll_number} onChange={e => setForm(f => ({ ...f, doll_number: parseInt(e.target.value) || 1 }))} /></div>
        <div><Label className="text-xs">الندرة</Label>
          <Select value={form.rarity_tier_id} onValueChange={v => setForm(f => ({ ...f, rarity_tier_id: v }))}>
            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>{rarities.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name_ar}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label className="text-xs">الاسم (عربي)</Label><Input value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} /></div>
      <div><Label className="text-xs">الاسم (إنجليزي)</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">السعر الأساسي</Label><Input type="number" value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: parseInt(e.target.value) || 100, current_price: parseInt(e.target.value) || 100 }))} /></div>
        <div className="flex items-center gap-2 pt-5"><Switch checked={form.is_tradable} onCheckedChange={v => setForm(f => ({ ...f, is_tradable: v }))} /><Label className="text-xs">قابلة للتداول</Label></div>
      </div>
      <div><Label className="text-xs">رابط الصورة</Label><Input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} /></div>
      <Button onClick={save} disabled={!form.name_ar} className="w-full">حفظ</Button>
    </div>
  );
}

function RarityManager() {
  const { data: tiers = [] } = useQuery({
    queryKey: ["admin-gacha-rarity"],
    queryFn: async () => {
      const { data } = await supabase.from("gacha_rarity_tiers" as any).select("*").order("display_order");
      return (data ?? []) as any[];
    },
  });

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold">مستويات الندرة</h3>
      {tiers.map((t: any) => (
        <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg bg-card border border-border/20">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.color, boxShadow: `0 0 8px ${t.glow_color}` }} />
          <div className="flex-1">
            <p className="text-xs font-medium">{t.name_ar} ({t.name})</p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">وزن: {t.drop_weight}</span>
        </div>
      ))}
    </div>
  );
}

function CouponsManager() {
  return <div className="text-center text-sm text-muted-foreground py-8">قريباً - إدارة الكوبونات</div>;
}
function AdviceManager() {
  return <div className="text-center text-sm text-muted-foreground py-8">قريباً - إدارة النصائح</div>;
}
function GuaranteedManager() {
  return <div className="text-center text-sm text-muted-foreground py-8">قريباً - إدارة المكافآت المضمونة</div>;
}

function GachaSettingsManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings = [] } = useQuery({
    queryKey: ["admin-gacha-all-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("gacha_settings" as any).select("*");
      return (data ?? []) as any[];
    },
  });

  const updateSetting = async (key: string, value: any) => {
    await supabase.from("gacha_settings" as any).update({ value: JSON.stringify(value) }).eq("key", key);
    queryClient.invalidateQueries({ queryKey: ["admin-gacha-all-settings"] });
    toast({ title: "تم التحديث" });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold">الإعدادات العامة</h3>
      {settings.map((s: any) => (
        <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/20">
          <div className="flex-1">
            <p className="text-xs font-medium">{s.key}</p>
            {s.description && <p className="text-[10px] text-muted-foreground">{s.description}</p>}
          </div>
          {s.key === "gacha_enabled" ? (
            <Switch checked={s.value === true || s.value === "true"} onCheckedChange={v => updateSetting(s.key, v)} />
          ) : (
            <Input
              className="w-20 text-xs"
              value={String(s.value).replace(/"/g, "")}
              onBlur={e => updateSetting(s.key, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
