import { useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAutoFetchUntil } from "@/components/community/hub/useAutoFetchUntil";
import MerchantDirectoryCard from "@/components/community/MerchantDirectoryCard";
import { useAuth } from "@/hooks/useAuth";
import { ADMIN_ROUTES } from "@/config/adminConfig";
import { BadgeTier } from "@/components/community/MerchantBadges";
import { MerchantSortKey } from "./CommunitySortSelect";

type Props = {
  mode: "preview" | "hub";
  onOpenStore: (merchantId: string) => void;
  searchQuery?: string;
  sortKey?: MerchantSortKey;
};

type MerchantRow = {
  id: string;
  display_name: string;
  store_image_url: string | null;
  is_verified: boolean;
  badge_tier: string;
  selected_frame_id: string | null;
  bio: string | null;
};

type FeaturedProductRow = {
  id: string;
  merchant_id: string;
  title: string;
  image_urls: string[] | null;
  primary_image_index: number;
};

export default function CommunityMerchantsHub({ mode, onOpenStore, searchQuery = "", sortKey = "newest" }: Props) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
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
        .select("id, display_name, store_image_url, is_verified, badge_tier, selected_frame_id, bio")
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
  const frameIds = useMemo(() => 
    loaded.map((m) => m.selected_frame_id).filter(Boolean) as string[], 
    [loaded]
  );

  // Fetch frames for merchants
  const { data: framesData = [] } = useQuery({
    queryKey: ["avatar-frames-batch", frameIds],
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

  const frameUrlsMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of framesData) {
      map.set(f.id, f.image_url);
    }
    return map;
  }, [framesData]);

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

  // Filter and sort items
  const items = useMemo(() => {
    let filtered = [...loaded];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.display_name.toLowerCase().includes(q) ||
          m.bio?.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sortKey) {
      case "verified":
        filtered = filtered.filter((m) => m.is_verified);
        break;
      case "filament_specialist":
        filtered = filtered.filter((m) =>
          m.bio?.toLowerCase().includes("filament") ||
          m.bio?.includes("فلمنت")
        );
        break;
      case "resin_specialist":
        filtered = filtered.filter((m) =>
          m.bio?.toLowerCase().includes("resin") ||
          m.bio?.includes("رزن")
        );
        break;
      // newest keeps default order
    }

    if (mode === "preview") {
      const shuffled = [...filtered];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled.slice(0, 10);
    }

    return filtered;
  }, [loaded, mode, searchQuery, sortKey]);

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
      <div className="space-y-2">
        {Array.from({ length: mode === "hub" ? 6 : 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">
            {searchQuery ? "لا توجد متاجر مطابقة للبحث." : "لا توجد متاجر متاحة حالياً."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {items.map((m) => (
          <MerchantDirectoryCard
            key={m.id}
            id={m.id}
            displayName={m.display_name}
            storeImageUrl={m.store_image_url}
            storeFrameUrl={m.selected_frame_id ? frameUrlsMap.get(m.selected_frame_id) : null}
            isVerified={m.is_verified}
            badgeTier={(m.badge_tier || "none") as BadgeTier}
            stats={ratingsByMerchant.get(m.id) || null}
            featuredProducts={productsByMerchant.get(m.id) || []}
            onOpenStore={() => onOpenStore(m.id)}
            isAdmin={isAdmin}
            onAdminManage={() => navigate(ADMIN_ROUTES.communityMerchants)}
          />
        ))}
      </div>

      {mode === "hub" && (
        <div className="flex items-center justify-center pt-1">
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
    </div>
  );
}
