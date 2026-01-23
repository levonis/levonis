import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Boxes, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAutoFetchUntil } from "@/components/community/hub/useAutoFetchUntil";

type Props = {
  mode: "preview" | "hub";
  onOpenStore: (merchantId: string) => void;
};

type MerchantRow = {
  id: string;
  display_name: string;
  store_image_url: string | null;
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
      {items.map((m) => (
        <Card
          key={m.id}
          className="border-border bg-card cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => onOpenStore(m.id)}
        >
          <CardHeader className="py-4">
            <div className="flex items-center gap-3">
              {m.store_image_url ? (
                <img
                  src={m.store_image_url}
                  alt={m.display_name}
                  loading="lazy"
                  className="w-12 h-12 rounded-xl object-cover border border-border"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-muted/20 flex items-center justify-center">
                  <Store className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-primary" />
                  {m.display_name}
                </CardTitle>
                <CardDescription className="text-xs">عرض المتجر</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}

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
