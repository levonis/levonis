import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
const GAP = 8;
const CELL = ITEM_WIDTH + GAP;
const REPEAT_COUNT = 20;
const WIN_POSITION = REPEAT_COUNT * 3 + 5; // place winner deep in the strip

const RARITY_WEIGHTS: Record<string, number> = {
  common: 10,
  rare: 5,
  epic: 3,
  legendary: 1,
  mythic: 1,
};

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

/** Build a weighted-shuffled pool from items */
function buildShuffledPool(items: ReelItem[]): ReelItem[] {
  if (items.length === 0) return [];

  const pool: ReelItem[] = [];
  items.forEach((item) => {
    const weight = RARITY_WEIGHTS[item.rarity] || RARITY_WEIGHTS.common;
    for (let i = 0; i < weight; i++) {
      pool.push(item);
    }
  });

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/** Build long reel strip with shuffled distribution */
function buildReelStrip(items: ReelItem[], winnerItem: ReelItem | null): ReelItem[] {
  if (items.length === 0) return [];

  const pool = buildShuffledPool(items);
  if (pool.length === 0) return [];

  const totalItems = Math.max(pool.length * REPEAT_COUNT, 80);
  const strip: ReelItem[] = [];

  for (let i = 0; i < totalItems; i++) {
    strip.push(pool[i % pool.length]);
  }

  // Inject rare/epic items periodically for visual excitement
  const rareItems = items.filter((it) => it.rarity === "rare" || it.rarity === "epic" || it.rarity === "legendary");
  if (rareItems.length > 0) {
    for (let i = 7; i < strip.length; i += Math.floor(6 + Math.random() * 5)) {
      strip[i] = rareItems[Math.floor(Math.random() * rareItems.length)];
    }
  }

  // Place winner at the designated stop position
  if (winnerItem && WIN_POSITION < strip.length) {
    strip[WIN_POSITION] = winnerItem;
  }

  return strip;
}

export default function ReelSpinner({ items, winnerIndex, spinning, onSpinComplete, animationDuration = 5000 }: Props) {
  const controls = useAnimation();
  const containerRef = useRef<HTMLDivElement>(null);
  const hasSpunRef = useRef(false);

  const winnerItem = winnerIndex !== null && items[winnerIndex] ? items[winnerIndex] : null;

  // Build reel strip — only rebuild when items change or a new spin starts
  const reelStrip = useMemo(() => {
    return buildReelStrip(items, winnerItem);
  }, [items, winnerIndex, spinning]);

  // Trigger spin animation
  useEffect(() => {
    if (!spinning || reelStrip.length === 0) return;
    if (hasSpunRef.current) return; // prevent double-trigger
    hasSpunRef.current = true;

    const containerW = containerRef.current?.offsetWidth || 320;
    const centerOffset = containerW / 2 - ITEM_WIDTH / 2;
    const targetX = -(WIN_POSITION * CELL - centerOffset);

    // Start from 0, animate to target
    controls.set({ x: 0 });
    controls.start({
      x: targetX,
      transition: {
        duration: animationDuration / 1000,
        ease: [0.12, 0.8, 0.2, 1], // fast start, smooth slow stop
      },
    }).then(() => {
      onSpinComplete();
    });
  }, [spinning, reelStrip.length]);

  // Reset spin lock when spinning ends
  useEffect(() => {
    if (!spinning) {
      hasSpunRef.current = false;
    }
  }, [spinning]);

  if (reelStrip.length === 0) {
    return (
      <div className="h-36 flex items-center justify-center text-muted-foreground font-mono text-xs">
        لا توجد جوائز حالياً
      </div>
    );
  }

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

      {/* Reel strip — NEVER cleared */}
      <div className="py-3">
        <motion.div
          className="flex"
          animate={controls}
          style={{ willChange: "transform", gap: GAP }}
        >
          {reelStrip.map((item, i) => {
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
