import { useState } from "react";
import { ArrowRight, Ticket, Star, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useGachaMachinePrizes, useGachaGuaranteedRules } from "./useGachaData";
import GameBalanceBar from "@/components/games/GameBalanceBar";
import GachaSpinReveal3D from "./GachaSpinReveal3D";
import GachaMachine3D from "./GachaMachine3D";
import { useLanguage } from "@/lib/i18n";
import { pickI18n } from "@/lib/i18nField";

interface Props {
  machineId: string;
  onBack: () => void;
}

export default function GachaMachineDetail({ machineId, onBack }: Props) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [spinning, setSpinning] = useState(false);
  const [spinResults, setSpinResults] = useState<any[] | null>(null);
  const [showPrizePool, setShowPrizePool] = useState(false);

  const { data: machine } = useQuery({
    queryKey: ["gacha-machine", machineId],
    queryFn: async () => {
      const { data } = await supabase
        .from("gacha_machines" as any)
        .select("*")
        .eq("id", machineId)
        .single();
      return data as any;
    },
  });

  const { data: prizes = [] } = useGachaMachinePrizes(machineId);
  const { data: guaranteedRules = [] } = useGachaGuaranteedRules(machineId);

  const { data: ticketData } = useQuery({
    queryKey: ["user-tickets-game", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_tickets")
        .select("ticket_count")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const currentTickets = ticketData?.ticket_count ?? 0;
  const multiSpinOptions = machine?.multi_spin_options ?? [1, 3, 5, 10];

  const handleSpin = async (count: number) => {
    if (!user) {
      toast({ title: "يجب تسجيل الدخول أولاً", variant: "destructive" });
      return;
    }
    if (spinning) return;
    
    const cost = (machine?.ticket_cost ?? 1) * count;
    if (currentTickets < cost) {
      toast({ title: "تذاكر غير كافية", description: `تحتاج ${cost} تذكرة`, variant: "destructive" });
      return;
    }

    setSpinning(true);
    try {
      const { data, error } = await supabase.functions.invoke("gacha-spin", {
        body: { machine_id: machineId, spin_count: count },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSpinResults(data.results);
      queryClient.invalidateQueries({ queryKey: ["user-tickets-game"] });
      queryClient.invalidateQueries({ queryKey: ["user-points-game"] });
      queryClient.invalidateQueries({ queryKey: ["gacha-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["gacha-user-coupons"] });
      queryClient.invalidateQueries({ queryKey: ["gacha-spin-history"] });
    } catch (err: any) {
      toast({ title: "خطأ في اللف", description: err.message || "حدث خطأ", variant: "destructive" });
    } finally {
      setSpinning(false);
    }
  };

  if (spinResults) {
    return (
      <GachaSpinReveal3D
        results={spinResults}
        onDone={() => setSpinResults(null)}
        onSpinAgain={() => { setSpinResults(null); handleSpin(1); }}
      />
    );
  }

  if (!machine) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-2xl">🎰</div>
      </div>
    );
  }

  const totalWeight = prizes.reduce((s: number, p: any) => s + Number(p.drop_weight), 0);
  const theme = machine.theme || "default";

  return (
    <div className="min-h-screen pb-20" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-primary/20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground">
            <ArrowRight className="h-4 w-4" /> رجوع
          </Button>
          <GameBalanceBar />
        </div>
      </div>

      {/* Machine Visual */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-zinc-900/80 via-card to-zinc-900/50 border border-border/30 p-8 text-center">
          {/* Arcade background pattern */}
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }} />
          
          {/* Machine */}
          <div className="relative mb-6 flex justify-center">
            <GachaMachine3D
              theme={theme}
              spinning={spinning}
              onKnobClick={() => !spinning && handleSpin(1)}
            />
          </div>

          <h1 className="text-xl font-bold text-foreground mb-1">{pickI18n(machine, "name", language)}</h1>
          {pickI18n(machine, "description", language) && (
            <p className="text-sm text-muted-foreground mb-4">{pickI18n(machine, "description", language)}</p>
          )}

          {/* Cost display */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Ticket className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-primary">{machine.ticket_cost} تذكرة / لفة</span>
          </div>

          {/* Spin Buttons */}
          <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
            {(multiSpinOptions as number[]).map((count: number) => {
              const cost = machine.ticket_cost * count;
              const canAfford = currentTickets >= cost;
              return (
                <Button
                  key={count}
                  onClick={() => handleSpin(count)}
                  disabled={spinning || !canAfford}
                  className={`relative overflow-hidden ${
                    count === 1 
                      ? "bg-primary hover:bg-primary/90" 
                      : count === 10 
                        ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white" 
                        : "bg-primary/80 hover:bg-primary/70"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <span className="font-bold text-sm">{count}x لفة</span>
                    <span className="text-[10px] opacity-80 flex items-center gap-0.5">
                      <Ticket className="h-2.5 w-2.5" /> {cost}
                    </span>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Guaranteed Rewards */}
      {guaranteedRules.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 pb-4">
          <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" /> مكافآت مضمونة
          </h3>
          <div className="space-y-2">
            {guaranteedRules.map((rule: any) => (
              <div key={rule.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-amber-500/20">
                {rule.reward_image_url ? (
                  <img src={rule.reward_image_url} className="w-10 h-10 rounded-lg object-cover" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-lg">🎁</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{pickI18n(rule, "reward_name", language)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {getConditionLabel(rule.condition_type, rule.condition_value)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prize Pool Toggle */}
      <div className="max-w-2xl mx-auto px-4">
        <button
          onClick={() => setShowPrizePool(!showPrizePool)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-card border border-border/30 text-sm"
        >
          <span className="flex items-center gap-2 font-medium text-foreground">
            <Info className="h-4 w-4 text-primary" /> مجموعة الجوائز
          </span>
          <span className="text-muted-foreground text-xs">{prizes.length} جائزة</span>
        </button>
        
        {showPrizePool && (
          <div className="mt-2 space-y-1.5">
            {prizes.map((prize: any) => {
              const chance = totalWeight > 0 ? ((Number(prize.drop_weight) / totalWeight) * 100).toFixed(1) : "0";
              const rarityColor = prize.gacha_rarity_tiers?.color || "#888";
              return (
                <div key={prize.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-card/50 border border-border/20">
                  {prize.prize_image_url ? (
                    <img src={prize.prize_image_url} className="w-8 h-8 rounded object-cover" alt="" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-sm">
                      {prize.prize_type === "doll" ? "🧸" : prize.prize_type === "coupon" ? "🎟️" : prize.prize_type === "points" ? "⭐" : "💡"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{pickI18n(prize, "prize_name", language)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {pickI18n(prize.gacha_rarity_tiers, "name", language) || "عادي"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: rarityColor }} />
                    <span className="text-[10px] font-mono text-muted-foreground">{chance}%</span>
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

function getConditionLabel(type: string, value: number): string {
  switch (type) {
    case "first_spin": return "عند أول لفة";
    case "spin_count": return `عند اللفة رقم ${value}`;
    case "exact_spend": return `عند إنفاق ${value} تذكرة بالضبط`;
    case "spend_up_to": return `عند إنفاق حتى ${value} تذكرة`;
    case "spend_at_least": return `عند إنفاق ${value} تذكرة أو أكثر`;
    default: return "";
  }
}
