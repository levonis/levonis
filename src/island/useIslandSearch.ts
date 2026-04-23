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
  description: string | null;
  description_ar: string | null;
  description_en: string | null;
  description_ku: string | null;
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

/**
 * Rank a product by how well it matches the term:
 *   0 = name starts with term  (best)
 *   1 = name contains term
 *   2 = description contains term
 *   3 = no match (filtered out)
 * Checks all language variants for both fields.
 */
export const rankProduct = (p: IslandProduct, q: string): number => {
  const term = q.toLowerCase().trim();
  if (!term) return 3;
  const names = [p.name, p.name_ar, p.name_en, p.name_ku]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
  const descs = [p.description, p.description_ar, p.description_en, p.description_ku]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
  if (names.some((n) => n.startsWith(term))) return 0;
  if (names.some((n) => n.includes(term))) return 1;
  if (descs.some((d) => d.includes(term))) return 2;
  return 3;
};

interface Options {
  query: string;
  scope: SearchScope;
  categoryId?: string | null;
  enabled?: boolean;
  limit?: number;
}

export const useIslandSearch = ({ query, scope, categoryId, enabled = true, limit = 30 }: Options) => {
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

  const { data: rawProducts = [], isFetching } = useQuery({
    queryKey: ["island-search", scope, categoryId ?? null, debounced, limit],
    enabled: enabled && debounced.length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<IslandProduct[]> => {
      const term = `%${debounced}%`;
      let q = supabase
        .from("products")
        .select(
          "id, slug, name, name_ar, name_en, name_ku, description, description_ar, description_en, description_ku, image_url, price, category_id, in_stock",
        )
        .eq("in_stock", true)
        .or(
          [
            `name.ilike.${term}`,
            `name_ar.ilike.${term}`,
            `name_en.ilike.${term}`,
            `name_ku.ilike.${term}`,
            `description.ilike.${term}`,
            `description_ar.ilike.${term}`,
            `description_en.ilike.${term}`,
            `description_ku.ilike.${term}`,
          ].join(","),
        )
        .limit(limit);
      if (scope === "category" && categoryId) {
        q = q.eq("category_id", categoryId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as IslandProduct[];
    },
  });

  // Sort matches: name-prefix > name-contains > description-contains
  const products = useMemo<IslandProduct[]>(() => {
    if (debounced.length < 2) return [];
    return [...rawProducts]
      .map((p) => ({ p, r: rankProduct(p, debounced) }))
      .filter((x) => x.r < 3)
      .sort((a, b) => a.r - b.r)
      .map((x) => x.p);
  }, [rawProducts, debounced]);

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
    products: products.slice(0, 8),
    allProducts: products,
    suggestions,
    recent,
    refreshRecent,
    isFetching,
    language,
  };
};
