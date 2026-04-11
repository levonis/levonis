import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Trophy, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface WinnerRow {
  user_id: string;
  username: string;
  prize_name: string;
  game_name: string;
  awarded_at: string;
}

export default function GameWinnersPage() {
  const navigate = useNavigate();

  const { data: winners, isLoading } = useQuery({
    queryKey: ["all-game-winners"],
    staleTime: 30_000,
    queryFn: async () => {
      const results: WinnerRow[] = [];

      const [crossy, stack, comp] = await Promise.all([
        supabase.from("crossy_road_winners").select("user_id, prize_name_ar, awarded_at").order("awarded_at", { ascending: false }).limit(50),
        supabase.from("stack_game_winners").select("user_id, prize_name_ar, awarded_at").order("awarded_at", { ascending: false }).limit(50),
        supabase.from("competition_prizes").select("user_id, prize_name_ar, created_at, source_type").order("created_at", { ascending: false }).limit(50),
      ]);

      const userIds = new Set<string>();
      crossy.data?.forEach(w => userIds.add(w.user_id));
      stack.data?.forEach(w => userIds.add(w.user_id));
      comp.data?.forEach(w => userIds.add(w.user_id));

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, full_name")
        .in("id", Array.from(userIds));

      const profileMap = new Map(profiles?.map(p => [p.id, p.username || p.full_name || "لاعب"]) ?? []);

      crossy.data?.forEach(w => results.push({
        user_id: w.user_id, username: profileMap.get(w.user_id) || "لاعب",
        prize_name: w.prize_name_ar, game_name: "Crossy Road", awarded_at: w.awarded_at,
      }));
      stack.data?.forEach(w => results.push({
        user_id: w.user_id, username: profileMap.get(w.user_id) || "لاعب",
        prize_name: w.prize_name_ar, game_name: "Stack Tower", awarded_at: w.awarded_at,
      }));
      comp.data?.forEach(w => results.push({
        user_id: w.user_id, username: profileMap.get(w.user_id) || "لاعب",
        prize_name: w.prize_name_ar,
        game_name: w.source_type === "mystery_box" ? "صندوق الغموض" : "مسابقة",
        awarded_at: w.created_at,
      }));

      results.sort((a, b) => new Date(b.awarded_at).getTime() - new Date(a.awarded_at).getTime());
      return results;
    },
  });

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="sticky top-0 z-50 bg-card border-b border-border/30">
        <div className="container mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 rounded-xl">
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Trophy className="h-5 w-5 text-yellow-500" />
          <h1 className="text-lg font-black text-foreground">الفائزون</h1>
        </div>
      </div>

      <main className="container mx-auto max-w-2xl px-4 pt-4 pb-24 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : !winners || winners.length === 0 ? (
          <div className="text-center py-16">
            <Gamepad2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">لا يوجد فائزون بعد</p>
          </div>
        ) : (
          winners.map((w, i) => (
            <div
              key={`${w.user_id}-${w.awarded_at}-${i}`}
              className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card/50"
            >
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
                <Trophy className="h-4 w-4 text-yellow-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">
                  {w.username}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {w.prize_name} • {w.game_name}
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground/70 shrink-0">
                {format(new Date(w.awarded_at), "d MMM", { locale: ar })}
              </span>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
