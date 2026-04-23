import { useEffect, useRef } from 'react';

/**
 * Enables horizontal drag-to-scroll on a container while keeping
 * native vertical page scroll fully responsive on touch devices.
 *
 * Strategy:
 * - touch-action: pan-y on the container (browser handles vertical pan,
 *   bubbling to the page since the container has no vertical overflow).
 * - Horizontal scrolling is implemented manually using pointer events:
 *   we only start dragging once the user moves more horizontally than
 *   vertically beyond a small threshold. This way a clearly vertical
 *   swipe is never hijacked.
 */
export function useHorizontalDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let dragging = false;
    let decided = false;

    const THRESHOLD = 10;
    const HORIZONTAL_INTENT_RATIO = 1.6;

    const onPointerDown = (e: PointerEvent) => {
      // Only react to the primary touch / mouse button
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = el.scrollLeft;
      dragging = false;
      decided = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!decided) {
        if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
        // Be intentionally biased toward vertical scrolling so a slightly
        // diagonal downward swipe still scrolls the page instead of being
        // interpreted as a horizontal drag.
        if (Math.abs(dx) > Math.abs(dy) * HORIZONTAL_INTENT_RATIO) {
          dragging = true;
          try {
            el.setPointerCapture(e.pointerId);
          } catch {}
        } else {
          // Vertical intent – bail out completely so the page scrolls.
          pointerId = null;
        }
        decided = true;
      }

      if (dragging) {
        e.preventDefault();
        el.scrollLeft = startScrollLeft - dx;
      }
    };

    const onPointerEnd = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {}
      pointerId = null;
      // Suppress the click that follows a real drag.
      if (dragging) {
        const suppress = (ev: Event) => {
          ev.preventDefault();
          ev.stopPropagation();
        };
        el.addEventListener('click', suppress, { capture: true, once: true });
      }
      dragging = false;
      decided = false;
    };

    el.addEventListener('pointerdown', onPointerDown, { passive: true });
    el.addEventListener('pointermove', onPointerMove, { passive: false });
    el.addEventListener('pointerup', onPointerEnd, { passive: true });
    el.addEventListener('pointercancel', onPointerEnd, { passive: true });

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerEnd);
      el.removeEventListener('pointercancel', onPointerEnd);
    };
  }, []);

  return ref;
}
