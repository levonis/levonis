import { useEffect } from "react";
import { warmRouteFor } from "@/lib/routePrefetch";

/**
 * Global prefetch-on-hover/focus for internal links.
 *
 * Two-layer warm-up:
 *  1. HTML document prefetch via <link rel="prefetch"> — helps SW/HTTP cache.
 *  2. Route JS-chunk warm-up by invoking the same dynamic import() factory
 *     React.lazy uses in App.tsx. Vite/browser dedupe the module fetch, so
 *     when the user actually navigates the chunk is already parsed and the
 *     Suspense fallback usually never flashes.
 *
 * Best-effort — silently ignored on failure.
 */
const prefetched = new Set<string>();

function prefetchDoc(href: string) {
  if (prefetched.has(href)) return;
  prefetched.add(href);
  try {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "document";
    link.href = href;
    document.head.appendChild(link);
  } catch {}
}

export default function PrefetchOnHover() {
  useEffect(() => {
    const handler = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const a = target.closest?.("a") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/")) return;
      if (a.target === "_blank") return;
      // Extract pathname without query/hash for route matching.
      const pathname = href.split("#")[0].split("?")[0];
      prefetchDoc(href);
      warmRouteFor(pathname);
    };
    document.addEventListener("mouseover", handler, { passive: true });
    document.addEventListener("focusin", handler, { passive: true });
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mouseover", handler);
      document.removeEventListener("focusin", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  return null;
}
