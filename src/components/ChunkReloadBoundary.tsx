import React from "react";

/**
 * Catches lazy-import failures (stale bundle after deploy) and force-reloads
 * the page once so the client picks up the new hashed chunks. Uses
 * sessionStorage as a guard to avoid infinite reload loops.
 */
interface State { hasError: boolean }

const KEY = "__chunk_reload_attempted__";

function isChunkLoadError(err: unknown): boolean {
  const msg = (err as any)?.message || String(err || "");
  const name = (err as any)?.name || "";
  return (
    /Importing a module script failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /ChunkLoadError/i.test(name) ||
    /error loading dynamically imported module/i.test(msg)
  );
}

export default class ChunkReloadBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (isChunkLoadError(error)) {
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }
      try {
        const attempted = sessionStorage.getItem(KEY);
        if (!attempted) {
          sessionStorage.setItem(KEY, "1");
          // Small delay so React finishes commit before reload.
          setTimeout(() => window.location.reload(), 50);
          return;
        }
      } catch {
        window.location.reload();
        return;
      }
    }
    // Non-chunk errors: log for debugging.
    console.error("[ChunkReloadBoundary]", error);
  }

  componentDidMount() {
    // Reset the guard on a fully successful mount.
    try { sessionStorage.removeItem(KEY); } catch {}
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
