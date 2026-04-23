import { ReactNode, useEffect, useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

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
  title?: ReactNode;
  /** Extra classes for the inner panel (defaults to a glass card). */
  panelClassName?: string;
  /** Hide the default close (X) button. */
  hideClose?: boolean;
  /** Direction for content. */
  dir?: "rtl" | "ltr";
}

/**
 * A modal shell that appears to "grow" out of a small origin button (like the
 * stat tiles on the profile header) and "shrinks" back into it on close —
 * similar to iOS app open / Dynamic Island expansion.
 */
export default function OriginExpandShell({
  open,
  onOpenChange,
  originRect,
  children,
  title,
  panelClassName,
  hideClose,
  dir = "rtl",
}: OriginExpandShellProps) {
  const reduce = useReducedMotion();

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    // lock body scroll while open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange]);

  // Compute origin transform for the panel.
  // The panel is fixed and centered; we translate it so it begins at the button
  // position, then animate back to (0,0) at scale 1.
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
    // Use viewport-relative origin (percent) so transform-origin stays correct
    // regardless of final panel size.
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
      initial: {
        opacity: 0,
        scale: 0.18,
        x: ox - cx,
        y: oy - cy,
      },
      animate: { opacity: 1, scale: 1, x: 0, y: 0 },
      exit: {
        opacity: 0,
        scale: 0.18,
        x: ox - cx,
        y: oy - cy,
      },
      transformOrigin: `${tox} ${toy}`,
    };
  }, [originRect, reduce, open]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100]" dir={dir}>
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-background/60 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={() => onOpenChange(false)}
          />

          {/* Panel container — centers the panel; the panel itself animates */}
          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              role="dialog"
              aria-modal="true"
              className={
                panelClassName ??
                "pointer-events-auto relative w-full max-w-md max-h-[88vh] overflow-hidden rounded-3xl border border-white/15 bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col"
              }
              style={{ transformOrigin, willChange: "transform, opacity" }}
              initial={initial}
              animate={animate}
              exit={exit}
              transition={
                reduce
                  ? { duration: 0.18, ease: "easeOut" }
                  : {
                      type: "spring",
                      stiffness: 320,
                      damping: 32,
                      mass: 0.9,
                    }
              }
            >
              {(title || !hideClose) && (
                <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2 shrink-0">
                  <div className="text-sm font-bold text-foreground">{title}</div>
                  {!hideClose && (
                    <button
                      onClick={() => onOpenChange(false)}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-muted/60 hover:bg-muted text-foreground transition-colors"
                      aria-label="إغلاق"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
              <div className="flex-1 overflow-y-auto px-5 pb-5 pt-1">
                {children}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
