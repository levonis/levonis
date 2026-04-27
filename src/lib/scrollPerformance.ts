/**
 * Disable expensive backdrop-filter while the user is scrolling.
 * Adds `is-scrolling` to <html> on scroll, removes it ~140ms after scroll stops.
 * This single hook gives a noticeable FPS boost on pages with many glass panels.
 */
export function installScrollPerformance() {
  if (typeof window === "undefined") return;
  let timeoutId: number | null = null;
  const root = document.documentElement;

  const onScroll = () => {
    if (!root.classList.contains("is-scrolling")) {
      root.classList.add("is-scrolling");
    }
    if (timeoutId) window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      root.classList.remove("is-scrolling");
      timeoutId = null;
    }, 140);
  };

  window.addEventListener("scroll", onScroll, { passive: true, capture: true });
}
