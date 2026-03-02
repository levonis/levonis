import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Ticket, Percent, Tag, Truck, Gift, Store, Clock, Copy,
  CheckCircle, Sparkles, Package, ChevronLeft, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface CouponsPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export default function CouponsPopup({ open, onOpenChange }: CouponsPopupProps) {
  const navigate = useNavigate();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedDiscount, setSelectedDiscount] = useState<StoreDiscount | null>(null);

  const { data: coupons, isLoading: couponsLoading } = useQuery({
    queryKey: ["customer-special-coupons-popup"],
    enabled: open,
    staleTime: 30_000,
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

  const { data: storeDiscounts, isLoading: discountsLoading } = useQuery({
    queryKey: ["store-discounts-popup"],
    enabled: open,
    staleTime: 30_000,
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
      case 'percentage': case 'min_purchase_percentage': return `${d.discount_value}%`;
      case 'fixed_amount': return `${d.discount_value?.toLocaleString()} د.ع`;
      case 'free_delivery': case 'min_purchase_delivery': return 'مجاني';
      case 'free_gift': return 'هدية';
      default: return '';
    }
  };

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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-hidden p-0" dir="rtl">
          {/* Header */}
          <div className="sticky top-0 z-10 px-5 pt-5 pb-3 bg-gradient-to-b from-card to-card/95 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                  <Sparkles className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <span className="text-sm font-black">العروض والخصومات</span>
                  <p className="text-[9px] text-muted-foreground font-normal mt-0.5">وفّر مع كل طلب</p>
                </div>
              </DialogTitle>
            </DialogHeader>

            {/* Stats chips */}
            {!isLoading && hasContent && (
              <div className="flex items-center gap-2 mt-3 overflow-x-auto scrollbar-hide">
                {discountsByStore.size > 0 && (
                  <div className="flex items-center gap-1.5 bg-primary/10 rounded-full px-2.5 py-1 shrink-0">
                    <Store className="h-2.5 w-2.5 text-primary" />
                    <span className="text-[9px] font-bold text-primary">{discountsByStore.size} متجر</span>
                  </div>
                )}
                {storeDiscounts && storeDiscounts.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2.5 py-1 shrink-0">
                    <Zap className="h-2.5 w-2.5 text-foreground" />
                    <span className="text-[9px] font-bold">{storeDiscounts.length} عرض</span>
                  </div>
                )}
                {coupons && coupons.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2.5 py-1 shrink-0">
                    <Ticket className="h-2.5 w-2.5 text-foreground" />
                    <span className="text-[9px] font-bold">{coupons.length} كوبون</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[60vh] px-5 pb-5 space-y-4">
            {/* Store Discounts */}
            {Array.from(discountsByStore.entries()).map(([storeName, discounts]) => (
              <section key={storeName} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Store className="h-3 w-3 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[10px] font-black text-foreground truncate">{storeName}</h3>
                    <p className="text-[8px] text-muted-foreground">{discounts.length} عرض</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-5 text-[8px] gap-0.5 text-primary px-1.5"
                    onClick={() => { navigate(`/community/store/${discounts[0].merchant_id}`); onOpenChange(false); }}>
                    زيارة<ChevronLeft className="h-2 w-2" />
                  </Button>
                </div>

                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-5 px-5 snap-x">
                  {discounts.map((discount) => {
                    const Icon = discountIcons[discount.discount_type] || Percent;
                    return (
                      <div key={discount.id} className="shrink-0 w-[140px] snap-start cursor-pointer" onClick={() => setSelectedDiscount(discount)}>
                        <div className="rounded-xl overflow-hidden border border-border/30 bg-card hover:border-primary/30 hover:shadow-lg transition-all">
                          <div className="relative h-12 bg-gradient-to-br from-primary/80 to-primary/40 p-2 flex items-center justify-between">
                            <div className="w-5 h-5 rounded-md bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center">
                              <Icon className="h-2.5 w-2.5 text-primary-foreground" />
                            </div>
                            <span className="text-lg font-black text-primary-foreground leading-none drop-shadow-sm">
                              {getDiscountDisplay(discount)}
                            </span>
                          </div>
                          <div className="p-2 space-y-0.5">
                            <h4 className="text-[9px] font-bold text-foreground line-clamp-1">{discount.title_ar}</h4>
                            {discount.valid_until && (
                              <div className="flex items-center gap-1 text-[7px] text-muted-foreground">
                                <Clock className="h-2 w-2" />
                                {format(new Date(discount.valid_until), "d MMM", { locale: ar })}
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
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                    <Ticket className="h-3 w-3 text-primary" />
                  </div>
                  <h3 className="text-[10px] font-black text-foreground">كوبونات خاصة</h3>
                </div>

                <div className="space-y-1.5">
                  {coupons.map((coupon) => {
                    const Icon = discountIcons[coupon.coupon_type] || Percent;
                    const label = discountLabels[coupon.coupon_type] || "خصم";
                    const isCopied = copiedId === coupon.id;

                    return (
                      <div key={coupon.id} className="rounded-xl border border-border/30 bg-muted/20 overflow-hidden hover:border-primary/20 transition-all">
                        <div className="flex">
                          <div className="w-14 shrink-0 flex flex-col items-center justify-center py-2 bg-gradient-to-b from-primary/10 to-primary/5 border-l border-dashed border-border/30 relative">
                            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-card" />
                            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-card" />
                            <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center mb-0.5">
                              <Icon className="h-3 w-3 text-primary" />
                            </div>
                            {coupon.coupon_type === "percentage" && coupon.discount_value > 0 && (
                              <span className="text-xs font-black text-primary">{coupon.discount_value}%</span>
                            )}
                            {coupon.coupon_type === "fixed_amount" && coupon.discount_value > 0 && (
                              <span className="text-[8px] font-black text-primary">{coupon.discount_value?.toLocaleString()}<span className="text-[6px]"> د.ع</span></span>
                            )}
                            {coupon.coupon_type === "free_delivery" && (
                              <span className="text-[7px] font-black text-primary">مجاني</span>
                            )}
                            {coupon.coupon_type === "free_product" && (
                              <span className="text-[7px] font-black text-primary">هدية</span>
                            )}
                          </div>
                          <div className="flex-1 p-2 space-y-0.5">
                            <div className="flex items-start justify-between gap-1">
                              <h4 className="font-bold text-[9px] text-foreground line-clamp-1">{coupon.title_ar}</h4>
                              <Badge className="text-[6px] bg-primary/10 text-primary border-0 shrink-0 px-1 h-3.5 rounded-md">{label}</Badge>
                            </div>
                            {coupon.description_ar && (
                              <p className="text-[7px] text-muted-foreground line-clamp-1">{coupon.description_ar}</p>
                            )}
                            <div className="flex items-center justify-between gap-1">
                              {coupon.coupon_code && (
                                <button
                                  className={`flex items-center gap-1 text-[7px] font-mono rounded-md px-1.5 py-0.5 transition-all active:scale-95 ${
                                    isCopied ? "bg-primary/15 border border-primary/30 text-primary" : "bg-muted/50 border border-dashed border-border/50 text-foreground hover:border-primary/30"
                                  }`}
                                  onClick={() => copyCode(coupon.coupon_code!, coupon.id)}
                                >
                                  {isCopied ? <CheckCircle className="h-2 w-2" /> : <Copy className="h-2 w-2" />}
                                  {coupon.coupon_code}
                                </button>
                              )}
                              {coupon.valid_until && (
                                <span className="flex items-center gap-0.5 text-[6px] text-muted-foreground">
                                  <Clock className="h-2 w-2" />
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

            {isLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
            )}

            {!isLoading && !hasContent && (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-card to-muted border border-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="h-6 w-6 text-primary/30" />
                </div>
                <p className="text-foreground font-black text-xs">لا توجد عروض حالياً</p>
                <p className="text-[9px] text-muted-foreground mt-1">ترقب العروض القادمة</p>
              </div>
            )}
          </div>

          {/* View all button */}
          {hasContent && (
            <div className="px-5 pb-4">
              <Button
                variant="outline"
                className="w-full h-10 rounded-2xl text-xs font-bold gap-2 border-primary/20 hover:bg-primary/5"
                onClick={() => { navigate("/special-coupons"); onOpenChange(false); }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                عرض الكل
                <ChevronLeft className="h-3 w-3" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Discount Detail Sheet */}
      <Sheet open={!!selectedDiscount} onOpenChange={() => setSelectedDiscount(null)}>
        <SheetContent side="bottom" className="h-[55vh] rounded-t-3xl p-0" dir="rtl">
          {selectedDiscount && (() => {
            const Icon = discountIcons[selectedDiscount.discount_type] || Percent;
            return (
              <div className="flex flex-col h-full">
                <div className="relative bg-gradient-to-br from-primary to-primary/60 px-5 pt-6 pb-4">
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-primary-foreground/30" />
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-primary-foreground/15 backdrop-blur-sm flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 text-[8px] mb-0.5">
                        {discountLabels[selectedDiscount.discount_type]}
                      </Badge>
                      <h2 className="text-primary-foreground font-black text-sm">{selectedDiscount.title_ar}</h2>
                    </div>
                  </div>
                  <div className="text-3xl font-black text-primary-foreground drop-shadow-lg">
                    {getDiscountDisplay(selectedDiscount)}
                  </div>
                  {selectedDiscount.merchant_store_name && (
                    <div className="flex items-center gap-1.5 text-primary-foreground/80 text-[10px] mt-1.5">
                      <Store className="h-3 w-3" />{selectedDiscount.merchant_store_name}
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                  {selectedDiscount.description_ar && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{selectedDiscount.description_ar}</p>
                  )}
                  {selectedDiscount.min_purchase_amount > 0 && (
                    <div className="rounded-xl bg-muted/30 border border-border/30 p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Package className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold">الحد الأدنى</p>
                        <p className="text-[9px] text-muted-foreground">{selectedDiscount.min_purchase_amount.toLocaleString()} د.ع</p>
                      </div>
                    </div>
                  )}
                  {selectedDiscount.gift_description && (
                    <div className="rounded-xl bg-muted/30 border border-border/30 p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Gift className="h-3.5 w-3.5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold">الهدية</p>
                        <p className="text-[9px] text-muted-foreground">{selectedDiscount.gift_description}</p>
                      </div>
                    </div>
                  )}
                  {selectedDiscount.valid_until && (
                    <div className="rounded-xl bg-muted/30 border border-border/30 p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold">صالح حتى</p>
                        <p className="text-[9px] text-muted-foreground">{format(new Date(selectedDiscount.valid_until), "d MMMM yyyy", { locale: ar })}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 pt-2 border-t border-border/30">
                  <Button className="w-full h-10 gap-2 rounded-2xl text-xs font-black shadow-lg shadow-primary/20"
                    onClick={() => { navigate(`/community/store/${selectedDiscount.merchant_id}`); setSelectedDiscount(null); onOpenChange(false); }}>
                    <Store className="h-3.5 w-3.5" />تسوّق من المتجر
                  </Button>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </>
  );
}
