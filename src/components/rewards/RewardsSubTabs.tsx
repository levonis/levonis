import { cn } from "@/lib/utils";
import { MainTabId } from "./RewardsMainTabs";

export type PointsSubTab = 'summary' | 'daily-tasks' | 'redeem' | 'store';
export type CompetitionsSubTab = 'competitions';
export type CardsSubTab = 'benefits' | 'upgrade' | 'exclusive-offers';
export type InsuranceSubTab = 'status' | 'plans' | 'maintenance';

export type SubTabId = PointsSubTab | CompetitionsSubTab | CardsSubTab | InsuranceSubTab;

interface SubTabConfig {
  id: SubTabId;
  label: string;
}

const subTabsConfig: Record<MainTabId, SubTabConfig[]> = {
  points: [
    { id: 'summary', label: 'ملخص' },
    { id: 'daily-tasks', label: 'المهام' },
    { id: 'redeem', label: 'استبدال' },
    { id: 'store', label: 'متجر النقاط' },
  ],
  competitions: [
    { id: 'competitions', label: 'المسابقات' },
  ],
  cards: [
    { id: 'benefits', label: 'بطاقتي' },
    { id: 'upgrade', label: 'الترقية' },
    { id: 'exclusive-offers', label: 'عروض حصرية' },
  ],
  insurance: [
    { id: 'status', label: 'طابعاتي' },
    { id: 'plans', label: 'الباقات' },
    { id: 'maintenance', label: 'الصيانة' },
  ],
};

interface RewardsSubTabsProps {
  mainTab: MainTabId;
  activeSubTab: SubTabId;
  onSubTabChange: (subTab: SubTabId) => void;
}

export default function RewardsSubTabs({ mainTab, activeSubTab, onSubTabChange }: RewardsSubTabsProps) {
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
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export { subTabsConfig };
