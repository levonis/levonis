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

const SEGMENT_SIZE = 80;
const COPIES = 7;
const IDLE_SPEED = 0.03; // px per ms
const FRICTION = 0.93;

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

function buildSegment(items: ReelItem[]): ReelItem[] {
  if (items.length === 0) return [];
  const guaranteed = shuffle(items);
  const weighted: ReelItem[] = [];
  items.forEach((item) => {
    const w = RARITY_WEIGHTS[item.rarity] ?? 3;
    for (let i = 0; i < w; i++) weighted.push(item);
  });
  const pool = shuffle([...guaranteed, ...weighted]);
  const seg: ReelItem[] = [];
  while (seg.length < SEGMENT_SIZE) {
    for (const it of pool) {
      seg.push(it);
      if (seg.length >= SEGMENT_SIZE) break;
    }
  }
  // Sprinkle rares as visual bait
  const bait = items.filter((it) => ["rare", "epic", "legendary", "mythic"].includes(it.rarity));
  if (bait.length > 0) {
    for (let i = 6; i < seg.length; ) {
      seg[i] = bait[Math.floor(Math.random() * bait.length)];
      i += 6 + Math.floor(Math.random() * 5);
    }
  }
  return seg;
}

export default function ReelSpinner({
  items,
  winnerIndex,
  spinning,
  onSpinComplete,
  animationDuration = 4500,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const offsetRef = useRef(0); // current pixel offset (always negative, moves left)
  const modeRef = useRef<"idle" | "drag" | "inertia" | "spin">("idle");
  const dragState = useRef({ active: false, lastX: 0, lastT: 0, vel: 0 });
  const segWidthRef = useRef(0);
  const initRef = useRef(false);
  const spinningRef = useRef(false);
  const spinStartedRef = useRef(false);

  const [segment, setSegment] = useState<ReelItem[]>([]);

  // Build segment once from items (not during spin)
  useEffect(() => {
    if (items.length === 0) return;
    if (spinningRef.current) return; // don't rebuild during spin
    setSegment(buildSegment(items));
  }, [items]);

  // Full rendered strip = segment × COPIES
  const strip = useMemo(() => {
    if (segment.length === 0) return [] as ReelItem[];
    const arr: ReelItem[] = [];
    for (let c = 0; c < COPIES; c++) arr.push(...segment);
    return arr;
  }, [segment]);

  const segW = segment.length * CELL;

  // Keep segWidthRef in sync
  useEffect(() => {
    segWidthRef.current = segW;
    if (!initRef.current && segW > 0) {
      // Start in the middle
      offsetRef.current = -(segW * 3);
      initRef.current = true;
    }
  }, [segW]);

  const stopRaf = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
  }, []);

  // Wrap offset so we stay in the middle copies (never see edges)
  const wrap = useCallback(() => {
    const sw = segWidthRef.current;
    if (sw <= 0) return;
    // keep offset between -(sw*5) and -(sw*1) — plenty of room
    while (offsetRef.current > -(sw * 1)) offsetRef.current -= sw;
    while (offsetRef.current < -(sw * 5)) offsetRef.current += sw;
  }, []);

  const applyPos = useCallback(() => {
    const node = stripRef.current;
    if (!node) return;
    node.style.transform = `translate3d(${offsetRef.current}px,0,0)`;
  }, []);

  // === IDLE ===
  const startIdle = useCallback(() => {
    if (segWidthRef.current <= 0) return;
    modeRef.current = "idle";
    stopRaf();
    let prev = performance.now();
    const tick = (now: number) => {
      if (modeRef.current !== "idle") return;
      const dt = now - prev; prev = now;
      offsetRef.current -= IDLE_SPEED * dt;
      wrap();
      applyPos();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [applyPos, stopRaf, wrap]);

  // === INERTIA ===
  const startInertia = useCallback(() => {
    modeRef.current = "inertia";
    stopRaf();
    let vel = dragState.current.vel * 16;
    let prev = performance.now();
    const tick = (now: number) => {
      if (modeRef.current !== "inertia") return;
      const s = (now - prev) / 16.67; prev = now;
      offsetRef.current += vel * s;
      vel *= FRICTION;
      wrap();
      applyPos();
      if (Math.abs(vel) < 0.15) { startIdle(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [applyPos, startIdle, stopRaf, wrap]);

  // === SPIN (the key fix: smooth deceleration to target) ===
  const runSpin = useCallback((targetX: number, durMs: number) => {
    modeRef.current = "spin";
    stopRaf();

    const startX = offsetRef.current;
    const totalDist = startX - targetX; // positive number (moving left)
    if (totalDist <= 0) { onSpinComplete(); return; }

    const startTime = performance.now();

    // Easing: start fast, gradually slow down, stop exactly on target
    // Using cubic ease-out: progress = 1 - (1-t)^3
    const tick = (now: number) => {
      if (modeRef.current !== "spin") return;

      const elapsed = now - startTime;
      const t = Math.min(elapsed / durMs, 1);

      // Ease-out cubic: fast start, slow end
      const eased = 1 - Math.pow(1 - t, 3);
      offsetRef.current = startX - totalDist * eased;

      applyPos();

      if (t >= 1) {
        offsetRef.current = targetX;
        applyPos();
        modeRef.current = "idle";
        spinningRef.current = false;
        onSpinComplete();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [applyPos, onSpinComplete, stopRaf]);

  // Start idle on mount / segment change (when not spinning)
  useEffect(() => {
    if (segment.length === 0 || spinningRef.current) return;
    startIdle();
    return () => { if (modeRef.current === "idle") { stopRaf(); } };
  }, [segment, startIdle, stopRaf]);

  // === SPIN TRIGGER ===
  useEffect(() => {
    if (!spinning) {
      spinStartedRef.current = false;
      return;
    }

    if (spinStartedRef.current) return;
    if (items.length === 0 || winnerIndex === null || segment.length === 0) return;

    const winner = items[winnerIndex];
    if (!winner) return;

    spinStartedRef.current = true;
    spinningRef.current = true;
    stopRaf();
    modeRef.current = "spin";

    let winSlot = segment.findIndex((it) => it.id === winner.id);
    if (winSlot < 0) winSlot = Math.floor(segment.length * 0.75);

    requestAnimationFrame(() => {
      const sw = segment.length * CELL;
      segWidthRef.current = sw;
      const containerW = containerRef.current?.offsetWidth || 320;
      const centerOff = containerW / 2 - ITEM_W / 2;

      // Target: copy index 4, at winSlot
      const globalIdx = segment.length * 4 + winSlot;
      const targetDisplayX = -(globalIdx * CELL) + centerOff;

      // Ensure we travel at least 2 full segments worth
      const minTravel = sw * 2.5;
      let targetX = targetDisplayX;
      while (targetX > offsetRef.current - minTravel) {
        targetX -= sw;
      }

      const dur = Math.max(3500, Math.min(animationDuration, 5500));
      runSpin(targetX, dur);
    });
  }, [spinning, winnerIndex, items, animationDuration, segment, stopRaf, runSpin]);

  // Cleanup
  useEffect(() => () => stopRaf(), [stopRaf]);

  // === DRAG HANDLERS ===
  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (spinningRef.current || segWidthRef.current <= 0) return;
    modeRef.current = "drag";
    stopRaf();
    dragState.current = { active: true, lastX: e.clientX, lastT: performance.now(), vel: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [stopRaf]);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragState.current;
    if (!d.active || modeRef.current !== "drag") return;
    const now = performance.now();
    const dx = e.clientX - d.lastX;
    const dt = Math.max(1, now - d.lastT);
    d.lastX = e.clientX;
    d.lastT = now;
    d.vel = dx / dt;
    offsetRef.current += dx;
    wrap();
    applyPos();
  }, [applyPos, wrap]);

  const onPointerUp = useCallback(() => {
    if (!dragState.current.active) return;
    dragState.current.active = false;
    if (Math.abs(dragState.current.vel) > 0.01) { startInertia(); return; }
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
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
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

      {/* Strip */}
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
                key={`r-${i}-${item.id}`}
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
