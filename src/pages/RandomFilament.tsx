import { useEffect, useMemo, useState } from "react";
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

type Step = "sale-type" | "category" | "offer" | "confirm";
type SaleType = "direct" | "preorder";
type Offer = {
  id: string;
  sale_type: SaleType;
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
    queryKey: ["rf-offers-public", saleType],
    enabled: !!saleType,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("random_filament_offers")
        .select("id, sale_type, title_ar, description_ar, image_url, price_iqd, display_order")
        .eq("sale_type", saleType)
        .eq("enabled", true)
        .order("display_order");
      return (data || []) as Offer[];
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
        NO_PRODUCT_AVAILABLE: "لا توجد منتجات متاحة في هذه الفئة",
        NO_COLOR_AVAILABLE: "لا توجد ألوان متاحة حالياً",
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
        {(["sale-type", "category", "confirm"] as Step[]).map((s, i) => (
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
            {i < 2 && <div className="w-6 h-px bg-border" />}
          </div>
        ))}
      </div>

      {step === "sale-type" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card
            className="glass-panel cursor-pointer hover:border-primary transition"
            onClick={() => {
              setSaleType("direct");
              setStep("category");
            }}
          >
            <CardContent className="p-5 text-center space-y-2">
              <Truck className="size-8 mx-auto text-primary" />
              <h3 className="font-bold">بيع مباشر</h3>
              <p className="text-xs text-muted-foreground">
                من المخزون المتوفر — لون عشوائي
              </p>
              <Badge variant="secondary">
                {Number(settings.direct_price_iqd || 0).toLocaleString()} د.ع
              </Badge>
            </CardContent>
          </Card>
          <Card
            className="glass-panel cursor-pointer hover:border-primary transition"
            onClick={() => {
              setSaleType("preorder");
              setStep("category");
            }}
          >
            <CardContent className="p-5 text-center space-y-2">
              <Package className="size-8 mx-auto text-primary" />
              <h3 className="font-bold">حجز مسبق</h3>
              <p className="text-xs text-muted-foreground">
                نوع ولون عشوائي من القسم
              </p>
              <Badge variant="secondary">
                {Number(settings.pre_order_price_iqd || 0).toLocaleString()} د.ع
              </Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "category" && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-3"
            onClick={() => setStep("sale-type")}
          >
            <ArrowRight className="size-4" />
            رجوع
          </Button>
          <div className="grid grid-cols-2 gap-3">
            {categories?.map((cat) => (
              <Card
                key={cat.id}
                className="glass-panel cursor-pointer hover:border-primary transition"
                onClick={() => {
                  setCategoryId(cat.id);
                  setConfirmOpen(true);
                  setStep("confirm");
                }}
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

      <Dialog
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o);
          if (!o) setStep("category");
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
