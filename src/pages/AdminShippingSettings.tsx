import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Ship, Plane, Save, Loader2, Package, DollarSign, Percent, Calculator, MapPin, Trash2, Plus, Tag, Layers, Warehouse, Truck, User, ChevronDown, ChevronUp } from "lucide-react";
import { calculateShippingCost, type ShippingSettings } from "@/hooks/useShippingCalculator";
import AdminLayout, { AdminLoading } from "@/components/admin/AdminLayout";
import { IRAQI_GOVERNORATES } from "@/components/auth/signup/types";
import { cn } from "@/lib/utils";

interface ShippingSetting {
  id: string;
  setting_key: string;
  setting_value: number;
  description_ar: string | null;
}

// ─── Glassmorphism Card ───
function GlassCard({ children, className, gradient }: { children: React.ReactNode; className?: string; gradient: string }) {
  return (
    <div className={cn(
      "relative rounded-2xl border border-white/10 overflow-hidden",
      "bg-card/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)]",
      className
    )} style={{ background: gradient }}>
      {/* 3D shine effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function GlassCardHeader({ icon, title, subtitle, iconBg }: { icon: React.ReactNode; title: string; subtitle?: string; iconBg: string }) {
  return (
    <div className="p-5 pb-3 flex items-start gap-3">
      <div className={cn("p-2.5 rounded-xl shadow-lg", iconBg)} style={{ boxShadow: '0 4px 15px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.2)' }}>
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-base text-foreground">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function SettingField({ label, value, onChange, hint, icon, suffix }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string; icon?: React.ReactNode; suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
        {icon}
        {label}
      </Label>
      <div className="relative">
        <Input
          type="number"
          step="any"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="bg-background/40 border-white/10 backdrop-blur-sm focus:border-primary/50 focus:ring-primary/20 h-9 text-sm"
        />
        {suffix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{suffix}</span>}
      </div>
      {hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

// ─── Governorate Exceptions Section ───
function GovernorateExceptionsSection() {
  const queryClient = useQueryClient();
  const [newGov, setNewGov] = useState("");
  const [newPrice, setNewPrice] = useState<number>(0);

  const { data: exceptions = [] } = useQuery({
    queryKey: ["delivery-gov-exceptions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("delivery_governorate_exceptions").select("*").order("governorate");
      if (error) throw error;
      return data;
    },
  });

  const addException = useMutation({
    mutationFn: async () => {
      if (!newGov || newPrice <= 0) throw new Error("أدخل المحافظة والسعر");
      const { error } = await supabase.from("delivery_governorate_exceptions").insert({ governorate: newGov, delivery_price: newPrice });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-gov-exceptions"] });
      setNewGov("");
      setNewPrice(0);
      toast.success("تمت إضافة الاستثناء");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteException = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("delivery_governorate_exceptions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-gov-exceptions"] });
      toast.success("تم حذف الاستثناء");
    },
  });

  const usedGovs = exceptions.map((e: any) => e.governorate);
  const availableGovs = IRAQI_GOVERNORATES.filter((g) => !usedGovs.includes(g));

  return (
    <div className="space-y-3">
      {/* Existing exceptions */}
      {exceptions.length > 0 && (
        <div className="space-y-2">
          {exceptions.map((exc: any) => (
            <div key={exc.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-background/30 border border-white/5 backdrop-blur-sm group">
              <MapPin className="h-3.5 w-3.5 text-primary/70 shrink-0" />
              <span className="text-xs font-medium flex-1">{exc.governorate}</span>
              <span className="text-xs font-bold text-primary">{Number(exc.delivery_price).toLocaleString()} د.ع</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                onClick={() => deleteException.mutate(exc.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new exception */}
      <div className="flex items-end gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
        <div className="flex-1 space-y-1">
          <Label className="text-[10px] text-muted-foreground">المحافظة</Label>
          <Select value={newGov} onValueChange={setNewGov}>
            <SelectTrigger className="h-8 text-xs bg-background/50 border-white/10">
              <SelectValue placeholder="اختر محافظة" />
            </SelectTrigger>
            <SelectContent>
              {availableGovs.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-28 space-y-1">
          <Label className="text-[10px] text-muted-foreground">السعر (د.ع)</Label>
          <Input
            type="number"
            value={newPrice || ''}
            onChange={(e) => setNewPrice(Number(e.target.value))}
            className="h-8 text-xs bg-background/50 border-white/10"
            placeholder="5000"
          />
        </div>
        <Button
          size="sm"
          className="h-8 px-3 gap-1 text-xs"
          onClick={() => addException.mutate()}
          disabled={!newGov || newPrice <= 0}
        >
          <Plus className="h-3 w-3" />
          إضافة
        </Button>
      </div>
    </div>
  );
}

// ─── Category Exceptions Section ───
function CategoryExceptionsSection() {
  const queryClient = useQueryClient();
  const [newCat, setNewCat] = useState("");
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newGov, setNewGov] = useState<string>("all");

  const { data: categories = [] } = useQuery({
    queryKey: ["categories-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name_ar").order("name_ar");
      if (error) throw error;
      return data;
    },
  });

  const { data: exceptions = [] } = useQuery({
    queryKey: ["delivery-cat-exceptions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("delivery_category_exceptions").select("*, categories(name_ar)").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const addException = useMutation({
    mutationFn: async () => {
      if (!newCat || newPrice <= 0) throw new Error("أدخل القسم والسعر");
      const { error } = await supabase.from("delivery_category_exceptions").insert({
        category_id: newCat,
        delivery_price: newPrice,
        governorate: newGov === "all" ? null : newGov,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-cat-exceptions"] });
      setNewCat("");
      setNewPrice(0);
      setNewGov("all");
      toast.success("تمت إضافة استثناء القسم");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteException = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("delivery_category_exceptions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-cat-exceptions"] });
      toast.success("تم حذف الاستثناء");
    },
  });

  return (
    <div className="space-y-3">
      {exceptions.length > 0 && (
        <div className="space-y-2">
          {exceptions.map((exc: any) => (
            <div key={exc.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-background/30 border border-white/5 backdrop-blur-sm group">
              <Tag className="h-3.5 w-3.5 text-amber-500/70 shrink-0" />
              <span className="text-xs font-medium flex-1">
                {exc.categories?.name_ar || 'قسم محذوف'}
                {exc.governorate && <span className="text-muted-foreground mr-1">({exc.governorate})</span>}
              </span>
              <span className="text-xs font-bold text-amber-500">{Number(exc.delivery_price).toLocaleString()} د.ع</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                onClick={() => deleteException.mutate(exc.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new category exception */}
      <div className="flex flex-wrap items-end gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
        <div className="flex-1 min-w-[140px] space-y-1">
          <Label className="text-[10px] text-muted-foreground">القسم</Label>
          <Select value={newCat} onValueChange={setNewCat}>
            <SelectTrigger className="h-8 text-xs bg-background/50 border-white/10">
              <SelectValue placeholder="اختر قسم" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name_ar}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-28 space-y-1">
          <Label className="text-[10px] text-muted-foreground">المحافظة (اختياري)</Label>
          <Select value={newGov} onValueChange={setNewGov}>
            <SelectTrigger className="h-8 text-xs bg-background/50 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              {IRAQI_GOVERNORATES.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-24 space-y-1">
          <Label className="text-[10px] text-muted-foreground">السعر (د.ع)</Label>
          <Input
            type="number"
            value={newPrice || ''}
            onChange={(e) => setNewPrice(Number(e.target.value))}
            className="h-8 text-xs bg-background/50 border-white/10"
            placeholder="12000"
          />
        </div>
        <Button
          size="sm"
          className="h-8 px-3 gap-1 text-xs bg-amber-500 hover:bg-amber-600 text-white"
          onClick={() => addException.mutate()}
          disabled={!newCat || newPrice <= 0}
        >
          <Plus className="h-3 w-3" />
          إضافة
        </Button>
      </div>
    </div>
  );
}

// ─── Formula Card ───
function FormulaCard({ icon, title, formula, color }: { icon: React.ReactNode; title: string; formula: string[]; color: string }) {
  return (
    <div className="p-3 rounded-xl bg-background/20 border border-white/5 backdrop-blur-sm space-y-2">
      <div className="flex items-center gap-2">
        <div className={cn("p-1 rounded-lg", color)}>
          {icon}
        </div>
        <span className="text-xs font-bold">{title}</span>
      </div>
      <div className="space-y-0.5">
        {formula.map((line, i) => (
          <p key={i} className="text-[10px] text-muted-foreground font-mono leading-relaxed" dir="ltr">{line}</p>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───
export default function AdminShippingSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const [settings, setSettings] = useState<Record<string, number>>({
    sea_cbm_price: 350000,
    sea_padding_cm: 5,
    air_usa_kg_price: 30000,
    air_usa_weight_buffer_percent: 20,
    air_china_volumetric_price: 15000,
    air_china_volumetric_divider: 5000,
    air_china_weight_safety_margin: 20,
    commission_fee: 1000,
    local_delivery_baghdad: 6000,
    local_delivery_provinces: 5000,
    usd_to_iqd_rate: 1410,
  });

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) { navigate("/auth"); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").single();
      if (!data) { navigate("/"); toast.error("غير مصرح لك بالوصول"); }
    };
    checkAdmin();
  }, [user, navigate]);

  const { data: shippingSettings, isLoading } = useQuery({
    queryKey: ["shipping-settings-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shipping_settings").select("*");
      if (error) throw error;
      return data as ShippingSetting[];
    },
  });

  useEffect(() => {
    if (shippingSettings) {
      const newSettings: Record<string, number> = {};
      shippingSettings.forEach((s) => { newSettings[s.setting_key] = Number(s.setting_value); });
      setSettings((prev) => ({ ...prev, ...newSettings }));
    }
  }, [shippingSettings]);

  const recalculateProductPrices = async (newSettings: Record<string, number>) => {
    const shippingSettingsObj: ShippingSettings = {
      sea_cbm_price: newSettings.sea_cbm_price ?? 350000,
      sea_padding_cm: newSettings.sea_padding_cm ?? 5,
      air_usa_kg_price: newSettings.air_usa_kg_price ?? 30000,
      air_usa_weight_buffer_percent: newSettings.air_usa_weight_buffer_percent ?? 20,
      air_china_volumetric_price: newSettings.air_china_volumetric_price ?? 15000,
      air_china_volumetric_divider: newSettings.air_china_volumetric_divider ?? 5000,
      air_china_weight_safety_margin: newSettings.air_china_weight_safety_margin ?? 20,
      commission_fee: newSettings.commission_fee ?? 1000,
      local_delivery_baghdad: newSettings.local_delivery_baghdad ?? 6000,
      local_delivery_provinces: newSettings.local_delivery_provinces ?? 5000,
      usd_to_iqd_rate: newSettings.usd_to_iqd_rate ?? 1410,
    };
    const rate = shippingSettingsObj.usd_to_iqd_rate;
    const roundUpTo250 = (v: number) => Math.ceil(v / 250) * 250;

    // Fetch all products that have price_usd
    const { data: products, error } = await supabase
      .from('products')
      .select('id, price_usd, original_price_usd, length_cm, width_cm, height_cm, weight_kg, shipping_type, has_pre_order, has_in_stock, commission_sea_iqd, commission_air_iqd, commission_direct_iqd, other_costs_iqd, round_up_price, colors')
      .not('price_usd', 'is', null)
      .gt('price_usd', 0);
    
    if (error || !products?.length) return 0;

    let updated = 0;
    for (const p of products) {
      const priceUsd = p.price_usd!;
      const priceIqd = Math.round(priceUsd * rate);
      const commissionSeaIqd = p.commission_sea_iqd || 0;
      const commissionAirIqd = p.commission_air_iqd || 0;
      const commissionDirectIqd = p.commission_direct_iqd || 0;
      const otherCostsIqd = p.other_costs_iqd || 0;
      const shippingType = p.shipping_type || 'sea';
      const hasPreOrder = p.has_pre_order ?? false;
      const hasInStock = p.has_in_stock ?? false;
      const shouldRoundUp = p.round_up_price ?? false;

      const dims = (p.length_cm || p.width_cm || p.height_cm)
        ? { length: p.length_cm || 0, width: p.width_cm || 0, height: p.height_cm || 0 } : null;

      const prices: number[] = [];
      const updates: Record<string, any> = {};

      if (hasPreOrder) {
        if (shippingType === 'sea' || shippingType === 'both') {
          const seaCalc = calculateShippingCost('china', 'sea', dims, null, shippingSettingsObj);
          updates.sea_price = priceIqd + seaCalc.shippingCost + commissionSeaIqd;
          updates.shipping_cost_iqd = seaCalc.shippingCost;
        }
        if (shippingType === 'air' || shippingType === 'both') {
          const weightKg = p.weight_kg || 0;
          const airCalc = calculateShippingCost('china', 'air', dims, weightKg > 0 ? weightKg : null, shippingSettingsObj);
          updates.air_price = priceIqd + airCalc.shippingCost + commissionAirIqd;
          if (!updates.shipping_cost_iqd) updates.shipping_cost_iqd = airCalc.shippingCost;
        }
      }

      if (hasInStock) {
        updates.direct_sale_price = priceIqd + otherCostsIqd + commissionDirectIqd;
      }

      if (shouldRoundUp) {
        if (updates.sea_price) updates.sea_price = roundUpTo250(updates.sea_price);
        if (updates.air_price) updates.air_price = roundUpTo250(updates.air_price);
        if (updates.direct_sale_price) updates.direct_sale_price = roundUpTo250(updates.direct_sale_price);
      }

      // Collect prices
      if (updates.sea_price) prices.push(updates.sea_price);
      if (updates.air_price) prices.push(updates.air_price);
      if (updates.direct_sale_price) prices.push(updates.direct_sale_price);

      if (prices.length > 0) {
        updates.price = Math.min(...prices);
      }

      // Pre-order shipping options
      if (shippingType === 'both' && updates.sea_price && updates.air_price) {
        const basePreOrderPrice = Math.min(updates.sea_price, updates.air_price);
        updates.pre_order_shipping_options = [
          { name_ar: 'شحن بحري', price_adjustment: updates.sea_price - basePreOrderPrice },
          { name_ar: 'شحن جوي', price_adjustment: updates.air_price - basePreOrderPrice },
        ];
      }

      // Recalculate original_price
      const origUsd = p.original_price_usd;
      if (origUsd && origUsd > 0) {
        const origPriceIqd = Math.round(origUsd * rate);
        if (hasInStock) {
          updates.original_price = origPriceIqd + otherCostsIqd + commissionDirectIqd;
        } else if (hasPreOrder && (shippingType === 'sea' || shippingType === 'both')) {
          const seaCalc2 = calculateShippingCost('china', 'sea', dims, null, shippingSettingsObj);
          updates.original_price = origPriceIqd + seaCalc2.shippingCost + commissionSeaIqd;
        } else if (hasPreOrder && shippingType === 'air') {
          const airCalc2 = calculateShippingCost('china', 'air', dims, (p.weight_kg || 0) > 0 ? p.weight_kg : null, shippingSettingsObj);
          updates.original_price = origPriceIqd + airCalc2.shippingCost + commissionAirIqd;
        }
        if (shouldRoundUp && updates.original_price) {
          updates.original_price = roundUpTo250(updates.original_price);
        }
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase.from('products').update(updates).eq('id', p.id);
        if (!updateError) updated++;
      }
    }
    return updated;
  };

  const saveSettings = useMutation({
    mutationFn: async () => {
      setIsSaving(true);
      const updates = Object.entries(settings).map(([key, value]) => ({ setting_key: key, setting_value: value }));
      for (const update of updates) {
        const { error } = await supabase.from("shipping_settings").update({ setting_value: update.setting_value }).eq("setting_key", update.setting_key);
        if (error) throw error;
      }
      // Recalculate all product prices with new settings
      const updatedCount = await recalculateProductPrices(settings);
      return updatedCount;
    },
    onSuccess: (updatedCount) => {
      queryClient.invalidateQueries({ queryKey: ["shipping-settings-admin"] });
      queryClient.invalidateQueries({ queryKey: ["shipping-settings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success(`تم حفظ الإعدادات وتحديث أسعار ${updatedCount} منتج`);
      setIsSaving(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ");
      setIsSaving(false);
    },
  });

  const updateSetting = (key: string, value: number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) return <AdminLoading />;

  return (
    <AdminLayout
      title="إعدادات الشحن"
      description="إدارة أسعار الشحن والتوصيل والاستثناءات"
      icon={<Package className="h-5 w-5" />}
      actions={
        <Button
          onClick={() => saveSettings.mutate()}
          disabled={isSaving}
          className="gap-2 bg-gradient-to-b from-primary to-primary/80 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
          style={{ boxShadow: '0 4px 15px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.15)' }}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          حفظ الإعدادات
        </Button>
      }
    >
      <div className="space-y-5">
        {/* ═══ Row 1: Sea + Air USA ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Sea Shipping */}
          <GlassCard gradient="linear-gradient(145deg, hsl(210 80% 55% / 0.08), hsl(190 70% 50% / 0.04), transparent)">
            <GlassCardHeader
              icon={<Ship className="h-5 w-5 text-white" />}
              iconBg="bg-gradient-to-br from-blue-500 to-cyan-500"
              title="الشحن البحري"
              subtitle="من الصين - بالمتر المكعب"
            />
            <div className="px-5 pb-5 grid grid-cols-2 gap-4">
              <SettingField
                label="سعر CBM"
                icon={<DollarSign className="h-3 w-3" />}
                value={settings.sea_cbm_price}
                onChange={(v) => updateSetting("sea_cbm_price", v)}
                hint={`${settings.sea_cbm_price.toLocaleString()} د.ع/CBM`}
                suffix="د.ع"
              />
              <SettingField
                label="هامش التغليف"
                icon={<Calculator className="h-3 w-3" />}
                value={settings.sea_padding_cm}
                onChange={(v) => updateSetting("sea_padding_cm", v)}
                hint={`+${settings.sea_padding_cm} سم لكل بُعد`}
                suffix="سم"
              />
            </div>
          </GlassCard>

          {/* Air USA */}
          <GlassCard gradient="linear-gradient(145deg, hsl(270 60% 55% / 0.08), hsl(300 50% 50% / 0.04), transparent)">
            <GlassCardHeader
              icon={<Plane className="h-5 w-5 text-white" />}
              iconBg="bg-gradient-to-br from-purple-500 to-pink-500"
              title="الجوي - أمريكا"
              subtitle="بالكيلوغرام مع هامش الوزن"
            />
            <div className="px-5 pb-5 grid grid-cols-2 gap-4">
              <SettingField
                label="سعر الكيلو"
                icon={<DollarSign className="h-3 w-3" />}
                value={settings.air_usa_kg_price}
                onChange={(v) => updateSetting("air_usa_kg_price", v)}
                hint={`${settings.air_usa_kg_price.toLocaleString()} د.ع/كغ`}
                suffix="د.ع"
              />
              <SettingField
                label="نسبة الاحتياط"
                icon={<Percent className="h-3 w-3" />}
                value={settings.air_usa_weight_buffer_percent}
                onChange={(v) => updateSetting("air_usa_weight_buffer_percent", v)}
                hint={`+${settings.air_usa_weight_buffer_percent}% وزن إضافي`}
                suffix="%"
              />
            </div>
          </GlassCard>
        </div>

        {/* ═══ Row 2: Air China ═══ */}
        <GlassCard gradient="linear-gradient(145deg, hsl(25 80% 55% / 0.08), hsl(40 70% 50% / 0.04), transparent)">
          <GlassCardHeader
            icon={<Plane className="h-5 w-5 text-white" />}
            iconBg="bg-gradient-to-br from-orange-500 to-amber-500"
            title="الجوي - الصين"
            subtitle="بالوزن الحجمي أو الفعلي (الأكبر)"
          />
          <div className="px-5 pb-4 grid grid-cols-3 gap-4">
            <SettingField
              label="سعر الكيلو"
              icon={<DollarSign className="h-3 w-3" />}
              value={settings.air_china_volumetric_price}
              onChange={(v) => updateSetting("air_china_volumetric_price", v)}
              suffix="د.ع"
            />
            <SettingField
              label="مقسوم الحجمي"
              icon={<Calculator className="h-3 w-3" />}
              value={settings.air_china_volumetric_divider}
              onChange={(v) => updateSetting("air_china_volumetric_divider", v)}
              hint={`÷ ${settings.air_china_volumetric_divider}`}
            />
            <SettingField
              label="نسبة الاحتياط"
              icon={<Percent className="h-3 w-3" />}
              value={settings.air_china_weight_safety_margin}
              onChange={(v) => updateSetting("air_china_weight_safety_margin", v)}
              suffix="%"
            />
          </div>
          <div className="mx-5 mb-5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-[10px] text-amber-200/80">
              <strong>ملاحظة:</strong> يُستخدم الوزن الأكبر (حجمي أو فعلي) ثم يُضاف الاحتياط
            </p>
          </div>
        </GlassCard>

        {/* ═══ Row 3: Currency + General ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Currency */}
          <GlassCard gradient="linear-gradient(145deg, hsl(145 60% 45% / 0.08), hsl(160 50% 40% / 0.04), transparent)">
            <GlassCardHeader
              icon={<DollarSign className="h-5 w-5 text-white" />}
              iconBg="bg-gradient-to-br from-emerald-500 to-green-600"
              title="سعر الصرف"
              subtitle="دولار → دينار عراقي"
            />
            <div className="px-5 pb-5">
              <SettingField
                label="سعر الدولار"
                icon={<DollarSign className="h-3 w-3" />}
                value={settings.usd_to_iqd_rate}
                onChange={(v) => updateSetting("usd_to_iqd_rate", v)}
                hint={`1$ = ${settings.usd_to_iqd_rate.toLocaleString()} د.ع`}
                suffix="د.ع"
              />
            </div>
          </GlassCard>

          {/* Commission */}
          <GlassCard gradient="linear-gradient(145deg, hsl(var(--primary) / 0.08), hsl(var(--primary) / 0.03), transparent)">
            <GlassCardHeader
              icon={<Package className="h-5 w-5 text-white" />}
              iconBg="bg-gradient-to-br from-primary to-accent"
              title="العمولة"
              subtitle="تظهر منفصلة عن تكلفة الشحن"
            />
            <div className="px-5 pb-5">
              <SettingField
                label="عمولتنا"
                icon={<DollarSign className="h-3 w-3" />}
                value={settings.commission_fee}
                onChange={(v) => updateSetting("commission_fee", v)}
                hint="تظهر باسم 'عمولتنا' للزبون"
                suffix="د.ع"
              />
            </div>
          </GlassCard>
        </div>

        {/* ═══ Row 4: Local Delivery + Governorate Exceptions ═══ */}
        <GlassCard gradient="linear-gradient(145deg, hsl(200 70% 50% / 0.08), hsl(220 60% 45% / 0.04), transparent)">
          <GlassCardHeader
            icon={<MapPin className="h-5 w-5 text-white" />}
            iconBg="bg-gradient-to-br from-sky-500 to-blue-600"
            title="التوصيل المحلي"
            subtitle="أسعار التوصيل الافتراضية مع استثناءات لكل محافظة"
          />
          <div className="px-5 pb-4">
            <div className="grid grid-cols-2 gap-4 mb-5">
              <SettingField
                label="بغداد"
                icon={<MapPin className="h-3 w-3" />}
                value={settings.local_delivery_baghdad}
                onChange={(v) => updateSetting("local_delivery_baghdad", v)}
                suffix="د.ع"
              />
              <SettingField
                label="باقي المحافظات"
                icon={<MapPin className="h-3 w-3" />}
                value={settings.local_delivery_provinces}
                onChange={(v) => updateSetting("local_delivery_provinces", v)}
                suffix="د.ع"
              />
            </div>

            {/* Governorate exceptions */}
            <div className="border-t border-white/5 pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-sky-400" />
                <h4 className="text-sm font-bold">استثناءات المحافظات</h4>
                <span className="text-[10px] text-muted-foreground">(تجاوز السعر الافتراضي)</span>
              </div>
              <GovernorateExceptionsSection />
            </div>
          </div>
        </GlassCard>

        {/* ═══ Row 5: Category Exceptions ═══ */}
        <GlassCard gradient="linear-gradient(145deg, hsl(35 80% 50% / 0.08), hsl(45 70% 45% / 0.04), transparent)">
          <GlassCardHeader
            icon={<Tag className="h-5 w-5 text-white" />}
            iconBg="bg-gradient-to-br from-amber-500 to-orange-500"
            title="استثناءات حسب القسم"
            subtitle="أسعار توصيل مخصصة لأقسام معينة (مثل الطابعات)"
          />
          <div className="px-5 pb-5">
            <CategoryExceptionsSection />
          </div>
        </GlassCard>

        {/* ═══ Row 6: Formulas ═══ */}
        <GlassCard gradient="linear-gradient(145deg, hsl(var(--muted) / 0.5), transparent)" className="border-white/5">
          <div className="p-5 pb-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              معادلات الحساب
            </h3>
          </div>
          <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormulaCard
              icon={<Ship className="h-3.5 w-3.5 text-blue-400" />}
              title="بحري - الصين"
              color="bg-blue-500/15"
              formula={[
                `CBM = (L+${settings.sea_padding_cm}) × (W+${settings.sea_padding_cm}) × (H+${settings.sea_padding_cm}) ÷ 1,000,000`,
                `Cost = CBM × ${settings.sea_cbm_price.toLocaleString()} + ${settings.commission_fee.toLocaleString()}`,
              ]}
            />
            <FormulaCard
              icon={<Plane className="h-3.5 w-3.5 text-purple-400" />}
              title="جوي - أمريكا"
              color="bg-purple-500/15"
              formula={[
                `Weight = W × (1 + ${settings.air_usa_weight_buffer_percent}%)`,
                `Cost = Weight × ${settings.air_usa_kg_price.toLocaleString()} + ${settings.commission_fee.toLocaleString()}`,
              ]}
            />
            <FormulaCard
              icon={<Plane className="h-3.5 w-3.5 text-orange-400" />}
              title="جوي - الصين"
              color="bg-orange-500/15"
              formula={[
                `Vol = (L+${settings.sea_padding_cm})(W+${settings.sea_padding_cm})(H+${settings.sea_padding_cm}) ÷ ${settings.air_china_volumetric_divider}`,
                `Used = max(Vol, Actual) × (1 + ${settings.air_china_weight_safety_margin}%)`,
                `Cost = Used × ${settings.air_china_volumetric_price.toLocaleString()}`,
              ]}
            />
            <FormulaCard
              icon={<DollarSign className="h-3.5 w-3.5 text-green-400" />}
              title="تحويل العملة"
              color="bg-green-500/15"
              formula={[
                `Price (IQD) = Price (USD) × ${settings.usd_to_iqd_rate.toLocaleString()}`,
              ]}
            />
          </div>
        </GlassCard>
      </div>
    </AdminLayout>
  );
}
