import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/lib/i18n";

export type SearchScope = "global" | "category" | "community";

export interface IslandProduct {
  id: string;
  slug: string | null;
  name: string;
  name_ar: string | null;
  name_en: string | null;
  name_ku: string | null;
  image_url: string | null;
  price: number | null;
}

const RECENT_KEY = "island_recent_searches";
const RECENT_MAX = 6;

const readRecent = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
};

export const pushRecent = (term: string) => {
  const t = term.trim();
  if (!t) return;
  try {
    const list = readRecent().filter((x) => x.toLowerCase() !== t.toLowerCase());
    list.unshift(t);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {}
};

export const useDebounced = <T,>(value: T, delay = 220): T => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
};

export const pickName = (p: IslandProduct, lang: string): string => {
  if (lang === "en") return p.name_en || p.name || p.name_ar || "";
  if (lang === "ku") return p.name_ku || p.name_ar || p.name || "";
  return p.name_ar || p.name || "";
};

interface Options {
  query: string;
  scope: SearchScope;
  categoryId?: string | null;
  enabled?: boolean;
}

export const useIslandSearch = ({ query, scope, categoryId, enabled = true }: Options) => {
  const debounced = useDebounced(query.trim(), 220);
  const { language } = useLanguage();
  const recentRef = useRef<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    const list = readRecent();
    recentRef.current = list;
    setRecent(list);
  }, []);

  const refreshRecent = () => setRecent(readRecent());

  const { data: products = [], isFetching } = useQuery({
    queryKey: ["island-search", scope, categoryId ?? null, debounced],
    enabled: enabled && debounced.length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<IslandProduct[]> => {
      const term = `%${debounced}%`;
      let q = supabase
        .from("products")
        .select("id, slug, name, name_ar, name_en, name_ku, image_url, price, category_id")
        .or(
          [
            `name.ilike.${term}`,
            `name_ar.ilike.${term}`,
            `name_en.ilike.${term}`,
            `name_ku.ilike.${term}`,
          ].join(","),
        )
        .limit(8);
      if (scope === "category" && categoryId) {
        q = q.eq("category_id", categoryId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as IslandProduct[];
    },
  });

  // Suggestion keywords derived from product names (unique short tokens)
  const suggestions = useMemo<string[]>(() => {
    if (debounced.length < 2) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const p of products) {
      const name = pickName(p, language);
      if (!name) continue;
      const lower = name.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      out.push(name.length > 36 ? name.slice(0, 36) + "…" : name);
      if (out.length >= 5) break;
    }
    return out;
  }, [products, language, debounced]);

  return {
    debounced,
    products: products.slice(0, 5),
    suggestions,
    recent,
    refreshRecent,
    isFetching,
    language,
  };
};
