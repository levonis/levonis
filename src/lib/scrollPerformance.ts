/**
 * Disable expensive backdrop-filter while the user is scrolling.
 * Adds `is-scrolling` to <html> on scroll, removes it ~220ms after scroll stops.
 * This single hook gives a noticeable FPS boost on pages with many glass panels.
 */
export function installScrollPerformance() {
  if (typeof window === "undefined") return;
  let timeoutId: number | null = null;
  const root = document.documentElement;

  const begin = () => {
    if (!root.classList.contains("is-scrolling")) {
      root.classList.add("is-scrolling");
    }
    if (timeoutId) window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      root.classList.remove("is-scrolling");
      timeoutId = null;
    }, 220);
  };

  // Kick in immediately on the gesture, before the first scroll frame paints.
  window.addEventListener("scroll", begin, { passive: true, capture: true });
  window.addEventListener("wheel", begin, { passive: true, capture: true });
  window.addEventListener("touchmove", begin, { passive: true, capture: true });
  window.addEventListener("touchstart", begin, { passive: true, capture: true });
}
