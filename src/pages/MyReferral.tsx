import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Copy, Check, Share2, Crown, Users, Coins, Calendar, Wallet, Pencil, Loader2, Gift, TrendingUp, Palette, Save, ChevronDown } from "lucide-react";
import { useVipPlusStatus } from "@/hooks/useVipPlus";
import { formatPrice } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { REFERRAL_BANNER_STYLES, getReferralBannerStyle, type ReferralBannerStyleKey } from "@/lib/referralBannerStyles";

export default function MyReferral() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: vipStatus, isLoading: vipLoading } = useVipPlusStatus(user?.id);

  const [coupon, setCoupon] = useState<any>(null);
  const [usages, setUsages] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCode, setEditingCode] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [freeDeliveryMin, setFreeDeliveryMin] = useState<number>(100000);
  const [customMessage, setCustomMessage] = useState<string>("");
  const [bannerStyle, setBannerStyle] = useState<ReferralBannerStyleKey>("amber");
  const [savingCustom, setSavingCustom] = useState(false);
  const [customizationOpen, setCustomizationOpen] = useState(false);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);

    // Load free delivery min order setting
    const { data: settingsRow } = await supabase
      .from("default_settings")
      .select("setting_value")
      .eq("setting_key", "referral_settings")
      .maybeSingle();
    const minOrder = Number((settingsRow?.setting_value as any)?.free_delivery_min_order_iqd) || 100000;
    setFreeDeliveryMin(minOrder);

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, full_name")
      .eq("id", user.id)
      .single();

    const { data: existing } = await supabase
      .from("referral_coupons")
      .select("*")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    let activeCoupon = existing;

    if (!existing && vipStatus?.isVipPlus) {
      const baseCode = (profile?.username || `vip_${user.id.slice(0, 6)}`).toLowerCase().replace(/[^a-z0-9_]/g, "");
      const { data: created, error } = await supabase
        .from("referral_coupons")
        .insert({
          owner_user_id: user.id,
          code: baseCode,
          is_active: true,
          expires_at: vipStatus.expiresAt,
        })
        .select("*")
        .single();
      if (!error) activeCoupon = created;
    }

    setCoupon(activeCoupon);
    setNewCode(activeCoupon?.code || "");
    setCustomMessage((activeCoupon as any)?.custom_message || "");
    setBannerStyle(((activeCoupon as any)?.banner_style as ReferralBannerStyleKey) || "amber");

    if (activeCoupon) {
      const { data: u } = await supabase
        .from("referral_coupon_usages")
        .select("*")
        .eq("coupon_id", activeCoupon.id)
        .order("created_at", { ascending: false });
      setUsages(u || []);

      const { data: w } = await supabase
        .from("referral_earnings_withdrawals")
        .select("*")
        .eq("owner_user_id", user.id)
        .order("requested_at", { ascending: false });
      setWithdrawals(w || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!vipLoading) loadData();
  }, [user?.id, vipLoading, vipStatus?.isVipPlus]);

  const stats = useMemo(() => {
    const confirmed = usages.filter((u) => u.status !== "cancelled");
    const totalEarnings = confirmed.reduce((s, u) => s + Number(u.owner_earnings_iqd || 0), 0);
    const paidOut = withdrawals
      .filter((w) => w.status === "paid")
      .reduce((s, w) => s + Number(w.amount_iqd || 0), 0);
    const pendingWithdraw = withdrawals
      .filter((w) => w.status === "pending")
      .reduce((s, w) => s + Number(w.amount_iqd || 0), 0);
    const available = Math.max(0, totalEarnings - paidOut - pendingWithdraw);
    return {
      uses: confirmed.length,
      totalEarnings,
      available,
      paidOut,
      pendingWithdraw,
    };
  }, [usages, withdrawals]);

  const copyLink = () => {
    if (!coupon?.code) return;
    const link = `${window.location.origin}/?refcode=${coupon.code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("تم نسخ رابط الإحالة");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareCode = async () => {
    if (!coupon?.code) return;
    const link = `${window.location.origin}/?refcode=${coupon.code}`;
    const text = `استخدم كود الإحالة (${coupon.code}) للحصول على توصيل مجاني! ${link}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "كود إحالة", text, url: link });
      } else {
        navigator.clipboard.writeText(text);
        toast.success("تم نسخ الرسالة");
      }
    } catch {}
  };

  const saveCode = async () => {
    if (!coupon?.id) return;
    const sanitized = newCode.toLowerCase().trim().replace(/[^a-z0-9_]/g, "");
    if (sanitized.length < 3) {
      toast.error("الكود قصير جداً (3 أحرف على الأقل)");
      return;
    }
    setCreating(true);
    const { error } = await supabase
      .from("referral_coupons")
      .update({ code: sanitized })
      .eq("id", coupon.id);
    setCreating(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "هذا الكود مستخدم" : "فشل التحديث");
      return;
    }
    toast.success("تم تحديث الكود");
    setEditingCode(false);
    loadData();
  };

  const saveCustomization = async () => {
    if (!coupon?.id) return;
    if (customMessage.length > 140) {
      toast.error("الرسالة طويلة جداً (الحد الأقصى 140 حرفاً)");
      return;
    }
    setSavingCustom(true);
    const { error } = await supabase
      .from("referral_coupons")
      .update({
        custom_message: customMessage.trim() || null,
        banner_style: bannerStyle,
      } as any)
      .eq("id", coupon.id);
    setSavingCustom(false);
    if (error) {
      toast.error("فشل حفظ التخصيص");
      return;
    }
    toast.success("تم حفظ التخصيص");
    loadData();
  };

  const requestWithdraw = async () => {
    if (stats.available <= 0) {
      toast.error("لا يوجد رصيد قابل للسحب");
      return;
    }
    setWithdrawing(true);
    const { error } = await supabase.from("referral_earnings_withdrawals").insert({
      owner_user_id: user!.id,
      amount_iqd: stats.available,
      status: "pending",
    });
    setWithdrawing(false);
    if (error) {
      toast.error("فشل إرسال الطلب");
      return;
    }
    toast.success("تم إرسال طلب السحب — سيتم مراجعته من قبل الإدارة");
    loadData();
  };

  if (!user) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <Card><CardContent className="p-6 text-center">يجب تسجيل الدخول</CardContent></Card>
      </div>
    );
  }

  if (vipLoading || loading) {
    return (
      <div className="container mx-auto p-4 max-w-3xl space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!vipStatus?.isVipPlus) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <Card className="border-2 border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              ميزة حصرية لبطاقة Levo VIP Plus
            </CardTitle>
            <CardDescription>
              نظام كود الإحالة الشخصي متاح فقط لأصحاب بطاقة VIP Plus. اشترك الآن لتفعيل كودك الخاص والحصول على عمولة من كل عملية بيع.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/rewards?tab=cards")} className="w-full">
              عرض البطاقات
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expiresAt = coupon?.expires_at ? new Date(coupon.expires_at) : null;

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-5 pb-24">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-6 shadow-2xl">
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-white">
              <Crown className="h-5 w-5" />
              <span className="text-sm font-semibold tracking-wide">LEVO VIP PLUS — كود الإحالة</span>
            </div>
            <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm">
              {coupon?.is_active ? "نشط" : "موقوف"}
            </Badge>
          </div>

          <div className="bg-white/15 backdrop-blur-md rounded-2xl p-4 border border-white/20">
            <p className="text-xs text-white/80 mb-1">الكود الخاص بك</p>
            {!editingCode ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-3xl font-bold text-white tracking-wider font-mono uppercase truncate">
                  {coupon?.code || "—"}
                </p>
                <div className="flex gap-1.5">
                  <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 h-9 w-9" onClick={() => setEditingCode(true)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 h-9 w-9" onClick={copyLink}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 h-9 w-9" onClick={shareCode}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="bg-white/90 text-foreground font-mono uppercase"
                  maxLength={20}
                />
                <Button onClick={saveCode} disabled={creating} size="sm">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
                </Button>
                <Button onClick={() => { setEditingCode(false); setNewCode(coupon?.code || ""); }} variant="ghost" size="sm" className="text-white hover:bg-white/20">إلغاء</Button>
              </div>
            )}
            {expiresAt && (
              <p className="text-[11px] text-white/70 mt-2 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                ينتهي في {expiresAt.toLocaleDateString("ar-IQ")}
              </p>
            )}
          </div>
        </div>
      </div>

      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Gift className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <p className="font-bold text-foreground mb-1">شروط التوصيل المجاني</p>
            <p className="text-muted-foreground">
              كودك يمنح أصدقاءك <span className="font-bold text-amber-600">توصيلاً مجانياً</span> عند الطلبات التي يبلغ مجموعها <span className="font-bold text-foreground">{formatPrice(freeDeliveryMin)} د.ع</span> فأكثر.
              في جميع الحالات أنت تحصل على عمولتك من كل منتج باعه عبر كودك.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Customization Card */}
      <Card className="border-primary/20">
        <button
          type="button"
          onClick={() => setCustomizationOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-right"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Palette className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-sm font-semibold truncate">تخصيص بطاقة الكوبون</span>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${customizationOpen ? "rotate-180" : ""}`} />
        </button>
        {customizationOpen && (
        <CardContent className="space-y-3 px-3 pb-3 pt-0">
          {/* Message */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-foreground">رسالتك للمشتري</label>
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value.slice(0, 140))}
              placeholder="مثال: شكراً لاختيارك كودي! 💛"
              className="resize-none text-xs min-h-0 py-1.5"
              rows={2}
            />
            <p className="text-[9px] text-muted-foreground text-left">{customMessage.length}/140</p>
          </div>

          {/* Style picker */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-foreground">خلفية البطاقة</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {Object.values(REFERRAL_BANNER_STYLES).map((style) => {
                const selected = bannerStyle === style.key;
                return (
                  <button
                    key={style.key}
                    type="button"
                    onClick={() => setBannerStyle(style.key)}
                    className={`relative rounded-md p-1.5 text-right transition-all ${style.container} ${
                      selected ? "ring-2 ring-primary" : "ring-1 ring-border/40"
                    }`}
                  >
                    <p className={`text-[10px] font-bold truncate ${style.title}`}>{style.label}</p>
                    <div className={`mt-1 h-1 rounded-full ${style.progressTrack} overflow-hidden`}>
                      <div className={`h-full w-2/3 ${style.progressFill}`} />
                    </div>
                    {selected && (
                      <Check className="absolute top-0.5 left-0.5 h-3 w-3 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live preview */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-foreground">معاينة</label>
            {(() => {
              const s = getReferralBannerStyle(bannerStyle);
              return (
                <div className={`rounded-lg ${s.container} ${s.border} p-2 space-y-1.5`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🎁</span>
                    <div className="min-w-0">
                      <p className={`text-[11px] font-bold ${s.title} truncate`}>
                        {customMessage.trim() || `شكراً لدعمك @${coupon?.code || "you"}!`}
                      </p>
                      <p className="text-[10px] text-emerald-600 font-semibold">✅ توصيل مجاني</p>
                    </div>
                  </div>
                  <div className={`h-1.5 rounded-full ${s.progressTrack} overflow-hidden`}>
                    <div className={`h-full w-3/4 ${s.progressFill}`} />
                  </div>
                </div>
              );
            })()}
          </div>

          <Button onClick={saveCustomization} disabled={savingCustom} size="sm" className="w-full h-8 text-xs">
            {savingCustom ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-2" /> : <Save className="h-3.5 w-3.5 ml-2" />}
            حفظ التخصيص
          </Button>
        </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="عدد الاستخدامات" value={stats.uses.toLocaleString()} color="text-blue-600" />
        <StatCard icon={TrendingUp} label="إجمالي الأرباح" value={`${formatPrice(stats.totalEarnings)} د.ع`} color="text-emerald-600" />
        <StatCard icon={Wallet} label="الرصيد القابل للسحب" value={`${formatPrice(stats.available)} د.ع`} color="text-amber-600" />
        <StatCard icon={Coins} label="مسحوب سابقاً" value={`${formatPrice(stats.paidOut)} د.ع`} color="text-purple-600" />
      </div>

      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold">سحب الأرباح</p>
            <p className="text-xs text-muted-foreground">سيتم تحويل الرصيد إلى محفظتك بعد موافقة الإدارة</p>
            {stats.pendingWithdraw > 0 && (
              <p className="text-[11px] text-amber-600 mt-1">طلب قيد المراجعة: {formatPrice(stats.pendingWithdraw)} د.ع</p>
            )}
          </div>
          <Button onClick={requestWithdraw} disabled={withdrawing || stats.available <= 0}>
            {withdrawing ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Wallet className="h-4 w-4 ml-2" />}
            سحب {formatPrice(stats.available)} د.ع
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            سجل استخدام الكود ({usages.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">لم يستخدم أحد كودك بعد. شاركه مع أصدقائك!</p>
          ) : (
            <div className="space-y-2">
              {usages.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className="text-xs">
                    <p className="font-medium">{new Date(u.created_at).toLocaleDateString("ar-IQ")}</p>
                    <p className="text-muted-foreground">توصيل مهدى: {formatPrice(Number(u.delivery_discount_iqd || 0))} د.ع</p>
                    <Badge variant="outline" className="text-[10px] mt-1">
                      {u.status === "pending" && "قيد المعالجة"}
                      {u.status === "confirmed" && "مؤكد"}
                      {u.status === "paid" && "مدفوع"}
                      {u.status === "cancelled" && "ملغي"}
                    </Badge>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground">أرباحك</p>
                    <p className="text-base font-bold text-emerald-600">+{formatPrice(Number(u.owner_earnings_iqd || 0))} د.ع</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className={`flex items-center gap-1.5 ${color} mb-1`}>
          <Icon className="h-4 w-4" />
          <span className="text-[11px] text-muted-foreground">{label}</span>
        </div>
        <p className="text-base font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
