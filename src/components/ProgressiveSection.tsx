import { useEffect, useRef, useState, type ReactNode } from "react";

interface ProgressiveSectionProps {
  children: ReactNode;
  /** Estimated height to reserve while content is hidden, prevents layout shift */
  minHeight?: string;
  /** rootMargin for IntersectionObserver — start loading slightly before scroll reaches it */
  rootMargin?: string;
  /** If true, content is shown after a small idle delay even without scroll (for above-the-fold) */
  eager?: boolean;
}

/**
 * Defers rendering of children until the placeholder enters (or nearly enters) the viewport.
 * This makes long pages with many heavy sections (Home → all categories) appear instantly,
 * then progressively fill in as the user scrolls.
 */
export default function ProgressiveSection({
  children,
  minHeight = "200px",
  rootMargin = "300px",
  eager = false,
}: ProgressiveSectionProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [show, setShow] = useState(eager);

  useEffect(() => {
    if (show) return;
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShow(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [show, rootMargin]);

  // For eager sections, schedule on idle so the first paint isn't blocked
  useEffect(() => {
    if (!eager || show) return;
    const idle = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 50));
    const cancel = (window as any).cancelIdleCallback || clearTimeout;
    const id = idle(() => setShow(true), { timeout: 200 });
    return () => cancel(id);
  }, [eager, show]);

  return (
    <div
      ref={ref}
      style={
        !show
          ? {
              minHeight,
              contain: "layout paint",
              contentVisibility: "auto" as any,
              containIntrinsicSize: `0 ${minHeight}`,
            }
          : { contentVisibility: "auto" as any, containIntrinsicSize: `0 ${minHeight}` }
      }
    >
      {show ? children : null}
    </div>
  );
}
