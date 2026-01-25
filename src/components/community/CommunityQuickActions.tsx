import { memo, useMemo, useState, useCallback, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CommunityCustomerProfileModal from "@/components/community/CommunityCustomerProfileModal";
import MerchantSignupDialog from "@/components/community/MerchantSignupDialog";
import {
  MessageSquare,
  Store,
  PlusCircle,
  ClipboardList,
  User,
  ShoppingBag,
  Boxes,
  Star,
  TrendingUp,
  Search,
  Bell,
  Settings,
  HelpCircle,
  Sparkles,
} from "lucide-react";

const ListingConversations = lazy(() => import("@/components/marketplace/ListingConversations"));

const profileSchema = z.object({
  full_name: z.string().nullable().optional(),
  phone_number: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  birth_date: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
});

type Profile = z.infer<typeof profileSchema>;

function isProfileComplete(p: Profile | null | undefined) {
  if (!p) return false;
  const fullNameOk = !!p.full_name?.trim();
  const phoneOk = !!p.phone_number?.trim();
  const usernameOk = !!p.username?.trim();
  const birthDateOk = !!p.birth_date;
  const genderOk = p.gender === "male" || p.gender === "female";
  return fullNameOk && phoneOk && usernameOk && birthDateOk && genderOk;
}

type ActionItem = {
  id: string;
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  onClick: () => void;
  variant: "primary" | "secondary" | "accent" | "muted";
  badge?: string;
  disabled?: boolean;
  requiresAuth?: boolean;
  isMerchantOnly?: boolean;
  isCustomerOnly?: boolean;
};

function CommunityQuickActionsBase({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [merchantOpen, setMerchantOpen] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["community-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone_number, username, avatar_url, birth_date, gender")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return profileSchema.parse(data);
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const complete = useMemo(() => isProfileComplete(profile), [profile]);

  const { data: merchantApp, isLoading: merchantLoading } = useQuery({
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
  const isLoading = profileLoading || merchantLoading;

  // Action handlers
  const handleNewClick = useCallback(() => {
    if (isMerchant) {
      navigate("/community/merchant/store");
    } else {
      navigate("/community/customer/new");
    }
  }, [isMerchant, navigate]);

  const handleRequestsClick = useCallback(() => {
    if (isMerchant) {
      navigate("/community/merchant/orders");
    } else {
      navigate("/community/customer/requests");
    }
  }, [isMerchant, navigate]);

  const handleProfileClick = useCallback(() => {
    if (complete) {
      navigate("/profile");
    } else {
      setProfileOpen(true);
    }
  }, [complete, navigate]);

  // Build actions list
  const actions: ActionItem[] = useMemo(() => {
    const baseActions: ActionItem[] = [
      // Primary actions row
      {
        id: "new",
        icon: isMerchant ? Store : PlusCircle,
        label: isMerchant ? "المتجر" : "طلب جديد",
        sublabel: isMerchant ? "إدارة المنتجات" : "إضافة طلب طباعة",
        onClick: handleNewClick,
        variant: "primary",
        disabled: !complete,
        requiresAuth: true,
      },
      {
        id: "requests",
        icon: ClipboardList,
        label: isMerchant ? "طلبات الزبائن" : "طلباتي",
        sublabel: isMerchant ? "عروض الأسعار" : "متابعة الطلبات",
        onClick: handleRequestsClick,
        variant: "secondary",
        disabled: !complete,
        requiresAuth: true,
      },
      {
        id: "profile",
        icon: User,
        label: complete ? "الملف الشخصي" : "إكمال الملف",
        sublabel: complete ? "عرض وتعديل" : "مطلوب للتفعيل",
        onClick: handleProfileClick,
        variant: complete ? "secondary" : "accent",
        badge: !complete ? "مطلوب" : undefined,
        requiresAuth: true,
      },
    ];

    // Secondary actions
    const secondaryActions: ActionItem[] = [
      {
        id: "products",
        icon: ShoppingBag,
        label: "المنتجات",
        sublabel: "تصفح منتجات التجار",
        onClick: () => navigate("/community?tab=products"),
        variant: "muted",
      },
      {
        id: "merchants",
        icon: Boxes,
        label: "التجار",
        sublabel: "اكتشف المتاجر",
        onClick: () => navigate("/community?tab=merchants"),
        variant: "muted",
      },
      {
        id: "trending",
        icon: TrendingUp,
        label: "الأكثر طلباً",
        sublabel: "الطلبات الشائعة",
        onClick: () => navigate("/community?tab=requests"),
        variant: "muted",
      },
    ];

    // Utility actions
    const utilityActions: ActionItem[] = [
      {
        id: "search",
        icon: Search,
        label: "البحث",
        onClick: () => navigate("/community"),
        variant: "muted",
      },
      {
        id: "notifications",
        icon: Bell,
        label: "الإشعارات",
        onClick: () => navigate("/notifications"),
        variant: "muted",
        requiresAuth: true,
      },
      {
        id: "help",
        icon: HelpCircle,
        label: "المساعدة",
        onClick: () => {},
        variant: "muted",
      },
    ];

    return [...baseActions, ...secondaryActions, ...utilityActions];
  }, [isMerchant, complete, handleNewClick, handleRequestsClick, handleProfileClick, navigate]);

  // Filter actions based on auth and role
  const visibleActions = useMemo(() => {
    return actions.filter((action) => {
      if (action.requiresAuth && !user) return false;
      if (action.isMerchantOnly && !isMerchant) return false;
      if (action.isCustomerOnly && isMerchant) return false;
      return true;
    });
  }, [actions, user, isMerchant]);

  const primaryActions = visibleActions.filter((a) => a.variant === "primary" || a.variant === "accent");
  const secondaryActions = visibleActions.filter((a) => a.variant === "secondary");
  const mutedActions = visibleActions.filter((a) => a.variant === "muted");

  if (!user) {
    return (
      <div className={className}>
        <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-card/80 p-5">
          <div className="text-center space-y-3">
            <div className="h-12 w-12 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">مرحباً بك في مجتمع ليفو</h3>
              <p className="text-sm text-muted-foreground mt-1">سجل دخولك للوصول لجميع المميزات</p>
            </div>
            <button
              onClick={() => navigate("/auth")}
              className="w-full h-11 rounded-xl bg-gradient-to-b from-primary to-accent text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              تسجيل الدخول
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={className}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Primary actions - large icon cards */}
        <div className="grid grid-cols-3 gap-3">
          {/* Messages special card with lazy loading */}
          <Suspense fallback={<Skeleton className="h-24 rounded-2xl" />}>
            <ListingConversations>
              <button
                className="group relative h-24 w-full rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/10 to-primary/5 p-3 text-right transition-all duration-200 hover:border-primary/50 hover:shadow-md hover:shadow-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <div className="absolute top-3 left-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="absolute bottom-3 right-3 left-3">
                  <p className="text-sm font-bold text-foreground">المحادثات</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">التواصل المباشر</p>
                </div>
              </button>
            </ListingConversations>
          </Suspense>

          {/* Primary action cards */}
          {primaryActions.slice(0, 2).map((action) => (
            <button
              key={action.id}
              onClick={action.onClick}
              disabled={action.disabled}
              className={`group relative h-24 w-full rounded-2xl border p-3 text-right transition-all duration-200 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                action.variant === "primary"
                  ? "border-primary/30 bg-gradient-to-b from-primary/10 to-primary/5 hover:border-primary/50 hover:shadow-md hover:shadow-primary/10 focus:ring-primary/30"
                  : action.variant === "accent"
                  ? "border-accent/40 bg-gradient-to-b from-accent/15 to-accent/5 hover:border-accent/60 hover:shadow-md hover:shadow-accent/10 focus:ring-accent/30"
                  : "border-border/50 bg-gradient-to-b from-card to-card/80 hover:border-border hover:shadow-sm focus:ring-border/50"
              }`}
            >
              {action.badge && (
                <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-accent text-accent-foreground text-[9px] font-bold">
                  {action.badge}
                </span>
              )}
              <div className="absolute top-3 left-3">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${
                    action.variant === "primary"
                      ? "bg-primary/15"
                      : action.variant === "accent"
                      ? "bg-accent/20"
                      : "bg-muted/30"
                  }`}
                >
                  <action.icon
                    className={`h-5 w-5 ${
                      action.variant === "primary"
                        ? "text-primary"
                        : action.variant === "accent"
                        ? "text-accent-foreground"
                        : "text-foreground"
                    }`}
                  />
                </div>
              </div>
              <div className="absolute bottom-3 right-3 left-3">
                <p className="text-sm font-bold text-foreground">{action.label}</p>
                {action.sublabel && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{action.sublabel}</p>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Secondary actions - medium cards */}
        <div className="grid grid-cols-3 gap-2">
          {secondaryActions.map((action) => (
            <button
              key={action.id}
              onClick={action.onClick}
              disabled={action.disabled}
              className="group h-20 w-full rounded-xl border border-border/40 bg-gradient-to-b from-muted/20 to-muted/5 p-2.5 text-right transition-all duration-200 hover:border-border/60 hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-border/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="h-8 w-8 rounded-lg bg-background/80 border border-border/30 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                <action.icon className="h-4 w-4 text-foreground/70" />
              </div>
              <p className="text-xs font-semibold text-foreground line-clamp-1">{action.label}</p>
              {action.sublabel && (
                <p className="text-[9px] text-muted-foreground line-clamp-1">{action.sublabel}</p>
              )}
            </button>
          ))}
        </div>

        {/* Browse actions - compact row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {mutedActions.slice(0, 3).map((action) => (
            <button
              key={action.id}
              onClick={action.onClick}
              disabled={action.disabled}
              className="group shrink-0 flex items-center gap-2 h-10 px-3.5 rounded-xl border border-border/30 bg-background/50 hover:border-border/50 hover:bg-muted/20 transition-all focus:outline-none focus:ring-2 focus:ring-border/40 disabled:opacity-50"
            >
              <div className="h-6 w-6 rounded-lg bg-muted/30 flex items-center justify-center group-hover:bg-muted/50 transition-colors">
                <action.icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <span className="text-xs font-medium text-foreground">{action.label}</span>
            </button>
          ))}
        </div>

        {/* Utility row - icon only */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {mutedActions.slice(3).map((action) => (
            <button
              key={action.id}
              onClick={action.onClick}
              disabled={action.disabled}
              className="h-9 w-9 rounded-xl border border-border/20 bg-background/30 flex items-center justify-center hover:border-border/40 hover:bg-muted/20 transition-all focus:outline-none focus:ring-2 focus:ring-border/30 disabled:opacity-50"
              title={action.label}
            >
              <action.icon className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>

      {/* Profile completion dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>الملف الشخصي</DialogTitle>
          </DialogHeader>
          <div className="scrollbar-stable max-h-[70vh] overflow-y-auto overflow-x-hidden">
            <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
              <CommunityCustomerProfileModal
                onDone={() => setProfileOpen(false)}
                onOpenMerchantSignup={() => {
                  setProfileOpen(false);
                  setMerchantOpen(true);
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MerchantSignupDialog open={merchantOpen} onOpenChange={setMerchantOpen} />
    </div>
  );
}

const CommunityQuickActions = memo(CommunityQuickActionsBase);
export default CommunityQuickActions;
