import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const positions = new Map<string, number>();

export default function ScrollRestoration() {
  const location = useLocation();
  const navType = useNavigationType();
  const prevKeyRef = useRef<string>(location.key);

  // Disable browser's native scroll restoration so we control it
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      const prev = window.history.scrollRestoration;
      window.history.scrollRestoration = "manual";
      return () => {
        window.history.scrollRestoration = prev;
      };
    }
  }, []);

  // Continuously save the current scroll position for the active location key.
  // This ensures we always have the latest position when the user navigates away
  // (covers async content growth, lazy images, etc.).
  useEffect(() => {
    let raf = 0;
    const save = () => {
      positions.set(location.key, window.scrollY);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(save);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      // Save final position on unmount/navigation
      positions.set(location.key, window.scrollY);
    };
  }, [location.key]);

  // Save scroll position of the leaving location, then apply scroll for the new one
  useLayoutEffect(() => {
    const prevKey = prevKeyRef.current;
    if (prevKey && prevKey !== location.key) {
      positions.set(prevKey, window.scrollY);
    }

    if (navType === "POP") {
      const target = positions.get(location.key) ?? 0;

      // The destination page may render its content asynchronously
      // (lazy components, data fetching, image loads, infinite lists).
      // Re-apply the scroll position across multiple frames until either
      // we reach it or we time out, so the user lands exactly where they were.
      let cancelled = false;
      const start = performance.now();
      const TIMEOUT_MS = 1500;

      const apply = () => {
        if (cancelled) return;
        const maxScroll = Math.max(
          0,
          (document.documentElement.scrollHeight || 0) - window.innerHeight,
        );
        const desired = Math.min(target, maxScroll);
        if (Math.abs(window.scrollY - desired) > 1) {
          window.scrollTo(0, desired);
        }
        // Stop once we've reached the desired position AND the page is tall
        // enough to actually contain it, or after the timeout.
        const reached =
          Math.abs(window.scrollY - target) <= 2 && maxScroll >= target;
        if (!reached && performance.now() - start < TIMEOUT_MS) {
          requestAnimationFrame(apply);
        }
      };

      apply();

      // Also retry once on full window load (catches late images/fonts).
      const onLoad = () => apply();
      window.addEventListener("load", onLoad, { once: true });

      prevKeyRef.current = location.key;
      return () => {
        cancelled = true;
        window.removeEventListener("load", onLoad);
      };
    }

    // Fresh navigation (PUSH/REPLACE): start at top
    window.scrollTo(0, 0);
    prevKeyRef.current = location.key;
  }, [location.key, navType]);

  // Save on tab hide / page hide. We intentionally avoid `beforeunload`
  // because it disables Chrome's BFCache and causes a full reload
  // (initial loading screen) when the user switches apps and returns.
  useEffect(() => {
    const save = () => {
      positions.set(location.key, window.scrollY);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") save();
    };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [location.key]);

  return null;
}
