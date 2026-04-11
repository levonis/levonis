// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Trophy, CheckCircle, Filter, Gamepad2, Gift, Medal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import AdminLayout, { AdminSection, AdminCard, AdminCardHeader, AdminCardContent, AdminLoading, AdminEmptyState } from "@/components/admin/AdminLayout";

type GameSource = "all" | "crossy_road" | "stack_game" | "knife_rain" | "competition";

const SOURCE_LABELS: Record<string, string> = {
  crossy_road: "كروسي رود",
  stack_game: "ستاك",
  knife_rain: "أمطار السكاكين",
  competition: "مسابقة",
};

interface WinnerRow {
  id: string;
  user_id: string;
  prize_name: string;
  source: string;
  score?: number;
  position?: number;
  awarded_at: string;
  delivered?: boolean;
  profile_name?: string;
}

export default function AdminWinners() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<GameSource>("all");

  const { data: winners, isLoading } = useQuery({
    queryKey: ["admin-all-winners", filter],
    queryFn: async () => {
      const results: WinnerRow[] = [];

      if (filter === "all" || filter === "crossy_road") {
        const { data } = await supabase
          .from("crossy_road_winners")
          .select("id, user_id, prize_name_ar, score, position, awarded_at, delivered")
          .order("awarded_at", { ascending: false })
          .limit(100);
        (data || []).forEach((w: any) => results.push({
          id: w.id, user_id: w.user_id, prize_name: w.prize_name_ar,
          source: "crossy_road", score: w.score, position: w.position,
          awarded_at: w.awarded_at, delivered: w.delivered,
        }));
      }

      if (filter === "all" || filter === "stack_game") {
        const { data } = await supabase
          .from("stack_game_winners")
          .select("id, user_id, prize_name_ar, score, position, awarded_at, delivered")
          .order("awarded_at", { ascending: false })
          .limit(100);
        (data || []).forEach((w: any) => results.push({
          id: w.id, user_id: w.user_id, prize_name: w.prize_name_ar,
          source: "stack_game", score: w.score, position: w.position,
          awarded_at: w.awarded_at, delivered: w.delivered,
        }));
      }

      if (filter === "all" || filter === "knife_rain") {
        const { data } = await supabase
          .from("knife_rain_winners")
          .select("id, user_id, prize_name_ar, score, position, awarded_at, delivered")
          .order("awarded_at", { ascending: false })
          .limit(100);
        (data || []).forEach((w: any) => results.push({
          id: w.id, user_id: w.user_id, prize_name: w.prize_name_ar,
          source: "knife_rain", score: w.score, position: w.position,
          awarded_at: w.awarded_at, delivered: w.delivered,
        }));
      }

      if (filter === "all" || filter === "competition") {
        const { data } = await supabase
          .from("competition_prizes")
          .select("id, user_id, prize_name_ar, source_type, created_at, status")
          .order("created_at", { ascending: false })
          .limit(100);
        (data || []).forEach((w: any) => results.push({
          id: w.id, user_id: w.user_id, prize_name: w.prize_name_ar,
          source: "competition", awarded_at: w.created_at,
          delivered: w.status === "delivered",
        }));
      }

      // Sort by date
      results.sort((a, b) => new Date(b.awarded_at).getTime() - new Date(a.awarded_at).getTime());

      // Fetch profile names
      const userIds = [...new Set(results.map(r => r.user_id))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, username")
          .in("id", userIds);
        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name || p.username || "—"]));
        results.forEach(r => r.profile_name = profileMap.get(r.user_id) || "—");
      }

      return results;
    },
  });

  const markDelivered = useMutation({
    mutationFn: async (winner: WinnerRow) => {
      if (winner.source === "competition") {
        await supabase.from("competition_prizes").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("id", winner.id);
      } else {
        const table = winner.source === "crossy_road" ? "crossy_road_winners" 
          : winner.source === "stack_game" ? "stack_game_winners" 
          : "knife_rain_winners";
        await supabase.from(table as any).update({ delivered: true } as any).eq("id", winner.id);
      }
    },
    onSuccess: () => {
      toast.success("تم تسجيل التسليم");
      queryClient.invalidateQueries({ queryKey: ["admin-all-winners"] });
    },
  });

  return (
    <AdminLayout title="الفائزون" icon={Trophy}>
      <AdminSection>
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={(v) => setFilter(v as GameSource)}>
            <SelectTrigger className="w-48 h-8 text-sm rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="crossy_road">كروسي رود</SelectItem>
              <SelectItem value="stack_game">ستاك</SelectItem>
              <SelectItem value="knife_rain">أمطار السكاكين</SelectItem>
              <SelectItem value="competition">المسابقات</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <AdminLoading />
        ) : !winners?.length ? (
          <AdminEmptyState icon={Trophy} message="لا يوجد فائزون حتى الآن" />
        ) : (
          <div className="space-y-2">
            {winners.map((w) => (
              <AdminCard key={`${w.source}-${w.id}`}>
                <AdminCardContent className="flex items-center justify-between gap-3 py-3 px-4">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Medal className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-bold text-foreground truncate">{w.profile_name}</span>
                      <Badge variant="outline" className="text-[9px] px-1.5 shrink-0">
                        {SOURCE_LABELS[w.source] || w.source}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      🎁 {w.prize_name}
                      {w.position ? ` • المركز ${w.position}` : ""}
                      {w.score ? ` • ${w.score} نقطة` : ""}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60">
                      {format(new Date(w.awarded_at), "dd MMM yyyy HH:mm", { locale: ar })}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {w.delivered ? (
                      <Badge className="bg-green-500/10 text-green-600 text-[10px] gap-1">
                        <CheckCircle className="h-3 w-3" />
                        تم التسليم
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs rounded-lg gap-1"
                        onClick={() => markDelivered.mutate(w)}
                        disabled={markDelivered.isPending}
                      >
                        <Gift className="h-3 w-3" />
                        تسليم
                      </Button>
                    )}
                  </div>
                </AdminCardContent>
              </AdminCard>
            ))}
          </div>
        )}
      </AdminSection>
    </AdminLayout>
  );
}
