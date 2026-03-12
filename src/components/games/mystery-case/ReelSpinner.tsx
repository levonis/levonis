import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useAnimation } from "framer-motion";

export interface ReelItem {
  id: string;
  name_ar: string;
  image_url: string | null;
  rarity: string;
}

interface Props {
  items: ReelItem[];
  winnerIndex: number | null;
  spinning: boolean;
  onSpinComplete: () => void;
  animationDuration?: number;
}

const ITEM_WIDTH = 120;
const VISIBLE_COUNT = 40; // items in the reel strip
const RARITY_COLORS: Record<string, string> = {
  common: "#9ca3af",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
  mythic: "#ef4444",
};

const RARITY_GLOW: Record<string, string> = {
  common: "0 0 8px #9ca3af44",
  rare: "0 0 12px #3b82f688",
  epic: "0 0 16px #a855f788",
  legendary: "0 0 20px #f59e0b88, 0 0 40px #f59e0b44",
  mythic: "0 0 24px #ef444488, 0 0 48px #ef444444",
};

export default function ReelSpinner({ items, winnerIndex, spinning, onSpinComplete, animationDuration = 5000 }: Props) {
  const controls = useAnimation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [reelItems, setReelItems] = useState<ReelItem[]>([]);
  const [finalX, setFinalX] = useState(0);

  // Build reel strip with items repeating, winner placed at a specific position
  useEffect(() => {
    if (items.length === 0) return;
    const strip: ReelItem[] = [];
    for (let i = 0; i < VISIBLE_COUNT; i++) {
      strip.push(items[i % items.length]);
    }
    // Place the winner near the end
    if (winnerIndex !== null && items[winnerIndex]) {
      const winPos = VISIBLE_COUNT - 6; // stop position
      strip[winPos] = items[winnerIndex];
      setFinalX(winPos);
    }
    setReelItems(strip);
  }, [items, winnerIndex]);

  // Trigger spin animation
  useEffect(() => {
    if (!spinning || reelItems.length === 0) return;

    const containerW = containerRef.current?.offsetWidth || 320;
    const centerOffset = containerW / 2 - ITEM_WIDTH / 2;
    const targetX = -(finalX * ITEM_WIDTH - centerOffset);

    controls.set({ x: 0 });
    controls.start({
      x: targetX,
      transition: {
        duration: animationDuration / 1000,
        ease: [0.15, 0.85, 0.25, 1], // custom ease - fast start, slow stop
      },
    }).then(() => {
      onSpinComplete();
    });
  }, [spinning, reelItems, finalX, animationDuration]);

  return (
    <div className="relative w-full overflow-hidden" ref={containerRef}>
      {/* Center pointer */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-0.5 h-full bg-primary" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 -mt-1">
        <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-primary" />
      </div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 -mb-1">
        <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-b-[10px] border-l-transparent border-r-transparent border-b-primary" />
      </div>

      {/* Gradient edges */}
      <div className="absolute inset-y-0 left-0 w-12 z-10 bg-gradient-to-r from-background to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-12 z-10 bg-gradient-to-l from-background to-transparent pointer-events-none" />

      {/* Reel strip */}
      <div className="py-3">
        <motion.div
          className="flex gap-2"
          animate={controls}
          style={{ willChange: "transform" }}
        >
          {reelItems.map((item, i) => {
            const color = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
            const glow = RARITY_GLOW[item.rarity] || RARITY_GLOW.common;
            return (
              <div
                key={`${item.id}-${i}`}
                className="shrink-0 flex flex-col items-center justify-center rounded-lg border-2 p-2"
                style={{
                  width: ITEM_WIDTH,
                  height: ITEM_WIDTH + 20,
                  borderColor: color,
                  boxShadow: glow,
                  background: `linear-gradient(180deg, ${color}11, ${color}22)`,
                  imageRendering: "pixelated",
                }}
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name_ar}
                    className="w-14 h-14 object-contain mb-1"
                    style={{ imageRendering: "pixelated" }}
                    loading="lazy"
                  />
                ) : (
                  <div className="w-14 h-14 rounded bg-muted/30 flex items-center justify-center mb-1 text-2xl">🎁</div>
                )}
                <span
                  className="text-[10px] font-mono text-center leading-tight line-clamp-2"
                  style={{ color }}
                >
                  {item.name_ar}
                </span>
              </div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
