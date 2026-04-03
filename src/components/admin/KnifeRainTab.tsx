import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Ticket, Star, Zap, Trophy, BarChart3, Gift, Target, Crown, Plus, Trash2, Medal, RefreshCcw, Package, Search, Palette, Settings2, Gamepad2 } from "lucide-react";

interface ProductPickerValue {
  product_id: string | null;
  selected_color: string | null;
  selected_option_id: string | null;
}

function ProductPicker({ value, onChange, requireStock = false }: { value: ProductPickerValue; onChange: (val: ProductPickerValue, productName?: string, productImage?: string) => void; requireStock?: boolean; }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [settingStock, setSettingStock] = useState(false);
  const [manualStock, setManualStock] = useState(10);

  const { data: products = [] } = useQuery({
    queryKey: ["admin-products-picker-kr", search],
    queryFn: async () => {
      let q = supabase.from("products").select("id, name_ar, image_url, direct_stock, pre_order_stock, colors").order("created_at", { ascending: false }).limit(20);
      if (search.trim()) q = q.ilike("name_ar", `%${search}%`);
      const { data } = await q;
      return (data || []) as any[];
    },
    enabled: open,
  });

  const { data: selected } = useQuery({
    queryKey: ["admin-product-selected-kr", value.product_id],
    queryFn: async () => {
      if (!value.product_id) return null;
      const { data } = await supabase.from("products").select("id, name_ar, image_url, direct_stock, pre_order_stock, colors").eq("id", value.product_id).single();
      return data as any;
    },
    enabled: !!value.product_id,
  });

  const { data: options = [] } = useQuery({
    queryKey: ["admin-product-options-kr", value.product_id],
    queryFn: async () => {
      if (!value.product_id) return [];
      const { data } = await supabase.from("product_options").select("id, name_ar, image_url, stock_quantity").eq("product_id", value.product_id);
      return (data || []) as any[];
    },
    enabled: !!value.product_id,
  });

  const colors: any[] = selected?.colors ? (Array.isArray(selected.colors) ? selected.colors : []) : [];
  const hasColors = colors.length > 0;
  const hasOptions = options.length > 0;

  const getStockDisplay = (p: any) => {
    if (p.direct_stock != null && p.direct_stock > 0) return `مباشر: ${p.direct_stock}`;
    if (p.pre_order_stock != null && p.pre_order_stock > 0) return `طلب مسبق: ${p.pre_order_stock}`;
    const cols = Array.isArray(p?.colors) ? p.colors : [];
    let total = 0;
    for (const c of cols) { if (c?.option_stocks && typeof c.option_stocks === 'object') { for (const v of Object.values(c.option_stocks)) total += Math.max(0, Number(v) || 0); } }
    if (total > 0) return `مباشر (ألوان): ${total}`;
    return "مخزون: —";
  };

  if (!open && !value.product_id) {
    return <Button variant="outline" size="sm" className="text-xs gap-1 w-full" onClick={() => setOpen(true)}><Package className="h-3.5 w-3.5" /> اختر منتج</Button>;
  }

  if (!open && value.product_id && selected) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 bg-muted/30 rounded-md p-2 text-xs">
          {selected.image_url && <img src={selected.image_url} className="h-8 w-8 rounded object-cover" />}
          <div className="flex-1 min-w-0">
            <div className="truncate text-foreground font-medium">{selected.name_ar}</div>
            <div className="text-muted-foreground">{getStockDisplay(selected)}</div>
          </div>
          <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => onChange({ product_id: null, selected_color: null, selected_option_id: null })}>إزالة</Button>
        </div>
        {hasColors && (
          <div className="bg-muted/10 rounded-md p-2 space-y-1">
            <label className="text-[10px] text-muted-foreground flex items-center gap-1"><Palette className="h-3 w-3" /> اللون</label>
            <Select value={value.selected_color || "__none__"} onValueChange={v => onChange({ ...value, selected_color: v === "__none__" ? null : v })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="بدون تحديد لون" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">بدون تحديد</SelectItem>
                {colors.map((c: any, i: number) => <SelectItem key={i} value={c.name || c.name_ar || `color_${i}`}>{c.name_ar || c.name || `لون ${i+1}`}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {hasOptions && (
          <div className="bg-muted/10 rounded-md p-2 space-y-1">
            <label className="text-[10px] text-muted-foreground flex items-center gap-1"><Settings2 className="h-3 w-3" /> الخيار</label>
            <Select value={value.selected_option_id || "__none__"} onValueChange={v => onChange({ ...value, selected_option_id: v === "__none__" ? null : v })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="بدون تحديد خيار" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">بدون تحديد</SelectItem>
                {options.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name_ar} {o.stock_quantity != null ? `(${o.stock_quantity})` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 bg-muted/20 rounded-lg p-3 border border-border">
      <div className="flex items-center gap-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن منتج..." className="h-7 text-xs" autoFocus />
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setOpen(false)}>إغلاق</Button>
      </div>
      <div className="max-h-40 overflow-y-auto space-y-1">
        {products.map((p: any) => (
          <button key={p.id} onClick={() => { onChange({ product_id: p.id, selected_color: null, selected_option_id: null }, p.name_ar, p.image_url); setOpen(false); setSearch(""); }} className="flex items-center gap-2 w-full text-right p-2 rounded-md hover:bg-muted/50 transition-colors text-xs">
            {p.image_url && <img src={p.image_url} className="h-7 w-7 rounded object-cover shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="truncate text-foreground">{p.name_ar}</div>
              <div className="text-muted-foreground text-[10px]">{getStockDisplay(p)}</div>
            </div>
          </button>
        ))}
        {products.length === 0 && <p className="text-center text-muted-foreground text-[10px] py-2">لا توجد نتائج</p>}
      </div>
    </div>
  );
}

function PrizeVariantDisplay({ productId, color, optionId }: { productId?: string | null; color?: string | null; optionId?: string | null }) {
  if (!productId || (!color && !optionId)) return null;
  return (
    <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-0.5">
      {color && <span className="flex items-center gap-0.5"><Palette className="h-2.5 w-2.5" /> {color}</span>}
      {color && optionId && <span>•</span>}
      {optionId && <span className="flex items-center gap-0.5"><Settings2 className="h-2.5 w-2.5" /> خيار محدد</span>}
    </div>
  );
}

export default function KnifeRainTab() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-knife-rain-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("knife_rain_settings").select("*").limit(1).single();
      return data as any;
    },
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ["admin-knife-rain-milestones"],
    queryFn: async () => {
      const { data } = await supabase.from("knife_rain_milestones" as any).select("*").order("target_score", { ascending: true });
      return (data || []) as any[];
    },
  });

  const { data: leaderboardPrizes = [] } = useQuery({
    queryKey: ["admin-knife-rain-lb-prizes"],
    queryFn: async () => {
      const { data } = await supabase.from("knife_rain_leaderboard_prizes" as any).select("*").order("position", { ascending: true });
      return (data || []) as any[];
    },
  });

  const { data: highScores = [] } = useQuery({
    queryKey: ["admin-knife-rain-high-scores"],
    queryFn: async () => {
      const { data } = await supabase.from("knife_rain_high_scores" as any).select("*").order("high_score", { ascending: false }).limit(10);
      return (data || []) as any[];
    },
  });

  const { data: winners = [] } = useQuery({
    queryKey: ["admin-knife-rain-winners"],
    queryFn: async () => {
      const { data } = await supabase.from("knife_rain_winners" as any).select("*").order("awarded_at", { ascending: false }).limit(20);
      return (data || []) as any[];
    },
  });

  const { data: sessionStats } = useQuery({
    queryKey: ["admin-knife-rain-stats"],
    queryFn: async () => {
      const { count } = await supabase.from("knife_rain_sessions" as any).select("*", { count: "exact", head: true });
      const { data: pointsData } = await supabase.from("knife_rain_sessions" as any).select("points_awarded").not("points_awarded", "is", null);
      const totalPoints = (pointsData || []).reduce((sum: number, r: any) => sum + (r.points_awarded || 0), 0);
      return { totalPlays: count || 0, totalPoints };
    },
  });

  const [form, setForm] = useState<any>(null);
  const s = form ?? settings;
  const [subTab, setSubTab] = useState<"settings" | "milestones" | "leaderboard" | "winners">("settings");
  const [newMilestone, setNewMilestone] = useState({ target_score: 100, prize_name_ar: "", stock: 10, product_id: null as string | null, selected_color: null as string | null, selected_option_id: null as string | null });
  const [newLbPrize, setNewLbPrize] = useState({ position: 1, prize_name_ar: "", product_id: null as string | null, selected_color: null as string | null, selected_option_id: null as string | null });

  const save = useMutation({
    mutationFn: async () => {
      if (!s || !settings?.id) throw new Error("لا توجد إعدادات");
      const { data, error } = await supabase.from("knife_rain_settings").update({
        game_enabled: s.game_enabled,
        entry_fee_tickets: s.entry_fee_tickets,
        points_per_knife: s.points_per_knife,
        stage_clear_bonus: s.stage_clear_bonus,
        boss_bonus: s.boss_bonus,
        game_points_per_knife: s.game_points_per_knife,
        game_combo_multiplier: s.game_combo_multiplier,
        max_daily_plays: s.max_daily_plays || null,
        updated_at: new Date().toISOString(),
      }).eq("id", settings.id).select("id").single();
      if (error) throw error;
      if (!data) throw new Error("لم يتم التحديث");
    },
    onSuccess: () => { toast.success("تم حفظ الإعدادات"); queryClient.invalidateQueries({ queryKey: ["admin-knife-rain-settings"] }); queryClient.invalidateQueries({ queryKey: ["knife-rain-enabled"] }); setForm(null); },
    onError: (e: any) => toast.error(e?.message || "فشل حفظ الإعدادات"),
  });

  const addMilestone = useMutation({
    mutationFn: async () => {
      if (!newMilestone.prize_name_ar.trim() && !newMilestone.product_id) throw new Error("أدخل اسم الجائزة أو اختر منتج");
      const { error } = await supabase.from("knife_rain_milestones" as any).insert({
        target_score: newMilestone.target_score, prize_name_ar: newMilestone.prize_name_ar || "منتج", stock: newMilestone.stock,
        product_id: newMilestone.product_id, selected_color: newMilestone.selected_color, selected_option_id: newMilestone.selected_option_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تمت الإضافة"); queryClient.invalidateQueries({ queryKey: ["admin-knife-rain-milestones"] }); setNewMilestone({ target_score: 100, prize_name_ar: "", stock: 10, product_id: null, selected_color: null, selected_option_id: null }); },
    onError: (e: any) => toast.error(e.message || "فشل الإضافة"),
  });

  const deleteMilestone = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("knife_rain_milestones" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); queryClient.invalidateQueries({ queryKey: ["admin-knife-rain-milestones"] }); },
  });

  const toggleMilestone = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => { const { error } = await supabase.from("knife_rain_milestones" as any).update({ is_active: active } as any).eq("id", id); if (error) throw error; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-knife-rain-milestones"] }),
  });

  const addLbPrize = useMutation({
    mutationFn: async () => {
      if (!newLbPrize.prize_name_ar.trim() && !newLbPrize.product_id) throw new Error("أدخل اسم الجائزة أو اختر منتج");
      const { error } = await supabase.from("knife_rain_leaderboard_prizes" as any).insert({
        position: newLbPrize.position, prize_name_ar: newLbPrize.prize_name_ar || "منتج",
        product_id: newLbPrize.product_id, selected_color: newLbPrize.selected_color, selected_option_id: newLbPrize.selected_option_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تمت الإضافة"); queryClient.invalidateQueries({ queryKey: ["admin-knife-rain-lb-prizes"] }); setNewLbPrize({ position: 1, prize_name_ar: "", product_id: null, selected_color: null, selected_option_id: null }); },
    onError: (e: any) => toast.error(e.message || "فشل الإضافة"),
  });

  const deleteLbPrize = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("knife_rain_leaderboard_prizes" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); queryClient.invalidateQueries({ queryKey: ["admin-knife-rain-lb-prizes"] }); },
  });

  const awardWinners = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.rpc("admin_award_knife_rain_winners" as any); if (error) throw error; return data as any; },
    onSuccess: (data: any) => {
      toast.success(`تم تتويج ${data?.winners_awarded ?? 0} فائزين`);
      queryClient.invalidateQueries({ queryKey: ["admin-knife-rain-high-scores"] });
      queryClient.invalidateQueries({ queryKey: ["admin-knife-rain-winners"] });
    },
    onError: () => toast.error("فشل في تتويج الفائزين"),
  });

  const update = (key: string, value: any) => setForm((prev: any) => ({ ...(prev ?? settings), [key]: value }));

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!s) return <div className="text-center py-12 text-muted-foreground">لا توجد إعدادات</div>;

  const SUB_TABS = [
    { id: "settings" as const, label: "الإعدادات", icon: Zap },
    { id: "milestones" as const, label: "جوائز النقاط", icon: Target },
    { id: "leaderboard" as const, label: "المتصدرين", icon: Crown },
    { id: "winners" as const, label: "الفائزون", icon: Medal },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {SUB_TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setSubTab(t.id)} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${subTab === t.id ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-muted/50"}`}>
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Settings Tab */}
      {subTab === "settings" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <BarChart3 className="h-5 w-5 mx-auto text-primary mb-1" />
              <div className="text-xl font-bold text-foreground font-mono">{sessionStats?.totalPlays ?? s.total_plays ?? 0}</div>
              <div className="text-xs text-muted-foreground">إجمالي المحاولات</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <Star className="h-5 w-5 mx-auto text-primary mb-1" />
              <div className="text-xl font-bold text-foreground font-mono">{sessionStats?.totalPoints ?? s.total_points_distributed ?? 0}</div>
              <div className="text-xs text-muted-foreground">النقاط الموزعة</div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-muted/20 rounded-lg p-4">
            <span className="text-sm font-medium text-foreground">تفعيل اللعبة</span>
            <Switch checked={s.game_enabled} onCheckedChange={async (v) => {
              update("game_enabled", v);
              if (settings?.id) {
                const { data, error } = await supabase.from("knife_rain_settings").update({ game_enabled: v, updated_at: new Date().toISOString() }).eq("id", settings.id).select("game_enabled").single();
                if (error || !data) { toast.error("فشل تحديث حالة اللعبة"); update("game_enabled", !v); return; }
                toast.success(v ? "تم تفعيل اللعبة" : "تم تعطيل اللعبة");
                queryClient.invalidateQueries({ queryKey: ["admin-knife-rain-settings"] });
                queryClient.invalidateQueries({ queryKey: ["knife-rain-enabled"] });
              }
            }} />
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Ticket className="h-3.5 w-3.5" /> تكلفة الدخول (تذاكر)</label>
              <Input type="number" min={0} value={s.entry_fee_tickets} onChange={e => update("entry_fee_tickets", parseInt(e.target.value) || 0)} />
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
              <h4 className="text-xs font-bold font-mono flex items-center gap-1"><Star className="h-3.5 w-3.5 text-primary" /> نقاط الموقع (المكافآت)</h4>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">نقاط لكل سكين</label>
                <Input type="number" min={0} value={s.points_per_knife} onChange={e => update("points_per_knife", parseInt(e.target.value) || 0)} className="w-32" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">مكافأة إتمام مرحلة</label>
                <Input type="number" min={0} value={s.stage_clear_bonus} onChange={e => update("stage_clear_bonus", parseInt(e.target.value) || 0)} className="w-32" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">مكافأة هزيمة بوس</label>
                <Input type="number" min={0} value={s.boss_bonus} onChange={e => update("boss_bonus", parseInt(e.target.value) || 0)} className="w-32" />
              </div>
            </div>

            <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 space-y-3">
              <h4 className="text-xs font-bold font-mono flex items-center gap-1"><Gamepad2 className="h-3.5 w-3.5 text-accent-foreground" /> نقاط اللعبة (السكور)</h4>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">نقاط لعبة لكل سكين</label>
                <Input type="number" min={0} value={s.game_points_per_knife} onChange={e => update("game_points_per_knife", parseInt(e.target.value) || 0)} className="w-32" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">مضاعف الكومبو</label>
                <Input type="number" min={0} step={0.1} value={s.game_combo_multiplier} onChange={e => update("game_combo_multiplier", parseFloat(e.target.value) || 0)} className="w-32" />
              </div>
            </div>
          </div>

          <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ الإعدادات
          </Button>
        </div>
      )}

      {/* Milestones Tab */}
      {subTab === "milestones" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">أول مستخدم يصل للنقاط المطلوبة يربح الجائزة. يتم سحب المخزون تلقائياً عند الفوز.</p>
          <div className="bg-muted/20 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1"><Plus className="h-4 w-4" /> إضافة جائزة نقاط</h4>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[10px] text-muted-foreground">النقاط المطلوبة</label><Input type="number" min={1} value={newMilestone.target_score} onChange={e => setNewMilestone(p => ({ ...p, target_score: parseInt(e.target.value) || 1 }))} /></div>
              <div><label className="text-[10px] text-muted-foreground">عدد الفائزين (مخزون)</label><Input type="number" min={1} value={newMilestone.stock} onChange={e => setNewMilestone(p => ({ ...p, stock: parseInt(e.target.value) || 1 }))} /></div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">المنتج (الجائزة)</label>
              <ProductPicker requireStock value={{ product_id: newMilestone.product_id, selected_color: newMilestone.selected_color, selected_option_id: newMilestone.selected_option_id }} onChange={(val, name) => setNewMilestone(p => ({ ...p, product_id: val.product_id, selected_color: val.selected_color, selected_option_id: val.selected_option_id, prize_name_ar: name || p.prize_name_ar }))} />
            </div>
            {!newMilestone.product_id && <div><label className="text-[10px] text-muted-foreground">أو أدخل اسم الجائزة يدوياً</label><Input value={newMilestone.prize_name_ar} onChange={e => setNewMilestone(p => ({ ...p, prize_name_ar: e.target.value }))} placeholder="مثلاً: فلمنت مجاني" /></div>}
            <Button size="sm" onClick={() => addMilestone.mutate()} disabled={addMilestone.isPending}>{addMilestone.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} إضافة</Button>
          </div>
          {milestones.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">لا توجد جوائز نقاط بعد</div> : (
            <div className="space-y-2">
              {milestones.map((m: any) => (
                <div key={m.id} className={`flex items-center justify-between rounded-lg p-3 border ${m.is_active ? 'border-primary/20 bg-primary/5' : 'border-border bg-muted/20 opacity-60'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><Gift className="h-4 w-4 text-primary shrink-0" /><span className="text-sm font-medium text-foreground truncate">{m.prize_name_ar}</span></div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">🎯 {m.target_score} نقطة • 📦 {m.claimed_count}/{m.stock} مُطالَب</div>
                    <PrizeVariantDisplay productId={m.product_id} color={m.selected_color} optionId={m.selected_option_id} />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={m.is_active} onCheckedChange={v => toggleMilestone.mutate({ id: m.id, active: v })} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMilestone.mutate(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leaderboard Tab */}
      {subTab === "leaderboard" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">حدد جوائز لأعلى المراكز. عند التتويج يتم سحب المخزون وتصفير النقاط.</p>
          <div className="bg-muted/20 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1"><Plus className="h-4 w-4" /> جائزة مركز</h4>
            <div><label className="text-[10px] text-muted-foreground">المركز</label><Input type="number" min={1} max={10} value={newLbPrize.position} onChange={e => setNewLbPrize(p => ({ ...p, position: parseInt(e.target.value) || 1 }))} /></div>
            <div>
              <label className="text-[10px] text-muted-foreground">المنتج (الجائزة)</label>
              <ProductPicker requireStock value={{ product_id: newLbPrize.product_id, selected_color: newLbPrize.selected_color, selected_option_id: newLbPrize.selected_option_id }} onChange={(val, name) => setNewLbPrize(p => ({ ...p, product_id: val.product_id, selected_color: val.selected_color, selected_option_id: val.selected_option_id, prize_name_ar: name || p.prize_name_ar }))} />
            </div>
            {!newLbPrize.product_id && <div><label className="text-[10px] text-muted-foreground">أو أدخل اسم الجائزة يدوياً</label><Input value={newLbPrize.prize_name_ar} onChange={e => setNewLbPrize(p => ({ ...p, prize_name_ar: e.target.value }))} /></div>}
            <Button size="sm" onClick={() => addLbPrize.mutate()} disabled={addLbPrize.isPending}>{addLbPrize.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} إضافة</Button>
          </div>
          {leaderboardPrizes.length > 0 && (
            <div className="space-y-2">
              {leaderboardPrizes.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg p-3 border border-border bg-muted/10">
                  <div className="flex items-center gap-2"><span className="text-lg">🏅</span><div><span className="text-sm font-medium text-foreground">المركز {p.position}: {p.prize_name_ar}</span><PrizeVariantDisplay productId={p.product_id} color={p.selected_color} optionId={p.selected_option_id} /></div></div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteLbPrize.mutate(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          )}
          <div className="bg-muted/20 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1 mb-3"><Crown className="h-4 w-4 text-primary" /> المتصدرون الحاليون</h4>
            {highScores.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">لا توجد نقاط بعد</p> : (
              <div className="space-y-1.5">
                {highScores.map((hs: any, i: number) => {
                  const prize = leaderboardPrizes.find((p: any) => p.position === i + 1);
                  return (
                    <div key={hs.id} className={`flex items-center justify-between rounded-md p-2 text-xs ${prize ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'}`}>
                      <span className="font-mono font-bold text-foreground">#{i + 1}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground font-mono">{hs.high_score}</span>
                        {prize && <span className="text-[10px] text-primary">🎁 {prize.prize_name_ar}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <Button onClick={() => { if (confirm("هل أنت متأكد؟ سيتم تتويج الفائزين وتصفير النقاط.")) awardWinners.mutate(); }} disabled={awardWinners.isPending || highScores.length === 0} className="w-full">
            {awardWinners.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} تتويج الفائزين وبدء موسم جديد
          </Button>
        </div>
      )}

      {/* Winners Tab */}
      {subTab === "winners" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-1"><Medal className="h-4 w-4 text-primary" /> سجل الفائزين</h3>
          {winners.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">لا يوجد فائزون بعد</div> : (
            <div className="space-y-2">
              {winners.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between rounded-lg p-3 border border-border bg-muted/10">
                  <div className="text-[10px] text-muted-foreground">{new Date(w.awarded_at).toLocaleDateString('ar-IQ')}</div>
                  <div className="text-right">
                    <div className="text-xs font-medium text-foreground">{w.user_id?.slice(0, 8)}...</div>
                    <div className="text-[10px] text-muted-foreground">{w.prize_type === 'leaderboard' ? `🏅 المركز ${w.position}` : `🎯 ${w.score} نقطة`} • {w.prize_name_ar}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
