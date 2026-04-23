import {
  AnimatePresence,
  LayoutGroup,
  motion,
  type Transition,
} from "framer-motion";
import { ArrowLeft, ArrowRight, Search, Sparkles, X, Clock } from "lucide-react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useIsland, type IslandState } from "./IslandContext";
import { useIslandSearch, pushRecent, pickName } from "./useIslandSearch";
import { useLanguage } from "@/lib/i18n";
import type { TranslationKeys } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

/* -------------------------------------------------------------------------- */
/*  Motion presets — soft spring, no harsh bounce                             */
/* -------------------------------------------------------------------------- */

const shellSpring: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 28,
  mass: 0.95,
};

// Dedicated transition for the island appearing / disappearing with the route.
// Slower & softer than internal morphs so it feels like a gentle breath.
const shellEnterExit: Transition = {
  type: "spring",
  stiffness: 180,
  damping: 26,
  mass: 1.05,
};

const contentTransition: Transition = {
  duration: 0.24,
  ease: [0.32, 0.72, 0, 1],
};

const contentMotion = {
  initial: { opacity: 0, y: 6, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.99 },
};

// Softer cross-fade used specifically for promo↔search swaps so the surface
// morphs continuously without a hard wipe.
const morphMotion = {
  initial: { opacity: 0, y: 4, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -4, filter: "blur(4px)" },
};

const morphTransition: Transition = {
  duration: 0.32,
  ease: [0.32, 0.72, 0, 1],
};

/* -------------------------------------------------------------------------- */
/*  Search sub-stages                                                         */
/* -------------------------------------------------------------------------- */

type SearchStage = "idle" | "typing" | "suggestions" | "results";
type SearchScope = "global" | "category" | "community";

const baseShape = (
  state: IslandState,
  title?: string,
): { width: number; height: number; radius: number } => {
  const titleLen = title ? Array.from(title).length : 0;
  const titleWidth = Math.min(220, Math.max(60, titleLen * 9));
  switch (state) {
    case "promo":    return { width: 280, height: 40, radius: 22 };
    case "search":   return { width: 360, height: 52, radius: 26 };
    case "category": return { width: 96 + titleWidth, height: 52, radius: 26 };
    case "product":  return { width: 56 + titleWidth, height: 46, radius: 24 };
  }
};

const searchShape = (
  stage: SearchStage,
  resultsCount: number,
): { width: number; height: number; radius: number } => {
  switch (stage) {
    case "idle":
      return { width: 360, height: 52, radius: 26 };
    case "typing":
      return { width: 420, height: 60, radius: 26 };
    case "suggestions":
      return { width: 480, height: 200, radius: 28 };
    case "results": {
      // 60 (input row) + 12 (label) + count * 56 (rows) + 44 (view all) + 18 (padding)
      const rows = Math.max(1, Math.min(5, resultsCount));
      return { width: 520, height: 60 + 12 + rows * 56 + 44 + 18, radius: 30 };
    }
  }
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export const DynamicIsland = () => {
  const { state, title, promoMessages, visible } = useIsland();
  const { t, isRtl, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  /* ---------- Search context ---------- */
  const [searchQuery, setSearchQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const islandRef = useRef<HTMLDivElement>(null);

  const { scope, placeholderKey } = useMemo<{
    scope: SearchScope;
    placeholderKey: keyof TranslationKeys;
  }>(() => {
    const p = location.pathname;
    if (p.startsWith("/category/")) {
      return { scope: "category", placeholderKey: "island_search_in_category" };
    }
    if (p.startsWith("/community")) {
      return { scope: "community", placeholderKey: "island_search_in_community" };
    }
    return { scope: "global", placeholderKey: "island_search_placeholder" };
  }, [location.pathname]);

  // Resolve category id when on a category page (so DB filter is exact).
  const { data: categoryId } = useQuery({
    queryKey: ["island-cat-id", params.slug],
    enabled: scope === "category" && !!params.slug,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", params.slug as string)
        .maybeSingle();
      return data?.id ?? null;
    },
  });

  const { products, suggestions, recent, refreshRecent, debounced } = useIslandSearch({
    query: searchQuery,
    scope,
    categoryId: categoryId ?? null,
    enabled: focused || searchQuery.length > 0,
  });

  /* ---------- Derive search sub-stage ---------- */
  const isSearchActive = state === "search" && (focused || searchQuery.length > 0);
  const stage: SearchStage = useMemo(() => {
    if (!isSearchActive) return "idle";
    const q = debounced;
    if (q.length === 0) return recent.length > 0 ? "suggestions" : "typing";
    if (products.length > 0) return "results";
    if (suggestions.length > 0) return "suggestions";
    return "typing";
  }, [isSearchActive, debounced, recent.length, products.length, suggestions.length]);

  /* ---------- Outside click + Escape collapse ---------- */
  useEffect(() => {
    if (!isSearchActive) return;
    const onDown = (e: MouseEvent) => {
      if (!islandRef.current) return;
      if (!islandRef.current.contains(e.target as Node)) {
        setFocused(false);
        inputRef.current?.blur();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFocused(false);
        setSearchQuery("");
        inputRef.current?.blur();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isSearchActive]);

  /* ---------- Shape ---------- */
  const shape =
    state === "search"
      ? searchShape(stage, products.length)
      : baseShape(state, title);

  /* ---------- Actions ---------- */
  const goSearchUrl = (q: string) => {
    const encoded = encodeURIComponent(q);
    if (scope === "category" && params.slug) {
      // Stay inside the current category page and just update the q param.
      navigate(`/category/${params.slug}?q=${encoded}`, { replace: true });
    } else if (scope === "community") {
      // Stay inside the current community page; the page filters by ?q=.
      navigate(`${location.pathname}?q=${encoded}`, { replace: true });
    } else {
      // Global search opens the dedicated /products listing.
      navigate(`/products?search=${encoded}`);
    }
  };

  const resetSearch = () => {
    setSearchQuery("");
    setFocused(false);
    inputRef.current?.blur();
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    pushRecent(q);
    refreshRecent();
    resetSearch();
    goSearchUrl(q);
  };

  const goSearch = () => {
    // Triggered by the magnifier in category state — focus the island input
    if (state === "search") {
      inputRef.current?.focus();
      return;
    }
    if (scope === "category" && params.slug) {
      navigate(`/category/${params.slug}?focus=search`, { replace: true });
    } else if (scope === "community") {
      navigate("/community/merchants/all-products");
    } else {
      navigate("/products");
    }
  };

  const pickSuggestion = (s: string) => {
    setSearchQuery(s);
    pushRecent(s);
    refreshRecent();
    setFocused(false);
    goSearchUrl(s);
  };

  const openProduct = (slug: string | null, id: string) => {
    const term = searchQuery.trim();
    if (term) {
      pushRecent(term);
      refreshRecent();
    }
    // Clear search state fully so returning to the page doesn't re-open results.
    resetSearch();
    navigate(`/product/${slug || id}`);
  };

  const messages = promoMessages.length ? promoMessages : [];

  /* ---------- Render ---------- */
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-3">
      <LayoutGroup>
        <AnimatePresence initial={false}>
          {visible && (
            <motion.div
              key="island-shell"
              ref={islandRef}
              layout
              initial={{ opacity: 0, scale: 0.6, y: -18, filter: "blur(6px)" }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
                filter: "blur(0px)",
                width: shape.width,
                height: shape.height,
                borderRadius: shape.radius,
              }}
              exit={{ opacity: 0, scale: 0.55, y: -22, filter: "blur(8px)" }}
              style={{
                maxWidth: "calc(100vw - 16px)",
                borderRadius: shape.radius,
                transformOrigin: "top center",
              }}
              transition={{
                default: shellSpring,
                opacity: { duration: 0.32, ease: [0.32, 0.72, 0, 1] },
                scale: shellEnterExit,
                y: shellEnterExit,
                filter: { duration: 0.28, ease: [0.32, 0.72, 0, 1] },
              }}
              className="island-surface pointer-events-auto flex flex-col overflow-hidden will-change-transform"
            >
          <AnimatePresence mode="popLayout" initial={false}>
            {/* PROMO ----------------------------------------------------- */}
            {state === "promo" && (
              <motion.div
                key="promo"
                {...morphMotion}
                transition={morphTransition}
                className="relative flex h-full w-full items-center gap-2 overflow-hidden px-3"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.5} />
                <div
                  className="relative flex-1 overflow-hidden"
                  style={{
                    WebkitMaskImage:
                      "linear-gradient(to right, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%)",
                    maskImage:
                      "linear-gradient(to right, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%)",
                  }}
                >
                  {messages.length > 0 ? (
                    <div className="marquee-track text-[12px] font-medium tracking-tight text-foreground/85">
                      {[...messages, ...messages].map((m, i) => (
                        <span key={i} className="inline-flex items-center">
                          <span className="text-foreground/90">{m}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[12px] font-medium text-foreground/70">LEVONIS</span>
                  )}
                </div>
              </motion.div>
            )}

            {/* SEARCH (4 sub-stages, single morphing shell) -------------- */}
            {state === "search" && (
              <motion.div
                key="search"
                {...morphMotion}
                transition={morphTransition}
                className="flex h-full w-full flex-col"
              >
                {/* Input row — always visible while in search state */}
                <motion.form
                  layout
                  onSubmit={submitSearch}
                  className="flex items-center gap-2.5 px-4"
                  style={{ height: stage === "idle" ? 52 : 60 }}
                  aria-label={t(placeholderKey)}
                  role="combobox"
                  aria-expanded={stage !== "idle"}
                >
                  <Search
                    className="h-4 w-4 shrink-0 text-foreground/70"
                    strokeWidth={2.25}
                  />
                  <input
                    ref={inputRef}
                    value={searchQuery}
                    onFocus={() => setFocused(true)}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    type="search"
                    placeholder={t(placeholderKey)}
                    className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-foreground placeholder:text-foreground/45 outline-none border-0"
                  />
                  <AnimatePresence initial={false} mode="popLayout">
                    {searchQuery.length > 0 ? (
                      <motion.button
                        key="clear"
                        type="button"
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => {
                          setSearchQuery("");
                          inputRef.current?.focus();
                        }}
                        className="grid h-6 w-6 place-items-center rounded-full bg-foreground/10 text-foreground/70 hover:bg-foreground/15"
                        aria-label="Clear"
                      >
                        <X className="h-3 w-3" strokeWidth={2.5} />
                      </motion.button>
                    ) : (
                      <motion.kbd
                        key="kbd"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="hidden sm:inline-block rounded-md border border-foreground/10 bg-foreground/5 px-1.5 py-0.5 text-[10px] font-medium text-foreground/55"
                      >
                        ⌘K
                      </motion.kbd>
                    )}
                  </AnimatePresence>
                </motion.form>

                {/* Expanding panel: suggestions / results -------------- */}
                <AnimatePresence initial={false} mode="wait">
                  {stage === "suggestions" && (
                    <motion.div
                      key="suggestions"
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={contentTransition}
                      className="flex-1 overflow-hidden px-2 pb-2"
                      role="listbox"
                    >
                      <div className="px-3 pb-1 pt-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-foreground/45">
                        {debounced.length === 0 ? t("island_recent") : t("island_suggestions")}
                      </div>
                      <div className="flex flex-col">
                        {(debounced.length === 0 ? recent : suggestions).map((s, i) => (
                          <motion.button
                            key={`${s}-${i}`}
                            type="button"
                            initial={{ opacity: 0, x: isRtl ? -6 : 6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              ...contentTransition,
                              delay: i * 0.035,
                            }}
                            onClick={() => pickSuggestion(s)}
                            className="island-search-row flex items-center gap-2.5 rounded-xl px-3 py-2 text-start text-[12.5px] font-medium text-foreground/85 hover:bg-foreground/8"
                          >
                            {debounced.length === 0 ? (
                              <Clock className="h-3.5 w-3.5 shrink-0 text-foreground/45" strokeWidth={2.25} />
                            ) : (
                              <Search className="h-3.5 w-3.5 shrink-0 text-foreground/45" strokeWidth={2.25} />
                            )}
                            <span className="truncate">{s}</span>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {stage === "results" && (
                    <motion.div
                      key="results"
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={contentTransition}
                      className="flex flex-1 flex-col overflow-hidden px-2 pb-2"
                      role="listbox"
                    >
                      <div className="px-3 pb-1 pt-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-foreground/45">
                        {t("island_results")}
                      </div>
                      <div className="flex flex-1 flex-col overflow-y-auto">
                        {products.map((p, i) => {
                          const name = pickName(p, language);
                          return (
                            <motion.button
                              key={p.id}
                              type="button"
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ ...contentTransition, delay: i * 0.04 }}
                              onClick={() => openProduct(p.slug, p.id)}
                              className="island-search-row flex items-center gap-3 rounded-xl px-2 py-1.5 text-start hover:bg-foreground/8"
                            >
                              <div className="island-result-thumb h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-foreground/5">
                                {p.image_url && (
                                  <img
                                    src={p.image_url}
                                    alt=""
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                  />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[12.5px] font-semibold text-foreground">
                                  {name}
                                </div>
                                {p.price != null && (
                                  <div className="truncate text-[11px] font-medium text-foreground/55">
                                    {Number(p.price).toLocaleString()} {t("common_iqd")}
                                  </div>
                                )}
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const q = searchQuery.trim();
                          if (q) pushRecent(q);
                          setFocused(false);
                          goSearchUrl(searchQuery.trim());
                        }}
                        className="mt-1 rounded-xl px-3 py-2 text-[12px] font-semibold text-primary hover:bg-foreground/5"
                      >
                        {t("island_view_all")}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* CATEGORY -------------------------------------------------- */}
            {state === "category" && (
              <motion.div
                key="category"
                {...contentMotion}
                transition={contentTransition}
                className="flex h-full w-full items-center gap-2 px-2"
              >
                <button
                  onClick={() => navigate(-1)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-foreground/5 text-foreground/85 transition hover:bg-foreground/10 active:scale-95"
                  aria-label={t("island_back")}
                >
                  <BackIcon className="h-4 w-4" strokeWidth={2.25} />
                </button>
                <div className="flex-1 truncate text-center text-[13px] font-semibold tracking-tight text-foreground">
                  {title ?? t("nav_categories")}
                </div>
                <button
                  onClick={goSearch}
                  className="grid h-8 w-8 place-items-center rounded-full bg-foreground/5 text-foreground/85 transition hover:bg-foreground/10 active:scale-95"
                  aria-label={t(placeholderKey)}
                >
                  <Search className="h-4 w-4" strokeWidth={2.25} />
                </button>
              </motion.div>
            )}

            {/* PRODUCT --------------------------------------------------- */}
            {state === "product" && (
              <motion.div
                key="product"
                {...contentMotion}
                transition={contentTransition}
                className="flex h-full w-full items-center gap-2 px-2"
              >
                <button
                  onClick={() => navigate(-1)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-foreground/5 text-foreground/85 transition hover:bg-foreground/10 active:scale-95"
                  aria-label={t("island_back")}
                >
                  <BackIcon className="h-4 w-4" strokeWidth={2.25} />
                </button>
                <div className="flex-1 truncate text-center text-[12.5px] font-semibold tracking-tight text-foreground">
                  {title ?? t("nav_products")}
                </div>
                <div className="h-8 w-8" />
              </motion.div>
            )}
          </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </LayoutGroup>
    </div>
  );
};
