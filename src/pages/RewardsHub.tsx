import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Sparkles } from "lucide-react";

import RewardsMainTabs, { MainTabId } from "@/components/rewards/RewardsMainTabs";
import RewardsSubTabs, { SubTabId, subTabsConfig } from "@/components/rewards/RewardsSubTabs";
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
      {/* Sticky Header + Tabs */}
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b shadow-sm">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-gradient-to-br from-primary to-accent">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold">مركز المكافآت</h1>
                <p className="text-xs text-muted-foreground">نقاط • مسابقات • بطاقات • تأمين</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>

          {/* Main Tabs */}
          <div className="pb-3">
            <RewardsMainTabs 
              activeTab={activeMainTab} 
              onTabChange={handleMainTabChange} 
            />
          </div>

          {/* Sub Tabs */}
          <div className="pb-3">
            <RewardsSubTabs
              mainTab={activeMainTab}
              activeSubTab={activeSubTabs[activeMainTab]}
              onSubTabChange={handleSubTabChange}
            />
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-4">
        {/* Quick Actions Row */}
        <div className="mb-4">
          <QuickActionsBar onNavigate={handleQuickAction} />
        </div>

        {/* Content Area */}
        <div className="pb-6">
          {renderContent()}
        </div>

        {/* Not logged in prompt */}
        {!user && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6 text-center">
              <Sparkles className="h-12 w-12 mx-auto text-primary mb-4" />
              <h3 className="font-bold text-lg mb-2">سجّل دخولك للاستفادة من المكافآت</h3>
              <p className="text-sm text-muted-foreground mb-4">
                اكسب النقاط، شارك في المسابقات، واستمتع بمزايا العضوية
              </p>
              <Button onClick={() => navigate('/auth')} className="gap-2">
                تسجيل الدخول
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <Footer />
    </div>
  );
}
