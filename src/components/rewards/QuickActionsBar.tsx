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
    bgColor: 'bg-amber-500/15',
    iconColor: 'text-amber-600',
    borderColor: 'border-amber-500/30'
  },
  { 
    id: 'competitions', 
    label: 'المسابقات', 
    icon: Trophy, 
    mainTab: 'competitions' as MainTabId, 
    subTab: 'competitions' as SubTabId,
    bgColor: 'bg-purple-500/15',
    iconColor: 'text-purple-600',
    borderColor: 'border-purple-500/30'
  },
  { 
    id: 'redeem', 
    label: 'متجر النقاط', 
    icon: Gift, 
    mainTab: 'points' as MainTabId, 
    subTab: 'redeem' as SubTabId,
    bgColor: 'bg-cyan-500/15',
    iconColor: 'text-cyan-600',
    borderColor: 'border-cyan-500/30'
  },
  { 
    id: 'upgrade', 
    label: 'بطاقة العضوية', 
    icon: Crown, 
    mainTab: 'cards' as MainTabId, 
    subTab: 'benefits' as SubTabId,
    bgColor: 'bg-blue-500/15',
    iconColor: 'text-blue-600',
    borderColor: 'border-blue-500/30'
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
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border ${action.bgColor} ${action.borderColor} hover:shadow-md transition-all min-w-fit active:scale-95`}
          >
            <Icon className={`h-4 w-4 ${action.iconColor}`} strokeWidth={2} />
            <span className="text-[11px] font-medium whitespace-nowrap text-foreground">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
