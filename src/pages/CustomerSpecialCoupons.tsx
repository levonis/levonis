import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, Percent, Truck, Gift, Tag, Copy, Store, Clock, Ticket, 
  Sparkles, CheckCircle, Package, Settings2, Crown, ChevronLeft,
  ShoppingBag, Star, Zap
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import Footer from "@/components/Footer";
import MerchantDiscountsManager from "@/components/merchant/MerchantDiscountsManager";

interface SpecialCoupon {
  id: string;
  title_ar: string;
  description_ar: string | null;
  coupon_type: string;
  discount_value: number;
  coupon_code: string | null;
  image_url: string | null;
  merchant_store_name: string | null;
  is_active: boolean;
  valid_until: string | null;
  created_at: string;
}

interface StoreDiscount {
  id: string;
  merchant_id: string;
  merchant_store_name: string | null;
  discount_type: string;
  discount_value: number;
  min_purchase_amount: number;
  gift_description: string | null;
  title_ar: string;
  description_ar: string | null;
  image_url: string | null;
  is_active: boolean;
  valid_until: string | null;
  created_at: string;
}

const discountIcons: Record<string, typeof Percent> = {
  percentage: Percent,
  fixed_amount: Tag,
  free_delivery: Truck,
  free_gift: Gift,
  min_purchase_percentage: Percent,
  min_purchase_delivery: Truck,
};

const discountLabels: Record<string, string> = {
  percentage: "خصم نسبة",
  fixed_amount: "خصم مبلغ",
  free_delivery: "توصيل مجاني",
  free_gift: "هدية مجانية",
  min_purchase_percentage: "خصم عند الشراء",
  min_purchase_delivery: "توصيل مجاني عند الشراء",
};

const discountColors: Record<string, string> = {
  percentage: "from-primary to-primary/70",
  fixed_amount: "from-amber-500 to-amber-600",
  free_delivery: "from-blue-500 to-blue-600",
  free_gift: "from-emerald-500 to-emerald-600",
  min_purchase_percentage: "from-purple-500 to-purple-600",
  min_purchase_delivery: "from-cyan-500 to-cyan-600",
};

export default function CustomerSpecialCoupons() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedDiscount, setSelectedDiscount] = useState<StoreDiscount | null>(null);
  const [showMerchantManager, setShowMerchantManager] = useState(false);

  // Check if user is merchant
  const { data: merchantApp } = useQuery({
    queryKey: ["merchant-app-for-coupons", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("merchant_applications")
        .select("id, display_name")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const isMerchant = !!merchantApp;

  // Fetch admin-created coupons
  const { data: coupons, isLoading: couponsLoading } = useQuery({
    queryKey: ["customer-special-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_special_coupons")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SpecialCoupon[];
    },
  });

  // Fetch merchant store discounts
  const { data: storeDiscounts, isLoading: discountsLoading } = useQuery({
    queryKey: ["store-discounts-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_store_discounts")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as StoreDiscount[];
    },
  });

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success("تم نسخ الكود! 📋");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getDiscountDisplay = (d: StoreDiscount) => {
    switch (d.discount_type) {
      case 'percentage':
      case 'min_purchase_percentage':
        return `${d.discount_value}%`;
      case 'fixed_amount':
        return `${d.discount_value?.toLocaleString()} د.ع`;
      case 'free_delivery':
      case 'min_purchase_delivery':
        return 'مجاني';
      case 'free_gift':
        return 'هدية';
      default:
        return '';
    }
  };

  // Group discounts by store
  const discountsByStore = useMemo(() => {
    if (!storeDiscounts) return new Map<string, StoreDiscount[]>();
    const map = new Map<string, StoreDiscount[]>();
    storeDiscounts.forEach(d => {
      const key = d.merchant_store_name || d.merchant_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    });
    return map;
  }, [storeDiscounts]);

  const isLoading = couponsLoading || discountsLoading;
  const hasContent = (coupons && coupons.length > 0) || (storeDiscounts && storeDiscounts.length > 0);

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Compact Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-sm font-black text-foreground">العروض والخصومات</h1>
                <p className="text-[9px] text-muted-foreground">وفّر مع كل طلب</p>
              </div>
            </div>
          </div>
          {isMerchant && (
            <Button
              variant={showMerchantManager ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1.5 text-[10px] rounded-xl px-3"
              onClick={() => setShowMerchantManager(!showMerchantManager)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              إدارة خصوماتي
            </Button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      {!isLoading && hasContent && (
        <div className="px-4 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {discountsByStore.size > 0 && (
            <div className="flex items-center gap-1.5 bg-primary/10 rounded-full px-3 py-1.5 shrink-0">
              <Store className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-bold text-primary">{discountsByStore.size} متجر</span>
            </div>
          )}
          {storeDiscounts && storeDiscounts.length > 0 && (
            <div className="flex items-center gap-1.5 bg-muted/50 rounded-full px-3 py-1.5 shrink-0">
              <Zap className="h-3 w-3 text-foreground" />
              <span className="text-[10px] font-bold">{storeDiscounts.length} عرض</span>
            </div>
          )}
          {coupons && coupons.length > 0 && (
            <div className="flex items-center gap-1.5 bg-muted/50 rounded-full px-3 py-1.5 shrink-0">
              <Ticket className="h-3 w-3 text-foreground" />
              <span className="text-[10px] font-bold">{coupons.length} كوبون</span>
            </div>
          )}
        </div>
      )}

      <main className="flex-1 px-4 py-3 space-y-5">
        {/* Merchant Manager */}
        {showMerchantManager && isMerchant && merchantApp && (
          <div className="rounded-2xl border border-primary/20 bg-card/50 backdrop-blur-sm overflow-hidden">
            <MerchantDiscountsManager
              merchantId={merchantApp.id}
              merchantName={merchantApp.display_name || "متجري"}
            />
          </div>
        )}

        {/* Per-Store Discount Sections */}
        {Array.from(discountsByStore.entries()).map(([storeName, discounts]) => (
          <section key={storeName} className="space-y-2.5">
            {/* Store Header */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Store className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-black text-foreground truncate">{storeName}</h3>
                <p className="text-[9px] text-muted-foreground">{discounts.length} عرض متاح</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[9px] gap-1 text-primary"
                onClick={() => navigate(`/community/store/${discounts[0].merchant_id}`)}
              >
                زيارة
                <ChevronLeft className="h-3 w-3" />
              </Button>
            </div>

            {/* Horizontal Scroll for this store */}
            <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 snap-x">
              {discounts.map((discount) => {
                const Icon = discountIcons[discount.discount_type] || Percent;
                const gradientClass = discountColors[discount.discount_type] || "from-primary to-primary/70";

                return (
                  <div
                    key={discount.id}
                    className="shrink-0 w-[200px] cursor-pointer group snap-start"
                    onClick={() => setSelectedDiscount(discount)}
                  >
                    <div className="rounded-2xl overflow-hidden border border-border/30 bg-card hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
                      {/* Top gradient band */}
                      <div className={`relative h-20 bg-gradient-to-br ${gradientClass} p-3 flex flex-col justify-between`}>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_70%)]" />
                        <div className="relative flex items-center justify-between">
                          <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <Icon className="h-3.5 w-3.5 text-white" />
                          </div>
                          <span className="text-2xl font-black text-white leading-none drop-shadow-sm">
                            {getDiscountDisplay(discount)}
                          </span>
                        </div>
                        <p className="relative text-[9px] text-white/90 font-bold truncate">
                          {discountLabels[discount.discount_type]}
                        </p>
                      </div>
                      
                      {/* Card body */}
                      <div className="p-2.5 space-y-1.5">
                        <h4 className="text-[10px] font-bold text-foreground line-clamp-1">{discount.title_ar}</h4>
                        {discount.min_purchase_amount > 0 && (
                          <div className="text-[8px] text-primary font-bold bg-primary/5 rounded-md px-2 py-0.5 w-fit border border-primary/10">
                            عند شراء {discount.min_purchase_amount.toLocaleString()}+
                          </div>
                        )}
                        {discount.valid_until && (
                          <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" />
                            حتى {format(new Date(discount.valid_until), "d MMM", { locale: ar })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* Admin Coupons */}
        {coupons && coupons.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                <Ticket className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-black text-foreground">كوبونات خاصة</h3>
                <p className="text-[9px] text-muted-foreground">{coupons.length} كوبون متاح</p>
              </div>
            </div>

            <div className="space-y-2">
              {coupons.map((coupon) => {
                const Icon = discountIcons[coupon.coupon_type] || Percent;
                const label = discountLabels[coupon.coupon_type] || "خصم";
                const isCopied = copiedId === coupon.id;

                return (
                  <div key={coupon.id} className="rounded-2xl border border-border/30 bg-card overflow-hidden hover:border-primary/20 transition-all">
                    <div className="flex">
                      {/* Ticket-style value badge */}
                      <div className="w-[72px] shrink-0 flex flex-col items-center justify-center py-3 bg-gradient-to-b from-primary/10 to-primary/5 border-l border-dashed border-border/30 relative">
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-background" />
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-background" />
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-1">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        {coupon.coupon_type === "percentage" && coupon.discount_value > 0 && (
                          <span className="text-base font-black text-primary">{coupon.discount_value}%</span>
                        )}
                        {coupon.coupon_type === "fixed_amount" && coupon.discount_value > 0 && (
                          <span className="text-[10px] font-black text-primary">{coupon.discount_value}<span className="text-[7px]"> د.ع</span></span>
                        )}
                        {coupon.coupon_type === "free_delivery" && (
                          <span className="text-[9px] font-black text-primary">مجاني</span>
                        )}
                        {coupon.coupon_type === "free_product" && (
                          <span className="text-[9px] font-black text-primary">هدية</span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-3 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-[11px] text-foreground line-clamp-1">{coupon.title_ar}</h4>
                          <Badge className="text-[7px] bg-primary/10 text-primary border-0 shrink-0 px-1.5 h-4 rounded-md">{label}</Badge>
                        </div>
                        {coupon.description_ar && (
                          <p className="text-[9px] text-muted-foreground line-clamp-2 leading-relaxed">{coupon.description_ar}</p>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {coupon.coupon_code && (
                              <button
                                className={`flex items-center gap-1.5 text-[9px] font-mono rounded-lg px-2 py-1 transition-all active:scale-95 ${
                                  isCopied
                                    ? "bg-primary/15 border border-primary/30 text-primary"
                                    : "bg-muted/50 border border-dashed border-border/50 text-foreground hover:border-primary/30"
                                }`}
                                onClick={() => copyCode(coupon.coupon_code!, coupon.id)}
                              >
                                {isCopied ? <CheckCircle className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
                                {coupon.coupon_code}
                              </button>
                            )}
                            {coupon.merchant_store_name && (
                              <span className="flex items-center gap-1 text-[8px] text-muted-foreground">
                                <Store className="h-2.5 w-2.5" />
                                {coupon.merchant_store_name}
                              </span>
                            )}
                          </div>
                          {coupon.valid_until && (
                            <span className="flex items-center gap-1 text-[7px] text-muted-foreground">
                              <Clock className="h-2.5 w-2.5" />
                              {format(new Date(coupon.valid_until), "d MMM", { locale: ar })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && !hasContent && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-card to-muted border border-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-7 w-7 text-primary/30" />
            </div>
            <p className="text-foreground font-black text-sm">لا توجد عروض حالياً</p>
            <p className="text-[10px] text-muted-foreground mt-1 mb-4">ترقب العروض القادمة من متاجر المجتمع</p>
            <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => navigate("/community")}>
              تصفح المتاجر
            </Button>
          </div>
        )}
      </main>

      {/* Store Discount Detail Sheet */}
      <Sheet open={!!selectedDiscount} onOpenChange={() => setSelectedDiscount(null)}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl p-0">
          {selectedDiscount && (() => {
            const Icon = discountIcons[selectedDiscount.discount_type] || Percent;
            const gradientClass = discountColors[selectedDiscount.discount_type] || "from-primary to-primary/70";
            return (
              <div className="flex flex-col h-full">
                {/* Hero */}
                <div className={`relative bg-gradient-to-br ${gradientClass} px-5 pt-8 pb-6`}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.1),transparent_60%)]" />
                  {/* Drag handle */}
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/30" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/10">
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <Badge className="bg-white/20 text-white border-0 text-[10px] backdrop-blur-sm mb-1">
                          {discountLabels[selectedDiscount.discount_type]}
                        </Badge>
                        <h2 className="text-white font-black text-base">{selectedDiscount.title_ar}</h2>
                      </div>
                    </div>
                    <div className="text-5xl font-black text-white drop-shadow-lg">
                      {getDiscountDisplay(selectedDiscount)}
                    </div>
                    {selectedDiscount.merchant_store_name && (
                      <div className="flex items-center gap-2 text-white/80 text-xs mt-3">
                        <Store className="h-3.5 w-3.5" />
                        {selectedDiscount.merchant_store_name}
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {selectedDiscount.description_ar && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{selectedDiscount.description_ar}</p>
                  )}

                  {selectedDiscount.min_purchase_amount > 0 && (
                    <div className="rounded-xl bg-muted/30 border border-border/30 p-3.5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">الحد الأدنى للطلب</p>
                        <p className="text-[11px] text-muted-foreground">{selectedDiscount.min_purchase_amount.toLocaleString()} د.ع</p>
                      </div>
                    </div>
                  )}

                  {selectedDiscount.gift_description && (
                    <div className="rounded-xl bg-muted/30 border border-border/30 p-3.5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Gift className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">الهدية</p>
                        <p className="text-[11px] text-muted-foreground">{selectedDiscount.gift_description}</p>
                      </div>
                    </div>
                  )}

                  {selectedDiscount.valid_until && (
                    <div className="rounded-xl bg-muted/30 border border-border/30 p-3.5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                        <Clock className="h-5 w-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">صالح حتى</p>
                        <p className="text-[11px] text-muted-foreground">{format(new Date(selectedDiscount.valid_until), "d MMMM yyyy", { locale: ar })}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="p-5 pt-3 border-t border-border/30">
                  <Button
                    className="w-full h-12 gap-2 rounded-2xl text-sm font-black shadow-lg shadow-primary/20"
                    onClick={() => {
                      navigate(`/community/store/${selectedDiscount.merchant_id}`);
                      setSelectedDiscount(null);
                    }}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    تسوّق من المتجر
                  </Button>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      <Footer />
    </div>
  );
}
