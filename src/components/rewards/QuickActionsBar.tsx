import { useNavigate } from "react-router-dom";
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
    color: 'text-amber-500 bg-amber-500/10'
  },
  { 
    id: 'get-tickets', 
    label: 'احصل على تذاكر', 
    icon: Ticket, 
    mainTab: 'competitions' as MainTabId, 
    subTab: 'get-tickets' as SubTabId,
    color: 'text-purple-500 bg-purple-500/10'
  },
  { 
    id: 'storage', 
    label: 'مخزني', 
    icon: Package, 
    mainTab: 'competitions' as MainTabId, 
    subTab: 'storage' as SubTabId,
    color: 'text-green-500 bg-green-500/10'
  },
  { 
    id: 'upgrade', 
    label: 'ترقية البطاقة', 
    icon: TrendingUp, 
    mainTab: 'cards' as MainTabId, 
    subTab: 'upgrade' as SubTabId,
    color: 'text-blue-500 bg-blue-500/10'
  },
];

export default function QuickActionsBar({ onNavigate }: QuickActionsBarProps) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
      {quickActions.map((action) => {
        const Icon = action.icon;
        
        return (
          <button
            key={action.id}
            onClick={() => onNavigate(action.mainTab, action.subTab)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-card hover:shadow-sm transition-all min-w-fit ${action.color}`}
          >
            <Icon className="h-4 w-4" />
            <span className="text-xs font-medium whitespace-nowrap">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
