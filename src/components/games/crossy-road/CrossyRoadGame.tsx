import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PlayerProfileDialog from "@/components/games/PlayerProfileDialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowRight, Ticket, Star, Trophy, Zap, Crown, Gift, Medal, Target, Gamepad2, Sparkles, Globe, Timer, Hourglass } from "lucide-react";
import CrossyRoadCanvas from "./CrossyRoadCanvas";
import { useVipFreePlay } from "@/hooks/useVipPlus";
import SeasonHeader from "@/components/games/SeasonHeader";

interface Props {
  onBack: () => void;
}

function SeasonCountdownBanner({ endsAt, seasonName, startsAt }: { endsAt: string | null; seasonName?: string | null; startsAt?: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!endsAt && !startsAt) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [endsAt, startsAt]);

  const fmt = (iso?: string | null) => {
    if (!iso) return "";
    try { return new Date(iso).toLocaleDateString("ar-IQ", { year: "numeric", month: "short", day: "numeric" }); } catch { return ""; }
  };

  const fmtCountdown = (ms: number) => {
    if (ms <= 0) return "";
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${d > 0 ? `${d}ي ` : ""}${h}س ${m}د ${s}ث`;
  };

  const noActiveSeason = !endsAt && !startsAt;
  if (noActiveSeason && !seasonName) {
    return (
      <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-center">
        <Trophy className="h-5 w-5 text-primary mx-auto mb-1" />
        <div className="text-sm font-bold text-primary">الموسم القادم يبدأ قريباً 🏆</div>
        <div className="text-[10px] text-muted-foreground mt-1">تم تتويج الفائزين — ترقّب انطلاق الموسم الجديد</div>
      </div>
    );
  }

  const startMs = startsAt ? new Date(startsAt).getTime() : 0;
  const isUpcoming = !!startsAt && startMs > now;
  const startCountdown = isUpcoming ? fmtCountdown(startMs - now) : "";

  // Upcoming-only state (start is scheduled, no active end yet)
  if (isUpcoming && !endsAt) {
    return (
      <div className="rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/30 p-3 text-center space-y-1.5">
        <div className="flex items-center justify-center gap-2">
          <Hourglass className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-sm font-bold text-primary">{seasonName || "الموسم القادم"} يبدأ خلال</span>
        </div>
        <div className="font-mono font-black text-primary text-base bg-background/60 rounded-md py-1 tabular-nums">
          {startCountdown}
        </div>
        <div className="text-[10px] text-muted-foreground">ينطلق: {fmt(startsAt)}</div>
      </div>
    );
  }

  const diff = endsAt ? new Date(endsAt).getTime() - now : 0;
  const ended = endsAt ? diff <= 0 : false;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return (
    <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Trophy className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-primary">{seasonName || "الموسم الحالي"}</span>
        </div>
        {startsAt && !isUpcoming && <span className="text-[10px] text-muted-foreground">بدأ: {fmt(startsAt)}</span>}
      </div>
      {isUpcoming && (
        <div className="flex items-center justify-between gap-2 bg-background/50 rounded-md px-2 py-1">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Hourglass className="h-3 w-3 text-primary animate-pulse" /> يبدأ خلال:
          </div>
          <span className="font-mono font-bold text-primary text-xs tabular-nums">{startCountdown}</span>
        </div>
      )}
      {endsAt && !ended && (
        <div className="flex items-center justify-between gap-2 bg-background/50 rounded-md px-2 py-1">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Timer className="h-3 w-3 text-primary" /> ينتهي خلال:
          </div>
          <span className="font-mono font-bold text-primary text-xs tabular-nums">
            {d > 0 && `${d}ي `}{h}س {m}د {s}ث
          </span>
        </div>
      )}
      {endsAt && ended && (
        <div className="text-xs text-primary font-bold text-center">انتهى الموسم — جاري التوزيع</div>
      )}
      {!endsAt && !isUpcoming && (
        <div className="text-xs text-primary font-bold text-center bg-background/50 rounded-md px-2 py-1">
          الموسم القادم يبدأ قريباً 🏆
        </div>
      )}
    </div>
  );
}

export default function CrossyRoadGame({ onBack }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [gameState, setGameState] = useState<"menu" | "playing" | "gameover">("menu");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [score, setScore] = useState(0);
  const [stepsReached, setStepsReached] = useState(0);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [pointsAwarded, setPointsAwarded] = useState(0);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [milestoneWin, setMilestoneWin] = useState<any>(null);
  const [activeView, setActiveView] = useState<"main" | "leaderboard" | "winners">("main");
  const [loadingResult, setLoadingResult] = useState(false);
  const [liveScore, setLiveScore] = useState(0);
  const [liveSteps, setLiveSteps] = useState(0);
  const [profileDialogUserId, setProfileDialogUserId] = useState<string | null>(null);
  const [lbView, setLbView] = useState<"season" | "alltime">("season");

  const { data: settings } = useQuery({
    queryKey: ["crossy-road-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("crossy_road_settings").select("*").limit(1).single();
      return data as any;
    },
  });

  const { data: tickets } = useQuery({
    queryKey: ["user-tickets-crossy", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("user_tickets").select("ticket_count").eq("user_id", user.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ["crossy-road-milestones"],
    queryFn: async () => {
      const { data } = await supabase.from("crossy_road_milestones" as any).select("*").eq("is_active", true).order("target_score", { ascending: true });
      return (data || []) as any[];
    },
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["crossy-road-leaderboard"],
    queryFn: async () => {
      const { data } = await supabase.from("crossy_road_high_scores" as any).select("*").gt("high_score", 0).order("high_score", { ascending: false }).limit(10);
      return (data || []) as any[];
    },
  });

  const { data: allTimeLeaderboard = [] } = useQuery({
    queryKey: ["crossy-road-alltime-leaderboard"],
    queryFn: async () => {
      const { data } = await supabase.from("crossy_road_high_scores" as any).select("*").gt("all_time_high_score", 0).order("all_time_high_score", { ascending: false }).limit(10);
      return (data || []) as any[];
    },
  });

  const { data: userHighScore } = useQuery({
    queryKey: ["crossy-road-high-score", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("crossy_road_high_scores" as any).select("high_score, best_steps, all_time_high_score").eq("user_id", user.id).maybeSingle();
      return data as any;
    },
    enabled: !!user,
  });

  const { data: lbPrizes = [] } = useQuery({
    queryKey: ["crossy-road-lb-prizes"],
    queryFn: async () => {
      const { data } = await supabase.from("crossy_road_leaderboard_prizes" as any).select("*").eq("is_active", true).order("position", { ascending: true });
      return (data || []) as any[];
    },
  });

  const { data: recentWinners = [] } = useQuery({
    queryKey: ["crossy-road-winners"],
    queryFn: async () => {
      const { data } = await supabase.from("crossy_road_winners" as any).select("*").order("awarded_at", { ascending: false }).limit(20);
      return (data || []) as any[];
    },
  });

  const { data: userProfiles = [] } = useQuery({
    queryKey: ["crossy-road-profiles", leaderboard, allTimeLeaderboard, recentWinners],
    queryFn: async () => {
      const ids = [...new Set([...leaderboard.map((l: any) => l.user_id), ...allTimeLeaderboard.map((l: any) => l.user_id), ...recentWinners.map((w: any) => w.user_id)])].filter(Boolean);
      if (ids.length === 0) return [];
      const { data } = await supabase.rpc("get_public_profiles", { p_user_ids: ids } as any);
      return (data || []) as any[];
    },
    enabled: leaderboard.length > 0 || allTimeLeaderboard.length > 0 || recentWinners.length > 0,
  });

  const getProfileName = (userId: string) => {
    const p = userProfiles.find((pr: any) => pr.id === userId);
    return p?.full_name || p?.username || "لاعب";
  };
  const getProfileAvatar = (userId: string) => {
    const p = userProfiles.find((pr: any) => pr.id === userId);
    return p?.avatar_url || null;
  };
  const getProfileUsername = (userId: string) => {
    const p = userProfiles.find((pr: any) => pr.id === userId);
    return p?.username || null;
  };

  const invalidateBalances = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["user-tickets-crossy"] });
    queryClient.invalidateQueries({ queryKey: ["user-tickets-game"] });
    queryClient.invalidateQueries({ queryKey: ["user-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["user-points"] });
    queryClient.invalidateQueries({ queryKey: ["user-points-game"] });
  }, [queryClient]);

  const startGame = useCallback(async () => {
    setStarting(true);
    setError(null);
    setMilestoneWin(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("start_crossy_road");
      if (rpcError) throw rpcError;
      const result = data as any;
      if (!result.success) {
        const msgs: Record<string, string> = {
          not_enough_tickets: "لا تملك تذاكر كافية!",
          game_disabled: "اللعبة غير متاحة حالياً",
          daily_limit_reached: "وصلت للحد اليومي!",
          not_authenticated: "يجب تسجيل الدخول",
        };
        setError(msgs[result.error] || "حدث خطأ");
        return;
      }
      setSessionToken(result.session_token);
      claimedMilestonesRef.current = new Set();
      sessionTokenRef.current = result.session_token;
      sessionIdRef.current = result.session_id || null;
      setScore(0);
      setStepsReached(0);
      setCoinsCollected(0);
      setPointsAwarded(0);
      setGameState("playing");
      invalidateBalances();
    } catch (e: any) {
      console.error("startGame error:", e);
      setError("حدث خطأ في بدء اللعبة");
    } finally {
      setStarting(false);
    }
  }, [invalidateBalances]);

  const handleGameOver = useCallback(
    async (finalScore: number, steps: number, coins: number) => {
      setScore(finalScore);
      setStepsReached(steps);
      setCoinsCollected(coins);
      setGameState("gameover");
      setLoadingResult(true);

      const token = sessionTokenRef.current;
      if (!token || !user) { setLoadingResult(false); return; }

      let gameScore = finalScore;
      try {
        const { data, error: rpcError } = await supabase.rpc("end_crossy_road", {
          p_session_token: token, p_score: finalScore, p_steps: steps, p_coins: coins,
        });
        if (rpcError) console.error("end_crossy_road RPC error:", rpcError);
        const result = data as any;
        if (result?.success) {
          setPointsAwarded(result.points_awarded || 0);
          gameScore = result.game_score || finalScore;
          setScore(gameScore);
        }
      } catch (e) { console.error("end_crossy_road error:", e); }

      // High score is now updated atomically inside end_crossy_road using the calculated game_score

      queryClient.invalidateQueries({ queryKey: ["crossy-road-leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["crossy-road-alltime-leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["crossy-road-milestones"] });
      queryClient.invalidateQueries({ queryKey: ["crossy-road-high-score"] });
      invalidateBalances();
      sessionTokenRef.current = null;
      sessionIdRef.current = null;
      setSessionToken(null);
      setLoadingResult(false);
    },
    [user, queryClient, invalidateBalances]
  );

  const entryCost = settings?.entry_fee_tickets ?? 2;
  const userTickets = tickets?.ticket_count ?? 0;
  const { data: vipFreePlay } = useVipFreePlay(user?.id, "crossy_road");
  const hasVipFreePlay = vipFreePlay?.has_free_play === true;

  const [midGamePrize, setMidGamePrize] = useState<any>(null);
  const claimedMilestonesRef = useRef<Set<string>>(new Set());
  const checkingMilestoneRef = useRef(false);

  const handleScoreUpdate = useCallback((s: number, steps: number, coins: number) => {
    setLiveScore(s);
    setLiveSteps(steps);

    if (!user || !sessionTokenRef.current || !sessionIdRef.current || checkingMilestoneRef.current) return;
    const hitMilestone = milestones.find((m: any) => {
      const remaining = m.stock - m.claimed_count;
      return s >= m.target_score && remaining > 0 && !claimedMilestonesRef.current.has(m.id);
    });
    if (!hitMilestone) return;

    checkingMilestoneRef.current = true;
    claimedMilestonesRef.current.add(hitMilestone.id);

    (async () => {
      try {
        const { data: milestoneResult, error: milestoneError } = await supabase.rpc("check_crossy_road_milestone" as any, {
          p_user_id: user.id, p_score: s, p_session_id: sessionIdRef.current,
        });
        if (milestoneError) console.error("mid-game milestone error:", milestoneError);
        if (milestoneResult && (milestoneResult as any).won) {
          setMidGamePrize(milestoneResult);
          setTimeout(() => setMidGamePrize(null), 4000);
          if ((milestoneResult as any).milestone_id) {
            try {
              await supabase.rpc("claim_crossy_road_prize_to_cart" as any, { p_milestone_id: (milestoneResult as any).milestone_id });
              queryClient.invalidateQueries({ queryKey: ["cart"] });
            } catch (e) { console.error(e); }
          }
          queryClient.invalidateQueries({ queryKey: ["crossy-road-milestones"] });
        }
      } catch (e) { console.error(e); } finally {
        checkingMilestoneRef.current = false;
      }
    })();
  }, [user, milestones, queryClient]);

  // ==================== PLAYING STATE ====================
  if (gameState === "playing") {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <CrossyRoadCanvas
          onGameOver={handleGameOver}
          onScoreUpdate={handleScoreUpdate}
          scoreSettings={settings ? { points_per_step: settings.score_per_step ?? settings.points_per_step ?? 1, bonus_coin_points: settings.score_per_coin ?? settings.bonus_coin_points ?? 5 } : undefined}
        />
        <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none" dir="rtl">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="bg-black/50 backdrop-blur-xl rounded-2xl px-4 py-2 border border-white/10 shadow-lg">
                <span className="text-[10px] text-white/50 block">النقاط</span>
                <span className="text-xl font-bold text-white tracking-wider">{liveScore}</span>
              </div>
              <div className="bg-black/50 backdrop-blur-xl rounded-2xl px-3 py-2 border border-white/10">
                <span className="text-[10px] text-white/50 block">الخطوات</span>
                <span className="text-lg font-bold text-white">{liveSteps}</span>
              </div>
            </div>
          </div>
        </div>
        {midGamePrize && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="bg-black/70 backdrop-blur-xl rounded-3xl px-8 py-6 border border-primary/40 shadow-2xl shadow-primary/20 animate-scale-in text-center max-w-xs pointer-events-auto">
              <div className="text-5xl mb-3">🎁</div>
              <p className="text-lg font-bold text-white mb-1">🎉 حصلت على جائزة!</p>
              <p className="text-primary font-bold text-base">{(midGamePrize as any).prize_name}</p>
              <p className="text-xs text-white/50 mt-2">أكمل اللعب!</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  const userPosition = user ? leaderboard.findIndex((l: any) => l.user_id === user.id) + 1 : 0;
  const currentLb = lbView === "alltime" ? allTimeLeaderboard : leaderboard;
  const scoreKey = lbView === "alltime" ? "all_time_high_score" : "high_score";

  // ==================== MENU / LEADERBOARD / WINNERS ====================
  return (
    <div className="min-h-screen p-4 pt-16 pb-20">
      <div className="fixed top-0 left-0 right-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={activeView !== "main" ? () => setActiveView("main") : onBack} className="gap-1 text-muted-foreground text-xs">
            <ArrowRight className="h-4 w-4" /> رجوع
          </Button>
          <span className="text-primary font-bold text-sm tracking-widest">CROSSY ROAD</span>
        </div>
      </div>

      {activeView === "main" && (
        <div className="max-w-sm mx-auto space-y-5 text-center">
          <div className="text-5xl mt-4">CROSSY ROAD</div>
          <h1 className="text-2xl font-bold text-foreground">اعبر الطريق</h1>
          <p className="text-sm text-muted-foreground">تحرّك عبر الطرق والأنهار وسكك الحديد! تجنب السيارات والقطارات ولا تسقط في الماء.</p>

          {/* Season banner */}
          <SeasonCountdownBanner endsAt={settings?.season_ends_at} seasonName={(settings as any)?.season_name} startsAt={(settings as any)?.season_starts_at} />

          {userHighScore && userHighScore.high_score > 0 && (
            <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <Trophy className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">أعلى سكور:</span>
              <span className="text-lg font-bold text-primary">{userHighScore.high_score}</span>
              <span className="text-xs text-muted-foreground">• {userHighScore.best_steps} خطوة</span>
            </div>
          )}

          <div className="flex justify-center gap-4">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent/10 border border-accent/20">
              <Ticket className="h-4 w-4 text-accent-foreground" />
              <span className="text-sm font-bold text-accent-foreground">{userTickets}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
              <span className="text-xs text-muted-foreground">التكلفة:</span>
              <span className="text-sm font-bold text-primary">{entryCost}</span>
              <Ticket className="h-3.5 w-3.5 text-primary" />
            </div>
          </div>

          {milestones.length > 0 && (
            <div className="p-4 rounded-xl space-y-2 text-right bg-primary/5 border border-primary/20">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 justify-end">
                <Target className="h-4 w-4 text-primary" /> جوائز النقاط
              </h3>
              {milestones.map((m: any) => {
                const remaining = m.stock - m.claimed_count;
                return (
                  <div key={m.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      {remaining > 0 ? <span className="text-primary">📦 {remaining} متبقي</span> : <span className="text-destructive">نفذ المخزون</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-foreground font-medium">{m.prize_name_ar}</span>
                      <Gift className="h-3.5 w-3.5 text-primary" />
                      <span className="text-muted-foreground">عند {m.target_score} نقطة</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="p-4 rounded-xl space-y-3 text-right border border-border/30 bg-card/50">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 justify-end">
              <Trophy className="h-4 w-4 text-primary" /> المكافآت
            </h3>
            <div className="text-xs space-y-2 text-muted-foreground">
              <div className="flex justify-between"><span>+{settings?.points_per_step ?? 1}</span><span>نقاط موقع لكل خطوة 🚶</span></div>
              <div className="flex justify-between"><span>+{settings?.bonus_coin_points ?? 5}</span><span>نقاط موقع لعملة ذهبية 🪙</span></div>
              <div className="flex justify-between"><span>+{settings?.score_per_step ?? 1}</span><span>سكور لكل خطوة 🎮</span></div>
              <div className="flex justify-between"><span>+{settings?.score_per_coin ?? 5}</span><span>سكور لعملة ذهبية 🎮</span></div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setActiveView("leaderboard")} className="flex-1 text-xs gap-1 rounded-xl">
              <Crown className="h-3.5 w-3.5" /> المتصدرين
            </Button>
            <Button variant="outline" onClick={() => setActiveView("winners")} className="flex-1 text-xs gap-1 rounded-xl">
              <Medal className="h-3.5 w-3.5" /> الفائزون
            </Button>
          </div>

          {error && <div className="text-sm text-destructive font-medium bg-destructive/10 rounded-xl p-3">{error}</div>}

          {hasVipFreePlay && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span className="text-amber-600 dark:text-amber-400 font-bold">VIP+ لعب مجاني متاح اليوم!</span>
            </div>
          )}

          <Button onClick={startGame} disabled={starting || (!hasVipFreePlay && userTickets < entryCost)} className="w-full h-12 text-base font-bold rounded-xl">
            {starting ? "جاري البدء..." : hasVipFreePlay ? "🌟 العب مجاناً (VIP+)" : userTickets < entryCost ? "تذاكر غير كافية" : "🐔 ابدأ اللعب"}
          </Button>
        </div>
      )}

      {activeView === "leaderboard" && (
        <div className="max-w-sm mx-auto space-y-4">
          <div className="text-center">
            <Crown className="h-10 w-10 text-primary mx-auto mb-2" />
            <h2 className="text-xl font-bold text-foreground">قائمة المتصدرين</h2>
          </div>

          {/* Season / All-Time toggle */}
          <div className="flex gap-2 bg-muted/20 rounded-xl p-1">
            <button onClick={() => setLbView("season")} className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${lbView === "season" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              الموسم الحالي
            </button>
            <button onClick={() => setLbView("alltime")} className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-1 ${lbView === "alltime" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              <Globe className="h-3 w-3" /> الأفضل على الإطلاق
            </button>
          </div>

          {/* Season banner */}
          <SeasonHeader
            seasonName={(settings as any)?.season_name}
            seasonStartsAt={(settings as any)?.season_starts_at}
            seasonEndsAt={(settings as any)?.season_ends_at}
          />

          {lbView === "season" && lbPrizes.length > 0 && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-right space-y-1">
              <h4 className="text-xs font-bold text-primary flex items-center gap-1 justify-end"><Gift className="h-3.5 w-3.5" /> جوائز المراكز</h4>
              {lbPrizes.map((p: any) => (
                <div key={p.id} className="text-[10px] text-muted-foreground flex justify-between">
                  <span>{p.prize_name_ar}</span><span>المركز {p.position} 🏅</span>
                </div>
              ))}
            </div>
          )}
          {currentLb.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">لا توجد نقاط بعد. كن أول المتصدرين!</div>
          ) : (
            <div className="space-y-2">
              {currentLb.map((entry: any, i: number) => {
                const prize = lbView === "season" ? lbPrizes.find((p: any) => p.position === i + 1) : null;
                const isUser = user && entry.user_id === user.id;
                const posEmoji = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
                const entryScore = entry[scoreKey];
                return (
                  <div key={entry.id} onClick={() => setProfileDialogUserId(entry.user_id)} className={`flex items-center justify-between rounded-xl p-3 transition-all cursor-pointer hover:scale-[1.02] ${
                    i === 0 ? "bg-gradient-to-l from-yellow-500/10 to-transparent border-2 border-yellow-500/30"
                    : prize ? "bg-primary/5 border border-primary/20"
                    : isUser ? "bg-accent/10 border border-accent/20"
                    : "bg-muted/20 border border-border"
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-lg">{entryScore}</span>
                      {prize && <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">🎁 {prize.prize_name_ar}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className={`text-sm font-medium ${isUser ? "text-primary" : "text-foreground"}`}>
                          {getProfileName(entry.user_id)} {isUser && "(أنت)"}
                        </div>
                      </div>
                      {getProfileAvatar(entry.user_id) ? (
                        <img src={getProfileAvatar(entry.user_id)!} alt="" className="w-7 h-7 rounded-full object-cover border border-border/40" loading="lazy" decoding="async" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                          {getProfileName(entry.user_id)[0]}
                        </div>
                      )}
                      <span className="text-lg">{posEmoji}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {lbView === "season" && userPosition > 0 && (
            <div className="text-center text-xs text-muted-foreground bg-muted/20 rounded-xl p-2">
              مركزك الحالي: <span className="font-bold text-primary">#{userPosition}</span>
            </div>
          )}
        </div>
      )}

      {activeView === "winners" && (
        <div className="max-w-sm mx-auto space-y-4">
          <div className="text-center">
            <Medal className="h-10 w-10 text-primary mx-auto mb-2" />
            <h2 className="text-xl font-bold text-foreground">الفائزون</h2>
          </div>
          {recentWinners.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">لا يوجد فائزون بعد</div>
          ) : (
            <div className="space-y-2">
              {recentWinners.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between rounded-xl p-3 border border-border bg-muted/10">
                  <div className="text-[10px] text-muted-foreground">{new Date(w.awarded_at).toLocaleDateString("ar-IQ")}</div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-foreground">{getProfileName(w.user_id)}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {w.prize_type === "leaderboard" ? `🏅 المركز ${w.position}` : `🎯 ${w.score} نقطة`} • {w.prize_name_ar}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {gameState === "gameover" && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full space-y-5 text-center border border-border/30 shadow-2xl">
            <div className="text-5xl">🐔</div>
            <h2 className="text-xl font-bold text-foreground">انتهت اللعبة!</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/30 rounded-xl p-3">
                <div className="text-2xl font-bold text-primary">{score}</div>
                <div className="text-[10px] text-muted-foreground">النتيجة</div>
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <div className="text-2xl font-bold text-yellow-500">{stepsReached}</div>
                <div className="text-[10px] text-muted-foreground">خطوات</div>
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <div className="text-2xl font-bold text-accent-foreground">{coinsCollected}</div>
                <div className="text-[10px] text-muted-foreground">عملات</div>
              </div>
            </div>
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center justify-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              <span className="text-lg font-bold text-primary">{loadingResult ? "..." : `+${pointsAwarded}`}</span>
              <span className="text-[10px] text-muted-foreground">نقطة موقع</span>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setGameState("menu"); setMilestoneWin(null); }} className="flex-1 rounded-xl">رجوع</Button>
              <Button onClick={startGame} disabled={starting || (!hasVipFreePlay && userTickets < entryCost)} className="flex-1 rounded-xl">
                {starting ? "..." : hasVipFreePlay ? "🌟 مجاناً" : "أعد اللعب"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <PlayerProfileDialog open={!!profileDialogUserId} onOpenChange={(open) => !open && setProfileDialogUserId(null)} userId={profileDialogUserId} />
    </div>
  );
}
