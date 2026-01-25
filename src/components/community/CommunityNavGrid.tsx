import { memo, useMemo, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CommunityCustomerProfileModal from "@/components/community/CommunityCustomerProfileModal";
import MerchantSignupDialog from "@/components/community/MerchantSignupDialog";
import {
  Package,
  Users,
  ClipboardList,
  Store,
  MessageCircle,
  User,
  PlusCircle,
  ShoppingBag,
  Settings,
  Sparkles,
  Search,
  Home,
  Star,
} from "lucide-react";
import { ADMIN_ROUTES } from "@/config/adminConfig";

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

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost" | "secondary";
  highlight?: boolean;
  disabled?: boolean;
  badge?: string;
  category: "explore" | "actions" | "personal" | "admin";
}

const CommunityNavGrid = memo(({ className }: { className?: string }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin } = useAuth();
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

  const navItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      // ===== Explore Section =====
      {
        id: "products",
        label: "المنتجات",
        icon: <Package className="h-5 w-5" />,
        onClick: () => navigate("/community?tab=products"),
        category: "explore",
        variant: "outline",
      },
      {
        id: "merchants",
        label: "التجار",
        icon: <Store className="h-5 w-5" />,
        onClick: () => navigate("/community?tab=merchants"),
        category: "explore",
        variant: "outline",
      },
      {
        id: "requests",
        label: "الطلبات",
        icon: <ClipboardList className="h-5 w-5" />,
        onClick: () => navigate("/community?tab=requests"),
        category: "explore",
        variant: "outline",
      },
      {
        id: "search",
        label: "بحث متقدم",
        icon: <Search className="h-5 w-5" />,
        onClick: () => {
          const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
          searchInput?.focus();
        },
        category: "explore",
        variant: "ghost",
      },

      // ===== Actions Section =====
      {
        id: "new-action",
        label: isMerchant ? "إضافة منتج" : "طلب جديد",
        icon: isMerchant ? <Sparkles className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />,
        onClick: handleNewClick,
        disabled: !complete,
        highlight: true,
        category: "actions",
        variant: "default",
      },
      {
        id: "my-list",
        label: isMerchant ? "طلبات الزبائن" : "طلباتي",
        icon: <ShoppingBag className="h-5 w-5" />,
        onClick: handleRequestsClick,
        disabled: !complete,
        category: "actions",
        variant: "outline",
      },
      {
        id: "messages",
        label: "المحادثات",
        icon: <MessageCircle className="h-5 w-5" />,
        onClick: () => navigate("/community/messages"),
        disabled: !complete,
        category: "actions",
        variant: "outline",
      },

      // ===== Personal Section =====
      {
        id: "profile",
        label: complete ? "ملفي الشخصي" : "إكمال الملف",
        icon: <User className="h-5 w-5" />,
        onClick: () => (complete ? navigate("/profile") : setProfileOpen(true)),
        highlight: !complete,
        category: "personal",
        variant: complete ? "outline" : "default",
      },
      {
        id: "home",
        label: "الرئيسية",
        icon: <Home className="h-5 w-5" />,
        onClick: () => navigate("/"),
        category: "personal",
        variant: "ghost",
      },
    ];

    // ===== Merchant-specific items =====
    if (isMerchant) {
      items.push({
        id: "my-store",
        label: "متجري",
        icon: <Store className="h-5 w-5" />,
        onClick: () => navigate("/community/merchant/store"),
        category: "actions",
        variant: "secondary",
        badge: "تاجر",
      });
    }

    // ===== Admin Section =====
    if (isAdmin) {
      items.push({
        id: "admin",
        label: "لوحة التحكم",
        icon: <Settings className="h-5 w-5" />,
        onClick: () => navigate(ADMIN_ROUTES.dashboard),
        category: "admin",
        variant: "outline",
      });
      items.push({
        id: "admin-merchants",
        label: "إدارة التجار",
        icon: <Users className="h-5 w-5" />,
        onClick: () => navigate(ADMIN_ROUTES.communityMerchants),
        category: "admin",
        variant: "ghost",
      });
    }

    return items;
  }, [isMerchant, isAdmin, complete, navigate, handleNewClick, handleRequestsClick]);

  const exploreItems = navItems.filter((item) => item.category === "explore");
  const actionItems = navItems.filter((item) => item.category === "actions");
  const personalItems = navItems.filter((item) => item.category === "personal");
  const adminItems = navItems.filter((item) => item.category === "admin");

  if (!user) return null;

  if (isLoading) {
    return (
      <div className={className}>
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
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

  const renderNavItem = (item: NavItem, size: "sm" | "lg" = "sm") => {
    const isLarge = size === "lg";
    return (
      <Button
        key={item.id}
        variant={item.highlight ? "default" : item.variant || "outline"}
        disabled={item.disabled}
        onClick={item.onClick}
        className={`
          relative flex flex-col items-center justify-center gap-1.5 transition-all duration-200
          ${isLarge ? "h-20 rounded-2xl" : "h-14 rounded-xl"}
          ${item.highlight ? "bg-gradient-to-br from-primary via-primary to-accent text-primary-foreground shadow-lg shadow-primary/20" : ""}
          ${item.variant === "ghost" ? "bg-muted/30 hover:bg-muted/50 border-0" : ""}
          ${item.variant === "secondary" ? "bg-secondary/80 text-secondary-foreground border-secondary/50" : ""}
          ${!item.highlight && item.variant === "outline" ? "border-border/60 hover:border-primary/40 hover:bg-primary/5" : ""}
        `}
      >
        {item.badge && (
          <span className="absolute -top-1.5 -left-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-accent text-accent-foreground rounded-full">
            {item.badge}
          </span>
        )}
        <span className={item.highlight ? "" : "text-muted-foreground group-hover:text-foreground"}>
          {item.icon}
        </span>
        <span className={`text-[11px] font-medium ${isLarge ? "text-xs" : ""}`}>{item.label}</span>
      </Button>
    );
  };

  return (
    <div className={className}>
      {/* Main Navigation Container */}
      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-card/80 shadow-sm overflow-hidden">
        
        {/* Explore Section - Full Width Grid */}
        <div className="p-3 border-b border-border/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <Search className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground">استكشاف</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {exploreItems.map((item) => renderNavItem(item, "lg"))}
          </div>
        </div>

        {/* Actions Section */}
        <div className="p-3 border-b border-border/30 bg-muted/5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded-lg bg-accent/20 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground">إجراءات سريعة</span>
            {!complete && (
              <span className="mr-auto text-[10px] text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                أكمل ملفك أولاً
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {actionItems.map((item) => renderNavItem(item))}
          </div>
        </div>

        {/* Personal & Admin Section */}
        <div className="p-3 bg-muted/10">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded-lg bg-muted/50 flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground">حسابك</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {personalItems.map((item) => renderNavItem(item))}
            {adminItems.map((item) => renderNavItem(item))}
          </div>
        </div>
      </div>

      {/* Profile Dialog */}
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
});

CommunityNavGrid.displayName = "CommunityNavGrid";

export default CommunityNavGrid;
