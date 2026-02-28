import { Suspense, lazy, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Users, MessageCircle, Store, Package, FileText, Search, UserCircle, Sparkles, Gift } from 'lucide-react';
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
import { useLanguage } from '@/lib/i18n';

const MerchantDashboardWidgets = lazy(() => import('@/components/merchant/MerchantDashboardWidgets'));

interface CommunitySectionProps {
  noFrame?: boolean;
}

export default function CommunitySection({ noFrame = false }: CommunitySectionProps) {
  const { t } = useLanguage();
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

  // Check if user has any merchant application (any status)
  const { data: anyMerchantApp } = useQuery({
    queryKey: ["merchant-any-app", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("merchant_applications")
        .select("id, status, admin_notes, rejected_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
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
  
  
  const quickActions = useMemo(() => {
    if (isMerchant) {
      return [
        { key: "messages", label: t('community_messages'), icon: MessageCircle, to: "/chats" },
        { key: "store", label: t('community_manage_store'), icon: Store, to: "/community/merchant/store" },
        { key: "orders", label: t('community_orders'), icon: Package, to: "/community/merchant/orders" },
        { key: "requests", label: t('community_customer_requests'), icon: FileText, to: "/community/requests" },
      ];
    }
    return [
      { key: "messages", label: t('community_messages'), icon: MessageCircle, to: "/chats" },
      { key: "new-request", label: t('community_new_request'), icon: FileText, action: () => setNewRequestOpen(true) },
      { key: "my-requests", label: t('community_my_requests'), icon: Package, to: "/community/customer/requests" },
      { key: "profile", label: t('community_my_profile'), icon: Users, to: "/profile" },
    ];
  }, [isMerchant, t]);

  return (
    <section className={sectionClass}>
      {/* Community Badge - Homepage only */}
      {!isCommunityHub && (
        <Link
          to="/community"
          className="group relative flex items-center justify-center mb-5 py-4 rounded-2xl overflow-hidden border border-border/40 bg-card hover:border-primary/30 hover:shadow-md transition-all duration-300"
        >
          <div className="absolute inset-0 bg-gradient-to-l from-primary/[0.03] to-transparent" />
          <div className="relative">
            <h2 className="text-base font-black tracking-tight text-foreground group-hover:text-primary transition-colors">
              {t('community_levo')}
            </h2>
          </div>
        </Link>
      )}

      {/* Assistance Banner - Community Hub */}
      {isCommunityHub && user && (
        <div className="mb-4">
          <button
            onClick={() => navigate("/merchant-giveaways")}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-gradient-to-l from-primary/5 to-card hover:border-primary/40 hover:shadow-md transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Gift className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 text-right">
              <h3 className="text-sm font-black text-foreground">المساعدات</h3>
              <p className="text-[10px] text-muted-foreground">مسابقات، هدايا، كوبونات وظروف حمراء</p>
            </div>
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
          </button>
        </div>
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
              placeholder={t('community_search_placeholder')}
              className="levo-input-frame pr-10 h-10 text-sm"
            />
          </div>
        </div>
      )}

      {/* Quick Actions for Homepage - Show for logged in users */}
      {!isCommunityHub && user && (
        <div className="mb-4">
          {/* Approved merchant OR profile complete OR approved app: show quick actions */}
          {(isMerchant || isProfileComplete || anyMerchantApp?.status === "approved") ? (
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
          ) : anyMerchantApp?.status === "pending" ? (
            <Button
              onClick={() => setMerchantOpen(true)}
              variant="outline"
              className="w-full h-12 gap-3 font-bold text-sm rounded-xl border-primary/30"
            >
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                <span>{t('community_merchant_pending')}</span>
              </div>
            </Button>
          ) : anyMerchantApp?.status === "draft" ? (
            <Button
              onClick={() => setMerchantOpen(true)}
              variant="outline"
              className="w-full h-12 gap-3 font-bold text-sm rounded-xl border-primary/30"
            >
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                <span>{t('community_merchant_complete')}</span>
              </div>
            </Button>
          ) : anyMerchantApp?.status === "rejected" ? (
            <div className="space-y-2">
              <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/5 text-sm">
                <div className="flex items-center gap-2 font-bold text-destructive mb-1">
                   <Store className="h-4 w-4" />
                  <span>{t('community_merchant_rejected')}</span>
                </div>
                {anyMerchantApp.admin_notes && (
                   <p className="text-muted-foreground text-xs mt-1">
                    {t('community_merchant_reason')}: {anyMerchantApp.admin_notes}
                  </p>
                )}
              </div>
              <Button
                onClick={() => setProfileOpen(true)}
                className="w-full h-12 gap-3 bg-gradient-to-r from-primary via-accent to-primary text-primary-foreground font-bold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01]"
              >
                <div className="flex items-center gap-2">
                   <UserCircle className="h-5 w-5" />
                  <span>{t('community_complete_profile')}</span>
                  <Sparkles className="h-4 w-4" />
                </div>
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => setProfileOpen(true)}
              className="w-full h-12 gap-3 bg-gradient-to-r from-primary via-accent to-primary text-primary-foreground font-bold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01]"
            >
              <div className="flex items-center gap-2">
                 <UserCircle className="h-5 w-5" />
                <span>{t('community_complete_profile_access')}</span>
                <Sparkles className="h-4 w-4" />
              </div>
            </Button>
          )}
        </div>
      )}

      {/* Quick Actions for Community Hub - for users with complete profile or approved merchants */}
      {isCommunityHub && user && (isProfileComplete || isMerchant || anyMerchantApp?.status === "approved") && (
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
