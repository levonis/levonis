import { CheckSquare, Ticket, Package, TrendingUp } from "lucide-react";
import { MainTabId } from "./RewardsMainTabs";
import { SubTabId } from "./RewardsSubTabs";

interface QuickActionsBarProps {
  onNavigate: (mainTab: MainTabId, subTab: SubTabId) => void;
}

const quickActions = [
  { 
    id: 'daily-tasks', 
    label: 'مهام اليوم', 
    icon: CheckSquare, 
    mainTab: 'points' as MainTabId, 
    subTab: 'daily-tasks' as SubTabId,
    bgColor: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    borderColor: 'border-amber-500/20'
  },
  { 
    id: 'get-tickets', 
    label: 'احصل على تذاكر', 
    icon: Ticket, 
    mainTab: 'competitions' as MainTabId, 
    subTab: 'get-tickets' as SubTabId,
    bgColor: 'bg-purple-500/10',
    iconColor: 'text-purple-500',
    borderColor: 'border-purple-500/20'
  },
  { 
    id: 'storage', 
    label: 'مخزني', 
    icon: Package, 
    mainTab: 'competitions' as MainTabId, 
    subTab: 'storage' as SubTabId,
    bgColor: 'bg-green-500/10',
    iconColor: 'text-green-500',
    borderColor: 'border-green-500/20'
  },
  { 
    id: 'upgrade', 
    label: 'ترقية البطاقة', 
    icon: TrendingUp, 
    mainTab: 'cards' as MainTabId, 
    subTab: 'upgrade' as SubTabId,
    bgColor: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
    borderColor: 'border-blue-500/20'
  },
];

export default function QuickActionsBar({ onNavigate }: QuickActionsBarProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-0.5">
      {quickActions.map((action) => {
        const Icon = action.icon;
        
        return (
          <button
            key={action.id}
            onClick={() => onNavigate(action.mainTab, action.subTab)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${action.bgColor} ${action.borderColor} hover:shadow-sm transition-all min-w-fit active:scale-95`}
          >
            <Icon className={`h-3.5 w-3.5 ${action.iconColor}`} />
            <span className="text-[10px] font-medium whitespace-nowrap text-foreground">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
