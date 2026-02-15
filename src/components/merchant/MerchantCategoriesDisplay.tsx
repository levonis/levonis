import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ArrowRight, Package } from "lucide-react";
import CompactProductCard from "./CompactProductCard";

interface Category {
  id: string;
  merchant_id: string;
  name_ar: string;
  image_url: string | null;
  parent_id: string | null;
  display_order: number;
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

type LayoutType = "standard" | "grid_images" | "strip" | "taobao";

interface Props {
  merchantId: string;
  products: Product[];
  layout: LayoutType;
  onProductClick: (product: Product) => void;
}

export default function MerchantCategoriesDisplay({ merchantId, products, layout, onProductClick }: Props) {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeSubCategoryId, setActiveSubCategoryId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([]);

  const { data: categories = [] } = useQuery({
    queryKey: ["merchant-store-categories", merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_store_categories")
        .select("*")
        .eq("merchant_id", merchantId)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as Category[];
    },
  });

  const mainCategories = useMemo(() => categories.filter(c => !c.parent_id), [categories]);
  const getSubCategories = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  const getProductsForCategory = (categoryId: string): Product[] => {
    const subIds = categories.filter(c => c.parent_id === categoryId).map(c => c.id);
    const allIds = [categoryId, ...subIds];
    return products.filter(p => p.category_ids?.some(id => allIds.includes(id)));
  };

  const getProductsForSubCategory = (categoryId: string): Product[] => {
    return products.filter(p => p.category_ids?.includes(categoryId));
  };

  const handleCategoryClick = (cat: Category) => {
    const subs = getSubCategories(cat.id);
    if (subs.length > 0) {
      setActiveCategoryId(cat.id);
      setActiveSubCategoryId(null);
      setBreadcrumb([{ id: cat.id, name: cat.name_ar }]);
    } else {
      setActiveCategoryId(cat.id);
      setActiveSubCategoryId(null);
      setBreadcrumb([{ id: cat.id, name: cat.name_ar }]);
    }
  };

  const handleSubCategoryClick = (sub: Category, parent: Category) => {
    setActiveSubCategoryId(sub.id);
    setBreadcrumb([{ id: parent.id, name: parent.name_ar }, { id: sub.id, name: sub.name_ar }]);
  };

  const handleBack = () => {
    if (activeSubCategoryId) {
      setActiveSubCategoryId(null);
      setBreadcrumb(prev => prev.slice(0, 1));
    } else {
      setActiveCategoryId(null);
      setActiveSubCategoryId(null);
      setBreadcrumb([]);
    }
  };

  if (mainCategories.length === 0) return null;

  // Show category products view
  const currentProducts = activeSubCategoryId
    ? getProductsForSubCategory(activeSubCategoryId)
    : activeCategoryId
    ? getProductsForCategory(activeCategoryId)
    : [];

  if (activeCategoryId) {
    const subs = getSubCategories(activeCategoryId);
    const showSubs = !activeSubCategoryId && subs.length > 0;

    return (
      <div className="space-y-3">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs">
          <button onClick={handleBack} className="flex items-center gap-0.5 text-primary hover:underline">
            <ArrowRight className="h-3 w-3" />
            رجوع
          </button>
          {breadcrumb.map((b, i) => (
            <span key={b.id} className="flex items-center gap-1">
              <ChevronLeft className="h-3 w-3 text-muted-foreground" />
              <span className={i === breadcrumb.length - 1 ? "font-medium" : "text-muted-foreground"}>
                {b.name}
              </span>
            </span>
          ))}
        </div>

        {/* Sub-categories if exist */}
        {showSubs && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {subs.map(sub => (
              <button
                key={sub.id}
                onClick={() => handleSubCategoryClick(sub, mainCategories.find(c => c.id === activeCategoryId)!)}
                className="shrink-0 px-3 py-1.5 rounded-full border text-xs font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
              >
                {sub.name_ar}
              </button>
            ))}
          </div>
        )}

        {/* Products */}
        {currentProducts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
              لا توجد منتجات في هذا القسم
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {currentProducts.map(p => (
              <CompactProductCard key={p.id} product={p} onView={() => onProductClick(p)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Root category display based on layout
  switch (layout) {
    case "grid_images":
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {mainCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat)}
              className="group relative aspect-square rounded-xl overflow-hidden border border-border/50 hover:border-primary/50 transition-all"
            >
              {cat.image_url ? (
                <img src={cat.image_url} alt={cat.name_ar} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                  <Package className="h-8 w-8 text-primary/30" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <span className="text-sm font-bold text-white">{cat.name_ar}</span>
                <span className="block text-[10px] text-white/70">{getProductsForCategory(cat.id).length} منتج</span>
              </div>
            </button>
          ))}
        </div>
      );

    case "strip":
      return (
        <div className="space-y-5">
          {mainCategories.map(cat => {
            const catProducts = getProductsForCategory(cat.id).slice(0, 6);
            return (
              <div key={cat.id}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold">{cat.name_ar}</h3>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => handleCategoryClick(cat)}>
                    عرض الكل
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                </div>
                {catProducts.length > 0 ? (
                  <div className="flex gap-2.5 overflow-x-auto pb-2">
                    {catProducts.map(p => (
                      <div key={p.id} className="shrink-0 w-36">
                        <CompactProductCard product={p} onView={() => onProductClick(p)} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">لا توجد منتجات</p>
                )}
              </div>
            );
          })}
        </div>
      );

    case "taobao":
      return (
        <div className="flex gap-3 min-h-[300px]">
          {/* Sidebar */}
          <div className="w-[28%] shrink-0 space-y-1 border-l border-border/50 pl-2">
            {mainCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat)}
                className={`w-full text-right px-2 py-2 rounded-lg text-xs font-medium transition-all hover:bg-primary/10 hover:text-primary ${
                  activeCategoryId === cat.id ? "bg-primary/15 text-primary" : "text-foreground"
                }`}
              >
                {cat.name_ar}
                <span className="block text-[10px] text-muted-foreground mt-0.5">
                  {getProductsForCategory(cat.id).length} منتج
                </span>
              </button>
            ))}
          </div>
          {/* Products area */}
          <div className="flex-1">
            <p className="text-xs text-muted-foreground text-center py-8">
              اختر قسماً لعرض المنتجات
            </p>
          </div>
        </div>
      );

    // Standard layout (default)
    default:
      return (
        <div className="space-y-4">
          {mainCategories.map(cat => {
            const subs = getSubCategories(cat.id);
            return (
              <div key={cat.id}>
                <button
                  onClick={() => handleCategoryClick(cat)}
                  className="flex items-center gap-2 mb-2 hover:text-primary transition-colors"
                >
                  <h3 className="text-sm font-bold">{cat.name_ar}</h3>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {subs.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 mr-2">
                    {subs.map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => {
                          handleSubCategoryClick(sub, cat);
                          setActiveCategoryId(cat.id);
                        }}
                        className="shrink-0 px-3 py-1 rounded-full border text-[11px] hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
                      >
                        {sub.name_ar}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
  }
}
