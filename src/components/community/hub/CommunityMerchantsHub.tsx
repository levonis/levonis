import { useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAutoFetchUntil } from "@/components/community/hub/useAutoFetchUntil";
import MerchantDirectoryCard from "@/components/community/MerchantDirectoryCard";

type Props = {
  mode: "preview" | "hub";
  onOpenStore: (merchantId: string) => void;
};

type MerchantRow = {
  id: string;
  display_name: string;
  store_image_url: string | null;
};

type FeaturedProductRow = {
  id: string;
  merchant_id: string;
  title: string;
  image_urls: string[] | null;
  primary_image_index: number;
};

export default function CommunityMerchantsHub({ mode, onOpenStore }: Props) {
  const chunkSize = mode === "hub" ? 5 : 10;
  const initialTarget = mode === "hub" ? 25 : 10;
  const [targetCount, setTargetCount] = useState(initialTarget);

  const query = useInfiniteQuery({
    queryKey: ["community-merchants", { mode }],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = Number(pageParam);
      const to = from + chunkSize - 1;
      const { data, error } = await supabase
        .from("merchant_public_profiles")
        .select("id, display_name, store_image_url")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return (data || []) as MerchantRow[];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < chunkSize) return undefined;
      return allPages.reduce((acc, p) => acc + p.length, 0);
    },
    staleTime: mode === "hub" ? 60_000 : 5 * 60_000,
  });

  const loaded = useMemo(() => (query.data?.pages || []).flat(), [query.data]);

  const merchantIds = useMemo(() => loaded.map((m) => m.id), [loaded]);

  const { data: featuredProducts = [] } = useQuery({
    queryKey: ["community-merchants-featured-products", merchantIds],
    enabled: merchantIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_products")
        .select("id, merchant_id, title, image_urls, primary_image_index")
        .in("merchant_id", merchantIds)
        .eq("is_featured", true)
        .eq("is_active", true);
      if (error) throw error;
      return (data || []) as FeaturedProductRow[];
    },
    staleTime: 60_000,
  });

  const productsByMerchant = useMemo(() => {
    const map = new Map<string, FeaturedProductRow[]>();
    for (const p of featuredProducts) {
      const list = map.get(p.merchant_id) || [];
      list.push(p);
      map.set(p.merchant_id, list);
    }
    return map;
  }, [featuredProducts]);

  const { data: ratingsStats = [] } = useQuery({
    queryKey: ["community-merchants-rating-stats", merchantIds],
    enabled: merchantIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_rating_stats")
        .select("merchant_id, total_ratings, average_rating")
        .in("merchant_id", merchantIds);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const ratingsByMerchant = useMemo(() => {
    return new Map((ratingsStats as any[]).map((r) => [r.merchant_id, r]));
  }, [ratingsStats]);

  const items = useMemo(() => {
    if (mode !== "preview") return loaded;
    const shuffled = [...loaded];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 10);
  }, [loaded, mode]);

  useAutoFetchUntil({
    count: loaded.length,
    target: targetCount,
    hasNextPage: !!query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => query.fetchNextPage(),
    delayMs: 140,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: mode === "hub" ? 6 : 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">لا توجد متاجر متاحة حالياً.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((m) => (
          <MerchantDirectoryCard
            key={m.id}
            id={m.id}
            displayName={m.display_name}
            storeImageUrl={m.store_image_url}
            stats={ratingsByMerchant.get(m.id) || null}
            featuredProducts={productsByMerchant.get(m.id) || []}
            onOpenStore={() => onOpenStore(m.id)}
          />
        ))}
      </div>

      {mode === "hub" && (
        <div className="flex items-center justify-center pt-2">
          <Button
            variant="outline"
            className="h-10"
            disabled={query.isFetchingNextPage || !query.hasNextPage}
            onClick={() => setTargetCount((c) => c + 25)}
          >
            {query.hasNextPage ? "إظهار المزيد (+25)" : "لا يوجد المزيد"}
          </Button>
        </div>
      )}
    </div>
  );
}
