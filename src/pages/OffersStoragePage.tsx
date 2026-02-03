import { useState, lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Gift, Package, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Footer from "@/components/Footer";

// Lazy load panels
const AllOffersPanel = lazy(() => import("@/components/rewards/panels/AllOffersPanel"));
const AllStoragePanel = lazy(() => import("@/components/rewards/panels/AllStoragePanel"));

type TabId = 'offers' | 'storage';

export default function OffersStoragePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('offers');

  const tabs = [
    { 
      id: 'offers' as const, 
      label: 'عروض مع هدايا', 
      icon: Gift, 
      color: 'from-rose-500 to-pink-600',
      activeColor: 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/30',
      inactiveColor: 'bg-rose-500/10 text-rose-600 border-rose-500/30'
    },
    { 
      id: 'storage' as const, 
      label: 'مخزني', 
      icon: Package, 
      color: 'from-blue-500 to-cyan-600',
      activeColor: 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg shadow-blue-500/30',
      inactiveColor: 'bg-blue-500/10 text-blue-600 border-blue-500/30'
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600">
              <Gift className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">عروض حصرية ومخزني</h1>
              <p className="text-[10px] text-muted-foreground">منتجات مع تذاكر مجانية</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>

        {/* Tab Switcher */}
        <div className="px-4 pb-3 flex gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border font-semibold text-sm transition-all ${
                  isActive ? tab.activeColor : tab.inactiveColor
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 px-4 py-4">
        <Suspense fallback={
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }>
          {activeTab === 'offers' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                اشترِ منتجات واحصل على تذاكر مجانية للمسابقات
              </p>
              <AllOffersPanel />
            </div>
          )}
          
          {activeTab === 'storage' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                منتجاتك وجوائزك المخزنة في انتظار طلب الشحن
              </p>
              <AllStoragePanel />
            </div>
          )}
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
