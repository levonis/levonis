import { ListChecks, Crown, Gift, Trophy } from "lucide-react";
import { MainTabId } from "./RewardsMainTabs";
import { SubTabId } from "./RewardsSubTabs";

interface QuickActionsBarProps {
  onNavigate: (mainTab: MainTabId, subTab: SubTabId) => void;
}

const quickActions = [
  { 
    id: 'daily-tasks', 
    label: 'المهام اليومية', 
    icon: ListChecks, 
    mainTab: 'points' as MainTabId, 
    subTab: 'daily-tasks' as SubTabId,
  },
  { 
    id: 'competitions', 
    label: 'المسابقات', 
    icon: Trophy, 
    mainTab: 'competitions' as MainTabId, 
    subTab: 'competitions' as SubTabId,
  },
  { 
    id: 'redeem', 
    label: 'متجر النقاط', 
    icon: Gift, 
    mainTab: 'points' as MainTabId, 
    subTab: 'redeem' as SubTabId,
  },
  { 
    id: 'upgrade', 
    label: 'بطاقة العضوية', 
    icon: Crown, 
    mainTab: 'cards' as MainTabId, 
    subTab: 'benefits' as SubTabId,
  },
];

export default function QuickActionsBar({ onNavigate }: QuickActionsBarProps) {
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
            <span className="text-[11px] font-medium whitespace-nowrap text-foreground">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
