import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Percent, Truck, Gift, Tag, Copy, Store, Sparkles, Clock } from "lucide-react";
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
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-lg border-b border-border/40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Tag className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">كوبونات خاصة</h1>
              <p className="text-[11px] text-muted-foreground">عروض حصرية لعملاء ليفو</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl hover:bg-card" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <main className="flex-1 px-4 py-5 space-y-5">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-6 text-center">
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-2 right-6 w-20 h-20 rounded-full border-2 border-primary" />
            <div className="absolute bottom-2 left-6 w-16 h-16 rounded-full border border-primary" />
          </div>
          <div className="relative space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">عروض حصرية لك</h2>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-[240px] mx-auto leading-relaxed">
                كوبونات وخصومات خاصة من متاجر مجتمع ليفو. استخدمها الآن!
              </p>
            </div>
          </div>
        </div>

        {/* Coupons */}
        {coupons && coupons.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-primary" />
              <h3 className="font-bold text-foreground text-sm">الكوبونات المتاحة</h3>
              <Badge variant="outline" className="text-[10px] mr-auto border-border/50">{coupons.length}</Badge>
            </div>

            {coupons.map((coupon) => {
              const Icon = couponIcons[coupon.coupon_type] || Percent;
              const label = couponLabels[coupon.coupon_type] || "خصم";
              return (
                <Card key={coupon.id} className="overflow-hidden border-border/50 hover:border-primary/20 transition-all">
                  <CardContent className="p-0">
                    <div className="flex">
                      {/* Left accent strip */}
                      <div className="w-1.5 shrink-0 bg-primary/60 rounded-r-lg" />

                      {/* Icon section */}
                      <div className="w-20 shrink-0 flex flex-col items-center justify-center p-3 border-l border-dashed border-border/40">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-1.5">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        {coupon.coupon_type === "percentage" && coupon.discount_value > 0 && (
                          <span className="text-base font-bold text-primary">{coupon.discount_value}%</span>
                        )}
                        {coupon.coupon_type === "fixed_amount" && coupon.discount_value > 0 && (
                          <span className="text-xs font-bold text-primary">{coupon.discount_value} د.ع</span>
                        )}
                        {coupon.coupon_type === "free_delivery" && (
                          <span className="text-[10px] font-bold text-primary">مجاني</span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-sm text-foreground line-clamp-1">{coupon.title_ar}</h3>
                          <Badge variant="outline" className="text-[10px] shrink-0 border-primary/20 text-primary">
                            {label}
                          </Badge>
                        </div>

                        {coupon.description_ar && (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{coupon.description_ar}</p>
                        )}

                        {coupon.merchant_store_name && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Store className="h-3 w-3" />
                            <span>{coupon.merchant_store_name}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          {coupon.coupon_code ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] gap-1.5 border-dashed border-primary/30 text-primary hover:bg-primary/5 rounded-lg"
                              onClick={() => copyCode(coupon.coupon_code!)}
                            >
                              <Copy className="h-3 w-3" />
                              {coupon.coupon_code}
                            </Button>
                          ) : <div />}
                          {coupon.valid_until && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              حتى {format(new Date(coupon.valid_until), "d MMM", { locale: ar })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!coupons || coupons.length === 0) && (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
              <Tag className="h-10 w-10 text-primary/50" />
            </div>
            <p className="text-foreground font-bold text-base">لا توجد كوبونات حالياً</p>
            <p className="text-xs text-muted-foreground mt-2 max-w-[200px] mx-auto">ترقب العروض الحصرية القادمة من متاجر مجتمع ليفو</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
