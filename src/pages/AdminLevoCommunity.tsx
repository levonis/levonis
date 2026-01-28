import { useState, Suspense, lazy, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Store, Users, MessageCircle, AlertTriangle, Award, ImageIcon, 
  Clock, Loader2, Settings, FileText, 
  Wallet, Trash2, Save, RefreshCw, ShieldCheck, Percent
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
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
    <div className="flex items-center justify-center py-12">
      <div className="text-center space-y-2">
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        <p className="text-xs text-muted-foreground">جارٍ التحميل...</p>
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
  
  // Fetch platform commission rate from default_settings (the actual one used in offers)
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

  // Sync with fetched settings - only once when data loads
  if (communitySettings && platformCommission && !settingsInitialized) {
    setMerchantFee(communitySettings.merchant_registration_fee?.amount || 25000);
    setAutoDeleteDays(communitySettings.rejected_application_auto_delete_days?.days || 7);
    setMaxRequestsPerDay(communitySettings.max_customer_requests_per_day?.limit || 5);
    // Use the actual platform commission rate (stored as decimal like 0.007 = 0.7%)
    setCommissionRate((platformCommission?.rate || 0.007) * 100);
    setSettingsInitialized(true);
  }

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      // First try to update in community_settings
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
        // Insert if not exists
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
  
  // Separate mutation for platform commission (stored in default_settings)
  const updateCommissionMutation = useMutation({
    mutationFn: async (ratePercent: number) => {
      const rateDecimal = ratePercent / 100; // Convert 0.7% to 0.007
      
      // Check if exists
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

  const isLoading = communityLoading;

  if (isLoading) {
    return <TabLoader />;
  }

  return (
    <div className="space-y-4">
      {/* Registration Fee Settings */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Wallet className="h-4 w-4 text-primary" />
            رسوم التسجيل كتاجر
          </CardTitle>
          <CardDescription className="text-xs">
            الرسوم التي يتم خصمها من محفظة المستخدم عند قبوله كتاجر
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">المبلغ (دينار عراقي)</Label>
              <Input
                type="number"
                value={merchantFee}
                onChange={(e) => setMerchantFee(Number(e.target.value))}
                className="mt-1 h-9"
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
              className="gap-1.5 h-9"
            >
              <Save className="h-3.5 w-3.5" />
              حفظ
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            القيمة الحالية: {(communitySettings?.merchant_registration_fee?.amount || 25000).toLocaleString()} د.ع
          </p>
        </CardContent>
      </Card>

      {/* Auto-Delete Settings */}
      <Card className="border-orange-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Trash2 className="h-4 w-4 text-orange-500" />
            حذف الطلبات المرفوضة تلقائياً
          </CardTitle>
          <CardDescription className="text-xs">
            يتم حذف طلبات التسجيل المرفوضة تلقائياً بعد المدة المحددة
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">عدد الأيام</Label>
              <Input
                type="number"
                value={autoDeleteDays}
                onChange={(e) => setAutoDeleteDays(Number(e.target.value))}
                className="mt-1 h-9"
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
              className="gap-1.5 h-9"
            >
              <Save className="h-3.5 w-3.5" />
              حفظ
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Max Requests Per Day */}
      <Card className="border-blue-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-blue-500" />
            الحد الأقصى لطلبات العميل
          </CardTitle>
          <CardDescription className="text-xs">
            الحد الأقصى لعدد طلبات الطباعة يومياً
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">عدد الطلبات</Label>
              <Input
                type="number"
                value={maxRequestsPerDay}
                onChange={(e) => setMaxRequestsPerDay(Number(e.target.value))}
                className="mt-1 h-9"
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
              className="gap-1.5 h-9"
            >
              <Save className="h-3.5 w-3.5" />
              حفظ
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Commission Rate */}
      <Card className="border-emerald-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Percent className="h-4 w-4 text-emerald-500" />
            نسبة العمولة
          </CardTitle>
          <CardDescription className="text-xs">
            النسبة المئوية التي يتم خصمها من كل عملية بيع
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">النسبة (%)</Label>
              <Input
                type="number"
                value={commissionRate}
                onChange={(e) => setCommissionRate(Number(e.target.value))}
                className="mt-1 h-9"
                min={0}
                max={100}
                step={0.5}
              />
            </div>
            <Button
              onClick={() => updateCommissionMutation.mutate(commissionRate)}
              disabled={updateCommissionMutation.isPending}
              size="sm"
              className="gap-1.5 h-9"
            >
              <Save className="h-3.5 w-3.5" />
              حفظ
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            القيمة الحالية: {((platformCommission?.rate || 0.007) * 100).toFixed(1)}%
          </p>
        </CardContent>
      </Card>

      {/* Cleanup Actions */}
      <Card className="border-destructive/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <RefreshCw className="h-4 w-4 text-destructive" />
            تنظيف النظام
          </CardTitle>
          <CardDescription className="text-xs">
            حذف السجلات القديمة وغير المكتملة
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <Button
            variant="outline"
            onClick={() => cleanupDraftsMutation.mutate()}
            disabled={cleanupDraftsMutation.isPending}
            className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
            size="sm"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {cleanupDraftsMutation.isPending ? "جارٍ التنظيف..." : "حذف المسودات الفارغة"}
          </Button>
          <p className="text-[10px] text-muted-foreground mt-2">
            يحذف المسودات الفارغة والطلبات المرفوضة القديمة
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
      description="إدارة التجار والعملاء والطلبات"
      icon={<ShieldCheck className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.dashboard}
      maxWidth="7xl"
    >
      {/* Compact Stats Strip */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <Badge variant="outline" className="px-3 py-1.5 gap-2">
          <Store className="h-3.5 w-3.5 text-emerald-500" />
          {stats?.totalMerchants ?? 0} تاجر
        </Badge>
        <Badge variant="outline" className="px-3 py-1.5 gap-2 border-amber-500/30">
          <Clock className="h-3.5 w-3.5 text-amber-500" />
          {stats?.pendingMerchants ?? 0} معلق
        </Badge>
        <Badge variant="outline" className="px-3 py-1.5 gap-2">
          <Users className="h-3.5 w-3.5 text-blue-500" />
          {stats?.totalCustomers ?? 0} عميل
        </Badge>
        <Badge variant="outline" className="px-3 py-1.5 gap-2">
          <FileText className="h-3.5 w-3.5 text-purple-500" />
          {stats?.totalRequests ?? 0} طلب
        </Badge>
        <Badge variant="outline" className="px-3 py-1.5 gap-2 border-red-500/30">
          <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
          {stats?.pendingComplaints ?? 0} شكوى
        </Badge>
      </div>

      {/* Navigation Strip - Compact */}
      <div className="sticky top-[calc(4rem+4.5rem)] z-30 -mx-4 md:-mx-6 px-4 md:px-6 mb-4">
        <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-lg p-1 shadow-sm">
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.value;
              const hasPending = pendingCounts[tab.value as keyof typeof pendingCounts];
              
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    "relative flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <tab.icon className={cn("h-3.5 w-3.5", isActive ? "" : tab.colorClass)} />
                  <span>{tab.label}</span>
                  {hasPending > 0 && !isActive && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                      {hasPending}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
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
    </AdminLayout>
  );
}
