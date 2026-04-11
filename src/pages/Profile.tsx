import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserCardFrame } from "@/hooks/useUserCardFrame";

import ProfileHeader from "@/components/profile/ProfileHeader";
import OrdersCenter from "@/components/profile/OrdersCenter";
import QuickServicesGrid from "@/components/profile/QuickServicesGrid";
import CouponsStrip from "@/components/profile/CouponsStrip";
import RecentOrders from "@/components/profile/RecentOrders";
import NotificationPromptBanner from "@/components/profile/NotificationPromptBanner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, Gamepad2 } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function Profile() {
  const { user } = useAuth();
  const [prizesOpen, setPrizesOpen] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, phone_verified, phone_verification_status")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: cardFrame } = useUserCardFrame(user?.id);

  // Game prizes for this user
  const { data: myPrizes } = useQuery({
    queryKey: ["my-game-prizes", user?.id],
    enabled: !!user?.id && prizesOpen,
    queryFn: async () => {
      const results: { prize_name: string; game_name: string; awarded_at: string }[] = [];

      const [crossy, stack, comp] = await Promise.all([
        supabase.from("crossy_road_winners").select("prize_name_ar, awarded_at").eq("user_id", user!.id).order("awarded_at", { ascending: false }),
        supabase.from("stack_game_winners").select("prize_name_ar, awarded_at").eq("user_id", user!.id).order("awarded_at", { ascending: false }),
        supabase.from("competition_prizes").select("prize_name_ar, created_at, source_type").eq("user_id", user!.id).order("created_at", { ascending: false }),
      ]);

      crossy.data?.forEach(w => results.push({ prize_name: w.prize_name_ar, game_name: "Crossy Road", awarded_at: w.awarded_at }));
      stack.data?.forEach(w => results.push({ prize_name: w.prize_name_ar, game_name: "Stack Tower", awarded_at: w.awarded_at }));
      comp.data?.forEach(w => results.push({ prize_name: w.prize_name_ar, game_name: w.source_type === "mystery_box" ? "صندوق الغموض" : "مسابقة", awarded_at: w.created_at }));

      results.sort((a, b) => new Date(b.awarded_at).getTime() - new Date(a.awarded_at).getTime());
      return results;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 pt-6 pb-24 max-w-lg space-y-4" dir="rtl">
        {user?.id && (
          <ProfileHeader
            userId={user.id}
            profile={profile ? { full_name: profile.full_name, username: profile.username, avatar_url: profile.avatar_url } : null}
            cardFrame={cardFrame ? { frame_url: cardFrame.frame_url, frame_animation: cardFrame.frame_animation, card_color: cardFrame.card_color } : null}
          />
        )}

        {user?.id && <NotificationPromptBanner />}

        {user?.id && <OrdersCenter userId={user.id} />}

        {/* Game Prizes Quick Access */}
        {user?.id && (
          <Button
            variant="outline"
            className="w-full rounded-xl gap-2 h-11"
            onClick={() => setPrizesOpen(true)}
          >
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span className="font-bold text-sm">جوائزي من الألعاب</span>
          </Button>
        )}

        <QuickServicesGrid />

        {user?.id && <CouponsStrip userId={user.id} />}

        {user?.id && <RecentOrders userId={user.id} />}
      </main>

      {/* Game Prizes Dialog */}
      <Dialog open={prizesOpen} onOpenChange={setPrizesOpen}>
        <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              جوائزي من الألعاب
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {!myPrizes || myPrizes.length === 0 ? (
              <div className="text-center py-8">
                <Gamepad2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">لم تفز بأي جائزة بعد</p>
              </div>
            ) : (
              myPrizes.map((p, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card/50">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <Trophy className="h-3.5 w-3.5 text-yellow-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{p.prize_name}</p>
                    <p className="text-xs text-muted-foreground">{p.game_name}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground/70">
                    {format(new Date(p.awarded_at), "d MMM", { locale: ar })}
                  </span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
