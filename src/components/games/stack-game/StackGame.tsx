import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowRight, Ticket, Star, Trophy, Zap, Crown, Gift, Medal, Target } from "lucide-react";
import StackGameCanvas from "./StackGameCanvas";

interface Props {
  onBack: () => void;
}

export default function StackGame({ onBack }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [gameState, setGameState] = useState<"menu" | "playing" | "gameover">("menu");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [perfectCount, setPerfectCount] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [pointsAwarded, setPointsAwarded] = useState(0);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [milestoneWin, setMilestoneWin] = useState<any>(null);
  const [activeView, setActiveView] = useState<"main" | "leaderboard" | "winners">("main");

  const { data: settings } = useQuery({
    queryKey: ["stack-game-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("stack_game_settings").select("*").limit(1).single();
      return data as any;
    },
  });

  const { data: tickets } = useQuery({
    queryKey: ["user-tickets-stack", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("user_tickets").select("ticket_count").eq("user_id", user.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ["stack-milestones"],
    queryFn: async () => {
      const { data } = await supabase.from("stack_game_milestones" as any).select("*").eq("is_active", true).order("target_score", { ascending: true });
      return (data || []) as any[];
    },
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["stack-leaderboard"],
    queryFn: async () => {
      const { data } = await supabase.from("stack_game_high_scores" as any).select("*").gt("high_score", 0).order("high_score", { ascending: false }).limit(10);
      return (data || []) as any[];
    },
  });

  const { data: lbPrizes = [] } = useQuery({
    queryKey: ["stack-lb-prizes"],
    queryFn: async () => {
      const { data } = await supabase.from("stack_game_leaderboard_prizes" as any).select("*").eq("is_active", true).order("position", { ascending: true });
      return (data || []) as any[];
    },
  });

  const { data: recentWinners = [] } = useQuery({
    queryKey: ["stack-winners"],
    queryFn: async () => {
      const { data } = await supabase.from("stack_game_winners" as any).select("*").order("awarded_at", { ascending: false }).limit(20);
      return (data || []) as any[];
    },
  });

  const { data: userProfiles = [] } = useQuery({
    queryKey: ["stack-user-profiles", leaderboard, recentWinners],
    queryFn: async () => {
      const ids = [...new Set([
        ...leaderboard.map((l: any) => l.user_id),
        ...recentWinners.map((w: any) => w.user_id),
      ])].filter(Boolean);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
      return (data || []) as any[];
    },
    enabled: leaderboard.length > 0 || recentWinners.length > 0,
  });

  const getProfileName = (userId: string) => {
    const p = userProfiles.find((pr: any) => pr.id === userId);
    return p?.display_name || "لاعب";
  };

  const startGame = useCallback(async () => {
    setStarting(true);
    setError(null);
    setMilestoneWin(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("start_stack_game");
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
      setScore(0);
      setPerfectCount(0);
      setMaxCombo(0);
      setPointsAwarded(0);
      setGameState("playing");
    } catch (e: any) {
      setError("حدث خطأ في بدء اللعبة");
    } finally {
      setStarting(false);
    }
  }, []);

  const handleGameOver = useCallback(
    async (finalScore: number, perfects: number, combo: number) => {
      setScore(finalScore);
      setPerfectCount(perfects);
      setMaxCombo(combo);
      setGameState("gameover");

      if (!sessionToken || !user) return;
      try {
        const { data } = await supabase.rpc("end_stack_game", {
          p_session_token: sessionToken,
          p_score: finalScore,
          p_perfect_count: perfects,
          p_max_combo: combo,
        });
        const result = data as any;
        if (result?.success) {
          setPointsAwarded(result.points_awarded);
        }

        // Update high score
        await supabase.rpc("update_stack_high_score" as any, { p_score: finalScore });

        // Check milestone
        const { data: milestoneResult } = await supabase.rpc("check_stack_milestone" as any, {
          p_user_id: user.id,
          p_score: finalScore,
          p_session_id: null,
        });
        if (milestoneResult && (milestoneResult as any).won) {
          setMilestoneWin(milestoneResult);
        }

        // Refresh leaderboard
        queryClient.invalidateQueries({ queryKey: ["stack-leaderboard"] });
        queryClient.invalidateQueries({ queryKey: ["stack-milestones"] });
      } catch {
        // silently fail
      }
      setSessionToken(null);
    },
    [sessionToken, user, queryClient]
  );

  const entryCost = settings?.entry_fee_tickets ?? 2;
  const userTickets = tickets?.ticket_count ?? 0;

  if (gameState === "playing") {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <StackGameCanvas onGameOver={handleGameOver} />
      </div>
    );
  }

  // Find user position in leaderboard
  const userPosition = user ? leaderboard.findIndex((l: any) => l.user_id === user.id) + 1 : 0;

  return (
    <div className="min-h-screen p-4 pt-16 pb-20">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 pixel-header-bar">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={activeView !== "main" ? () => setActiveView("main") : onBack} className="gap-1 text-muted-foreground font-mono text-xs pixel-btn-ghost">
            <ArrowRight className="h-4 w-4" /> {activeView !== "main" ? "رجوع" : "رجوع"}
          </Button>
          <span className="text-primary font-bold text-xs font-mono tracking-wider">THE TOWER</span>
        </div>
      </div>

      {/* Main Menu */}
      {activeView === "main" && (
        <div className="max-w-sm mx-auto space-y-5 text-center">
          <div className="text-7xl mt-4">🏙️</div>
          <h1 className="text-2xl font-bold text-foreground font-mono">البرج</h1>
          <p className="text-sm text-muted-foreground">ابنِ أعلى برج بدقة! كل طابق يتحرك وعليك إيقافه في الوقت المناسب.</p>

          {/* Tickets */}
          <div className="flex justify-center gap-4">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent/10 border border-accent/20">
              <Ticket className="h-4 w-4 text-accent-foreground" />
              <span className="text-sm font-mono font-bold text-accent-foreground">{userTickets}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-xs text-muted-foreground">التكلفة:</span>
              <span className="text-sm font-mono font-bold text-primary">{entryCost}</span>
              <Ticket className="h-3.5 w-3.5 text-primary" />
            </div>
          </div>

          {/* Milestone Prize Banner */}
          {milestones.length > 0 && (
            <div className="pixel-frame p-4 rounded-lg space-y-2 text-right bg-primary/5 border-primary/20">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 justify-end">
                <Target className="h-4 w-4 text-primary" /> جوائز النقاط
              </h3>
              {milestones.map((m: any) => {
                const remaining = m.stock - m.claimed_count;
                return (
                  <div key={m.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      {remaining > 0 ? (
                        <span className="text-primary font-mono">📦 {remaining} متبقي</span>
                      ) : (
                        <span className="text-destructive">نفذ المخزون</span>
                      )}
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

          {/* Rewards info */}
          <div className="pixel-frame p-4 rounded-lg space-y-2 text-right">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 justify-end">
              <Trophy className="h-4 w-4 text-primary" /> المكافآت
            </h3>
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>+{settings?.points_per_block ?? 1}</span>
                <span className="flex items-center gap-1"><Star className="h-3 w-3" /> لكل قطعة</span>
              </div>
              <div className="flex justify-between">
                <span>+{settings?.perfect_bonus_points ?? 3}</span>
                <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> مثالية</span>
              </div>
              <div className="flex justify-between">
                <span>×{settings?.combo_bonus_multiplier ?? 0.5}</span>
                <span>كومبو إضافي</span>
              </div>
            </div>
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setActiveView("leaderboard")} className="flex-1 font-mono text-xs gap-1 pixel-frame">
              <Crown className="h-3.5 w-3.5" /> المتصدرين
            </Button>
            <Button variant="outline" onClick={() => setActiveView("winners")} className="flex-1 font-mono text-xs gap-1 pixel-frame">
              <Medal className="h-3.5 w-3.5" /> الفائزون
            </Button>
          </div>

          {error && (
            <div className="text-sm text-destructive font-medium bg-destructive/10 rounded-lg p-3">{error}</div>
          )}

          <Button onClick={startGame} disabled={starting || userTickets < entryCost} className="w-full h-12 text-base font-bold font-mono">
            {starting ? "جاري البدء..." : userTickets < entryCost ? "تذاكر غير كافية" : "🚀 ابدأ اللعب"}
          </Button>
        </div>
      )}

      {/* Leaderboard View */}
      {activeView === "leaderboard" && (
        <div className="max-w-sm mx-auto space-y-4">
          <div className="text-center">
            <Crown className="h-10 w-10 text-primary mx-auto mb-2" />
            <h2 className="text-xl font-bold text-foreground font-mono">قائمة المتصدرين</h2>
            <p className="text-xs text-muted-foreground mt-1">أعلى 10 لاعبين - نافس للفوز بالجوائز!</p>
          </div>

          {/* Leaderboard prizes info */}
          {lbPrizes.length > 0 && (
            <div className="pixel-frame p-3 rounded-lg bg-primary/5 border-primary/20 text-right space-y-1">
              <h4 className="text-xs font-bold text-primary flex items-center gap-1 justify-end"><Gift className="h-3.5 w-3.5" /> جوائز المراكز</h4>
              {lbPrizes.map((p: any) => (
                <div key={p.id} className="text-[10px] text-muted-foreground flex justify-between">
                  <span>{p.prize_name_ar}</span>
                  <span>المركز {p.position} 🏅</span>
                </div>
              ))}
            </div>
          )}

          {leaderboard.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">لا توجد نقاط بعد. كن أول المتصدرين!</div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry: any, i: number) => {
                const prize = lbPrizes.find((p: any) => p.position === i + 1);
                const isUser = user && entry.user_id === user.id;
                const posEmoji = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;

                return (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between rounded-lg p-3 transition-all ${
                      i === 0
                        ? "bg-gradient-to-l from-yellow-500/10 to-transparent border-2 border-yellow-500/30"
                        : prize
                        ? "bg-primary/5 border border-primary/20"
                        : isUser
                        ? "bg-accent/10 border border-accent/20"
                        : "bg-muted/20 border border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground font-mono text-lg">{entry.high_score}</span>
                      {prize && <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">🎁 {prize.prize_name_ar}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className={`text-sm font-medium ${isUser ? "text-primary" : "text-foreground"}`}>
                          {getProfileName(entry.user_id)} {isUser && "(أنت)"}
                        </div>
                      </div>
                      <span className="text-lg">{posEmoji}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {userPosition > 0 && (
            <div className="text-center text-xs text-muted-foreground bg-muted/20 rounded-lg p-2">
              مركزك الحالي: <span className="font-bold text-primary">#{userPosition}</span>
            </div>
          )}
        </div>
      )}

      {/* Winners View */}
      {activeView === "winners" && (
        <div className="max-w-sm mx-auto space-y-4">
          <div className="text-center">
            <Medal className="h-10 w-10 text-primary mx-auto mb-2" />
            <h2 className="text-xl font-bold text-foreground font-mono">الفائزون</h2>
          </div>

          {recentWinners.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">لا يوجد فائزون بعد</div>
          ) : (
            <div className="space-y-2">
              {recentWinners.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between rounded-lg p-3 border border-border bg-muted/10">
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(w.awarded_at).toLocaleDateString('ar-IQ')}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-foreground">{getProfileName(w.user_id)}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {w.prize_type === 'leaderboard' ? `🏅 المركز ${w.position}` : `🎯 ${w.score} نقطة`}
                      {' • '}{w.prize_name_ar}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Game Over Overlay */}
      {gameState === "gameover" && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full space-y-5 text-center border border-border/50 shadow-2xl">
            {/* Milestone Win */}
            {milestoneWin?.won ? (
              <>
                <div className="text-5xl">🎉</div>
                <h2 className="text-xl font-bold text-primary font-mono">مبروك! لقد ربحت!</h2>
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  <Gift className="h-8 w-8 text-primary mx-auto mb-2" />
                  <div className="text-lg font-bold text-foreground">{milestoneWin.prize_name}</div>
                  {milestoneWin.stock_remaining !== undefined && (
                    <div className="text-xs text-muted-foreground mt-1">📦 متبقي: {milestoneWin.stock_remaining}</div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="text-5xl">🏗️</div>
                <h2 className="text-xl font-bold text-foreground font-mono">انتهت اللعبة!</h2>
              </>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="text-2xl font-bold text-primary font-mono">{score}</div>
                <div className="text-[10px] text-muted-foreground">النتيجة</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="text-2xl font-bold text-yellow-500 font-mono">{perfectCount}</div>
                <div className="text-[10px] text-muted-foreground">مثالية</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="text-2xl font-bold text-accent-foreground font-mono">{maxCombo}</div>
                <div className="text-[10px] text-muted-foreground">كومبو</div>
              </div>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center justify-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold text-primary font-mono">+{pointsAwarded}</span>
              <span className="text-sm text-muted-foreground">نقطة</span>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setGameState("menu"); setMilestoneWin(null); }} className="flex-1 font-mono">
                رجوع
              </Button>
              <Button onClick={startGame} disabled={starting || userTickets < entryCost} className="flex-1 font-mono">
                {starting ? "..." : "أعد اللعب"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
