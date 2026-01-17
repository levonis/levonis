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
  amber: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  purple: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  blue: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  green: 'bg-green-500/10 text-green-600 border-green-500/20',
};

const activeColorClasses = {
  amber: 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/25',
  purple: 'bg-purple-500 text-white border-purple-500 shadow-md shadow-purple-500/25',
  blue: 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/25',
  green: 'bg-green-500 text-white border-green-500 shadow-md shadow-green-500/25',
};

export default function RewardsMainTabs({ activeTab, onTabChange }: RewardsMainTabsProps) {
  return (
    <div className="grid grid-cols-4 gap-1 p-0.5 bg-muted/40 rounded-lg">
      {mainTabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-md border transition-all duration-200",
              isActive 
                ? activeColorClasses[tab.color as keyof typeof activeColorClasses]
                : colorClasses[tab.color as keyof typeof colorClasses] + " hover:opacity-80"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="text-[9px] font-medium leading-tight">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
