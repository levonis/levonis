import { useState, lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

  // Fetch storage count for badge
  const { data: storageCount } = useQuery({
    queryKey: ['user-storage-count-page', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const [offerRes, prizeRes] = await Promise.all([
        supabase
          .from('product_offer_purchases')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .in('purchase_status', ['pending', 'purchased', 'shipping_requested', 'shipped']),
        supabase
          .from('competition_prizes')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('prize_type', 'physical')
          .in('status', ['pending', 'shipping_requested', 'shipped'])
      ]);
      return (offerRes.count || 0) + (prizeRes.count || 0);
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Sticky Navigation Bar - Fixed below main header */}
      <div 
        className="sticky top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/40 shadow-sm"
      >
        {/* Compact Navigation Bar */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary via-primary/80 to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                <Gift className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground">العروض والمخزن</h1>
              <p className="text-[10px] text-muted-foreground">منتجات حصرية</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-xl hover:bg-muted/80"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Compact Tab Switcher */}
        <div className="px-3 pb-2.5">
          <div className="flex gap-2 p-1 bg-muted/40 rounded-xl">
            <button
              onClick={() => setActiveTab('offers')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-semibold text-xs transition-all duration-200 ${
                activeTab === 'offers'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Gift className="h-3.5 w-3.5" />
              العروض
            </button>
            <button
              onClick={() => setActiveTab('storage')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-semibold text-xs transition-all duration-200 relative ${
                activeTab === 'storage'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              مخزني
              {user && storageCount !== undefined && storageCount > 0 && (
                <span className={`absolute -top-1 -left-1 min-w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold px-1 ${
                  activeTab === 'storage' 
                    ? 'bg-primary-foreground text-primary' 
                    : 'bg-primary text-primary-foreground'
                }`}>
                  {storageCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content - with padding for fixed header */}
      <main className="flex-1 px-4 py-5">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">جاري التحميل...</p>
          </div>
        }>
          {activeTab === 'offers' && <AllOffersPanel />}
          {activeTab === 'storage' && <AllStoragePanel />}
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
