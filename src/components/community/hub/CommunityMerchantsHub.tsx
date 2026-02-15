import { useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useAutoFetchUntil } from "@/components/community/hub/useAutoFetchUntil";
import { useInfiniteScrollSentinel } from "@/components/community/hub/useInfiniteScrollSentinel";
import MerchantDirectoryCard from "@/components/community/MerchantDirectoryCard";
import { useAuth } from "@/hooks/useAuth";
import { ADMIN_ROUTES } from "@/config/adminConfig";
import { BadgeTier } from "@/components/community/MerchantBadges";

type Props = {
  mode: "preview" | "hub";
  onOpenStore: (merchantId: string) => void;
  searchQuery?: string;
  sortBy?: string;
};

type MerchantRow = {
  id: string;
  display_name: string;
  store_image_url: string | null;
  is_verified: boolean;
  badge_tier: string;
  selected_frame_id: string | null;
};

type FeaturedProductRow = {
  id: string;
  merchant_id: string;
  title: string;
  image_urls: string[] | null;
  primary_image_index: number;
};

export default function CommunityMerchantsHub({ mode, onOpenStore, searchQuery = "", sortBy = "newest" }: Props) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const chunkSize = mode === "hub" ? 5 : 10;
  const initialTarget = mode === "hub" ? 25 : 10;
  const [targetCount, setTargetCount] = useState(initialTarget);
  const [localSearch, setLocalSearch] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);

  const query = useInfiniteQuery({
    queryKey: ["community-merchants", { mode, sortBy }],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = Number(pageParam);
      const to = from + chunkSize - 1;
      
      let q = supabase
        .from("merchant_public_profiles")
        .select("id, display_name, store_image_url, is_verified, badge_tier, selected_frame_id");

      // Apply sorting
      if (sortBy === "newest") {
        q = q.order("created_at", { ascending: false });
      } else if (sortBy === "verified") {
        q = q.eq("is_verified", true).order("created_at", { ascending: false });
      } else {
        q = q.order("created_at", { ascending: false });
      }

      const { data, error } = await q.range(from, to);

      if (error) throw error;
      return (data || []) as MerchantRow[];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < chunkSize) return undefined;
      return allPages.reduce((acc, p) => acc + p.length, 0);
    },
    staleTime: mode === "hub" ? 60_000 : 5 * 60_000,
  });

  const loaded = useMemo(() => {
    const seen = new Set<string>();
    return (query.data?.pages || []).flat().filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [query.data]);

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

  // Filter by search and apply mode-specific logic
  const items = useMemo(() => {
    let filtered = loaded;
    
    // Apply search filter (global + local)
    const combinedSearch = (searchQuery || localSearch).trim().toLowerCase();
    if (combinedSearch) {
      filtered = filtered.filter((m) => m.display_name.toLowerCase().includes(combinedSearch));
    }

    if (mode !== "preview") return filtered;
    
    const shuffled = [...filtered];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 10);
  }, [loaded, mode, searchQuery, localSearch]);

  useAutoFetchUntil({
    count: loaded.length,
    target: targetCount,
    hasNextPage: !!query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => query.fetchNextPage(),
    delayMs: 140,
  });

  // Infinite scroll sentinel for hub mode
  useInfiniteScrollSentinel({
    enabled: mode === "hub" && !!query.hasNextPage && !query.isFetchingNextPage,
    sentinelRef: sentinelRef as React.RefObject<HTMLElement>,
    onIntersect: () => setTargetCount((c) => c + 25),
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
      {/* Local search for merchants */}
      {mode === "hub" && (
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="ابحث عن تاجر..."
            className="pr-9 h-9 text-xs rounded-xl"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
    </div>
  );
}
