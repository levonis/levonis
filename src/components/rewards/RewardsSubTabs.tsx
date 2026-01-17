import { cn } from "@/lib/utils";
import { MainTabId } from "./RewardsMainTabs";

export type PointsSubTab = 'summary' | 'daily-tasks' | 'redeem';
export type CompetitionsSubTab = 'competitions' | 'get-tickets' | 'storage';
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
    { id: 'daily-tasks', label: 'مهام اليوم' },
    { id: 'redeem', label: 'استبدال' },
  ],
  competitions: [
    { id: 'competitions', label: 'المسابقات' },
    { id: 'get-tickets', label: 'احصل على تذاكر' },
    { id: 'storage', label: 'مخزني' },
  ],
  cards: [
    { id: 'benefits', label: 'مميزاتي' },
    { id: 'upgrade', label: 'ترقية البطاقة' },
    { id: 'exclusive-offers', label: 'العروض الحصرية' },
  ],
  insurance: [
    { id: 'status', label: 'حالتي' },
    { id: 'plans', label: 'الباقات' },
    { id: 'maintenance', label: 'الصيانة/الاستبدال' },
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
    <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
      {subTabs.map((tab) => {
        const isActive = activeSubTab === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => onSubTabChange(tab.id)}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all",
              isActive 
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
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
