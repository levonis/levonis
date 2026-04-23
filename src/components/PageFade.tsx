import { useLocation } from "react-router-dom";
import { ReactNode } from "react";

/**
 * Wraps route output and replays a brief fade+slide whenever the pathname
 * changes, so newly mounted pages settle in instead of popping. Keyed on the
 * pathname so React remounts the wrapper and restarts the CSS animation.
 */
export default function PageFade({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="route-fade-in">
      {children}
    </div>
  );
}
