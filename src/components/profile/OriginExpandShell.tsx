import { ReactNode, useEffect, useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OriginRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OriginExpandShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originRect: OriginRect | null;
  children: ReactNode;
  /** Title row (icon + text). Pass any ReactNode. */
  title?: ReactNode;
  /** Optional sticky footer area below the scrollable body. */
  footer?: ReactNode;
  /** Panel size preset. */
  size?: "default" | "lg";
  /** Additional classes appended to the body's inner padding wrapper. */
  bodyClassName?: string;
  /** Hide the default close (X) button. */
  hideClose?: boolean;
  /** Direction for content. */
  dir?: "rtl" | "ltr";
}

/**
 * A modal shell that appears to "grow" out of a small origin button (like the
 * stat tiles on the profile header) and "shrinks" back into it on close —
 * similar to iOS app open / Dynamic Island expansion.
 *
 * Provides a UNIFIED chrome for every popup using it: same backdrop, same
 * glass panel (via `.glass-card`), same header layout, same close button,
 * same scroll body, same spring animation. Consumers pass content only.
 */
export default function OriginExpandShell({
  open,
  onOpenChange,
  originRect,
  children,
  title,
  footer,
  size = "default",
  bodyClassName,
  hideClose,
  dir = "rtl",
}: OriginExpandShellProps) {
  const reduce = useReducedMotion();

  // Close on Escape + lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange]);

  // Compute origin transform for the panel: it begins at the button position
  // (translated + scaled down) and animates back to (0,0) at scale 1.
  const { initial, animate, exit, transformOrigin } = useMemo(() => {
    if (typeof window === "undefined" || !originRect) {
      return {
        initial: { opacity: 0, scale: reduce ? 1 : 0.96 },
        animate: { opacity: 1, scale: 1, x: 0, y: 0 },
        exit: { opacity: 0, scale: reduce ? 1 : 0.96 },
        transformOrigin: "center center",
      };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = vw / 2;
    const cy = vh / 2;
    const ox = originRect.x + originRect.width / 2;
    const oy = originRect.y + originRect.height / 2;
    const tox = `${(ox / vw) * 100}%`;
    const toy = `${(oy / vh) * 100}%`;

    if (reduce) {
      return {
        initial: { opacity: 0, scale: 1 },
        animate: { opacity: 1, scale: 1, x: 0, y: 0 },
        exit: { opacity: 0, scale: 1 },
        transformOrigin: `${tox} ${toy}`,
      };
    }

    return {
      initial: { opacity: 0, scale: 0.18, x: ox - cx, y: oy - cy },
      animate: { opacity: 1, scale: 1, x: 0, y: 0 },
      exit: { opacity: 0, scale: 0.18, x: ox - cx, y: oy - cy },
      transformOrigin: `${tox} ${toy}`,
    };
  }, [originRect, reduce, open]);

  if (typeof document === "undefined") return null;

  const sizeClass = size === "lg" ? "max-w-lg max-h-[90vh]" : "max-w-md max-h-[85vh]";

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100]" dir={dir}>
          {/* Unified backdrop — same for every popup */}
          <motion.div
            className="absolute inset-0 bg-black/55 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={() => onOpenChange(false)}
          />

          {/* Centered panel — animates from origin */}
          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              role="dialog"
              aria-modal="true"
              className={cn(
                // Unified glass chrome — single source of truth.
                "glass-card pointer-events-auto relative w-full",
                "rounded-3xl overflow-hidden shadow-2xl flex flex-col",
                sizeClass,
              )}
              style={{ transformOrigin, willChange: "transform, opacity" }}
              initial={initial}
              animate={animate}
              exit={exit}
              transition={
                reduce
                  ? { duration: 0.18, ease: "easeOut" }
                  : { type: "spring", stiffness: 320, damping: 32, mass: 0.9 }
              }
            >
              {/* Unified header */}
              {(title || !hideClose) && (
                <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3 shrink-0 border-b border-white/10">
                  <div className="text-sm font-bold text-foreground min-w-0 flex-1">
                    {title}
                  </div>
                  {!hideClose && (
                    <button
                      onClick={() => onOpenChange(false)}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-full glass-card-inner text-foreground hover:bg-white/10 transition-colors shrink-0"
                      aria-label="إغلاق"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Unified scroll body */}
              <div
                className={cn(
                  "flex-1 overflow-y-auto px-5 py-4 scrollbar-thin",
                  bodyClassName,
                )}
              >
                {children}
              </div>

              {/* Optional unified footer */}
              {footer && (
                <div className="shrink-0 border-t border-white/10 px-5 py-3">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
