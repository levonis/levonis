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
      {/* Premium Sticky Header with Tabs - Always Visible */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30">
        {/* Top Navigation Bar */}
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-accent flex items-center justify-center shadow-xl shadow-primary/25">
                <Gift className="h-6 w-6 text-primary-foreground" />
              </div>
              <Sparkles className="h-4 w-4 text-amber-500 absolute -top-1 -right-1" />
            </div>
            <div>
              <h1 className="text-lg font-black text-foreground tracking-tight">العروض والمخزن</h1>
              <p className="text-xs text-muted-foreground">منتجات حصرية وهدايا مميزة</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-11 w-11 rounded-2xl hover:bg-muted/80 border border-border/50"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>

        {/* Premium Tab Switcher */}
        <div className="px-4 pb-4">
          <div className="flex gap-3 p-1.5 bg-muted/50 rounded-2xl border border-border/30">
            <button
              onClick={() => setActiveTab('offers')}
              className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 ${
                activeTab === 'offers'
                  ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Gift className="h-5 w-5" />
              العروض
            </button>
            <button
              onClick={() => setActiveTab('storage')}
              className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 relative ${
                activeTab === 'storage'
                  ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Package className="h-5 w-5" />
              مخزني
              {user && storageCount !== undefined && storageCount > 0 && (
                <span className={`absolute -top-1.5 -left-1.5 min-w-6 h-6 flex items-center justify-center rounded-full text-xs font-black px-2 shadow-md ${
                  activeTab === 'storage' 
                    ? 'bg-primary-foreground text-primary' 
                    : 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground'
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
