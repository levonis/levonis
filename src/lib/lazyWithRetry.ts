import { lazy, type ComponentType } from "react";

/**
 * Wraps React.lazy with:
 *  - a hard timeout so a hanging chunk fetch (flaky mobile networks / stalled
 *    HTTP/2 streams) rejects instead of leaving Suspense on its fallback
 *    forever ("infinite loading").
 *  - a single silent retry on network-style failures.
 *
 * The rejection is then caught by main.tsx's global handlers, which reload
 * once to pull fresh hashed chunks. This is the root fix for pages that
 * "sometimes never load" after client-side navigation.
 */
const DEFAULT_TIMEOUT_MS = 12_000;

function isRetryableError(err: unknown): boolean {
  const msg = (err as { message?: string })?.message || String(err || "");
  return (
    /Importing a module script failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /NetworkError/i.test(msg) ||
    /timeout/i.test(msg)
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Failed to fetch dynamically imported module (timeout ${ms}ms)`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
) {
  return lazy(async () => {
    try {
      return await withTimeout(factory(), timeoutMs);
    } catch (err) {
      if (!isRetryableError(err)) throw err;
      // Small delay before retry to let the network recover.
      await new Promise((r) => setTimeout(r, 600));
      return await withTimeout(factory(), timeoutMs);
    }
  });
}
