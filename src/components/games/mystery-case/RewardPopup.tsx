import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import Confetti from "./Confetti";

const RARITY_COLORS: Record<string, string> = {
  common: "#9ca3af",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

const RARITY_LABELS: Record<string, string> = {
  common: "عادي",
  rare: "نادر",
  epic: "أسطوري",
  legendary: "خرافي",
};

interface Props {
  open: boolean;
  onClose: () => void;
  reward: {
    name_ar: string;
    image_url: string | null;
    rarity: string;
    reward_type: string;
    ticket_reward_amount?: number;
  } | null;
}

export default function RewardPopup({ open, onClose, reward }: Props) {
  if (!reward) return null;
  const color = RARITY_COLORS[reward.rarity] || RARITY_COLORS.common;
  const isLegendary = reward.rarity === "legendary" || reward.rarity === "epic";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

          {/* Confetti for big wins */}
          {isLegendary && <Confetti />}

          {/* Modal */}
          <motion.div
            className="relative z-10 w-full max-w-xs rounded-xl border-2 p-6 text-center"
            style={{
              borderColor: color,
              boxShadow: `0 0 30px ${color}44, 0 0 60px ${color}22`,
              background: "hsl(var(--background))",
            }}
            initial={{ scale: 0.5, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 15 }}
          >
            <button onClick={onClose} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>

            {/* Sparkle icon */}
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

            {/* Image */}
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
              <p className="text-sm text-muted-foreground">
                +{reward.ticket_reward_amount} تذكرة
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                تم إضافة الجائزة لمخزنك
              </p>
            )}

            <p className="text-xs text-primary font-mono mt-3">🎉 مبروك!</p>

            <Button onClick={onClose} className="mt-4 w-full font-mono text-xs" size="sm">
              حسناً
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
