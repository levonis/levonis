import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Ticket, Star, Zap, Trophy, BarChart3, Gift, Target, Crown, Plus, Trash2, Medal, RefreshCcw, Package, Search } from "lucide-react";

function ProductPicker({ value, onChange }: { value: string | null; onChange: (id: string | null, name?: string, image?: string) => void }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["admin-products-picker", search],
    queryFn: async () => {
      let q = supabase.from("products").select("id, name_ar, image_url, direct_stock").order("created_at", { ascending: false }).limit(20);
      if (search.trim()) q = q.ilike("name_ar", `%${search}%`);
      const { data } = await q;
      return (data || []) as any[];
    },
    enabled: open,
  });

  const { data: selected } = useQuery({
    queryKey: ["admin-product-selected", value],
    queryFn: async () => {
      if (!value) return null;
      const { data } = await supabase.from("products").select("id, name_ar, image_url, direct_stock").eq("id", value).single();
      return data as any;
    },
    enabled: !!value,
  });

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        {value && selected ? (
          <div className="flex items-center gap-2 flex-1 bg-muted/30 rounded-md p-2 text-xs">
            {selected.image_url && <img src={selected.image_url} className="h-8 w-8 rounded object-cover" />}
            <div className="flex-1 min-w-0">
              <div className="truncate text-foreground font-medium">{selected.name_ar}</div>
              <div className="text-muted-foreground">مخزون: {selected.direct_stock ?? 0}</div>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => { onChange(null); }}>إزالة</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="text-xs gap-1 w-full" onClick={() => setOpen(true)}>
            <Package className="h-3.5 w-3.5" /> اختر منتج
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 bg-muted/20 rounded-lg p-3 border border-border">
      <div className="flex items-center gap-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ابحث عن منتج..."
          className="h-7 text-xs"
          autoFocus
        />
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setOpen(false)}>إغلاق</Button>
      </div>
      <div className="max-h-40 overflow-y-auto space-y-1">
        {products.map((p: any) => (
          <button
            key={p.id}
            onClick={() => {
              onChange(p.id, p.name_ar, p.image_url);
              setOpen(false);
              setSearch("");
            }}
            className="flex items-center gap-2 w-full text-right p-2 rounded-md hover:bg-muted/50 transition-colors text-xs"
          >
            {p.image_url && <img src={p.image_url} className="h-7 w-7 rounded object-cover shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="truncate text-foreground">{p.name_ar}</div>
              <div className="text-muted-foreground text-[10px]">مخزون: {p.direct_stock ?? 0}</div>
            </div>
          </button>
        ))}
        {products.length === 0 && <p className="text-center text-muted-foreground text-[10px] py-2">لا توجد نتائج</p>}
      </div>
    </div>
  );
}

export default function StackGameTab() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-stack-game-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("stack_game_settings").select("*").limit(1).single();
      return data as any;
    },
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ["admin-stack-milestones"],
    queryFn: async () => {
      const { data } = await supabase.from("stack_game_milestones" as any).select("*").order("target_score", { ascending: true });
      return (data || []) as any[];
    },
  });

  const { data: leaderboardPrizes = [] } = useQuery({
    queryKey: ["admin-stack-leaderboard-prizes"],
    queryFn: async () => {
      const { data } = await supabase.from("stack_game_leaderboard_prizes" as any).select("*").order("position", { ascending: true });
      return (data || []) as any[];
    },
  });

  const { data: highScores = [] } = useQuery({
    queryKey: ["admin-stack-high-scores"],
    queryFn: async () => {
      const { data } = await supabase.from("stack_game_high_scores" as any).select("*").order("high_score", { ascending: false }).limit(10);
      return (data || []) as any[];
    },
  });

  const { data: winners = [] } = useQuery({
    queryKey: ["admin-stack-winners"],
    queryFn: async () => {
      const { data } = await supabase.from("stack_game_winners" as any).select("*").order("awarded_at", { ascending: false }).limit(20);
      return (data || []) as any[];
    },
  });

  const [form, setForm] = useState<any>(null);
  const s = form ?? settings;
  const [subTab, setSubTab] = useState<"settings" | "milestones" | "leaderboard" | "winners">("settings");
  const [newMilestone, setNewMilestone] = useState({ target_score: 100, prize_name_ar: "", stock: 10, product_id: null as string | null });
  const [newLbPrize, setNewLbPrize] = useState({ position: 1, prize_name_ar: "", product_id: null as string | null });

  const save = useMutation({
    mutationFn: async () => {
      if (!s || !settings?.id) throw new Error("لا توجد إعدادات");
      const { error } = await supabase
        .from("stack_game_settings")
        .update({
          game_enabled: s.game_enabled,
          entry_fee_tickets: s.entry_fee_tickets,
          points_per_block: s.points_per_block,
          perfect_bonus_points: s.perfect_bonus_points,
          combo_bonus_multiplier: s.combo_bonus_multiplier,
          max_daily_plays: s.max_daily_plays || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ الإعدادات");
      queryClient.invalidateQueries({ queryKey: ["admin-stack-game-settings"] });
      setForm(null);
    },
    onError: () => toast.error("فشل حفظ الإعدادات"),
  });

  const addMilestone = useMutation({
    mutationFn: async () => {
      if (!newMilestone.prize_name_ar.trim() && !newMilestone.product_id) throw new Error("أدخل اسم الجائزة أو اختر منتج");
      const { error } = await supabase.from("stack_game_milestones" as any).insert({
        target_score: newMilestone.target_score,
        prize_name_ar: newMilestone.prize_name_ar || "منتج",
        stock: newMilestone.stock,
        product_id: newMilestone.product_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إضافة الجائزة");
      queryClient.invalidateQueries({ queryKey: ["admin-stack-milestones"] });
      setNewMilestone({ target_score: 100, prize_name_ar: "", stock: 10, product_id: null });
    },
    onError: (e: any) => toast.error(e.message || "فشل الإضافة"),
  });

  const deleteMilestone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stack_game_milestones" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      queryClient.invalidateQueries({ queryKey: ["admin-stack-milestones"] });
    },
  });

  const toggleMilestone = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("stack_game_milestones" as any).update({ is_active: active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-stack-milestones"] }),
  });

  const addLbPrize = useMutation({
    mutationFn: async () => {
      if (!newLbPrize.prize_name_ar.trim() && !newLbPrize.product_id) throw new Error("أدخل اسم الجائزة أو اختر منتج");
      const { error } = await supabase.from("stack_game_leaderboard_prizes" as any).insert({
        position: newLbPrize.position,
        prize_name_ar: newLbPrize.prize_name_ar || "منتج",
        product_id: newLbPrize.product_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت الإضافة");
      queryClient.invalidateQueries({ queryKey: ["admin-stack-leaderboard-prizes"] });
      setNewLbPrize({ position: 1, prize_name_ar: "", product_id: null });
    },
    onError: (e: any) => toast.error(e.message || "فشل الإضافة (قد يكون المركز مكرر)"),
  });

  const deleteLbPrize = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stack_game_leaderboard_prizes" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      queryClient.invalidateQueries({ queryKey: ["admin-stack-leaderboard-prizes"] });
    },
  });

  const awardWinners = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_award_stack_winners" as any);
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data: any) => {
      toast.success(`تم تتويج ${data?.winners_awarded ?? 0} فائزين وبدء موسم جديد #${data?.new_season ?? ''}`);
      queryClient.invalidateQueries({ queryKey: ["admin-stack-high-scores"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stack-winners"] });
    },
    onError: () => toast.error("فشل في تتويج الفائزين"),
  });

  const update = (key: string, value: any) => setForm((prev: any) => ({ ...(prev ?? settings), [key]: value }));

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

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
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                subTab === t.id ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
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
              <div className="text-xl font-bold text-foreground font-mono">{s.total_plays ?? 0}</div>
              <div className="text-xs text-muted-foreground">إجمالي المحاولات</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <Star className="h-5 w-5 mx-auto text-primary mb-1" />
              <div className="text-xl font-bold text-foreground font-mono">{s.total_points_distributed ?? 0}</div>
              <div className="text-xs text-muted-foreground">النقاط الموزعة</div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-muted/20 rounded-lg p-4">
            <span className="text-sm font-medium text-foreground">تفعيل اللعبة</span>
            <Switch checked={s.game_enabled} onCheckedChange={(v) => update("game_enabled", v)} />
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Ticket className="h-3.5 w-3.5" /> تكلفة الدخول (تذاكر)</label>
              <Input type="number" min={0} value={s.entry_fee_tickets} onChange={(e) => update("entry_fee_tickets", parseInt(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Star className="h-3.5 w-3.5" /> نقاط لكل قطعة</label>
              <Input type="number" min={0} value={s.points_per_block} onChange={(e) => update("points_per_block", parseInt(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Zap className="h-3.5 w-3.5" /> مكافأة التكديس المثالي</label>
              <Input type="number" min={0} value={s.perfect_bonus_points} onChange={(e) => update("perfect_bonus_points", parseInt(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Trophy className="h-3.5 w-3.5" /> مضاعف الكومبو</label>
              <Input type="number" min={0} step={0.1} value={s.combo_bonus_multiplier} onChange={(e) => update("combo_bonus_multiplier", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">الحد اليومي (اتركه فارغ = بدون حد)</label>
              <Input type="number" min={0} value={s.max_daily_plays ?? ""} onChange={(e) => update("max_daily_plays", e.target.value ? parseInt(e.target.value) : null)} placeholder="بدون حد" />
            </div>
          </div>

          <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ الإعدادات
          </Button>
        </div>
      )}

      {/* Milestones Tab */}
      {subTab === "milestones" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">أول مستخدم يصل للنقاط المطلوبة يربح الجائزة (منتج من المتجر). يتم سحب المخزون تلقائياً عند الفوز.</p>

          <div className="bg-muted/20 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1"><Plus className="h-4 w-4" /> إضافة جائزة نقاط</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">النقاط المطلوبة</label>
                <Input type="number" min={1} value={newMilestone.target_score} onChange={e => setNewMilestone(p => ({ ...p, target_score: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">عدد الفائزين (مخزون)</label>
                <Input type="number" min={1} value={newMilestone.stock} onChange={e => setNewMilestone(p => ({ ...p, stock: parseInt(e.target.value) || 1 }))} />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">المنتج (الجائزة)</label>
              <ProductPicker
                value={newMilestone.product_id}
                onChange={(id, name) => setNewMilestone(p => ({ ...p, product_id: id, prize_name_ar: name || p.prize_name_ar }))}
              />
            </div>
            {!newMilestone.product_id && (
              <div>
                <label className="text-[10px] text-muted-foreground">أو أدخل اسم الجائزة يدوياً</label>
                <Input value={newMilestone.prize_name_ar} onChange={e => setNewMilestone(p => ({ ...p, prize_name_ar: e.target.value }))} placeholder="مثلاً: فلمنت مجاني" />
              </div>
            )}
            <Button size="sm" onClick={() => addMilestone.mutate()} disabled={addMilestone.isPending}>
              {addMilestone.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              إضافة
            </Button>
          </div>

          {milestones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">لا توجد جوائز نقاط بعد</div>
          ) : (
            <div className="space-y-2">
              {milestones.map((m: any) => (
                <div key={m.id} className={`flex items-center justify-between rounded-lg p-3 border ${m.is_active ? 'border-primary/20 bg-primary/5' : 'border-border bg-muted/20 opacity-60'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Gift className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate">{m.prize_name_ar}</span>
                      {m.product_id && <Package className="h-3 w-3 text-muted-foreground" />}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      🎯 {m.target_score} نقطة • 📦 {m.claimed_count}/{m.stock} مُطالَب
                      {m.product_id && " • مرتبط بمنتج (سحب مخزون تلقائي)"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={m.is_active} onCheckedChange={v => toggleMilestone.mutate({ id: m.id, active: v })} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMilestone.mutate(m.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
          <p className="text-xs text-muted-foreground">حدد جوائز (منتجات) لأعلى المراكز. عند التتويج يتم سحب المخزون تلقائياً وتصفير النقاط.</p>

          <div className="bg-muted/20 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1"><Plus className="h-4 w-4" /> جائزة مركز</h4>
            <div>
              <label className="text-[10px] text-muted-foreground">المركز</label>
              <Input type="number" min={1} max={10} value={newLbPrize.position} onChange={e => setNewLbPrize(p => ({ ...p, position: parseInt(e.target.value) || 1 }))} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">المنتج (الجائزة)</label>
              <ProductPicker
                value={newLbPrize.product_id}
                onChange={(id, name) => setNewLbPrize(p => ({ ...p, product_id: id, prize_name_ar: name || p.prize_name_ar }))}
              />
            </div>
            {!newLbPrize.product_id && (
              <div>
                <label className="text-[10px] text-muted-foreground">أو أدخل اسم الجائزة يدوياً</label>
                <Input value={newLbPrize.prize_name_ar} onChange={e => setNewLbPrize(p => ({ ...p, prize_name_ar: e.target.value }))} placeholder="مثلاً: فلمنت مجاني" />
              </div>
            )}
            <Button size="sm" onClick={() => addLbPrize.mutate()} disabled={addLbPrize.isPending}>
              {addLbPrize.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              إضافة
            </Button>
          </div>

          {leaderboardPrizes.length > 0 && (
            <div className="space-y-2">
              {leaderboardPrizes.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg p-3 border border-border bg-muted/10">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏅</span>
                    <div>
                      <span className="text-sm font-medium text-foreground">المركز {p.position}: {p.prize_name_ar}</span>
                      {p.product_id && <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" /> مرتبط بمنتج</div>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteLbPrize.mutate(p.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Current leaderboard */}
          <div className="bg-muted/20 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1 mb-3"><Crown className="h-4 w-4 text-primary" /> المتصدرون الحاليون</h4>
            {highScores.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">لا توجد نقاط بعد</p>
            ) : (
              <div className="space-y-1.5">
                {highScores.map((hs: any, i: number) => {
                  const prize = leaderboardPrizes.find((p: any) => p.position === i + 1);
                  return (
                    <div key={hs.id} className={`flex items-center justify-between rounded-md p-2 text-xs ${prize ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground w-5">#{i + 1}</span>
                        <span className="text-muted-foreground font-mono">{hs.user_id?.slice(0, 8)}...</span>
                      </div>
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

          <Button
            onClick={() => {
              if (confirm("هل أنت متأكد؟ سيتم تتويج الفائزين وسحب المخزون وتصفير جميع النقاط لبدء موسم جديد.")) {
                awardWinners.mutate();
              }
            }}
            disabled={awardWinners.isPending || highScores.length === 0}
            variant="default"
            className="w-full"
          >
            {awardWinners.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            تتويج الفائزين وبدء موسم جديد
          </Button>
        </div>
      )}

      {/* Winners Tab */}
      {subTab === "winners" && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-1"><Medal className="h-4 w-4 text-primary" /> سجل الفائزين</h4>
          {winners.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">لا يوجد فائزون بعد</p>
          ) : (
            <div className="space-y-2">
              {winners.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between rounded-lg p-3 border border-border bg-muted/10">
                  <div>
                    <div className="text-sm font-medium text-foreground flex items-center gap-1">
                      {w.prize_name_ar}
                      {w.product_id && <Package className="h-3 w-3 text-muted-foreground" />}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {w.prize_type === 'leaderboard' ? `🏅 المركز ${w.position}` : `🎯 ${w.score} نقطة`}
                      {w.season && ` • الموسم ${w.season}`}
                      • {new Date(w.awarded_at).toLocaleDateString('ar-IQ')}
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">{w.user_id?.slice(0, 8)}...</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
