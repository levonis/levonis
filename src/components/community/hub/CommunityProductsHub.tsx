import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { useAutoFetchUntil } from "@/components/community/hub/useAutoFetchUntil";
import { useInfiniteScrollSentinel } from "@/components/community/hub/useInfiniteScrollSentinel";
import CommunityProductCard from "@/components/community/CommunityProductCard";
import CommunityProductDetailModal from "@/components/community/CommunityProductDetailModal";
import AddToCartSheet from "@/components/community/AddToCartSheet";

type Props = {
  mode: "preview" | "hub";
  onOpenStore: (merchantId: string) => void;
  searchQuery?: string;
  sortBy?: string;
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

export default function CommunityProductsHub({ mode, onOpenStore, searchQuery = "", sortBy = "newest" }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const chunkSize = mode === "hub" ? 4 : 12;
  const initialTarget = mode === "hub" ? 50 : 6;
  const [targetCount, setTargetCount] = useState(initialTarget);
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [cartSheetProduct, setCartSheetProduct] = useState<ProductRow | null>(null);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const query = useInfiniteQuery({
    queryKey: ["community-products", { mode, sortBy }],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = Number(pageParam);
      const to = from + chunkSize - 1;

      let q = supabase
        .from("merchant_products")
        .select("id, title, description, price_iqd, original_price_iqd, image_urls, video_url, primary_image_index, estimated_days, merchant_id")
        .eq("is_active", true);

      // Apply sorting
      if (sortBy === "newest") {
        q = q.order("created_at", { ascending: false });
      } else if (sortBy === "price_low") {
        q = q.order("price_iqd", { ascending: true, nullsFirst: false });
      } else if (sortBy === "price_high") {
        q = q.order("price_iqd", { ascending: false });
      } else if (sortBy === "alpha_asc") {
        q = q.order("title", { ascending: true });
      } else if (sortBy === "alpha_desc") {
        q = q.order("title", { ascending: false });
      } else {
        q = q.order("created_at", { ascending: false });
      }

      const { data, error } = await q.range(from, to);

      if (error) throw error;
      return (data || []) as ProductRow[];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < chunkSize) return undefined;
      return allPages.reduce((acc, p) => acc + p.length, 0);
    },
    staleTime: mode === "hub" ? 60_000 : 5 * 60_000,
  });

  const loaded = useMemo(() => {
    const seen = new Set<string>();
    return (query.data?.pages || []).flat().filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [query.data]);
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

  // Filter by search and apply weighted randomization (Instagram-like algorithm)
  const items = useMemo(() => {
    let filtered = loaded;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((p) => p.title.toLowerCase().includes(q));
    }

    // Apply category filter (resin/filament from sort)
    if (sortBy === "resin" || sortBy === "filament") {
      const keyword = sortBy === "resin" ? "رزن" : "فلمنت";
      filtered = filtered.filter((p) => p.title.toLowerCase().includes(keyword.toLowerCase()));
    }

    // Use seeded shuffle for consistent randomization that changes periodically
    const seed = Math.floor(Date.now() / (1000 * 60 * 30)); // Changes every 30 min
    const seededRandom = (i: number) => {
      const x = Math.sin(seed + i * 7 + 3) * 10000;
      return x - Math.floor(x);
    };
    
    // Diversify by merchant - spread products from same merchant
    const byMerchant = new Map<string, ProductRow[]>();
    for (const p of filtered) {
      const list = byMerchant.get(p.merchant_id) || [];
      list.push(p);
      byMerchant.set(p.merchant_id, list);
    }
    
    // Round-robin interleave from different merchants, then shuffle within rounds
    const interleaved: ProductRow[] = [];
    const merchantQueues = [...byMerchant.values()];
    let round = 0;
    while (interleaved.length < filtered.length) {
      const roundItems: ProductRow[] = [];
      for (const queue of merchantQueues) {
        if (round < queue.length) roundItems.push(queue[round]);
      }
      // Shuffle within the round
      for (let i = roundItems.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom(interleaved.length + i) * (i + 1));
        [roundItems[i], roundItems[j]] = [roundItems[j], roundItems[i]];
      }
      interleaved.push(...roundItems);
      round++;
    }

    if (mode !== "preview") return interleaved;
    return interleaved.slice(0, 6);
  }, [loaded, mode, searchQuery, sortBy]);

  useAutoFetchUntil({
    count: (query.data?.pages || []).flat().length,
    target: targetCount,
    hasNextPage: !!query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => query.fetchNextPage(),
    delayMs: 120,
  });

  // Infinite scroll sentinel for hub mode
  useInfiniteScrollSentinel({
    enabled: mode === "hub" && !!query.hasNextPage && !query.isFetchingNextPage,
    sentinelRef: sentinelRef as React.RefObject<HTMLElement>,
    onIntersect: () => setTargetCount((c) => c + 25),
  });

  const handleProductClick = (product: ProductRow) => {
    setSelectedProduct(product);
    setDetailOpen(true);
  };

  const handleAddToCart = (p: ProductRow) => {
    if (!user) { navigate("/auth"); return; }
    setCartSheetProduct(p);
    setCartSheetOpen(true);
  };

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: mode === "hub" ? 8 : 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 sm:h-56 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">لا توجد منتجات متاحة حالياً.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
              onAddToCart={() => handleAddToCart(p)}
              onContact={() => {
                const params = new URLSearchParams({
                  merchant_id: p.merchant_id,
                  product_title: p.title,
                  ...(p.price_iqd ? { product_price: String(p.price_iqd) } : {}),
                  ...(mainImg ? { product_image: mainImg } : {}),
                });
                navigate(`/chats?${params.toString()}`);
              }}
            />
          );
        })}
      </div>

      {/* Infinite scroll sentinel */}
      {mode === "hub" && (
        <>
          <div ref={sentinelRef} className="h-1" />
          {query.isFetchingNextPage && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
          {!query.hasNextPage && items.length > 0 && (
            <p className="text-center text-xs text-muted-foreground py-3">لا يوجد المزيد</p>
          )}
        </>
      )}

      {/* Product Detail Modal */}
      <CommunityProductDetailModal
        product={selectedProduct}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      {/* Add to Cart Sheet */}
      <AddToCartSheet
        product={cartSheetProduct}
        open={cartSheetOpen}
        onOpenChange={setCartSheetOpen}
      />
    </div>
  );
}
