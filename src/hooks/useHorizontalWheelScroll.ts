import { useEffect, useRef } from 'react';

/**
 * Forwards vertical wheel deltas on a horizontally-scrollable container
 * to the page (window) so the user can scroll the page even when the
 * cursor is over a wide table. Horizontal deltas (or shift+wheel) keep
 * scrolling the container itself.
 */
export function useHorizontalWheelScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);

      // Shift+wheel or trackpad horizontal gesture → scroll table horizontally
      if (e.shiftKey || absX > absY) {
        const delta = e.shiftKey && absX === 0 ? e.deltaY : e.deltaX || e.deltaY;
        const max = el.scrollWidth - el.clientWidth;
        const next = el.scrollLeft + delta;
        if ((delta < 0 && el.scrollLeft > 0) || (delta > 0 && el.scrollLeft < max)) {
          e.preventDefault();
          el.scrollLeft = Math.max(0, Math.min(max, next));
        }
        return;
      }

      // Vertical wheel → let the page scroll instead of being captured
      e.preventDefault();
      window.scrollBy({ top: e.deltaY, behavior: 'auto' });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return ref;
}
