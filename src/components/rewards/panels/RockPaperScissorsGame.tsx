import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, RotateCcw, Coins } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Move = 'rock' | 'paper' | 'scissors';
type Result = 'win' | 'lose' | 'draw';

interface RoundResult {
  playerMove: Move;
  computerMove: Move;
  result: Result;
  points: number;
}

const MOVES: Move[] = ['rock', 'paper', 'scissors'];
const MOVE_EMOJIS: Record<Move, string> = { rock: '✊', paper: '✋', scissors: '✌️' };

function getComputerMove(): Move {
  return MOVES[Math.floor(Math.random() * 3)];
}

function getResult(player: Move, computer: Move): Result {
  if (player === computer) return 'draw';
  if (
    (player === 'rock' && computer === 'scissors') ||
    (player === 'paper' && computer === 'rock') ||
    (player === 'scissors' && computer === 'paper')
  ) return 'win';
  return 'lose';
}

interface Props {
  onBack: () => void;
}

export default function RockPaperScissorsGame({ onBack }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [rounds, setRounds] = useState<RoundResult[]>([]);
  const [currentRound, setCurrentRound] = useState<RoundResult | null>(null);
  const [phase, setPhase] = useState<'choose' | 'animating' | 'result' | 'gameover'>('choose');
  const [shakeIndex, setShakeIndex] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const totalPoints = rounds.reduce((sum, r) => sum + r.points, 0);

  const updatePoints = useCallback(async (points: number) => {
    if (!user || points === 0) return;
    try {
      await supabase.rpc('admin_adjust_points', {
        p_user_id: user.id,
        p_amount: points,
        p_description: points > 0 ? 'فوز في لعبة حجرة ورقة مقص' : 'خسارة في لعبة حجرة ورقة مقص',
        p_source: 'game_rps',
      });
      queryClient.invalidateQueries({ queryKey: ['user-points-full'] });
    } catch {
      // silent fail
    }
  }, [user, queryClient]);

  const playRound = useCallback(async (playerMove: Move) => {
    if (phase !== 'choose' || attemptsLeft <= 0) return;

    setPhase('animating');
    
    // Shake animation - 3 shakes
    for (let i = 0; i < 3; i++) {
      setShakeIndex(i);
      await new Promise(r => setTimeout(r, 400));
    }

    const computerMove = getComputerMove();
    const result = getResult(playerMove, computerMove);
    const points = result === 'win' ? 10 : result === 'lose' ? -5 : 0;

    const roundResult: RoundResult = { playerMove, computerMove, result, points };
    setCurrentRound(roundResult);
    setPhase('result');

    // Update points in background
    await updatePoints(points);

    const newRounds = [...rounds, roundResult];
    setRounds(newRounds);
    const newAttempts = attemptsLeft - 1;
    setAttemptsLeft(newAttempts);

    if (result === 'win') {
      toast.success(t('games_you_win'));
    } else if (result === 'lose') {
      toast.error(t('games_you_lose'));
    }

    // Auto advance after delay
    setTimeout(() => {
      if (newAttempts <= 0) {
        setPhase('gameover');
        setGameOver(true);
      } else {
        setPhase('choose');
        setCurrentRound(null);
      }
    }, 2000);
  }, [phase, attemptsLeft, rounds, updatePoints, t]);

  const resetGame = () => {
    setAttemptsLeft(3);
    setRounds([]);
    setCurrentRound(null);
    setPhase('choose');
    setGameOver(false);
    setShakeIndex(0);
  };

  const getMoveLabel = (move: Move) => {
    if (move === 'rock') return t('games_rock');
    if (move === 'paper') return t('games_paper');
    return t('games_scissors');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowRight className="h-4 w-4" />
          {t('games_back')}
        </Button>
        <div className="flex items-center gap-2 text-sm">
          <Coins className="h-4 w-4 text-amber-500" />
          <span className={cn("font-bold", totalPoints > 0 ? "text-green-500" : totalPoints < 0 ? "text-red-500" : "text-muted-foreground")}>
            {totalPoints > 0 ? `+${totalPoints}` : totalPoints}
          </span>
        </div>
      </div>

      {/* Attempts indicator */}
      <div className="flex justify-center gap-2">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={cn(
              "w-3 h-3 rounded-full transition-all duration-300",
              i < attemptsLeft ? "bg-primary scale-100" : "bg-muted scale-75"
            )}
          />
        ))}
        <span className="text-xs text-muted-foreground mr-2">
          {attemptsLeft} {t('games_attempts_left')}
        </span>
      </div>

      {/* Game Arena */}
      <Card className="border-primary/20 bg-gradient-to-b from-primary/5 to-background overflow-hidden">
        <CardContent className="p-6">
          {/* Battle display */}
          <div className="flex items-center justify-center gap-6 mb-8">
            {/* Player side */}
            <div className="flex flex-col items-center gap-2">
              <div className={cn(
                "w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-4xl transition-all duration-300",
                phase === 'animating' && "animate-[rps-shake_0.4s_ease-in-out_infinite]",
              )}>
                {phase === 'animating' ? '✊' : currentRound ? MOVE_EMOJIS[currentRound.playerMove] : '❓'}
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {currentRound ? getMoveLabel(currentRound.playerMove) : t('games_choose_move')}
              </span>
            </div>

            {/* VS */}
            <div className={cn(
              "text-lg font-black text-primary/40",
              phase === 'result' && currentRound?.result === 'win' && "text-green-500",
              phase === 'result' && currentRound?.result === 'lose' && "text-red-500",
            )}>
              {t('games_vs')}
            </div>

            {/* Computer side */}
            <div className="flex flex-col items-center gap-2">
              <div className={cn(
                "w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center text-4xl transition-all duration-300",
                phase === 'animating' && "animate-[rps-shake_0.4s_ease-in-out_infinite_reverse]",
              )}>
                {phase === 'animating' ? '✊' : currentRound ? MOVE_EMOJIS[currentRound.computerMove] : '🤖'}
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {currentRound ? getMoveLabel(currentRound.computerMove) : '???'}
              </span>
            </div>
          </div>

          {/* Result banner */}
          {phase === 'result' && currentRound && (
            <div className={cn(
              "text-center py-3 rounded-xl mb-4 animate-[rps-result-in_0.4s_cubic-bezier(0.34,1.56,0.64,1)_both] font-bold text-lg",
              currentRound.result === 'win' && "bg-green-500/10 text-green-500",
              currentRound.result === 'lose' && "bg-red-500/10 text-red-500",
              currentRound.result === 'draw' && "bg-amber-500/10 text-amber-500",
            )}>
              {currentRound.result === 'win' && t('games_you_win')}
              {currentRound.result === 'lose' && t('games_you_lose')}
              {currentRound.result === 'draw' && t('games_draw')}
              <div className="text-sm font-medium mt-1 opacity-80">
                {currentRound.points > 0 ? `+${currentRound.points}` : currentRound.points === 0 ? '0' : currentRound.points} نقطة
              </div>
            </div>
          )}

          {/* Move Selection Buttons */}
          {phase === 'choose' && !gameOver && (
            <div className="grid grid-cols-3 gap-3">
              {MOVES.map(move => (
                <button
                  key={move}
                  onClick={() => playRound(move)}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-border/50 bg-background hover:border-primary hover:bg-primary/5 transition-all duration-200 active:scale-90 hover:scale-105"
                >
                  <span className="text-4xl">{MOVE_EMOJIS[move]}</span>
                  <span className="text-xs font-medium">{getMoveLabel(move)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Game Over */}
          {phase === 'gameover' && (
            <div className="text-center space-y-4 animate-[rps-result-in_0.5s_cubic-bezier(0.34,1.56,0.64,1)_both]">
              <h3 className="text-xl font-bold">{t('games_game_over')}</h3>
              
              {/* Rounds summary */}
              <div className="flex justify-center gap-2">
                {rounds.map((r, i) => (
                  <div key={i} className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center text-lg",
                    r.result === 'win' && "bg-green-500/10",
                    r.result === 'lose' && "bg-red-500/10",
                    r.result === 'draw' && "bg-amber-500/10",
                  )}>
                    {MOVE_EMOJIS[r.playerMove]}
                  </div>
                ))}
              </div>

              <div className={cn(
                "text-2xl font-black",
                totalPoints > 0 ? "text-green-500" : totalPoints < 0 ? "text-red-500" : "text-muted-foreground"
              )}>
                {t('games_total_result')}: {totalPoints > 0 ? `+${totalPoints}` : totalPoints}
              </div>

              <Button onClick={resetGame} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                {t('games_play_again')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Round History */}
      {rounds.length > 0 && phase !== 'gameover' && (
        <div className="space-y-2">
          {rounds.map((r, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 text-sm">
              <span className="text-muted-foreground">{t('games_round')} {i + 1}</span>
              <div className="flex items-center gap-2">
                <span>{MOVE_EMOJIS[r.playerMove]}</span>
                <span className="text-xs text-muted-foreground">{t('games_vs')}</span>
                <span>{MOVE_EMOJIS[r.computerMove]}</span>
              </div>
              <span className={cn(
                "font-bold text-xs",
                r.result === 'win' && "text-green-500",
                r.result === 'lose' && "text-red-500",
                r.result === 'draw' && "text-amber-500",
              )}>
                {r.points > 0 ? `+${r.points}` : r.points}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
