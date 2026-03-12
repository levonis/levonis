import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, useAnimation, useMotionValue } from "framer-motion";

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

const ITEM_W = 100;
const GAP = 12;
const CELL = ITEM_W + GAP;
const STRIP_REPEATS = 40;
const WIN_POS = STRIP_REPEATS - 8;
const IDLE_SPEED = 0.4; // px per frame

const RARITY_WEIGHTS: Record<string, number> = {
  common: 10, rare: 5, epic: 3, legendary: 1, mythic: 1,
};
const RARITY_COLORS: Record<string, string> = {
  common: "#9ca3af", rare: "#3b82f6", epic: "#a855f7",
  legendary: "#f59e0b", mythic: "#ef4444",
};
const RARITY_GLOW: Record<string, string> = {
  common: "0 0 6px #9ca3af33",
  rare: "0 0 10px #3b82f666",
  epic: "0 0 14px #a855f766",
  legendary: "0 0 18px #f59e0b77, 0 0 36px #f59e0b33",
  mythic: "0 0 22px #ef444477, 0 0 44px #ef444433",
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildPool(items: ReelItem[]): ReelItem[] {
  const pool: ReelItem[] = [];
  items.forEach((item) => {
    const w = RARITY_WEIGHTS[item.rarity] || 5;
    for (let i = 0; i < w; i++) pool.push(item);
  });
  return shuffle(pool);
}

function buildStrip(items: ReelItem[], winner: ReelItem | null): ReelItem[] {
  if (items.length === 0) return [];
  const pool = buildPool(items);
  const strip: ReelItem[] = [];
  const total = Math.max(pool.length * 3, STRIP_REPEATS);
  for (let i = 0; i < total; i++) strip.push(pool[i % pool.length]);

  // sprinkle rare items for visual bait
  const rares = items.filter((it) => ["rare", "epic", "legendary"].includes(it.rarity));
  if (rares.length > 0) {
    for (let i = 6; i < strip.length; i += 5 + Math.floor(Math.random() * 5)) {
      strip[i] = rares[Math.floor(Math.random() * rares.length)];
    }
  }

  if (winner && WIN_POS < strip.length) {
    strip[WIN_POS] = winner;
  }
  return strip;
}

export default function ReelSpinner({ items, winnerIndex, spinning, onSpinComplete, animationDuration = 4000 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const idleXRef = useRef(0);
  const isSpinningRef = useRef(false);
  const controls = useAnimation();

  const winner = winnerIndex !== null && items[winnerIndex] ? items[winnerIndex] : null;

  // Build strip once for idle, rebuild on spin
  const [strip, setStrip] = useState<ReelItem[]>([]);

  // Initial strip build
  useEffect(() => {
    if (items.length > 0 && strip.length === 0) {
      setStrip(buildStrip(items, null));
    }
  }, [items]);

  // === IDLE ANIMATION ===
  useEffect(() => {
    if (items.length === 0 || spinning) return;

    const poolWidth = strip.length * CELL;
    if (poolWidth === 0) return;

    const animate = () => {
      idleXRef.current -= IDLE_SPEED;
      // loop back seamlessly
      if (Math.abs(idleXRef.current) > poolWidth / 2) {
        idleXRef.current = 0;
      }
      if (stripRef.current) {
        stripRef.current.style.transform = `translate3d(${idleXRef.current}px, 0, 0)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    // Reset framer-motion control so it doesn't fight idle
    controls.stop();
    rafRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafRef.current);
  }, [items, spinning, strip.length]);

  // === SPIN ===
  useEffect(() => {
    if (!spinning || items.length === 0) return;
    if (isSpinningRef.current) return;
    isSpinningRef.current = true;

    // Stop idle
    cancelAnimationFrame(rafRef.current);

    // Build fresh strip with winner placed
    const newStrip = buildStrip(items, winner);
    setStrip(newStrip);

    // Need a frame for DOM to update
    requestAnimationFrame(() => {
      const containerW = containerRef.current?.offsetWidth || 320;
      const centerOffset = containerW / 2 - ITEM_W / 2;
      const targetX = -(WIN_POS * CELL - centerOffset);

      // Reset position and animate
      if (stripRef.current) {
        stripRef.current.style.transform = `translate3d(0, 0, 0)`;
      }
      controls.set({ x: 0 });
      controls.start({
        x: targetX,
        transition: {
          duration: animationDuration / 1000,
          ease: [0.08, 0.75, 0.15, 1],
        },
      }).then(() => {
        isSpinningRef.current = false;
        idleXRef.current = 0;
        onSpinComplete();
      });
    });
  }, [spinning]);

  // When framer-motion controls are active, let it drive the strip
  // When idle, the RAF drives it. We need both to coexist.
  // Solution: idle writes to stripRef.current.style directly, spin uses motion.

  if (strip.length === 0 && items.length === 0) {
    return (
      <div className="h-28 flex items-center justify-center text-muted-foreground font-mono text-xs">
        لا توجد جوائز حالياً
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden" ref={containerRef} style={{ height: ITEM_W + 32 }}>
      {/* Center pointer line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-0.5 h-full bg-primary opacity-80" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 -mt-1">
        <div className="w-0 h-0 border-l-[7px] border-r-[7px] border-t-[9px] border-l-transparent border-r-transparent border-t-primary" />
      </div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 -mb-1">
        <div className="w-0 h-0 border-l-[7px] border-r-[7px] border-b-[9px] border-l-transparent border-r-transparent border-b-primary" />
      </div>

      {/* Edge fades */}
      <div className="absolute inset-y-0 left-0 w-16 z-10 bg-gradient-to-r from-background to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-16 z-10 bg-gradient-to-l from-background to-transparent pointer-events-none" />

      {/* Reel — always rendered, never cleared */}
      <div className="absolute inset-0 flex items-center">
        <motion.div
          ref={stripRef}
          className="flex"
          animate={controls}
          style={{
            gap: GAP,
            willChange: "transform",
          }}
        >
          {strip.map((item, i) => {
            const color = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
            const glow = RARITY_GLOW[item.rarity] || RARITY_GLOW.common;
            return (
              <div
                key={`r-${i}`}
                className="shrink-0 flex flex-col items-center justify-center rounded-lg border-2 p-1.5"
                style={{
                  width: ITEM_W,
                  height: ITEM_W,
                  borderColor: color,
                  boxShadow: glow,
                  background: `linear-gradient(180deg, ${color}0a, ${color}18)`,
                }}
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name_ar}
                    className="w-11 h-11 object-contain mb-1"
                    style={{ imageRendering: "pixelated" }}
                    loading="lazy"
                  />
                ) : (
                  <div className="w-11 h-11 rounded bg-muted/20 flex items-center justify-center mb-1 text-lg">🎁</div>
                )}
                <span className="text-[9px] font-mono text-center leading-tight line-clamp-2" style={{ color }}>
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
