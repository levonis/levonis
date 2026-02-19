import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, ShoppingBag, Trash2, Plus, Minus, Store, 
  Package, Sparkles, MessageCircle, ShoppingCart
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

  // Group by merchant
  const groupedItems = useMemo(() => {
    const groups: Record<string, { merchantName: string; merchantId: string; items: CartItem[] }> = {};
    cartItems.forEach(item => {
      if (!groups[item.merchant_id]) {
        groups[item.merchant_id] = {
          merchantName: item.merchant_name || "متجر",
          merchantId: item.merchant_id,
          items: [],
        };
      }
      groups[item.merchant_id].items.push(item);
    });
    return Object.values(groups);
  }, [cartItems]);

  const totalPrice = cartItems.reduce((sum, item) => sum + (item.product_price * item.quantity), 0);
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

  const handleOrderFromMerchant = (merchantId: string) => {
    const params = new URLSearchParams();
    params.set("merchant_id", merchantId);
    navigate(`/community/messages?${params.toString()}`);
    toast.success("يمكنك الآن إرسال طلبك للتاجر عبر المحادثة");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background" dir="rtl">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto" />
            <p className="font-bold">سجّل دخولك لعرض السلة</p>
            <Button onClick={() => navigate("/auth")}>تسجيل الدخول</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <ShoppingBag className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-black text-foreground">سلة المجتمع</h1>
              <p className="text-[10px] text-muted-foreground">
                {totalItems > 0 ? `${totalItems} منتج • ${totalPrice.toLocaleString()} د.ع` : "فارغة"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cartItems.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-[10px] text-destructive hover:text-destructive"
                onClick={() => clearCart.mutate()}
              >
                تفريغ
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 px-4 py-4 space-y-4">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        )}

        {!isLoading && cartItems.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-card border border-primary/20 flex items-center justify-center mb-4">
              <ShoppingCart className="h-7 w-7 text-primary/40" />
            </div>
            <p className="font-bold text-sm text-foreground">السلة فارغة</p>
            <p className="text-[11px] text-muted-foreground mt-1 mb-4">أضف منتجات من متاجر المجتمع</p>
            <Button variant="outline" size="sm" onClick={() => navigate("/community")}>
              تصفح المتاجر
            </Button>
          </div>
        )}

        {/* Grouped by merchant */}
        {groupedItems.map((group) => (
          <div key={group.merchantId} className="rounded-2xl border border-border/40 bg-card overflow-hidden">
            {/* Merchant header */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-muted/30 border-b border-border/20">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-foreground">{group.merchantName}</span>
                <Badge variant="outline" className="text-[8px]">{group.items.length} منتج</Badge>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[10px] gap-1 text-primary"
                onClick={() => navigate(`/community/store/${group.merchantId}`)}
              >
                المتجر
              </Button>
            </div>

            {/* Items */}
            <div className="divide-y divide-border/20">
              {group.items.map((item) => (
                <div key={item.id} className="flex gap-3 p-3">
                  {/* Image */}
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted shrink-0">
                    {item.product_image ? (
                      <OptimizedImage src={item.product_image} alt={item.product_title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <h4 className="text-xs font-bold text-foreground line-clamp-1">{item.product_title}</h4>
                    <p className="text-sm font-black text-primary">{item.product_price.toLocaleString()} <span className="text-[9px] font-normal text-muted-foreground">د.ع</span></p>
                    
                    {/* Quantity controls */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center rounded-lg border border-border/50 overflow-hidden">
                        <button
                          className="h-7 w-7 flex items-center justify-center hover:bg-muted/50 transition-colors"
                          onClick={() => updateQuantity.mutate({ id: item.id, quantity: item.quantity - 1 })}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                        <button
                          className="h-7 w-7 flex items-center justify-center hover:bg-muted/50 transition-colors"
                          onClick={() => updateQuantity.mutate({ id: item.id, quantity: item.quantity + 1 })}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-all"
                        onClick={() => removeItem.mutate(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Item total */}
                  <div className="text-xs font-bold text-foreground/70 shrink-0">
                    {(item.product_price * item.quantity).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            {/* Order from merchant */}
            <div className="p-3 bg-muted/20 border-t border-border/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground">المجموع</span>
                <span className="text-sm font-black text-primary">
                  {group.items.reduce((s, i) => s + i.product_price * i.quantity, 0).toLocaleString()} د.ع
                </span>
              </div>
              <Button
                className="w-full h-9 text-xs gap-1.5 rounded-xl"
                onClick={() => handleOrderFromMerchant(group.merchantId)}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                اطلب من {group.merchantName}
              </Button>
            </div>
          </div>
        ))}
      </main>

      {/* Bottom Bar */}
      {cartItems.length > 0 && (
        <div className="sticky bottom-0 bg-card/95 backdrop-blur-xl border-t border-border/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">الإجمالي الكلي</span>
            <span className="text-lg font-black text-primary">{totalPrice.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">د.ع</span></span>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            اختر متجراً أعلاه لإتمام الطلب عبر المحادثة
          </p>
        </div>
      )}

      <Footer />
    </div>
  );
}
