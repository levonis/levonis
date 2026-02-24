// Rock Paper Scissors - Pixel Art Edition v1
import { useState, useCallback, useEffect, useRef } from "react";
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

/* ── Pixel Art Hand (Canvas-drawn) ── */
function PixelCanvas({ move, size = 80, shake = false, flip = false }: { move: Move | null; size?: number; shake?: boolean; flip?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const s = size;
    canvas.width = s;
    canvas.height = s;
    const px = Math.floor(s / 16); // pixel unit

    ctx.imageSmoothingEnabled = false;

    const drawPixel = (x: number, y: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x * px, y * px, px, px);
    };

    const drawRock = () => {
      const skin = '#c7b46c'; // gold
      const outline = '#8e6c3d'; // copper
      const shadow = '#2b2711';
      // Fist shape
      [5,6,7,8,9,10].forEach(x => drawPixel(x, 4, outline));
      [4,5,6,7,8,9,10,11].forEach(x => drawPixel(x, 5, outline));
      [4,11].forEach(x => drawPixel(x, 6, outline));
      [5,6,7,8,9,10].forEach(x => drawPixel(x, 6, skin));
      [4,11].forEach(x => drawPixel(x, 7, outline));
      [5,6,7,8,9,10].forEach(x => drawPixel(x, 7, skin));
      [4,11].forEach(x => drawPixel(x, 8, outline));
      [5,6,7,8,9,10].forEach(x => drawPixel(x, 8, skin));
      [4,5,6,7,8,9,10,11].forEach(x => drawPixel(x, 9, outline));
      [5,6,7,8,9,10].forEach(x => drawPixel(x, 10, shadow));
    };

    const drawPaper = () => {
      const paper = '#efe6c9'; // cream
      const outline = '#c7b46c';
      const line = '#8e6c3d';
      [5,6,7,8,9,10].forEach(x => drawPixel(x, 3, outline));
      for (let y = 4; y <= 11; y++) {
        drawPixel(4, y, outline);
        drawPixel(11, y, outline);
        [5,6,7,8,9,10].forEach(x => drawPixel(x, y, paper));
      }
      [5,6,7,8,9,10].forEach(x => drawPixel(x, 12, outline));
      // Lines on paper
      [6,7,8,9].forEach(x => { drawPixel(x, 6, line); drawPixel(x, 8, line); drawPixel(x, 10, line); });
    };

    const drawScissors = () => {
      const metal = '#c7b46c';
      const outline = '#8e6c3d';
      const handle = '#2b2711';
      // Blades
      drawPixel(4, 3, outline); drawPixel(5, 4, metal); drawPixel(6, 5, metal); drawPixel(7, 6, metal);
      drawPixel(11, 3, outline); drawPixel(10, 4, metal); drawPixel(9, 5, metal); drawPixel(8, 6, metal);
      // Center pivot
      drawPixel(7, 7, outline); drawPixel(8, 7, outline);
      // Handles
      drawPixel(6, 8, handle); drawPixel(5, 9, handle); drawPixel(5, 10, handle); drawPixel(6, 11, handle);
      drawPixel(9, 8, handle); drawPixel(10, 9, handle); drawPixel(10, 10, handle); drawPixel(9, 11, handle);
    };

    const drawQuestion = () => {
      const c = '#c7b46c';
      [6,7,8,9].forEach(x => drawPixel(x, 4, c));
      drawPixel(9, 5, c); drawPixel(9, 6, c);
      drawPixel(8, 7, c); drawPixel(7, 8, c);
      drawPixel(7, 10, c);
    };

    let animId: number;
    const render = () => {
      ctx.clearRect(0, 0, s, s);
      
      if (flip) {
        ctx.save();
        ctx.translate(s, 0);
        ctx.scale(-1, 1);
      }

      if (!move) drawQuestion();
      else if (move === 'rock') drawRock();
      else if (move === 'paper') drawPaper();
      else drawScissors();

      if (flip) ctx.restore();

      if (shake) {
        frameRef.current++;
        animId = requestAnimationFrame(render);
      }
    };

    render();
    return () => { if (animId) cancelAnimationFrame(animId); };
  }, [move, size, shake, flip]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={cn(
        "transition-transform duration-200",
        shake && "animate-[rps-shake_0.4s_ease-in-out_infinite]"
      )}
      style={{ imageRendering: 'pixelated', width: size, height: size }}
    />
  );
}

/* ── Floating Pixels Background ── */
function FloatingPixels() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-sm opacity-20"
          style={{
            width: `${4 + (i % 3) * 2}px`,
            height: `${4 + (i % 3) * 2}px`,
            backgroundColor: i % 2 === 0 ? 'hsl(44 39% 60%)' : 'hsl(36 42% 40%)',
            left: `${(i * 37) % 100}%`,
            top: `${(i * 23 + 10) % 100}%`,
            animation: `rps-float ${3 + (i % 4)}s ease-in-out ${i * 0.3}s infinite alternate`,
          }}
        />
      ))}
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

  useEffect(() => {
    if (phase !== 'shaking') return;
    if (shakeCount >= 3) {
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

  const moveLabel = (m: Move) => m === 'rock' ? t('games_rock') : m === 'paper' ? t('games_paper') : t('games_scissors');

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      {/* Pixel grid overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, hsl(var(--primary)/0.1) 3px, hsl(var(--primary)/0.1) 4px),
                            repeating-linear-gradient(90deg, transparent, transparent 3px, hsl(var(--primary)/0.1) 3px, hsl(var(--primary)/0.1) 4px)`,
        }}
      />

      <div className="relative z-10 px-4 pt-6 pb-8 max-w-md mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground hover:text-foreground">
            <ArrowRight className="h-4 w-4" />
            {t('games_back')}
          </Button>
          <div className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 border font-mono text-sm font-bold",
            totalPoints > 0 ? "border-primary/40 bg-primary/10 text-primary" :
            totalPoints < 0 ? "border-destructive/40 bg-destructive/10 text-destructive" :
            "border-border bg-card text-muted-foreground"
          )}>
            <Coins className="h-3.5 w-3.5" />
            {totalPoints > 0 ? `+${totalPoints}` : totalPoints}
          </div>
        </div>

        {/* Title - Pixel style */}
        <div className="text-center mb-5">
          <h1 className="text-xl font-black tracking-wider text-primary"
            style={{
              fontFamily: "'Courier New', monospace",
              textShadow: '2px 2px 0 hsl(var(--accent))',
              letterSpacing: '0.1em',
            }}>
            ⚔️ {t('games_rps_title')} ⚔️
          </h1>
        </div>

        {/* Hearts (attempts) */}
        <div className="flex justify-center gap-2 mb-6">
          {[0, 1, 2].map(i => {
            const round = rounds[i];
            return (
              <div key={i} className="relative">
                <div className={cn(
                  "w-10 h-10 rounded-lg border-2 flex items-center justify-center font-mono text-lg transition-all duration-500",
                  !round && i < attemptsLeft && "border-primary/40 bg-primary/10",
                  !round && i >= attemptsLeft && "border-border bg-card/50 opacity-30",
                  round?.result === 'win' && "border-primary bg-primary/20 animate-[rps-pop_0.4s_ease-out]",
                  round?.result === 'lose' && "border-destructive/50 bg-destructive/10",
                  round?.result === 'draw' && "border-accent/50 bg-accent/10",
                )}>
                  {round
                    ? round.result === 'win' ? '⭐' : round.result === 'lose' ? '💀' : '🤝'
                    : i < attemptsLeft ? '❤️' : '🖤'}
                </div>
                {round && (
                  <span className={cn(
                    "absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold",
                    round.result === 'win' && "text-primary",
                    round.result === 'lose' && "text-destructive",
                    round.result === 'draw' && "text-accent",
                  )}>
                    {round.points > 0 ? `+${round.points}` : round.points}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Battle Arena ── */}
        <div className="relative bg-card border-2 border-primary/20 rounded-2xl p-6 mb-6 overflow-hidden">
          <FloatingPixels />
          
          {/* Corner decorations */}
          {['top-1 left-1', 'top-1 right-1', 'bottom-1 left-1', 'bottom-1 right-1'].map((pos, i) => (
            <div key={i} className={`absolute ${pos} w-2 h-2 bg-primary/20 rounded-sm`} />
          ))}

          <div className="relative flex items-center justify-between gap-2">
            {/* Player */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <span className="text-[10px] text-primary font-mono uppercase tracking-[0.2em] font-bold">
                أنت
              </span>
              <div className={cn(
                "w-24 h-24 rounded-xl border-2 flex items-center justify-center transition-all duration-300 bg-background/50",
                phase === 'shaking' && "border-primary/60",
                roundResult === 'win' && "border-primary bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.3)]",
                roundResult === 'lose' && "border-destructive/50 bg-destructive/5",
                roundResult === 'draw' && "border-accent/50 bg-accent/5",
                !roundResult && phase !== 'shaking' && "border-border",
              )}>
                <PixelCanvas move={phase === 'shaking' ? 'rock' : playerMove} shake={phase === 'shaking'} size={80} />
              </div>
              {playerMove && phase !== 'shaking' && (
                <span className="text-xs text-muted-foreground font-mono">{moveLabel(playerMove)}</span>
              )}
            </div>

            {/* VS Emblem */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className={cn(
                "w-12 h-12 rounded-xl border-2 flex items-center justify-center font-black font-mono text-sm transition-all duration-500",
                roundResult === 'win' && "border-primary bg-primary/20 text-primary scale-110",
                roundResult === 'lose' && "border-destructive/50 bg-destructive/10 text-destructive scale-110",
                roundResult === 'draw' && "border-accent/50 bg-accent/10 text-accent scale-110",
                !roundResult && "border-border bg-card text-muted-foreground",
              )} style={roundResult ? { boxShadow: '0 0 15px currentColor' } : undefined}>
                VS
              </div>
              {phase === 'shaking' && (
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all duration-200",
                      i <= shakeCount ? "bg-primary" : "bg-border"
                    )} />
                  ))}
                </div>
              )}
            </div>

            {/* CPU */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <span className="text-[10px] text-accent font-mono uppercase tracking-[0.2em] font-bold">
                CPU
              </span>
              <div className={cn(
                "w-24 h-24 rounded-xl border-2 flex items-center justify-center transition-all duration-300 bg-background/50",
                phase === 'shaking' && "border-accent/60",
                roundResult === 'lose' && "border-primary bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.3)]",
                roundResult === 'win' && "border-destructive/50 bg-destructive/5",
                roundResult === 'draw' && "border-accent/50 bg-accent/5",
                !roundResult && phase !== 'shaking' && "border-border",
              )}>
                <PixelCanvas move={phase === 'shaking' ? 'rock' : computerMove} shake={phase === 'shaking'} flip size={80} />
              </div>
              {computerMove && phase !== 'shaking' && (
                <span className="text-xs text-muted-foreground font-mono">{moveLabel(computerMove)}</span>
              )}
            </div>
          </div>

          {/* Result Banner */}
          {phase === 'reveal' && roundResult && (
            <div className={cn(
              "mt-5 py-3 px-4 rounded-xl text-center font-bold text-lg font-mono border-2 animate-[rps-result-in_0.5s_cubic-bezier(0.34,1.56,0.64,1)_both]",
              roundResult === 'win' && "bg-primary/10 text-primary border-primary/30",
              roundResult === 'lose' && "bg-destructive/10 text-destructive border-destructive/30",
              roundResult === 'draw' && "bg-accent/10 text-accent border-accent/30",
            )} style={{ textShadow: '0 0 15px currentColor' }}>
              {roundResult === 'win' && `⭐ ${t('games_you_win')}`}
              {roundResult === 'lose' && `💀 ${t('games_you_lose')}`}
              {roundResult === 'draw' && `🤝 ${t('games_draw')}`}
              <div className="text-sm mt-1 opacity-70">
                {rounds[rounds.length - 1]?.points > 0
                  ? `+${rounds[rounds.length - 1].points}`
                  : rounds[rounds.length - 1]?.points} {t('games_rock') === 'Rock' ? 'pts' : 'نقطة'}
              </div>
            </div>
          )}
        </div>

        {/* ── Move Selection ── */}
        {phase === 'choose' && (
          <div className="space-y-3">
            <p className="text-center text-muted-foreground text-xs font-mono tracking-wider uppercase">
              ▼ {t('games_choose_move')} ▼
            </p>
            <div className="grid grid-cols-3 gap-3">
              {MOVES.map(move => (
                <button
                  key={move}
                  onClick={() => playRound(move)}
                  className="group flex flex-col items-center gap-3 p-4 rounded-2xl border-2 border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 active:scale-90 hover:scale-105 hover:shadow-[0_0_15px_hsl(var(--primary)/0.2)]"
                >
                  <div className="group-hover:animate-[rps-bounce_0.3s_ease-out]">
                    <PixelCanvas move={move} size={56} />
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground group-hover:text-primary transition-colors font-bold">
                    {moveLabel(move)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Game Over ── */}
        {phase === 'gameover' && (
          <div className="text-center space-y-5 animate-[rps-result-in_0.6s_cubic-bezier(0.34,1.56,0.64,1)_both]">
            <h2 className="text-2xl font-black font-mono text-primary"
              style={{ textShadow: '2px 2px 0 hsl(var(--accent))' }}>
              🏁 {t('games_game_over')}
            </h2>

            {/* Round recap */}
            <div className="flex justify-center gap-3">
              {rounds.map((r, i) => (
                <div key={i} className={cn(
                  "w-16 h-16 rounded-xl border-2 flex flex-col items-center justify-center gap-1",
                  r.result === 'win' && "border-primary/40 bg-primary/10",
                  r.result === 'lose' && "border-destructive/40 bg-destructive/10",
                  r.result === 'draw' && "border-accent/40 bg-accent/10",
                )}>
                  <PixelCanvas move={r.playerMove} size={32} />
                  <span className={cn(
                    "text-[10px] font-mono font-bold",
                    r.result === 'win' && "text-primary",
                    r.result === 'lose' && "text-destructive",
                    r.result === 'draw' && "text-accent",
                  )}>
                    {r.points > 0 ? `+${r.points}` : r.points}
                  </span>
                </div>
              ))}
            </div>

            {/* Total score */}
            <div className={cn(
              "text-3xl font-black font-mono",
              totalPoints > 0 ? "text-primary" : totalPoints < 0 ? "text-destructive" : "text-muted-foreground"
            )} style={{ textShadow: '0 0 20px currentColor' }}>
              {t('games_total_result')}: {totalPoints > 0 ? `+${totalPoints}` : totalPoints}
            </div>

            <Button
              onClick={resetGame}
              variant="outline"
              size="lg"
              className="border-primary/30 hover:bg-primary/10 text-primary font-mono gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              {t('games_play_again')}
            </Button>
          </div>
        )}

        {/* ── Round History ── */}
        {rounds.length > 0 && phase !== 'gameover' && (
          <div className="mt-6 space-y-2">
            {rounds.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-card border border-border text-sm font-mono">
                <span className="text-muted-foreground">{t('games_round')} {i + 1}</span>
                <div className="flex items-center gap-3">
                  <PixelCanvas move={r.playerMove} size={24} />
                  <span className="text-muted-foreground text-xs">vs</span>
                  <PixelCanvas move={r.computerMove} size={24} flip />
                </div>
                <span className={cn(
                  "font-bold text-xs",
                  r.result === 'win' && "text-primary",
                  r.result === 'lose' && "text-destructive",
                  r.result === 'draw' && "text-accent",
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
