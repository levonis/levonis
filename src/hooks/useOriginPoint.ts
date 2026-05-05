import { useCallback, useRef, useState } from "react";

type PointerLikeEvent = {
  clientX?: number;
  clientY?: number;
  // React events expose currentTarget; we fall back to its center
  // when there are no real coordinates (keyboard activation, programmatic).
  currentTarget?: EventTarget | null;
  // Touch events: use the first touch / changedTouches as the origin.
  touches?: ArrayLike<{ clientX: number; clientY: number }>;
  changedTouches?: ArrayLike<{ clientX: number; clientY: number }>;
  // Pointer/Mouse events expose pointerType; touch needs the same path.
  pointerType?: string;
} | null | undefined;

function extractPoint(e: PointerLikeEvent): { x: number; y: number } | null {
  if (!e) return null;

  // 1) Touch events — use the first available touch coordinates.
  const touch =
    (e.touches && e.touches.length > 0 && e.touches[0]) ||
    (e.changedTouches && e.changedTouches.length > 0 && e.changedTouches[0]) ||
    null;
  if (touch && (touch.clientX || touch.clientY)) {
    return { x: touch.clientX, y: touch.clientY };
  }

  // 2) Mouse / Pointer events with real coordinates.
  const cx = typeof e.clientX === "number" ? e.clientX : 0;
  const cy = typeof e.clientY === "number" ? e.clientY : 0;
  if (cx !== 0 || cy !== 0) {
    return { x: cx, y: cy };
  }

  // 3) Fallback: keyboard activation (Enter/Space) — use the trigger's center.
  const target = e.currentTarget as Element | null;
  if (target && typeof (target as any).getBoundingClientRect === "function") {
    const r = (target as Element).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  return null;
}

/**
 * Captures the activation point (mouse, touch, or keyboard) so a portaled
 * overlay (Dialog/Popover) can animate-expand from that exact point.
 *
 * - Touch: reads from `touches[0]` / `changedTouches[0]`.
 * - Mouse / Pen: reads `clientX/Y`.
 * - Keyboard: falls back to the trigger element's center.
 *
 * Coordinates are CSS pixels, so devicePixelRatio is naturally handled
 * (getBoundingClientRect inside the ref callback is also CSS pixels).
 *
 * The origin point persists across reopens until `capture` runs again.
 */
export function useOriginPoint() {
  const [originPoint, setOriginPoint] = useState<{ x: number; y: number } | null>(null);
  const pointRef = useRef<{ x: number; y: number } | null>(null);

  const capture = useCallback((e: PointerLikeEvent) => {
    const p = extractPoint(e);
    if (!p) return;
    pointRef.current = p;
    setOriginPoint(p);
  }, []);

  // Applied each time the overlay content mounts (every reopen).
  const originRef = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    const p = pointRef.current;
    if (!p) return;
    const r = node.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return; // wait until laid out
    // Use the real click point (allow values outside the box so the
    // overlay genuinely scales out of the trigger, even if the trigger
    // is far from the centered dialog).
    const ox = p.x - r.left;
    const oy = p.y - r.top;
    node.style.transformOrigin = `${ox.toFixed(1)}px ${oy.toFixed(1)}px`;
    node.style.willChange = "transform, opacity";
  }, []);

  return { capture, originRef, originPoint };
}
