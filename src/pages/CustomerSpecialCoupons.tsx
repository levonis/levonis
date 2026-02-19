import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Percent, Truck, Gift, Tag, Copy, CheckCircle, Store } from "lucide-react";
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

const couponTypeConfig: Record<string, { icon: typeof Percent; label: string; color: string; bg: string }> = {
  percentage: { icon: Percent, label: "خصم نسبة", color: "text-blue-600", bg: "bg-blue-500/10" },
  free_delivery: { icon: Truck, label: "توصيل مجاني", color: "text-green-600", bg: "bg-green-500/10" },
  free_product: { icon: Gift, label: "منتج هدية", color: "text-purple-600", bg: "bg-purple-500/10" },
  fixed_amount: { icon: Tag, label: "خصم مبلغ", color: "text-amber-600", bg: "bg-amber-500/10" },
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

  const getTypeConfig = (type: string) =>
    couponTypeConfig[type] || couponTypeConfig.percentage;

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
              <Tag className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">كوبونات خاصة</h1>
              <p className="text-xs text-muted-foreground">عروض حصرية لعملاء ليفو</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <main className="flex-1 px-4 py-4 space-y-4">
        {/* Coupons Grid */}
        {coupons?.map((coupon) => {
          const config = getTypeConfig(coupon.coupon_type);
          const Icon = config.icon;
          return (
            <Card key={coupon.id} className="overflow-hidden border-border/50 hover:border-primary/20 transition-all">
              <CardContent className="p-0">
                <div className="flex">
                  {/* Coupon Type Visual */}
                  <div className={`w-20 shrink-0 ${config.bg} flex flex-col items-center justify-center p-3 border-l border-dashed border-border`}>
                    <Icon className={`h-6 w-6 ${config.color}`} />
                    {coupon.coupon_type === "percentage" && coupon.discount_value > 0 && (
                      <span className={`text-lg font-bold ${config.color} mt-1`}>{coupon.discount_value}%</span>
                    )}
                    {coupon.coupon_type === "fixed_amount" && coupon.discount_value > 0 && (
                      <span className={`text-xs font-bold ${config.color} mt-1`}>{coupon.discount_value} د.ع</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm text-foreground line-clamp-1">{coupon.title_ar}</h3>
                      <Badge className={`${config.bg} ${config.color} border-0 text-[10px] shrink-0`}>
                        {config.label}
                      </Badge>
                    </div>

                    {coupon.description_ar && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{coupon.description_ar}</p>
                    )}

                    {coupon.merchant_store_name && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Store className="h-3 w-3" />
                        <span>{coupon.merchant_store_name}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      {coupon.coupon_code && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 border-dashed"
                          onClick={() => copyCode(coupon.coupon_code!)}
                        >
                          <Copy className="h-3 w-3" />
                          {coupon.coupon_code}
                        </Button>
                      )}
                      {coupon.valid_until && (
                        <span className="text-[10px] text-muted-foreground">
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

        {/* Empty State */}
        {!isLoading && (!coupons || coupons.length === 0) && (
          <div className="text-center py-16">
            <Tag className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">لا توجد كوبونات حالياً</p>
            <p className="text-xs text-muted-foreground/70 mt-1">ترقب العروض الحصرية القادمة</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
