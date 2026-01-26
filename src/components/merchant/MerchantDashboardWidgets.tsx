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

const widgetConfig: Record<WidgetType, { label: string; icon: any; color: string; bgColor: string }> = {
  financial: { label: "التقرير المالي", icon: TrendingUp, color: "text-emerald-500", bgColor: "bg-emerald-500/10 border-emerald-500/20" },
  orders: { label: "الطلبات", icon: Package, color: "text-blue-500", bgColor: "bg-blue-500/10 border-blue-500/20" },
  conversations: { label: "المحادثات", icon: MessageCircle, color: "text-purple-500", bgColor: "bg-purple-500/10 border-purple-500/20" },
  ratings: { label: "التقييمات", icon: Star, color: "text-amber-500", bgColor: "bg-amber-500/10 border-amber-500/20" },
  requests: { label: "طلبات جديدة", icon: FileText, color: "text-rose-500", bgColor: "bg-rose-500/10 border-rose-500/20" },
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

  // Render widget selector
  const renderWidgetSelector = () => (
    <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 h-12 w-full border-dashed border-2">
          <PinIcon className="h-5 w-5 text-primary" />
          <span className="font-bold">تثبيت نافذة للمتابعة</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">اختر النافذة للتثبيت</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          {(Object.keys(widgetConfig) as WidgetType[]).map((key) => {
            const config = widgetConfig[key];
            const Icon = config.icon;
            const isPinned = pinnedWidget === key;
            return (
              <button
                key={key}
                onClick={() => handlePinWidget(key)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  isPinned 
                    ? "border-primary bg-primary/5" 
                    : `${config.bgColor} hover:border-primary/50`
                }`}
              >
                <div className={`h-10 w-10 rounded-full ${config.bgColor} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${config.color}`} />
                </div>
                <div className="text-right flex-1">
                  <div className="font-bold">{config.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {key === "financial" && "تحليل الإيرادات والنمو"}
                    {key === "orders" && "حالة الطلبات والتتبع"}
                    {key === "conversations" && "الرسائل غير المقروءة"}
                    {key === "ratings" && "التقييمات الجديدة"}
                    {key === "requests" && "طلبات تحتاج عرض سعر"}
                  </div>
                </div>
                {isPinned && <Badge variant="default" className="shrink-0">مُثبت</Badge>}
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
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
                <div className="text-xs text-muted-foreground mb-1">هذا الشهر</div>
                <div className="text-xl font-black text-emerald-500 tabular-nums">
                  {(financials?.thisMonthRevenue || 0).toLocaleString()}
                  <span className="text-xs font-normal mr-1">د.ع</span>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border border-border/40">
                <div className="text-xs text-muted-foreground mb-1">الشهر الماضي</div>
                <div className="text-xl font-bold text-foreground tabular-nums">
                  {(financials?.lastMonthRevenue || 0).toLocaleString()}
                  <span className="text-xs font-normal mr-1">د.ع</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/40">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                (financials?.growth || 0) >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10"
              }`}>
                {(financials?.growth || 0) >= 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-rose-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold">
                  {(financials?.growth || 0) >= 0 ? "+" : ""}{financials?.growth?.toFixed(1) || 0}%
                </div>
                <div className="text-[10px] text-muted-foreground">نسبة النمو</div>
              </div>
            </div>

            <div className="space-y-2">
              {financials?.monthlyData?.map((m, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{m.month}</span>
                    <span className="font-semibold tabular-nums">{m.revenue.toLocaleString()}</span>
                  </div>
                  <Progress value={(m.revenue / maxRevenue) * 100} className="h-1.5" />
                </div>
              ))}
            </div>
          </div>
        );

      case "orders":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
                <div className="text-lg font-bold tabular-nums">{orders?.completed || 0}</div>
                <div className="text-[10px] text-muted-foreground">مكتمل</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Truck className="h-4 w-4 mx-auto text-blue-500 mb-1" />
                <div className="text-lg font-bold tabular-nums">{orders?.accepted || 0}</div>
                <div className="text-[10px] text-muted-foreground">قيد التنفيذ</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Clock className="h-4 w-4 mx-auto text-amber-500 mb-1" />
                <div className="text-lg font-bold tabular-nums">{orders?.submitted || 0}</div>
                <div className="text-[10px] text-muted-foreground">معلق</div>
              </div>
            </div>

            <div className="space-y-2">
              {orders?.recentOrders && orders.recentOrders.length > 0 ? (
                orders.recentOrders.slice(0, 3).map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/40">
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        o.status === "completed" ? "secondary" : 
                        o.status === "accepted" ? "outline" : "destructive"
                      } className="text-[10px]">
                        {o.status === "completed" ? "مكتمل" : o.status === "accepted" ? "نشط" : "معلق"}
                      </Badge>
                      <span className="text-sm font-semibold tabular-nums">{(o.price_iqd || 0).toLocaleString()}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{formatTime(o.created_at)}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">لا توجد طلبات</div>
              )}
            </div>
          </div>
        );

      case "conversations":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <MessageCircle className={`h-5 w-5 text-purple-500 ${(conversations?.unreadCount || 0) > 0 ? "animate-pulse" : ""}`} />
              </div>
              <div>
                <div className="text-xl font-black text-purple-500">{conversations?.unreadCount || 0}</div>
                <div className="text-xs text-muted-foreground">غير مقروءة من {conversations?.totalCount || 0}</div>
              </div>
            </div>

            <div className="space-y-2">
              {conversations?.conversations && conversations.conversations.length > 0 ? (
                conversations.conversations.map((c: any) => (
                  <div 
                    key={c.id} 
                    className={`p-3 rounded-xl border cursor-pointer hover:bg-muted/50 transition-colors ${
                      c.isUnread ? "bg-purple-500/5 border-purple-500/20" : "bg-muted/30 border-border/40"
                    }`}
                    onClick={() => navigate("/community/messages")}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">{c.buyerName}</span>
                      {c.isUnread && <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{c.lastMessage}</div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">لا توجد محادثات</div>
              )}
            </div>
          </div>
        );

      case "ratings":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="text-center">
                <div className="text-2xl font-black text-amber-500">{ratings?.avgRating?.toFixed(1) || "0.0"}</div>
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${i < Math.round(ratings?.avgRating || 0) ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}`}
                    />
                  ))}
                </div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <div className="text-lg font-bold">{ratings?.totalCount || 0}</div>
                <div className="text-xs text-muted-foreground">إجمالي</div>
                {(ratings?.newCount || 0) > 0 && (
                  <Badge variant="secondary" className="mt-1 text-[10px]">
                    +{ratings?.newCount} جديد
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {ratings?.ratings && ratings.ratings.length > 0 ? (
                ratings.ratings.map((r: any) => (
                  <div key={r.id} className={`p-3 rounded-xl border ${r.isNew ? "bg-amber-500/5 border-amber-500/20" : "bg-muted/30 border-border/40"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">{r.customerName}</span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-2.5 w-2.5 ${i < r.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}`} />
                        ))}
                      </div>
                    </div>
                    {r.review_text && <div className="text-xs text-muted-foreground truncate">{r.review_text}</div>}
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">لا توجد تقييمات</div>
              )}
            </div>
          </div>
        );

      case "requests":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <div className="h-10 w-10 rounded-full bg-rose-500/20 flex items-center justify-center">
                {(newRequests?.count || 0) > 0 ? (
                  <AlertCircle className="h-5 w-5 text-rose-500 animate-pulse" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                )}
              </div>
              <div>
                <div className="text-xl font-black">
                  {(newRequests?.count || 0) > 0 ? (
                    <span className="text-rose-500">{newRequests?.count} طلب</span>
                  ) : (
                    <span className="text-emerald-500">تم الرد</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {(newRequests?.count || 0) > 0 ? "بانتظار عرض سعر" : "لا طلبات معلقة"}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {newRequests?.requests && newRequests.requests.length > 0 ? (
                newRequests.requests.map((r: any) => (
                  <div 
                    key={r.id} 
                    className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 cursor-pointer hover:bg-rose-500/10 transition-colors"
                    onClick={() => navigate("/community/requests")}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold truncate">{r.title}</span>
                      <Badge variant="destructive" className="text-[10px] shrink-0">جديد</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">من: {r.userName}</div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">لا طلبات جديدة</div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className={`border-2 ${activeConfig.bgColor}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full ${activeConfig.bgColor} flex items-center justify-center`}>
              <ActiveIcon className={`h-4 w-4 ${activeConfig.color}`} />
            </div>
            <CardTitle className="text-base">{activeConfig.label}</CardTitle>
            <Badge variant="outline" className="text-[10px] gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              مباشر
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7" 
              onClick={() => setSelectorOpen(true)}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-muted-foreground hover:text-destructive" 
              onClick={handleUnpinWidget}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {renderWidgetContent()}
        <Button 
          variant="ghost" 
          size="sm"
          className="w-full mt-4 gap-2 text-xs"
          onClick={() => {
            if (pinnedWidget === "financial" || pinnedWidget === "orders") navigate("/community/merchant/orders");
            else if (pinnedWidget === "conversations") navigate("/community/messages");
            else if (pinnedWidget === "ratings") navigate(`/store/${merchantId}`);
            else if (pinnedWidget === "requests") navigate("/community/requests");
          }}
        >
          عرض التفاصيل
          <ChevronLeft className="h-3 w-3" />
        </Button>
      </CardContent>
      
      {/* Widget selector dialog */}
      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">تغيير النافذة المثبتة</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {(Object.keys(widgetConfig) as WidgetType[]).map((key) => {
              const config = widgetConfig[key];
              const Icon = config.icon;
              const isPinned = pinnedWidget === key;
              return (
                <button
                  key={key}
                  onClick={() => handlePinWidget(key)}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    isPinned 
                      ? "border-primary bg-primary/5" 
                      : `${config.bgColor} hover:border-primary/50`
                  }`}
                >
                  <div className={`h-10 w-10 rounded-full ${config.bgColor} flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${config.color}`} />
                  </div>
                  <div className="text-right flex-1">
                    <div className="font-bold">{config.label}</div>
                  </div>
                  {isPinned && <Badge variant="default" className="shrink-0">مُثبت</Badge>}
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
