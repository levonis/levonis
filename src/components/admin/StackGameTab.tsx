import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Ticket, Star, Zap, Trophy, BarChart3 } from "lucide-react";

export default function StackGameTab() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-stack-game-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stack_game_settings")
        .select("*")
        .limit(1)
        .single();
      return data as any;
    },
  });

  const [form, setForm] = useState<any>(null);
  const s = form ?? settings;

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

  const update = (key: string, value: any) => setForm((prev: any) => ({ ...(prev ?? settings), [key]: value }));

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!s) return <div className="text-center py-12 text-muted-foreground">لا توجد إعدادات</div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
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

      {/* Enable/Disable */}
      <div className="flex items-center justify-between bg-muted/20 rounded-lg p-4">
        <span className="text-sm font-medium text-foreground">تفعيل اللعبة</span>
        <Switch checked={s.game_enabled} onCheckedChange={(v) => update("game_enabled", v)} />
      </div>

      {/* Settings */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Ticket className="h-3.5 w-3.5" /> تكلفة الدخول (تذاكر)
          </label>
          <Input type="number" min={0} value={s.entry_fee_tickets} onChange={(e) => update("entry_fee_tickets", parseInt(e.target.value) || 0)} />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Star className="h-3.5 w-3.5" /> نقاط لكل قطعة
          </label>
          <Input type="number" min={0} value={s.points_per_block} onChange={(e) => update("points_per_block", parseInt(e.target.value) || 0)} />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Zap className="h-3.5 w-3.5" /> مكافأة التكديس المثالي
          </label>
          <Input type="number" min={0} value={s.perfect_bonus_points} onChange={(e) => update("perfect_bonus_points", parseInt(e.target.value) || 0)} />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Trophy className="h-3.5 w-3.5" /> مضاعف الكومبو
          </label>
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
  );
}
