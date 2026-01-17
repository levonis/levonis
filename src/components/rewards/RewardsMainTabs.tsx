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
  amber: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  purple: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
  blue: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  green: 'bg-green-500/15 text-green-600 border-green-500/30',
};

const activeColorClasses = {
  amber: 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/30',
  purple: 'bg-purple-500 text-white border-purple-500 shadow-lg shadow-purple-500/30',
  blue: 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/30',
  green: 'bg-green-500 text-white border-green-500 shadow-lg shadow-green-500/30',
};

export default function RewardsMainTabs({ activeTab, onTabChange }: RewardsMainTabsProps) {
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
              "flex flex-col items-center gap-1 py-2 px-1.5 rounded-lg border transition-all duration-200",
              isActive 
                ? activeColorClasses[tab.color as keyof typeof activeColorClasses]
                : colorClasses[tab.color as keyof typeof colorClasses] + " hover:opacity-90"
            )}
          >
            <Icon className={cn("h-5 w-5", !isActive && "opacity-80")} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-semibold leading-tight">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
