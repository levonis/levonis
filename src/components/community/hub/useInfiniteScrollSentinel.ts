import { RefObject, useEffect } from "react";

type Params = {
  enabled: boolean;
  sentinelRef: RefObject<HTMLElement>;
  onIntersect: () => void;
  rootMargin?: string;
};

/**
 * Lightweight infinite scroll trigger using IntersectionObserver.
 * Designed to be mobile-friendly (passive, small work on intersect).
 */
export function useInfiniteScrollSentinel({
  enabled,
  sentinelRef,
  onIntersect,
  rootMargin = "600px",
}: Params) {
  useEffect(() => {
    const el = sentinelRef.current;
    if (!enabled || !el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onIntersect();
      },
      { root: null, rootMargin, threshold: 0 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [enabled, sentinelRef, onIntersect, rootMargin]);
}
