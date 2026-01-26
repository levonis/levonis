import { useState, Suspense, lazy, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Store, Users, MessageCircle, AlertTriangle, Award, ImageIcon, 
  TrendingUp, ShoppingBag, Clock, CheckCircle2, XCircle, Loader2,
  ChevronLeft, Activity, BarChart3
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
  description: string;
  gradient: string;
  iconBg: string;
}

const tabs: TabConfig[] = [
  {
    value: "merchants",
    icon: Store,
    label: "التجار",
    description: "إدارة طلبات التجار",
    gradient: "from-emerald-500/20 to-emerald-600/5",
    iconBg: "bg-emerald-500/15 text-emerald-500",
  },
  {
    value: "customers",
    icon: Users,
    label: "الزبائن",
    description: "إدارة حسابات الزبائن",
    gradient: "from-blue-500/20 to-blue-600/5",
    iconBg: "bg-blue-500/15 text-blue-500",
  },
  {
    value: "complaints",
    icon: AlertTriangle,
    label: "الشكاوى",
    description: "النزاعات والشكاوى",
    gradient: "from-amber-500/20 to-amber-600/5",
    iconBg: "bg-amber-500/15 text-amber-500",
  },
  {
    value: "messages",
    icon: MessageCircle,
    label: "المحادثات",
    description: "مراقبة المحادثات",
    gradient: "from-purple-500/20 to-purple-600/5",
    iconBg: "bg-purple-500/15 text-purple-500",
  },
  {
    value: "badges",
    icon: Award,
    label: "الشارات",
    description: "إعدادات الشارات",
    gradient: "from-primary/20 to-primary/5",
    iconBg: "bg-primary/15 text-primary",
  },
  {
    value: "frames",
    icon: ImageIcon,
    label: "الإطارات",
    description: "إطارات الصور",
    gradient: "from-pink-500/20 to-pink-600/5",
    iconBg: "bg-pink-500/15 text-pink-500",
  },
];

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center space-y-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
      </div>
    </div>
  );
}

interface StatsCardProps {
  icon: React.ElementType;
  value: number;
  label: string;
  trend?: { value: number; positive: boolean };
  colorClass: string;
  bgClass: string;
}

function StatsCard({ icon: Icon, value, label, trend, colorClass, bgClass }: StatsCardProps) {
  return (
    <Card className="p-4 border-border/50 bg-gradient-to-br from-card to-card/50 hover:shadow-lg transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className={cn("p-2.5 rounded-xl", bgClass)}>
          <Icon className={cn("h-5 w-5", colorClass)} />
        </div>
        {trend && (
          <Badge 
            variant="outline" 
            className={cn(
              "text-[10px] px-1.5 py-0.5",
              trend.positive ? "text-emerald-500 border-emerald-500/30" : "text-rose-500 border-rose-500/30"
            )}
          >
            {trend.positive ? "+" : ""}{trend.value}%
          </Badge>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-foreground">{value.toLocaleString("ar-IQ")}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </Card>
  );
}

interface NavigationCardProps {
  tab: TabConfig;
  isActive: boolean;
  onClick: () => void;
  count?: number;
  pendingCount?: number;
}

function NavigationCard({ tab, isActive, onClick, count, pendingCount }: NavigationCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-right p-4 rounded-xl border transition-all duration-300 group",
        "hover:shadow-md hover:scale-[1.02]",
        isActive 
          ? "border-primary/50 bg-gradient-to-br from-primary/15 to-primary/5 shadow-md" 
          : "border-border/50 bg-card hover:border-primary/30"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2.5 rounded-xl transition-colors",
          isActive ? "bg-primary/20 text-primary" : tab.iconBg
        )}>
          <tab.icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-semibold text-sm",
              isActive ? "text-primary" : "text-foreground"
            )}>
              {tab.label}
            </span>
            {pendingCount !== undefined && pendingCount > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
                {pendingCount}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{tab.description}</p>
        </div>
        {count !== undefined && (
          <span className="text-xs text-muted-foreground">{count}</span>
        )}
        <ChevronLeft className={cn(
          "h-4 w-4 transition-transform",
          isActive ? "text-primary" : "text-muted-foreground",
          "group-hover:-translate-x-1"
        )} />
      </div>
    </button>
  );
}

export default function AdminLevoCommunity() {
  const [activeTab, setActiveTab] = useState<string | null>(null);

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

  const tabCounts = useMemo(() => ({
    merchants: stats?.totalMerchants ?? 0,
    customers: stats?.totalCustomers ?? 0,
    complaints: 0,
    messages: 0,
    badges: 0,
    frames: 0,
  }), [stats]);

  const pendingCounts = useMemo(() => ({
    merchants: stats?.pendingMerchants ?? 0,
  }), [stats]);

  // If no tab is selected, show dashboard
  if (!activeTab) {
    return (
      <AdminLayout
        title="مجتمع ليفو"
        description="لوحة تحكم شاملة لإدارة مجتمع الطباعة ثلاثية الأبعاد"
        icon={<Users className="h-5 w-5" />}
        backTo={ADMIN_ROUTES.dashboard}
        maxWidth="7xl"
      >
        {/* Stats Overview */}
        <AdminSection className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">نظرة عامة</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
              label="طلبات قيد المراجعة"
              colorClass="text-amber-500"
              bgClass="bg-amber-500/15"
            />
            <StatsCard
              icon={Users}
              value={stats?.totalCustomers ?? 0}
              label="زبائن المجتمع"
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
        </AdminSection>

        {/* Quick Actions / Navigation */}
        <AdminSection>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">أقسام الإدارة</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tabs.map((tab) => (
              <NavigationCard
                key={tab.value}
                tab={tab}
                isActive={false}
                onClick={() => setActiveTab(tab.value)}
                count={tabCounts[tab.value as keyof typeof tabCounts]}
                pendingCount={pendingCounts[tab.value as keyof typeof pendingCounts]}
              />
            ))}
          </div>
        </AdminSection>

        {/* Recent Activity Section */}
        <AdminSection className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">النشاط الأخير</h2>
          </div>
          <Card className="p-6 border-border/50">
            <RecentActivityList />
          </Card>
        </AdminSection>
      </AdminLayout>
    );
  }

  // Show selected tab content
  const currentTab = tabs.find(t => t.value === activeTab);
  
  return (
    <AdminLayout
      title={currentTab?.label ?? "مجتمع ليفو"}
      description={currentTab?.description}
      icon={currentTab ? <currentTab.icon className="h-5 w-5" /> : <Users className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.levoCommunity}
      maxWidth="7xl"
      actions={
        <button
          onClick={() => setActiveTab(null)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          العودة للوحة التحكم
          <ChevronLeft className="h-4 w-4" />
        </button>
      }
    >
      {/* Tab Navigation Strip */}
      <div className="sticky top-[calc(4rem+4.5rem)] z-30 bg-background/95 backdrop-blur-sm border-b border-border/50 -mx-4 md:-mx-6 px-4 md:px-6 mb-6">
        <div className="flex items-center gap-2 py-2 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all",
                activeTab === tab.value
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <tab.icon className="h-4 w-4" />
              <span className="text-sm">{tab.label}</span>
              {pendingCounts[tab.value as keyof typeof pendingCounts] > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 px-1 text-[10px]">
                  {pendingCounts[tab.value as keyof typeof pendingCounts]}
                </Badge>
              )}
            </button>
          ))}
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

// Recent Activity Component
function RecentActivityList() {
  const { data: recentMerchants, isLoading } = useQuery({
    queryKey: ["admin-recent-merchant-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_applications")
        .select("id, display_name, status, created_at, store_image_url")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!recentMerchants?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Activity className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">لا يوجد نشاط حديث</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recentMerchants.map((merchant) => (
        <div key={merchant.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border/50">
            {merchant.store_image_url ? (
              <img src={merchant.store_image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Store className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{merchant.display_name || "تاجر جديد"}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(merchant.created_at).toLocaleDateString("ar-IQ")}
            </p>
          </div>
          <Badge 
            variant="outline"
            className={cn(
              "text-xs",
              merchant.status === "pending" && "border-amber-500/50 text-amber-500",
              merchant.status === "approved" && "border-emerald-500/50 text-emerald-500",
              merchant.status === "rejected" && "border-rose-500/50 text-rose-500",
            )}
          >
            {merchant.status === "pending" && "قيد المراجعة"}
            {merchant.status === "approved" && "مقبول"}
            {merchant.status === "rejected" && "مرفوض"}
          </Badge>
        </div>
      ))}
    </div>
  );
}
