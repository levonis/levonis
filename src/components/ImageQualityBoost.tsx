import { useEffect } from "react";

/**
 * Two safe, global image enhancements:
 *
 * 1. **Auto-lazy + async-decode** — any `<img>` without explicit `loading` /
 *    `decoding` attributes gets `loading="lazy"` and `decoding="async"`,
 *    so off-screen images stop competing with the LCP / first paint.
 *    Images already marked `loading="eager"` or `fetchpriority="high"` are
 *    left untouched (so hero / above-the-fold images keep their priority).
 *
 * 2. **One-shot retry on error** — on flaky mobile networks (3G/4G in IQ),
 *    a single image request often fails. We retry once with a cache-busting
 *    query param ~1.4 s later. Avoids the "broken-image" placeholder that
 *    feels broken to users.
 *
 * Pure DOM, no React state, no re-renders.
 */
export default function ImageQualityBoost() {
  useEffect(() => {
    const RETRY_FLAG = "__levoImgRetried";

    const enhance = (img: HTMLImageElement) => {
      if (!img.hasAttribute("loading") && img.getAttribute("fetchpriority") !== "high") {
        img.setAttribute("loading", "lazy");
      }
      if (!img.hasAttribute("decoding")) {
        img.setAttribute("decoding", "async");
      }
      if (!(img as any)[RETRY_FLAG + "Bound"]) {
        (img as any)[RETRY_FLAG + "Bound"] = true;
        img.addEventListener(
          "error",
          () => {
            if ((img as any)[RETRY_FLAG]) return;
            const src = img.currentSrc || img.src;
            if (!src || src.startsWith("data:")) return;
            (img as any)[RETRY_FLAG] = true;
            window.setTimeout(() => {
              try {
                const u = new URL(src, window.location.href);
                u.searchParams.set("_r", String(Date.now()));
                img.src = u.toString();
              } catch {
                // Fallback: append query the simple way
                img.src = src + (src.includes("?") ? "&" : "?") + "_r=" + Date.now();
              }
            }, 1400);
          },
          { passive: true },
        );
      }
    };

    // Initial pass
    document.querySelectorAll<HTMLImageElement>("img").forEach(enhance);

    // Watch for new images added later — only inside #root to skip noise
    // (toast portals, devtools, etc.). Auto-disconnect after 30s; by then the
    // app shell is hydrated and `loading="lazy"` is set on most images anyway.
    const target = document.getElementById("root") || document.body;
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          const el = node as Element;
          if (el.tagName === "IMG") enhance(el as HTMLImageElement);
          el.querySelectorAll?.<HTMLImageElement>("img").forEach(enhance);
        });
      }
    });
    obs.observe(target, { childList: true, subtree: true });
    const disconnectTimer = window.setTimeout(() => obs.disconnect(), 30_000);

    return () => {
      window.clearTimeout(disconnectTimer);
      obs.disconnect();
    };
  }, []);

  return null;
}
