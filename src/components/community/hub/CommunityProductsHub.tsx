import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAutoFetchUntil } from "@/components/community/hub/useAutoFetchUntil";
import CommunityProductCard from "@/components/community/CommunityProductCard";

type Props = {
  mode: "preview" | "hub";
  onOpenStore: (merchantId: string) => void;
};

type ProductRow = {
  id: string;
  title: string;
  price_iqd: number | null;
  image_urls: string[] | null;
  primary_image_index: number;
  merchant_id: string;
};

function pickMainImage(p: ProductRow) {
  return p.image_urls?.[p.primary_image_index] || p.image_urls?.[0] || null;
}

export default function CommunityProductsHub({ mode, onOpenStore }: Props) {
  const chunkSize = mode === "hub" ? 4 : 12;
  const initialTarget = mode === "hub" ? 50 : 6;
  const [targetCount, setTargetCount] = useState(initialTarget);

  const query = useInfiniteQuery({
    queryKey: ["community-products", { mode }],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = Number(pageParam);
      const to = from + chunkSize - 1;

      const { data, error } = await supabase
        .from("merchant_products")
        .select("id, title, price_iqd, image_urls, primary_image_index, merchant_id")
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

  const items = useMemo(() => {
    const flat = (query.data?.pages || []).flat();
    if (mode !== "preview") return flat;

    // Preview mode: pick a pseudo-random sample from what we loaded (no heavy random SQL)
    const shuffled = [...flat];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 6);
  }, [query.data, mode]);

  useAutoFetchUntil({
    count: (query.data?.pages || []).flat().length,
    target: targetCount,
    hasNextPage: !!query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => query.fetchNextPage(),
    delayMs: 120,
  });

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
          return (
            <CommunityProductCard
              key={p.id}
              title={p.title}
              priceIqd={p.price_iqd}
              imageUrl={mainImg}
              onOpenStore={() => onOpenStore(p.merchant_id)}
            />
          );
        })}
      </div>

      {mode === "hub" && (
        <div className="flex items-center justify-center">
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
