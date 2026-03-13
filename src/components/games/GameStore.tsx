import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ShoppingBag, Star, Ticket, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Reward {
  id: string;
  title_ar: string;
  description_ar: string | null;
  reward_type: string;
  reward_value: number;
  points_cost: number;
  image_url: string | null;
  is_active: boolean;
  max_purchases: number | null;
  display_order: number;
}

export default function GameStore({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [buying, setBuying] = useState<string | null>(null);

  const { data: rewards = [] } = useQuery({
    queryKey: ["game-store-rewards"],
    queryFn: async () => {
      const { data } = await supabase
        .from("game_store_rewards")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      return (data ?? []) as Reward[];
    },
  });

  const { data: pointsData } = useQuery({
    queryKey: ["user-points-game", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_points")
        .select("available_points")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const userPoints = pointsData?.available_points ?? 0;

  const { data: purchases = [] } = useQuery({
    queryKey: ["game-store-purchases", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("game_store_purchases")
        .select("reward_id")
        .eq("user_id", user.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const handleBuy = async (reward: Reward) => {
    if (!user) return;
    if (userPoints < reward.points_cost) {
      toast.error("نقاط غير كافية!");
      return;
    }

    // Check max purchases
    if (reward.max_purchases !== null) {
      const count = purchases.filter((p) => p.reward_id === reward.id).length;
      if (count >= reward.max_purchases) {
        toast.error("وصلت الحد الأقصى لهذا العنصر!");
        return;
      }
    }

    setBuying(reward.id);
    try {
      // Deduct points
      await supabase.rpc("admin_adjust_points", {
        p_user_id: user.id,
        p_amount: -reward.points_cost,
        p_reason: `متجر الألعاب: ${reward.title_ar}`,
      });

      // If reward is tickets, add them
      if (reward.reward_type === "tickets" && reward.reward_value > 0) {
        await supabase.rpc("add_user_tickets", {
          p_user_id: user.id,
          p_amount: reward.reward_value,
        });
      }

      // Record purchase
      await supabase.from("game_store_purchases").insert({
        user_id: user.id,
        reward_id: reward.id,
        points_spent: reward.points_cost,
      });

      queryClient.invalidateQueries({ queryKey: ["user-points-game"] });
      queryClient.invalidateQueries({ queryKey: ["user-tickets-game"] });
      queryClient.invalidateQueries({ queryKey: ["game-store-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["user-points"] });
      queryClient.invalidateQueries({ queryKey: ["user-tickets"] });
      toast.success(`تم شراء ${reward.title_ar}!`);
    } catch {
      toast.error("حدث خطأ!");
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full px-4 py-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-black font-mono text-primary">المتجر</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onBack} className="font-mono text-xs gap-1">
            رجوع <ArrowRight className="h-3 w-3" />
          </Button>
        </div>

        <div className="pixel-frame p-3 mb-4 flex items-center justify-center gap-4">
          <div className="flex items-center gap-1.5">
            <Star className="h-4 w-4 text-primary" />
            <span className="text-sm font-mono font-bold text-primary">{userPoints} نقطة</span>
          </div>
        </div>

        {rewards.length === 0 ? (
          <div className="pixel-frame p-8 text-center text-muted-foreground font-mono text-sm">
            لا توجد مكافآت متاحة حالياً
          </div>
        ) : (
          <div className="space-y-3">
            {rewards.map((reward) => {
              const purchaseCount = purchases.filter((p) => p.reward_id === reward.id).length;
              const maxedOut = reward.max_purchases !== null && purchaseCount >= reward.max_purchases;
              const canAfford = userPoints >= reward.points_cost;

              return (
                <div key={reward.id} className="pixel-frame p-4 flex items-center gap-3">
                  {reward.image_url ? (
                    <img src={reward.image_url} alt="" className="w-12 h-12 rounded object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center">
                      {reward.reward_type === "tickets" ? (
                        <Ticket className="h-6 w-6 text-primary" />
                      ) : (
                        <ShoppingBag className="h-6 w-6 text-primary" />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm font-bold truncate">{reward.title_ar}</div>
                    {reward.description_ar && (
                      <div className="text-xs text-muted-foreground truncate">{reward.description_ar}</div>
                    )}
                    {reward.reward_type === "tickets" && (
                      <div className="text-xs text-accent-foreground flex items-center gap-1 mt-0.5">
                        <Ticket className="h-3 w-3" /> {reward.reward_value} تذكرة
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    disabled={!canAfford || maxedOut || buying === reward.id || !user}
                    onClick={() => handleBuy(reward)}
                    className="font-mono text-xs pixel-btn-active gap-1 shrink-0"
                  >
                    {buying === reward.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : maxedOut ? (
                      "✓"
                    ) : (
                      <>
                        <Star className="h-3 w-3" />
                        {reward.points_cost}
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
