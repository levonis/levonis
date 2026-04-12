import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Gift, Trophy, CheckCircle2, Clock, ArrowRight, Gamepad2, ShoppingCart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  onBack: () => void;
}

interface UnifiedPrize {
  id: string;
  prize_name_ar: string;
  game_name: string;
  product_id: string | null;
  prize_image_url: string | null;
  is_delivered: boolean;
  created_at: string;
  source: "crossy" | "stack" | "competition";
  selected_option_id?: string | null;
  selected_color?: string | null;
}

export default function MyGamePrizes({ onBack }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addingToCart, setAddingToCart] = useState<string | null>(null);

  const { data: prizes = [], isLoading } = useQuery({
    queryKey: ["my-game-prizes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const results: UnifiedPrize[] = [];

      const [crossy, stack, comp] = await Promise.all([
        supabase.from("crossy_road_winners").select("*").eq("user_id", user.id).order("awarded_at", { ascending: false }),
        supabase.from("stack_game_winners").select("*").eq("user_id", user.id).order("awarded_at", { ascending: false }),
        supabase.from("competition_prizes").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);

      crossy.data?.forEach(w => results.push({
        id: w.id,
        prize_name_ar: w.prize_name_ar,
        game_name: "Crossy Road",
        product_id: w.product_id,
        prize_image_url: null,
        is_delivered: false,
        created_at: w.awarded_at,
        source: "crossy",
        selected_option_id: w.selected_option_id,
        selected_color: w.selected_color,
      }));

      stack.data?.forEach(w => results.push({
        id: w.id,
        prize_name_ar: w.prize_name_ar,
        game_name: "Stack Tower",
        product_id: w.product_id,
        prize_image_url: null,
        is_delivered: false,
        created_at: w.awarded_at,
        source: "stack",
        selected_option_id: w.selected_option_id,
        selected_color: w.selected_color,
      }));

      comp.data?.forEach(w => results.push({
        id: w.id,
        prize_name_ar: w.prize_name_ar,
        game_name: w.source_type === "mystery_box" ? "صندوق الغموض" : "مسابقة",
        product_id: w.product_id,
        prize_image_url: w.prize_image_url,
        is_delivered: w.status === "delivered",
        created_at: w.created_at,
        source: "competition",
      }));

      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return results;
    },
    enabled: !!user,
  });

  // Check which prizes are already in cart as gifts
  const { data: cartGiftProductIds = [] } = useQuery({
    queryKey: ["cart-gift-ids", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("cart_items")
        .select("product_id")
        .eq("user_id", user.id)
        .eq("is_gift", true);
      return (data || []).map((c) => c.product_id);
    },
    enabled: !!user,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const handleAddToCart = async (prize: UnifiedPrize) => {
    if (!prize.product_id || !user) return;
    setAddingToCart(prize.id);
    try {
      // Check if already in cart
      const { data: existing } = await supabase
        .from("cart_items")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", prize.product_id)
        .eq("is_gift", true)
        .maybeSingle();

      if (existing) {
        toast.info("الجائزة موجودة بالفعل في السلة");
        queryClient.invalidateQueries({ queryKey: ["cart-gift-ids"] });
        return;
      }

      // Use option/color from the prize record itself
      const { error } = await supabase.from("cart_items").insert({
        user_id: user.id,
        product_id: prize.product_id,
        product_option_id: prize.selected_option_id || null,
        selected_color: prize.selected_color || null,
        quantity: 1,
        sale_type: "direct",
        is_gift: true,
        is_locked: true,
      });

      if (error) throw error;

      toast.success("تمت إضافة الجائزة للسلة!");
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["cart-gift-ids"] });
    } catch (e) {
      console.error("add prize to cart error:", e);
      toast.error("حدث خطأ في إضافة الجائزة");
    } finally {
      setAddingToCart(null);
    }
  };

  return (
    <div className="min-h-screen p-4 pt-16 pb-20">
      <div className="fixed top-0 left-0 right-0 z-20 pixel-header-bar">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground font-mono text-xs pixel-btn-ghost">
            <ArrowRight className="h-4 w-4" /> رجوع
          </Button>
          <span className="text-primary font-bold text-xs font-mono tracking-wider">MY PRIZES</span>
        </div>
      </div>

      <div className="max-w-sm mx-auto space-y-4">
        <div className="text-center">
          <Gift className="h-10 w-10 text-primary mx-auto mb-2" />
          <h2 className="text-xl font-bold text-foreground font-mono">جوائزي</h2>
          <p className="text-xs text-muted-foreground mt-1">جميع الجوائز التي ربحتها من الألعاب</p>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground text-sm">جاري التحميل...</div>
        ) : prizes.length === 0 ? (
          <div className="text-center py-10">
            <Gamepad2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">لم تربح أي جوائز بعد</p>
            <p className="text-muted-foreground/60 text-xs mt-1">العب الألعاب لتحصل على جوائز!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {prizes.map((prize) => {
              const isInCart = cartGiftProductIds.includes(prize.product_id);
              const isAdding = addingToCart === prize.id;

              return (
                <div key={prize.id} className={`rounded-xl p-4 border transition-all ${prize.is_delivered ? 'bg-muted/10 border-border' : 'bg-primary/5 border-primary/20'}`}>
                  <div className="flex items-start gap-3">
                    {prize.prize_image_url ? (
                      <img src={prize.prize_image_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-border" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Trophy className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 text-right space-y-1">
                      <div className="text-sm font-bold text-foreground">{prize.prize_name_ar}</div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="bg-accent/10 px-1.5 py-0.5 rounded">{prize.game_name}</span>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          {!prize.is_delivered && prize.product_id && (
                            <Button
                              size="sm"
                              variant={isInCart ? "ghost" : "outline"}
                              onClick={() => !isInCart && handleAddToCart(prize)}
                              disabled={isAdding || isInCart}
                              className={`h-7 text-[10px] gap-1 rounded-lg ${
                                isInCart
                                  ? "text-primary cursor-default"
                                  : "border-primary/30 text-primary hover:bg-primary/10"
                              }`}
                            >
                              {isAdding ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <ShoppingCart className="h-3 w-3" />
                              )}
                              {isInCart ? "في السلة ✓" : "إضافة للسلة (مجاناً)"}
                            </Button>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(prize.created_at).toLocaleDateString('ar-IQ')}
                        </span>
                      </div>

                      <div className="flex items-center justify-end mt-1">
                        {prize.is_delivered ? (
                          <span className="flex items-center gap-1 text-[10px] text-green-500">
                            <CheckCircle2 className="h-3 w-3" /> تم الاستلام
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] text-yellow-500">
                            <Clock className="h-3 w-3" /> بانتظار الاستلام
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
