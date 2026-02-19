import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Percent, Truck, Gift, Tag, Copy, Store, Clock, Ticket, Sparkles, CheckCircle } from "lucide-react";
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success("تم نسخ الكود! 📋");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent p-[2px] shadow-lg shadow-primary/20">
              <div className="w-full h-full rounded-[10px] bg-card flex items-center justify-center">
                <Ticket className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div>
              <h1 className="text-sm font-black text-foreground tracking-tight">كوبونات خاصة</h1>
              <p className="text-[10px] text-muted-foreground">عروض حصرية لعملاء ليفو</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl hover:bg-accent" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <main className="flex-1 px-4 py-5 space-y-6">
        {/* Hero Banner */}
        <div className="relative rounded-2xl overflow-hidden border border-primary/20 bg-card">
          <div className="absolute inset-0 bg-gradient-to-bl from-primary/10 via-transparent to-accent/5" />
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/8 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          
          <div className="relative px-5 py-7 flex items-center gap-4">
            <div className="flex-1 space-y-3">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1">
                <Sparkles className="h-3 w-3" />
                عروض حصرية
              </div>
              <h2 className="text-lg font-black text-foreground leading-tight">
                وفّر مع كل طلب
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">
                كوبونات وخصومات خاصة من متاجر مجتمع ليفو. استخدمها الآن!
              </p>
            </div>
            <div className="relative w-20 h-20 shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 blur-xl" />
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-xl">
                <Ticket className="h-9 w-9 text-primary-foreground" />
              </div>
            </div>
          </div>
        </div>

        {/* Coupons */}
        {coupons && coupons.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <h3 className="text-sm font-black text-foreground">الكوبونات المتاحة</h3>
              </div>
              <Badge variant="outline" className="text-[10px] border-border/40">{coupons.length} كوبون</Badge>
            </div>

            <div className="space-y-3">
              {coupons.map((coupon) => {
                const Icon = couponIcons[coupon.coupon_type] || Percent;
                const label = couponLabels[coupon.coupon_type] || "خصم";
                const isCopied = copiedId === coupon.id;
                
                return (
                  <div key={coupon.id} className="rounded-2xl border border-border/40 bg-card overflow-hidden hover:border-primary/25 hover:shadow-md transition-all duration-300">
                    <div className="flex">
                      {/* Coupon Value Side */}
                      <div className="w-20 shrink-0 flex flex-col items-center justify-center py-4 bg-gradient-to-b from-primary/12 to-primary/5 border-l border-dashed border-border/30 relative">
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-background" />
                        <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-background" />
                        
                        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mb-2">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        {coupon.coupon_type === "percentage" && coupon.discount_value > 0 && (
                          <span className="text-xl font-black text-primary leading-none">{coupon.discount_value}%</span>
                        )}
                        {coupon.coupon_type === "fixed_amount" && coupon.discount_value > 0 && (
                          <span className="text-sm font-black text-primary">{coupon.discount_value}<span className="text-[9px]"> د.ع</span></span>
                        )}
                        {coupon.coupon_type === "free_delivery" && (
                          <span className="text-[11px] font-black text-primary">مجاني</span>
                        )}
                        {coupon.coupon_type === "free_product" && (
                          <span className="text-[11px] font-black text-primary">هدية</span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-4 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-black text-sm text-foreground line-clamp-1">{coupon.title_ar}</h4>
                          <Badge className="text-[9px] bg-primary/10 text-primary border-0 shrink-0 px-2">
                            {label}
                          </Badge>
                        </div>

                        {coupon.description_ar && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{coupon.description_ar}</p>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-2.5">
                            {coupon.coupon_code && (
                              <button
                                className={`flex items-center gap-1.5 text-[11px] font-mono rounded-lg px-3 py-1.5 transition-all active:scale-95 ${
                                  isCopied
                                    ? "bg-primary/15 border border-primary/30 text-primary"
                                    : "bg-muted/50 border border-dashed border-border/50 text-foreground hover:border-primary/30 hover:bg-primary/8"
                                }`}
                                onClick={() => copyCode(coupon.coupon_code!, coupon.id)}
                              >
                                {isCopied ? (
                                  <CheckCircle className="h-3 w-3 text-primary" />
                                ) : (
                                  <Copy className="h-3 w-3 text-muted-foreground" />
                                )}
                                {coupon.coupon_code}
                              </button>
                            )}
                            {coupon.merchant_store_name && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Store className="h-3 w-3" />
                                {coupon.merchant_store_name}
                              </span>
                            )}
                          </div>
                          {coupon.valid_until && (
                            <span className="flex items-center gap-1 text-[9px] text-muted-foreground shrink-0">
                              <Clock className="h-3 w-3" />
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
          <div className="text-center py-20">
            <div className="relative w-20 h-20 mx-auto mb-5">
              <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl" />
              <div className="relative w-20 h-20 rounded-2xl bg-card border border-primary/20 flex items-center justify-center">
                <Ticket className="h-9 w-9 text-primary/40" />
              </div>
            </div>
            <p className="text-foreground font-black text-base">لا توجد كوبونات حالياً</p>
            <p className="text-xs text-muted-foreground mt-2 max-w-[200px] mx-auto leading-relaxed">
              ترقب العروض الحصرية القادمة من متاجر مجتمع ليفو
            </p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
