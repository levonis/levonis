import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, Percent, Truck, Gift, Tag, Copy, Store, Clock, Ticket, 
  Sparkles, CheckCircle, ShoppingBag, Crown, ChevronLeft, Package
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import Footer from "@/components/Footer";
import OptimizedImage from "@/components/OptimizedImage";

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

  const isLoading = couponsLoading || discountsLoading;
  const hasContent = (coupons && coupons.length > 0) || (storeDiscounts && storeDiscounts.length > 0);

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-black text-foreground">عروض وخصومات</h1>
              <p className="text-[10px] text-muted-foreground">وفّر مع كل طلب من مجتمع ليفو</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-[10px] border-primary/30 text-primary rounded-lg px-2"
                onClick={() => navigate('/community/cart')}
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                السلة
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 px-4 py-4 space-y-5">
        {/* Merchant Store Discounts - Horizontal Strip */}
        {storeDiscounts && storeDiscounts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-black text-foreground">عروض المتاجر</h2>
              </div>
              <Badge variant="outline" className="text-[9px]">{storeDiscounts.length} عرض</Badge>
            </div>

            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
              {storeDiscounts.map((discount) => {
                const Icon = discountIcons[discount.discount_type] || Percent;
                const gradientClass = discountColors[discount.discount_type] || "from-primary to-primary/70";

                return (
                  <div
                    key={discount.id}
                    className="shrink-0 w-[160px] cursor-pointer group"
                    onClick={() => setSelectedDiscount(discount)}
                  >
                    <div className="rounded-2xl overflow-hidden border border-border/40 bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                      {/* Gradient top */}
                      <div className={`relative h-20 bg-gradient-to-br ${gradientClass} p-3 flex flex-col justify-between`}>
                        <div className="flex items-center justify-between">
                          <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <Icon className="h-3.5 w-3.5 text-white" />
                          </div>
                          <span className="text-lg font-black text-white leading-none">
                            {getDiscountDisplay(discount)}
                          </span>
                        </div>
                        <p className="text-[9px] text-white/80 font-bold truncate">
                          {discountLabels[discount.discount_type]}
                        </p>
                      </div>
                      
                      {/* Content */}
                      <div className="p-2.5 space-y-1.5">
                        <h4 className="text-[11px] font-bold text-foreground line-clamp-1">{discount.title_ar}</h4>
                        {discount.merchant_store_name && (
                          <div className="flex items-center gap-1">
                            <Store className="h-2.5 w-2.5 text-muted-foreground" />
                            <span className="text-[9px] text-muted-foreground truncate">{discount.merchant_store_name}</span>
                          </div>
                        )}
                        {discount.min_purchase_amount > 0 && (
                          <div className="text-[9px] text-primary font-bold">
                            عند شراء {discount.min_purchase_amount.toLocaleString()} د.ع+
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Admin Coupons */}
        {coupons && coupons.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-black text-foreground">كوبونات خاصة</h2>
              </div>
              <Badge variant="outline" className="text-[9px]">{coupons.length} كوبون</Badge>
            </div>

            <div className="space-y-2.5">
              {coupons.map((coupon) => {
                const Icon = discountIcons[coupon.coupon_type] || Percent;
                const label = discountLabels[coupon.coupon_type] || "خصم";
                const isCopied = copiedId === coupon.id;

                return (
                  <div key={coupon.id} className="rounded-xl border border-border/40 bg-card overflow-hidden hover:border-primary/20 transition-all">
                    <div className="flex">
                      {/* Value side */}
                      <div className="w-[72px] shrink-0 flex flex-col items-center justify-center py-3 bg-gradient-to-b from-primary/10 to-primary/5 border-l border-dashed border-border/30 relative">
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-background" />
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-background" />
                        <Icon className="h-5 w-5 text-primary mb-1" />
                        {coupon.coupon_type === "percentage" && coupon.discount_value > 0 && (
                          <span className="text-lg font-black text-primary">{coupon.discount_value}%</span>
                        )}
                        {coupon.coupon_type === "fixed_amount" && coupon.discount_value > 0 && (
                          <span className="text-xs font-black text-primary">{coupon.discount_value}<span className="text-[8px]"> د.ع</span></span>
                        )}
                        {coupon.coupon_type === "free_delivery" && (
                          <span className="text-[10px] font-black text-primary">مجاني</span>
                        )}
                        {coupon.coupon_type === "free_product" && (
                          <span className="text-[10px] font-black text-primary">هدية</span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-xs text-foreground line-clamp-1">{coupon.title_ar}</h4>
                          <Badge className="text-[8px] bg-primary/10 text-primary border-0 shrink-0 px-1.5">{label}</Badge>
                        </div>
                        {coupon.description_ar && (
                          <p className="text-[10px] text-muted-foreground line-clamp-2">{coupon.description_ar}</p>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {coupon.coupon_code && (
                              <button
                                className={`flex items-center gap-1 text-[10px] font-mono rounded-lg px-2 py-1 transition-all active:scale-95 ${
                                  isCopied
                                    ? "bg-primary/15 border border-primary/30 text-primary"
                                    : "bg-muted/50 border border-dashed border-border/50 text-foreground hover:border-primary/30"
                                }`}
                                onClick={() => copyCode(coupon.coupon_code!, coupon.id)}
                              >
                                {isCopied ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                {coupon.coupon_code}
                              </button>
                            )}
                            {coupon.merchant_store_name && (
                              <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                <Store className="h-2.5 w-2.5" />
                                {coupon.merchant_store_name}
                              </span>
                            )}
                          </div>
                          {coupon.valid_until && (
                            <span className="flex items-center gap-1 text-[8px] text-muted-foreground">
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
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && !hasContent && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-card border border-primary/20 flex items-center justify-center mx-auto mb-4">
              <Ticket className="h-7 w-7 text-primary/40" />
            </div>
            <p className="text-foreground font-bold text-sm">لا توجد عروض حالياً</p>
            <p className="text-[11px] text-muted-foreground mt-1">ترقب العروض القادمة من متاجر المجتمع</p>
          </div>
        )}
      </main>

      {/* Store Discount Detail Sheet */}
      <Sheet open={!!selectedDiscount} onOpenChange={() => setSelectedDiscount(null)}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
          {selectedDiscount && (
            <>
              <SheetHeader className="border-b pb-3">
                <SheetTitle className="text-base">{selectedDiscount.title_ar}</SheetTitle>
              </SheetHeader>
              <div className="py-4 space-y-4 overflow-y-auto">
                {/* Discount Card */}
                <div className={`rounded-2xl bg-gradient-to-br ${discountColors[selectedDiscount.discount_type] || "from-primary to-primary/70"} p-5 text-white`}>
                  <div className="flex items-center justify-between mb-3">
                    <Badge className="bg-white/20 text-white border-0 text-xs">
                      {discountLabels[selectedDiscount.discount_type]}
                    </Badge>
                    {selectedDiscount.valid_until && (
                      <span className="text-[10px] text-white/70 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        حتى {format(new Date(selectedDiscount.valid_until), "d MMM yyyy", { locale: ar })}
                      </span>
                    )}
                  </div>
                  <div className="text-3xl font-black mb-1">
                    {getDiscountDisplay(selectedDiscount)}
                  </div>
                  {selectedDiscount.merchant_store_name && (
                    <div className="flex items-center gap-1.5 text-white/80 text-sm">
                      <Store className="h-4 w-4" />
                      {selectedDiscount.merchant_store_name}
                    </div>
                  )}
                </div>

                {/* Details */}
                {selectedDiscount.description_ar && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{selectedDiscount.description_ar}</p>
                )}

                {selectedDiscount.min_purchase_amount > 0 && (
                  <div className="rounded-xl bg-muted/50 border border-border/40 p-3 flex items-center gap-3">
                    <Package className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-foreground">الحد الأدنى للطلب</p>
                      <p className="text-[11px] text-muted-foreground">{selectedDiscount.min_purchase_amount.toLocaleString()} د.ع</p>
                    </div>
                  </div>
                )}

                {selectedDiscount.gift_description && (
                  <div className="rounded-xl bg-muted/50 border border-border/40 p-3 flex items-center gap-3">
                    <Gift className="h-5 w-5 text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-foreground">الهدية</p>
                      <p className="text-[11px] text-muted-foreground">{selectedDiscount.gift_description}</p>
                    </div>
                  </div>
                )}

                {/* Action */}
                <Button
                  className="w-full h-11 gap-2 rounded-xl text-sm font-bold"
                  onClick={() => {
                    navigate(`/community/store/${selectedDiscount.merchant_id}`);
                    setSelectedDiscount(null);
                  }}
                >
                  <ShoppingBag className="h-4 w-4" />
                  تسوّق من المتجر
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Footer />
    </div>
  );
}
