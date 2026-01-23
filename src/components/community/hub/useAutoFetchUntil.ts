import { useEffect } from "react";

type Params = {
  /** current number of loaded items */
  count: number;
  /** stop auto fetching once count reaches this number */
  target: number;
  /** whether another page exists */
  hasNextPage: boolean;
  /** whether we are currently fetching the next page */
  isFetchingNextPage: boolean;
  /** trigger next page fetch */
  fetchNextPage: () => void;
  /** small delay between auto fetches to reduce burst */
  delayMs?: number;
};

/**
 * Auto-fetches the next page in small bursts until `count >= target`.
 * Useful for progressive loading (4 ثم 4...) without user interaction.
 */
export function useAutoFetchUntil({
  count,
  target,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  delayMs = 140,
}: Params) {
  useEffect(() => {
    if (count >= target) return;
    if (!hasNextPage) return;
    if (isFetchingNextPage) return;

    const t = window.setTimeout(() => fetchNextPage(), delayMs);
    return () => window.clearTimeout(t);
  }, [count, target, hasNextPage, isFetchingNextPage, fetchNextPage, delayMs]);
}
