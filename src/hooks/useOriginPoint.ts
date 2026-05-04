import { useCallback, useRef, useState } from "react";

/**
 * Captures the click point so a portaled overlay (Dialog/Popover)
 * can animate-expand from that exact point.
 *
 * Usage:
 *   const { capture, originRef, originPoint } = useOriginPoint();
 *   <button onClick={(e) => { capture(e); setOpen(true); }} />
 *   <DialogContent ref={originRef}>...</DialogContent>
 *
 * The origin point is preserved across multiple reopens until a new
 * `capture` call replaces it.
 */
export function useOriginPoint() {
  const [originPoint, setOriginPoint] = useState<{ x: number; y: number } | null>(null);
  const pointRef = useRef<{ x: number; y: number } | null>(null);

  const capture = useCallback(
    (e: { clientX: number; clientY: number } | null | undefined) => {
      if (!e) return;
      const p = { x: e.clientX, y: e.clientY };
      pointRef.current = p;
      setOriginPoint(p);
    },
    []
  );

  // Ref callback: applied each time the DialogContent mounts (every reopen).
  const originRef = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    const p = pointRef.current;
    if (!p) return;
    // Defer one frame so Radix has positioned the element.
    requestAnimationFrame(() => {
      const r = node.getBoundingClientRect();
      const ox = Math.max(0, Math.min(r.width, p.x - r.left));
      const oy = Math.max(0, Math.min(r.height, p.y - r.top));
      node.style.transformOrigin = `${ox}px ${oy}px`;
    });
  }, []);

  return { capture, originRef, originPoint };
}
