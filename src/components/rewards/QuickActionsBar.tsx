import { ListChecks, Crown, Gift, Trophy } from "lucide-react";
import { MainTabId } from "./RewardsMainTabs";
import { SubTabId } from "./RewardsSubTabs";
import { useLanguage } from "@/lib/i18n";
import { TranslationKeys } from "@/lib/i18n/types";

interface QuickActionsBarProps {
  onNavigate: (mainTab: MainTabId, subTab: SubTabId) => void;
}

const quickActions: { id: string; labelKey: keyof TranslationKeys; icon: typeof ListChecks; mainTab: MainTabId; subTab: SubTabId }[] = [
  { id: 'daily-tasks', labelKey: 'rewards_quick_daily_tasks', icon: ListChecks, mainTab: 'points', subTab: 'daily-tasks' },
  { id: 'competitions', labelKey: 'rewards_quick_competitions', icon: Trophy, mainTab: 'competitions', subTab: 'competitions' },
  { id: 'redeem', labelKey: 'rewards_quick_points_store', icon: Gift, mainTab: 'points', subTab: 'redeem' },
  { id: 'upgrade', labelKey: 'rewards_quick_membership_card', icon: Crown, mainTab: 'cards', subTab: 'benefits' },
];

export default function QuickActionsBar({ onNavigate }: QuickActionsBarProps) {
  const { t } = useLanguage();
  
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1 -mx-1 px-1">
      {quickActions.map((action) => {
        const Icon = action.icon;
        
        return (
          <button
            key={action.id}
            onClick={() => onNavigate(action.mainTab, action.subTab)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border bg-primary/10 border-primary/20 hover:shadow-md transition-all min-w-fit active:scale-95"
          >
            <Icon className="h-4 w-4 text-primary" strokeWidth={2} />
            <span className="text-[11px] font-medium whitespace-nowrap text-foreground">{t(action.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
