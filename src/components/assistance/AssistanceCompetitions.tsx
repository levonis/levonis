import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Calendar, Crown, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function AssistanceCompetitions() {
  const { data: giveaways, isLoading } = useQuery({
    queryKey: ["assistance-merchant-giveaways"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_giveaways")
        .select("*")
        .in("status", ["active", "completed"])
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const active = giveaways?.filter(c => c.status === "active") || [];
  const completed = giveaways?.filter(c => c.status === "completed") || [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="h-32 rounded-xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!giveaways?.length) {
    return (
      <div className="text-center py-12">
        <Trophy className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">لا توجد مسابقات تجار حالياً</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {active.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <h3 className="text-sm font-black text-foreground">المسابقات النشطة</h3>
          </div>
          {active.map(c => (
            <div
              key={c.id}
              className="rounded-xl border border-border/40 bg-card p-4 hover:border-primary/30 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-3">
                {c.prize_image_url ? (
                  <img src={c.prize_image_url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Trophy className="h-7 w-7 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-primary/10 text-primary text-[10px] border-0">نشطة</Badge>
                  </div>
                  <h4 className="font-bold text-sm text-foreground truncate">{c.title_ar}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.prize_name_ar}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                    {c.draw_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(c.draw_date), "d MMM yyyy", { locale: ar })}
                      </span>
                    )}
                    {c.prize_value && (
                      <span className="font-bold text-primary">{c.prize_value.toLocaleString()} د.ع</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {completed.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-border" />
            <h3 className="text-xs font-bold text-muted-foreground">المسابقات المنتهية</h3>
          </div>
          {completed.map(c => (
            <div key={c.id} className="rounded-xl border border-border/20 bg-muted/20 p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                  <CheckCircle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs text-foreground truncate">{c.title_ar}</h4>
                  <p className="text-[10px] text-muted-foreground">{c.prize_name_ar}</p>
                  {c.winner_merchant_id && (
                    <div className="flex items-center gap-1 mt-1">
                      <Crown className="h-3 w-3 text-primary" />
                      <span className="text-[10px] font-bold text-primary">تم تحديد الفائز</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
