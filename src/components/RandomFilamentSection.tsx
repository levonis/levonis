import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Dices, Sparkles, ArrowLeft, Wallet, ShieldAlert } from "lucide-react";
import WavyColors from "@/components/WavyColors";
import { useActiveLevoCard } from "@/hooks/useActiveLevoCard";

export default function RandomFilamentSection() {
  const navigate = useNavigate();
  const { data: activeLevoCard } = useActiveLevoCard();

  const { data: settings } = useQuery({
    queryKey: ["random-filament-settings-public"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("random_filament_settings")
        .select("enabled, title_ar, description_ar, category_ids")
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: stats } = useQuery({
    queryKey: ["random-filament-section-stats"],
    enabled: !!settings?.enabled,
    queryFn: async () => {
      const [{ count: offersCount }, { data: priceRow }] = await Promise.all([
        (supabase as any)
          .from("random_filament_offers")
          .select("id", { count: "exact", head: true })
          .eq("enabled", true),
        (supabase as any)
          .from("random_filament_offers")
          .select("price_iqd")
          .eq("enabled", true)
          .order("price_iqd", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);
      return {
        offers: offersCount || 0,
        minPrice: priceRow?.price_iqd as number | undefined,
      };
    },
    staleTime: 2 * 60 * 1000,
  });

  if (!activeLevoCard) return null;
  if (!settings?.enabled || !settings?.category_ids?.length) return null;

  const startingPrice = stats?.minPrice;

  return (
    <section className="container mx-auto px-4 py-4">
      <button
        type="button"
        onClick={() => navigate("/random-filament")}
        className="group relative w-full overflow-hidden rounded-3xl glass-panel text-right transition-transform active:scale-[0.985] focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        {/* animated colors backdrop */}
        <div className="absolute inset-0 opacity-70">
          <WavyColors />
        </div>
        {/* readability overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-background/85 via-background/65 to-background/30" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />

        {/* shimmer accent */}
        <div className="pointer-events-none absolute -top-20 -left-20 size-48 rounded-full bg-primary/30 blur-3xl" />

        <div className="relative p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="size-14 rounded-2xl bg-primary/20 backdrop-blur-md flex items-center justify-center shrink-0 ring-1 ring-primary/30">
              <Dices className="size-7 text-primary drop-shadow" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-lg sm:text-xl font-extrabold truncate">
                  {settings.title_ar}
                </h3>
                <Badge className="gap-1 bg-primary/90 text-primary-foreground border-0 animate-pulse">
                  <Sparkles className="size-3" /> جديد
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                {settings.description_ar}
              </p>
            </div>
          </div>

          {/* meta row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {!!stats?.offers && (
                <Badge
                  variant="outline"
                  className="bg-background/60 backdrop-blur-md gap-1"
                >
                  <Sparkles className="size-3 text-primary" />
                  {stats.offers} عرض
                </Badge>
              )}
              {startingPrice ? (
                <Badge
                  variant="outline"
                  className="bg-background/60 backdrop-blur-md"
                >
                  يبدأ من {Number(startingPrice).toLocaleString()} د.ع
                </Badge>
              ) : null}
              <Badge
                variant="outline"
                className="bg-background/60 backdrop-blur-md gap-1"
              >
                <Wallet className="size-3 text-primary" /> ادفع واكتشف
              </Badge>
            </div>

            <span className="inline-flex items-center gap-1 text-sm font-bold text-primary group-hover:gap-2 transition-all">
              ابدأ الآن
              <ArrowLeft className="size-4" />
            </span>
          </div>

          {/* warning strip */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-background/55 backdrop-blur-md rounded-xl px-3 py-2 border border-destructive/30">
            <ShieldAlert className="size-3.5 text-destructive shrink-0" />
            <span className="line-clamp-1">
              الطلب نهائي وغير قابل للإلغاء — أي إلغاء يؤدي للحظر الدائم من القسم.
            </span>
          </div>
        </div>
      </button>
    </section>
  );
}
