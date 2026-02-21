import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, ShoppingBag, Trash2, Plus, Minus, Store, 
  Package, ShoppingCart, Truck, Loader2, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import OptimizedImage from "@/components/OptimizedImage";
import Footer from "@/components/Footer";

interface CartItem {
  id: string;
  user_id: string;
  merchant_id: string;
  merchant_name: string | null;
  product_id: string;
  product_title: string;
  product_image: string | null;
  product_price: number;
  quantity: number;
  notes: string | null;
  discount_id: string | null;
}

export default function CommunityCart() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: cartItems = [], isLoading } = useQuery({
    queryKey: ["community-cart", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_cart_items")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CartItem[];
    },
  });

  const merchantIds = [...new Set(cartItems.map(i => i.merchant_id))];
  const { data: merchantDeliveryPrices = {} } = useQuery({
    queryKey: ["merchant-delivery-prices", merchantIds],
    enabled: merchantIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("merchant_public_profiles")
        .select("id, delivery_price_iqd")
        .in("id", merchantIds);
      const map: Record<string, number | null> = {};
      data?.forEach(m => { map[m.id] = m.delivery_price_iqd; });
      return map;
    },
  });

  const getDeliveryPrice = (merchantId: string): number => {
    const merchantPrice = merchantDeliveryPrices[merchantId];
    if (merchantPrice !== null && merchantPrice !== undefined) return merchantPrice;
    return 5000;
  };

  const groupedItems = useMemo(() => {
    const groups: Record<string, { merchantName: string; merchantId: string; items: CartItem[]; deliveryPrice: number }> = {};
    cartItems.forEach(item => {
      if (!groups[item.merchant_id]) {
        groups[item.merchant_id] = {
          merchantName: item.merchant_name || "متجر",
          merchantId: item.merchant_id,
          items: [],
          deliveryPrice: getDeliveryPrice(item.merchant_id),
        };
      }
      groups[item.merchant_id].items.push(item);
    });
    return Object.values(groups);
  }, [cartItems, merchantDeliveryPrices]);

  const productsTotal = cartItems.reduce((sum, item) => sum + (item.product_price * item.quantity), 0);
  const deliveryTotal = groupedItems.reduce((sum, g) => sum + g.deliveryPrice, 0);
  const totalPrice = productsTotal + deliveryTotal;
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const updateQuantity = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      if (quantity <= 0) {
        const { error } = await supabase.from("community_cart_items").delete().eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("community_cart_items").update({ quantity }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["community-cart"] }),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("community_cart_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-cart"] });
      toast.success("تم الحذف");
    },
  });

  const clearCart = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("community_cart_items").delete().eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-cart"] });
      toast.success("تم تفريغ السلة");
    },
  });

  const [orderingMerchant, setOrderingMerchant] = useState<string | null>(null);

  const placeOrderMutation = useMutation({
    mutationFn: async (merchantId: string) => {
      if (!user) throw new Error('غير مسجل الدخول');
      setOrderingMerchant(merchantId);
      
      const group = groupedItems.find(g => g.merchantId === merchantId);
      if (!group) throw new Error('لا توجد منتجات');

      const { data: merchantApp, error: merchantError } = await supabase
        .from('merchant_applications')
        .select('user_id, display_name')
        .eq('id', merchantId)
        .eq('status', 'approved')
        .single();
      if (merchantError || !merchantApp) throw new Error('التاجر غير موجود');

      const sellerUserId = merchantApp.user_id;

      const { data: existingConvs } = await supabase
        .from('listing_conversations')
        .select('id')
        .or(`and(buyer_id.eq.${user.id},seller_id.eq.${sellerUserId}),and(buyer_id.eq.${sellerUserId},seller_id.eq.${user.id})`);

      let conversationId: string;
      if (existingConvs && existingConvs.length > 0) {
        conversationId = existingConvs[0].id;
        await supabase.from('listing_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      } else {
        const convCode = `CONV-${Date.now().toString(36).toUpperCase()}`;
        const { data: newConv, error: convError } = await supabase
          .from('listing_conversations')
          .insert({
            buyer_id: user.id,
            seller_id: sellerUserId,
            listing_id: merchantId,
            conversation_code: convCode,
            status: 'open',
          })
          .select('id')
          .single();
        if (convError) throw convError;
        conversationId = newConv.id;
      }

      const itemsSummary = group.items.map(i => 
        `${i.product_title} (×${i.quantity}) - ${(i.product_price * i.quantity).toLocaleString()} د.ع`
      ).join('\n');
      const productsTotal = group.items.reduce((s, i) => s + i.product_price * i.quantity, 0);
      const firstItem = group.items[0];

      const { data: order, error: orderError } = await supabase
        .from('chat_orders' as any)
        .insert({
          conversation_id: conversationId,
          product_id: firstItem.product_id,
          product_title: group.items.length === 1 ? firstItem.product_title : `طلب من ${group.merchantName} (${group.items.length} منتجات)`,
          product_image: firstItem.product_image,
          quantity: group.items.length === 1 ? firstItem.quantity : group.items.reduce((s, i) => s + i.quantity, 0),
          unit_price: group.items.length === 1 ? firstItem.product_price : productsTotal,
          total_price: productsTotal,
          description: group.items.length > 1 ? itemsSummary : null,
          seller_id: sellerUserId,
          customer_id: user.id,
          status: 'waiting_payment',
        })
        .select()
        .single();

      if (orderError) throw orderError;
      return { orderId: (order as any).id, conversationId, merchantName: group.merchantName };
    },
    onSuccess: ({ orderId }) => {
      navigate(`/community/checkout/${orderId}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'فشل إنشاء الطلب');
      setOrderingMerchant(null);
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background" dir="rtl">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-card border border-primary/20 flex items-center justify-center">
              <ShoppingBag className="h-7 w-7 text-primary/30" />
            </div>
            <p className="font-bold">سجّل دخولك لعرض السلة</p>
            <Button onClick={() => navigate("/auth")} className="rounded-full">تسجيل الدخول</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-muted/20" dir="rtl">
      {/* Minimal Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-sm font-bold text-foreground">سلة التسوق</h1>
              {totalItems > 0 && (
                <p className="text-[10px] text-muted-foreground leading-tight">{totalItems} منتج</p>
              )}
            </div>
          </div>
          {cartItems.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full px-3 gap-1.5"
              onClick={() => clearCart.mutate()}
            >
              <Trash2 className="h-3 w-3" />
              تفريغ
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-3 pb-40">
        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && cartItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-[28px] bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                <ShoppingCart className="h-10 w-10 text-primary/25" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground/50" />
              </div>
            </div>
            <p className="font-bold text-foreground mb-1">سلتك فارغة</p>
            <p className="text-xs text-muted-foreground mb-5">اكتشف المنتجات وأضفها لسلتك</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="rounded-full gap-2 border-primary/30 text-primary hover:bg-primary/5" 
              onClick={() => navigate("/community")}
            >
              <Store className="h-3.5 w-3.5" />
              تصفح المتاجر
            </Button>
          </div>
        )}

        {/* Merchant Groups */}
        {groupedItems.map((group) => {
          const groupTotal = group.items.reduce((s, i) => s + i.product_price * i.quantity, 0);
          const groupGrandTotal = groupTotal + group.deliveryPrice;

          return (
            <div key={group.merchantId} className="rounded-2xl bg-card border border-border/40 overflow-hidden">
              {/* Merchant Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                <button 
                  className="flex items-center gap-2.5"
                  onClick={() => navigate(`/community/store/${group.merchantId}`)}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Store className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-foreground leading-tight">{group.merchantName}</p>
                    <p className="text-[10px] text-muted-foreground">{group.items.length} منتج</p>
                  </div>
                </button>
              </div>

              {/* Items */}
              <div className="divide-y divide-border/20">
                {group.items.map((item) => (
                  <div key={item.id} className="flex gap-3 p-3">
                    {/* Image */}
                    <div className="w-[68px] h-[68px] rounded-xl overflow-hidden bg-muted shrink-0">
                      {item.product_image ? (
                        <OptimizedImage src={item.product_image} alt={item.product_title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground/25" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        <h4 className="text-[11px] font-semibold text-foreground line-clamp-1 leading-tight">{item.product_title}</h4>
                        <p className="text-[13px] font-bold text-primary mt-0.5">
                          {item.product_price.toLocaleString()} <span className="text-[9px] font-normal text-muted-foreground">د.ع</span>
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-1">
                        {/* Quantity Controls */}
                        <div className="flex items-center h-7 rounded-lg border border-border/50 overflow-hidden bg-muted/20">
                          <button
                            className="h-full w-7 flex items-center justify-center hover:bg-muted active:bg-muted/80 transition-colors"
                            onClick={() => updateQuantity.mutate({ id: item.id, quantity: item.quantity - 1 })}
                          >
                            {item.quantity === 1 ? <Trash2 className="h-3 w-3 text-destructive/70" /> : <Minus className="h-3 w-3" />}
                          </button>
                          <span className="w-7 text-center text-[11px] font-bold select-none">{item.quantity}</span>
                          <button
                            className="h-full w-7 flex items-center justify-center hover:bg-muted active:bg-muted/80 transition-colors"
                            onClick={() => updateQuantity.mutate({ id: item.id, quantity: item.quantity + 1 })}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Subtotal */}
                        <span className="text-[11px] font-bold text-foreground/70">
                          {(item.product_price * item.quantity).toLocaleString()} د.ع
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer: Summary + Order Button */}
              <div className="bg-muted/20 border-t border-border/30 p-3 space-y-2.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">المنتجات</span>
                  <span className="font-semibold">{groupTotal.toLocaleString()} د.ع</span>
                </div>
                {group.deliveryPrice > 0 && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      التوصيل
                    </span>
                    <span className="font-semibold">{group.deliveryPrice.toLocaleString()} د.ع</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-border/30">
                  <span className="font-bold">الإجمالي</span>
                  <span className="text-sm font-black text-primary">{groupGrandTotal.toLocaleString()} د.ع</span>
                </div>

                <Button
                  className="w-full h-11 text-xs gap-2 rounded-xl font-bold"
                  onClick={() => placeOrderMutation.mutate(group.merchantId)}
                  disabled={placeOrderMutation.isPending}
                >
                  {orderingMerchant === group.merchantId && placeOrderMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      جاري إنشاء الطلب...
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="h-4 w-4" />
                      اطلب من {group.merchantName}
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </main>

      {/* Bottom Summary */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur-xl border-t border-border/40 px-4 py-3 safe-area-bottom">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground">الإجمالي الكلي</p>
              <p className="text-lg font-black text-primary leading-tight">
                {totalPrice.toLocaleString()} <span className="text-[10px] text-muted-foreground font-normal">د.ع</span>
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground max-w-[140px] text-left leading-tight">
              اختر متجراً أعلاه لإتمام الطلب
            </p>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
