import { useEffect, useRef, useMemo, useCallback, type PointerEvent as RPointer } from "react";

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

/* ─── constants ─── */
const ITEM_W = 100;
const ITEM_H = 100;
const GAP = 16;
const CELL = ITEM_W + GAP;
const BASE_COUNT = 24;          // items per segment
const COPIES = 5;               // segments rendered
const IDLE_SPEED = 0.035;       // px/ms
const FRICTION = 0.93;
const WIN_SLOT = 10;            // index inside middle segment where winner lands

const RARITY_WEIGHTS: Record<string, number> = {
  common: 10, rare: 6, epic: 3, legendary: 2, mythic: 1,
};

const RARITY_COLORS: Record<string, string> = {
  common: "hsl(215 14% 60%)",
  rare: "hsl(217 91% 60%)",
  epic: "hsl(271 91% 65%)",
  legendary: "hsl(38 92% 50%)",
  mythic: "hsl(0 84% 60%)",
};

const RARITY_GLOW: Record<string, string> = {
  common: "0 0 6px hsl(215 14% 60%/0.25)",
  rare: "0 0 10px hsl(217 91% 60%/0.35)",
  epic: "0 0 14px hsl(271 91% 65%/0.38)",
  legendary: "0 0 18px hsl(38 92% 50%/0.42)",
  mythic: "0 0 22px hsl(0 84% 60%/0.45)",
};

/* ─── helpers ─── */
function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** Build a single segment of BASE_COUNT items from all visual items */
function buildSegment(items: ReelItem[]): ReelItem[] {
  if (items.length === 0) return [];
  const pool: ReelItem[] = [];
  items.forEach(it => {
    const w = RARITY_WEIGHTS[it.rarity] ?? 4;
    for (let k = 0; k < w; k++) pool.push(it);
  });
  const seg: ReelItem[] = [];
  while (seg.length < BASE_COUNT) {
    const shuffled = shuffle(pool);
    for (const it of shuffled) {
      seg.push(it);
      if (seg.length >= BASE_COUNT) break;
    }
  }
  return seg;
}

export default function ReelSpinner({ items, winnerIndex, spinning, onSpinComplete, animationDuration = 4000 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const vxRef = useRef(0);          // virtualX position
  const modeRef = useRef<"idle" | "drag" | "inertia" | "spin">("idle");
  const velRef = useRef(0);
  const dragRef = useRef({ active: false, lastX: 0, lastT: 0 });
  const segWidthRef = useRef(0);    // width of one segment in px
  const spinDoneRef = useRef(false);

  const winner = winnerIndex !== null && items[winnerIndex] ? items[winnerIndex] : null;

  /* ─── Build the full rendered strip (COPIES segments) ─── */
  const strip = useMemo(() => {
    if (items.length === 0) return [];
    const seg = buildSegment(items);
    const full: ReelItem[] = [];
    for (let c = 0; c < COPIES; c++) full.push(...seg);
    return full;
  }, [items]);

  /* ─── Segment width ─── */
  useEffect(() => {
    const sw = BASE_COUNT * CELL;
    segWidthRef.current = sw;
    // Start at middle segment
    if (vxRef.current === 0) {
      vxRef.current = -(sw * 2); // start at segment index 2 (middle of 5)
    }
  }, [strip]);

  /* ─── Apply transform + wrap ─── */
  const apply = useCallback(() => {
    const node = stripRef.current;
    const sw = segWidthRef.current;
    if (!node || sw <= 0) return;

    // Wrap: keep vx within segments 1-3 (out of 0-4) so we never see edges
    while (vxRef.current > -(sw * 1)) vxRef.current -= sw;
    while (vxRef.current < -(sw * 3)) vxRef.current += sw;

    node.style.transform = `translate3d(${vxRef.current}px, 0, 0)`;
  }, []);

  /* ─── Idle loop ─── */
  const startIdle = useCallback(() => {
    modeRef.current = "idle";
    cancelAnimationFrame(rafRef.current);
    let prev = performance.now();
    const tick = (now: number) => {
      if (modeRef.current !== "idle") return;
      const dt = now - prev;
      prev = now;
      vxRef.current -= IDLE_SPEED * dt; // scroll left
      apply();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [apply]);

  /* ─── Inertia after drag ─── */
  const startInertia = useCallback(() => {
    modeRef.current = "inertia";
    cancelAnimationFrame(rafRef.current);
    let v = velRef.current * 16;
    let prev = performance.now();
    const tick = (now: number) => {
      if (modeRef.current !== "inertia") return;
      const dtScale = (now - prev) / 16.67;
      prev = now;
      vxRef.current += v * dtScale;
      apply();
      v *= FRICTION;
      if (Math.abs(v) < 0.15) {
        startIdle();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [apply, startIdle]);

  /* ─── Start idle on mount (non-spinning) ─── */
  useEffect(() => {
    if (strip.length === 0 || spinning) return;
    if (modeRef.current === "spin") return;
    startIdle();
    return () => {
      if (modeRef.current === "idle") {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [strip.length, spinning, startIdle]);

  /* ─── SPIN ─── */
  useEffect(() => {
    if (!spinning || !winner || strip.length === 0) return;
    spinDoneRef.current = false;

    cancelAnimationFrame(rafRef.current);
    modeRef.current = "spin";

    // Insert winner at WIN_SLOT of segment index 2 (middle)
    const winGlobalIdx = 2 * BASE_COUNT + WIN_SLOT;
    if (winGlobalIdx < strip.length) {
      strip[winGlobalIdx] = winner;
    }

    // Force re-render the DOM item
    const node = stripRef.current;
    if (node) {
      const child = node.children[winGlobalIdx] as HTMLElement | undefined;
      if (child) {
        // Just ensure it's updated – React handles it via key, but we placed it directly
      }
    }

    const containerW = containerRef.current?.offsetWidth || 320;
    const centerOffset = containerW / 2 - ITEM_W / 2;
    const targetX = -(winGlobalIdx * CELL) + centerOffset;

    // We need to go left (negative direction) for a certain travel distance
    // Ensure we travel at least 2 full segments for visual effect
    const sw = segWidthRef.current;
    const currentX = vxRef.current;
    let travelTarget = targetX;

    // Make sure we travel far enough (at least 2 * sw in negative direction from current)
    while (travelTarget > currentX - sw * 2) {
      travelTarget -= sw;
    }

    // Animation phases
    const dur = Math.max(3500, Math.min(animationDuration, 5000));
    const p1 = 500;
    const p2 = dur * 0.45;
    const p3 = dur - p1 - p2;
    const totalDist = Math.abs(travelTarget - currentX);
    const t1 = p1 / 1000;
    const t2 = p2 / 1000;
    const t3 = p3 / 1000;
    const vmax = totalDist / (0.5 * t1 + t2 + 0.5 * t3);

    const startX = currentX;
    let elapsed = 0;
    let prev = performance.now();

    const tick = (now: number) => {
      if (modeRef.current !== "spin" || spinDoneRef.current) return;
      const dtMs = now - prev;
      prev = now;
      elapsed += dtMs;

      let speed: number;
      if (elapsed <= p1) {
        speed = vmax * (elapsed / p1);
      } else if (elapsed <= p1 + p2) {
        speed = vmax;
      } else {
        const p = Math.min(1, (elapsed - p1 - p2) / p3);
        // Ease-out cubic for smooth deceleration
        speed = vmax * (1 - p * p * p);
      }

      vxRef.current -= speed * (dtMs / 1000);

      // Check if reached target
      if (vxRef.current <= travelTarget || elapsed >= dur) {
        vxRef.current = targetX; // Snap to exact position (unwrapped)
        // Don't wrap here - we want exact alignment
        if (stripRef.current) {
          stripRef.current.style.transform = `translate3d(${targetX}px, 0, 0)`;
        }
        modeRef.current = "idle";
        spinDoneRef.current = true;
        onSpinComplete();
        return;
      }

      // During spin, don't wrap - let it travel the full distance
      if (stripRef.current) {
        stripRef.current.style.transform = `translate3d(${vxRef.current}px, 0, 0)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [spinning, winner]);

  /* ─── Reset vx after spin completes so idle wrap works again ─── */
  useEffect(() => {
    if (!spinning && spinDoneRef.current) {
      // Normalize vx back into wrappable range
      const sw = segWidthRef.current;
      if (sw > 0) {
        while (vxRef.current > -(sw * 1)) vxRef.current -= sw;
        while (vxRef.current < -(sw * 3)) vxRef.current += sw;
      }
      spinDoneRef.current = false;
    }
  }, [spinning]);

  /* ─── Cleanup ─── */
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  /* ─── Drag handlers ─── */
  const onDown = useCallback((e: RPointer<HTMLDivElement>) => {
    if (spinning) return;
    modeRef.current = "drag";
    cancelAnimationFrame(rafRef.current);
    dragRef.current = { active: true, lastX: e.clientX, lastT: performance.now() };
    velRef.current = 0;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [spinning]);

  const onMove = useCallback((e: RPointer<HTMLDivElement>) => {
    if (!dragRef.current.active || modeRef.current !== "drag") return;
    const now = performance.now();
    const dx = e.clientX - dragRef.current.lastX;
    const dt = Math.max(1, now - dragRef.current.lastT);
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastT = now;
    vxRef.current += dx;
    velRef.current = dx / dt;
    apply();
  }, [apply]);

  const onUp = useCallback(() => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    if (Math.abs(velRef.current) > 0.01) {
      startInertia();
    } else {
      startIdle();
    }
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
      className="relative w-full overflow-hidden touch-none select-none"
      style={{ height: ITEM_H + 32 }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {/* Pointer */}
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

      {/* Strip – always mounted, only moved via translate3d */}
      <div className="absolute inset-0 flex items-center pointer-events-none">
        <div
          ref={stripRef}
          className="flex"
          style={{ gap: GAP, willChange: "transform", transform: "translate3d(0,0,0)" }}
        >
          {strip.map((item, i) => {
            const color = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
            const glow = RARITY_GLOW[item.rarity] || RARITY_GLOW.common;
            return (
              <div
                key={`r-${i}`}
                className="shrink-0 flex flex-col items-center justify-center rounded-lg border-2 p-1.5 bg-card/60 backdrop-blur-[1px]"
                style={{ width: ITEM_W, height: ITEM_H, borderColor: color, boxShadow: glow }}
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
