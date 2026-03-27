import { cn } from "@/lib/utils";
import { MainTabId } from "./RewardsMainTabs";
import { useLanguage } from "@/lib/i18n";
import { TranslationKeys } from "@/lib/i18n/types";

export type PointsSubTab = 'summary' | 'daily-tasks' | 'redeem' | 'store';
export type CompetitionsSubTab = 'competitions';
export type CardsSubTab = 'benefits' | 'upgrade' | 'exclusive-offers';
export type InsuranceSubTab = 'status' | 'plans' | 'maintenance' | 'activate';

export type SubTabId = PointsSubTab | CompetitionsSubTab | CardsSubTab | InsuranceSubTab;

interface SubTabConfig {
  id: SubTabId;
  labelKey: keyof TranslationKeys;
}

const subTabsConfig: Record<MainTabId, SubTabConfig[]> = {
  points: [
    { id: 'summary', labelKey: 'rewards_sub_summary' },
    { id: 'daily-tasks', labelKey: 'rewards_sub_tasks' },
    { id: 'redeem', labelKey: 'rewards_sub_redeem' },
    { id: 'store', labelKey: 'rewards_sub_store' },
  ],
  competitions: [
    { id: 'competitions', labelKey: 'rewards_sub_competitions' },
  ],
  cards: [
    { id: 'benefits', labelKey: 'rewards_sub_my_card' },
    { id: 'upgrade', labelKey: 'rewards_sub_upgrade' },
    { id: 'exclusive-offers', labelKey: 'rewards_sub_exclusive_offers' },
  ],
  insurance: [
    { id: 'status', labelKey: 'rewards_sub_my_printers' },
    { id: 'plans', labelKey: 'rewards_sub_plans' },
    { id: 'maintenance', labelKey: 'rewards_sub_maintenance' },
  ],
};

interface RewardsSubTabsProps {
  mainTab: MainTabId;
  activeSubTab: SubTabId;
  onSubTabChange: (subTab: SubTabId) => void;
}

export default function RewardsSubTabs({ mainTab, activeSubTab, onSubTabChange }: RewardsSubTabsProps) {
  const { t } = useLanguage();
  const subTabs = subTabsConfig[mainTab];
  
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
      {subTabs.map((tab) => {
        const isActive = activeSubTab === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => onSubTabChange(tab.id)}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
              isActive 
                ? "bg-foreground text-background shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

export { subTabsConfig };
