import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, CreditCard } from "lucide-react";

export default function LoyaltyLevelsPanel() {
  const { user } = useAuth();

  const { data: userPoints } = useQuery({
    queryKey: ['user-points-levels', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_points')
        .select('total_points')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: levels, isLoading } = useQuery({
    queryKey: ['all-loyalty-levels-panel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_levels')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  const userTotalPoints = userPoints?.total_points || 0;

  return (
    <div className="space-y-4">
      {levels?.map((level) => {
        const isCurrentLevel = userTotalPoints >= level.min_points && 
          (!levels.find(l => l.min_points > level.min_points && userTotalPoints >= l.min_points));
        const isLocked = userTotalPoints < level.min_points;
        
        return (
          <Card 
            key={level.id}
            className={`transition-all ${isCurrentLevel ? 'ring-2' : ''} ${isLocked ? 'opacity-50' : ''}`}
            style={{ 
              borderColor: level.color + '40',
              ...(isCurrentLevel && { '--tw-ring-color': level.color } as any)
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: level.color + '20' }}
                >
                  <CreditCard className="h-6 w-6" style={{ color: level.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold" style={{ color: level.color }}>
                      {level.name_ar}
                    </p>
                    {isCurrentLevel && (
                      <Badge className="text-[9px]" style={{ backgroundColor: level.color }}>
                        مستواك الحالي
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    يتطلب {level.min_points.toLocaleString()} نقطة
                  </p>
                  
                  {/* Benefits */}
                  <div className="mt-2 space-y-1">
                    {level.discount_percentage && level.discount_percentage > 0 && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Check className="h-3 w-3 text-green-500" />
                        <span>خصم {level.discount_percentage}%</span>
                      </div>
                    )}
                    {level.bonus_points_percentage && level.bonus_points_percentage > 0 && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Check className="h-3 w-3 text-green-500" />
                        <span>نقاط إضافية {level.bonus_points_percentage}%</span>
                      </div>
                    )}
                    {level.free_shipping && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Check className="h-3 w-3 text-green-500" />
                        <span>شحن مجاني</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
