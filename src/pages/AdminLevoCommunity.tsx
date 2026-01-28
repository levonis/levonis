import { useState, Suspense, lazy, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Store, Users, MessageCircle, AlertTriangle, Award, ImageIcon, 
  Clock, Loader2, Settings, FileText, TrendingUp, 
  Wallet, Trash2, Save, RefreshCw, ShieldCheck
} from "lucide-react";
import AdminLayout, { AdminSection } from "@/components/admin/AdminLayout";
import { ADMIN_ROUTES } from "@/config/adminConfig";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    value: "requests",
    icon: FileText,
    label: "الطلبات",
    colorClass: "text-orange-500",
    bgClass: "bg-orange-500/15",
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
  {
    value: "settings",
    icon: Settings,
    label: "الإعدادات",
    colorClass: "text-slate-500",
    bgClass: "bg-slate-500/15",
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
  trend?: string;
}

function StatsCard({ icon: Icon, value, label, colorClass, bgClass, trend }: StatsCardProps) {
  return (
    <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20 hover:shadow-lg transition-all duration-300">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className={cn("p-2.5 rounded-xl", bgClass)}>
            <Icon className={cn("h-5 w-5", colorClass)} />
          </div>
          {trend && (
            <div className="flex items-center gap-1 text-emerald-500 text-xs">
              <TrendingUp className="h-3 w-3" />
              {trend}
            </div>
          )}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold text-foreground">{value.toLocaleString("ar-IQ")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CommunitySettings() {
  const queryClient = useQueryClient();
  
  const { data: settings, isLoading } = useQuery({
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

  const [merchantFee, setMerchantFee] = useState<number>(25000);
  const [autoDeleteDays, setAutoDeleteDays] = useState<number>(7);
  const [maxRequestsPerDay, setMaxRequestsPerDay] = useState<number>(5);

  // Sync with fetched settings
  useMemo(() => {
    if (settings) {
      setMerchantFee(settings.merchant_registration_fee?.amount || 25000);
      setAutoDeleteDays(settings.rejected_application_auto_delete_days?.days || 7);
      setMaxRequestsPerDay(settings.max_customer_requests_per_day?.limit || 5);
    }
  }, [settings]);

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await supabase
        .from("community_settings")
        .update({ value })
        .eq("key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-settings"] });
      toast.success("تم حفظ الإعداد");
    },
    onError: () => {
      toast.error("فشل حفظ الإعداد");
    },
  });

  const cleanupDraftsMutation = useMutation({
    mutationFn: async () => {
      // Delete draft applications with no display_name older than 24 hours
      const { error } = await supabase
        .from("merchant_applications")
        .delete()
        .eq("status", "draft")
        .is("display_name", null)
        .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      if (error) throw error;
      
      // Delete rejected applications older than X days
      const daysAgo = new Date(Date.now() - autoDeleteDays * 24 * 60 * 60 * 1000).toISOString();
      
      // First get the IDs of rejected applications to delete
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

  if (isLoading) {
    return <TabLoader />;
  }

  return (
    <div className="space-y-6">
      {/* Registration Fee Settings */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5 text-primary" />
            رسوم التسجيل كتاجر
          </CardTitle>
          <CardDescription>
            الرسوم التي يتم خصمها من محفظة المستخدم عند قبوله كتاجر
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label className="text-sm">المبلغ (دينار عراقي)</Label>
              <Input
                type="number"
                value={merchantFee}
                onChange={(e) => setMerchantFee(Number(e.target.value))}
                className="mt-1.5"
                min={0}
                step={1000}
              />
            </div>
            <Button
              onClick={() => updateSettingMutation.mutate({
                key: "merchant_registration_fee",
                value: { amount: merchantFee, currency: "IQD" }
              })}
              disabled={updateSettingMutation.isPending}
              size="sm"
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              حفظ
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            القيمة الحالية: {(settings?.merchant_registration_fee?.amount || 25000).toLocaleString()} د.ع
          </p>
        </CardContent>
      </Card>

      {/* Auto-Delete Settings */}
      <Card className="border-orange-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trash2 className="h-5 w-5 text-orange-500" />
            حذف الطلبات المرفوضة تلقائياً
          </CardTitle>
          <CardDescription>
            يتم حذف طلبات التسجيل المرفوضة تلقائياً بعد المدة المحددة لتنظيف النظام
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label className="text-sm">عدد الأيام</Label>
              <Input
                type="number"
                value={autoDeleteDays}
                onChange={(e) => setAutoDeleteDays(Number(e.target.value))}
                className="mt-1.5"
                min={1}
                max={90}
              />
            </div>
            <Button
              onClick={() => updateSettingMutation.mutate({
                key: "rejected_application_auto_delete_days",
                value: { days: autoDeleteDays }
              })}
              disabled={updateSettingMutation.isPending}
              size="sm"
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              حفظ
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Max Requests Per Day */}
      <Card className="border-blue-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-blue-500" />
            الحد الأقصى لطلبات العميل
          </CardTitle>
          <CardDescription>
            الحد الأقصى لعدد طلبات الطباعة التي يمكن للعميل نشرها يومياً
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label className="text-sm">عدد الطلبات يومياً</Label>
              <Input
                type="number"
                value={maxRequestsPerDay}
                onChange={(e) => setMaxRequestsPerDay(Number(e.target.value))}
                className="mt-1.5"
                min={1}
                max={50}
              />
            </div>
            <Button
              onClick={() => updateSettingMutation.mutate({
                key: "max_customer_requests_per_day",
                value: { limit: maxRequestsPerDay }
              })}
              disabled={updateSettingMutation.isPending}
              size="sm"
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              حفظ
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cleanup Actions */}
      <Card className="border-destructive/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <RefreshCw className="h-5 w-5 text-destructive" />
            تنظيف النظام
          </CardTitle>
          <CardDescription>
            إجراءات للتنظيف اليدوي للسجلات القديمة وغير المكتملة
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => cleanupDraftsMutation.mutate()}
              disabled={cleanupDraftsMutation.isPending}
              className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              {cleanupDraftsMutation.isPending ? "جارٍ التنظيف..." : "حذف المسودات الفارغة"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            يحذف المسودات بدون اسم متجر (أقدم من 24 ساعة) والطلبات المرفوضة (أقدم من {autoDeleteDays} أيام)
          </p>
        </CardContent>
      </Card>
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

  return (
    <AdminLayout
      title="مجتمع ليفو"
      description="إدارة شاملة للتجار والعملاء والطلبات"
      icon={<ShieldCheck className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.dashboard}
      maxWidth="7xl"
    >
      {/* Enhanced Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatsCard
          icon={Store}
          value={stats?.totalMerchants ?? 0}
          label="تجار معتمدون"
          colorClass="text-emerald-500"
          bgClass="bg-emerald-500/15"
        />
        <StatsCard
          icon={Clock}
          value={stats?.pendingMerchants ?? 0}
          label="طلبات تجار"
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
          icon={FileText}
          value={stats?.totalRequests ?? 0}
          label="طلبات الطباعة"
          colorClass="text-purple-500"
          bgClass="bg-purple-500/15"
        />
        <StatsCard
          icon={Clock}
          value={stats?.pendingRequests ?? 0}
          label="طلبات قيد المراجعة"
          colorClass="text-orange-500"
          bgClass="bg-orange-500/15"
        />
        <StatsCard
          icon={AlertTriangle}
          value={stats?.pendingComplaints ?? 0}
          label="شكاوى معلقة"
          colorClass="text-red-500"
          bgClass="bg-red-500/15"
        />
      </div>

      {/* Navigation Strip - Scrollable on mobile */}
      <div className="sticky top-[calc(4rem+4.5rem)] z-30 -mx-4 md:-mx-6 px-4 md:px-6 mb-6">
        <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-xl p-1.5 shadow-sm">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-0.5">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.value;
              const hasPending = pendingCounts[tab.value as keyof typeof pendingCounts];
              
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition-all duration-200 shrink-0 text-sm",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <tab.icon className={cn("h-4 w-4", isActive ? "" : tab.colorClass)} />
                  <span className="font-medium">{tab.label}</span>
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
        {activeTab === "requests" && <AdminCommunityRequests />}
        {activeTab === "complaints" && <AdminCommunityComplaints embedded />}
        {activeTab === "messages" && <AdminCommunityMessages embedded />}
        {activeTab === "badges" && <AdminBadgeSettings embedded />}
        {activeTab === "frames" && <AdminAvatarFrames embedded />}
        {activeTab === "settings" && <CommunitySettings />}
      </Suspense>
    </AdminLayout>
  );
}
