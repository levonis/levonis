import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy } from "lucide-react";

interface WinnerEntry {
  user_id: string;
  username: string;
  prize_name: string;
  game_name: string;
  awarded_at: string;
}

export default function WinnersTicker() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Realtime: refresh ticker when seasons end and prizes are awarded
  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["recent-game-winners-ticker"] });
    };

    const channel = supabase
      .channel("winners-ticker-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "crossy_road_winners" },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stack_game_winners" },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "competition_prizes" },
        invalidate,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: winners } = useQuery({
    queryKey: ["recent-game-winners-ticker"],
    staleTime: 60_000,
    queryFn: async () => {
      const results: WinnerEntry[] = [];

      // Crossy Road winners
      const { data: crossy } = await supabase
        .from("crossy_road_winners")
        .select("user_id, prize_name_ar, awarded_at")
        .order("awarded_at", { ascending: false })
        .limit(5);

      // Stack Game winners
      const { data: stack } = await supabase
        .from("stack_game_winners")
        .select("user_id, prize_name_ar, awarded_at")
        .order("awarded_at", { ascending: false })
        .limit(5);

      // Competition prizes
      const { data: comp } = await supabase
        .from("competition_prizes")
        .select("user_id, prize_name_ar, created_at, source_type")
        .order("created_at", { ascending: false })
        .limit(5);

      const userIds = new Set<string>();
      crossy?.forEach(w => userIds.add(w.user_id));
      stack?.forEach(w => userIds.add(w.user_id));
      comp?.forEach(w => userIds.add(w.user_id));

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, full_name")
        .in("id", Array.from(userIds));

      const profileMap = new Map(profiles?.map(p => [p.id, p.username || p.full_name || "لاعب"]) ?? []);

      crossy?.forEach(w => results.push({
        user_id: w.user_id,
        username: profileMap.get(w.user_id) || "لاعب",
        prize_name: w.prize_name_ar,
        game_name: "Crossy Road",
        awarded_at: w.awarded_at,
      }));

      stack?.forEach(w => results.push({
        user_id: w.user_id,
        username: profileMap.get(w.user_id) || "لاعب",
        prize_name: w.prize_name_ar,
        game_name: "Stack Tower",
        awarded_at: w.awarded_at,
      }));

      comp?.forEach(w => results.push({
        user_id: w.user_id,
        username: profileMap.get(w.user_id) || "لاعب",
        prize_name: w.prize_name_ar,
        game_name: w.source_type === "mystery_box" ? "صندوق الغموض" : "مسابقة",
        awarded_at: w.created_at,
      }));

      results.sort((a, b) => new Date(b.awarded_at).getTime() - new Date(a.awarded_at).getTime());
      return results.slice(0, 15);
    },
  });

  if (!winners || winners.length === 0) return null;

  const tickerText = winners
    .map(w => `🏆 ${w.username} فاز بـ "${w.prize_name}" في ${w.game_name}`)
    .join("   ★   ");

  return (
    <button
      onClick={() => navigate("/games/winners")}
      className="w-full overflow-hidden rounded-lg pixel-frame bg-card/80 backdrop-blur-sm py-2 px-3 cursor-pointer hover:bg-card/90 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Trophy className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
        <div className="overflow-hidden flex-1 relative">
          <div
            className="whitespace-nowrap font-mono text-[11px] text-muted-foreground animate-ticker"
            style={{ display: "inline-block" }}
          >
            {tickerText}
          </div>
        </div>
      </div>
    </button>
  );
}
