import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Client-side "reveal in chunks" for long lists. First paint renders only
 * `initial` items so the browser can hand back to the user quickly; an
 * IntersectionObserver on a sentinel bumps the visible count by `step` as
 * the user scrolls near the end.
 *
 * Pair with `.cv-auto` on the rendered children for even cheaper scrolling.
 *
 * Usage:
 *   const { visible, sentinelRef } = useInfiniteReveal(items.length, 24, 24);
 *   items.slice(0, visible).map(...)
 *   <div ref={sentinelRef} />
 */
export function useInfiniteReveal(total: number, initial = 24, step = 24) {
  const [visible, setVisible] = useState(() => Math.min(initial, total));
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Reset when the source list shrinks (e.g. new search query).
  useEffect(() => {
    setVisible(Math.min(initial, total));
  }, [total, initial]);

  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      sentinelRef.current = node;
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (!node) return;
      if (visible >= total) return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setVisible((v) => Math.min(v + step, total));
          }
        },
        { rootMargin: "600px 0px" },
      );
      observerRef.current.observe(node);
    },
    [visible, total, step],
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return { visible, sentinelRef: attach, hasMore: visible < total };
}
