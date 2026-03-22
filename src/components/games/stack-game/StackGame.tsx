import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowRight, Ticket, Star, Trophy, Zap } from "lucide-react";
import StackGameCanvas from "./StackGameCanvas";

interface Props {
  onBack: () => void;
}

export default function StackGame({ onBack }: Props) {
  const { user } = useAuth();
  const [gameState, setGameState] = useState<"menu" | "playing" | "gameover">("menu");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [perfectCount, setPerfectCount] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [pointsAwarded, setPointsAwarded] = useState(0);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["stack-game-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stack_game_settings")
        .select("*")
        .limit(1)
        .single();
      return data as any;
    },
  });

  const { data: tickets } = useQuery({
    queryKey: ["user-tickets-stack", user?.id],
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

  const startGame = useCallback(async () => {
    setStarting(true);
    setError(null);
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
      setGameState("playing");
    } catch (e: any) {
      console.error("Stack game start error:", e);
      setError("حدث خطأ في بدء اللعبة: " + (e?.message || ""));
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

      if (!sessionToken) return;
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
      } catch {
        // silently fail
      }
      setSessionToken(null);
    },
    [sessionToken]
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

  return (
    <div className="min-h-screen p-4 pt-16 pb-20">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 pixel-header-bar">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground font-mono text-xs pixel-btn-ghost">
            <ArrowRight className="h-4 w-4" /> رجوع
          </Button>
          <span className="text-primary font-bold text-xs font-mono tracking-wider">STACK</span>
        </div>
      </div>

      <div className="max-w-sm mx-auto space-y-6 text-center">
        {/* Game icon */}
        <div className="text-7xl mt-4">🏗️</div>
        <h1 className="text-2xl font-bold text-foreground font-mono">برج التكديس</h1>
        <p className="text-sm text-muted-foreground">
          كدّس القطع فوق بعضها بدقة! كل قطعة تتحرك وعليك إيقافها في الوقت المناسب.
        </p>

        {/* Stats */}
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

        {error && (
          <div className="text-sm text-destructive font-medium bg-destructive/10 rounded-lg p-3">{error}</div>
        )}

        <Button
          onClick={startGame}
          disabled={starting || userTickets < entryCost}
          className="w-full h-12 text-base font-bold font-mono"
        >
          {starting ? "جاري البدء..." : userTickets < entryCost ? "تذاكر غير كافية" : "🚀 ابدأ اللعب"}
        </Button>
      </div>

      {/* Game Over Overlay */}
      {gameState === "gameover" && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full space-y-5 text-center border border-border/50 shadow-2xl">
            <div className="text-5xl">🏗️</div>
            <h2 className="text-xl font-bold text-foreground font-mono">انتهت اللعبة!</h2>

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
              <Button variant="outline" onClick={onBack} className="flex-1 font-mono">
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
