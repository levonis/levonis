/**
 * 🏦 PIXEL BANK - Investment Risk Game
 * Invest points, choose duration, risk robbery!
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { ArrowRight, Coins, TrendingUp, Shield, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

// ── Duration tiers ──
interface DurationTier {
  id: string;
  label: string;
  interest: number;      // e.g. 0.01 = 1%
  successRate: number;    // e.g. 0.85
  partialRate: number;    // e.g. 0.12
  fullTheftRate: number;  // e.g. 0.03
  icon: string;
  riskLabel: string;
}

const DURATIONS: DurationTier[] = [
  { id: "week",    label: "أسبوع",   interest: 0.01, successRate: 0.85, partialRate: 0.12, fullTheftRate: 0.03, icon: "📅", riskLabel: "منخفض" },
  { id: "2weeks",  label: "أسبوعين", interest: 0.04, successRate: 0.70, partialRate: 0.22, fullTheftRate: 0.08, icon: "📆", riskLabel: "متوسط" },
  { id: "month",   label: "شهر",     interest: 0.10, successRate: 0.55, partialRate: 0.30, fullTheftRate: 0.15, icon: "🗓️", riskLabel: "عالي" },
  { id: "6months", label: "6 أشهر",  interest: 1.00, successRate: 0.35, partialRate: 0.35, fullTheftRate: 0.30, icon: "⏳", riskLabel: "خطير" },
  { id: "year",    label: "سنة",     interest: 5.00, successRate: 0.15, partialRate: 0.35, fullTheftRate: 0.50, icon: "🏛️", riskLabel: "مجنون!" },
];

type GamePhase = "setup" | "investing" | "result";
type ResultType = "success" | "partial_theft" | "full_theft";

const MIN_INVEST = 10;
const MAX_INVEST = 500;

// ── Pixel Vault Canvas ──
function VaultCanvas({ phase, result, size = 120 }: { phase: GamePhase; result: ResultType | null; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const animRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;
    const px = Math.floor(size / 16);
    ctx.imageSmoothingEnabled = false;

    const drawPixel = (x: number, y: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x * px, y * px, px, px);
    };

    const drawVault = (open: boolean) => {
      const body = "#6b7280";
      const dark = "#374151";
      const handle = "#c7b46c";
      const outline = "#1f2937";

      // Vault body
      for (let y = 4; y <= 13; y++) {
        for (let x = 3; x <= 12; x++) {
          drawPixel(x, y, y === 4 || y === 13 || x === 3 || x === 12 ? outline : body);
        }
      }
      // Door lines
      if (!open) {
        drawPixel(7, 7, dark); drawPixel(8, 7, dark);
        drawPixel(7, 8, handle); drawPixel(8, 8, handle);
        drawPixel(7, 9, dark); drawPixel(8, 9, dark);
        // Handle circle
        drawPixel(9, 8, handle); drawPixel(10, 8, handle);
        drawPixel(9, 7, handle); drawPixel(9, 9, handle);
      } else {
        // Open door - show inside
        for (let y = 5; y <= 12; y++) {
          for (let x = 4; x <= 11; x++) {
            drawPixel(x, y, "#1a1a2e");
          }
        }
        // Gold coins inside
        drawPixel(6, 10, "#c7b46c"); drawPixel(7, 10, "#c7b46c");
        drawPixel(5, 11, "#c7b46c"); drawPixel(6, 11, "#d4a843"); drawPixel(7, 11, "#c7b46c"); drawPixel(8, 11, "#d4a843");
      }
      // Base
      for (let x = 2; x <= 13; x++) drawPixel(x, 14, outline);
    };

    const drawCoins = (frame: number) => {
      const coins = [
        { x: 5, y: 2 - (frame % 6) * 0.5 },
        { x: 8, y: 1 - (frame % 8) * 0.4 },
        { x: 11, y: 3 - (frame % 5) * 0.6 },
      ];
      coins.forEach(c => {
        const y = Math.max(-1, c.y);
        if (y < 15) {
          drawPixel(Math.round(c.x), Math.round(y), "#c7b46c");
          drawPixel(Math.round(c.x) + 1, Math.round(y), "#d4a843");
        }
      });
    };

    const drawThief = (frame: number) => {
      const x = 12 + Math.floor(frame / 3) % 2;
      // Simple thief silhouette
      drawPixel(x, 5, "#1a1a2e"); // hat
      drawPixel(x, 6, "#1a1a2e"); drawPixel(x + 1, 6, "#1a1a2e");
      drawPixel(x, 7, "#2d1b1b"); // body
      drawPixel(x, 8, "#2d1b1b");
      // Mask
      drawPixel(x, 6, "#ef4444");
    };

    const render = () => {
      ctx.clearRect(0, 0, size, size);
      frameRef.current++;

      if (phase === "setup") {
        drawVault(false);
      } else if (phase === "investing") {
        // Shaking vault animation
        ctx.save();
        const shake = Math.sin(frameRef.current * 0.5) * 2;
        ctx.translate(shake, 0);
        drawVault(false);
        ctx.restore();
      } else if (phase === "result") {
        if (result === "success") {
          drawVault(true);
          drawCoins(frameRef.current);
        } else if (result === "partial_theft") {
          drawVault(true);
          drawThief(frameRef.current);
        } else {
          drawVault(true);
          drawThief(frameRef.current);
          // Fire/explosion
          drawPixel(6, 6, "#ef4444"); drawPixel(7, 5, "#f97316"); drawPixel(8, 6, "#ef4444");
        }
      }

      animRef.current = requestAnimationFrame(render);
    };

    render();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [phase, result, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={cn(phase === "investing" && "animate-pulse")}
      style={{ imageRendering: "pixelated", width: size, height: size }}
    />
  );
}

// ── Floating Coins Background ──
function FloatingCoins() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-sm opacity-15"
          style={{
            width: `${4 + (i % 3) * 2}px`,
            height: `${4 + (i % 3) * 2}px`,
            backgroundColor: i % 2 === 0 ? "hsl(var(--primary))" : "hsl(var(--accent))",
            left: `${(i * 31) % 100}%`,
            top: `${(i * 29 + 5) % 100}%`,
            animation: `rps-float ${3 + (i % 4)}s ease-in-out ${i * 0.4}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

interface Props {
  onBack: () => void;
}

export default function BankGame({ onBack }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<GamePhase>("setup");
  const [selectedDuration, setSelectedDuration] = useState<DurationTier>(DURATIONS[0]);
  const [investAmount, setInvestAmount] = useState(50);
  const [resultType, setResultType] = useState<ResultType | null>(null);
  const [resultPoints, setResultPoints] = useState(0);
  const [stolenPercent, setStolenPercent] = useState(0);

  const { data: userPoints } = useQuery({
    queryKey: ["user-points-full", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("user_points").select("available_points").eq("user_id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const availablePoints = userPoints?.available_points || 0;
  const maxInvest = Math.min(MAX_INVEST, availablePoints);

  const updatePoints = useCallback(async (points: number, desc: string) => {
    if (!user || points === 0) return;
    try {
      await supabase.rpc("admin_adjust_points", {
        p_user_id: user.id,
        p_amount: points,
        p_description: desc,
        p_source: "game_bank",
      });
      queryClient.invalidateQueries({ queryKey: ["user-points-full"] });
    } catch { /* silent */ }
  }, [user, queryClient]);

  const handleInvest = useCallback(async () => {
    if (phase !== "setup" || investAmount < MIN_INVEST || investAmount > maxInvest) return;

    setPhase("investing");

    // Simulate after animation delay
    setTimeout(async () => {
      const roll = Math.random();
      const tier = selectedDuration;
      let type: ResultType;
      let pts: number;
      let stolen = 0;

      if (roll < tier.successRate) {
        type = "success";
        pts = Math.round(investAmount * tier.interest);
      } else if (roll < tier.successRate + tier.partialRate) {
        type = "partial_theft";
        stolen = Math.floor(20 + Math.random() * 60); // 20-80%
        pts = -Math.round(investAmount * (stolen / 100));
      } else {
        type = "full_theft";
        stolen = 100;
        pts = -investAmount;
      }

      setResultType(type);
      setResultPoints(pts);
      setStolenPercent(stolen);
      setPhase("result");

      await updatePoints(pts, type === "success"
        ? `ربح من استثمار البنك (${tier.label})`
        : type === "partial_theft"
        ? `سرقة جزئية من البنك (${stolen}%)`
        : `سرقة كاملة من البنك`
      );

      if (type === "success") toast.success(`🏦 ربحت ${pts} نقطة!`);
      else if (type === "partial_theft") toast.error(`🦹 سُرق ${stolen}% من استثمارك!`);
      else toast.error(`💀 سُرق كل المبلغ!`);
    }, 2500);
  }, [phase, investAmount, maxInvest, selectedDuration, updatePoints]);

  const resetGame = () => {
    setPhase("setup");
    setResultType(null);
    setResultPoints(0);
    setStolenPercent(0);
  };

  const riskColor = (tier: DurationTier) => {
    if (tier.successRate >= 0.7) return "text-green-400";
    if (tier.successRate >= 0.5) return "text-yellow-400";
    if (tier.successRate >= 0.3) return "text-orange-400";
    return "text-red-400";
  };

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
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground hover:text-foreground font-mono text-xs">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
          <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 border border-primary/40 bg-primary/10 font-mono text-sm font-bold text-primary">
            <Coins className="h-3.5 w-3.5" />
            {availablePoints.toLocaleString()}
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-5">
          <h1 className="text-xl font-black tracking-wider text-primary font-mono"
            style={{ textShadow: "2px 2px 0 hsl(var(--accent))" }}>
            🏦 بنك الاستثمار 🏦
          </h1>
          <p className="text-muted-foreground text-xs mt-1">استثمر نقاطك... لكن احذر اللصوص!</p>
        </div>

        {/* ── Vault Area ── */}
        <div className="relative bg-card border-2 border-primary/20 rounded-2xl p-6 mb-5 overflow-hidden">
          <FloatingCoins />
          <div className="relative flex justify-center mb-4">
            <VaultCanvas phase={phase} result={resultType} size={120} />
          </div>

          {/* Result Banner */}
          {phase === "result" && resultType && (
            <div className={cn(
              "py-3 px-4 rounded-xl text-center font-bold text-lg font-mono border-2 animate-fade-in",
              resultType === "success" && "bg-primary/10 text-primary border-primary/30",
              resultType === "partial_theft" && "bg-orange-500/10 text-orange-400 border-orange-500/30",
              resultType === "full_theft" && "bg-destructive/10 text-destructive border-destructive/30",
            )}>
              {resultType === "success" && (
                <>
                  <div>✅ استثمار ناجح!</div>
                  <div className="text-sm mt-1">+{resultPoints} نقطة ربح</div>
                </>
              )}
              {resultType === "partial_theft" && (
                <>
                  <div>🦹 سرقة جزئية!</div>
                  <div className="text-sm mt-1">خسرت {stolenPercent}% ({Math.abs(resultPoints)} نقطة)</div>
                </>
              )}
              {resultType === "full_theft" && (
                <>
                  <div>💀 سرقة كاملة!</div>
                  <div className="text-sm mt-1">خسرت كل المبلغ ({Math.abs(resultPoints)} نقطة)</div>
                </>
              )}
            </div>
          )}

          {/* Investing animation text */}
          {phase === "investing" && (
            <div className="text-center text-primary font-mono text-sm animate-pulse">
              جاري الاستثمار... ⏳
            </div>
          )}
        </div>

        {/* ── Setup Phase ── */}
        {phase === "setup" && (
          <div className="space-y-5">
            {/* Amount selector */}
            <div className="bg-card border border-primary/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-mono text-muted-foreground flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5" /> مبلغ الاستثمار
                </span>
                <span className="font-mono font-bold text-primary text-lg">{investAmount}</span>
              </div>
              <Slider
                value={[investAmount]}
                onValueChange={([v]) => setInvestAmount(v)}
                min={MIN_INVEST}
                max={maxInvest}
                step={5}
                className="mb-2"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>{MIN_INVEST} نقطة</span>
                <span>{maxInvest} نقطة</span>
              </div>
            </div>

            {/* Duration selector */}
            <div className="space-y-2">
              <span className="text-sm font-mono text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> اختر المدة
              </span>
              <div className="grid grid-cols-1 gap-2">
                {DURATIONS.map(tier => (
                  <button
                    key={tier.id}
                    onClick={() => setSelectedDuration(tier)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border-2 transition-all font-mono text-sm",
                      selectedDuration.id === tier.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/40"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{tier.icon}</span>
                      <div className="text-right">
                        <div className="font-bold">{tier.label}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Shield className="h-2.5 w-2.5" />
                          نجاح {Math.round(tier.successRate * 100)}%
                        </div>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-primary font-bold">+{Math.round(tier.interest * 100)}%</div>
                      <div className={cn("text-[10px] flex items-center gap-0.5", riskColor(tier))}>
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {tier.riskLabel}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Expected profit/loss */}
            <div className="bg-card border border-primary/20 rounded-xl p-3 text-xs font-mono">
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">الربح المتوقع:</span>
                <span className="text-primary font-bold">+{Math.round(investAmount * selectedDuration.interest)} نقطة</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">أقصى خسارة:</span>
                <span className="text-destructive font-bold">-{investAmount} نقطة</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">احتمال النجاح:</span>
                <span className={riskColor(selectedDuration)}>{Math.round(selectedDuration.successRate * 100)}%</span>
              </div>
            </div>

            {/* Invest button */}
            <Button
              onClick={handleInvest}
              disabled={investAmount < MIN_INVEST || availablePoints < MIN_INVEST}
              className="w-full py-6 text-lg font-mono font-black tracking-wider bg-primary text-primary-foreground hover:bg-primary/90"
            >
              🏦 استثمر الآن!
            </Button>

            {availablePoints < MIN_INVEST && (
              <p className="text-center text-destructive text-xs font-mono">
                تحتاج {MIN_INVEST} نقطة على الأقل للاستثمار
              </p>
            )}
          </div>
        )}

        {/* ── Result Phase ── */}
        {phase === "result" && (
          <div className="space-y-3 mt-4">
            <Button
              onClick={resetGame}
              className="w-full py-5 font-mono font-bold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              🔄 استثمار جديد
            </Button>
            <Button
              variant="ghost"
              onClick={onBack}
              className="w-full font-mono text-muted-foreground"
            >
              العودة للألعاب
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
