import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Ticket, Star, Trophy, Swords } from "lucide-react";

export default function SpaceBlasterTab() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-space-blaster-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("space_blaster_settings")
        .select("*")
        .limit(1)
        .single();
      return data as any;
    },
  });

  const [form, setForm] = useState<any>(null);

  // Sync form when settings load
  const s = form ?? settings;

  const save = useMutation({
    mutationFn: async () => {
      if (!s || !settings?.id) throw new Error("لا توجد إعدادات");
      const { error } = await supabase
        .from("space_blaster_settings")
        .update({
          game_enabled: s.game_enabled,
          entry_fee_tickets: s.entry_fee_tickets,
          points_per_score: s.points_per_score,
          victory_bonus_points: s.victory_bonus_points,
          wave_bonus_points: s.wave_bonus_points,
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ الإعدادات");
      queryClient.invalidateQueries({ queryKey: ["admin-space-blaster-settings"] });
      setForm(null);
    },
    onError: (err: any) => toast.error(err?.message || "فشل الحفظ"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!s) return <p className="text-center text-muted-foreground py-8">لا توجد إعدادات</p>;

  const update = (key: string, value: any) => {
    setForm({ ...(form ?? settings), [key]: value });
  };

  return (
    <div className="space-y-6">
      <div className="pixel-frame rounded-xl p-5 space-y-5">
        <h3 className="text-sm font-bold font-mono flex items-center gap-2">
          <Swords className="h-4 w-4 text-primary" /> إعدادات حرب الفضاء
        </h3>

        {/* Game Enabled */}
        <div className="flex items-center justify-between">
          <span className="text-sm">تفعيل اللعبة</span>
          <Switch
            checked={s.game_enabled}
            onCheckedChange={(v) => update("game_enabled", v)}
          />
        </div>

        {/* Entry Fee */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium flex items-center gap-1">
            <Ticket className="h-3 w-3" /> رسوم الدخول (تذاكر)
          </label>
          <Input
            type="number"
            min={0}
            max={100}
            value={s.entry_fee_tickets}
            onChange={(e) => update("entry_fee_tickets", parseInt(e.target.value) || 0)}
            className="w-32"
          />
          <p className="text-[10px] text-muted-foreground">0 = مجاني</p>
        </div>

        <hr className="border-border/30" />

        <h4 className="text-xs font-bold font-mono flex items-center gap-1">
          <Star className="h-3 w-3 text-primary" /> إعدادات النقاط
        </h4>

        {/* Points per Score */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium">نقاط لكل 1 سكور</label>
          <Input
            type="number"
            min={0}
            max={10}
            step={0.01}
            value={s.points_per_score}
            onChange={(e) => update("points_per_score", parseFloat(e.target.value) || 0)}
            className="w-32"
          />
          <p className="text-[10px] text-muted-foreground">مثال: 0.1 يعني كل 10 سكور = 1 نقطة</p>
        </div>

        {/* Max Points per Game */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium">الحد الأقصى للنقاط في اللعبة</label>
          <Input
            type="number"
            min={0}
            max={1000}
            value={s.max_points_per_game}
            onChange={(e) => update("max_points_per_game", parseInt(e.target.value) || 0)}
            className="w-32"
          />
        </div>

        {/* Victory Bonus */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium flex items-center gap-1">
            <Trophy className="h-3 w-3" /> مكافأة الفوز
          </label>
          <Input
            type="number"
            min={0}
            max={500}
            value={s.victory_bonus_points}
            onChange={(e) => update("victory_bonus_points", parseInt(e.target.value) || 0)}
            className="w-32"
          />
          <p className="text-[10px] text-muted-foreground">نقاط إضافية عند إكمال كل الموجات</p>
        </div>

        {/* Wave Bonus */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium">مكافأة كل موجة</label>
          <Input
            type="number"
            min={0}
            max={50}
            value={s.wave_bonus_points}
            onChange={(e) => update("wave_bonus_points", parseInt(e.target.value) || 0)}
            className="w-32"
          />
          <p className="text-[10px] text-muted-foreground">نقاط إضافية لكل موجة مكتملة</p>
        </div>

        {/* Preview */}
        <div className="bg-muted/30 rounded-lg p-3 text-xs font-mono space-y-1" dir="rtl">
          <p className="font-bold text-primary mb-1">📊 محاكاة:</p>
          <p>سكور 500 = {Math.min(Math.floor(500 * s.points_per_score), s.max_points_per_game)} نقطة</p>
          <p>سكور 1000 = {Math.min(Math.floor(1000 * s.points_per_score), s.max_points_per_game)} نقطة</p>
          <p>فوز كامل (20 موجة) = +{s.victory_bonus_points} + {20 * s.wave_bonus_points} = {s.victory_bonus_points + 20 * s.wave_bonus_points} نقطة إضافية</p>
          <p>رسوم الدخول: {s.entry_fee_tickets > 0 ? `${s.entry_fee_tickets} تذكرة` : "مجاني"}</p>
        </div>

        {/* Save */}
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending || !form}
          className="w-full font-mono text-sm"
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="h-4 w-4 ml-2" />}
          حفظ الإعدادات
        </Button>
      </div>
    </div>
  );
}
