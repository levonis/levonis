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

  // Save scroll position of the leaving location, then apply scroll for the new one
  useLayoutEffect(() => {
    // Save scroll for the previous location key
    const prevKey = prevKeyRef.current;
    if (prevKey && prevKey !== location.key) {
      positions.set(prevKey, window.scrollY);
    }

    if (navType === "POP") {
      const y = positions.get(location.key) ?? 0;
      window.scrollTo(0, y);
    } else {
      window.scrollTo(0, 0);
    }

    prevKeyRef.current = location.key;
  }, [location.key, navType]);

  // Save on tab close / refresh too
  useEffect(() => {
    const handler = () => {
      positions.set(location.key, window.scrollY);
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [location.key]);

  return null;
}
