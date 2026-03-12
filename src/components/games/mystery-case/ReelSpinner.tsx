import { useState, useEffect, useRef, useMemo, useCallback } from "react";

export interface ReelItem {
  id: string;
  name_ar: string;
  image_url: string | null;
  rarity: string;
  drop_chance?: number | null;
}

interface Props {
  items: ReelItem[];
  winnerIndex: number | null;
  spinning: boolean;
  onSpinComplete: () => void;
  animationDuration?: number;
}

const ITEM_W = 100;
const ITEM_H = 100;
const GAP = 16;
const CELL = ITEM_W + GAP;
const MIN_REEL_ITEMS = 80;
const TARGET_REEL_ITEMS = 96;
const WIN_OFFSET_FROM_END = 14;
const IDLE_SPEED_PX_PER_MS = 0.03;

const RARITY_WEIGHTS: Record<string, number> = {
  common: 12,
  rare: 7,
  epic: 4,
  legendary: 2,
  mythic: 1,
};

const RARITY_COLORS: Record<string, string> = {
  common: "hsl(215 14% 60%)",
  rare: "hsl(217 91% 60%)",
  epic: "hsl(271 91% 65%)",
  legendary: "hsl(38 92% 50%)",
  mythic: "hsl(0 84% 60%)",
};

const RARITY_GLOW: Record<string, string> = {
  common: "0 0 6px hsl(215 14% 60% / 0.25)",
  rare: "0 0 10px hsl(217 91% 60% / 0.35)",
  epic: "0 0 14px hsl(271 91% 65% / 0.38)",
  legendary: "0 0 18px hsl(38 92% 50% / 0.42)",
  mythic: "0 0 22px hsl(0 84% 60% / 0.45)",
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeTranslateX(x: number, segmentWidth: number): number {
  if (segmentWidth <= 0) return x;
  const mod = ((x % segmentWidth) + segmentWidth) % segmentWidth;
  return mod - segmentWidth;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildVisualPool(items: ReelItem[]): ReelItem[] {
  if (items.length === 0) return [];

  const weighted: ReelItem[] = [];

  // Ensure every active reward (including 0% drop chance) appears visually at least once.
  weighted.push(...shuffle(items));

  items.forEach((item) => {
    const weight = RARITY_WEIGHTS[item.rarity] ?? 4;
    for (let i = 0; i < weight; i++) weighted.push(item);
  });

  return shuffle(weighted);
}

function buildBaseStrip(items: ReelItem[], winner: ReelItem | null): { strip: ReelItem[]; stopIndex: number } {
  if (items.length === 0) return { strip: [], stopIndex: 0 };

  const pool = buildVisualPool(items);
  const strip: ReelItem[] = [];
  let poolIndex = 0;

  while (strip.length < TARGET_REEL_ITEMS) {
    if (pool.length === 0) break;
    if (poolIndex >= pool.length) {
      poolIndex = 0;
    }
    strip.push(pool[poolIndex]);
    poolIndex += 1;
  }

  const rareBait = items.filter((it) => ["rare", "epic", "legendary", "mythic"].includes(it.rarity));
  if (rareBait.length > 0) {
    for (let i = 6; i < strip.length; ) {
      strip[i] = rareBait[Math.floor(Math.random() * rareBait.length)];
      i += 6 + Math.floor(Math.random() * 5); // every 6-10 items
    }
  }

  const stopIndex = Math.max(10, strip.length - WIN_OFFSET_FROM_END);
  if (winner && stopIndex < strip.length) {
    strip[stopIndex] = winner;
  }

  return { strip, stopIndex };
}

export default function ReelSpinner({
  items,
  winnerIndex,
  spinning,
  onSpinComplete,
  animationDuration = 4000,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const segmentWidthRef = useRef(0);
  const virtualXRef = useRef(0);
  const velocityRef = useRef(0);
  const stopIndexRef = useRef(0);

  const modeRef = useRef<"none" | "idle" | "drag" | "inertia" | "spin">("none");
  const dragRef = useRef({ active: false, lastX: 0, lastTime: 0 });

  const winner = winnerIndex !== null && items[winnerIndex] ? items[winnerIndex] : null;

  const [baseStrip, setBaseStrip] = useState<ReelItem[]>([]);

  const repeatedStrip = useMemo(() => {
    if (baseStrip.length === 0) return [];
    return [...baseStrip, ...baseStrip, ...baseStrip];
  }, [baseStrip]);

  const stopRaf = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const applyTransform = useCallback(() => {
    const node = stripRef.current;
    const segmentWidth = segmentWidthRef.current;
    if (!node || segmentWidth <= 0) return;

    const displayX = normalizeTranslateX(virtualXRef.current, segmentWidth);
    node.style.transform = `translate3d(${displayX}px, 0, 0)`;
  }, []);

  const startIdle = useCallback(() => {
    if (spinning || segmentWidthRef.current <= 0) return;

    modeRef.current = "idle";
    stopRaf();

    let last = performance.now();

    const tick = (now: number) => {
      if (modeRef.current !== "idle") return;
      const dt = now - last;
      last = now;

      virtualXRef.current -= IDLE_SPEED_PX_PER_MS * dt;
      applyTransform();

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [applyTransform, spinning, stopRaf]);

  const startInertia = useCallback(() => {
    modeRef.current = "inertia";
    stopRaf();

    let velocity = velocityRef.current * 16;
    let last = performance.now();

    const tick = (now: number) => {
      if (modeRef.current !== "inertia") return;
      const dtScale = (now - last) / 16.67;
      last = now;

      virtualXRef.current += velocity * dtScale;
      applyTransform();

      velocity *= 0.94;
      if (Math.abs(velocity) < 0.1) {
        velocityRef.current = 0;
        modeRef.current = "none";
        startIdle();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [applyTransform, startIdle, stopRaf]);

  const startSpin = useCallback(
    (targetVirtualX: number, durationMs: number) => {
      modeRef.current = "spin";
      stopRaf();

      const phase1 = 500;
      const phase2 = 2000;
      const phase3 = Math.max(1000, durationMs - (phase1 + phase2));

      const startX = virtualXRef.current;
      const totalDistance = targetVirtualX - startX;
      const direction = totalDistance >= 0 ? 1 : -1;
      const absDistance = Math.abs(totalDistance);

      const t1 = phase1 / 1000;
      const t2 = phase2 / 1000;
      const t3 = phase3 / 1000;
      const vmax = absDistance / (0.5 * t1 + t2 + 0.5 * t3);

      let last = performance.now();
      let elapsed = 0;

      const tick = (now: number) => {
        if (modeRef.current !== "spin") return;

        const dtMs = now - last;
        last = now;
        elapsed += dtMs;

        let speed = 0;
        if (elapsed <= phase1) {
          speed = vmax * (elapsed / phase1);
        } else if (elapsed <= phase1 + phase2) {
          speed = vmax;
        } else {
          const p = (elapsed - phase1 - phase2) / phase3;
          speed = vmax * (1 - clamp(p, 0, 1));
        }

        virtualXRef.current += direction * speed * (dtMs / 1000);

        const reachedTarget =
          (direction < 0 && virtualXRef.current <= targetVirtualX) ||
          (direction > 0 && virtualXRef.current >= targetVirtualX) ||
          elapsed >= phase1 + phase2 + phase3;

        if (reachedTarget) {
          virtualXRef.current = targetVirtualX;
          applyTransform();
          modeRef.current = "none";
          onSpinComplete();
          return;
        }

        applyTransform();
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [applyTransform, onSpinComplete, stopRaf]
  );

  useEffect(() => {
    if (items.length === 0) {
      setBaseStrip([]);
      return;
    }

    const { strip, stopIndex } = buildBaseStrip(items, null);
    stopIndexRef.current = stopIndex;
    setBaseStrip(strip);
  }, [items]);

  useEffect(() => {
    if (baseStrip.length === 0) return;

    const segmentWidth = baseStrip.length * CELL;
    segmentWidthRef.current = segmentWidth;

    if (virtualXRef.current === 0) {
      virtualXRef.current = -segmentWidth;
    }

    // Safety: keep enough items in reel for seamless looping.
    if (baseStrip.length < MIN_REEL_ITEMS && items.length > 0) {
      const { strip, stopIndex } = buildBaseStrip(items, null);
      stopIndexRef.current = stopIndex;
      setBaseStrip(strip);
      return;
    }

    requestAnimationFrame(applyTransform);
  }, [applyTransform, baseStrip, items]);

  useEffect(() => {
    if (spinning || baseStrip.length === 0) return;
    if (modeRef.current === "drag" || modeRef.current === "spin" || modeRef.current === "inertia") return;

    startIdle();

    return () => {
      if (modeRef.current === "idle") {
        stopRaf();
        modeRef.current = "none";
      }
    };
  }, [baseStrip.length, spinning, startIdle, stopRaf]);

  useEffect(() => {
    if (!spinning || !winner || items.length === 0) return;

    stopRaf();
    modeRef.current = "spin";

    const { strip, stopIndex } = buildBaseStrip(items, winner);
    stopIndexRef.current = stopIndex;
    setBaseStrip(strip);

    requestAnimationFrame(() => {
      const segmentWidth = strip.length * CELL;
      if (segmentWidth <= 0) return;

      segmentWidthRef.current = segmentWidth;

      if (virtualXRef.current === 0) {
        virtualXRef.current = -segmentWidth;
      }

      const containerWidth = containerRef.current?.offsetWidth || 320;
      const centerOffset = containerWidth / 2 - ITEM_W / 2;

      const winnerGlobalIndex = strip.length + stopIndexRef.current;
      const rawDisplayX = -(winnerGlobalIndex * CELL - centerOffset);
      const normalizedTargetDisplayX = normalizeTranslateX(rawDisplayX, segmentWidth);

      const minTravel = segmentWidth * 2.2;
      const currentVirtualX = virtualXRef.current;
      const loopsNeeded = Math.ceil(
        (normalizedTargetDisplayX - (currentVirtualX - minTravel)) / segmentWidth
      );
      const targetVirtualX = normalizedTargetDisplayX - loopsNeeded * segmentWidth;

      const duration = clamp(animationDuration, 3500, 5000);
      startSpin(targetVirtualX, duration);
    });
  }, [animationDuration, items, spinning, startSpin, stopRaf, winner]);

  useEffect(() => {
    return () => stopRaf();
  }, [stopRaf]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (spinning || segmentWidthRef.current <= 0) return;

      modeRef.current = "drag";
      stopRaf();

      dragRef.current.active = true;
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastTime = performance.now();
      velocityRef.current = 0;

      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [spinning, stopRaf]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current.active || modeRef.current !== "drag") return;

      const now = performance.now();
      const deltaX = e.clientX - dragRef.current.lastX;
      const dt = Math.max(1, now - dragRef.current.lastTime);

      dragRef.current.lastX = e.clientX;
      dragRef.current.lastTime = now;

      // drag left -> scroll right, drag right -> scroll left
      virtualXRef.current += deltaX;
      velocityRef.current = deltaX / dt;

      applyTransform();
    },
    [applyTransform]
  );

  const endDrag = useCallback(() => {
    if (!dragRef.current.active) return;

    dragRef.current.active = false;

    if (Math.abs(velocityRef.current) > 0.01) {
      startInertia();
      return;
    }

    modeRef.current = "none";
    startIdle();
  }, [startIdle, startInertia]);

  if (items.length === 0) {
    return (
      <div className="h-28 flex items-center justify-center text-muted-foreground font-mono text-xs">
        لا توجد جوائز حالياً
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden touch-none"
      style={{ height: ITEM_H + 32 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
    >
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

      {/* Reel is always mounted and only moved via translate3d */}
      <div className="absolute inset-0 flex items-center pointer-events-none">
        <div
          ref={stripRef}
          className="flex"
          style={{
            gap: GAP,
            willChange: "transform",
            transform: "translate3d(0, 0, 0)",
          }}
        >
          {repeatedStrip.map((item, i) => {
            const color = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
            const glow = RARITY_GLOW[item.rarity] || RARITY_GLOW.common;

            return (
              <div
                key={`reel-item-${i}-${item.id}`}
                className="shrink-0 flex flex-col items-center justify-center rounded-lg border-2 p-1.5 bg-card/60 backdrop-blur-[1px]"
                style={{
                  width: ITEM_W,
                  height: ITEM_H,
                  borderColor: color,
                  boxShadow: glow,
                }}
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name_ar}
                    className="w-11 h-11 object-contain mb-1"
                    style={{ imageRendering: "pixelated" }}
                    loading="lazy"
                    draggable={false}
                  />
                ) : (
                  <div className="w-11 h-11 rounded bg-muted/30 flex items-center justify-center mb-1 text-lg">
                    🎁
                  </div>
                )}
                <span className="text-[9px] font-mono text-center leading-tight line-clamp-2" style={{ color }}>
                  {item.name_ar}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
