import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from "react";

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

const SEGMENT_SIZE = 96; // 80-120 target
const SEGMENT_COPIES = 5;
const IDLE_SPEED_PX_MS = 0.03;
const INERTIA_FRICTION = 0.94;

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildBaseStrip(items: ReelItem[], winner: ReelItem | null): { strip: ReelItem[]; stopIndex: number } {
  if (items.length === 0) return { strip: [], stopIndex: 0 };

  // Include all active rewards visually (including 0% drop chance)
  const guaranteed = shuffle(items);
  const weighted: ReelItem[] = [];

  items.forEach((item) => {
    const weight = RARITY_WEIGHTS[item.rarity] ?? 4;
    for (let i = 0; i < weight; i++) weighted.push(item);
  });

  const pool = shuffle([...guaranteed, ...weighted]);
  const strip: ReelItem[] = [];

  while (strip.length < SEGMENT_SIZE) {
    for (const item of pool) {
      strip.push(item);
      if (strip.length >= SEGMENT_SIZE) break;
    }
  }

  // Visual bait: keep higher rarity visible more frequently in strip
  const bait = items.filter((it) => ["rare", "epic", "legendary", "mythic"].includes(it.rarity));
  if (bait.length > 0) {
    for (let i = 7; i < strip.length; ) {
      strip[i] = bait[Math.floor(Math.random() * bait.length)];
      i += 7 + Math.floor(Math.random() * 5);
    }
  }

  const stopIndex = Math.max(10, strip.length - 14);
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

  const rawXRef = useRef(0);
  const velocityRef = useRef(0);
  const segmentWidthRef = useRef(0);
  const stopIndexRef = useRef(0);
  const initializedRef = useRef(false);

  const modeRef = useRef<"none" | "idle" | "drag" | "inertia" | "spin">("none");
  const dragRef = useRef({ active: false, lastX: 0, lastTime: 0 });

  const [baseStrip, setBaseStrip] = useState<ReelItem[]>([]);

  const winner = winnerIndex !== null && items[winnerIndex] ? items[winnerIndex] : null;

  const renderStrip = useMemo(() => {
    if (baseStrip.length === 0) return [] as ReelItem[];
    const repeated: ReelItem[] = [];
    for (let i = 0; i < SEGMENT_COPIES; i++) repeated.push(...baseStrip);
    return repeated;
  }, [baseStrip]);

  const stopRaf = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const normalizeDisplayX = useCallback((rawX: number) => {
    const sw = segmentWidthRef.current;
    if (sw <= 0) return rawX;

    // Keep display in the center window (segments 2-3) so edges are never visible.
    const min = -(sw * 3);
    const max = -(sw * 2);

    let x = rawX;
    while (x < min) x += sw;
    while (x >= max) x -= sw;

    return x;
  }, []);

  const applyTransform = useCallback(() => {
    const node = stripRef.current;
    if (!node) return;

    const displayX = normalizeDisplayX(rawXRef.current);
    node.style.transform = `translate3d(${displayX}px, 0, 0)`;
  }, [normalizeDisplayX]);

  const startIdle = useCallback(() => {
    if (spinning || segmentWidthRef.current <= 0 || baseStrip.length === 0) return;

    modeRef.current = "idle";
    stopRaf();

    let last = performance.now();

    const tick = (now: number) => {
      if (modeRef.current !== "idle") return;
      const dt = now - last;
      last = now;

      rawXRef.current -= IDLE_SPEED_PX_MS * dt;
      applyTransform();

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [applyTransform, baseStrip.length, spinning, stopRaf]);

  const startInertia = useCallback(() => {
    modeRef.current = "inertia";
    stopRaf();

    let velocity = velocityRef.current * 16;
    let last = performance.now();

    const tick = (now: number) => {
      if (modeRef.current !== "inertia") return;

      const dtScale = (now - last) / 16.67;
      last = now;

      rawXRef.current += velocity * dtScale;
      applyTransform();

      velocity *= INERTIA_FRICTION;
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
    (targetRawX: number, durationMs: number) => {
      modeRef.current = "spin";
      stopRaf();

      const phase1 = 500;
      const phase2 = 2000;
      const phase3 = Math.max(1000, durationMs - (phase1 + phase2));

      const startX = rawXRef.current;
      const totalDistance = Math.max(1, Math.abs(targetRawX - startX));

      const t1 = phase1 / 1000;
      const t2 = phase2 / 1000;
      const t3 = phase3 / 1000;
      const vmax = totalDistance / (0.5 * t1 + t2 + 0.5 * t3);

      let elapsed = 0;
      let last = performance.now();

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
          const p = clamp((elapsed - phase1 - phase2) / phase3, 0, 1);
          speed = vmax * (1 - p * p * p);
        }

        rawXRef.current -= speed * (dtMs / 1000);

        const reachedTarget = rawXRef.current <= targetRawX || elapsed >= phase1 + phase2 + phase3;
        if (reachedTarget) {
          rawXRef.current = targetRawX;
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

  // Build non-spin strip from visual items (includes 0% rewards)
  useEffect(() => {
    if (items.length === 0 || spinning) return;

    const { strip, stopIndex } = buildBaseStrip(items, null);
    stopIndexRef.current = stopIndex;
    setBaseStrip(strip);
  }, [items, spinning]);

  // Update sizing and initial centered position
  useEffect(() => {
    if (baseStrip.length === 0) return;

    const sw = baseStrip.length * CELL;
    segmentWidthRef.current = sw;

    if (!initializedRef.current) {
      rawXRef.current = -(sw * 2.4); // start around middle segment
      initializedRef.current = true;
    }

    requestAnimationFrame(applyTransform);
  }, [applyTransform, baseStrip]);

  // Idle animation when not spinning
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

  // Spin flow
  useEffect(() => {
    if (!spinning || !winner || items.length === 0) return;

    stopRaf();
    modeRef.current = "spin";

    const { strip, stopIndex } = buildBaseStrip(items, winner);
    stopIndexRef.current = stopIndex;
    setBaseStrip(strip);

    requestAnimationFrame(() => {
      const sw = strip.length * CELL;
      if (sw <= 0) return;

      segmentWidthRef.current = sw;
      if (!initializedRef.current) {
        rawXRef.current = -(sw * 2.4);
        initializedRef.current = true;
      }

      const containerWidth = containerRef.current?.offsetWidth || 320;
      const centerOffset = containerWidth / 2 - ITEM_W / 2;

      // Winner slot in center copy (copy index 2)
      const winnerGlobalIndex = strip.length * 2 + stopIndexRef.current;
      const targetDisplayX = -(winnerGlobalIndex * CELL - centerOffset);

      // Choose equivalent rawX that guarantees long travel
      const minTravel = sw * 2.2;
      let targetRawX = targetDisplayX;
      while (targetRawX > rawXRef.current - minTravel) {
        targetRawX -= sw;
      }

      const duration = clamp(animationDuration, 3500, 5000);
      startSpin(targetRawX, duration);
    });
  }, [animationDuration, items, spinning, startSpin, stopRaf, winner]);

  useEffect(() => {
    return () => stopRaf();
  }, [stopRaf]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
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
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragRef.current.active || modeRef.current !== "drag") return;

      const now = performance.now();
      const deltaX = e.clientX - dragRef.current.lastX;
      const dt = Math.max(1, now - dragRef.current.lastTime);

      dragRef.current.lastX = e.clientX;
      dragRef.current.lastTime = now;

      // drag left -> reel right, drag right -> reel left
      rawXRef.current += deltaX;
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
      dir="ltr"
      className="relative w-full overflow-hidden touch-none select-none"
      style={{ height: ITEM_H + 32 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* Center pointer */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-0.5 h-full bg-primary opacity-80" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 -mt-1">
        <div className="w-0 h-0 border-l-[7px] border-r-[7px] border-t-[9px] border-l-transparent border-r-transparent border-t-primary" />
      </div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 -mb-1">
        <div className="w-0 h-0 border-l-[7px] border-r-[7px] border-b-[9px] border-l-transparent border-r-transparent border-b-primary" />
      </div>

      {/* Edge fade */}
      <div className="absolute inset-y-0 left-0 w-16 z-10 bg-gradient-to-r from-background to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-16 z-10 bg-gradient-to-l from-background to-transparent pointer-events-none" />

      {/* Reel (always mounted) */}
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
          {renderStrip.map((item, i) => {
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
                  <div className="w-11 h-11 rounded bg-muted/30 flex items-center justify-center mb-1 text-lg">🎁</div>
                )}
                <span className="text-[9px] font-mono text-center leading-tight line-clamp-2" style={{ color }} dir="rtl">
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
