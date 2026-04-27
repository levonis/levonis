import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export interface PageSearchItem {
  /** Stable id for dedupe */
  id: string;
  /** Display label (the user sees this) */
  label: string;
  /** Optional secondary line (category, type, hint) */
  hint?: string;
  /** Extra strings the matcher should consider but not display */
  keywords?: string[];
  /** Either a route to navigate to, or a callback to run on click */
  to?: string;
  onSelect?: () => void;
}

interface PageSearchContextValue {
  items: PageSearchItem[];
  registerSection: (key: string, items: PageSearchItem[]) => void;
  unregisterSection: (key: string) => void;
  /** Live (un-debounced) search query the user is typing in the island. */
  liveQuery: string;
  setLiveQuery: (q: string) => void;
}

const Ctx = createContext<PageSearchContextValue | null>(null);

export const PageSearchProvider = ({ children }: { children: ReactNode }) => {
  const sectionsRef = useRef<Map<string, PageSearchItem[]>>(new Map());
  const [version, setVersion] = useState(0);
  const [liveQuery, setLiveQueryState] = useState("");

  const setLiveQuery = useCallback((q: string) => {
    setLiveQueryState(q);
  }, []);

  const registerSection = useCallback((key: string, items: PageSearchItem[]) => {
    sectionsRef.current.set(key, items);
    setVersion((v) => v + 1);
  }, []);

  const unregisterSection = useCallback((key: string) => {
    if (sectionsRef.current.delete(key)) {
      setVersion((v) => v + 1);
    }
  }, []);

  const items = useMemo<PageSearchItem[]>(() => {
    const flat: PageSearchItem[] = [];
    const seen = new Set<string>();
    sectionsRef.current.forEach((arr) => {
      for (const it of arr) {
        if (seen.has(it.id)) continue;
        seen.add(it.id);
        flat.push(it);
      }
    });
    return flat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const value = useMemo(
    () => ({ items, registerSection, unregisterSection, liveQuery, setLiveQuery }),
    [items, registerSection, unregisterSection, liveQuery, setLiveQuery],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const usePageSearchContext = (): PageSearchContextValue | null => useContext(Ctx);

/**
 * Register a list of searchable items for the current page/section.
 * Automatically unregisters on unmount or when the key changes.
 *
 * Pages call this near the top of their render with a stable key
 * (e.g. "about", "games", "settings") and a list of items to expose.
 */
export const usePageSearchSection = (key: string, items: PageSearchItem[]) => {
  const ctx = useContext(Ctx);
  // Serialize items so identity-only changes (new array same content) don't
  // re-trigger register/unregister and cause "Maximum update depth exceeded".
  const itemsKey = useMemo(() => JSON.stringify(items.map((i) => [i.id, i.label, i.hint, i.to])), [items]);
  useEffect(() => {
    if (!ctx) return;
    ctx.registerSection(key, items);
    return () => ctx.unregisterSection(key);
    // ctx callbacks are stable (useCallback); intentionally exclude `items` and use itemsKey instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, itemsKey]);
};

/** Read the current live (un-debounced) island search query. Empty string when none. */
export const usePageLiveQuery = (): string => {
  const ctx = useContext(Ctx);
  return ctx?.liveQuery ?? "";
};

/** Match items against the user's query (case-insensitive, multi-token AND). */
export const filterPageItems = (items: PageSearchItem[], query: string): PageSearchItem[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const scored: { item: PageSearchItem; score: number }[] = [];
  for (const item of items) {
    const haystack = [item.label, item.hint, ...(item.keywords || [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    let ok = true;
    for (const tok of tokens) {
      if (!haystack.includes(tok)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const labelLower = item.label.toLowerCase();
    let score = 2;
    if (labelLower.startsWith(q)) score = 0;
    else if (labelLower.includes(q)) score = 1;
    scored.push({ item, score });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.map((s) => s.item).slice(0, 12);
};
