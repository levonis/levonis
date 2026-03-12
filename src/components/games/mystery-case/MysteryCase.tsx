import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, Ticket, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import PixelBackground from "@/components/games/PixelBackground";
import PixelMusicRadio from "@/components/games/PixelMusicRadio";
import { useGameSounds } from "@/components/games/useGameSounds";
import ReelSpinner, { type ReelItem } from "./ReelSpinner";
import RewardPopup from "./RewardPopup";

function MysteryCase({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { playClick, playSuccess, playVictory } = useGameSounds();

  const [spinning, setSpinning] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [winResult, setWinResult] = useState<any>(null);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);

  // Fetch settings
  const { data: settings } = useQuery({
    queryKey: ["mystery-case-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("mystery_case_settings")
        .select("*")
        .limit(1)
        .single();
      return data;
    },
  });

  // Fetch rewards (all for display)
  const { data: rewards = [] } = useQuery({
    queryKey: ["mystery-case-rewards"],
    queryFn: async () => {
      const { data } = await supabase
        .from("mystery_case_rewards")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      return (data || []) as any[];
    },
  });

  // Fetch user tickets
  const { data: ticketData, refetch: refetchTickets } = useQuery({
    queryKey: ["user-tickets", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_tickets")
        .select("ticket_count")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // Fetch spin history
  const { data: spinHistory = [] } = useQuery({
    queryKey: ["mystery-case-history", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("mystery_case_spins")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []) as any[];
    },
    enabled: !!user,
  });

  const ticketCount = ticketData?.ticket_count || 0;
  const ticketsNeeded = settings?.tickets_per_spin || 4;

  const reelItems: ReelItem[] = rewards.map((r: any) => ({
    id: r.id,
    name_ar: r.name_ar,
    image_url: r.image_url,
    rarity: r.rarity,
  }));

  // Play spin sound effect
  const playSpinSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      // Ticking sound
      for (let i = 0; i < 20; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(600 + i * 10, ctx.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0.02, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.05);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.05);
      }
    } catch {}
  }, []);

  const handleSpin = useCallback(async () => {
    if (!user) {
      toast.error("يجب تسجيل الدخول أولاً");
      navigate("/auth");
      return;
    }
    if (spinning) return;
    if (ticketCount < ticketsNeeded) {
      toast.error(`تحتاج ${ticketsNeeded} تذكرة للف`);
      return;
    }
    if (reelItems.length < 2) {
      toast.error("لا توجد جوائز كافية");
      return;
    }

    playClick();
    setSpinning(true);
    setShowReward(false);
    setWinResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("mystery-case-spin");

      if (error || !data?.success) {
        toast.error(data?.error || "حدث خطأ");
        setSpinning(false);
        return;
      }

      // Find winner index in the reel items
      const idx = reelItems.findIndex((item) => item.id === data.reward.id);
      setWinnerIndex(idx >= 0 ? idx : 0);
      setWinResult(data.reward);

      // Play spin sound
      if (settings?.spin_sound_enabled !== false) {
        playSpinSound();
      }

      // Refetch tickets immediately
      refetchTickets();
    } catch (err) {
      toast.error("فشل الاتصال بالخادم");
      setSpinning(false);
    }
  }, [user, spinning, ticketCount, ticketsNeeded, reelItems, settings]);

  const handleSpinComplete = useCallback(() => {
    setSpinning(false);
    if (winResult) {
      setTimeout(() => {
        setShowReward(true);
        if (winResult.rarity === "legendary" || winResult.rarity === "epic") {
          playVictory();
        } else {
          playSuccess();
        }
        // Refetch history
        queryClient.invalidateQueries({ queryKey: ["mystery-case-history"] });
      }, 300);
    }
  }, [winResult]);

  if (!settings?.game_enabled) {
    return (
      <div className="fixed inset-0 z-30 bg-background flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <p className="text-muted-foreground font-mono">اللعبة غير متاحة حالياً</p>
          <Button onClick={onBack} variant="ghost" className="mt-4 font-mono text-xs">
            <ArrowRight className="h-4 w-4 ml-1" /> رجوع
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 bg-background text-foreground overflow-y-auto" dir="rtl">
      <PixelBackground />

      {/* Header */}
      <div className="sticky top-0 z-20 pixel-header-bar">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { playClick(); onBack(); }}
            className="gap-1 text-muted-foreground hover:text-foreground font-mono text-xs pixel-btn-ghost"
          >
            <ArrowRight className="h-4 w-4" /> رجوع
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 px-2 py-1 rounded pixel-frame">
              <Ticket className="h-3 w-3 text-primary" />
              <span className="text-xs font-mono text-primary font-bold">{ticketCount}</span>
            </div>
            <span className="text-primary font-bold text-xs font-mono tracking-wider">🎰 MYSTERY CASE</span>
          </div>
        </div>
      </div>

      {/* Game Area */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 pt-6">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold font-mono text-primary mb-1">صندوق الغموض</h1>
          <p className="text-xs text-muted-foreground font-mono">
            ألف الشريط واربح جوائز مذهلة!
          </p>
        </div>

        {/* Reel */}
        <div className="pixel-frame rounded-xl p-1 mb-6" style={{ background: "hsl(var(--background))" }}>
          {reelItems.length > 0 ? (
            <ReelSpinner
              items={reelItems}
              winnerIndex={winnerIndex}
              spinning={spinning}
              onSpinComplete={handleSpinComplete}
              animationDuration={settings?.animation_duration_ms || 5000}
            />
          ) : (
            <div className="h-36 flex items-center justify-center text-muted-foreground font-mono text-xs">
              لا توجد جوائز حالياً
            </div>
          )}
        </div>

        {/* Spin Button */}
        <div className="text-center mb-6">
          <Button
            onClick={handleSpin}
            disabled={spinning || ticketCount < ticketsNeeded || reelItems.length < 2}
            className="font-mono text-sm px-8 py-3 pixel-btn-active"
            size="lg"
          >
            {spinning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                جاري اللف...
              </>
            ) : (
              <>
                🎰 ألف! ({ticketsNeeded} <Ticket className="h-3 w-3 inline" />)
              </>
            )}
          </Button>
          {ticketCount < ticketsNeeded && !spinning && (
            <p className="text-xs text-destructive font-mono mt-2">
              تحتاج {ticketsNeeded - ticketCount} تذكرة إضافية
            </p>
          )}
        </div>

        {/* Spin History */}
        {spinHistory.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-mono text-muted-foreground mb-3">📜 سجل اللفات الأخيرة</h3>
            <div className="space-y-2">
              {spinHistory.slice(0, 5).map((spin: any) => {
                const snap = spin.reward_snapshot as any;
                const color = RARITY_COLORS[snap?.rarity] || "#9ca3af";
                return (
                  <div
                    key={spin.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg pixel-frame"
                  >
                    {snap?.image_url ? (
                      <img src={snap.image_url} alt="" className="w-8 h-8 object-contain" style={{ imageRendering: "pixelated" }} />
                    ) : (
                      <div className="w-8 h-8 rounded bg-muted/20 flex items-center justify-center text-sm">🎁</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono truncate">{snap?.name_ar || "جائزة"}</p>
                      <p className="text-[10px] font-mono" style={{ color }}>
                        {RARITY_LABELS[snap?.rarity] || snap?.rarity}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      -{spin.tickets_spent}🎫
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Reward Popup */}
      <RewardPopup
        open={showReward}
        onClose={() => setShowReward(false)}
        reward={winResult}
      />

      <PixelMusicRadio />
    </div>
  );
}

const RARITY_COLORS: Record<string, string> = {
  common: "#9ca3af",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
  mythic: "#ef4444",
};

const RARITY_LABELS: Record<string, string> = {
  common: "عادي",
  rare: "نادر",
  epic: "أسطوري",
  legendary: "خرافي",
  mythic: "أسطورة",
};

export default MysteryCase;
