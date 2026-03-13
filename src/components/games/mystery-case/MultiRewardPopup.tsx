import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Gift, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Confetti from "./Confetti";
import { useState, useEffect } from "react";

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

interface RewardItem {
  name_ar: string;
  image_url: string | null;
  rarity: string;
  reward_type: string;
  ticket_reward_amount?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  rewards: RewardItem[];
}

export default function MultiRewardPopup({ open, onClose, rewards }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);

  // Reset index when rewards change or popup opens
  useEffect(() => {
    if (open) setCurrentIdx(0);
  }, [open, rewards]);

  if (!rewards || rewards.length === 0) return null;

  const isSingle = rewards.length === 1;
  const reward = rewards[currentIdx] || rewards[0];
  const color = RARITY_COLORS[reward.rarity] || RARITY_COLORS.common;
  const isLegendary = reward.rarity === "legendary" || reward.rarity === "epic" || reward.rarity === "mythic";
  const hasAnyLegendary = rewards.some(r => ["legendary", "epic", "mythic"].includes(r.rarity));

  const goNext = () => setCurrentIdx((i) => Math.min(i + 1, rewards.length - 1));
  const goPrev = () => setCurrentIdx((i) => Math.max(i - 1, 0));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

          {hasAnyLegendary && <Confetti />}

          <motion.div
            className="relative z-10 w-full max-w-sm rounded-xl border-2 p-6 text-center"
            style={{
              borderColor: color,
              boxShadow: `0 0 30px ${color}44, 0 0 60px ${color}22`,
              background: "hsl(var(--background))",
            }}
            initial={{ scale: 0.5, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 15 }}
            key={currentIdx}
          >
            <button onClick={onClose} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>

            {!isSingle && (
              <div className="absolute top-2 left-2 text-[10px] font-mono text-muted-foreground px-2 py-0.5 rounded bg-muted/30">
                {currentIdx + 1} / {rewards.length}
              </div>
            )}

            <motion.div
              className="mx-auto mb-3 w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: `${color}22`, color }}
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              {isLegendary ? <Sparkles className="h-6 w-6" /> : <Gift className="h-6 w-6" />}
            </motion.div>

            <p className="text-xs font-mono mb-2" style={{ color }}>
              {RARITY_LABELS[reward.rarity] || reward.rarity}
            </p>

            {reward.image_url ? (
              <img
                src={reward.image_url}
                alt={reward.name_ar}
                className="mx-auto w-24 h-24 object-contain mb-3"
                style={{ imageRendering: "pixelated" }}
              />
            ) : (
              <div className="mx-auto w-24 h-24 rounded-lg bg-muted/20 flex items-center justify-center mb-3 text-4xl">
                🎁
              </div>
            )}

            <h3 className="text-lg font-bold mb-1">{reward.name_ar}</h3>

            {reward.reward_type === "tickets" && reward.ticket_reward_amount ? (
              <p className="text-sm text-muted-foreground">+{reward.ticket_reward_amount} تذكرة</p>
            ) : (
              <p className="text-sm text-muted-foreground">تم إضافة الجائزة لمخزنك</p>
            )}

            <p className="text-xs text-primary font-mono mt-3">🎉 مبروك!</p>

            {!isSingle ? (
              <div className="flex items-center gap-2 mt-4">
                <Button
                  onClick={goPrev}
                  disabled={currentIdx === 0}
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs flex-1"
                >
                  <ChevronRight className="h-3 w-3 ml-1" /> السابق
                </Button>
                {currentIdx === rewards.length - 1 ? (
                  <Button onClick={onClose} size="sm" className="font-mono text-xs flex-1">
                    إغلاق
                  </Button>
                ) : (
                  <Button onClick={goNext} size="sm" className="font-mono text-xs flex-1">
                    التالي <ChevronLeft className="h-3 w-3 mr-1" />
                  </Button>
                )}
              </div>
            ) : (
              <Button onClick={onClose} className="mt-4 w-full font-mono text-xs" size="sm">
                حسناً
              </Button>
            )}

            {!isSingle && (
              <div className="flex justify-center gap-1 mt-3">
                {rewards.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIdx(i)}
                    className="w-2 h-2 rounded-full transition-all"
                    style={{
                      background: i === currentIdx ? (RARITY_COLORS[r.rarity] || "#9ca3af") : "hsl(var(--muted))",
                      transform: i === currentIdx ? "scale(1.4)" : "scale(1)",
                    }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
