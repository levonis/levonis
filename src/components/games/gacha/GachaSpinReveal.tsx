import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface SpinResult {
  spin_id: string;
  prize_type: string;
  prize_name: string;
  prize_name_ar: string;
  prize_image_url?: string;
  points_value?: number;
  rarity?: { name: string; name_ar: string; color: string; glow_color: string } | null;
  is_guaranteed: boolean;
}

interface Props {
  results: SpinResult[];
  onDone: () => void;
  onSpinAgain: () => void;
}

const PRIZE_EMOJI: Record<string, string> = {
  doll: "🧸",
  coupon: "🎟️",
  points: "⭐",
  advice: "💡",
};

type Phase = "knob" | "drop" | "center" | "split" | "revealed";

export default function GachaSpinReveal({ results, onDone, onSpinAgain }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("knob");

  const current = results[currentIndex];
  const isLast = currentIndex === results.length - 1;
  const rarityColor = current?.rarity?.color || "#9CA3AF";
  const glowColor = current?.rarity?.glow_color || "#9CA3AF";

  useEffect(() => {
    setPhase("knob");
    const timers = [
      setTimeout(() => setPhase("drop"), 800),
      setTimeout(() => setPhase("center"), 2000),
      setTimeout(() => setPhase("split"), 2500),
      setTimeout(() => setPhase("revealed"), 3400),
    ];
    return () => timers.forEach(clearTimeout);
  }, [currentIndex]);

  const handleNext = () => {
    if (isLast) {
      onDone();
    } else {
      setCurrentIndex(i => i + 1);
    }
  };

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" dir="rtl">
      {/* Background particles */}
      {phase === "revealed" && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: glowColor }}
              initial={{ x: "50%", y: "50%", scale: 0, opacity: 0 }}
              animate={{
                x: `${10 + Math.random() * 80}%`,
                y: `${10 + Math.random() * 80}%`,
                scale: [0, 1.5, 0],
                opacity: [0, 0.7, 0],
              }}
              transition={{ duration: 1.5 + Math.random(), delay: Math.random() * 0.3 }}
            />
          ))}
        </div>
      )}

      <div className="relative w-full max-w-sm mx-auto px-6 text-center">
        {/* Counter */}
        {results.length > 1 && (
          <div className="mb-6 text-sm text-white/40 font-mono">
            {currentIndex + 1} / {results.length}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div key={currentIndex} className="relative flex flex-col items-center">
            
            {/* Phase 1: Knob turning with machine shake */}
            {phase === "knob" && (
              <motion.div
                className="flex flex-col items-center"
                animate={{ x: [0, -3, 3, -2, 2, 0] }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                {/* Mini machine body */}
                <div className="w-28 h-16 rounded-t-2xl bg-gradient-to-b from-zinc-600 to-zinc-800 relative overflow-hidden">
                  <div className="absolute inset-2 rounded-xl bg-gradient-to-b from-white/15 to-white/5 flex items-center justify-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="w-3 h-3 rounded-full" style={{ background: ["#EF4444","#3B82F6","#22C55E","#A855F7","#F59E0B"][i] }} />
                    ))}
                  </div>
                </div>
                <div className="w-32 h-20 bg-gradient-to-b from-red-600 to-red-900 rounded-b-xl relative flex items-center justify-center">
                  <motion.div
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border-2 border-black/30 flex items-center justify-center"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.7, ease: "easeInOut" }}
                    style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.4)" }}
                  >
                    <div className="w-5 h-0.5 bg-black/30 rounded" />
                  </motion.div>
                </div>
                <p className="text-white/50 text-xs mt-4 animate-pulse">جاري اللف...</p>
              </motion.div>
            )}

            {/* Phase 2: Capsule dropping down */}
            {phase === "drop" && (
              <div className="relative h-64 w-full flex items-start justify-center">
                <motion.div
                  className="w-16 h-16 rounded-full relative"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, ${rarityColor}, ${rarityColor}88)`,
                    boxShadow: `0 4px 20px ${glowColor}40, inset -3px -3px 6px rgba(0,0,0,0.3), inset 3px 3px 6px rgba(255,255,255,0.2)`,
                  }}
                  initial={{ y: -40, opacity: 0, scale: 0.5 }}
                  animate={{ y: 180, opacity: 1, scale: 1 }}
                  transition={{ duration: 1, ease: [0.45, 0, 0.55, 1] }}
                >
                  {/* Capsule split line */}
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-black/20 -translate-y-1/2" />
                  {/* Shine */}
                  <div className="absolute top-2 right-3 w-3 h-3 rounded-full bg-white/40" />
                </motion.div>
              </div>
            )}

            {/* Phase 3: Capsule centers and grows */}
            {phase === "center" && (
              <motion.div
                className="w-24 h-24 rounded-full relative"
                style={{
                  background: `radial-gradient(circle at 35% 30%, ${rarityColor}, ${rarityColor}88)`,
                  boxShadow: `0 0 40px ${glowColor}50, 0 0 80px ${glowColor}20`,
                }}
                initial={{ scale: 0.8, opacity: 0.8 }}
                animate={{ scale: [0.8, 1.3, 1.1] }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-black/20 -translate-y-1/2" />
                <div className="absolute top-3 right-5 w-4 h-4 rounded-full bg-white/30" />
                {/* Pulse ring */}
                <motion.div
                  className="absolute -inset-4 rounded-full border-2"
                  style={{ borderColor: `${rarityColor}40` }}
                  animate={{ scale: [1, 1.3], opacity: [0.6, 0] }}
                  transition={{ duration: 0.5 }}
                />
              </motion.div>
            )}

            {/* Phase 4: Capsule splits open */}
            {phase === "split" && (
              <div className="relative flex flex-col items-center">
                {/* Top half */}
                <motion.div
                  className="w-24 h-12 rounded-t-full overflow-hidden relative"
                  style={{
                    background: `radial-gradient(circle at 35% 60%, ${rarityColor}, ${rarityColor}88)`,
                  }}
                  initial={{ y: 0 }}
                  animate={{ y: -60, rotateX: 30, opacity: 0.4 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                >
                  <div className="absolute top-3 right-5 w-4 h-4 rounded-full bg-white/30" />
                </motion.div>

                {/* Prize reveal */}
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 15 }}
                >
                  <div
                    className="w-28 h-28 rounded-full flex items-center justify-center"
                    style={{
                      boxShadow: `0 0 50px ${glowColor}50, 0 0 100px ${glowColor}20`,
                      background: `radial-gradient(circle, ${rarityColor}20, transparent 70%)`,
                    }}
                  >
                    {current.prize_image_url ? (
                      <img src={current.prize_image_url} alt={current.prize_name_ar} className="w-20 h-20 object-contain drop-shadow-2xl" loading="lazy" decoding="async" />
                    ) : (
                      <span className="text-5xl drop-shadow-2xl">{PRIZE_EMOJI[current.prize_type] || "🎁"}</span>
                    )}
                  </div>
                </motion.div>

                {/* Bottom half */}
                <motion.div
                  className="w-24 h-12 rounded-b-full overflow-hidden relative"
                  style={{
                    background: `radial-gradient(circle at 35% 40%, ${rarityColor}88, ${rarityColor}66)`,
                  }}
                  initial={{ y: 0 }}
                  animate={{ y: 60, rotateX: -30, opacity: 0.4 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            )}

            {/* Phase 5: Full reveal with details */}
            {phase === "revealed" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center"
              >
                {/* Prize glow ring */}
                <div
                  className="w-32 h-32 rounded-full flex items-center justify-center mb-4"
                  style={{
                    boxShadow: `0 0 60px ${glowColor}40, 0 0 120px ${glowColor}15`,
                    background: `radial-gradient(circle, ${rarityColor}15, transparent 70%)`,
                  }}
                >
                  {current.prize_image_url ? (
                    <img src={current.prize_image_url} alt={current.prize_name_ar} className="w-24 h-24 object-contain drop-shadow-2xl" loading="lazy" decoding="async" />
                  ) : (
                    <span className="text-6xl drop-shadow-2xl">{PRIZE_EMOJI[current.prize_type] || "🎁"}</span>
                  )}
                </div>

                {/* Rarity badge */}
                {current.rarity && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-3"
                    style={{
                      backgroundColor: `${rarityColor}25`,
                      color: rarityColor,
                      border: `1px solid ${rarityColor}40`,
                      textShadow: `0 0 10px ${glowColor}60`,
                    }}
                  >
                    {current.rarity.name_ar}
                  </motion.div>
                )}

                {/* Guaranteed badge */}
                {current.is_guaranteed && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-[10px] text-amber-400 font-medium mb-2">
                    ⭐ مكافأة مضمونة
                  </span>
                )}

                {/* Prize name */}
                <h2 className="text-lg font-bold text-white mb-1">{current.prize_name_ar}</h2>

                {current.prize_type === "points" && current.points_value && (
                  <p className="text-primary font-bold text-sm">+{current.points_value} نقطة</p>
                )}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Action Buttons */}
        {phase === "revealed" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 flex flex-col gap-2"
          >
            <Button onClick={handleNext} className="w-full bg-primary hover:bg-primary/90">
              {isLast ? "إغلاق" : "التالي ➜"}
            </Button>
            {isLast && (
              <Button onClick={onSpinAgain} variant="outline" className="w-full border-primary/30 text-primary">
                🔄 لف مرة أخرى
              </Button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
