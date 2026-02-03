import { useState, Suspense, lazy, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Store, Users, MessageCircle, AlertTriangle, Award, ImageIcon, 
  Loader2, Settings, FileText, 
  Wallet, Trash2, Save, RefreshCw, ShieldCheck, Percent,
  TrendingUp, Clock, ChevronLeft
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { ADMIN_ROUTES } from "@/config/adminConfig";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Lazy load the tab content components
const AdminCommunityMerchants = lazy(() => import("@/pages/AdminCommunityMerchants"));
const AdminCommunityCustomers = lazy(() => import("@/pages/AdminCommunityCustomers"));
const AdminCommunityComplaints = lazy(() => import("@/pages/AdminCommunityComplaints"));
const AdminCommunityMessages = lazy(() => import("@/pages/AdminCommunityMessages"));
const AdminBadgeSettings = lazy(() => import("@/pages/AdminBadgeSettings"));
const AdminAvatarFrames = lazy(() => import("@/pages/AdminAvatarFrames"));
const AdminCommunityRequests = lazy(() => import("@/components/admin/AdminCommunityRequests"));

interface TabConfig {
  value: string;
  icon: React.ElementType;
  label: string;
}

const tabs: TabConfig[] = [
  { value: "merchants", icon: Store, label: "التجار" },
  { value: "customers", icon: Users, label: "العملاء" },
  { value: "requests", icon: FileText, label: "الطلبات" },
  { value: "complaints", icon: AlertTriangle, label: "الشكاوى" },
  { value: "messages", icon: MessageCircle, label: "المحادثات" },
  { value: "badges", icon: Award, label: "الشارات" },
  { value: "frames", icon: ImageIcon, label: "الإطارات" },
  { value: "settings", icon: Settings, label: "الإعدادات" },
];

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center space-y-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
        <p className="text-xs text-muted-foreground">جارٍ التحميل...</p>
      </div>
    </div>
  );
}

// Compact Settings Card Component
function SettingCard({ 
  icon: Icon, 
  title, 
  description, 
  iconColor,
  children 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string; 
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/50 p-3">
      <div className="flex items-start gap-3">
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-foreground">{title}</h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
          <div className="mt-2.5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function CommunitySettings() {
  const queryClient = useQueryClient();
  
  // Fetch community settings
  const { data: communitySettings, isLoading: communityLoading } = useQuery({
    queryKey: ["community-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_settings")
        .select("*");
      if (error) throw error;
      return data?.reduce((acc, s) => {
        acc[s.key] = s.value;
        return acc;
      }, {} as Record<string, any>) || {};
    },
  });
  
  // Fetch platform commission rate from default_settings
  const { data: platformCommission } = useQuery({
    queryKey: ["platform-commission"],
    queryFn: async () => {
      const { data } = await supabase
        .from("default_settings")
        .select("setting_value")
        .eq("setting_key", "platform_commission_rate")
        .maybeSingle();
      return data?.setting_value as { rate: number } | null;
    },
  });

  const [merchantFee, setMerchantFee] = useState<number>(25000);
  const [autoDeleteDays, setAutoDeleteDays] = useState<number>(7);
  const [maxRequestsPerDay, setMaxRequestsPerDay] = useState<number>(5);
  const [commissionRate, setCommissionRate] = useState<number>(0.7);
  const [settingsInitialized, setSettingsInitialized] = useState(false);

  // Sync with fetched settings
  if (communitySettings && platformCommission && !settingsInitialized) {
    // Use ?? instead of || to allow 0 values
    setMerchantFee(communitySettings.merchant_registration_fee?.amount ?? 25000);
    setAutoDeleteDays(communitySettings.rejected_application_auto_delete_days?.days ?? 7);
    setMaxRequestsPerDay(communitySettings.max_customer_requests_per_day?.limit ?? 5);
    setCommissionRate((platformCommission?.rate ?? 0.007) * 100);
    setSettingsInitialized(true);
  }

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { data: existing } = await supabase
        .from("community_settings")
        .select("id")
        .eq("key", key)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("community_settings")
          .update({ value, updated_at: new Date().toISOString() })
          .eq("key", key);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("community_settings")
          .insert({ key, value });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-settings"] });
      toast.success("تم حفظ الإعداد");
    },
    onError: () => {
      toast.error("فشل حفظ الإعداد");
    },
  });
  
  const updateCommissionMutation = useMutation({
    mutationFn: async (ratePercent: number) => {
      const rateDecimal = ratePercent / 100;
      
      const { data: existing } = await supabase
        .from("default_settings")
        .select("id")
        .eq("setting_key", "platform_commission_rate")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("default_settings")
          .update({ 
            setting_value: { rate: rateDecimal },
            updated_at: new Date().toISOString() 
          })
          .eq("setting_key", "platform_commission_rate");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("default_settings")
          .insert({ 
            setting_key: "platform_commission_rate", 
            setting_value: { rate: rateDecimal } 
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-commission"] });
      toast.success("تم حفظ نسبة العمولة");
    },
    onError: () => {
      toast.error("فشل حفظ نسبة العمولة");
    },
  });

  const cleanupDraftsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("merchant_applications")
        .delete()
        .eq("status", "draft")
        .is("display_name", null)
        .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      if (error) throw error;
      
      const daysAgo = new Date(Date.now() - autoDeleteDays * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: rejectedApps } = await supabase
        .from("merchant_applications")
        .select("id")
        .eq("status", "rejected")
        .not("rejected_at", "is", null)
        .lt("rejected_at", daysAgo);
      
      const rejectedIds = rejectedApps?.map(a => a.id) || [];
      
      if (rejectedIds.length > 0) {
        await supabase
          .from("merchant_application_private")
          .delete()
          .in("application_id", rejectedIds);
        
        await supabase
          .from("merchant_applications")
          .delete()
          .in("id", rejectedIds);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-merchant-applications"] });
      toast.success("تم تنظيف السجلات القديمة");
    },
    onError: () => {
      toast.error("فشل التنظيف");
    },
  });

  if (communityLoading) {
    return <TabLoader />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* Registration Fee */}
      <SettingCard
        icon={Wallet}
        title="رسوم التسجيل كتاجر"
        description="المبلغ المخصوم عند قبول التاجر"
        iconColor="bg-primary/15 text-primary"
      >
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={merchantFee}
            onChange={(e) => setMerchantFee(Number(e.target.value))}
            className="h-7 text-xs flex-1"
            min={0}
            step={1000}
          />
          <span className="text-[10px] text-muted-foreground shrink-0">د.ع</span>
          <Button
            onClick={() => updateSettingMutation.mutate({
              key: "merchant_registration_fee",
              value: { amount: merchantFee, currency: "IQD" }
            })}
            disabled={updateSettingMutation.isPending}
            size="sm"
            className="h-7 px-2"
          >
            <Save className="h-3 w-3" />
          </Button>
        </div>
      </SettingCard>

      {/* Commission Rate */}
      <SettingCard
        icon={Percent}
        title="نسبة العمولة"
        description="النسبة من كل عملية بيع"
        iconColor="bg-emerald-500/15 text-emerald-500"
      >
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={commissionRate}
            onChange={(e) => setCommissionRate(Number(e.target.value))}
            className="h-7 text-xs flex-1"
            min={0}
            max={100}
            step={0.1}
          />
          <span className="text-[10px] text-muted-foreground shrink-0">%</span>
          <Button
            onClick={() => updateCommissionMutation.mutate(commissionRate)}
            disabled={updateCommissionMutation.isPending}
            size="sm"
            className="h-7 px-2"
          >
            <Save className="h-3 w-3" />
          </Button>
        </div>
        <p className="text-[9px] text-muted-foreground mt-1">
          الحالي: {((platformCommission?.rate || 0.007) * 100).toFixed(1)}%
        </p>
      </SettingCard>

      {/* Auto Delete Days */}
      <SettingCard
        icon={Trash2}
        title="حذف الطلبات المرفوضة"
        description="بعد عدد الأيام المحددة"
        iconColor="bg-orange-500/15 text-orange-500"
      >
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={autoDeleteDays}
            onChange={(e) => setAutoDeleteDays(Number(e.target.value))}
            className="h-7 text-xs flex-1"
            min={1}
            max={90}
          />
          <span className="text-[10px] text-muted-foreground shrink-0">يوم</span>
          <Button
            onClick={() => updateSettingMutation.mutate({
              key: "rejected_application_auto_delete_days",
              value: { days: autoDeleteDays }
            })}
            disabled={updateSettingMutation.isPending}
            size="sm"
            className="h-7 px-2"
          >
            <Save className="h-3 w-3" />
          </Button>
        </div>
      </SettingCard>

      {/* Max Requests Per Day */}
      <SettingCard
        icon={FileText}
        title="الحد الأقصى للطلبات"
        description="عدد طلبات الطباعة يومياً"
        iconColor="bg-blue-500/15 text-blue-500"
      >
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={maxRequestsPerDay}
            onChange={(e) => setMaxRequestsPerDay(Number(e.target.value))}
            className="h-7 text-xs flex-1"
            min={1}
            max={50}
          />
          <span className="text-[10px] text-muted-foreground shrink-0">طلب</span>
          <Button
            onClick={() => updateSettingMutation.mutate({
              key: "max_customer_requests_per_day",
              value: { limit: maxRequestsPerDay }
            })}
            disabled={updateSettingMutation.isPending}
            size="sm"
            className="h-7 px-2"
          >
            <Save className="h-3 w-3" />
          </Button>
        </div>
      </SettingCard>

      {/* System Cleanup - Full Width */}
      <div className="sm:col-span-2">
        <SettingCard
          icon={RefreshCw}
          title="تنظيف النظام"
          description="حذف السجلات غير المكتملة والمرفوضة القديمة"
          iconColor="bg-destructive/15 text-destructive"
        >
          <Button
            variant="outline"
            onClick={() => cleanupDraftsMutation.mutate()}
            disabled={cleanupDraftsMutation.isPending}
            className="h-7 text-[10px] gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3 w-3" />
            {cleanupDraftsMutation.isPending ? "جارٍ التنظيف..." : "تنظيف الآن"}
          </Button>
        </SettingCard>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue, 
  iconColor,
  highlight 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number; 
  subValue?: string;
  iconColor: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors",
      highlight 
        ? "bg-amber-500/10 border-amber-500/40" 
        : "bg-card/60 border-border/50"
    )}>
      <div className={cn("h-7 w-7 rounded-md flex items-center justify-center shrink-0", iconColor)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold tabular-nums">{value.toLocaleString()}</p>
        <p className="text-[9px] text-muted-foreground truncate">{label}</p>
      </div>
      {subValue && (
        <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-4 mr-auto shrink-0">
          {subValue}
        </Badge>
      )}
    </div>
  );
}

export default function AdminLevoCommunity() {
  const [activeTab, setActiveTab] = useState("merchants");

  // Fetch community stats
  const { data: stats } = useQuery({
    queryKey: ["admin-community-stats"],
    queryFn: async () => {
      const [
        merchantsRes, 
        pendingMerchantsRes, 
        profilesRes, 
        requestsRes,
        pendingRequestsRes,
        complaintsRes
      ] = await Promise.all([
        supabase.from("merchant_applications").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("merchant_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("community_customer_profiles").select("id", { count: "exact", head: true }),
        supabase.from("community_print_requests").select("id", { count: "exact", head: true }),
        supabase.from("community_print_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("community_complaints").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);

      return {
        totalMerchants: merchantsRes.count ?? 0,
        pendingMerchants: pendingMerchantsRes.count ?? 0,
        totalCustomers: profilesRes.count ?? 0,
        totalRequests: requestsRes.count ?? 0,
        pendingRequests: pendingRequestsRes.count ?? 0,
        pendingComplaints: complaintsRes.count ?? 0,
      };
    },
    staleTime: 30_000,
  });

  const pendingCounts = useMemo(() => ({
    merchants: stats?.pendingMerchants ?? 0,
    requests: stats?.pendingRequests ?? 0,
    complaints: stats?.pendingComplaints ?? 0,
  }), [stats]);

  const activeTabConfig = tabs.find(t => t.value === activeTab);

  return (
    <AdminLayout
      title="مجتمع ليفو"
      description="إدارة التجار والعملاء والطلبات"
      icon={<ShieldCheck className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.dashboard}
      maxWidth="7xl"
    >
      <div className="space-y-4">
        {/* Stats Grid - Compact Professional */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <StatCard
            icon={Store}
            label="التجار المعتمدين"
            value={stats?.totalMerchants ?? 0}
            iconColor="bg-emerald-500/15 text-emerald-500"
          />
          <StatCard
            icon={Clock}
            label="بانتظار الموافقة"
            value={stats?.pendingMerchants ?? 0}
            iconColor="bg-amber-500/15 text-amber-500"
            highlight={!!stats?.pendingMerchants}
          />
          <StatCard
            icon={Users}
            label="إجمالي العملاء"
            value={stats?.totalCustomers ?? 0}
            iconColor="bg-blue-500/15 text-blue-500"
          />
          <StatCard
            icon={FileText}
            label="إجمالي الطلبات"
            value={stats?.totalRequests ?? 0}
            iconColor="bg-purple-500/15 text-purple-500"
          />
          <StatCard
            icon={TrendingUp}
            label="طلبات معلقة"
            value={stats?.pendingRequests ?? 0}
            iconColor="bg-cyan-500/15 text-cyan-500"
          />
          <StatCard
            icon={AlertTriangle}
            label="شكاوى معلقة"
            value={stats?.pendingComplaints ?? 0}
            iconColor="bg-red-500/15 text-red-500"
            highlight={!!stats?.pendingComplaints}
          />
        </div>

        {/* Navigation Tabs - Professional Minimal */}
        <div className="sticky top-16 z-30 -mx-4 md:-mx-6 px-4 md:px-6">
          <div className="bg-background/95 backdrop-blur-md border-b border-border/50 -mx-4 md:-mx-6 px-4 md:px-6 py-2">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.value;
                const pending = pendingCounts[tab.value as keyof typeof pendingCounts];
                
                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all whitespace-nowrap",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    <tab.icon className="h-3 w-3" />
                    <span>{tab.label}</span>
                    {pending > 0 && !isActive && (
                      <span className="h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                        {pending}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Active Tab Header */}
        {activeTabConfig && (
          <div className="flex items-center gap-2 pt-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <activeTabConfig.icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold">{activeTabConfig.label}</h2>
              <p className="text-[10px] text-muted-foreground">
                {activeTab === "merchants" && "إدارة طلبات التجار والموافقات"}
                {activeTab === "customers" && "عرض وإدارة ملفات العملاء"}
                {activeTab === "requests" && "مراجعة طلبات الطباعة"}
                {activeTab === "complaints" && "معالجة الشكاوى والبلاغات"}
                {activeTab === "messages" && "مراقبة المحادثات"}
                {activeTab === "badges" && "إعدادات شارات الأداء"}
                {activeTab === "frames" && "إدارة إطارات الصور"}
                {activeTab === "settings" && "إعدادات المنصة"}
              </p>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="min-h-[400px] rounded-lg border border-border/40 bg-card/30 p-4">
          <Suspense fallback={<TabLoader />}>
            {activeTab === "merchants" && <AdminCommunityMerchants embedded />}
            {activeTab === "customers" && <AdminCommunityCustomers embedded />}
            {activeTab === "requests" && <AdminCommunityRequests />}
            {activeTab === "complaints" && <AdminCommunityComplaints embedded />}
            {activeTab === "messages" && <AdminCommunityMessages embedded />}
            {activeTab === "badges" && <AdminBadgeSettings embedded />}
            {activeTab === "frames" && <AdminAvatarFrames embedded />}
            {activeTab === "settings" && <CommunitySettings />}
          </Suspense>
        </div>
      </div>
    </AdminLayout>
  );
}
