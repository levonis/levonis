import { useState, lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Gift, Package, Loader2, Sparkles } from "lucide-react";
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
      {/* Premium Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-b from-card to-card/95 backdrop-blur-xl border-b border-border/30 shadow-sm">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary via-accent to-primary flex items-center justify-center shadow-lg shadow-primary/25">
                <Gift className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                <Sparkles className="h-2.5 w-2.5 text-accent-foreground" />
              </div>
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">عروض حصرية</h1>
              <p className="text-[10px] text-muted-foreground">منتجات مميزة مع هدايا</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 rounded-xl hover:bg-muted/80"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>

        {/* Premium Tab Switcher */}
        <div className="px-4 pb-4">
          <div className="flex p-1 bg-muted/50 rounded-2xl">
            <button
              onClick={() => setActiveTab('offers')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all duration-300 ${
                activeTab === 'offers'
                  ? 'bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Gift className="h-4 w-4" />
              العروض
            </button>
            <button
              onClick={() => setActiveTab('storage')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all duration-300 relative ${
                activeTab === 'storage'
                  ? 'bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Package className="h-4 w-4" />
              مخزني
              {user && storageCount !== undefined && storageCount > 0 && (
                <span className={`absolute -top-1 -left-1 min-w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 ${
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

      {/* Content */}
      <main className="flex-1 px-4 py-5">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">جاري التحميل...</p>
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
