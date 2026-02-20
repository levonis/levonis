import { cn } from "@/lib/utils";
import { Coins, Trophy, Crown, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { TranslationKeys } from "@/lib/i18n/types";

export type MainTabId = 'points' | 'competitions' | 'cards' | 'insurance';

interface RewardsMainTabsProps {
  activeTab: MainTabId;
  onTabChange: (tab: MainTabId) => void;
}

const mainTabs: { id: MainTabId; labelKey: keyof TranslationKeys; icon: typeof Coins }[] = [
  { id: 'points', labelKey: 'rewards_tab_points', icon: Coins },
  { id: 'competitions', labelKey: 'rewards_tab_competitions', icon: Trophy },
  { id: 'cards', labelKey: 'rewards_tab_membership', icon: Crown },
  { id: 'insurance', labelKey: 'rewards_tab_protection', icon: ShieldCheck },
];

export default function RewardsMainTabs({ activeTab, onTabChange }: RewardsMainTabsProps) {
  const { t } = useLanguage();
  
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
            <span className="text-[10px] font-semibold leading-tight">{t(tab.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
