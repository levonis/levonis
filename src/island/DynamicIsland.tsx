import { AnimatePresence, motion, type Transition } from "framer-motion";
import { ArrowLeft, ArrowRight, Search, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useIsland, type IslandState } from "./IslandContext";
import { useLanguage } from "@/lib/i18n";

const spring: Transition = {
  type: "spring",
  stiffness: 320,
  damping: 30,
  mass: 0.9,
};

const contentTransition: Transition = {
  duration: 0.28,
  ease: [0.32, 0.72, 0, 1],
};

const contentMotion = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.985 },
};

const shapeFor = (
  state: IslandState,
  title?: string,
): { width: number; height: number; radius: number } => {
  // approximate width per character (semi-bold 13px ≈ 7.5px, Arabic glyphs a bit wider)
  const titleLen = title ? Array.from(title).length : 0;
  const titleWidth = Math.min(220, Math.max(60, titleLen * 9));
  switch (state) {
    case "promo":    return { width: 280, height: 40, radius: 22 };
    case "search":   return { width: 340, height: 48, radius: 26 };
    case "category": return { width: 96 + titleWidth, height: 52, radius: 26 }; // back + search buttons + title
    case "product":  return { width: 56 + titleWidth, height: 46, radius: 24 }; // back button + title (right spacer)
  }
};

export const DynamicIsland = () => {
  const { state, title, promoMessages } = useIsland();
  const { t, isRtl } = useLanguage();
  const navigate = useNavigate();
  const shape = shapeFor(state, title);
  const [searchQuery, setSearchQuery] = useState("");

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) navigate(`/products?search=${encodeURIComponent(q)}`);
  };

  const goSearch = () => navigate("/products");

  const messages = promoMessages.length ? promoMessages : [];

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-3">
      <motion.div
        initial={false}
        animate={{
          width: shape.width,
          maxWidth: "calc(100vw - 16px)",
          height: shape.height,
          borderRadius: shape.radius,
        }}
        transition={spring}
        className="island-surface pointer-events-auto flex items-center"
        style={{ borderRadius: shape.radius }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {state === "promo" && (
            <motion.div
              key="promo"
              initial={contentMotion.initial}
              animate={contentMotion.animate}
              exit={contentMotion.exit}
              transition={contentTransition}
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

          {state === "search" && (
            <motion.form
              key="search"
              initial={contentMotion.initial}
              animate={contentMotion.animate}
              exit={contentMotion.exit}
              transition={contentTransition}
              onSubmit={submitSearch}
              className="flex h-full w-full items-center gap-2.5 px-4 text-start"
              aria-label={t("island_search_placeholder")}
            >
              <Search className="h-4 w-4 shrink-0 text-foreground/70" strokeWidth={2.25} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                type="search"
                placeholder={t("island_search_placeholder")}
                className="flex-1 bg-transparent text-[13px] font-medium text-foreground placeholder:text-foreground/45 outline-none border-0"
              />
              <kbd className="hidden sm:inline-block rounded-md border border-foreground/10 bg-foreground/5 px-1.5 py-0.5 text-[10px] font-medium text-foreground/55">
                ⌘K
              </kbd>
            </motion.form>
          )}

          {state === "category" && (
            <motion.div
              key="category"
              initial={contentMotion.initial}
              animate={contentMotion.animate}
              exit={contentMotion.exit}
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
                aria-label={t("island_search_placeholder")}
              >
                <Search className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </motion.div>
          )}

          {state === "product" && (
            <motion.div
              key="product"
              initial={contentMotion.initial}
              animate={contentMotion.animate}
              exit={contentMotion.exit}
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
    </div>
  );
};
