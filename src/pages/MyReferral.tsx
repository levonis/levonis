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
import { useLanguage } from "@/lib/i18n";

export default function MyReferral() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, isRtl } = useLanguage();
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

  const dateLocale = t('ref_history_date_locale_iqd');

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);

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
    const confirmed = usages.filter((u) => u.status === "confirmed" || u.status === "paid");
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
    toast.success(t('ref_link_copied'));
    setTimeout(() => setCopied(false), 2000);
  };

  const shareCode = async () => {
    if (!coupon?.code) return;
    const link = `${window.location.origin}/?refcode=${coupon.code}`;
    const text = t('ref_share_text', { code: coupon.code, link });
    try {
      if (navigator.share) {
        await navigator.share({ title: t('ref_share_title'), text, url: link });
      } else {
        navigator.clipboard.writeText(text);
        toast.success(t('ref_message_copied'));
      }
    } catch {}
  };

  const saveCode = async () => {
    if (!coupon?.id) return;
    const sanitized = newCode.toLowerCase().trim().replace(/[^a-z0-9_]/g, "");
    if (sanitized.length < 3) {
      toast.error(t('ref_code_too_short'));
      return;
    }
    setCreating(true);
    const { error } = await supabase
      .from("referral_coupons")
      .update({ code: sanitized })
      .eq("id", coupon.id);
    setCreating(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? t('ref_code_in_use') : t('ref_update_failed'));
      return;
    }
    toast.success(t('ref_code_updated'));
    setEditingCode(false);
    loadData();
  };

  const saveCustomization = async () => {
    if (!coupon?.id) return;
    if (customMessage.length > 140) {
      toast.error(t('ref_message_too_long'));
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
      toast.error(t('ref_save_custom_failed'));
      return;
    }
    toast.success(t('ref_save_custom_success'));
    loadData();
  };

  const requestWithdraw = async () => {
    if (stats.available <= 0) {
      toast.error(t('ref_no_balance'));
      return;
    }
    setWithdrawing(true);
    const amount = stats.available;
    const { error } = await supabase.from("referral_earnings_withdrawals").insert({
      owner_user_id: user!.id,
      amount_iqd: amount,
      status: "pending",
    });
    setWithdrawing(false);
    if (error) {
      toast.error(t('ref_withdraw_failed'));
      return;
    }
    toast.success(t('ref_withdraw_sent'));

    // Notify admin via Telegram (non-blocking, kept in Arabic for ops)
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, full_name, phone_number")
        .eq("id", user!.id)
        .maybeSingle();
      const ownerLabel = profile?.username ? `@${profile.username}` : (profile?.full_name || user!.id.slice(0, 8));
      const phoneLine = profile?.phone_number ? `\n📞 <code>${profile.phone_number}</code>` : "";
      const codeLine = coupon?.code ? `\n🎟️ كود: <code>${coupon.code}</code>` : "";
      const message =
        `💸 <b>طلب سحب أرباح إحالة جديد</b>\n` +
        `👤 ${ownerLabel}${phoneLine}${codeLine}\n` +
        `💰 المبلغ: <b>${formatPrice(amount)} د.ع</b>\n` +
        `📊 إجمالي الأرباح: ${formatPrice(stats.totalEarnings)} د.ع\n` +
        `🛒 عدد الطلبات المُسلَّمة: ${stats.uses}`;
      await supabase.functions.invoke("send-telegram-notification", {
        body: { message, parse_mode: "HTML", channel_key: "withdrawals" },
      });
    } catch (e) {
      console.warn("Failed to notify admin via Telegram:", e);
    }

    loadData();
  };

  if (!user) {
    return (
      <div className="container mx-auto p-4 max-w-2xl" dir={isRtl ? 'rtl' : 'ltr'}>
        <Card><CardContent className="p-6 text-center">{t('ref_login_required')}</CardContent></Card>
      </div>
    );
  }

  if (vipLoading || loading) {
    return (
      <div className="container mx-auto p-4 max-w-3xl space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!vipStatus?.isVipPlus) {
    return (
      <div className="container mx-auto p-4 max-w-2xl" dir={isRtl ? 'rtl' : 'ltr'}>
        <Card className="border-2 border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              {t('ref_vip_only_title')}
            </CardTitle>
            <CardDescription>
              {t('ref_vip_only_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/rewards?tab=cards")} className="w-full">
              {t('ref_view_cards_btn')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expiresAt = coupon?.expires_at ? new Date(coupon.expires_at) : null;

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-5 pb-24" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sidebar via-sidebar to-sidebar-accent p-6 shadow-2xl">
        <div className={`absolute -top-12 ${isRtl ? '-right-12' : '-left-12'} h-40 w-40 rounded-full bg-white/10 blur-2xl`} />
        <div className={`absolute -bottom-10 ${isRtl ? '-left-10' : '-right-10'} h-32 w-32 rounded-full bg-white/10 blur-2xl`} />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-white">
              <Crown className="h-5 w-5" />
              <span className="text-sm font-semibold tracking-wide">{t('ref_header_label')}</span>
            </div>
            <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm">
              {coupon?.is_active ? t('ref_status_active') : t('ref_status_inactive')}
            </Badge>
          </div>

          <div className="bg-white/15 backdrop-blur-md rounded-2xl p-4 border border-white/20">
            <p className="text-xs text-white/80 mb-1">{t('ref_your_code_label')}</p>
            {!editingCode ? (
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-white tracking-wider font-mono uppercase truncate text-2xl">
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
                  className={`bg-emerald-950 text-primary font-mono uppercase ${isRtl ? 'text-right' : 'text-left'}`}
                  maxLength={20}
                />
                <Button onClick={saveCode} disabled={creating} size="sm">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : t('ref_save_btn')}
                </Button>
                <Button onClick={() => { setEditingCode(false); setNewCode(coupon?.code || ""); }} variant="ghost" size="sm" className="text-white hover:bg-white/20">{t('ref_cancel_btn')}</Button>
              </div>
            )}
            {expiresAt && (
              <p className="text-[11px] text-white/70 mt-2 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {t('ref_expires_at', { date: expiresAt.toLocaleDateString(dateLocale) })}
              </p>
            )}
          </div>
        </div>
      </div>

      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Gift className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <p className="font-bold text-foreground mb-1">{t('ref_free_delivery_terms_title')}</p>
            <p className="text-muted-foreground">
              {(() => {
                const raw = t('ref_free_delivery_terms_desc', {
                  strong: '__STRONG__',
                  amount: '__AMOUNT__',
                });
                const parts = raw.split(/(__STRONG__|__AMOUNT__)/g);
                return parts.map((p, i) => {
                  if (p === '__STRONG__') return <span key={i} className="font-bold text-amber-600">{t('ref_free_delivery_strong')}</span>;
                  if (p === '__AMOUNT__') return <span key={i} className="font-bold text-foreground">{t('ref_free_delivery_amount_chip', { amount: formatPrice(freeDeliveryMin) })}</span>;
                  return <span key={i}>{p}</span>;
                });
              })()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Customization Card */}
      <Card className="border-primary/20">
        <button
          type="button"
          onClick={() => setCustomizationOpen((v) => !v)}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 ${isRtl ? 'text-right' : 'text-left'}`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Palette className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-sm font-semibold truncate">{t('ref_customize_title')}</span>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${customizationOpen ? "rotate-180" : ""}`} />
        </button>
        {customizationOpen && (
        <CardContent className="space-y-3 px-3 pb-3 pt-0">
          {/* Message */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-foreground">{t('ref_message_label')}</label>
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value.slice(0, 140))}
              placeholder={t('ref_message_placeholder')}
              className="resize-none text-xs min-h-0 py-1.5"
              rows={2}
            />
            <p className={`text-[9px] text-muted-foreground ${isRtl ? 'text-left' : 'text-right'}`}>{customMessage.length}/140</p>
          </div>

          {/* Style picker */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-foreground">{t('ref_card_bg_label')}</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {Object.values(REFERRAL_BANNER_STYLES).map((style) => {
                const selected = bannerStyle === style.key;
                return (
                  <button
                    key={style.key}
                    type="button"
                    onClick={() => setBannerStyle(style.key)}
                    className={`relative rounded-md p-1.5 ${isRtl ? 'text-right' : 'text-left'} transition-all ${style.container} ${
                      selected ? "ring-2 ring-primary" : "ring-1 ring-border/40"
                    }`}
                  >
                    <p className={`text-[10px] font-bold truncate ${style.title}`}>{style.label}</p>
                    <div className={`mt-1 h-1 rounded-full ${style.progressTrack} overflow-hidden`}>
                      <div className={`h-full w-2/3 ${style.progressFill}`} />
                    </div>
                    {selected && (
                      <Check className={`absolute top-0.5 ${isRtl ? 'left-0.5' : 'right-0.5'} h-3 w-3 text-primary`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live preview */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-foreground">{t('ref_preview_label')}</label>
            {(() => {
              const s = getReferralBannerStyle(bannerStyle);
              return (
                <div className={`rounded-lg ${s.container} ${s.border} p-2 space-y-1.5`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🎁</span>
                    <div className="min-w-0">
                      <p className={`text-[11px] font-bold ${s.title} truncate`}>
                        {customMessage.trim() || t('ref_preview_default_message', { code: coupon?.code || 'you' })}
                      </p>
                      <p className="text-[10px] text-emerald-600 font-semibold">{t('ref_preview_free_delivery')}</p>
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
            {savingCustom ? <Loader2 className={`h-3.5 w-3.5 animate-spin ${isRtl ? 'ml-2' : 'mr-2'}`} /> : <Save className={`h-3.5 w-3.5 ${isRtl ? 'ml-2' : 'mr-2'}`} />}
            {t('ref_save_customization')}
          </Button>
        </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label={t('ref_stat_uses')} value={stats.uses.toLocaleString()} color="text-blue-600" />
        <StatCard icon={TrendingUp} label={t('ref_stat_total_earnings')} value={`${formatPrice(stats.totalEarnings)} ${t('ref_iqd_short')}`} color="text-emerald-600" />
        <StatCard icon={Wallet} label={t('ref_stat_available')} value={`${formatPrice(stats.available)} ${t('ref_iqd_short')}`} color="text-amber-600" />
        <StatCard icon={Coins} label={t('ref_stat_paid_out')} value={`${formatPrice(stats.paidOut)} ${t('ref_iqd_short')}`} color="text-purple-600" />
      </div>

      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold">{t('ref_withdraw_title')}</p>
            <p className="text-xs text-muted-foreground">{t('ref_withdraw_desc')}</p>
            {stats.pendingWithdraw > 0 && (
              <p className="text-[11px] text-amber-600 mt-1">{t('ref_pending_withdraw', { amount: formatPrice(stats.pendingWithdraw) })}</p>
            )}
          </div>
          <Button onClick={requestWithdraw} disabled={withdrawing || stats.available <= 0}>
            {withdrawing ? <Loader2 className={`h-4 w-4 animate-spin ${isRtl ? 'ml-2' : 'mr-2'}`} /> : <Wallet className={`h-4 w-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />}
            {t('ref_withdraw_btn', { amount: formatPrice(stats.available) })}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            {t('ref_history_title')} {t('ref_history_count', { count: usages.filter((u) => u.status === "confirmed" || u.status === "paid").length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usages.filter((u) => u.status === "confirmed" || u.status === "paid").length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t('ref_history_empty')}</p>
          ) : (
            <div className="space-y-2">
              {usages.filter((u) => u.status === "confirmed" || u.status === "paid").map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className="text-xs">
                    <p className="font-medium">{new Date(u.created_at).toLocaleDateString(dateLocale)}</p>
                    <p className="text-muted-foreground">{t('ref_history_gifted_delivery', { amount: formatPrice(Number(u.delivery_discount_iqd || 0)) })}</p>
                    <Badge variant="outline" className="text-[10px] mt-1">
                      {u.status === "pending" && t('ref_history_status_pending')}
                      {u.status === "confirmed" && t('ref_history_status_confirmed')}
                      {u.status === "paid" && t('ref_history_status_paid')}
                      {u.status === "cancelled" && t('ref_history_status_cancelled')}
                    </Badge>
                  </div>
                  <div className={isRtl ? 'text-left' : 'text-right'}>
                    <p className="text-xs text-muted-foreground">{t('ref_history_your_earnings')}</p>
                    <p className="text-base font-bold text-emerald-600">+{formatPrice(Number(u.owner_earnings_iqd || 0))} {t('ref_iqd_short')}</p>
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
