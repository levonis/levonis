import { useState, useCallback, useEffect } from "react";
import { ArrowRight, RotateCcw, Coins } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Move = 'rock' | 'paper' | 'scissors';
type Result = 'win' | 'lose' | 'draw';

interface RoundResult {
  playerMove: Move;
  computerMove: Move;
  result: Result;
  points: number;
}

const MOVES: Move[] = ['rock', 'paper', 'scissors'];
const MOVE_LABELS: Record<Move, string> = { rock: 'حجر', paper: 'ورقة', scissors: 'مقص' };

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

// Pixel art hand SVGs
function PixelHand({ move, flip, size = 80 }: { move: Move | null; flip?: boolean; size?: number }) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    transform: flip ? 'scaleX(-1)' : undefined,
    imageRendering: 'pixelated' as const,
  };

  if (!move) {
    return (
      <div style={style} className="flex items-center justify-center text-5xl">
        ❓
      </div>
    );
  }

  const emoji = move === 'rock' ? '✊' : move === 'paper' ? '✋' : '✌️';
  return (
    <div style={style} className="flex items-center justify-center text-5xl select-none"
      role="img" aria-label={MOVE_LABELS[move]}>
      {emoji}
    </div>
  );
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
  const [phase, setPhase] = useState<'choose' | 'shaking' | 'reveal' | 'gameover'>('choose');
  const [playerMove, setPlayerMove] = useState<Move | null>(null);
  const [computerMove, setComputerMove] = useState<Move | null>(null);
  const [roundResult, setRoundResult] = useState<Result | null>(null);
  const [shakeCount, setShakeCount] = useState(0);

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
      // silent
    }
  }, [user, queryClient]);

  // Shake animation counter
  useEffect(() => {
    if (phase !== 'shaking') return;
    if (shakeCount >= 3) {
      // Reveal
      const cm = getComputerMove();
      const result = getResult(playerMove!, cm);
      const pts = result === 'win' ? 10 : result === 'lose' ? -5 : 0;

      setComputerMove(cm);
      setRoundResult(result);
      setPhase('reveal');

      updatePoints(pts);

      const newRound: RoundResult = { playerMove: playerMove!, computerMove: cm, result, points: pts };
      const newRounds = [...rounds, newRound];
      setRounds(newRounds);
      const newAttempts = attemptsLeft - 1;
      setAttemptsLeft(newAttempts);

      if (result === 'win') toast.success(t('games_you_win'));
      else if (result === 'lose') toast.error(t('games_you_lose'));

      setTimeout(() => {
        if (newAttempts <= 0) {
          setPhase('gameover');
        } else {
          setPhase('choose');
          setPlayerMove(null);
          setComputerMove(null);
          setRoundResult(null);
          setShakeCount(0);
        }
      }, 2200);
      return;
    }

    const timer = setTimeout(() => setShakeCount(c => c + 1), 450);
    return () => clearTimeout(timer);
  }, [phase, shakeCount, playerMove, rounds, attemptsLeft, updatePoints, t]);

  const playRound = (move: Move) => {
    if (phase !== 'choose') return;
    setPlayerMove(move);
    setComputerMove(null);
    setRoundResult(null);
    setShakeCount(0);
    setPhase('shaking');
  };

  const resetGame = () => {
    setAttemptsLeft(3);
    setRounds([]);
    setPhase('choose');
    setPlayerMove(null);
    setComputerMove(null);
    setRoundResult(null);
    setShakeCount(0);
  };

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white" dir="rtl">
      {/* Scanline effect */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
        }}
      />

      <div className="relative z-10 px-4 pt-6 pb-8 max-w-md mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-white/60 hover:text-white hover:bg-white/10 gap-1"
          >
            <ArrowRight className="h-4 w-4" />
            {t('games_back')}
          </Button>
          <div className="flex items-center gap-3">
            {/* Score */}
            <div className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 border font-mono text-sm font-bold",
              totalPoints > 0 ? "bg-green-500/10 border-green-500/30 text-green-400" :
              totalPoints < 0 ? "bg-red-500/10 border-red-500/30 text-red-400" :
              "bg-white/5 border-white/10 text-white/50"
            )}>
              <Coins className="h-3.5 w-3.5" />
              {totalPoints > 0 ? `+${totalPoints}` : totalPoints}
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-black tracking-wider" style={{ fontFamily: "'Courier New', monospace", textShadow: '2px 2px 0 #0f3460' }}>
            {t('games_rps_title')}
          </h1>
        </div>

        {/* Attempts dots */}
        <div className="flex justify-center gap-3 mb-8">
          {[0, 1, 2].map(i => {
            const round = rounds[i];
            return (
              <div
                key={i}
                className={cn(
                  "w-8 h-8 rounded-lg border-2 flex items-center justify-center text-xs font-mono font-bold transition-all duration-500",
                  !round && i < attemptsLeft && "border-cyan-500/40 bg-cyan-500/10 text-cyan-400",
                  !round && i >= attemptsLeft && "border-white/10 bg-white/5 text-white/20",
                  round?.result === 'win' && "border-green-500/50 bg-green-500/20 text-green-400 scale-110",
                  round?.result === 'lose' && "border-red-500/50 bg-red-500/20 text-red-400",
                  round?.result === 'draw' && "border-amber-500/50 bg-amber-500/20 text-amber-400",
                )}
              >
                {round ? (round.result === 'win' ? 'W' : round.result === 'lose' ? 'L' : 'D') : (i + 1)}
              </div>
            );
          })}
        </div>

        {/* Battle Arena */}
        <div className="relative bg-gradient-to-b from-[#16213e] to-[#0f3460] border-2 border-cyan-500/20 rounded-2xl p-6 mb-6 overflow-hidden">
          {/* Corner pixels */}
          <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-cyan-400/30" />
          <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-cyan-400/30" />
          <div className="absolute bottom-1 left-1 w-1.5 h-1.5 bg-cyan-400/30" />
          <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-cyan-400/30" />

          <div className="flex items-center justify-between gap-4">
            {/* Player */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <span className="text-[10px] text-cyan-400/60 font-mono uppercase tracking-widest">YOU</span>
              <div className={cn(
                "w-24 h-24 rounded-2xl border-2 flex items-center justify-center transition-all duration-300",
                phase === 'shaking' ? "border-cyan-400/50 bg-cyan-500/10 animate-[rps-shake_0.4s_ease-in-out_infinite]" :
                roundResult === 'win' ? "border-green-400/50 bg-green-500/10" :
                roundResult === 'lose' ? "border-red-400/50 bg-red-500/10" :
                roundResult === 'draw' ? "border-amber-400/50 bg-amber-500/10" :
                "border-white/10 bg-white/5"
              )}>
                <PixelHand move={phase === 'shaking' ? 'rock' : playerMove} size={64} />
              </div>
              {playerMove && phase !== 'shaking' && (
                <span className="text-xs text-white/50 font-mono">{MOVE_LABELS[playerMove]}</span>
              )}
            </div>

            {/* VS */}
            <div className="flex flex-col items-center gap-1">
              <span className={cn(
                "text-2xl font-black font-mono transition-all duration-500",
                roundResult === 'win' ? "text-green-400 scale-125" :
                roundResult === 'lose' ? "text-red-400 scale-125" :
                roundResult === 'draw' ? "text-amber-400 scale-125" :
                "text-white/20"
              )} style={{ textShadow: '0 0 20px currentColor' }}>
                VS
              </span>
              {phase === 'shaking' && (
                <div className="flex gap-0.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all duration-200",
                      i <= shakeCount ? "bg-cyan-400" : "bg-white/10"
                    )} />
                  ))}
                </div>
              )}
            </div>

            {/* Computer */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <span className="text-[10px] text-purple-400/60 font-mono uppercase tracking-widest">CPU</span>
              <div className={cn(
                "w-24 h-24 rounded-2xl border-2 flex items-center justify-center transition-all duration-300",
                phase === 'shaking' ? "border-purple-400/50 bg-purple-500/10 animate-[rps-shake_0.4s_ease-in-out_infinite_reverse]" :
                roundResult === 'lose' ? "border-green-400/50 bg-green-500/10" :
                roundResult === 'win' ? "border-red-400/50 bg-red-500/10" :
                roundResult === 'draw' ? "border-amber-400/50 bg-amber-500/10" :
                "border-white/10 bg-white/5"
              )}>
                <PixelHand move={phase === 'shaking' ? 'rock' : computerMove} flip size={64} />
              </div>
              {computerMove && phase !== 'shaking' && (
                <span className="text-xs text-white/50 font-mono">{MOVE_LABELS[computerMove]}</span>
              )}
            </div>
          </div>

          {/* Result banner */}
          {phase === 'reveal' && roundResult && (
            <div className={cn(
              "mt-5 py-3 rounded-xl text-center font-bold text-lg font-mono animate-[rps-result-in_0.5s_cubic-bezier(0.34,1.56,0.64,1)_both]",
              roundResult === 'win' && "bg-green-500/10 text-green-400 border border-green-500/30",
              roundResult === 'lose' && "bg-red-500/10 text-red-400 border border-red-500/30",
              roundResult === 'draw' && "bg-amber-500/10 text-amber-400 border border-amber-500/30",
            )} style={{ textShadow: '0 0 20px currentColor' }}>
              {roundResult === 'win' && t('games_you_win')}
              {roundResult === 'lose' && t('games_you_lose')}
              {roundResult === 'draw' && t('games_draw')}
              <div className="text-sm mt-1 opacity-70">
                {rounds[rounds.length - 1]?.points > 0
                  ? `+${rounds[rounds.length - 1].points}`
                  : rounds[rounds.length - 1]?.points === 0
                  ? '0'
                  : rounds[rounds.length - 1]?.points
                } نقطة
              </div>
            </div>
          )}
        </div>

        {/* Move selection */}
        {phase === 'choose' && (
          <div className="space-y-4">
            <p className="text-center text-white/30 text-xs font-mono tracking-wider uppercase">
              {t('games_choose_move')}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {MOVES.map(move => (
                <button
                  key={move}
                  onClick={() => playRound(move)}
                  className="group flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-white/10 bg-white/[0.03] hover:border-cyan-400/50 hover:bg-cyan-500/10 transition-all duration-200 active:scale-90 hover:scale-105"
                >
                  <span className="text-4xl group-hover:animate-[rps-bounce_0.3s_ease-out]">
                    {move === 'rock' ? '✊' : move === 'paper' ? '✋' : '✌️'}
                  </span>
                  <span className="text-[11px] font-mono text-white/40 group-hover:text-cyan-300 transition-colors">
                    {MOVE_LABELS[move]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Game Over */}
        {phase === 'gameover' && (
          <div className="text-center space-y-5 animate-[rps-result-in_0.6s_cubic-bezier(0.34,1.56,0.64,1)_both]">
            <h2 className="text-2xl font-black font-mono" style={{ textShadow: '2px 2px 0 #0f3460' }}>
              {t('games_game_over')}
            </h2>

            {/* Round icons */}
            <div className="flex justify-center gap-3">
              {rounds.map((r, i) => (
                <div key={i} className={cn(
                  "w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5",
                  r.result === 'win' && "border-green-500/40 bg-green-500/10",
                  r.result === 'lose' && "border-red-500/40 bg-red-500/10",
                  r.result === 'draw' && "border-amber-500/40 bg-amber-500/10",
                )}>
                  <span className="text-lg">
                    {r.playerMove === 'rock' ? '✊' : r.playerMove === 'paper' ? '✋' : '✌️'}
                  </span>
                  <span className={cn(
                    "text-[10px] font-mono font-bold",
                    r.result === 'win' && "text-green-400",
                    r.result === 'lose' && "text-red-400",
                    r.result === 'draw' && "text-amber-400",
                  )}>
                    {r.points > 0 ? `+${r.points}` : r.points}
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className={cn(
              "text-3xl font-black font-mono",
              totalPoints > 0 ? "text-green-400" : totalPoints < 0 ? "text-red-400" : "text-white/50"
            )} style={{ textShadow: '0 0 30px currentColor' }}>
              {t('games_total_result')}: {totalPoints > 0 ? `+${totalPoints}` : totalPoints}
            </div>

            <Button
              onClick={resetGame}
              className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 font-mono gap-2"
              size="lg"
            >
              <RotateCcw className="h-4 w-4" />
              {t('games_play_again')}
            </Button>
          </div>
        )}

        {/* History */}
        {rounds.length > 0 && phase !== 'gameover' && (
          <div className="mt-6 space-y-2">
            {rounds.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 text-sm font-mono">
                <span className="text-white/30">{t('games_round')} {i + 1}</span>
                <div className="flex items-center gap-2">
                  <span>{r.playerMove === 'rock' ? '✊' : r.playerMove === 'paper' ? '✋' : '✌️'}</span>
                  <span className="text-white/20 text-xs">vs</span>
                  <span>{r.computerMove === 'rock' ? '✊' : r.computerMove === 'paper' ? '✋' : '✌️'}</span>
                </div>
                <span className={cn(
                  "font-bold text-xs",
                  r.result === 'win' && "text-green-400",
                  r.result === 'lose' && "text-red-400",
                  r.result === 'draw' && "text-amber-400",
                )}>
                  {r.points > 0 ? `+${r.points}` : r.points}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
