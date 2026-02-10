import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ticket, Package } from "lucide-react";
import { SubTabId } from "./RewardsSubTabs";
import OptimizedImage from "@/components/OptimizedImage";
import { 
  TicketBalanceSkeleton, 
  CompetitionsGridSkeleton
} from "./SkeletonLoaders";
import TicketProductBadges from "./TicketProductBadges";
import AllCompetitionsPanel from "./panels/AllCompetitionsPanel";

interface CompetitionsSectionProps {
  activeSubTab: SubTabId;
}

export default function CompetitionsSection({ activeSubTab }: CompetitionsSectionProps) {
  const { user } = useAuth();

  // Only fetch when competitions tab is active
  const { data: userTickets, isLoading: loadingTickets } = useQuery({
    queryKey: ['user-tickets-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase
        .from('user_tickets')
        .select('ticket_count')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.ticket_count || 0;
    },
    enabled: !!user && activeSubTab === 'competitions',
    staleTime: 5 * 60 * 1000,
  });

  // Competitions sub-tab
  if (activeSubTab === 'competitions') {
    return (
      <div className="space-y-4">
        {/* Ticket Balance */}
        {loadingTickets ? (
          <TicketBalanceSkeleton />
        ) : (
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Ticket className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">رصيد التذاكر</p>
                  <p className="text-xl font-bold">{userTickets || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Competitions Inline */}
        <AllCompetitionsPanel />
      </div>
    );
  }

  return null;
}
