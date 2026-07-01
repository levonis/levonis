import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Gift, CheckCircle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { pickI18n } from "@/lib/i18nField";

export default function AssistanceGifts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { language } = useLanguage();

  const { data: gifts, isLoading } = useQuery({
    queryKey: ["assistance-gifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assistance_gifts")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: myClaims } = useQuery({
    queryKey: ["assistance-gift-claims", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("assistance_gift_claims")
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const claimMutation = useMutation({
    mutationFn: async (giftId: string) => {
      if (!user) throw new Error("يجب تسجيل الدخول");
      const { data, error } = await supabase.rpc("claim_assistance_gift", {
        p_gift_id: giftId,
        p_user_id: user.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("تم تحصيل الهدية! ستُضاف تلقائياً لطلبك القادم 🎁");
      queryClient.invalidateQueries({ queryKey: ["assistance-gifts"] });
      queryClient.invalidateQueries({ queryKey: ["assistance-gift-claims"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hasClaimed = (giftId: string) => myClaims?.some(c => c.gift_id === giftId);

  const glassCard = "rounded-xl border border-border/30 bg-background ";

  if (isLoading) {
    return <div className="space-y-3">{[1, 2].map(i => <div key={i} className={`h-28 ${glassCard} animate-pulse`} />)}</div>;
  }

  if (!gifts?.length) {
    return (
      <div className={`text-center py-12 ${glassCard}`}>
        <div className="w-14 h-14 mx-auto mb-3 rounded-lg border border-accent/30 bg-accent/10 flex items-center justify-center">
          <Gift className="h-7 w-7 text-accent-foreground/60" />
        </div>
        <p className="text-sm text-muted-foreground">لا توجد هدايا متاحة حالياً</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {gifts.map(gift => {
        const claimed = hasClaimed(gift.id);
        const remaining = gift.max_claims - gift.claimed_count;
        const progress = (gift.claimed_count / gift.max_claims) * 100;

        return (
          <div key={gift.id} className={`${glassCard} overflow-hidden`}>
            <div className="flex items-start gap-3 p-4">
              {gift.image_url ? (
                <div className="w-16 h-16 rounded-lg border border-border/30 bg-background overflow-hidden shrink-0">
                  <img src={gift.image_url} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg border border-accent/30 bg-accent/10 flex items-center justify-center shrink-0">
                  <Package className="h-7 w-7 text-accent-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm text-foreground">{pickI18n(gift, "title", language)}</h4>
                {pickI18n(gift, "description", language) && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{pickI18n(gift, "description", language)}</p>
                )}
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>متبقي {remaining} من {gift.max_claims}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
              </div>
            </div>
            <div className="px-4 pb-3">
              {claimed ? (
                <div className="flex items-center gap-1.5 text-xs text-primary font-bold rounded-lg px-3 py-2 justify-center border border-primary/25 bg-primary/10">
                  <CheckCircle className="h-3.5 w-3.5" />
                  تم التحصيل - ستُضاف للطلب القادم
                </div>
              ) : remaining > 0 ? (
                <Button
                  className="w-full h-9 text-xs rounded-lg gap-1.5 border border-primary/30 bg-primary/15 text-primary hover:bg-primary/25 "
                  onClick={() => claimMutation.mutate(gift.id)}
                  disabled={claimMutation.isPending}
                >
                  <Gift className="h-3.5 w-3.5" />
                  أضف الهدية للطلب التالي
                </Button>
              ) : (
                <div className="text-center text-xs text-muted-foreground py-2">نفدت الكمية</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
