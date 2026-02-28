import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Ticket, CheckCircle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function AssistanceCoupons() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["assistance-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assistance_coupons")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: myClaims } = useQuery({
    queryKey: ["assistance-coupon-claims", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("assistance_coupon_claims")
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const claimMutation = useMutation({
    mutationFn: async (couponId: string) => {
      if (!user) throw new Error("يجب تسجيل الدخول");
      const { data, error } = await supabase.rpc("claim_assistance_coupon", {
        p_coupon_id: couponId,
        p_user_id: user.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (code) => {
      toast.success(`تم تحصيل الكوبون: ${code}`);
      queryClient.invalidateQueries({ queryKey: ["assistance-coupons"] });
      queryClient.invalidateQueries({ queryKey: ["assistance-coupon-claims"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getClaim = (couponId: string) => myClaims?.find(c => c.coupon_id === couponId);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("تم نسخ الكود");
  };

  if (isLoading) {
    return <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-28 rounded-xl bg-muted/30 animate-pulse" />)}</div>;
  }

  if (!coupons?.length) {
    return (
      <div className="text-center py-12">
        <Ticket className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">لا توجد كوبونات متاحة حالياً</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {coupons.map(coupon => {
        const claim = getClaim(coupon.id);
        const remaining = coupon.max_claims - coupon.claimed_count;
        const progress = (coupon.claimed_count / coupon.max_claims) * 100;

        return (
          <div key={coupon.id} className="rounded-xl border border-border/40 bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Ticket className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-bold text-sm text-foreground">{coupon.title_ar}</h4>
                  <Badge variant="secondary" className="text-[10px]">
                    {coupon.discount_type === "percentage"
                      ? `${coupon.discount_value}%`
                      : `${coupon.discount_value.toLocaleString()} د.ع`}
                  </Badge>
                </div>
                {coupon.description_ar && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{coupon.description_ar}</p>
                )}
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>متبقي {remaining} من {coupon.max_claims}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
              </div>
            </div>

            <div className="mt-3">
              {claim ? (
                <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg p-2.5">
                  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground">كودك الخاص</p>
                    <p className="text-sm font-mono font-bold text-foreground">{claim.coupon_code}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => copyCode(claim.coupon_code)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : remaining > 0 ? (
                <Button
                  className="w-full h-9 text-xs rounded-lg gap-1.5"
                  onClick={() => claimMutation.mutate(coupon.id)}
                  disabled={claimMutation.isPending}
                >
                  <Ticket className="h-3.5 w-3.5" />
                  تحصيل الكوبون
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
