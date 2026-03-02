import { useState, Suspense, lazy, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Store, Users, Award, ImageIcon, 
  Loader2, Settings, FileText, 
  Wallet, Trash2, Save, RefreshCw, ShieldCheck, Percent,
  TrendingUp, Clock, Megaphone, Gift, Tag, Truck, Plus, X, MapPin,
  CreditCard, Banknote, AlertTriangle
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IRAQI_GOVERNORATES } from "@/components/auth/signup/types";
import { Switch } from "@/components/ui/switch";

// Lazy load the tab content components
const AdminCommunityMerchants = lazy(() => import("@/pages/AdminCommunityMerchants"));
const AdminCommunityCustomers = lazy(() => import("@/pages/AdminCommunityCustomers"));
const AdminBadgeSettings = lazy(() => import("@/pages/AdminBadgeSettings"));
const AdminAvatarFrames = lazy(() => import("@/pages/AdminAvatarFrames"));
const AdminCommunityRequests = lazy(() => import("@/components/admin/AdminCommunityRequests"));
const AdminAssistanceManager = lazy(() => import("@/components/admin/AdminAssistanceManager"));

interface TabConfig {
  value: string;
  icon: React.ElementType;
  label: string;
}

const tabs: TabConfig[] = [
  { value: "merchants", icon: Store, label: "التجار" },
  { value: "customers", icon: Users, label: "العملاء" },
  { value: "requests", icon: FileText, label: "الطلبات" },
  { value: "assistance", icon: Gift, label: "المساعدات" },
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

function AdSlotPricingSettings() {
  const queryClient = useQueryClient();
  const { data: slots = [], isLoading } = useQuery({
    queryKey: ["admin-ad-slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_ad_slots")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const [prices, setPrices] = useState<Record<number, number>>({});
  const [initialized, setInitialized] = useState(false);

  if (slots.length > 0 && !initialized) {
    const p: Record<number, number> = {};
    slots.forEach(s => { p[s.position] = s.price_per_hour; });
    setPrices(p);
    setInitialized(true);
  }

  const updateMutation = useMutation({
    mutationFn: async ({ position, price }: { position: number; price: number }) => {
      const { error } = await supabase
        .from("merchant_ad_slots")
        .update({ price_per_hour: price, updated_at: new Date().toISOString() })
        .eq("position", position);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ad-slots"] });
      queryClient.invalidateQueries({ queryKey: ["ad-slots"] });
      toast.success("تم تحديث السعر");
    },
    onError: () => toast.error("فشل التحديث"),
  });

  const updateAllMutation = useMutation({
    mutationFn: async () => {
      for (const [pos, price] of Object.entries(prices)) {
        const { error } = await supabase
          .from("merchant_ad_slots")
          .update({ price_per_hour: price, updated_at: new Date().toISOString() })
          .eq("position", Number(pos));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ad-slots"] });
      queryClient.invalidateQueries({ queryKey: ["ad-slots"] });
      toast.success("تم تحديث جميع الأسعار");
    },
    onError: () => toast.error("فشل التحديث"),
  });

  if (isLoading) return null;

  return (
    <SettingCard
      icon={Megaphone}
      title="أسعار مراكز الإعلان"
      description="سعر كل ساعة لكل مركز إعلاني في قائمة التجار المميزين"
      iconColor="bg-amber-500/15 text-amber-500"
    >
      <div className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {slots.map(slot => (
            <div key={slot.position} className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground">مركز #{slot.position}</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  value={prices[slot.position] ?? slot.price_per_hour}
                  onChange={(e) => setPrices(prev => ({ ...prev, [slot.position]: Number(e.target.value) }))}
                  className="h-7 text-xs"
                />
              </div>
            </div>
          ))}
        </div>
        <Button
          onClick={() => updateAllMutation.mutate()}
          disabled={updateAllMutation.isPending}
          size="sm"
          className="h-7 text-[10px] gap-1.5 w-full"
        >
          <Save className="h-3 w-3" />
          {updateAllMutation.isPending ? "جارٍ الحفظ..." : "حفظ جميع الأسعار"}
        </Button>
      </div>
    </SettingCard>
  );
}

function DeliveryPricingSettings() {
  const queryClient = useQueryClient();
  
  const { data: deliverySettings, isLoading } = useQuery({
    queryKey: ["community-delivery-prices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("community_settings")
        .select("value")
        .eq("key", "delivery_prices")
        .maybeSingle();
      return (data?.value as { default: number; exceptions: Record<string, number> }) || { default: 5000, exceptions: {} };
    },
  });

  const [defaultPrice, setDefaultPrice] = useState(5000);
  const [exceptions, setExceptions] = useState<Record<string, number>>({});
  const [newGov, setNewGov] = useState("");
  const [newPrice, setNewPrice] = useState(5000);
  const [initialized, setInitialized] = useState(false);

  if (deliverySettings && !initialized) {
    setDefaultPrice(deliverySettings.default);
    setExceptions(deliverySettings.exceptions || {});
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const value = { default: defaultPrice, exceptions };
      const { data: existing } = await supabase
        .from("community_settings")
        .select("id")
        .eq("key", "delivery_prices")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("community_settings")
          .update({ value, updated_at: new Date().toISOString() })
          .eq("key", "delivery_prices");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("community_settings")
          .insert({ key: "delivery_prices", value });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-delivery-prices"] });
      toast.success("تم حفظ أسعار التوصيل");
    },
    onError: () => toast.error("فشل الحفظ"),
  });

  const addException = () => {
    if (!newGov || newGov in exceptions) return;
    setExceptions(prev => ({ ...prev, [newGov]: newPrice }));
    setNewGov("");
    setNewPrice(5000);
  };

  const removeException = (gov: string) => {
    setExceptions(prev => {
      const next = { ...prev };
      delete next[gov];
      return next;
    });
  };

  const availableGovs = IRAQI_GOVERNORATES.filter(g => !(g in exceptions));

  if (isLoading) return null;

  return (
    <SettingCard
      icon={Truck}
      title="أسعار التوصيل"
      description="سعر التوصيل الافتراضي لطلبات المجتمع مع إمكانية تخصيص لكل محافظة. يمكن للتاجر تعديل السعر من إعدادات متجره."
      iconColor="bg-sky-500/15 text-sky-500"
    >
      <div className="space-y-3">
        {/* Default price */}
        <div className="flex items-center gap-2">
          <Label className="text-[10px] text-muted-foreground shrink-0">الافتراضي</Label>
          <Input
            type="number"
            value={defaultPrice}
            onChange={(e) => setDefaultPrice(Number(e.target.value))}
            className="h-7 text-xs flex-1"
            min={0}
            step={1000}
          />
          <span className="text-[10px] text-muted-foreground shrink-0">د.ع</span>
        </div>

        {/* Exceptions list */}
        {Object.entries(exceptions).length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">استثناءات المحافظات</Label>
            {Object.entries(exceptions).map(([gov, price]) => (
              <div key={gov} className="flex items-center gap-2 bg-muted/30 rounded-lg px-2 py-1.5">
                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-[10px] font-medium flex-1">{gov}</span>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setExceptions(prev => ({ ...prev, [gov]: Number(e.target.value) }))}
                  className="h-6 text-[10px] w-20"
                  min={0}
                  step={1000}
                />
                <span className="text-[9px] text-muted-foreground">د.ع</span>
                <button onClick={() => removeException(gov)} className="text-destructive/60 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add exception */}
        {availableGovs.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={newGov} onValueChange={setNewGov}>
              <SelectTrigger className="h-7 text-[10px] flex-1">
                <SelectValue placeholder="اختر محافظة" />
              </SelectTrigger>
              <SelectContent>
                {availableGovs.map(g => (
                  <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(Number(e.target.value))}
              className="h-7 text-[10px] w-20"
              min={0}
              step={1000}
            />
            <Button onClick={addException} disabled={!newGov} size="sm" variant="outline" className="h-7 px-2">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Save */}
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          size="sm"
          className="h-7 text-[10px] gap-1.5 w-full"
        >
          <Save className="h-3 w-3" />
          {saveMutation.isPending ? "جارٍ الحفظ..." : "حفظ أسعار التوصيل"}
        </Button>
      </div>
    </SettingCard>
  );
}

function CommissionPaymentSettings() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["commission-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("community_settings")
        .select("value")
        .eq("key", "commission_config")
        .maybeSingle();
      return (data?.value as any) || {};
    },
  });

  const [halfFee, setHalfFee] = useState(5);
  const [quarterFee, setQuarterFee] = useState(10);
  const [codFee, setCodFee] = useState(10);
  const [fixedFee, setFixedFee] = useState(0);
  const [maxDebt, setMaxDebt] = useState(10000);
  const [maxDebtDays, setMaxDebtDays] = useState(3);
  const [codEnabled, setCodEnabled] = useState(false);
  const [halfEnabled, setHalfEnabled] = useState(true);
  const [quarterEnabled, setQuarterEnabled] = useState(false);
  const [fixedEnabled, setFixedEnabled] = useState(false);
  const [initialized, setInitialized] = useState(false);

  if (config && !initialized) {
    setHalfFee(config.half_payment_fee ?? 5);
    setQuarterFee(config.quarter_payment_fee ?? 10);
    setCodFee(config.cod_merchant_fee ?? 10);
    setFixedFee(config.fixed_amount_fee ?? 0);
    setMaxDebt(config.max_debt_amount ?? 10000);
    setMaxDebtDays(config.max_debt_days ?? 3);
    setCodEnabled(config.cod_enabled ?? false);
    setHalfEnabled(config.half_payment_enabled ?? true);
    setQuarterEnabled(config.quarter_payment_enabled ?? false);
    setFixedEnabled(config.fixed_amount_enabled ?? false);
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const value = {
        half_payment_fee: halfFee,
        quarter_payment_fee: quarterFee,
        cod_merchant_fee: codFee,
        fixed_amount_fee: fixedFee,
        max_debt_amount: maxDebt,
        max_debt_days: maxDebtDays,
        cod_enabled: codEnabled,
        half_payment_enabled: halfEnabled,
        quarter_payment_enabled: quarterEnabled,
        fixed_amount_enabled: fixedEnabled,
      };

      const { data: existing } = await supabase
        .from("community_settings")
        .select("id")
        .eq("key", "commission_config")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("community_settings")
          .update({ value, updated_at: new Date().toISOString() })
          .eq("key", "commission_config");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("community_settings")
          .insert({ key: "commission_config", value });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-config"] });
      queryClient.invalidateQueries({ queryKey: ["commission-settings-full"] });
      toast.success("تم حفظ إعدادات العمولة");
    },
    onError: () => toast.error("فشل حفظ الإعدادات"),
  });

  if (isLoading) return <TabLoader />;

  return (
    <SettingCard
      icon={CreditCard}
      title="إعدادات طرق الدفع والعمولات"
      description="التحكم بخيارات الدفع والعمولات الإضافية"
      iconColor="bg-violet-500/15 text-violet-500"
    >
      <div className="space-y-4 mt-2">
        {/* Half Payment */}
        <div className="rounded-lg border border-border/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Banknote className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-bold">نصف المبلغ</span>
              <Badge variant="secondary" className="text-[8px] h-4">عمولة من العميل</Badge>
            </div>
            <Switch checked={halfEnabled} onCheckedChange={setHalfEnabled} />
          </div>
          {halfEnabled && (
            <div className="flex items-center gap-2">
              <Input type="number" value={halfFee} onChange={(e) => setHalfFee(Number(e.target.value))} className="h-7 text-xs flex-1" min={0} max={50} step={0.5} />
              <span className="text-[10px] text-muted-foreground">% إضافية</span>
            </div>
          )}
          <p className="text-[9px] text-muted-foreground">العميل يدفع 50% مقدماً + {halfFee}% عمولة، والباقي عند الاستلام</p>
        </div>

        {/* Quarter Payment */}
        <div className="rounded-lg border border-border/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Banknote className="h-3.5 w-3.5 text-purple-500" />
              <span className="text-xs font-bold">ربع المبلغ</span>
              <Badge variant="secondary" className="text-[8px] h-4">عمولة من العميل</Badge>
            </div>
            <Switch checked={quarterEnabled} onCheckedChange={setQuarterEnabled} />
          </div>
          {quarterEnabled && (
            <div className="flex items-center gap-2">
              <Input type="number" value={quarterFee} onChange={(e) => setQuarterFee(Number(e.target.value))} className="h-7 text-xs flex-1" min={0} max={50} step={0.5} />
              <span className="text-[10px] text-muted-foreground">% إضافية</span>
            </div>
          )}
          <p className="text-[9px] text-muted-foreground">العميل يدفع 25% مقدماً + {quarterFee}% عمولة، والباقي عند الاستلام</p>
        </div>

        {/* COD */}
        <div className="rounded-lg border border-border/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-xs font-bold">الدفع عند الاستلام</span>
              <Badge variant="outline" className="text-[8px] h-4 border-orange-500/30 text-orange-500">عمولة من التاجر</Badge>
            </div>
            <Switch checked={codEnabled} onCheckedChange={setCodEnabled} />
          </div>
          {codEnabled && (
            <>
              <div className="flex items-center gap-2">
                <Input type="number" value={codFee} onChange={(e) => setCodFee(Number(e.target.value))} className="h-7 text-xs flex-1" min={0} max={50} step={0.5} />
                <span className="text-[10px] text-muted-foreground">% عمولة على الزبون (تُخصم من التاجر)</span>
              </div>
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                  <span className="text-[10px] font-bold text-destructive">نظام الدين</span>
                </div>
                <p className="text-[9px] text-muted-foreground">إذا لم يكن لدى التاجر رصيد كافٍ، تُسجل العمولة كدين وتُسدد تلقائياً عند تعبئة المحفظة.</p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="space-y-1">
                    <Label className="text-[9px]">حد الدين (د.ع)</Label>
                    <Input type="number" value={maxDebt} onChange={(e) => setMaxDebt(Number(e.target.value))} className="h-6 text-[10px]" min={0} step={1000} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px]">مدة قبل الإيقاف (أيام)</Label>
                    <Input type="number" value={maxDebtDays} onChange={(e) => setMaxDebtDays(Number(e.target.value))} className="h-6 text-[10px]" min={1} max={30} />
                  </div>
                </div>
                <p className="text-[8px] text-destructive/70 mt-1">عند تجاوز {maxDebt.toLocaleString()} د.ع لمدة {maxDebtDays} أيام يتوقف حساب التاجر مؤقتاً</p>
              </div>
            </>
          )}
          <p className="text-[9px] text-muted-foreground">العميل يدفع {codFee}% عمولة إضافية عند الاستلام، وتُخصم الرسوم من رصيد التاجر (لأن الدفع خارج المنصة)</p>
        </div>

        {/* Fixed Amount */}
        <div className="rounded-lg border border-border/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-bold">مبلغ محدد</span>
              <Badge variant="secondary" className="text-[8px] h-4">عمولة ثابتة</Badge>
            </div>
            <Switch checked={fixedEnabled} onCheckedChange={setFixedEnabled} />
          </div>
          {fixedEnabled && (
            <div className="flex items-center gap-2">
              <Input type="number" value={fixedFee} onChange={(e) => setFixedFee(Number(e.target.value))} className="h-7 text-xs flex-1" min={0} step={500} />
              <span className="text-[10px] text-muted-foreground">د.ع ثابت</span>
            </div>
          )}
          <p className="text-[9px] text-muted-foreground">عمولة ثابتة بالمبلغ على كل عملية بغض النظر عن قيمة الطلب</p>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full h-8 text-xs gap-1.5"
        >
          <Save className="h-3 w-3" />
          {saveMutation.isPending ? "جارٍ الحفظ..." : "حفظ إعدادات العمولة"}
        </Button>
      </div>
    </SettingCard>
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

      {/* Commission Rate - Platform */}
      <div className="sm:col-span-2">
        <SettingCard
          icon={Percent}
          title="نسبة العمولة الأساسية (من التاجر)"
          description="تُخصم من كل عملية بيع (منتجات، طلبات، محادثات)"
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
      </div>

      {/* Payment Methods Commission Settings */}
      <div className="sm:col-span-2">
        <CommissionPaymentSettings />
      </div>

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
        description="عدد طلبات الطباعة يومياً لكل عميل"
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

      {/* Ad Slot Pricing - Full Width */}
      <div className="sm:col-span-2">
        <AdSlotPricingSettings />
      </div>

      {/* Delivery pricing is managed per-merchant from their store settings (default 5000 IQD) */}
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
        pendingRequestsRes
      ] = await Promise.all([
        supabase.from("merchant_applications").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("merchant_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("community_customer_profiles").select("id", { count: "exact", head: true }),
        supabase.from("community_print_requests").select("id", { count: "exact", head: true }),
        supabase.from("community_print_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);

      return {
        totalMerchants: merchantsRes.count ?? 0,
        pendingMerchants: pendingMerchantsRes.count ?? 0,
        totalCustomers: profilesRes.count ?? 0,
        totalRequests: requestsRes.count ?? 0,
        pendingRequests: pendingRequestsRes.count ?? 0,
      };
    },
    staleTime: 30_000,
  });

  const pendingCounts = useMemo(() => ({
    merchants: stats?.pendingMerchants ?? 0,
    requests: stats?.pendingRequests ?? 0,
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
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
                {activeTab === "assistance" && "إدارة مسابقات التجار والهدايا والكوبونات والظروف"}
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
            {activeTab === "assistance" && <AdminAssistanceManager />}
            {activeTab === "badges" && <AdminBadgeSettings embedded />}
            {activeTab === "frames" && <AdminAvatarFrames embedded />}
            {activeTab === "settings" && <CommunitySettings />}
          </Suspense>
        </div>
      </div>
    </AdminLayout>
  );
}
