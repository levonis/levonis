import { useEffect, useState } from "react";
import { useOriginPoint } from "@/hooks/useOriginPoint";
import { useNavigate, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOwnedLevoCard } from "@/hooks/useOwnedLevoCard";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Dices,
  Wallet,
  ShieldAlert,
  ArrowRight,
  Truck,
  Package,
  Sparkles,
} from "lucide-react";
import WavyColors from "@/components/WavyColors";

type Step = "sale-type" | "category" | "offer" | "confirm";
type SaleType = "direct" | "preorder";
type Offer = {
  id: string;
  sale_type: SaleType;
  category_id: string | null;
  title_ar: string;
  description_ar: string | null;
  image_url: string | null;
  price_iqd: number;
  display_order: number;
};

export default function RandomFilament() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshCart } = useCart();
  const { data: activeCard, isLoading: cardLoading } = useOwnedLevoCard();
  const [step, setStep] = useState<Step>("sale-type");
  const [saleType, setSaleType] = useState<SaleType | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { capture: captureOrigin, originRef: confirmOriginRef } = useOriginPoint();

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["random-filament-settings-page"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("random_filament_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: ban } = useQuery({
    queryKey: ["random-filament-ban", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("random_filament_bans")
        .select("user_id, reason, banned_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  // Existing unrevealed/unpaid RF cart items — used to enforce single sale_type per cart
  const { data: existingRfSaleType } = useQuery<SaleType | null>({
    queryKey: ["rf-existing-cart-sale-type", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("random_filament_orders")
        .select("sale_type, revealed_at, order_id")
        .eq("user_id", user!.id)
        .is("order_id", null)
        .is("revealed_at", null)
        .limit(1)
        .maybeSingle();
      return (data?.sale_type as SaleType) || null;
    },
  });

  const handlePickSaleType = (next: SaleType) => {
    if (existingRfSaleType && existingRfSaleType !== next) {
      const existingLabel = existingRfSaleType === "direct" ? "البيع المباشر" : "الحجز المسبق";
      toast.error(`لديك طلب فلمنت عشوائي من ${existingLabel} في السلة — أكمل الطلب أولاً قبل إضافة نوع آخر`);
      navigate("/cart");
      return;
    }
    setSaleType(next);
    setStep("category");
  };

  const { data: categories } = useQuery({
    queryKey: ["random-filament-allowed-categories", settings?.category_ids],
    enabled: !!settings?.category_ids?.length,
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name_ar, name_en, name_ku, image_url:media_url")
        .in("id", settings!.category_ids as string[]);
      return data || [];
    },
  });

  const { data: offers } = useQuery<Offer[]>({
    queryKey: ["rf-offers-public", saleType, categoryId],
    enabled: !!saleType && !!categoryId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("random_filament_offers")
        .select("id, sale_type, category_id, category_ids, title_ar, description_ar, image_url, price_iqd, display_order, allowed_product_ids")
        .eq("sale_type", saleType)
        .eq("enabled", true)
        .order("display_order");
      const list = (data || []) as any[];
      // filter offers that include this category (new array or legacy single)
      const inCat = list.filter((o) =>
        (Array.isArray(o.category_ids) && o.category_ids.length > 0
          ? o.category_ids.includes(categoryId)
          : (o.category_id == null || o.category_id === categoryId))
      );

      // For direct-sale: hide offers with no available stock.
      // For preorder: keep as-is (stock not required).
      if (saleType !== "direct") return inCat as Offer[];

      const summaries = await Promise.all(
        inCat.map(async (o) => {
          const { data: s } = await (supabase as any).rpc("rf_offer_stock_summary", {
            p_offer_id: o.id,
          });
          return { id: o.id, stock: Number(s?.direct_stock_total ?? 0), products: Number(s?.eligible_products ?? 0) };
        })
      );
      const ok = new Set(
        summaries.filter((s) => s.stock > 0 && s.products > 0).map((s) => s.id)
      );
      return inCat.filter((o) => ok.has(o.id)) as Offer[];
    },
  });

  const selectedOffer = offers?.find((o) => o.id === offerId) || null;
  const price = selectedOffer?.price_iqd || 0;
  const selectedCategory = categories?.find((c) => c.id === categoryId);

  useEffect(() => {
    if (settings && !settings.enabled) {
      toast.error("القسم متوقف حالياً");
      navigate("/");
    }
  }, [settings, navigate]);

  const handleConfirm = async () => {
    if (!user) {
      toast.error("سجل دخولك أولاً");
      navigate("/auth");
      return;
    }
    if (!categoryId || !offerId) return;
    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc(
        "add_random_filament_to_cart",
        { p_category_id: categoryId, p_offer_id: offerId, p_quantity: 1 }
      );
      if (error) throw error;
      if (!data?.cart_item_id) throw new Error("UNKNOWN");
      await refreshCart();
      toast.success("تم إضافة الفلمنت العشوائي إلى السلة!");
      setConfirmOpen(false);
      navigate("/cart");
    } catch (e: any) {
      const msg = String(e?.message || "");
      const map: Record<string, string> = {
        USER_BANNED: "أنت محظور من قسم الفلمنت العشوائي",
        SECTION_DISABLED: "القسم متوقف حالياً",
        CATEGORY_NOT_ALLOWED: "هذه الفئة غير مفعّلة",
        OFFER_NOT_FOUND: "العرض غير متاح",
        NO_PRODUCT_AVAILABLE: "انتهى هذا العرض — لا منتجات متاحة حالياً",
        NO_COLOR_AVAILABLE: "انتهى هذا العرض — لا ألوان متاحة حالياً",
        PRICE_NOT_CONFIGURED: "السعر غير مضبوط من الإدارة",
      };
      const key = Object.keys(map).find((k) => msg.includes(k));
      toast.error(key ? map[key] : "تعذر إضافة الطلب");
    } finally {
      setSubmitting(false);
    }
  };

  if (ban) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-xl">
        <Card className="glass-panel border-destructive/50">
          <CardContent className="p-8 text-center space-y-4">
            <ShieldAlert className="size-14 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold">تم حظرك من هذا القسم</h1>
            <p className="text-muted-foreground">{ban.reason}</p>
            <p className="text-xs text-muted-foreground">
              الحظر دائم ولا يمكن إلغاؤه. الإلغاء كان نتيجة محاولة إلغاء طلب
              فلمنت عشوائي سابق.
            </p>
            <Button onClick={() => navigate("/")} variant="outline">
              العودة للرئيسية
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Gate: random filament is exclusive to active Levo card holders
  if (!cardLoading && !activeCard) {
    return <Navigate to="/rewards?tab=cards" replace state={{ lockedReason: 'random_filament' }} />;
  }



  if (settingsLoading || !settings) {
    return (
      <div className="container mx-auto px-4 py-10 text-center text-muted-foreground">
        جاري التحميل...
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
      <header className="text-center space-y-2">
        <div className="inline-flex size-16 rounded-2xl bg-primary/15 items-center justify-center">
          <Dices className="size-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">{settings.title_ar}</h1>
        <p className="text-sm text-muted-foreground">{settings.description_ar}</p>
      </header>

      {/* progress */}
      {(() => {
        const steps: Step[] = ["sale-type", "category", "offer", "confirm"];
        const currentIdx = steps.indexOf(step);
        const labels: Record<Step, string> = {
          "sale-type": "النوع",
          category: "الفئة",
          offer: "العرض",
          confirm: "التأكيد",
        };
        return (
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-xs px-2">
            {steps.map((s, i, arr) => {
              const isDone = i < currentIdx;
              const isActive = i === currentIdx;
              return (
                <div key={s} className="flex items-center gap-1.5 sm:gap-2">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`size-8 rounded-full flex items-center justify-center font-bold text-[13px] transition-all duration-300 border ${
                        isActive
                          ? "bg-primary text-primary-foreground border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.18)] scale-110"
                          : isDone
                          ? "bg-primary/90 text-primary-foreground border-primary/60"
                          : "bg-muted/60 text-muted-foreground border-border/50 backdrop-blur-sm"
                      }`}
                    >
                      {isDone ? (
                        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-medium transition-colors ${
                        isActive
                          ? "text-primary"
                          : isDone
                          ? "text-foreground/80"
                          : "text-muted-foreground/70"
                      }`}
                    >
                      {labels[s]}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="relative h-0.5 w-8 sm:w-12 -mt-4 rounded-full overflow-hidden bg-border/60">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
                        style={{ width: i < currentIdx ? "100%" : "0%" }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {step === "sale-type" && (
        <>
          {existingRfSaleType && (
            <div className="mb-3 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-sm text-center">
              لديك طلب فلمنت عشوائي من <strong>{existingRfSaleType === "direct" ? "البيع المباشر" : "الحجز المسبق"}</strong> في السلة.
              يجب إتمام الطلب أولاً قبل إضافة نوع آخر.
              <button
                type="button"
                className="block mx-auto mt-2 text-primary underline font-bold"
                onClick={() => navigate("/cart")}
              >
                الذهاب إلى السلة
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card
            className="glass-panel cursor-pointer hover:border-primary transition"
            onClick={() => handlePickSaleType("direct")}
          >
            <CardContent className="p-5 text-center space-y-2">
              <Truck className="size-8 mx-auto text-primary" />
              <h3 className="font-bold">بيع مباشر</h3>
              <p className="text-xs text-muted-foreground">من المخزون المتوفر — لون عشوائي</p>
            </CardContent>
          </Card>
          <Card
            className="glass-panel cursor-pointer hover:border-primary transition"
            onClick={() => handlePickSaleType("preorder")}
          >
            <CardContent className="p-5 text-center space-y-2">
              <Package className="size-8 mx-auto text-primary" />
              <h3 className="font-bold">حجز مسبق</h3>
              <p className="text-xs text-muted-foreground">نوع ولون عشوائي من القسم</p>
            </CardContent>
          </Card>
          </div>
        </>
      )}

      {step === "category" && (
        <div>
          <Button variant="ghost" size="sm" className="mb-3" onClick={() => setStep("sale-type")}>
            <ArrowRight className="size-4" /> رجوع
          </Button>
          <h2 className="text-sm font-bold mb-2 text-center">اختر القسم الفرعي</h2>
          <div className="grid grid-cols-2 gap-3">
            {categories?.map((cat) => (
              <Card
                key={cat.id}
                className="glass-panel cursor-pointer hover:border-primary transition"
                onClick={() => { setCategoryId(cat.id); setStep("offer"); }}
              >
                <CardContent className="p-4 text-center space-y-2">
                  <Sparkles className="size-7 mx-auto text-primary" />
                  <h3 className="font-bold text-sm">{cat.name_ar}</h3>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {step === "offer" && (
        <div>
          <Button variant="ghost" size="sm" className="mb-3" onClick={() => setStep("category")}>
            <ArrowRight className="size-4" /> رجوع
          </Button>
          <h2 className="text-sm font-bold mb-2 text-center">اختر العرض</h2>
          {offers?.length === 0 && (
            <p className="text-center text-muted-foreground py-6 text-sm">لا توجد عروض متاحة حالياً</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {offers?.map((o) => (
              <Card
                key={o.id}
                className="glass-panel cursor-pointer hover:border-primary transition overflow-hidden"
                onClick={(e) => { captureOrigin(e); setOfferId(o.id); setConfirmOpen(true); setStep("confirm"); }}
              >
                <div className="w-full h-32 relative overflow-hidden">
                  {o.image_url ? (
                    <img src={o.image_url} alt={o.title_ar} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <WavyColors seed={o.id} />
                  )}
                </div>
                <CardContent className="p-4 space-y-2">
                  <h3 className="font-bold">{o.title_ar}</h3>
                  {o.description_ar && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{o.description_ar}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{Number(o.price_iqd).toLocaleString()} د.ع</Badge>
                    <EligibilityBadges offerId={o.id} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Dialog
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o);
          if (!o) setStep("offer");
        }}
      >
        <DialogContent
          className="!overflow-hidden !max-h-none"
          ref={confirmOriginRef}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dices className="size-5 text-primary" />
              تأكيد الفلمنت العشوائي
            </DialogTitle>
            <DialogDescription>
              لون ونوع الفلمنت سيختاره النظام عشوائياً ولن يظهر لك إلا بعد إتمام
              الدفع.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">طريقة الاستلام</span>
              <span className="font-bold">
                {saleType === "direct" ? "بيع مباشر" : "حجز مسبق"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">القسم</span>
              <span className="font-bold">{selectedCategory?.name_ar}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">السعر</span>
              <span className="font-bold text-primary">
                {price.toLocaleString()} د.ع
              </span>
            </div>

            <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs flex gap-2">
              <Wallet className="size-4 mt-0.5 shrink-0 text-primary" />
              <span>
                <b>ادفع من المحفظة لتعرف ماذا حصلت فوراً.</b>
                {" "}إذا اخترت الدفع عند الاستلام يبقى الطلب مجهولاً لك حتى تستلمه — الإدارة فقط تعرف الاختيار.
              </span>
            </div>

            <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-xs flex gap-2">
              <ShieldAlert className="size-4 mt-0.5 shrink-0 text-destructive" />
              <span>
                <b>الطلب غير قابل للإلغاء.</b> أي محاولة لإلغاء طلب الفلمنت
                العشوائي = حظر دائم من هذا القسم مهما كان السبب.
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
            >
              إلغاء
            </Button>
            <Button onClick={handleConfirm} disabled={submitting}>
              {submitting ? "جاري الإضافة..." : "أوافق وأضيف للسلة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------- Eligibility preview (public) ----------------- */
function EligibilityBadges({ offerId }: { offerId: string }) {
  const [open, setOpen] = useState(false);
  const { capture, originRef } = useOriginPoint();
  const { data } = useQuery({
    queryKey: ["rf-public-summary", offerId],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("rf_offer_stock_summary", {
        p_offer_id: offerId,
      });
      return data as { eligible_products: number; eligible_colors: number };
    },
    staleTime: 60_000,
  });
  const products = Number(data?.eligible_products ?? 0);
  const colors = Number(data?.eligible_colors ?? 0);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); capture(e); setOpen(true); }}
        className="inline-flex items-center gap-1.5 text-[11px] rounded-full border bg-background/60 px-2 py-1 hover:border-primary transition"
      >
        <Package className="size-3 text-primary" />
        <span><b>{products}</b> منتج · <b>{colors}</b> لون</span>
      </button>
      <EligibleProductsDialog offerId={offerId} open={open} onOpenChange={setOpen} originRef={originRef} />
    </>
  );
}

function EligibleProductsDialog({
  offerId, open, onOpenChange, originRef,
}: { offerId: string; open: boolean; onOpenChange: (v: boolean) => void; originRef?: (node: HTMLElement | null) => void }) {
  const { data: items, isLoading } = useQuery({
    queryKey: ["rf-eligible-list", offerId],
    enabled: open,
    queryFn: async () => {
      const { data: offer } = await (supabase as any)
        .from("random_filament_offers")
        .select("sale_type, category_id, category_ids, allowed_product_ids")
        .eq("id", offerId)
        .maybeSingle();
      if (!offer) return [];
      const catIds: string[] = (offer.category_ids?.length
        ? offer.category_ids
        : (offer.category_id ? [offer.category_id] : [])) as string[];
      const allowed: string[] = offer.allowed_product_ids || [];
      let q = supabase
        .from("products")
        .select("id, name_ar, image_url, in_stock, colors, product_options(id, name_ar, available_for_direct_sale, available_for_pre_order, stock_quantity, in_stock)")
        .eq("is_pricing_updated", true)
        .order("name_ar")
        .limit(200);
      if (catIds.length) q = q.in("category_id", catIds);
      if (allowed.length) q = q.in("id", allowed);
      const { data } = await q;
      const list = (data || []) as any[];
      const isDirect = offer.sale_type === "direct";
      return list
        .map((p: any) => {
          const colors = Array.isArray(p.colors) ? p.colors : [];
          const opts = Array.isArray(p.product_options) ? p.product_options : [];
          const eligibleColors = colors.filter((c: any) => {
            if (isDirect) {
              if (c?.available_for_direct_sale !== true) return false;
              const stocks = c?.option_stocks || {};
              return Object.values(stocks).some((v: any) => Number(v) > 0);
            }
            return c?.available_for_pre_order !== false;
          });
          const eligibleOptions = opts.filter((o: any) => {
            if (isDirect) {
              if (o?.available_for_direct_sale !== true) return false;
              if (o?.in_stock === false) return false;
              return o?.stock_quantity == null || Number(o.stock_quantity) > 0;
            }
            return o?.available_for_pre_order !== false;
          });
          return { ...p, eligibleColors, eligibleOptions };
        })
        .filter((p: any) => (isDirect ? p.in_stock !== false : true) && p.eligibleColors.length > 0);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!overflow-hidden !max-h-none max-w-lg" ref={originRef}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            ماذا قد تحصل؟
          </DialogTitle>
          <DialogDescription>
            النظام سيختار <b>عشوائياً</b> من المنتجات والألوان التالية المتوفرة حالياً.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2 space-y-2">
          {isLoading && <p className="text-center text-xs text-muted-foreground py-6">جاري التحميل...</p>}
          {!isLoading && (items || []).length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-6">لا توجد منتجات مؤهلة حالياً</p>
          )}
          {(items || []).map((p: any) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border p-2 bg-card/60">
              {p.image_url ? (
                <img src={p.image_url} alt="" className="size-12 rounded object-cover shrink-0" loading="lazy" decoding="async" />
              ) : (
                <div className="size-12 rounded bg-muted shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{p.name_ar}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.eligibleColors.slice(0, 8).map((c: any, i: number) => (
                    <span
                      key={i}
                      title={c?.name || ""}
                      className="size-4 rounded-full border"
                      style={{ background: c?.hex_code || c?.hex || c?.color || "#888" }}
                    />
                  ))}
                  {p.eligibleColors.length > 8 && (
                    <span className="text-[10px] text-muted-foreground">+{p.eligibleColors.length - 8}</span>
                  )}
                </div>
                {p.eligibleOptions && p.eligibleOptions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {p.eligibleOptions.slice(0, 4).map((o: any) => (
                      <span
                        key={o.id}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/70 border border-border/60"
                      >
                        {o.name_ar}
                      </span>
                    ))}
                    {p.eligibleOptions.length > 4 && (
                      <span className="text-[10px] text-muted-foreground">+{p.eligibleOptions.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                <Badge variant="outline" className="text-[10px]">
                  {p.eligibleColors.length} لون
                </Badge>
                {p.eligibleOptions && p.eligibleOptions.length > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    {p.eligibleOptions.length} خيار
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
