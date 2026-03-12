import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminLoading } from "@/components/admin/AdminLayout";
import { Plus, Trash2, Save, Settings, Eye } from "lucide-react";

const RARITIES = [
  { value: "common", label: "عادي", color: "#9ca3af" },
  { value: "rare", label: "نادر", color: "#3b82f6" },
  { value: "epic", label: "أسطوري", color: "#a855f7" },
  { value: "legendary", label: "خرافي", color: "#f59e0b" },
];

const REWARD_TYPES = [
  { value: "product", label: "منتج من المتجر" },
  { value: "tickets", label: "تذاكر" },
  { value: "custom", label: "جائزة مخصصة" },
];

export default function MysteryCaseTab() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["admin-mystery-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("mystery_case_settings").select("*").limit(1).single();
      return data;
    },
  });

  const [settingsForm, setSettingsForm] = useState({
    tickets_per_spin: 4,
    game_enabled: true,
    spin_cooldown_seconds: 0,
    spin_sound_enabled: true,
    animation_duration_ms: 5000,
    daily_free_spin: false,
  });

  useEffect(() => {
    if (settings) {
      setSettingsForm({
        tickets_per_spin: settings.tickets_per_spin,
        game_enabled: settings.game_enabled,
        spin_cooldown_seconds: settings.spin_cooldown_seconds,
        spin_sound_enabled: settings.spin_sound_enabled,
        animation_duration_ms: settings.animation_duration_ms,
        daily_free_spin: settings.daily_free_spin,
      });
    }
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!settings?.id) return;
      const { error } = await supabase
        .from("mystery_case_settings")
        .update({ ...settingsForm, updated_at: new Date().toISOString() })
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حفظ الإعدادات"); queryClient.invalidateQueries({ queryKey: ["admin-mystery-settings"] }); },
    onError: () => toast.error("فشل حفظ الإعدادات"),
  });

  const { data: rewards = [], isLoading: rewardsLoading } = useQuery({
    queryKey: ["admin-mystery-rewards"],
    queryFn: async () => {
      const { data } = await supabase.from("mystery_case_rewards").select("*").order("display_order");
      return (data || []) as any[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["admin-products-list"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, name_ar, image_url").order("name_ar").limit(200);
      return (data || []) as any[];
    },
  });

  const [editReward, setEditReward] = useState<any>(null);
  const [rewardForm, setRewardForm] = useState({
    name_ar: "", reward_type: "custom", rarity: "common", drop_chance: 10,
    image_url: "", product_id: "", ticket_reward_amount: 0, display_only: false, is_active: true,
  });

  const resetRewardForm = () => {
    setEditReward(null);
    setRewardForm({ name_ar: "", reward_type: "custom", rarity: "common", drop_chance: 10, image_url: "", product_id: "", ticket_reward_amount: 0, display_only: false, is_active: true });
  };

  const openEditReward = (r: any) => {
    setEditReward(r);
    setRewardForm({
      name_ar: r.name_ar, reward_type: r.reward_type, rarity: r.rarity, drop_chance: Number(r.drop_chance),
      image_url: r.image_url || "", product_id: r.product_id || "", ticket_reward_amount: r.ticket_reward_amount || 0,
      display_only: r.display_only, is_active: r.is_active,
    });
  };

  const saveReward = useMutation({
    mutationFn: async () => {
      const payload = {
        name_ar: rewardForm.name_ar, reward_type: rewardForm.reward_type, rarity: rewardForm.rarity,
        drop_chance: rewardForm.drop_chance, image_url: rewardForm.image_url || null,
        product_id: rewardForm.product_id || null, ticket_reward_amount: rewardForm.ticket_reward_amount,
        display_only: rewardForm.display_only, is_active: rewardForm.is_active, updated_at: new Date().toISOString(),
      };
      if (editReward) {
        const { error } = await supabase.from("mystery_case_rewards").update(payload).eq("id", editReward.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mystery_case_rewards").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editReward ? "تم تعديل الجائزة" : "تم إضافة الجائزة"); queryClient.invalidateQueries({ queryKey: ["admin-mystery-rewards"] }); resetRewardForm(); },
    onError: () => toast.error("فشل حفظ الجائزة"),
  });

  const deleteReward = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mystery_case_rewards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حذف الجائزة"); queryClient.invalidateQueries({ queryKey: ["admin-mystery-rewards"] }); },
  });

  const totalChance = rewards.reduce((s: number, r: any) => s + Number(r.drop_chance), 0);

  if (settingsLoading) return <AdminLoading />;

  return (
    <div className="space-y-6">
      {/* Settings */}
      <div className="p-4 rounded-xl border border-border/50 bg-card space-y-4">
        <h3 className="text-sm font-bold flex items-center gap-2"><Settings className="h-4 w-4" /> الإعدادات العامة</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">تذاكر لكل لفة</label>
            <Input type="number" min={1} value={settingsForm.tickets_per_spin} onChange={(e) => setSettingsForm({ ...settingsForm, tickets_per_spin: parseInt(e.target.value) || 1 })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">فترة الانتظار (ثانية)</label>
            <Input type="number" min={0} value={settingsForm.spin_cooldown_seconds} onChange={(e) => setSettingsForm({ ...settingsForm, spin_cooldown_seconds: parseInt(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">مدة الحركة (مللي ثانية)</label>
            <Input type="number" min={2000} value={settingsForm.animation_duration_ms} onChange={(e) => setSettingsForm({ ...settingsForm, animation_duration_ms: parseInt(e.target.value) || 5000 })} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settingsForm.game_enabled} onChange={(e) => setSettingsForm({ ...settingsForm, game_enabled: e.target.checked })} /> تفعيل اللعبة
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settingsForm.spin_sound_enabled} onChange={(e) => setSettingsForm({ ...settingsForm, spin_sound_enabled: e.target.checked })} /> أصوات اللعبة
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settingsForm.daily_free_spin} onChange={(e) => setSettingsForm({ ...settingsForm, daily_free_spin: e.target.checked })} /> لفة مجانية يومية
          </label>
        </div>
        <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending} size="sm">
          <Save className="h-3 w-3 ml-1" /> حفظ الإعدادات
        </Button>
      </div>

      {/* Rewards */}
      <div className="p-4 rounded-xl border border-border/50 bg-card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">🎁 إدارة الجوائز</h3>
          <span className="text-xs text-muted-foreground">إجمالي الاحتمالات: {totalChance.toFixed(1)}%</span>
        </div>

        {/* Reward Form */}
        <div className="p-4 rounded-lg border border-border/30 space-y-3 bg-muted/5">
          <h4 className="text-xs font-bold">{editReward ? "تعديل جائزة" : "إضافة جائزة جديدة"}</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">الاسم (عربي)</label>
              <Input value={rewardForm.name_ar} onChange={(e) => setRewardForm({ ...rewardForm, name_ar: e.target.value })} placeholder="اسم الجائزة" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">النوع</label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={rewardForm.reward_type} onChange={(e) => setRewardForm({ ...rewardForm, reward_type: e.target.value })}>
                {REWARD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">الندرة</label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={rewardForm.rarity} onChange={(e) => setRewardForm({ ...rewardForm, rarity: e.target.value })}>
                {RARITIES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">نسبة السقوط %</label>
              <Input type="number" min={0} step={0.01} value={rewardForm.drop_chance} onChange={(e) => setRewardForm({ ...rewardForm, drop_chance: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">رابط الصورة</label>
              <Input value={rewardForm.image_url} onChange={(e) => setRewardForm({ ...rewardForm, image_url: e.target.value })} placeholder="https://..." />
            </div>
            {rewardForm.reward_type === "product" && (
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">اختر المنتج</label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={rewardForm.product_id} onChange={(e) => setRewardForm({ ...rewardForm, product_id: e.target.value })}>
                  <option value="">— اختر منتج —</option>
                  {products.map((p: any) => <option key={p.id} value={p.id}>{p.name_ar || p.name}</option>)}
                </select>
              </div>
            )}
            {rewardForm.reward_type === "tickets" && (
              <div>
                <label className="text-xs text-muted-foreground">عدد التذاكر</label>
                <Input type="number" min={1} value={rewardForm.ticket_reward_amount} onChange={(e) => setRewardForm({ ...rewardForm, ticket_reward_amount: parseInt(e.target.value) || 0 })} />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={rewardForm.display_only} onChange={(e) => setRewardForm({ ...rewardForm, display_only: e.target.checked })} />
              <Eye className="h-3 w-3" /> عرض فقط (لا يمكن الفوز بها)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={rewardForm.is_active} onChange={(e) => setRewardForm({ ...rewardForm, is_active: e.target.checked })} /> مفعّلة
            </label>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => saveReward.mutate()} disabled={!rewardForm.name_ar || saveReward.isPending} size="sm">
              <Save className="h-3 w-3 ml-1" /> {editReward ? "تحديث" : "إضافة"}
            </Button>
            {editReward && <Button onClick={resetRewardForm} variant="ghost" size="sm">إلغاء</Button>}
          </div>
        </div>

        {/* Rewards List */}
        <div className="space-y-2">
          {rewards.map((r: any) => {
            const rarityInfo = RARITIES.find((x) => x.value === r.rarity);
            return (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/5">
                {r.image_url ? (
                  <img src={r.image_url} alt="" className="w-10 h-10 rounded object-contain" />
                ) : (
                  <div className="w-10 h-10 rounded bg-muted/20 flex items-center justify-center">🎁</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.name_ar}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: `${rarityInfo?.color}22`, color: rarityInfo?.color }}>{rarityInfo?.label}</span>
                    <span>{Number(r.drop_chance)}%</span>
                    <span>{REWARD_TYPES.find((t) => t.value === r.reward_type)?.label}</span>
                    {r.display_only && <span className="text-amber-500">👁 عرض فقط</span>}
                    {!r.is_active && <span className="text-destructive">معطّلة</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditReward(r)}>✏️</Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("حذف الجائزة؟")) deleteReward.mutate(r.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
          {rewards.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">لم تتم إضافة جوائز بعد</p>}
        </div>
      </div>
    </div>
  );
}
