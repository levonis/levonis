import { cn } from "@/lib/utils";
import { Coins, Trophy, CreditCard, Shield } from "lucide-react";

export type MainTabId = 'points' | 'competitions' | 'cards' | 'insurance';

interface RewardsMainTabsProps {
  activeTab: MainTabId;
  onTabChange: (tab: MainTabId) => void;
}

const mainTabs = [
  { id: 'points' as const, label: 'النقاط', icon: Coins, color: 'amber' },
  { id: 'competitions' as const, label: 'المسابقات', icon: Trophy, color: 'purple' },
  { id: 'cards' as const, label: 'البطاقات', icon: CreditCard, color: 'blue' },
  { id: 'insurance' as const, label: 'التأمين', icon: Shield, color: 'green' },
];

const colorClasses = {
  amber: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  purple: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  blue: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  green: 'bg-green-500/10 text-green-600 border-green-500/30',
};

const activeColorClasses = {
  amber: 'bg-amber-500 text-white border-amber-500',
  purple: 'bg-purple-500 text-white border-purple-500',
  blue: 'bg-blue-500 text-white border-blue-500',
  green: 'bg-green-500 text-white border-green-500',
};

export default function RewardsMainTabs({ activeTab, onTabChange }: RewardsMainTabsProps) {
  return (
    <div className="flex gap-1 p-1 bg-muted/50 rounded-xl overflow-x-auto scrollbar-hide">
      {mainTabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex-1 min-w-[70px] flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-all duration-200",
              isActive 
                ? activeColorClasses[tab.color as keyof typeof activeColorClasses]
                : colorClasses[tab.color as keyof typeof colorClasses] + " hover:opacity-80"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="text-[10px] font-medium whitespace-nowrap">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
