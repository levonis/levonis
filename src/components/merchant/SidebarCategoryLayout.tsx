import { useState, useRef, useCallback, useMemo } from "react";
import { Package } from "lucide-react";
import CompactProductCard from "./CompactProductCard";

interface Category {
  id: string;
  name_ar: string;
  image_url: string | null;
  parent_id: string | null;
}

interface Product {
  id: string;
  merchant_id: string;
  title: string;
  description: string | null;
  price_iqd: number | null;
  original_price_iqd: number | null;
  image_urls: string[] | null;
  video_url: string | null;
  primary_image_index: number;
  estimated_days: number | null;
  is_featured?: boolean;
  category_ids?: string[] | null;
}

interface Props {
  mainCategories: Category[];
  getProductsForCategory: (categoryId: string) => Product[];
  getSubCategories: (parentId: string) => Category[];
  onProductClick: (product: Product) => void;
}

const ITEMS_PER_LOAD = 8;

export default function SidebarCategoryLayout({
  mainCategories,
  getProductsForCategory,
  getSubCategories,
  onProductClick,
}: Props) {
  const [activeCatId, setActiveCatId] = useState<string>(mainCategories[0]?.id ?? "");
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_LOAD);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const allProducts = useMemo(() => getProductsForCategory(activeCatId), [activeCatId, getProductsForCategory]);
  const visibleProducts = useMemo(() => allProducts.slice(0, visibleCount), [allProducts, visibleCount]);
  const hasMore = visibleCount < allProducts.length;

  const handleCatClick = useCallback((catId: string) => {
    setActiveCatId(catId);
    setVisibleCount(ITEMS_PER_LOAD);
  }, []);

  // Infinite scroll observer
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastItemRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!hasMore) return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setVisibleCount((prev) => prev + ITEMS_PER_LOAD);
          }
        },
        { rootMargin: "200px" }
      );
      if (node) observerRef.current.observe(node);
    },
    [hasMore]
  );

  return (
    <div className="flex gap-2 min-h-[300px]" dir="rtl">
      {/* Sidebar - sticky */}
      <div className="w-[28%] shrink-0 self-start sticky top-0 space-y-0.5 border-l border-border/30 pl-1.5 max-h-[70vh] overflow-y-auto">
        {mainCategories.map((cat) => {
          const isActive = activeCatId === cat.id;
          const count = getProductsForCategory(cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => handleCatClick(cat.id)}
              className={`w-full text-right px-2.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? "bg-accent/80 text-accent-foreground border border-primary/20 shadow-sm"
                  : "text-foreground hover:bg-muted/60"
              }`}
            >
              <span className="flex items-center gap-1.5">
                {isActive && <span className="w-1 h-4 rounded-full bg-primary shrink-0" />}
                <span>{cat.name_ar}</span>
              </span>
              <span className={`block text-[10px] mt-0.5 ${isActive ? "text-muted-foreground" : "text-muted-foreground/70"}`}>
                {count} منتج
              </span>
            </button>
          );
        })}
      </div>

      {/* Products area - scrollable */}
      <div className="flex-1 min-w-0">
        {visibleProducts.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">لا توجد منتجات في هذا القسم</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {visibleProducts.map((p, i) => (
              <div key={p.id} ref={i === visibleProducts.length - 1 ? lastItemRef : undefined}>
                <CompactProductCard product={p} onView={() => onProductClick(p)} />
              </div>
            ))}
          </div>
        )}

        {hasMore && (
          <div className="py-3 text-center">
            <div className="inline-block h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
