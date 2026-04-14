import { useState } from "react";
import { ArrowRight, Star, Ticket, Package, ShoppingBag, History, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGachaMachines, useGachaSettings } from "./useGachaData";
import GameBalanceBar from "@/components/games/GameBalanceBar";
import GachaMachineCard from "./GachaMachineCard";
import GachaMachineDetail from "./GachaMachineDetail";
import GachaCollection from "./GachaCollection";
import GachaMarketplace from "./GachaMarketplace";
import GachaSpinHistory from "./GachaSpinHistory";
import GachaCoupons from "./GachaCoupons";

type GachaView = "landing" | "machine" | "collection" | "marketplace" | "history" | "coupons";

interface Props {
  onBack: () => void;
}

export default function GachaLanding({ onBack }: Props) {
  const [view, setView] = useState<GachaView>("landing");
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const { data: machines = [], isLoading } = useGachaMachines();
  const { data: settings } = useGachaSettings();

  const handleSelectMachine = (id: string) => {
    setSelectedMachineId(id);
    setView("machine");
  };

  if (view === "machine" && selectedMachineId) {
    return <GachaMachineDetail machineId={selectedMachineId} onBack={() => setView("landing")} />;
  }
  if (view === "collection") {
    return <GachaCollection onBack={() => setView("landing")} />;
  }
  if (view === "marketplace") {
    return <GachaMarketplace onBack={() => setView("landing")} />;
  }
  if (view === "history") {
    return <GachaSpinHistory onBack={() => setView("landing")} />;
  }
  if (view === "coupons") {
    return <GachaCoupons onBack={() => setView("landing")} />;
  }

  return (
    <div className="min-h-screen pb-20" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-primary/20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground">
            <ArrowRight className="h-4 w-4" /> رجوع
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-lg">🎰</span>
            <span className="font-bold text-primary text-sm">GACHA</span>
          </div>
        </div>
      </div>

      {/* Balance Bar */}
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <GameBalanceBar />
      </div>

      {/* Quick Nav */}
      <div className="max-w-2xl mx-auto px-4 pb-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {[
            { icon: Package, label: "مجموعتي", view: "collection" as GachaView },
            { icon: ShoppingBag, label: "السوق", view: "marketplace" as GachaView },
            { icon: Gift, label: "كوبوناتي", view: "coupons" as GachaView },
            { icon: History, label: "السجل", view: "history" as GachaView },
          ].map(item => (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border/30 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all whitespace-nowrap"
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hero Banner */}
      <div className="max-w-2xl mx-auto px-4 pb-4">
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-purple-600/20 via-pink-500/10 to-amber-500/20 border border-primary/20 p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(168,85,247,0.15),transparent_60%)]" />
          <div className="relative">
            <div className="text-4xl mb-2">🎰</div>
            <h1 className="text-xl font-bold text-foreground mb-1">صالة الغاتشا</h1>
            <p className="text-sm text-muted-foreground">
              أدِر الآلة واكسب دُمى نادرة، كوبونات، ونقاط!
            </p>
          </div>
          {/* Decorative capsules */}
          <div className="absolute -left-4 -bottom-4 text-6xl opacity-20 rotate-12">🔮</div>
          <div className="absolute left-16 -top-2 text-3xl opacity-15 -rotate-12">✨</div>
        </div>
      </div>

      {/* Machines Grid */}
      <div className="max-w-2xl mx-auto px-4">
        <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <span className="text-primary">🎮</span> الآلات المتاحة
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-card animate-pulse border border-border/20" />
            ))}
          </div>
        ) : machines.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="text-4xl mb-3">🎰</div>
            <p className="text-sm">لا توجد آلات متاحة حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {machines.map((machine: any) => (
              <GachaMachineCard
                key={machine.id}
                machine={machine}
                onSelect={() => handleSelectMachine(machine.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
