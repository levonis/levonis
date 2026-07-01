// @ts-nocheck
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Ticket, Star, Zap, Trophy, BarChart3, Gift, Target, Crown, Plus, Trash2, Medal, RefreshCcw, Package, Search, Palette, Settings2, Gamepad2, Timer, Globe } from "lucide-react";
import SeasonAdminFields from "./SeasonAdminFields";

interface ProductPickerValue { product_id: string | null; selected_color: string | null; selected_option_id: string | null; }

function ProductPicker({ value, onChange }: { value: ProductPickerValue; onChange: (val: ProductPickerValue, productName?: string) => void }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["admin-products-picker-cr", search],
    queryFn: async () => {
      let q = (supabase as any).from("products_admin").select("id, name_ar, image_url, direct_stock, pre_order_stock, colors").order("created_at", { ascending: false }).limit(20);
      if (search.trim()) q = q.ilike("name_ar", `%${search}%`);
      const { data } = await q;
      return (data || []) as any[];
    },
    enabled: open,
  });

  const { data: selected } = useQuery({
    queryKey: ["admin-product-selected-cr", value.product_id],
    queryFn: async () => {
      if (!value.product_id) return null;
      const { data } = await (supabase as any).from("products_admin").select("id, name_ar, image_url, colors").eq("id", value.product_id).single();
      return data as any;
    },
    enabled: !!value.product_id,
  });

  const { data: options = [] } = useQuery({
    queryKey: ["admin-product-options-cr", value.product_id],
    queryFn: async () => {
      if (!value.product_id) return [];
      const { data } = await supabase.from("product_options").select("id, name_ar, stock_quantity").eq("product_id", value.product_id);
      return (data || []) as any[];
    },
    enabled: !!value.product_id,
  });

  const colors: any[] = selected?.colors ? (Array.isArray(selected.colors) ? selected.colors : []) : [];

  if (!open && !value.product_id) {
    return <Button variant="outline" size="sm" className="text-xs gap-1 w-full" onClick={() => setOpen(true)}><Package className="h-3.5 w-3.5" /> اختر منتج</Button>;
  }

  if (!open && value.product_id && selected) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 bg-muted/30 rounded-md p-2 text-xs">
          {selected.image_url && <img src={selected.image_url} className="h-8 w-8 rounded object-cover" loading="lazy" decoding="async" />}
          <div className="flex-1 min-w-0"><div className="truncate text-foreground font-medium">{selected.name_ar}</div></div>
          <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => onChange({ product_id: null, selected_color: null, selected_option_id: null })}>إزالة</Button>
        </div>
        {colors.length > 0 && (
          <Select value={value.selected_color || "__none__"} onValueChange={v => onChange({ ...value, selected_color: v === "__none__" ? null : v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="لون" /></SelectTrigger>
            <SelectContent><SelectItem value="__none__">بدون</SelectItem>{colors.map((c: any, i: number) => <SelectItem key={i} value={c.name || `color_${i}`}>{c.name_ar || c.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {options.length > 0 && (
          <Select value={value.selected_option_id || "__none__"} onValueChange={v => onChange({ ...value, selected_option_id: v === "__none__" ? null : v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="خيار" /></SelectTrigger>
            <SelectContent><SelectItem value="__none__">بدون</SelectItem>{options.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name_ar}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 bg-muted/20 rounded-lg p-3 border border-border">
      <div className="flex items-center gap-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث..." className="h-7 text-xs" autoFocus />
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setOpen(false)}>إغلاق</Button>
      </div>
      <div className="max-h-40 overflow-y-auto space-y-1">
        {products.map((p: any) => (
          <button key={p.id} onClick={() => { onChange({ product_id: p.id, selected_color: null, selected_option_id: null }, p.name_ar); setOpen(false); setSearch(""); }} className="flex items-center gap-2 w-full text-right p-2 rounded-md hover:bg-muted/50 text-xs">
            {p.image_url && <img src={p.image_url} className="h-7 w-7 rounded object-cover shrink-0" loading="lazy" decoding="async" />}
            <div className="flex-1 min-w-0"><div className="truncate text-foreground">{p.name_ar}</div></div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SeasonCountdown({ endsAt }: { endsAt: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [endsAt]);

  if (!endsAt) return null;
  const diff = new Date(endsAt).getTime() - now;
  if (diff <= 0) return <span className="text-xs text-primary font-bold">انتهى الموسم — جاري توزيع الجوائز</span>;

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return (
    <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg p-3">
      <Timer className="h-4 w-4 text-primary shrink-0" />
      <div className="text-xs text-muted-foreground">ينتهي الموسم خلال:</div>
      <div className="font-mono font-bold text-primary text-sm">
        {d > 0 && `${d}ي `}{h}س {m}د {s}ث
      </div>
    </div>
  );
}

export default function CrossyRoadTab() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-crossy-road-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("crossy_road_settings").select("*").limit(1).single();
      return data as any;
    },
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ["admin-crossy-road-milestones"],
    queryFn: async () => {
      const { data } = await supabase.from("crossy_road_milestones" as any).select("*").order("target_score", { ascending: true });
      return (data || []) as any[];
    },
  });

  const { data: leaderboardPrizes = [] } = useQuery({
    queryKey: ["admin-crossy-road-lb-prizes"],
    queryFn: async () => {
      const { data } = await supabase.from("crossy_road_leaderboard_prizes" as any).select("*").order("position", { ascending: true });
      return (data || []) as any[];
    },
  });

  const { data: highScores = [] } = useQuery({
    queryKey: ["admin-crossy-road-high-scores"],
    queryFn: async () => {
      const { data } = await supabase.from("crossy_road_high_scores" as any).select("*").order("high_score", { ascending: false }).limit(10);
      return (data || []) as any[];
    },
  });

  const { data: allTimeScores = [] } = useQuery({
    queryKey: ["admin-crossy-road-alltime-scores"],
    queryFn: async () => {
      const { data } = await supabase.from("crossy_road_high_scores" as any).select("*").gt("all_time_high_score", 0).order("all_time_high_score", { ascending: false }).limit(10);
      return (data || []) as any[];
    },
  });

  const { data: winners = [] } = useQuery({
    queryKey: ["admin-crossy-road-winners"],
    queryFn: async () => {
      const { data } = await supabase.from("crossy_road_winners" as any).select("*").order("awarded_at", { ascending: false }).limit(20);
      return (data || []) as any[];
    },
  });

  const { data: sessionStats } = useQuery({
    queryKey: ["admin-crossy-road-stats"],
    queryFn: async () => {
      const { count } = await supabase.from("crossy_road_sessions" as any).select("*", { count: "exact", head: true });
      const { data: pointsData } = await supabase.from("crossy_road_sessions" as any).select("points_awarded").not("points_awarded", "is", null);
      const totalPoints = (pointsData || []).reduce((sum: number, r: any) => sum + (r.points_awarded || 0), 0);
      return { totalPlays: count || 0, totalPoints };
    },
  });

  // Fetch profiles for leaderboard display
  const allUserIds = [...new Set([...highScores.map((h: any) => h.user_id), ...allTimeScores.map((h: any) => h.user_id), ...winners.map((w: any) => w.user_id)])].filter(Boolean);
  const { data: userProfiles = [] } = useQuery({
    queryKey: ["admin-crossy-profiles", allUserIds],
    queryFn: async () => {
      if (allUserIds.length === 0) return [];
      const { data } = await supabase.rpc("get_public_profiles", { p_user_ids: allUserIds } as any);
      return (data || []) as any[];
    },
    enabled: allUserIds.length > 0,
  });

  const getProfileName = (userId: string) => {
    const p = userProfiles.find((pr: any) => pr.id === userId);
    return p?.full_name || p?.username || userId?.slice(0, 8) + "...";
  };

  const [form, setForm] = useState<any>(null);
  const s = form ?? settings;
  const [subTab, setSubTab] = useState<"settings" | "milestones" | "leaderboard" | "winners">("settings");
  const [newMilestone, setNewMilestone] = useState({ target_score: 100, prize_name_ar: "", stock: 10, product_id: null as string | null, selected_color: null as string | null, selected_option_id: null as string | null });
  const [newLbPrize, setNewLbPrize] = useState({ position: 1, prize_name_ar: "", product_id: null as string | null, selected_color: null as string | null, selected_option_id: null as string | null });
  const [nextSeasonDelay, setNextSeasonDelay] = useState<number>(0);
  const [lbView, setLbView] = useState<"season" | "alltime">("season");

  const save = useMutation({
    mutationFn: async () => {
      if (!s || !settings?.id) throw new Error("لا توجد إعدادات");
      const { error } = await supabase.from("crossy_road_settings").update({
        game_enabled: s.game_enabled, entry_fee_tickets: s.entry_fee_tickets,
        points_per_step: s.points_per_step, bonus_coin_points: s.bonus_coin_points,
        score_per_step: s.score_per_step, score_per_coin: s.score_per_coin,
        max_daily_plays: s.max_daily_plays || null, 
        max_daily_points: s.max_daily_points || null,
        season_name: s.season_name,
        season_starts_at: s.season_starts_at,
        season_ends_at: s.season_ends_at,
        updated_at: new Date().toISOString(),
      } as any).eq("id", settings.id).select("id").single();
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حفظ الإعدادات"); queryClient.invalidateQueries({ queryKey: ["admin-crossy-road-settings"] }); queryClient.invalidateQueries({ queryKey: ["crossy-road-enabled"] }); setForm(null); },
    onError: (e: any) => toast.error(e?.message || "فشل الحفظ"),
  });

  const addMilestone = useMutation({
    mutationFn: async () => {
      if (!newMilestone.prize_name_ar.trim() && !newMilestone.product_id) throw new Error("أدخل اسم الجائزة أو اختر منتج");
      const { error } = await supabase.from("crossy_road_milestones" as any).insert({
        target_score: newMilestone.target_score, prize_name_ar: newMilestone.prize_name_ar || "منتج", stock: newMilestone.stock,
        product_id: newMilestone.product_id, selected_color: newMilestone.selected_color, selected_option_id: newMilestone.selected_option_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تمت الإضافة"); queryClient.invalidateQueries({ queryKey: ["admin-crossy-road-milestones"] }); setNewMilestone({ target_score: 100, prize_name_ar: "", stock: 10, product_id: null, selected_color: null, selected_option_id: null }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMilestone = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("crossy_road_milestones" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); queryClient.invalidateQueries({ queryKey: ["admin-crossy-road-milestones"] }); },
  });

  const toggleMilestone = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => { const { error } = await supabase.from("crossy_road_milestones" as any).update({ is_active: active } as any).eq("id", id); if (error) throw error; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-crossy-road-milestones"] }),
  });

  const addLbPrize = useMutation({
    mutationFn: async () => {
      if (!newLbPrize.prize_name_ar.trim() && !newLbPrize.product_id) throw new Error("أدخل اسم الجائزة أو اختر منتج");
      const { error } = await supabase.from("crossy_road_leaderboard_prizes" as any).insert({
        position: newLbPrize.position, prize_name_ar: newLbPrize.prize_name_ar || "منتج",
        product_id: newLbPrize.product_id, selected_color: newLbPrize.selected_color, selected_option_id: newLbPrize.selected_option_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تمت الإضافة"); queryClient.invalidateQueries({ queryKey: ["admin-crossy-road-lb-prizes"] }); setNewLbPrize({ position: 1, prize_name_ar: "", product_id: null, selected_color: null, selected_option_id: null }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteLbPrize = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("crossy_road_leaderboard_prizes" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); queryClient.invalidateQueries({ queryKey: ["admin-crossy-road-lb-prizes"] }); },
  });

  const awardWinners = useMutation({
    mutationFn: async () => { 
      let startsAt: string | null = null;
      if (nextSeasonDelay > 0) {
        startsAt = new Date(Date.now() + nextSeasonDelay * 60 * 60 * 1000).toISOString();
      }
      const { data, error } = await supabase.rpc("admin_award_crossy_road_winners" as any, { 
        p_next_season_starts_at: startsAt 
      }); 
      if (error) throw error; 
      return data as any; 
    },
    onSuccess: (data: any) => {
      toast.success(`تم تتويج ${data?.winners_awarded ?? 0} فائزين`);
      queryClient.invalidateQueries({ queryKey: ["admin-crossy-road-high-scores"] });
      queryClient.invalidateQueries({ queryKey: ["admin-crossy-road-alltime-scores"] });
      queryClient.invalidateQueries({ queryKey: ["admin-crossy-road-winners"] });
      queryClient.invalidateQueries({ queryKey: ["admin-crossy-road-settings"] });
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

      {subTab === "settings" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <BarChart3 className="h-5 w-5 mx-auto text-primary mb-1" />
              <div className="text-xl font-bold text-foreground font-mono">{sessionStats?.totalPlays ?? 0}</div>
              <div className="text-xs text-muted-foreground">إجمالي المحاولات</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <Star className="h-5 w-5 mx-auto text-primary mb-1" />
              <div className="text-xl font-bold text-foreground font-mono">{sessionStats?.totalPoints ?? 0}</div>
              <div className="text-xs text-muted-foreground">النقاط الموزعة</div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-muted/20 rounded-lg p-4">
            <span className="text-sm font-medium text-foreground">تفعيل اللعبة</span>
            <Switch checked={s.game_enabled} onCheckedChange={async (v) => {
              update("game_enabled", v);
              if (settings?.id) {
                const { error, data } = await supabase.from("crossy_road_settings").update({ game_enabled: v, updated_at: new Date().toISOString() }).eq("id", settings.id).select("game_enabled").single();
                if (error || !data) { toast.error("فشل التحديث - تأكد من الصلاحيات"); update("game_enabled", !v); return; }
                toast.success(v ? "تم تفعيل اللعبة" : "تم تعطيل اللعبة");
                queryClient.invalidateQueries({ queryKey: ["admin-crossy-road-settings"] });
              }
            }} />
          </div>

          {/* Season countdown */}
          <SeasonCountdown endsAt={settings?.season_ends_at} />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Ticket className="h-3.5 w-3.5" /> تكلفة الدخول (تذاكر)</label>
            <Input type="number" min={0} value={s.entry_fee_tickets} onChange={e => update("entry_fee_tickets", parseInt(e.target.value) || 0)} />
          </div>

          {/* Site Points Section */}
          <div className="border border-border/30 rounded-lg p-4 space-y-4">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Star className="h-4 w-4 text-primary" /> نقاط الموقع
            </h4>
            <p className="text-[10px] text-muted-foreground">النقاط التي تُضاف لرصيد المستخدم في الموقع</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">نقاط لكل خطوة</label>
                <Input type="number" min={0} value={s.points_per_step} onChange={e => update("points_per_step", parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">نقاط لكل عملة ذهبية</label>
                <Input type="number" min={0} value={s.bonus_coin_points} onChange={e => update("bonus_coin_points", parseInt(e.target.value) || 0)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">الحد اليومي للنقاط (اتركه فارغاً = لا حد)</label>
              <Input type="number" min={0} value={s.max_daily_points ?? ""} onChange={e => update("max_daily_points", e.target.value ? parseInt(e.target.value) : null)} className="w-48" />
            </div>
          </div>

          {/* Game Score Section */}
          <div className="border border-border/30 rounded-lg p-4 space-y-4">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Gamepad2 className="h-4 w-4 text-primary" /> سكور اللعبة
            </h4>
            <p className="text-[10px] text-muted-foreground">النقاط المعروضة داخل اللعبة والتي تُسجَّل في لوحة المتصدرين</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">سكور لكل خطوة</label>
                <Input type="number" min={0} value={s.score_per_step ?? 1} onChange={e => update("score_per_step", parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">سكور لكل عملة ذهبية</label>
                <Input type="number" min={0} value={s.score_per_coin ?? 5} onChange={e => update("score_per_coin", parseInt(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">الحد اليومي للمحاولات (اتركه فارغاً = لا حد)</label>
            <Input type="number" min={0} value={s.max_daily_plays ?? ""} onChange={e => update("max_daily_plays", e.target.value ? parseInt(e.target.value) : null)} className="w-48" />
          </div>

          <SeasonAdminFields
            seasonName={s.season_name}
            seasonStartsAt={s.season_starts_at}
            seasonEndsAt={s.season_ends_at}
            onChange={(k, v) => update(k, v)}
          />

          <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ الإعدادات
          </Button>
        </div>
      )}

      {subTab === "milestones" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">أول مستخدم يصل للنقاط المطلوبة يربح الجائزة.</p>
          <div className="bg-muted/20 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1"><Plus className="h-4 w-4" /> إضافة جائزة نقاط</h4>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[10px] text-muted-foreground">النقاط المطلوبة</label><Input type="number" min={1} value={newMilestone.target_score} onChange={e => setNewMilestone(p => ({ ...p, target_score: parseInt(e.target.value) || 1 }))} /></div>
              <div><label className="text-[10px] text-muted-foreground">مخزون</label><Input type="number" min={1} value={newMilestone.stock} onChange={e => setNewMilestone(p => ({ ...p, stock: parseInt(e.target.value) || 1 }))} /></div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">المنتج</label>
              <ProductPicker value={{ product_id: newMilestone.product_id, selected_color: newMilestone.selected_color, selected_option_id: newMilestone.selected_option_id }} onChange={(val, name) => setNewMilestone(p => ({ ...p, ...val, prize_name_ar: name || p.prize_name_ar }))} />
            </div>
            {!newMilestone.product_id && <div><label className="text-[10px] text-muted-foreground">أو اسم الجائزة</label><Input value={newMilestone.prize_name_ar} onChange={e => setNewMilestone(p => ({ ...p, prize_name_ar: e.target.value }))} /></div>}
            <Button size="sm" onClick={() => addMilestone.mutate()} disabled={addMilestone.isPending}>{addMilestone.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} إضافة</Button>
          </div>
          {milestones.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">لا توجد جوائز</div> : (
            <div className="space-y-2">
              {milestones.map((m: any) => (
                <div key={m.id} className={`flex items-center justify-between rounded-lg p-3 border ${m.is_active ? "border-primary/20 bg-primary/5" : "border-border bg-muted/20 opacity-60"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><Gift className="h-4 w-4 text-primary shrink-0" /><span className="text-sm font-medium text-foreground truncate">{m.prize_name_ar}</span></div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">🎯 {m.target_score} نقطة • 📦 {m.claimed_count}/{m.stock}</div>
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

      {subTab === "leaderboard" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <SeasonAdminFields
              seasonName={s.season_name}
              seasonStartsAt={s.season_starts_at}
              seasonEndsAt={s.season_ends_at}
              onChange={(k, v) => update(k, v)}
            />
            <Button size="sm" variant="outline" onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
              {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} حفظ بيانات الموسم
            </Button>
          </div>

          <div className="bg-muted/20 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1"><Plus className="h-4 w-4" /> جائزة مركز</h4>
            <div><label className="text-[10px] text-muted-foreground">المركز</label><Input type="number" min={1} max={10} value={newLbPrize.position} onChange={e => setNewLbPrize(p => ({ ...p, position: parseInt(e.target.value) || 1 }))} /></div>
            <div><label className="text-[10px] text-muted-foreground">المنتج</label><ProductPicker value={{ product_id: newLbPrize.product_id, selected_color: newLbPrize.selected_color, selected_option_id: newLbPrize.selected_option_id }} onChange={(val, name) => setNewLbPrize(p => ({ ...p, ...val, prize_name_ar: name || p.prize_name_ar }))} /></div>
            {!newLbPrize.product_id && <div><label className="text-[10px] text-muted-foreground">أو اسم الجائزة</label><Input value={newLbPrize.prize_name_ar} onChange={e => setNewLbPrize(p => ({ ...p, prize_name_ar: e.target.value }))} /></div>}
            <Button size="sm" onClick={() => addLbPrize.mutate()} disabled={addLbPrize.isPending}>{addLbPrize.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} إضافة</Button>
          </div>
          {leaderboardPrizes.length > 0 && (
            <div className="space-y-2">
              {leaderboardPrizes.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg p-3 border border-border bg-muted/10">
                  <div className="flex items-center gap-2"><span className="text-lg">🏅</span><span className="text-sm font-medium text-foreground">المركز {p.position}: {p.prize_name_ar}</span></div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteLbPrize.mutate(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          )}

          {/* Season / All-Time toggle */}
          <div className="flex gap-2 bg-muted/20 rounded-lg p-1">
            <button onClick={() => setLbView("season")} className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${lbView === "season" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              الموسم الحالي
            </button>
            <button onClick={() => setLbView("alltime")} className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors flex items-center justify-center gap-1 ${lbView === "alltime" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              <Globe className="h-3 w-3" /> الأفضل على الإطلاق
            </button>
          </div>

          <div className="bg-muted/20 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1 mb-3">
              <Crown className="h-4 w-4 text-primary" /> {lbView === "season" ? "المتصدرون الحاليون" : "الأفضل على الإطلاق"}
            </h4>
            {lbView === "season" ? (
              highScores.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">لا توجد نقاط</p> : (
                <div className="space-y-1.5">
                  {highScores.map((hs: any, i: number) => {
                    const prize = leaderboardPrizes.find((p: any) => p.position === i + 1);
                    return (
                      <div key={hs.id} className={`flex items-center justify-between rounded-md p-2 text-xs ${prize ? "bg-primary/10 border border-primary/20" : "bg-muted/30"}`}>
                        <span className="font-mono font-bold text-foreground">#{i + 1}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{getProfileName(hs.user_id)}</span>
                          <span className="font-bold text-foreground font-mono">{hs.high_score}</span>
                          {prize && <span className="text-[10px] text-primary">🎁 {prize.prize_name_ar}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              allTimeScores.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">لا توجد نقاط</p> : (
                <div className="space-y-1.5">
                  {allTimeScores.map((hs: any, i: number) => (
                    <div key={hs.id} className="flex items-center justify-between rounded-md p-2 text-xs bg-muted/30">
                      <span className="font-mono font-bold text-foreground">#{i + 1}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{getProfileName(hs.user_id)}</span>
                        <span className="font-bold text-foreground font-mono">{hs.all_time_high_score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Season countdown */}
          <SeasonCountdown endsAt={settings?.season_ends_at} />

          <div className="bg-muted/10 rounded-lg p-3 border border-border/50 mb-3">
            <label className="text-xs font-medium text-muted-foreground mb-2 block">وقت بدء الموسم القادم</label>
            <Select value={String(nextSeasonDelay)} onValueChange={v => setNextSeasonDelay(Number(v))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">بدء الموعد فوراً (بدون توقف)</SelectItem>
                <SelectItem value="1">يبدأ قريباً (بعد ساعة واحدة)</SelectItem>
                <SelectItem value="24">بعد 1 يوم</SelectItem>
                <SelectItem value="48">بعد 2 يوم</SelectItem>
                <SelectItem value="168">بعد أسبوع (7 أيام)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1.5">سيتم إغلاق اللعبة وعرض عد تنازلي للمستخدمين حتى يحين الموعد المختار.</p>
          </div>

          <Button 
            onClick={() => { 
              if (confirm("هل أنت متأكد من تتويج الفائزين؟ سيتم تصفير النقاط وبدء موسم جديد.")) { 
                awardWinners.mutate(); 
              } 
            }} 
            disabled={awardWinners.isPending || highScores.length === 0} 
            className="w-full"
          >
            {awardWinners.isPending ? <Loader2 className="h-4 w-4 animate-spin outline-none" /> : <RefreshCcw className="h-4 w-4" />} 
            تتويج الفائزين وبدء الموسم
          </Button>
        </div>
      )}

      {subTab === "winners" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-1"><Medal className="h-4 w-4 text-primary" /> سجل الفائزين</h3>
          {winners.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">لا يوجد فائزون</div> : (
            <div className="space-y-2">
              {winners.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between rounded-lg p-3 border border-border bg-muted/10">
                  <div className="text-[10px] text-muted-foreground">{new Date(w.awarded_at).toLocaleDateString("ar-IQ")}</div>
                  <div className="text-right">
                    <div className="text-xs font-medium text-foreground">{getProfileName(w.user_id)}</div>
                    <div className="text-[10px] text-muted-foreground">{w.prize_type === "leaderboard" ? `🏅 المركز ${w.position}` : `🎯 ${w.score} نقطة`} • {w.prize_name_ar}</div>
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
