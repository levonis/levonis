import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Sparkles, LogIn } from "lucide-react";

import RewardsMainTabs, { MainTabId } from "@/components/rewards/RewardsMainTabs";
import RewardsSubTabs, { SubTabId } from "@/components/rewards/RewardsSubTabs";
import QuickActionsBar from "@/components/rewards/QuickActionsBar";
import PointsSection from "@/components/rewards/PointsSection";
import CompetitionsSection from "@/components/rewards/CompetitionsSection";
import CardsSection from "@/components/rewards/CardsSection";
import InsuranceSection from "@/components/rewards/InsuranceSection";

export default function RewardsHub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [activeMainTab, setActiveMainTab] = useState<MainTabId>('points');
  const [activeSubTabs, setActiveSubTabs] = useState<Record<MainTabId, SubTabId>>({
    points: 'summary',
    competitions: 'competitions',
    cards: 'benefits',
    insurance: 'status',
  });

  const handleMainTabChange = (tab: MainTabId) => {
    setActiveMainTab(tab);
  };

  const handleSubTabChange = (subTab: SubTabId) => {
    setActiveSubTabs(prev => ({
      ...prev,
      [activeMainTab]: subTab,
    }));
  };

  const handleQuickAction = (mainTab: MainTabId, subTab: SubTabId) => {
    setActiveMainTab(mainTab);
    setActiveSubTabs(prev => ({
      ...prev,
      [mainTab]: subTab,
    }));
  };

  const renderContent = () => {
    const currentSubTab = activeSubTabs[activeMainTab];
    
    switch (activeMainTab) {
      case 'points':
        return <PointsSection activeSubTab={currentSubTab} />;
      case 'competitions':
        return <CompetitionsSection activeSubTab={currentSubTab} />;
      case 'cards':
        return <CardsSection activeSubTab={currentSubTab} />;
      case 'insurance':
        return <InsuranceSection activeSubTab={currentSubTab} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Compact Sticky Header + Tabs - Fixed, doesn't scroll */}
      <div className="sticky top-0 z-50 bg-card border-b shadow-sm">
        {/* Minimal Header */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-primary/80">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-sm font-bold text-foreground">مركز المكافآت</h1>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Main Tabs - Always Visible */}
        <div className="px-3 pb-2">
          <RewardsMainTabs 
            activeTab={activeMainTab} 
            onTabChange={handleMainTabChange} 
          />
        </div>

        {/* Sub Tabs - Inline Switch */}
        <div className="px-3 pb-2">
          <RewardsSubTabs
            mainTab={activeMainTab}
            activeSubTab={activeSubTabs[activeMainTab]}
            onSubTabChange={handleSubTabChange}
          />
        </div>
      </div>

      {/* Main Content Area - Scrollable independently */}
      <main className="flex-1 overflow-y-auto px-3 py-3">
        {/* Quick Actions Row - Horizontal Scroll */}
        <div className="mb-3">
          <QuickActionsBar onNavigate={handleQuickAction} />
        </div>

        {/* Inline Content Panel */}
        <div className="min-h-[50vh]">
          {renderContent()}
        </div>

        {/* Login Prompt - Only if not logged in */}
        {!user && (
          <Card className="mt-4 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <LogIn className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">سجّل دخولك للاستفادة الكاملة</p>
                <p className="text-xs text-muted-foreground">نقاط • مسابقات • مزايا حصرية</p>
              </div>
              <Button size="sm" onClick={() => navigate('/auth')}>
                دخول
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <Footer />
    </div>
  );
}
