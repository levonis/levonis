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

export default function GachaSpinReveal({ results, onDone, onSpinAgain }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealing, setRevealing] = useState(true);
  const [capsuleOpen, setCapsuleOpen] = useState(false);

  const current = results[currentIndex];
  const isLast = currentIndex === results.length - 1;
  const rarityColor = current?.rarity?.color || "#9CA3AF";
  const glowColor = current?.rarity?.glow_color || "#9CA3AF";

  useEffect(() => {
    setRevealing(true);
    setCapsuleOpen(false);
    const timer = setTimeout(() => {
      setCapsuleOpen(true);
      setTimeout(() => setRevealing(false), 600);
    }, 1200);
    return () => clearTimeout(timer);
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
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" dir="rtl">
      {/* Background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{ backgroundColor: glowColor, opacity: 0.4 }}
            initial={{ x: "50vw", y: "50vh", scale: 0 }}
            animate={{
              x: `${Math.random() * 100}vw`,
              y: `${Math.random() * 100}vh`,
              scale: [0, 1, 0],
            }}
            transition={{ duration: 2 + Math.random() * 2, delay: Math.random(), repeat: Infinity }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-sm mx-auto px-6 text-center">
        {/* Counter */}
        {results.length > 1 && (
          <div className="mb-4 text-sm text-white/50 font-mono">
            {currentIndex + 1} / {results.length}
          </div>
        )}

        {/* Capsule Animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            className="relative"
          >
            {/* Capsule */}
            {!capsuleOpen && (
              <motion.div
                className="w-32 h-40 mx-auto rounded-full border-4 flex items-center justify-center"
                style={{ borderColor: rarityColor, boxShadow: `0 0 40px ${glowColor}40` }}
                animate={{ rotate: [0, -5, 5, -5, 5, 0], scale: [1, 1.05, 1, 1.05, 1] }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
              >
                <span className="text-4xl">🔮</span>
              </motion.div>
            )}

            {/* Revealed Prize */}
            {capsuleOpen && (
              <motion.div
                initial={{ scale: 0, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                {/* Glow ring */}
                <div 
                  className="w-36 h-36 mx-auto rounded-full flex items-center justify-center mb-4"
                  style={{ 
                    boxShadow: `0 0 60px ${glowColor}50, 0 0 120px ${glowColor}20`,
                    background: `radial-gradient(circle, ${rarityColor}15, transparent 70%)`,
                  }}
                >
                  {current.prize_image_url ? (
                    <img 
                      src={current.prize_image_url} 
                      alt={current.prize_name_ar} 
                      className="w-24 h-24 object-contain drop-shadow-2xl" 
                    />
                  ) : (
                    <span className="text-6xl drop-shadow-2xl">
                      {PRIZE_EMOJI[current.prize_type] || "🎁"}
                    </span>
                  )}
                </div>

                {/* Rarity badge */}
                {current.rarity && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
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
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flex items-center justify-center gap-1 mb-2"
                  >
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-[10px] text-amber-400 font-medium">
                      ⭐ مكافأة مضمونة
                    </span>
                  </motion.div>
                )}

                {/* Prize name */}
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-lg font-bold text-white mb-1"
                >
                  {current.prize_name_ar}
                </motion.h2>

                {current.prize_type === "points" && current.points_value && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-primary font-bold text-sm"
                  >
                    +{current.points_value} نقطة
                  </motion.p>
                )}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Action Buttons */}
        {!revealing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
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
