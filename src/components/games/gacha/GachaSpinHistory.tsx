import { ArrowRight, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserSpinHistory } from "./useGachaData";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface Props {
  onBack: () => void;
}

export default function GachaSpinHistory({ onBack }: Props) {
  const { data: spins = [], isLoading } = useUserSpinHistory();

  return (
    <div className="min-h-screen pb-20" dir="rtl">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-primary/20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground">
            <ArrowRight className="h-4 w-4" /> رجوع
          </Button>
          <span className="text-sm font-bold text-foreground flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> سجل اللف
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-3">
        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-card animate-pulse" />)}
          </div>
        ) : spins.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <span className="text-4xl mb-3 block">🎰</span>
            <p className="text-sm">لم تلعب بعد</p>
          </div>
        ) : (
          <div className="space-y-2">
            {spins.map((spin: any) => {
              const rarityColor = spin.gacha_rarity_tiers?.color || "#888";
              return (
                <div key={spin.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/20">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg">
                    {spin.prize_type === "doll" ? "🧸" : spin.prize_type === "coupon" ? "🎟️" : spin.prize_type === "points" ? "⭐" : "💡"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{spin.prize_name_ar}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{spin.gacha_machines?.name_ar}</span>
                      {spin.gacha_rarity_tiers && (
                        <>
                          <span className="text-[10px] text-muted-foreground">•</span>
                          <span className="text-[10px] flex items-center gap-0.5" style={{ color: rarityColor }}>
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: rarityColor }} />
                            {spin.gacha_rarity_tiers.name_ar}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(spin.created_at), { addSuffix: true, locale: ar })}
                    </p>
                    <p className="text-[10px] text-primary font-mono">-{spin.tickets_spent} 🎟️</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
