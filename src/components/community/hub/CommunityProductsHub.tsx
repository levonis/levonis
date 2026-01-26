import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAutoFetchUntil } from "@/components/community/hub/useAutoFetchUntil";
import CommunityProductCard from "@/components/community/CommunityProductCard";
import CommunityProductDetailModal from "@/components/community/CommunityProductDetailModal";
import { ProductSortKey } from "./CommunitySortSelect";

type Props = {
  mode: "preview" | "hub";
  onOpenStore: (merchantId: string) => void;
  searchQuery?: string;
  sortKey?: ProductSortKey;
};

type ProductRow = {
  id: string;
  title: string;
  description: string | null;
  price_iqd: number | null;
  original_price_iqd: number | null;
  image_urls: string[] | null;
  video_url: string | null;
  primary_image_index: number;
  estimated_days: number | null;
  merchant_id: string;
};

function pickMainImage(p: ProductRow) {
  return p.image_urls?.[p.primary_image_index] || p.image_urls?.[0] || null;
}

export default function CommunityProductsHub({ mode, onOpenStore, searchQuery = "", sortKey = "newest" }: Props) {
  const navigate = useNavigate();
  const chunkSize = mode === "hub" ? 4 : 12;
  const initialTarget = mode === "hub" ? 50 : 6;
  const [targetCount, setTargetCount] = useState(initialTarget);
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const query = useInfiniteQuery({
    queryKey: ["community-products", { mode }],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = Number(pageParam);
      const to = from + chunkSize - 1;

      const { data, error } = await supabase
        .from("merchant_products")
        .select("id, title, description, price_iqd, original_price_iqd, image_urls, video_url, primary_image_index, estimated_days, merchant_id")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return (data || []) as ProductRow[];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < chunkSize) return undefined;
      return allPages.reduce((acc, p) => acc + p.length, 0);
    },
    staleTime: mode === "hub" ? 60_000 : 5 * 60_000,
  });

  const loaded = useMemo(() => (query.data?.pages || []).flat(), [query.data]);
  const merchantIds = useMemo(() => [...new Set(loaded.map(p => p.merchant_id))], [loaded]);

  // Fetch merchant profiles with frames
  const { data: merchantProfiles = [] } = useQuery({
    queryKey: ["products-merchants", merchantIds],
    enabled: merchantIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_public_profiles")
        .select("id, display_name, store_image_url, selected_frame_id")
        .in("id", merchantIds);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  // Fetch frames
  const frameIds = useMemo(() => 
    merchantProfiles.map(m => m.selected_frame_id).filter(Boolean) as string[],
    [merchantProfiles]
  );

  const { data: framesData = [] } = useQuery({
    queryKey: ["products-frames", frameIds],
    enabled: frameIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avatar_frames")
        .select("id, image_url")
        .in("id", frameIds);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60_000,
  });

  const merchantsMap = useMemo(() => {
    const map = new Map<string, { name: string; imageUrl: string | null; frameUrl: string | null }>();
    const framesMap = new Map(framesData.map(f => [f.id, f.image_url]));
    
    for (const m of merchantProfiles) {
      map.set(m.id, {
        name: m.display_name,
        imageUrl: m.store_image_url,
        frameUrl: m.selected_frame_id ? framesMap.get(m.selected_frame_id) || null : null,
      });
    }
    return map;
  }, [merchantProfiles, framesData]);

  // Filter and sort items
  const items = useMemo(() => {
    let filtered = [...loaded];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sortKey) {
      case "price_low":
        filtered.sort((a, b) => (a.price_iqd || 0) - (b.price_iqd || 0));
        break;
      case "price_high":
        filtered.sort((a, b) => (b.price_iqd || 0) - (a.price_iqd || 0));
        break;
      case "alpha_asc":
        filtered.sort((a, b) => a.title.localeCompare(b.title, "ar"));
        break;
      case "alpha_desc":
        filtered.sort((a, b) => b.title.localeCompare(a.title, "ar"));
        break;
      case "resin":
        filtered = filtered.filter((p) =>
          p.title.toLowerCase().includes("resin") ||
          p.title.includes("رزن") ||
          p.description?.toLowerCase().includes("resin") ||
          p.description?.includes("رزن")
        );
        break;
      case "filament":
        filtered = filtered.filter((p) =>
          p.title.toLowerCase().includes("filament") ||
          p.title.includes("فلمنت") ||
          p.description?.toLowerCase().includes("filament") ||
          p.description?.includes("فلمنت")
        );
        break;
      // newest and best_selling keep default order
    }

    if (mode === "preview") {
      // Preview mode: pick a pseudo-random sample from what we loaded
      const shuffled = [...filtered];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled.slice(0, 6);
    }
    
    return filtered;
  }, [loaded, mode, searchQuery, sortKey]);

  useAutoFetchUntil({
    count: (query.data?.pages || []).flat().length,
    target: targetCount,
    hasNextPage: !!query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => query.fetchNextPage(),
    delayMs: 120,
  });

  const handleProductClick = (product: ProductRow) => {
    setSelectedProduct(product);
    setDetailOpen(true);
  };

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {Array.from({ length: mode === "hub" ? 8 : 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 sm:h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">
            {searchQuery ? "لا توجد منتجات مطابقة للبحث." : "لا توجد منتجات متاحة حالياً."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {items.map((p) => {
          const mainImg = pickMainImage(p);
          const merchant = merchantsMap.get(p.merchant_id);
          return (
            <CommunityProductCard
              key={p.id}
              title={p.title}
              priceIqd={p.price_iqd}
              imageUrl={mainImg}
              merchantName={merchant?.name}
              merchantImageUrl={merchant?.imageUrl}
              merchantFrameUrl={merchant?.frameUrl}
              onOpenStore={() => onOpenStore(p.merchant_id)}
              onProductClick={() => handleProductClick(p)}
            />
          );
        })}
      </div>

      {mode === "hub" && (
        <div className="flex items-center justify-center">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            disabled={query.isFetchingNextPage || !query.hasNextPage}
            onClick={() => setTargetCount((c) => c + 25)}
          >
            {query.hasNextPage ? "إظهار المزيد" : "لا يوجد المزيد"}
          </Button>
        </div>
      )}

      {/* Product Detail Modal */}
      <CommunityProductDetailModal
        product={selectedProduct}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
