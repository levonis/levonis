import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useLanguage } from "@/lib/i18n";

export default function PointsHistoryPanel() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const dateLocale = language === 'ar' || language === 'ku' ? ar : enUS;

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['points-transactions-panel', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('points_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
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
          {t('points_no_transactions')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((tx) => {
        const isEarned = tx.type === 'earned' || tx.type === 'earn';
        const displayPoints = Math.abs(tx.points);
        
        return (
          <Card key={tx.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isEarned ? 'bg-green-500/10' : 'bg-red-500/10'
              }`}>
                {isEarned ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">{tx.description || tx.source}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(tx.created_at), 'dd MMM yyyy', { locale: dateLocale })}
                </p>
              </div>
              <Badge variant={isEarned ? 'default' : 'destructive'} className={isEarned ? 'bg-green-500' : ''}>
                {isEarned ? '+' : '-'}{displayPoints}
              </Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
