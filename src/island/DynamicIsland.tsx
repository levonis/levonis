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
  stiffness: 170,
  damping: 26,
  mass: 1.1,
};

// Dedicated transition for the island appearing / disappearing with the route.
// Slower & softer than internal morphs so it feels like a gentle breath.
const shellEnterExit: Transition = {
  type: "spring",
  stiffness: 140,
  damping: 24,
  mass: 1.2,
};

const contentTransition: Transition = {
  duration: 0.36,
  ease: [0.22, 1, 0.36, 1],
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
  duration: 0.45,
  ease: [0.22, 1, 0.36, 1],
};

/* -------------------------------------------------------------------------- */
/*  Search sub-stages                                                         */
/* -------------------------------------------------------------------------- */

type SearchStage = "idle" | "typing" | "suggestions" | "results";
type SearchScope = "global" | "category" | "community";

/**
 * Computes the island shape. For category/product titles, the width budget
 * scales per-language (Arabic/Kurdish glyphs are visually wider than Latin)
 * and respects the viewport so long names show in full instead of being cut
 * to a few letters.
 */
const baseShape = (
  state: IslandState,
  title: string | undefined,
  language: string,
): { width: number; height: number; radius: number } => {
  const titleLen = title ? Array.from(title).length : 0;
  const isWideScript = language === "ar" || language === "ku";
  const perChar = isWideScript ? 11 : 8.5;
  const minBudget = 120;
  const viewportBudget =
    typeof window !== "undefined" ? window.innerWidth - 48 : 520;
  const cap = Math.min(viewportBudget, 560);
  const titleWidth = Math.min(
    cap,
    Math.max(minBudget, Math.round(titleLen * perChar) + 24),
  );
  switch (state) {
    case "promo":    return { width: 280, height: 40, radius: 22 };
    case "search":   return { width: 360, height: 52, radius: 26 };
    // chrome = back button + search button (~96 px) + paddings
    case "category": return { width: Math.min(cap, 96 + titleWidth), height: 52, radius: 26 };
    // chrome = back button only (~56 px)
    case "product":  return { width: Math.min(cap, 64 + titleWidth), height: 46, radius: 24 };
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
  const { state, title: rawTitle, promoMessages, promoSettings, visible, setContext } = useIsland();

  /* ---------- Debounce rapid title changes ----------
   * Coalesces fast successive title updates (e.g. switching products while
   * typing or quick category hops) so the island doesn't queue overlapping
   * width/scale animations. The latest pending change wins; mid-flight
   * timers are cancelled before they fire.
   */
  const [title, setTitle] = useState<string | undefined>(rawTitle);
  const titleTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (rawTitle === title) return;
    if (titleTimerRef.current !== null) {
      window.clearTimeout(titleTimerRef.current);
      titleTimerRef.current = null;
    }
    // Empty/undefined updates apply immediately so the island can collapse
    // without a perceptible lag; non-empty changes settle after a short window.
    if (!rawTitle) {
      setTitle(rawTitle);
      return;
    }
    titleTimerRef.current = window.setTimeout(() => {
      setTitle(rawTitle);
      titleTimerRef.current = null;
    }, 120);
    return () => {
      if (titleTimerRef.current !== null) {
        window.clearTimeout(titleTimerRef.current);
        titleTimerRef.current = null;
      }
    };
  }, [rawTitle, title]);
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

  /* ---------- Reset search whenever route changes ----------
   * Ensures opening a product (or any nav) clears the input + closes the
   * suggestions/results panel so the user starts fresh on the next page.
   */
  useEffect(() => {
    setSearchQuery("");
    setFocused(false);
  }, [location.pathname]);

  /* ---------- Shape ---------- */
  const shape =
    state === "search"
      ? searchShape(stage, products.length)
      : baseShape(state, title, language);

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
      // Global search → dedicated full results page.
      navigate(`/search?q=${encoded}`);
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
    // Switch the island into search mode in-place and focus the input.
    // We must NOT navigate away — staying on the current category/community
    // page lets the user search within that scope.
    if (state !== "search") {
      setContext({ state: "search" });
    }
    // Wait one frame so the input mounts (search shell renders) before focusing.
    requestAnimationFrame(() => {
      setFocused(true);
      inputRef.current?.focus();
    });
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
  const marqueeItems = useMemo(() => {
    if (!messages.length) return [] as string[];
    const repeatCount = Math.max(4, Math.ceil(12 / messages.length));
    return Array.from({ length: repeatCount }, () => messages).flat();
  }, [messages]);

  /* ---------- Render ---------- */
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-3">
      <LayoutGroup>
        <AnimatePresence initial={false}>
          {visible && (
            <motion.div
              key="island-shell"
              ref={islandRef}
              data-dynamic-island
              layout
              initial={{ opacity: 0, scaleX: 0.02, scaleY: 0.85 }}
              animate={{
                opacity: 1,
                scaleX: 1,
                scaleY: 1,
                width: shape.width,
                height: shape.height,
                borderRadius: shape.radius,
              }}
              exit={{ opacity: 0, scaleX: 0.02, scaleY: 0.85 }}
              style={{
                maxWidth: "calc(100vw - 16px)",
                borderRadius: shape.radius,
                transformOrigin: "center center",
                touchAction: "pan-y",
              }}
              transition={{
                default: {
                  type: "spring",
                  stiffness: 380,
                  damping: 34,
                  mass: 0.7,
                  restDelta: 0.5,
                  restSpeed: 0.5,
                },
                width: {
                  type: "spring",
                  stiffness: 300,
                  damping: 32,
                  mass: 0.8,
                  restDelta: 0.5,
                  restSpeed: 0.5,
                },
                height: {
                  type: "spring",
                  stiffness: 400,
                  damping: 36,
                  mass: 0.7,
                  restDelta: 0.5,
                  restSpeed: 0.5,
                },
                borderRadius: {
                  type: "spring",
                  stiffness: 380,
                  damping: 34,
                  mass: 0.7,
                },
                opacity: { duration: 0.14, ease: [0.22, 1, 0.36, 1] },
                scaleX: {
                  type: "spring",
                  stiffness: 420,
                  damping: 34,
                  mass: 0.65,
                },
                scaleY: {
                  type: "spring",
                  stiffness: 460,
                  damping: 36,
                  mass: 0.65,
                },
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
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/wishes");
                  }}
                  aria-label="اذهب إلى الأمنيات"
                  title="الأمنيات"
                  className="pointer-events-auto inline-flex shrink-0 items-center justify-center rounded-full p-0.5 text-primary transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
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
                    <div
                      dir="ltr"
                      className="marquee-track text-[12px] font-medium tracking-tight text-foreground/85"
                      style={{
                        ['--marquee-duration' as any]: `${Math.max(4, promoSettings.speed)}s`,
                        ['--marquee-direction' as any]: promoSettings.direction === 'left' ? 'reverse' : 'normal',
                        ['--marquee-gap' as any]: `${promoSettings.gap}px`,
                      }}
                    >
                      {[0, 1].map((group) => (
                        <div key={group} className="marquee-group" aria-hidden={group === 1}>
                          {marqueeItems.map((m, i) => (
                            <span key={`${group}-${i}`} className="inline-flex items-center gap-3">
                              <span dir="auto" className="text-foreground/90">{m}</span>
                              <span aria-hidden="true" className="text-foreground/35">•</span>
                            </span>
                          ))}
                        </div>
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
                <div className="flex-1 overflow-hidden text-center">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={title ?? "cat-default"}
                      dir="auto"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -3 }}
                      style={{ unicodeBidi: "plaintext", willChange: "opacity, transform" }}
                      transition={{
                        y: { type: "spring", stiffness: 320, damping: 32, mass: 0.7 },
                        opacity: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
                      }}
                      className="block truncate text-[13px] font-semibold tracking-tight text-foreground"
                    >
                      {title ?? ""}
                    </motion.span>
                  </AnimatePresence>
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
                <div className="flex-1 overflow-hidden text-center">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={title ?? "prod-default"}
                      dir="auto"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -3 }}
                      style={{ unicodeBidi: "plaintext", willChange: "opacity, transform" }}
                      transition={{
                        y: { type: "spring", stiffness: 320, damping: 32, mass: 0.7 },
                        opacity: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
                      }}
                      className="block truncate text-[13px] font-semibold tracking-tight text-foreground"
                    >
                      {title ?? ""}
                    </motion.span>
                  </AnimatePresence>
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
