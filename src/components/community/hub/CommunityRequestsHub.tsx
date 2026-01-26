import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Clock, Package, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAutoFetchUntil } from "@/components/community/hub/useAutoFetchUntil";
import { RequestSortKey } from "./CommunitySortSelect";

type Props = {
  mode: "preview" | "hub";
  searchQuery?: string;
  sortKey?: RequestSortKey;
  isMerchant?: boolean;
};

type RequestRow = {
  id: string;
  title: string | null;
  description: string | null;
  size_spec: string | null;
  colors_spec: string | null;
  status: string;
  user_id: string;
  created_at: string;
  offers_count: number;
};

export default function CommunityRequestsHub({
  mode,
  searchQuery = "",
  sortKey = "newest",
  isMerchant = false,
}: Props) {
  const navigate = useNavigate();
  const chunkSize = mode === "hub" ? 6 : 8;
  const initialTarget = mode === "hub" ? 30 : 8;
  const [targetCount, setTargetCount] = useState(initialTarget);

  const query = useInfiniteQuery({
    queryKey: ["community-requests", { mode, sortKey }],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = Number(pageParam);
      const to = from + chunkSize - 1;

      let q = supabase
        .from("print_requests")
        .select("id, title, description, size_spec, colors_spec, status, user_id, created_at")
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      const { data, error } = await q.range(from, to);
      if (error) throw error;

      // Fetch offers count for each request
      const requestIds = (data || []).map((r) => r.id);
      let offersMap = new Map<string, number>();

      if (requestIds.length > 0) {
        const { data: offers } = await supabase
          .from("print_offers")
          .select("request_id")
          .in("request_id", requestIds);

        for (const offer of offers || []) {
          offersMap.set(offer.request_id, (offersMap.get(offer.request_id) || 0) + 1);
        }
      }

      return (data || []).map((r) => ({
        ...r,
        offers_count: offersMap.get(r.id) || 0,
      })) as RequestRow[];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < chunkSize) return undefined;
      return allPages.reduce((acc, p) => acc + p.length, 0);
    },
    staleTime: mode === "hub" ? 60_000 : 5 * 60_000,
  });

  const loaded = useMemo(() => (query.data?.pages || []).flat(), [query.data]);

  // Filter and sort client-side
  const items = useMemo(() => {
    let filtered = [...loaded];

    // Search filter
    if (searchQuery.trim()) {
      const qLower = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.title?.toLowerCase().includes(qLower) ||
          r.description?.toLowerCase().includes(qLower)
      );
    }

    // Sort filter
    if (sortKey === "not_priced" && isMerchant) {
      filtered = filtered.filter((r) => r.offers_count === 0);
    } else if (sortKey === "resin") {
      filtered = filtered.filter((r) => 
        r.description?.toLowerCase().includes("resin") ||
        r.description?.toLowerCase().includes("رزن")
      );
    } else if (sortKey === "filament") {
      filtered = filtered.filter((r) => 
        r.description?.toLowerCase().includes("filament") ||
        r.description?.toLowerCase().includes("فلمنت")
      );
    }

    if (mode === "preview") {
      return filtered.slice(0, 6);
    }

    return filtered;
  }, [loaded, searchQuery, sortKey, isMerchant, mode]);

  useAutoFetchUntil({
    count: loaded.length,
    target: targetCount,
    hasNextPage: !!query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => query.fetchNextPage(),
    delayMs: 120,
  });

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Array.from({ length: mode === "hub" ? 6 : 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">
            {searchQuery ? "لا توجد طلبات مطابقة للبحث." : "لا توجد طلبات متاحة حالياً."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {items.map((r) => (
          <RequestCard key={r.id} request={r} onClick={() => navigate(`/community/request/${r.id}`)} />
        ))}
      </div>

      {mode === "hub" && (
        <div className="flex items-center justify-center">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            disabled={query.isFetchingNextPage || !query.hasNextPage}
            onClick={() => setTargetCount((c) => c + 20)}
          >
            {query.hasNextPage ? "إظهار المزيد" : "لا يوجد المزيد"}
          </Button>
        </div>
      )}
    </div>
  );
}

function RequestCard({
  request,
  onClick,
}: {
  request: RequestRow;
  onClick: () => void;
}) {
  return (
    <div
      className="group relative rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden cursor-pointer hover:border-primary/30 transition-all duration-200 hover:shadow-md"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      {/* Header */}
      <div className="relative p-2.5 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold line-clamp-1 text-foreground flex-1">
            {request.title || "طلب جديد"}
          </p>
          {/* Offers count */}
          <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-md px-1.5 py-0.5 shrink-0">
            <User className="h-2.5 w-2.5 text-primary" />
            <span className="text-[9px] font-bold">{request.offers_count}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-2.5 pb-2.5">
        {request.description && (
          <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
            {request.description}
          </p>
        )}
        
        <div className="flex items-center justify-between mt-2">
          {request.size_spec && (
            <Badge
              variant="secondary"
              className="text-[8px] h-4 px-1.5 bg-muted/50"
            >
              {request.size_spec}
            </Badge>
          )}
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-2.5 w-2.5" />
            <span className="text-[8px]">
              {new Date(request.created_at).toLocaleDateString("ar-IQ")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
