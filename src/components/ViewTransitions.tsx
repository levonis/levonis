import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Enables the View Transitions API for in-app navigations on browsers that
 * support it. Intercepts clicks on internal <a> links and wraps the resulting
 * router navigation in `document.startViewTransition`, which gives a smooth
 * native cross-fade/slide between pages — the kind you get in iOS / Android.
 *
 * - Skips external links, downloads, modifier-clicks, target="_blank"
 * - Skips when the URL doesn't actually change
 * - No-op on browsers without startViewTransition (Firefox today) — they
 *   keep using the existing PageFade CSS animation.
 * - Respects `prefers-reduced-motion` (animations are disabled in CSS).
 */
export default function ViewTransitions() {
  const navigate = useNavigate();

  useEffect(() => {
    const doc = document as Document & {
      startViewTransition?: (cb: () => void | Promise<void>) => unknown;
    };
    if (typeof doc.startViewTransition !== "function") return;

    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const target = e.target as Element | null;
      const a = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      if (
        a.target === "_blank" ||
        a.hasAttribute("download") ||
        a.getAttribute("rel")?.includes("external")
      ) {
        return;
      }
      const raw = a.getAttribute("href");
      if (!raw) return;
      if (
        raw.startsWith("mailto:") ||
        raw.startsWith("tel:") ||
        raw.startsWith("#") ||
        raw.startsWith("javascript:")
      ) {
        return;
      }

      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search &&
        url.hash === window.location.hash
      ) {
        return;
      }

      e.preventDefault();
      const path = `${url.pathname}${url.search}${url.hash}`;
      try {
        doc.startViewTransition!(
          () =>
            new Promise<void>((resolve) => {
              navigate(path);
              // Wait two frames so React commits the new route before the
              // browser captures the "after" snapshot.
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              );
            }),
        );
      } catch {
        navigate(path);
      }
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [navigate]);

  return null;
}
