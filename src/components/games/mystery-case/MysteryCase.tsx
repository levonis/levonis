import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, Ticket, Loader2, Minus, Plus, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import PixelBackground from "@/components/games/PixelBackground";
import PixelMusicRadio from "@/components/games/PixelMusicRadio";
import { useGameSounds } from "@/components/games/useGameSounds";
import ReelSpinner, { type ReelItem } from "./ReelSpinner";
import MultiRewardPopup from "./MultiRewardPopup";
import PrizeShowcase from "./PrizeShowcase";

function MysteryCase({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { playClick, playSuccess, playVictory } = useGameSounds();

  const [spinning, setSpinning] = useState(false);
  const [isRequestingSpinResult, setIsRequestingSpinResult] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [allResults, setAllResults] = useState<any[]>([]);
  const [currentSpinIdx, setCurrentSpinIdx] = useState(0);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [spinCount, setSpinCount] = useState(1);

  // Use refs for multi-spin flow to avoid stale closures
  const allResultsRef = useRef<any[]>([]);
  const currentSpinIdxRef = useRef(0);
  const isMultiSpinActiveRef = useRef(false);

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
  const ticketsPerSpin = settings?.tickets_per_spin || 4;
  const totalTicketsNeeded = ticketsPerSpin * spinCount;
  const maxAffordable = Math.min(10, Math.floor(ticketCount / ticketsPerSpin));

  const reelItems: ReelItem[] = useMemo(() =>
    rewards.map((r: any) => ({
      id: r.id,
      name_ar: r.name_ar,
      image_url: r.image_url,
      rarity: r.rarity,
      drop_chance: r.drop_chance,
    })),
    [rewards]
  );

  const prizeList = useMemo(() =>
    rewards.map((r: any) => ({
      id: r.id,
      name_ar: r.name_ar,
      image_url: r.image_url,
      rarity: r.rarity,
      display_chance: r.display_chance,
    })),
    [rewards]
  );

  const playSpinSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
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

  const finishAllSpins = useCallback(() => {
    isMultiSpinActiveRef.current = false;
    setSpinning(false);
    setShowReward(true);
    const results = allResultsRef.current;
    const hasLegendary = results.some(r =>
      r.reward?.rarity === "legendary" || r.reward?.rarity === "epic" || r.reward?.rarity === "mythic"
    );
    if (hasLegendary) playVictory(); else playSuccess();
    queryClient.invalidateQueries({ queryKey: ["mystery-case-history"] });
    refetchTickets();
  }, [playVictory, playSuccess, queryClient, refetchTickets]);

  const handleSpin = useCallback(async () => {
    if (!user) {
      toast.error("يجب تسجيل الدخول أولاً");
      navigate("/auth");
      return;
    }
    if (spinning || isRequestingSpinResult) return;
    if (ticketCount < ticketsPerSpin) {
      toast.error(`تحتاج ${ticketsPerSpin} تذكرة على الأقل`);
      return;
    }
    if (reelItems.length < 2) {
      toast.error("لا توجد جوائز كافية");
      return;
    }

    playClick();
    setIsRequestingSpinResult(true);
    setShowReward(false);
    setAllResults([]);
    setCurrentSpinIdx(0);
    allResultsRef.current = [];
    currentSpinIdxRef.current = 0;
    isMultiSpinActiveRef.current = false;

    try {
      const { data, error } = await supabase.functions.invoke("mystery-case-spin", {
        body: { count: spinCount },
      });

      if (error || !data?.success) {
        toast.error(data?.error || "حدث خطأ");
        return;
      }

      const results = data.results || [{ spin_id: data.spin_id, reward: data.reward }];
      setAllResults(results);
      allResultsRef.current = results;
      isMultiSpinActiveRef.current = results.length > 1;

      const firstReward = results[0]?.reward;
      if (firstReward) {
        const idx = reelItems.findIndex((item) => item.id === firstReward.id);
        setWinnerIndex(idx >= 0 ? idx : 0);
      }

      if (settings?.spin_sound_enabled !== false) {
        playSpinSound();
      }

      refetchTickets();
      setSpinning(true);
    } catch (err) {
      toast.error("فشل الاتصال بالخادم");
    } finally {
      setIsRequestingSpinResult(false);
    }
  }, [
    user, spinning, isRequestingSpinResult, ticketCount, ticketsPerSpin,
    reelItems, settings, navigate, playClick, playSpinSound, refetchTickets, spinCount,
  ]);

  const handleSpinComplete = useCallback(() => {
    const results = allResultsRef.current;
    const idx = currentSpinIdxRef.current;

    if (results.length <= 1 || idx >= results.length - 1) {
      finishAllSpins();
      return;
    }

    // Multi-spin: advance to next
    const nextIdx = idx + 1;
    currentSpinIdxRef.current = nextIdx;
    setCurrentSpinIdx(nextIdx);

    const nextReward = results[nextIdx]?.reward;
    if (nextReward) {
      const i = reelItems.findIndex((item) => item.id === nextReward.id);
      setWinnerIndex(i >= 0 ? i : 0);
    }

    if (settings?.spin_sound_enabled !== false) {
      playSpinSound();
    }

    // Must toggle spinning off→on so ReelSpinner detects a new spin
    setSpinning(false);
    setTimeout(() => {
      if (isMultiSpinActiveRef.current) {
        setSpinning(true);
      }
    }, 350);
  }, [reelItems, finishAllSpins, settings, playSpinSound]);

  const handleSkip = useCallback(() => {
    isMultiSpinActiveRef.current = false;
    setSpinning(false);
    // Small delay to let ReelSpinner stop cleanly
    setTimeout(() => {
      finishAllSpins();
    }, 50);
  }, [finishAllSpins]);

  const handleCloseReward = useCallback(() => {
    setShowReward(false);
    setAllResults([]);
    allResultsRef.current = [];
    setCurrentSpinIdx(0);
    currentSpinIdxRef.current = 0;
  }, []);

  const incrementCount = () => setSpinCount(c => Math.min(10, Math.min(maxAffordable, c + 1)));
  const decrementCount = () => setSpinCount(c => Math.max(1, c - 1));

  useEffect(() => {
    if (spinCount > maxAffordable && maxAffordable >= 1) {
      setSpinCount(maxAffordable);
    }
  }, [maxAffordable, spinCount]);

  // Determine if skip button should show
  const showSkipButton = spinning && allResultsRef.current.length > 1;

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

      <div className="relative z-10 max-w-2xl mx-auto px-4 pt-6">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold font-mono text-primary mb-1">صندوق الغموض</h1>
          <p className="text-xs text-muted-foreground font-mono">
            ألف الشريط واربح جوائز مذهلة!
          </p>
        </div>

        <div className="pixel-frame rounded-xl p-1 mb-4" style={{ background: "hsl(var(--background))" }}>
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

        {/* Skip button — only for multi-spin, only while spinning */}
        {showSkipButton && (
          <div className="text-center mb-2">
            <Button
              onClick={handleSkip}
              variant="outline"
              size="sm"
              className="font-mono text-xs gap-1 pixel-frame"
            >
              <SkipForward className="h-3 w-3" />
              تخطي ({currentSpinIdx + 1}/{allResults.length})
            </Button>
          </div>
        )}

        <div className="text-center mb-6">
          {!spinning && !isRequestingSpinResult && maxAffordable > 1 && (
            <div className="flex items-center justify-center gap-3 mb-3">
              <span className="text-xs font-mono text-muted-foreground">عدد اللفات:</span>
              <div className="flex items-center gap-1 pixel-frame rounded px-1 py-0.5">
                <button
                  onClick={() => { playClick(); decrementCount(); }}
                  disabled={spinCount <= 1}
                  className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-8 text-center font-mono text-sm font-bold text-primary">{spinCount}</span>
                <button
                  onClick={() => { playClick(); incrementCount(); }}
                  disabled={spinCount >= 10 || spinCount >= maxAffordable}
                  className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                = {totalTicketsNeeded} <Ticket className="h-2.5 w-2.5 inline" />
              </span>
            </div>
          )}

          {!spinning && !isRequestingSpinResult && maxAffordable > 1 && (
            <div className="flex items-center justify-center gap-2 mb-3">
              {[1, 3, 5, 10].filter(n => n <= maxAffordable).map(n => (
                <button
                  key={n}
                  onClick={() => { playClick(); setSpinCount(n); }}
                  className={`px-3 py-1 rounded font-mono text-[10px] transition-all ${
                    spinCount === n
                      ? "pixel-btn-active text-primary-foreground"
                      : "pixel-frame text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {n}x
                </button>
              ))}
            </div>
          )}

          <Button
            onClick={handleSpin}
            disabled={spinning || isRequestingSpinResult || ticketCount < ticketsPerSpin || reelItems.length < 2}
            className="font-mono text-sm px-8 py-3 pixel-btn-active"
            size="lg"
          >
            {isRequestingSpinResult ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                جاري تحديد الجوائز...
              </>
            ) : spinning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                جاري اللف... ({currentSpinIdx + 1}/{allResults.length || spinCount})
              </>
            ) : (
              <>
                🎰 ألف{spinCount > 1 ? ` ${spinCount}x` : ""}! ({totalTicketsNeeded} <Ticket className="h-3 w-3 inline" />)
              </>
            )}
          </Button>
          {ticketCount < ticketsPerSpin && !spinning && !isRequestingSpinResult && (
            <p className="text-xs text-destructive font-mono mt-2">
              تحتاج {ticketsPerSpin - ticketCount} تذكرة إضافية
            </p>
          )}
        </div>

        {/* Prize Showcase */}
        <PrizeShowcase prizes={prizeList} />


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

      <MultiRewardPopup
        open={showReward}
        onClose={handleCloseReward}
        rewards={allResults.map(r => r.reward).filter(Boolean)}
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
