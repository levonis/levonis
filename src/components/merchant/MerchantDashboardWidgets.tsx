import { memo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp,
  Package,
  MessageCircle,
  Star,
  FileText,
  AlertCircle,
  CheckCircle,
  Truck,
  Clock,
  ChevronLeft,
  ArrowUpRight,
  ArrowDownRight,
  Settings2,
  PinIcon,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface MerchantDashboardWidgetsProps {
  merchantId: string;
}

type WidgetType = "financial" | "orders" | "conversations" | "ratings" | "requests";

const widgetConfig: Record<WidgetType, { label: string; icon: any; description: string }> = {
  financial: { label: "التقرير المالي", icon: TrendingUp, description: "تحليل الإيرادات والنمو" },
  orders: { label: "الطلبات", icon: Package, description: "حالة الطلبات والتتبع" },
  conversations: { label: "المحادثات", icon: MessageCircle, description: "الرسائل غير المقروءة" },
  ratings: { label: "التقييمات", icon: Star, description: "التقييمات الجديدة" },
  requests: { label: "طلبات جديدة", icon: FileText, description: "طلبات تحتاج عرض سعر" },
};

const STORAGE_KEY = "merchant-pinned-widget";

function MerchantDashboardWidgetsBase({ merchantId }: MerchantDashboardWidgetsProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pinnedWidget, setPinnedWidget] = useState<WidgetType | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved as WidgetType | null;
  });
  const [selectorOpen, setSelectorOpen] = useState(false);

  // Save pinned widget to localStorage
  useEffect(() => {
    if (pinnedWidget) {
      localStorage.setItem(STORAGE_KEY, pinnedWidget);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [pinnedWidget]);

  // Fetch financial summary
  const { data: financials, isLoading: financialsLoading } = useQuery({
    queryKey: ["merchant-financials", merchantId],
    queryFn: async () => {
      const now = new Date();
      const thisMonth = now.toISOString().slice(0, 7);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 7);

      const { data: offers, error } = await supabase
        .from("print_offers")
        .select("price_iqd, status, created_at")
        .eq("trader_id", merchantId);

      if (error) throw error;

      const thisMonthOffers = offers?.filter(o => o.created_at?.startsWith(thisMonth)) || [];
      const lastMonthOffers = offers?.filter(o => o.created_at?.startsWith(lastMonth)) || [];
      const twoMonthsAgoOffers = offers?.filter(o => o.created_at?.startsWith(twoMonthsAgo)) || [];
      
      const thisMonthRevenue = thisMonthOffers
        .filter(o => o.status === "completed")
        .reduce((sum, o) => sum + (o.price_iqd || 0), 0);
      
      const lastMonthRevenue = lastMonthOffers
        .filter(o => o.status === "completed")
        .reduce((sum, o) => sum + (o.price_iqd || 0), 0);

      const twoMonthsAgoRevenue = twoMonthsAgoOffers
        .filter(o => o.status === "completed")
        .reduce((sum, o) => sum + (o.price_iqd || 0), 0);

      const growth = lastMonthRevenue > 0 
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
        : 0;

      return {
        thisMonthRevenue,
        lastMonthRevenue,
        twoMonthsAgoRevenue,
        growth,
        monthlyData: [
          { month: "قبل شهرين", revenue: twoMonthsAgoRevenue },
          { month: "الشهر الماضي", revenue: lastMonthRevenue },
          { month: "هذا الشهر", revenue: thisMonthRevenue },
        ],
      };
    },
    staleTime: 30_000,
    enabled: pinnedWidget === "financial",
  });

  // Fetch orders summary
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["merchant-orders-summary", merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_offers")
        .select("id, status, price_iqd, created_at, request_id")
        .eq("trader_id", merchantId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const completed = data?.filter(o => o.status === "completed") || [];
      const accepted = data?.filter(o => o.status === "accepted") || [];
      const submitted = data?.filter(o => o.status === "submitted") || [];

      return { 
        completed: completed.length, 
        accepted: accepted.length, 
        submitted: submitted.length, 
        total: data?.length || 0,
        recentOrders: data?.slice(0, 5) || [],
      };
    },
    staleTime: 30_000,
    enabled: pinnedWidget === "orders",
  });

  // Fetch unread conversations
  const { data: conversations, isLoading: conversationsLoading } = useQuery({
    queryKey: ["merchant-unread-conversations", merchantId],
    queryFn: async () => {
      const { data: convs, error } = await supabase
        .from("listing_conversations")
        .select(`
          id,
          created_at,
          buyer_id,
          listing_messages(content, created_at, is_read, sender_id)
        `)
        .eq("seller_id", merchantId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      const allConvs = convs || [];
      const unread = allConvs.filter(c => {
        const messages = c.listing_messages || [];
        const lastMsg = messages.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        return lastMsg && !lastMsg.is_read && lastMsg.sender_id !== merchantId;
      });

      const buyerIds = allConvs.map(c => c.buyer_id);
      let buyerMap: Record<string, string> = {};
      
      if (buyerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, username")
          .in("id", buyerIds);
        
        profiles?.forEach(p => {
          buyerMap[p.id] = p.full_name || p.username || "زبون";
        });
      }

      return {
        unreadCount: unread.length,
        totalCount: allConvs.length,
        conversations: allConvs.slice(0, 3).map(c => {
          const messages = (c.listing_messages as any[]) || [];
          const lastMsg = messages.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];
          return {
            id: c.id,
            buyerName: buyerMap[c.buyer_id] || "زبون",
            lastMessage: lastMsg?.content?.slice(0, 50) || "",
            isUnread: lastMsg && !lastMsg.is_read && lastMsg.sender_id !== merchantId,
            time: lastMsg?.created_at,
          };
        }),
      };
    },
    staleTime: 30_000,
    enabled: pinnedWidget === "conversations",
  });

  // Fetch new ratings
  const { data: ratings, isLoading: ratingsLoading } = useQuery({
    queryKey: ["merchant-new-ratings", merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_ratings")
        .select("id, rating, review_text, created_at, customer_id")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const newRatings = data?.filter(r => new Date(r.created_at) > oneWeekAgo) || [];
      const avgRating = data && data.length > 0 
        ? data.reduce((sum, r) => sum + r.rating, 0) / data.length 
        : 0;

      const customerIds = data?.map(r => r.customer_id) || [];
      let customerMap: Record<string, string> = {};
      
      if (customerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, username")
          .in("id", customerIds);
        
        profiles?.forEach(p => {
          customerMap[p.id] = p.full_name || p.username || "زبون";
        });
      }

      return {
        newCount: newRatings.length,
        totalCount: data?.length || 0,
        avgRating,
        ratings: (data || []).slice(0, 3).map(r => ({
          ...r,
          customerName: customerMap[r.customer_id] || "زبون",
          isNew: new Date(r.created_at) > oneWeekAgo,
        })),
      };
    },
    staleTime: 30_000,
    enabled: pinnedWidget === "ratings",
  });

  // Fetch new requests without price
  const { data: newRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ["merchant-pending-requests", merchantId],
    queryFn: async () => {
      const { data: allRequests, error } = await supabase
        .from("print_requests")
        .select("id, title, created_at, user_id, description")
        .eq("status", "pending_review")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const requestIds = allRequests?.map(r => r.id) || [];
      let pendingRequests = allRequests || [];
      
      if (requestIds.length > 0) {
        const { data: offers } = await supabase
          .from("print_offers")
          .select("request_id")
          .eq("trader_id", merchantId)
          .in("request_id", requestIds);

        const offeredIds = new Set(offers?.map(o => o.request_id) || []);
        pendingRequests = allRequests?.filter(r => !offeredIds.has(r.id)) || [];
      }

      const userIds = pendingRequests.map(r => r.user_id);
      let userMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, username")
          .in("id", userIds);
        
        profiles?.forEach(p => {
          userMap[p.id] = p.full_name || p.username || "زبون";
        });
      }

      return {
        count: pendingRequests.length,
        requests: pendingRequests.slice(0, 3).map(r => ({
          ...r,
          userName: userMap[r.user_id] || "زبون",
        })),
      };
    },
    staleTime: 30_000,
    enabled: pinnedWidget === "requests",
  });

  // Realtime subscription for live updates
  useEffect(() => {
    if (!pinnedWidget) return;

    const channel = supabase
      .channel(`merchant-widget-${merchantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'print_offers', filter: `trader_id=eq.${merchantId}` },
        () => {
          if (pinnedWidget === "financial" || pinnedWidget === "orders") {
            queryClient.invalidateQueries({ queryKey: ["merchant-financials", merchantId] });
            queryClient.invalidateQueries({ queryKey: ["merchant-orders-summary", merchantId] });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'listing_messages' },
        () => {
          if (pinnedWidget === "conversations") {
            queryClient.invalidateQueries({ queryKey: ["merchant-unread-conversations", merchantId] });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'merchant_ratings', filter: `merchant_id=eq.${merchantId}` },
        () => {
          if (pinnedWidget === "ratings") {
            queryClient.invalidateQueries({ queryKey: ["merchant-new-ratings", merchantId] });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'print_requests' },
        () => {
          if (pinnedWidget === "requests") {
            queryClient.invalidateQueries({ queryKey: ["merchant-pending-requests", merchantId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchantId, pinnedWidget, queryClient]);

  const formatTime = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "الآن";
    if (hours < 24) return `منذ ${hours} س`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `منذ ${days} ي`;
    return date.toLocaleDateString("ar-IQ");
  }, []);

  const handlePinWidget = (widget: WidgetType) => {
    setPinnedWidget(widget);
    setSelectorOpen(false);
  };

  const handleUnpinWidget = () => {
    setPinnedWidget(null);
  };

  const isLoading = 
    (pinnedWidget === "financial" && financialsLoading) ||
    (pinnedWidget === "orders" && ordersLoading) ||
    (pinnedWidget === "conversations" && conversationsLoading) ||
    (pinnedWidget === "ratings" && ratingsLoading) ||
    (pinnedWidget === "requests" && requestsLoading);

  const maxRevenue = Math.max(
    financials?.thisMonthRevenue || 0,
    financials?.lastMonthRevenue || 0,
    financials?.twoMonthsAgoRevenue || 0,
    1
  );

  // Render widget selector - compact professional design
  const renderWidgetSelector = () => (
    <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 h-10 w-full border border-primary/40 bg-gradient-to-b from-background to-muted/30 hover:border-primary/60 hover:bg-muted/20 text-sm"
        >
          <PinIcon className="h-4 w-4 text-primary" />
          <span className="font-semibold">تثبيت نافذة</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[280px] p-0 gap-0 rounded-lg overflow-hidden bg-gradient-to-b from-card to-background border-primary/20">
        <DialogHeader className="px-3 py-2.5 border-b border-border/50 bg-muted/30">
          <DialogTitle className="text-xs font-semibold text-center">اختر النافذة</DialogTitle>
        </DialogHeader>
        <div className="p-2 space-y-1">
          {(Object.keys(widgetConfig) as WidgetType[]).map((key) => {
            const config = widgetConfig[key];
            const Icon = config.icon;
            const isPinned = pinnedWidget === key;
            return (
              <button
                key={key}
                onClick={() => handlePinWidget(key)}
                className={`flex items-center gap-2 w-full p-2 rounded-md border transition-all text-right ${
                  isPinned 
                    ? "border-primary/50 bg-primary/10" 
                    : "border-transparent hover:border-border/60 hover:bg-muted/40"
                }`}
              >
                <div className={`h-7 w-7 rounded-md shrink-0 flex items-center justify-center ${
                  isPinned ? "bg-primary/20" : "bg-muted/50"
                }`}>
                  <Icon className={`h-3.5 w-3.5 ${isPinned ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{config.label}</div>
                  <div className="text-[9px] text-muted-foreground truncate">{config.description}</div>
                </div>
                {isPinned && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );

  // If no widget pinned, show selector
  if (!pinnedWidget) {
    return (
      <div className="space-y-4">
        <div className="text-center text-sm text-muted-foreground mb-2">
          لوحة تحكم التاجر
        </div>
        {renderWidgetSelector()}
      </div>
    );
  }

  const activeConfig = widgetConfig[pinnedWidget];
  const ActiveIcon = activeConfig.icon;

  if (isLoading) {
    return (
      <Card className="border-2 border-dashed">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40" />
        </CardContent>
      </Card>
    );
  }

  const renderWidgetContent = () => {
    switch (pinnedWidget) {
      case "financial":
        return (
          <div className="space-y-2">
            {/* Compact financial stats */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-2 rounded-md bg-primary/10 border border-primary/20">
                <div className="text-[9px] text-muted-foreground">هذا الشهر</div>
                <div className="text-sm font-bold text-primary tabular-nums">
                  {(financials?.thisMonthRevenue || 0).toLocaleString()}
                  <span className="text-[9px] font-normal mr-0.5">د.ع</span>
                </div>
              </div>
              <div className="p-2 rounded-md bg-muted/30 border border-border/30">
                <div className="text-[9px] text-muted-foreground">الشهر الماضي</div>
                <div className="text-sm font-bold tabular-nums">
                  {(financials?.lastMonthRevenue || 0).toLocaleString()}
                  <span className="text-[9px] font-normal mr-0.5">د.ع</span>
                </div>
              </div>
            </div>

            {/* Growth indicator */}
            <div className="flex items-center gap-2 p-1.5 rounded-md bg-muted/20">
              <div className={`h-5 w-5 rounded flex items-center justify-center ${
                (financials?.growth || 0) >= 0 ? "bg-primary/15" : "bg-destructive/15"
              }`}>
                {(financials?.growth || 0) >= 0 ? (
                  <ArrowUpRight className="h-3 w-3 text-primary" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-destructive" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold">
                  {(financials?.growth || 0) >= 0 ? "+" : ""}{financials?.growth?.toFixed(1) || 0}%
                </span>
                <span className="text-[9px] text-muted-foreground">نسبة النمو</span>
              </div>
            </div>

            {/* Monthly progress bars */}
            <div className="space-y-1">
              {financials?.monthlyData?.map((m, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-muted-foreground">{m.month}</span>
                    <span className="font-medium tabular-nums">{m.revenue.toLocaleString()}</span>
                  </div>
                  <Progress value={(m.revenue / maxRevenue) * 100} className="h-1" />
                </div>
              ))}
            </div>
          </div>
        );

      case "orders":
        return (
          <div className="space-y-2">
            {/* Compact order stats */}
            <div className="grid grid-cols-3 gap-1">
              <div className="text-center p-1.5 rounded-md bg-primary/10 border border-primary/20">
                <CheckCircle className="h-3 w-3 mx-auto text-primary mb-0.5" />
                <div className="text-sm font-bold tabular-nums">{orders?.completed || 0}</div>
                <div className="text-[8px] text-muted-foreground">مكتمل</div>
              </div>
              <div className="text-center p-1.5 rounded-md bg-muted/40 border border-border/30">
                <Truck className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
                <div className="text-sm font-bold tabular-nums">{orders?.accepted || 0}</div>
                <div className="text-[8px] text-muted-foreground">تنفيذ</div>
              </div>
              <div className="text-center p-1.5 rounded-md bg-muted/40 border border-border/30">
                <Clock className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
                <div className="text-sm font-bold tabular-nums">{orders?.submitted || 0}</div>
                <div className="text-[8px] text-muted-foreground">معلق</div>
              </div>
            </div>

            {/* Recent orders list */}
            <div className="space-y-1">
              {orders?.recentOrders && orders.recentOrders.length > 0 ? (
                orders.recentOrders.slice(0, 3).map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between p-1.5 rounded-md bg-muted/20 border border-border/20">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={
                        o.status === "completed" ? "secondary" : 
                        o.status === "accepted" ? "outline" : "destructive"
                      } className="text-[8px] px-1.5 py-0">
                        {o.status === "completed" ? "مكتمل" : o.status === "accepted" ? "نشط" : "معلق"}
                      </Badge>
                      <span className="text-[10px] font-semibold tabular-nums">{(o.price_iqd || 0).toLocaleString()}</span>
                    </div>
                    <span className="text-[8px] text-muted-foreground">{formatTime(o.created_at)}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-2 text-muted-foreground text-[10px]">لا توجد طلبات</div>
              )}
            </div>
          </div>
        );

      case "conversations":
        return (
          <div className="space-y-2">
            {/* Compact conversation summary */}
            <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border border-primary/20">
              <div className="h-7 w-7 rounded-md bg-primary/20 flex items-center justify-center">
                <MessageCircle className={`h-3.5 w-3.5 text-primary ${(conversations?.unreadCount || 0) > 0 ? "animate-pulse" : ""}`} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-primary">{conversations?.unreadCount || 0}</div>
                <div className="text-[9px] text-muted-foreground">غير مقروءة من {conversations?.totalCount || 0}</div>
              </div>
            </div>

            {/* Conversation list */}
            <div className="space-y-1">
              {conversations?.conversations && conversations.conversations.length > 0 ? (
                conversations.conversations.map((c: any) => (
                  <div 
                    key={c.id} 
                    className={`p-1.5 rounded-md border cursor-pointer hover:bg-muted/40 transition-colors ${
                      c.isUnread ? "bg-primary/5 border-primary/20" : "bg-muted/20 border-border/20"
                    }`}
                    onClick={() => navigate("/community/messages")}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold">{c.buyerName}</span>
                      {c.isUnread && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
                    </div>
                    <div className="text-[9px] text-muted-foreground truncate">{c.lastMessage}</div>
                  </div>
                ))
              ) : (
                <div className="text-center py-2 text-muted-foreground text-[10px]">لا توجد محادثات</div>
              )}
            </div>
          </div>
        );

      case "ratings":
        return (
          <div className="space-y-2">
            {/* Compact rating summary */}
            <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
              <div className="text-center">
                <div className="text-lg font-bold text-amber-500">{ratings?.avgRating?.toFixed(1) || "0.0"}</div>
                <div className="flex items-center justify-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-2 w-2 ${i < Math.round(ratings?.avgRating || 0) ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}`}
                    />
                  ))}
                </div>
              </div>
              <div className="h-6 w-px bg-border/40" />
              <div>
                <div className="text-xs font-bold">{ratings?.totalCount || 0}</div>
                <div className="text-[9px] text-muted-foreground">إجمالي</div>
              </div>
              {(ratings?.newCount || 0) > 0 && (
                <Badge variant="secondary" className="text-[8px] px-1.5 py-0 mr-auto">
                  +{ratings?.newCount}
                </Badge>
              )}
            </div>

            {/* Rating list */}
            <div className="space-y-1">
              {ratings?.ratings && ratings.ratings.length > 0 ? (
                ratings.ratings.map((r: any) => (
                  <div key={r.id} className={`p-1.5 rounded-md border ${r.isNew ? "bg-amber-500/5 border-amber-500/20" : "bg-muted/20 border-border/20"}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold">{r.customerName}</span>
                      <div className="flex gap-px">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-2 w-2 ${i < r.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}`} />
                        ))}
                      </div>
                    </div>
                    {r.review_text && <div className="text-[9px] text-muted-foreground truncate">{r.review_text}</div>}
                  </div>
                ))
              ) : (
                <div className="text-center py-2 text-muted-foreground text-[10px]">لا توجد تقييمات</div>
              )}
            </div>
          </div>
        );

      case "requests":
        return (
          <div className="space-y-2">
            {/* Compact request summary */}
            <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
              <div className="h-7 w-7 rounded-md bg-destructive/20 flex items-center justify-center">
                {(newRequests?.count || 0) > 0 ? (
                  <AlertCircle className="h-3.5 w-3.5 text-destructive animate-pulse" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5 text-primary" />
                )}
              </div>
              <div>
                <div className="text-sm font-bold">
                  {(newRequests?.count || 0) > 0 ? (
                    <span className="text-destructive">{newRequests?.count} طلب</span>
                  ) : (
                    <span className="text-primary">تم الرد</span>
                  )}
                </div>
                <div className="text-[9px] text-muted-foreground">
                  {(newRequests?.count || 0) > 0 ? "بانتظار عرض سعر" : "لا طلبات معلقة"}
                </div>
              </div>
            </div>

            {/* Request list */}
            <div className="space-y-1">
              {newRequests?.requests && newRequests.requests.length > 0 ? (
                newRequests.requests.map((r: any) => (
                  <div 
                    key={r.id} 
                    className="p-1.5 rounded-md bg-destructive/5 border border-destructive/20 cursor-pointer hover:bg-destructive/10 transition-colors"
                    onClick={() => navigate("/community/requests")}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold truncate">{r.title}</span>
                      <Badge variant="destructive" className="text-[8px] px-1.5 py-0 shrink-0">جديد</Badge>
                    </div>
                    <div className="text-[9px] text-muted-foreground">من: {r.userName}</div>
                  </div>
                ))
              ) : (
                <div className="text-center py-2 text-muted-foreground text-[10px]">لا طلبات جديدة</div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="border border-primary/20 bg-gradient-to-b from-card to-background/80 rounded-lg overflow-hidden">
      {/* Compact Header */}
      <CardHeader className="p-2.5 pb-2 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary/15 flex items-center justify-center">
              <ActiveIcon className="h-3.5 w-3.5 text-primary" />
            </div>
            <CardTitle className="text-xs font-semibold">{activeConfig.label}</CardTitle>
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
              <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
              مباشر
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6" 
              onClick={() => setSelectorOpen(true)}
            >
              <Settings2 className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 text-muted-foreground hover:text-destructive" 
              onClick={handleUnpinWidget}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {/* Compact Content */}
      <CardContent className="p-2.5 pt-2">
        {renderWidgetContent()}
        <Button 
          variant="ghost" 
          size="sm"
          className="w-full mt-2 gap-1.5 text-[10px] h-7 text-muted-foreground hover:text-primary"
          onClick={() => {
            if (pinnedWidget === "financial" || pinnedWidget === "orders") navigate("/community/merchant/orders");
            else if (pinnedWidget === "conversations") navigate("/community/messages");
            else if (pinnedWidget === "ratings") navigate(`/store/${merchantId}`);
            else if (pinnedWidget === "requests") navigate("/community/requests");
          }}
        >
          عرض التفاصيل
          <ChevronLeft className="h-2.5 w-2.5" />
        </Button>
      </CardContent>
      
      {/* Widget selector dialog - compact design */}
      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className="sm:max-w-[280px] p-0 gap-0 rounded-lg overflow-hidden bg-gradient-to-b from-card to-background border-primary/20">
          <DialogHeader className="px-3 py-2.5 border-b border-border/50 bg-muted/30">
            <DialogTitle className="text-xs font-semibold text-center">تغيير النافذة</DialogTitle>
          </DialogHeader>
          <div className="p-2 space-y-1">
            {(Object.keys(widgetConfig) as WidgetType[]).map((key) => {
              const config = widgetConfig[key];
              const Icon = config.icon;
              const isPinned = pinnedWidget === key;
              return (
                <button
                  key={key}
                  onClick={() => handlePinWidget(key)}
                  className={`flex items-center gap-2 w-full p-2 rounded-md border transition-all text-right ${
                    isPinned 
                      ? "border-primary/50 bg-primary/10" 
                      : "border-transparent hover:border-border/60 hover:bg-muted/40"
                  }`}
                >
                  <div className={`h-7 w-7 rounded-md shrink-0 flex items-center justify-center ${
                    isPinned ? "bg-primary/20" : "bg-muted/50"
                  }`}>
                    <Icon className={`h-3.5 w-3.5 ${isPinned ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{config.label}</div>
                    <div className="text-[9px] text-muted-foreground truncate">{config.description}</div>
                  </div>
                  {isPinned && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const MerchantDashboardWidgets = memo(MerchantDashboardWidgetsBase);
export default MerchantDashboardWidgets;
