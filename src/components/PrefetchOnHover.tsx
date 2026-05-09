import { useEffect } from "react";

/**
 * Global prefetch-on-hover/focus for internal links. Adds a one-shot
 * <link rel="prefetch"> for the destination HTML so the next navigation
 * feels instant. Cheap, safe, and best-effort (silently ignored on failure).
 */
const prefetched = new Set<string>();

function prefetch(href: string) {
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
      prefetch(href);
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
