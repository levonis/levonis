import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Gift, Trophy, CheckCircle2, Clock, ArrowRight, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onBack: () => void;
}

export default function MyGamePrizes({ onBack }: Props) {
  const { user } = useAuth();

  const { data: prizes = [], isLoading } = useQuery({
    queryKey: ["my-game-prizes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("game_prizes" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen p-4 pt-16 pb-20">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 pixel-header-bar">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground font-mono text-xs pixel-btn-ghost">
            <ArrowRight className="h-4 w-4" /> رجوع
          </Button>
          <span className="text-primary font-bold text-xs font-mono tracking-wider">MY PRIZES</span>
        </div>
      </div>

      <div className="max-w-sm mx-auto space-y-4">
        <div className="text-center">
          <Gift className="h-10 w-10 text-primary mx-auto mb-2" />
          <h2 className="text-xl font-bold text-foreground font-mono">جوائزي</h2>
          <p className="text-xs text-muted-foreground mt-1">جميع الجوائز التي ربحتها من الألعاب</p>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground text-sm">جاري التحميل...</div>
        ) : prizes.length === 0 ? (
          <div className="text-center py-10">
            <Gamepad2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">لم تربح أي جوائز بعد</p>
            <p className="text-muted-foreground/60 text-xs mt-1">العب الألعاب لتحصل على جوائز!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {prizes.map((prize: any) => (
              <div key={prize.id} className={`rounded-xl p-4 border transition-all ${prize.is_delivered ? 'bg-muted/10 border-border' : 'bg-primary/5 border-primary/20'}`}>
                <div className="flex items-start gap-3">
                  {prize.prize_image_url ? (
                    <img src={prize.prize_image_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-border" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Trophy className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 text-right space-y-1">
                    <div className="text-sm font-bold text-foreground">{prize.prize_name_ar}</div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="bg-accent/10 px-1.5 py-0.5 rounded">{prize.game_name}</span>
                      {prize.score_achieved && <span>سكور: {prize.score_achieved}</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{prize.how_won_ar}</div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(prize.created_at).toLocaleDateString('ar-IQ')}
                      </span>
                      {prize.is_delivered ? (
                        <span className="flex items-center gap-1 text-[10px] text-green-500">
                          <CheckCircle2 className="h-3 w-3" /> تم الاستلام
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-yellow-500">
                          <Clock className="h-3 w-3" /> بانتظار الاستلام
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
