import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Mail, CheckCircle, Banknote, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { pickI18n } from "@/lib/i18nField";

export default function AssistanceEnvelopes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { language } = useLanguage();

  const { data: envelopes, isLoading } = useQuery({
    queryKey: ["assistance-envelopes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assistance_red_envelopes")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: myClaims } = useQuery({
    queryKey: ["assistance-envelope-claims", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("assistance_envelope_claims")
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const claimMutation = useMutation({
    mutationFn: async (envelopeId: string) => {
      if (!user) throw new Error("يجب تسجيل الدخول");
      const { data, error } = await supabase.rpc("claim_assistance_envelope", {
        p_envelope_id: envelopeId,
        p_user_id: user.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("تم تحصيل الظرف الأحمر! سيُطبّق تلقائياً على مشترياتك 🧧");
      queryClient.invalidateQueries({ queryKey: ["assistance-envelopes"] });
      queryClient.invalidateQueries({ queryKey: ["assistance-envelope-claims"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getClaim = (envelopeId: string) => myClaims?.find(c => c.envelope_id === envelopeId);

  const glassCard = "rounded-xl border border-destructive/25 bg-background ";

  if (isLoading) {
    return <div className="space-y-3">{[1, 2].map(i => <div key={i} className={`h-28 ${glassCard} animate-pulse`} />)}</div>;
  }

  if (!envelopes?.length) {
    return (
      <div className={`text-center py-12 ${glassCard}`}>
        <div className="w-14 h-14 mx-auto mb-3 rounded-lg border border-destructive/30 bg-destructive/10 flex items-center justify-center">
          <Mail className="h-7 w-7 text-destructive/60" />
        </div>
        <p className="text-sm text-muted-foreground">لا توجد ظروف حمراء متاحة حالياً</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {envelopes.map(env => {
        const claim = getClaim(env.id);
        const remaining = env.is_limited && env.max_claims ? env.max_claims - env.claimed_count : null;

        return (
          <div key={env.id} className={`${glassCard} overflow-hidden`}>
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg border border-destructive/30 bg-destructive/10 flex items-center justify-center shrink-0">
                  <Mail className="h-6 w-6 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-sm text-foreground">{pickI18n(env, "title", language)}</h4>
                    {env.is_limited && remaining !== null && (
                      <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive bg-background">
                        متبقي {remaining}
                      </Badge>
                    )}
                  </div>
                  {pickI18n(env, "description", language) && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{pickI18n(env, "description", language)}</p>
                  )}
                </div>
              </div>

              {/* How it works */}
              <div className="mt-3 p-3 rounded-lg border border-border/30 bg-background space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground">آلية العمل:</p>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>كل <strong className="text-foreground">{Number(env.spend_threshold).toLocaleString()}</strong> د.ع</span>
                  </div>
                  <span className="text-muted-foreground">→</span>
                  <div className="flex items-center gap-1.5">
                    <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                    <span>خصم <strong className="text-destructive">{Number(env.discount_amount).toLocaleString()}</strong> د.ع</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  الحد الأعلى للخصم: <strong className="text-foreground">{Number(env.max_discount).toLocaleString()}</strong> د.ع
                </p>
              </div>

              <div className="mt-3">
                {claim ? (
                  <div className="flex items-center gap-2 rounded-lg p-2.5 border border-destructive/25 bg-destructive/10">
                    <CheckCircle className="h-4 w-4 text-destructive shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-foreground">تم التحصيل</p>
                      <p className="text-[10px] text-muted-foreground">
                        المتبقي: <strong>{Number(claim.remaining_discount).toLocaleString()}</strong> د.ع
                      </p>
                    </div>
                  </div>
                ) : (remaining === null || remaining > 0) ? (
                  <Button
                    className="w-full h-9 text-xs rounded-lg gap-1.5 border border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/25 "
                    onClick={() => claimMutation.mutate(env.id)}
                    disabled={claimMutation.isPending}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    احصل على الظرف
                  </Button>
                ) : (
                  <div className="text-center text-xs text-muted-foreground py-2">نفدت الكمية</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
