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
  // Dialog state for new request
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  
  const quickActions = useMemo(() => {
    if (isMerchant) {
      return [
        { key: "messages", label: "المحادثات", icon: MessageCircle, to: "/community/messages" },
        { key: "store", label: "إدارة المتجر", icon: Store, to: "/community/merchant/store" },
        { key: "orders", label: "الطلبات", icon: Package, to: "/community/merchant/orders" },
        { key: "requests", label: "طلبات الزبائن", icon: FileText, to: "/community/requests" },
      ];
    }
    return [
      { key: "messages", label: "المحادثات", icon: MessageCircle, to: "/community/messages" },
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
          className="group flex items-center justify-between mb-5 px-4 py-3 rounded-2xl border border-primary/10 bg-gradient-to-l from-primary/5 via-transparent to-accent/5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary via-primary/80 to-accent flex items-center justify-center shadow-lg shadow-primary/25 group-hover:shadow-primary/40 transition-shadow">
                <Users className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-accent border-2 border-background animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-tight">
                مجتمع ليفو
              </h2>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                تصفّح المنتجات والخدمات
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">
            <span>استكشف</span>
            <Sparkles className="h-3.5 w-3.5" />
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
    </section>
  );
}
