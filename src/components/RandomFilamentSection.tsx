import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dices, Sparkles, ChevronLeft } from "lucide-react";

export default function RandomFilamentSection() {
  const navigate = useNavigate();
  const { data: settings } = useQuery({
    queryKey: ["random-filament-settings-public"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("random_filament_settings")
        .select("enabled, title_ar, description_ar, direct_price_iqd, pre_order_price_iqd, category_ids")
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!settings?.enabled || !settings?.category_ids?.length) return null;

  return (
    <section className="container mx-auto px-4 py-6">
      <Card
        className="glass-panel relative overflow-hidden cursor-pointer transition-transform active:scale-[0.99]"
        onClick={() => navigate("/random-filament")}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-accent/15" />
        <CardContent className="relative p-5 flex items-center gap-4">
          <div className="size-14 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
            <Dices className="size-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold truncate">{settings.title_ar}</h3>
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="size-3" /> جديد
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{settings.description_ar}</p>
          </div>
          <Button size="sm" variant="ghost" className="shrink-0">
            ابدأ
            <ChevronLeft className="size-4" />
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
