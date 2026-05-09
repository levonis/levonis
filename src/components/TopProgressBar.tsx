import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Slim top progress bar that appears on every route change.
 * Pure CSS, no deps. Fires on pathname change and auto-completes.
 */
export default function TopProgressBar() {
  const { pathname } = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const firstRender = useRef(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    timers.current.forEach(clearTimeout);
    timers.current = [];

    setVisible(true);
    setProgress(15);
    timers.current.push(setTimeout(() => setProgress(45), 80));
    timers.current.push(setTimeout(() => setProgress(75), 240));
    timers.current.push(setTimeout(() => setProgress(95), 500));
    timers.current.push(
      setTimeout(() => {
        setProgress(100);
        timers.current.push(
          setTimeout(() => {
            setVisible(false);
            setProgress(0);
          }, 220),
        );
      }, 700),
    );

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [pathname]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[10000] h-[2px]"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms" }}
    >
      <div
        className="h-full bg-gradient-to-r from-primary via-accent to-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]"
        style={{
          width: `${progress}%`,
          transition: "width 220ms cubic-bezier(0.16,1,0.3,1)",
        }}
      />
    </div>
  );
}
