import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Percent, Truck, Gift, Tag, Copy, Store, Clock, Ticket } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import Footer from "@/components/Footer";

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

const couponIcons: Record<string, typeof Percent> = {
  percentage: Percent,
  free_delivery: Truck,
  free_product: Gift,
  fixed_amount: Tag,
};

const couponLabels: Record<string, string> = {
  percentage: "خصم نسبة",
  free_delivery: "توصيل مجاني",
  free_product: "منتج هدية",
  fixed_amount: "خصم مبلغ",
};

export default function CustomerSpecialCoupons() {
  const navigate = useNavigate();

  const { data: coupons, isLoading } = useQuery({
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

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("تم نسخ الكود! 📋");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-primary/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
              <Ticket className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground">كوبونات خاصة</h1>
              <p className="text-[10px] text-muted-foreground">عروض حصرية لعملاء ليفو</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <main className="flex-1 px-4 py-4 space-y-5">
        {/* Hero Banner */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-bl from-primary/15 via-card to-card border border-primary/15">
          <div className="absolute top-0 left-0 w-32 h-32 bg-primary/5 rounded-full -translate-x-10 -translate-y-10 blur-2xl" />
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-primary/8 rounded-full translate-x-8 translate-y-8 blur-xl" />
          
          <div className="relative px-5 py-6 flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <h2 className="text-base font-bold text-foreground leading-snug">عروض حصرية لك<br/><span className="text-primary text-sm font-semibold">وفّر مع كل طلب</span></h2>
              <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[200px]">
                كوبونات وخصومات خاصة من متاجر مجتمع ليفو. استخدمها الآن!
              </p>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 border border-primary/20 flex items-center justify-center shrink-0">
              <Ticket className="h-7 w-7 text-primary" />
            </div>
          </div>
        </div>

        {/* Coupons */}
        {coupons && coupons.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                الكوبونات المتاحة
              </h3>
              <span className="text-[10px] text-muted-foreground border border-border/30 rounded px-1.5 py-0.5">{coupons.length}</span>
            </div>

            <div className="space-y-2.5">
              {coupons.map((coupon) => {
                const Icon = couponIcons[coupon.coupon_type] || Percent;
                const label = couponLabels[coupon.coupon_type] || "خصم";
                return (
                  <div key={coupon.id} className="rounded-xl border border-border/40 bg-card overflow-hidden hover:border-primary/20 transition-all">
                    <div className="flex">
                      {/* Coupon Value Side */}
                      <div className="w-[72px] shrink-0 flex flex-col items-center justify-center py-3 bg-gradient-to-b from-primary/10 to-primary/5 border-l border-dashed border-border/30 relative">
                        {/* Top circle cutout effect */}
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-background" />
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-background" />
                        
                        <Icon className="h-4 w-4 text-primary mb-1.5" />
                        {coupon.coupon_type === "percentage" && coupon.discount_value > 0 && (
                          <span className="text-lg font-bold text-primary leading-none">{coupon.discount_value}%</span>
                        )}
                        {coupon.coupon_type === "fixed_amount" && coupon.discount_value > 0 && (
                          <span className="text-xs font-bold text-primary">{coupon.discount_value}<span className="text-[9px]"> د.ع</span></span>
                        )}
                        {coupon.coupon_type === "free_delivery" && (
                          <span className="text-[10px] font-bold text-primary">مجاني</span>
                        )}
                        {coupon.coupon_type === "free_product" && (
                          <span className="text-[10px] font-bold text-primary">هدية</span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-xs text-foreground line-clamp-1">{coupon.title_ar}</h4>
                          <Badge variant="outline" className="text-[9px] border-primary/15 text-primary shrink-0 px-1.5 py-0">
                            {label}
                          </Badge>
                        </div>

                        {coupon.description_ar && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{coupon.description_ar}</p>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <div className="flex items-center gap-2">
                            {coupon.coupon_code && (
                              <button
                                className="flex items-center gap-1 text-[10px] font-mono text-primary bg-primary/8 border border-dashed border-primary/20 rounded-md px-2 py-1 hover:bg-primary/12 transition-colors active:scale-95"
                                onClick={() => copyCode(coupon.coupon_code!)}
                              >
                                <Copy className="h-2.5 w-2.5" />
                                {coupon.coupon_code}
                              </button>
                            )}
                            {coupon.merchant_store_name && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Store className="h-2.5 w-2.5" />
                                {coupon.merchant_store_name}
                              </span>
                            )}
                          </div>
                          {coupon.valid_until && (
                            <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground shrink-0">
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

        {/* Empty State */}
        {!isLoading && (!coupons || coupons.length === 0) && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center mx-auto mb-4">
              <Ticket className="h-8 w-8 text-primary/40" />
            </div>
            <p className="text-foreground font-bold text-sm">لا توجد كوبونات حالياً</p>
            <p className="text-[11px] text-muted-foreground mt-1.5 max-w-[180px] mx-auto">ترقب العروض الحصرية القادمة من متاجر مجتمع ليفو</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
