import { Suspense, lazy, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Users, MessageCircle, Store, Package, FileText, Search, UserCircle, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCommunityProfileCheck } from '@/hooks/useCommunityProfileCheck';
import CommunityExploreStrip from '@/components/community/CommunityExploreStrip';
import MerchantStoriesBar from '@/components/community/stories/MerchantStoriesBar';
import AnimatedDivider from '@/components/ui/animated-divider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CommunityCustomerProfileModal from '@/components/community/CommunityCustomerProfileModal';
import MerchantSignupDialog from '@/components/community/MerchantSignupDialog';
import NewPrintRequestDialog from '@/components/community/NewPrintRequestDialog';
import { ListingConversations } from '@/components/marketplace/ListingConversations';

const MerchantDashboardWidgets = lazy(() => import('@/components/merchant/MerchantDashboardWidgets'));

interface CommunitySectionProps {
  noFrame?: boolean;
}

export default function CommunitySection({ noFrame = false }: CommunitySectionProps) {
  const { user } = useAuth();
  const { isProfileComplete } = useCommunityProfileCheck();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isCommunityHub = location.pathname === "/community";
  
  // Profile completion dialog state
  const [profileOpen, setProfileOpen] = useState(false);
  const [merchantOpen, setMerchantOpen] = useState(false);
  
  // Search state
  const searchFromUrl = searchParams.get("q") || "";
  const [searchQuery, setSearchQuery] = useState(searchFromUrl);
  
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (isCommunityHub) {
      const next = new URLSearchParams(searchParams);
      if (value.trim()) next.set("q", value);
      else next.delete("q");
      setSearchParams(next, { replace: true });
    }
  };

  const { data: merchantApp } = useQuery({
    queryKey: ["merchant-status", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("merchant_applications")
        .select("id, status")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const isMerchant = useMemo(() => !!merchantApp, [merchantApp]);

  const sectionClass = noFrame 
    ? "container mx-auto px-0" 
    : "levo-section-frame container mx-auto px-0";

  // Quick action buttons for merchants and customers - only show if profile is complete
  // Dialog state for new request and messages
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  
  const quickActions = useMemo(() => {
    if (isMerchant) {
      return [
        { key: "messages", label: "المحادثات", icon: MessageCircle, action: () => setMessagesOpen(true) },
        { key: "store", label: "إدارة المتجر", icon: Store, to: "/community/merchant/store" },
        { key: "orders", label: "الطلبات", icon: Package, to: "/community/merchant/orders" },
        { key: "requests", label: "طلبات الزبائن", icon: FileText, to: "/community/requests" },
      ];
    }
    return [
      { key: "messages", label: "المحادثات", icon: MessageCircle, action: () => setMessagesOpen(true) },
      { key: "new-request", label: "طلب جديد", icon: FileText, action: () => setNewRequestOpen(true) },
      { key: "my-requests", label: "طلباتي", icon: Package, to: "/community/customer/requests" },
      { key: "profile", label: "ملفي", icon: Users, to: "/profile" },
    ];
  }, [isMerchant]);

  return (
    <section className={sectionClass}>
      {/* Community Badge - Homepage only */}
      {!isCommunityHub && (
        <Link
          to="/community"
          className="group relative flex items-center justify-center mb-5 py-5 rounded-2xl overflow-hidden border border-primary/20 bg-gradient-to-r from-primary/5 via-card to-accent/5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all duration-500"
        >
          {/* Animated background glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
          
          <div className="relative flex items-center gap-3">
            {/* Logo mark */}
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-shadow">
              <span className="text-primary-foreground font-black text-sm tracking-tighter">L</span>
            </div>
            <div className="flex flex-col">
              <h2 className="text-sm font-black text-foreground group-hover:text-primary transition-colors tracking-tight leading-tight">
                مجتمع ليفونيس
              </h2>
              <p className="text-[9px] text-muted-foreground font-medium">
                تجار • منتجات • طباعة ثلاثية الأبعاد
              </p>
            </div>
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors mr-1">
              <Sparkles className="h-3 w-3 text-primary" />
            </div>
          </div>
        </Link>
      )}

      {/* Merchant Stories Bar */}
      {isCommunityHub && (
        <div className="mb-3">
          <MerchantStoriesBar />
        </div>
      )}

      {/* Search Bar - only on /community hub */}
      {isCommunityHub && (
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="ابحث في المنتجات، الطلبات، التجار..."
              className="levo-input-frame pr-10 h-10 text-sm"
            />
          </div>
        </div>
      )}

      {/* Quick Actions for Homepage - Show for logged in users */}
      {!isCommunityHub && user && (
        <div className="mb-4">
          {isProfileComplete ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.key}
                    variant="outline"
                    className="h-10 gap-2 text-xs font-semibold"
                    onClick={() => {
                      if ('action' in action && action.action) {
                        action.action();
                      } else if ('to' in action && action.to) {
                        navigate(action.to);
                      }
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    {action.label}
                  </Button>
                );
              })}
            </div>
          ) : (
            <Button
              onClick={() => setProfileOpen(true)}
              className="w-full h-12 gap-3 bg-gradient-to-r from-primary via-accent to-primary text-primary-foreground font-bold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01]"
            >
              <div className="flex items-center gap-2">
                <UserCircle className="h-5 w-5" />
                <span>أكمل ملفك الشخصي للوصول لمجتمع ليفو</span>
                <Sparkles className="h-4 w-4" />
              </div>
            </Button>
          )}
        </div>
      )}

      {/* Quick Actions for Community Hub - Customer Only (NOT merchant) */}
      {isCommunityHub && user && isProfileComplete && !isMerchant && (
        <div className="mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.key}
                  onClick={() => {
                    if ('action' in action && action.action) {
                      action.action();
                    } else if ('to' in action && action.to) {
                      navigate(action.to);
                    }
                  }}
                  className="group relative flex items-center gap-2.5 h-12 px-4 rounded-xl border border-primary/20 bg-gradient-to-b from-card to-background hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Profile Completion Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
          <CommunityCustomerProfileModal
            onDone={() => setProfileOpen(false)}
            onLater={() => setProfileOpen(false)}
            onOpenMerchantSignup={() => {
              setProfileOpen(false);
              setMerchantOpen(true);
            }}
          />
        </DialogContent>
      </Dialog>

      <MerchantSignupDialog open={merchantOpen} onOpenChange={setMerchantOpen} />

      {/* New Print Request Dialog */}
      <NewPrintRequestDialog open={newRequestOpen} onOpenChange={setNewRequestOpen} />

      {/* Merchant Dashboard Widgets - Show on /community hub only */}
      {isCommunityHub && isMerchant && user?.id && (
        <>
          <Suspense fallback={<div className="h-40 animate-pulse bg-muted/30 rounded-xl" />}>
            <MerchantDashboardWidgets merchantId={user.id} />
          </Suspense>
          <AnimatedDivider className="mt-5 mb-3 opacity-80" />
        </>
      )}

      {/* Explore tabs */}
      <div className={isCommunityHub && isMerchant ? "mt-4" : "mt-4"}>
        <CommunityExploreStrip searchQuery={searchQuery} />
      </div>

      {/* Messages Overlay Dialog */}
      <ListingConversations
        externalOpen={messagesOpen}
        onExternalOpenChange={setMessagesOpen}
        onClose={() => setMessagesOpen(false)}
      >
        <span className="sr-only">فتح المحادثات</span>
      </ListingConversations>
    </section>
  );
}
