import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, ShoppingBag } from "lucide-react";

interface Reward {
  id: string;
  title_ar: string;
  description_ar: string | null;
  reward_type: string;
  reward_value: number;
  points_cost: number;
  image_url: string | null;
  is_active: boolean;
  max_purchases: number | null;
  display_order: number;
}

export default function GameStoreTab() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title_ar: "",
    description_ar: "",
    reward_type: "tickets",
    reward_value: 10,
    points_cost: 100,
    image_url: "",
    is_active: true,
    max_purchases: "",
    display_order: 0,
  });

  const { data: rewards = [], isLoading } = useQuery({
    queryKey: ["admin-game-store-rewards"],
    queryFn: async () => {
      const { data } = await supabase
        .from("game_store_rewards")
        .select("*")
        .order("display_order");
      return (data ?? []) as Reward[];
    },
  });

  const handleSave = async () => {
    if (!form.title_ar.trim()) {
      toast.error("أدخل اسم المكافأة");
      return;
    }
    setSaving(true);
    try {
      await supabase.from("game_store_rewards").insert({
        title_ar: form.title_ar,
        description_ar: form.description_ar || null,
        reward_type: form.reward_type,
        reward_value: form.reward_value,
        points_cost: form.points_cost,
        image_url: form.image_url || null,
        is_active: form.is_active,
        max_purchases: form.max_purchases ? parseInt(form.max_purchases) : null,
        display_order: form.display_order,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-game-store-rewards"] });
      toast.success("تم إضافة المكافأة!");
      setShowForm(false);
      setForm({
        title_ar: "", description_ar: "", reward_type: "tickets",
        reward_value: 10, points_cost: 100, image_url: "",
        is_active: true, max_purchases: "", display_order: 0,
      });
    } catch {
      toast.error("خطأ!");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (reward: Reward) => {
    await supabase
      .from("game_store_rewards")
      .update({ is_active: !reward.is_active })
      .eq("id", reward.id);
    queryClient.invalidateQueries({ queryKey: ["admin-game-store-rewards"] });
  };

  const deleteReward = async (id: string) => {
    if (!confirm("حذف هذه المكافأة؟")) return;
    await supabase.from("game_store_rewards").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-game-store-rewards"] });
    toast.success("تم الحذف");
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" /> متجر الألعاب
        </h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1">
          <Plus className="h-4 w-4" /> إضافة مكافأة
        </Button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>الاسم (عربي)</Label>
              <Input value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} />
            </div>
            <div>
              <Label>الوصف</Label>
              <Input value={form.description_ar} onChange={(e) => setForm({ ...form, description_ar: e.target.value })} />
            </div>
            <div>
              <Label>النوع</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.reward_type}
                onChange={(e) => setForm({ ...form, reward_type: e.target.value })}
              >
                <option value="tickets">تذاكر</option>
                <option value="custom">مخصص</option>
              </select>
            </div>
            <div>
              <Label>{form.reward_type === "tickets" ? "عدد التذاكر" : "القيمة"}</Label>
              <Input type="number" value={form.reward_value} onChange={(e) => setForm({ ...form, reward_value: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>التكلفة (نقاط)</Label>
              <Input type="number" value={form.points_cost} onChange={(e) => setForm({ ...form, points_cost: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>الحد الأقصى (فارغ = غير محدود)</Label>
              <Input type="number" value={form.max_purchases} onChange={(e) => setForm({ ...form, max_purchases: e.target.value })} placeholder="غير محدود" />
            </div>
            <div>
              <Label>رابط الصورة (اختياري)</Label>
              <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
            </div>
            <div>
              <Label>ترتيب العرض</Label>
              <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>إلغاء</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
      ) : rewards.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">لا توجد مكافآت بعد</div>
      ) : (
        <div className="space-y-2">
          {rewards.map((r) => (
            <div key={r.id} className="border rounded-lg p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{r.title_ar}</div>
                <div className="text-xs text-muted-foreground">
                  {r.reward_type === "tickets" ? `${r.reward_value} تذكرة` : `قيمة: ${r.reward_value}`}
                  {" • "}{r.points_cost} نقطة
                  {r.max_purchases ? ` • حد: ${r.max_purchases}` : ""}
                </div>
              </div>
              <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
              <Button variant="ghost" size="icon" onClick={() => deleteReward(r.id)} className="text-destructive h-8 w-8">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
