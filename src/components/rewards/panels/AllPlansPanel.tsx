import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Check } from "lucide-react";
import { toast } from "sonner";

export default function AllPlansPanel() {
  const { data: plans, isLoading } = useQuery({
    queryKey: ['all-protection-plans-panel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protection_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          لا توجد باقات متاحة حالياً
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {plans.map((plan) => (
        <Card 
          key={plan.id}
          className="overflow-hidden"
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                <Shield className="h-6 w-6 text-green-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-lg">{plan.name_ar}</p>
                  {plan.badge_text && (
                    <Badge variant="secondary" className="text-[10px]">
                      {plan.badge_text}
                    </Badge>
                  )}
                </div>
                <p className="text-xl font-bold text-primary mt-1">
                  {plan.monthly_price?.toLocaleString()} د.ع
                  <span className="text-sm font-normal text-muted-foreground">/شهر</span>
                </p>
              </div>
            </div>

            {plan.description_ar && (
              <p className="text-sm text-muted-foreground mb-3">
                {plan.description_ar}
              </p>
            )}

            {/* Features */}
            {plan.features && Array.isArray(plan.features) && (
              <div className="space-y-1.5 mb-4">
                {(plan.features as string[]).slice(0, 4).map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            )}

            <Button 
              className="w-full"
              onClick={() => toast.info('سيتم فتح نموذج الاشتراك قريباً')}
            >
              اشترك الآن
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
