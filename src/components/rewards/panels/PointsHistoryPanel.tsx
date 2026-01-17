import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function PointsHistoryPanel() {
  const { user } = useAuth();

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['points-transactions-panel', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('points_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          لا توجد معاملات نقاط سابقة
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((tx) => (
        <Card key={tx.id}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              tx.type === 'earn' ? 'bg-green-500/10' : 'bg-red-500/10'
            }`}>
              {tx.type === 'earn' ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium line-clamp-1">{tx.description || tx.source}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(tx.created_at), 'dd MMM yyyy', { locale: ar })}
              </p>
            </div>
            <Badge variant={tx.type === 'earn' ? 'default' : 'destructive'}>
              {tx.type === 'earn' ? '+' : '-'}{tx.points}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
