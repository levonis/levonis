import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  const [step, setStep] = useState<Step>("sale-type");
  const [saleType, setSaleType] = useState<SaleType | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      return list.filter((o) =>
        (Array.isArray(o.category_ids) && o.category_ids.length > 0
          ? o.category_ids.includes(categoryId)
          : (o.category_id == null || o.category_id === categoryId))
      ) as Offer[];
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
        "create_random_filament_order",
        { p_category_id: categoryId, p_offer_id: offerId }
      );
      if (error) throw error;
      if (!data?.success) throw new Error("UNKNOWN");
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
      <div className="flex items-center gap-2 justify-center text-xs">
        {(["sale-type", "category", "offer", "confirm"] as Step[]).map((s, i, arr) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`size-7 rounded-full flex items-center justify-center font-bold ${
                step === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            {i < arr.length - 1 && <div className="w-6 h-px bg-border" />}
          </div>
        ))}
      </div>

      {step === "sale-type" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card
            className="glass-panel cursor-pointer hover:border-primary transition"
            onClick={() => { setSaleType("direct"); setStep("category"); }}
          >
            <CardContent className="p-5 text-center space-y-2">
              <Truck className="size-8 mx-auto text-primary" />
              <h3 className="font-bold">بيع مباشر</h3>
              <p className="text-xs text-muted-foreground">من المخزون المتوفر — لون عشوائي</p>
            </CardContent>
          </Card>
          <Card
            className="glass-panel cursor-pointer hover:border-primary transition"
            onClick={() => { setSaleType("preorder"); setStep("category"); }}
          >
            <CardContent className="p-5 text-center space-y-2">
              <Package className="size-8 mx-auto text-primary" />
              <h3 className="font-bold">حجز مسبق</h3>
              <p className="text-xs text-muted-foreground">نوع ولون عشوائي من القسم</p>
            </CardContent>
          </Card>
        </div>
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
                onClick={() => { setOfferId(o.id); setConfirmOpen(true); setStep("confirm"); }}
              >
                <div className="w-full h-32 relative overflow-hidden">
                  {o.image_url ? (
                    <img src={o.image_url} alt={o.title_ar} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <WavyColors />
                  )}
                </div>
                <CardContent className="p-4 space-y-2">
                  <h3 className="font-bold">{o.title_ar}</h3>
                  {o.description_ar && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{o.description_ar}</p>
                  )}
                  <Badge variant="secondary">{Number(o.price_iqd).toLocaleString()} د.ع</Badge>
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
        <DialogContent className="!overflow-hidden !max-h-none">
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
