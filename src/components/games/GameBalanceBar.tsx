import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Star, Ticket } from "lucide-react";

export default function GameBalanceBar() {
  const { user } = useAuth();

  const { data: points } = useQuery({
    queryKey: ["user-points-game", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_points")
        .select("available_points")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: tickets } = useQuery({
    queryKey: ["user-tickets-game", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_tickets")
        .select("ticket_count")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20">
        <Star className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-mono font-bold text-primary">
          {points?.available_points ?? 0}
        </span>
      </div>
      <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent/10 border border-accent/20">
        <Ticket className="h-3.5 w-3.5 text-accent-foreground" />
        <span className="text-xs font-mono font-bold text-accent-foreground">
          {tickets?.ticket_count ?? 0}
        </span>
      </div>
    </div>
  );
}
