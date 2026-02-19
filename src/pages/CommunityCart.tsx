import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
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
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-bl from-primary/15 via-transparent to-accent/10" />
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/2" />
        
        <div className="relative z-10 px-4 pt-4 pb-5">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full bg-card/60 backdrop-blur-sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {cartItems.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-[10px] text-destructive hover:text-destructive rounded-full px-3"
                onClick={() => clearCart.mutate()}
              >
                <Trash2 className="h-3 w-3 ml-1" />
                تفريغ
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25">
              <ShoppingBag className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-black text-foreground tracking-tight">سلة المجتمع</h1>
              <p className="text-xs text-muted-foreground">
                {totalItems > 0 ? `${totalItems} منتج • ${totalPrice.toLocaleString()} د.ع` : "فارغة"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 px-4 py-4 space-y-4">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        )}

        {!isLoading && cartItems.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-card to-muted border border-primary/10 flex items-center justify-center mb-5 shadow-lg">
              <ShoppingCart className="h-8 w-8 text-primary/30" />
            </div>
            <p className="font-black text-base text-foreground">السلة فارغة</p>
            <p className="text-xs text-muted-foreground mt-1.5 mb-5">أضف منتجات من متاجر المجتمع</p>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => navigate("/community")}>
              تصفح المتاجر
            </Button>
          </div>
        )}

        {/* Grouped by merchant */}
        {groupedItems.map((group) => (
          <div key={group.merchantId} className="rounded-2xl border border-border/30 bg-card overflow-hidden shadow-sm">
            {/* Merchant header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-l from-primary/5 to-transparent border-b border-border/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Store className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <span className="text-xs font-black text-foreground">{group.merchantName}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[8px] h-4 px-1.5">{group.items.length} منتج</Badge>
                  </div>
                </div>
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
            <div className="divide-y divide-border/15">
              {group.items.map((item) => (
                <div key={item.id} className="flex gap-3 p-3.5">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted shrink-0 border border-border/20">
                    {item.product_image ? (
                      <OptimizedImage src={item.product_image} alt={item.product_title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <h4 className="text-xs font-bold text-foreground line-clamp-1">{item.product_title}</h4>
                    <p className="text-sm font-black text-primary">{item.product_price.toLocaleString()} <span className="text-[9px] font-normal text-muted-foreground">د.ع</span></p>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex items-center rounded-xl border border-border/40 overflow-hidden bg-muted/30">
                        <button
                          className="h-7 w-8 flex items-center justify-center hover:bg-muted transition-colors"
                          onClick={() => updateQuantity.mutate({ id: item.id, quantity: item.quantity - 1 })}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-xs font-black">{item.quantity}</span>
                        <button
                          className="h-7 w-8 flex items-center justify-center hover:bg-muted transition-colors"
                          onClick={() => updateQuantity.mutate({ id: item.id, quantity: item.quantity + 1 })}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        className="h-7 w-7 flex items-center justify-center rounded-xl text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-all"
                        onClick={() => removeItem.mutate(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs font-bold text-foreground/60 shrink-0">
                    {(item.product_price * item.quantity).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            {/* Order from merchant */}
            <div className="p-3.5 bg-gradient-to-l from-primary/5 to-transparent border-t border-border/20">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[10px] text-muted-foreground">مجموع المتجر</span>
                <span className="text-sm font-black text-primary">
                  {group.items.reduce((s, i) => s + i.product_price * i.quantity, 0).toLocaleString()} د.ع
                </span>
              </div>
              <Button
                className="w-full h-10 text-xs gap-2 rounded-xl font-bold shadow-md shadow-primary/15"
                onClick={() => handleOrderFromMerchant(group.merchantId)}
              >
                <MessageCircle className="h-4 w-4" />
                اطلب من {group.merchantName}
              </Button>
            </div>
          </div>
        ))}
      </main>

      {/* Bottom Summary Bar */}
      {cartItems.length > 0 && (
        <div className="sticky bottom-0 bg-card/95 backdrop-blur-xl border-t border-border/30 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">الإجمالي الكلي</span>
            <span className="text-xl font-black text-primary">{totalPrice.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">د.ع</span></span>
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
