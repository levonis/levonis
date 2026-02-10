import { cn } from "@/lib/utils";
import { Coins, Trophy, Crown, ShieldCheck } from "lucide-react";

export type MainTabId = 'points' | 'competitions' | 'cards' | 'insurance';

interface RewardsMainTabsProps {
  activeTab: MainTabId;
  onTabChange: (tab: MainTabId) => void;
}

const mainTabs = [
  { id: 'points' as const, label: 'النقاط', icon: Coins },
  { id: 'competitions' as const, label: 'المسابقات', icon: Trophy },
  { id: 'cards' as const, label: 'العضوية', icon: Crown },
  { id: 'insurance' as const, label: 'الحماية', icon: ShieldCheck },
];

export default function RewardsMainTabs({ activeTab, onTabChange }: RewardsMainTabsProps) {
  return (
    <div className="grid grid-cols-4 gap-1.5 p-1 bg-muted/50 rounded-xl">
      {mainTabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 px-1.5 rounded-xl border transition-all duration-200",
              isActive 
                ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-primary shadow-lg shadow-primary/30"
                : "bg-primary/10 text-primary border-primary/20 hover:opacity-90"
            )}
          >
            <Icon className={cn("h-5 w-5", !isActive && "opacity-80")} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-semibold leading-tight">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
