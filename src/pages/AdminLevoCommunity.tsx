import { useState, Suspense, lazy, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Store, Users, MessageCircle, AlertTriangle, Award, ImageIcon, 
  TrendingUp, ShoppingBag, Clock, Loader2, Activity, BarChart3
} from "lucide-react";
import AdminLayout, { AdminSection } from "@/components/admin/AdminLayout";
import { ADMIN_ROUTES } from "@/config/adminConfig";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Lazy load the tab content components
const AdminCommunityMerchants = lazy(() => import("@/pages/AdminCommunityMerchants"));
const AdminCommunityCustomers = lazy(() => import("@/pages/AdminCommunityCustomers"));
const AdminCommunityComplaints = lazy(() => import("@/pages/AdminCommunityComplaints"));
const AdminCommunityMessages = lazy(() => import("@/pages/AdminCommunityMessages"));
const AdminBadgeSettings = lazy(() => import("@/pages/AdminBadgeSettings"));
const AdminAvatarFrames = lazy(() => import("@/pages/AdminAvatarFrames"));

interface TabConfig {
  value: string;
  icon: React.ElementType;
  label: string;
  colorClass: string;
  bgClass: string;
}

const tabs: TabConfig[] = [
  {
    value: "merchants",
    icon: Store,
    label: "التجار",
    colorClass: "text-emerald-500",
    bgClass: "bg-emerald-500/15",
  },
  {
    value: "customers",
    icon: Users,
    label: "العملاء",
    colorClass: "text-blue-500",
    bgClass: "bg-blue-500/15",
  },
  {
    value: "complaints",
    icon: AlertTriangle,
    label: "الشكاوى",
    colorClass: "text-amber-500",
    bgClass: "bg-amber-500/15",
  },
  {
    value: "messages",
    icon: MessageCircle,
    label: "المحادثات",
    colorClass: "text-purple-500",
    bgClass: "bg-purple-500/15",
  },
  {
    value: "badges",
    icon: Award,
    label: "الشارات",
    colorClass: "text-primary",
    bgClass: "bg-primary/15",
  },
  {
    value: "frames",
    icon: ImageIcon,
    label: "الإطارات",
    colorClass: "text-pink-500",
    bgClass: "bg-pink-500/15",
  },
];

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
      </div>
    </div>
  );
}

interface StatsCardProps {
  icon: React.ElementType;
  value: number;
  label: string;
  colorClass: string;
  bgClass: string;
}

function StatsCard({ icon: Icon, value, label, colorClass, bgClass }: StatsCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
      <div className={cn("p-2 rounded-lg", bgClass)}>
        <Icon className={cn("h-4 w-4", colorClass)} />
      </div>
      <div>
        <p className="text-lg font-bold text-foreground">{value.toLocaleString("ar-IQ")}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function AdminLevoCommunity() {
  const [activeTab, setActiveTab] = useState("merchants");

  // Fetch community stats
  const { data: stats } = useQuery({
    queryKey: ["admin-community-stats"],
    queryFn: async () => {
      const [merchantsRes, pendingMerchantsRes, profilesRes, requestsRes] = await Promise.all([
        supabase.from("merchant_applications").select("id", { count: "exact", head: true }),
        supabase.from("merchant_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("community_print_requests").select("id", { count: "exact", head: true }),
      ]);

      return {
        totalMerchants: merchantsRes.count ?? 0,
        pendingMerchants: pendingMerchantsRes.count ?? 0,
        totalCustomers: profilesRes.count ?? 0,
        totalRequests: requestsRes.count ?? 0,
      };
    },
    staleTime: 30_000,
  });

  const pendingCounts = useMemo(() => ({
    merchants: stats?.pendingMerchants ?? 0,
  }), [stats]);

  return (
    <AdminLayout
      title="مجتمع ليفو"
      description="إدارة التجار والعملاء والمحادثات"
      icon={<Users className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.dashboard}
      maxWidth="7xl"
    >
      {/* Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatsCard
          icon={Store}
          value={stats?.totalMerchants ?? 0}
          label="إجمالي التجار"
          colorClass="text-emerald-500"
          bgClass="bg-emerald-500/15"
        />
        <StatsCard
          icon={Clock}
          value={stats?.pendingMerchants ?? 0}
          label="قيد المراجعة"
          colorClass="text-amber-500"
          bgClass="bg-amber-500/15"
        />
        <StatsCard
          icon={Users}
          value={stats?.totalCustomers ?? 0}
          label="العملاء"
          colorClass="text-blue-500"
          bgClass="bg-blue-500/15"
        />
        <StatsCard
          icon={ShoppingBag}
          value={stats?.totalRequests ?? 0}
          label="طلبات الطباعة"
          colorClass="text-purple-500"
          bgClass="bg-purple-500/15"
        />
      </div>

      {/* Navigation Strip */}
      <div className="sticky top-[calc(4rem+4.5rem)] z-30 -mx-4 md:-mx-6 px-4 md:px-6 mb-6">
        <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-xl p-1.5 shadow-sm">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.value;
              const hasPending = pendingCounts[tab.value as keyof typeof pendingCounts];
              
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-lg whitespace-nowrap transition-all duration-200 shrink-0",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <tab.icon className={cn("h-4 w-4", isActive ? "" : tab.colorClass)} />
                  <span className="text-sm font-medium">{tab.label}</span>
                  {hasPending > 0 && (
                    <Badge 
                      variant={isActive ? "secondary" : "destructive"} 
                      className="h-5 min-w-5 px-1.5 text-[10px]"
                    >
                      {hasPending}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <Suspense fallback={<TabLoader />}>
        {activeTab === "merchants" && <AdminCommunityMerchants embedded />}
        {activeTab === "customers" && <AdminCommunityCustomers embedded />}
        {activeTab === "complaints" && <AdminCommunityComplaints embedded />}
        {activeTab === "messages" && <AdminCommunityMessages embedded />}
        {activeTab === "badges" && <AdminBadgeSettings embedded />}
        {activeTab === "frames" && <AdminAvatarFrames embedded />}
      </Suspense>
    </AdminLayout>
  );
}
