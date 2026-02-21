import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, ShoppingBag, Trash2, Plus, Minus, Store, 
  Package, ShoppingCart, Truck, Loader2, ChevronLeft
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
          <div className="text-center space-y-5 px-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ShoppingBag className="h-8 w-8 text-primary/40" />
            </div>
            <div>
              <p className="font-bold text-foreground text-lg">سجّل دخولك</p>
              <p className="text-sm text-muted-foreground mt-1">لعرض سلة التسوق الخاصة بك</p>
            </div>
            <Button onClick={() => navigate("/auth")} className="rounded-full px-8 h-11 font-bold">
              تسجيل الدخول
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-xl border-b border-primary/10">
        <div className="flex items-center justify-between px-4 h-[56px]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-primary" />
            </button>
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <h1 className="text-base font-bold text-foreground">سلة التسوق</h1>
              {totalItems > 0 && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </div>
          </div>
          {cartItems.length > 0 && (
            <button
              onClick={() => clearCart.mutate()}
              className="text-[11px] text-destructive/80 hover:text-destructive transition-colors flex items-center gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
              مسح الكل
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 pb-36">
        {/* Loading */}
        {isLoading && (
          <div className="px-4 pt-4 space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-10 w-40 rounded-xl" />
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-28 rounded-2xl" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && cartItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-28 px-6">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary/5 to-primary/15 flex items-center justify-center mb-6 border border-primary/10">
              <ShoppingCart className="h-12 w-12 text-primary/20" />
            </div>
            <h2 className="font-bold text-foreground text-lg mb-1">سلتك فارغة</h2>
            <p className="text-sm text-muted-foreground mb-8 text-center max-w-[260px]">
              اكتشف المتاجر وأضف منتجاتك المفضلة
            </p>
            <Button 
              onClick={() => navigate("/community")}
              className="rounded-full gap-2 h-11 px-7 font-bold"
            >
              <Store className="h-4 w-4" />
              تصفح المتاجر
            </Button>
          </div>
        )}

        {/* Merchant Groups */}
        {groupedItems.map((group) => {
          const groupTotal = group.items.reduce((s, i) => s + i.product_price * i.quantity, 0);
          const groupGrandTotal = groupTotal + group.deliveryPrice;

          return (
            <div key={group.merchantId} className="mt-4">
              {/* Merchant Label */}
              <button
                onClick={() => navigate(`/community/store/${group.merchantId}`)}
                className="flex items-center gap-2 px-4 mb-2 group"
              >
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Store className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm font-bold text-foreground">{group.merchantName}</span>
                <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>

              {/* Items */}
              <div className="px-4 space-y-2">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 p-3 rounded-2xl bg-card border border-primary/10 hover:border-primary/20 transition-colors"
                  >
                    {/* Image */}
                    <div className="w-[72px] h-[72px] rounded-xl overflow-hidden bg-background-2 shrink-0 border border-primary/5">
                      {item.product_image ? (
                        <OptimizedImage src={item.product_image} alt={item.product_title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-6 w-6 text-primary/15" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <h4 className="text-[13px] font-semibold text-foreground line-clamp-2 leading-snug">
                          {item.product_title}
                        </h4>
                      </div>

                      <div className="flex items-end justify-between mt-2">
                        {/* Quantity */}
                        <div className="flex items-center h-8 rounded-xl border border-primary/15 overflow-hidden bg-background/50">
                          <button
                            className="h-full w-8 flex items-center justify-center hover:bg-primary/10 active:bg-primary/15 transition-colors"
                            onClick={() => updateQuantity.mutate({ id: item.id, quantity: item.quantity - 1 })}
                          >
                            {item.quantity === 1 ? (
                              <Trash2 className="h-3 w-3 text-destructive/70" />
                            ) : (
                              <Minus className="h-3 w-3 text-muted-foreground" />
                            )}
                          </button>
                          <span className="w-8 text-center text-xs font-bold select-none text-foreground">
                            {item.quantity}
                          </span>
                          <button
                            className="h-full w-8 flex items-center justify-center hover:bg-primary/10 active:bg-primary/15 transition-colors"
                            onClick={() => updateQuantity.mutate({ id: item.id, quantity: item.quantity + 1 })}
                          >
                            <Plus className="h-3 w-3 text-primary" />
                          </button>
                        </div>

                        {/* Price */}
                        <div className="text-left">
                          <p className="text-[15px] font-black text-primary leading-none">
                            {(item.product_price * item.quantity).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">د.ع</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Delivery info */}
                {group.deliveryPrice > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Truck className="h-3.5 w-3.5 text-primary/60" />
                      رسوم التوصيل
                    </span>
                    <span className="text-[11px] font-bold text-foreground">{group.deliveryPrice.toLocaleString()} د.ع</span>
                  </div>
                )}
              </div>

              {/* Order Button */}
              <div className="px-4 mt-3">
                <Button
                  className="w-full h-12 rounded-xl font-bold text-sm gap-2 relative overflow-hidden"
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
                      <span>اطلب من {group.merchantName}</span>
                      <span className="mr-auto text-primary-foreground/70">
                        {groupGrandTotal.toLocaleString()} د.ع
                      </span>
                    </>
                  )}
                </Button>
              </div>

              {/* Divider */}
              <div className="h-px bg-primary/5 mx-4 mt-5" />
            </div>
          );
        })}
      </main>

      {/* Bottom Summary Bar */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 safe-area-bottom">
          <div className="bg-card/95 backdrop-blur-xl border-t border-primary/15 px-5 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">الإجمالي</p>
                <p className="text-xl font-black text-primary leading-tight">
                  {totalPrice.toLocaleString()}
                  <span className="text-xs text-muted-foreground font-normal mr-1">د.ع</span>
                </p>
              </div>
              <div className="text-left">
                <p className="text-[10px] text-muted-foreground">{totalItems} منتج · {groupedItems.length} متجر</p>
                <p className="text-[10px] text-muted-foreground">شامل التوصيل</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
