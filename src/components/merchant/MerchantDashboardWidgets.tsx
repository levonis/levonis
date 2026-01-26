import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface MerchantDashboardWidgetsProps {
  merchantId: string;
}

type WidgetType = "financial" | "orders" | "conversations" | "ratings" | "requests";

const widgetTabs: { key: WidgetType; label: string; icon: any; color: string }[] = [
  { key: "financial", label: "المالية", icon: TrendingUp, color: "text-emerald-500" },
  { key: "orders", label: "الطلبات", icon: Package, color: "text-blue-500" },
  { key: "conversations", label: "المحادثات", icon: MessageCircle, color: "text-purple-500" },
  { key: "ratings", label: "التقييمات", icon: Star, color: "text-amber-500" },
  { key: "requests", label: "طلبات جديدة", icon: FileText, color: "text-rose-500" },
];

function MerchantDashboardWidgetsBase({ merchantId }: MerchantDashboardWidgetsProps) {
  const navigate = useNavigate();
  const [activeWidget, setActiveWidget] = useState<WidgetType>("financial");

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

      const completedOrders = offers?.filter(o => o.status === "completed").length || 0;

      return {
        thisMonthRevenue,
        lastMonthRevenue,
        twoMonthsAgoRevenue,
        growth,
        totalOrders: offers?.length || 0,
        completedOrders,
        monthlyData: [
          { month: "قبل شهرين", revenue: twoMonthsAgoRevenue },
          { month: "الشهر الماضي", revenue: lastMonthRevenue },
          { month: "هذا الشهر", revenue: thisMonthRevenue },
        ],
      };
    },
    staleTime: 30_000,
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
      const total = data?.length || 0;

      return { 
        completed: completed.length, 
        accepted: accepted.length, 
        submitted: submitted.length, 
        total,
        recentOrders: data?.slice(0, 5) || [],
      };
    },
    staleTime: 30_000,
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
      const unread = allConvs
        .filter(c => {
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
        conversations: allConvs.slice(0, 5).map(c => {
          const messages = (c.listing_messages as any[]) || [];
          const lastMsg = messages.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];
          return {
            id: c.id,
            buyerName: buyerMap[c.buyer_id] || "زبون",
            lastMessage: lastMsg?.content?.slice(0, 60) || "",
            isUnread: lastMsg && !lastMsg.is_read && lastMsg.sender_id !== merchantId,
            time: lastMsg?.created_at,
          };
        }),
      };
    },
    staleTime: 30_000,
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
        ratings: (data || []).slice(0, 5).map(r => ({
          ...r,
          customerName: customerMap[r.customer_id] || "زبون",
          isNew: new Date(r.created_at) > oneWeekAgo,
        })),
      };
    },
    staleTime: 30_000,
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
        requests: pendingRequests.slice(0, 5).map(r => ({
          ...r,
          userName: userMap[r.user_id] || "زبون",
        })),
      };
    },
    staleTime: 30_000,
  });

  const isLoading = financialsLoading || ordersLoading || conversationsLoading || ratingsLoading || requestsLoading;

  const maxRevenue = Math.max(
    financials?.thisMonthRevenue || 0,
    financials?.lastMonthRevenue || 0,
    financials?.twoMonthsAgoRevenue || 0,
    1
  );

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "الآن";
    if (hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `منذ ${days} يوم`;
    return date.toLocaleDateString("ar-IQ");
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-10 w-24 rounded-full shrink-0" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const renderWidgetContent = () => {
    switch (activeWidget) {
      case "financial":
        return (
          <div className="space-y-4">
            {/* Main stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
                <div className="text-xs text-muted-foreground mb-1">إيرادات هذا الشهر</div>
                <div className="text-xl font-black text-emerald-500 tabular-nums">
                  {(financials?.thisMonthRevenue || 0).toLocaleString()}
                  <span className="text-sm font-normal mr-1">د.ع</span>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border border-border/40">
                <div className="text-xs text-muted-foreground mb-1">الشهر الماضي</div>
                <div className="text-xl font-bold text-foreground tabular-nums">
                  {(financials?.lastMonthRevenue || 0).toLocaleString()}
                  <span className="text-sm font-normal mr-1">د.ع</span>
                </div>
              </div>
            </div>

            {/* Growth indicator */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/40">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                (financials?.growth || 0) >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10"
              }`}>
                {(financials?.growth || 0) >= 0 ? (
                  <ArrowUpRight className="h-5 w-5 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="h-5 w-5 text-rose-500" />
                )}
              </div>
              <div>
                <div className="text-sm font-bold">
                  {(financials?.growth || 0) >= 0 ? "+" : ""}{financials?.growth?.toFixed(1) || 0}%
                </div>
                <div className="text-xs text-muted-foreground">نسبة النمو مقارنة بالشهر الماضي</div>
              </div>
            </div>

            {/* Monthly chart */}
            <div className="space-y-3">
              <div className="text-sm font-semibold">مقارنة الإيرادات</div>
              {financials?.monthlyData?.map((m, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{m.month}</span>
                    <span className="font-semibold tabular-nums">{m.revenue.toLocaleString()} د.ع</span>
                  </div>
                  <Progress value={(m.revenue / maxRevenue) * 100} className="h-2" />
                </div>
              ))}
            </div>

            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={() => navigate("/community/merchant/orders")}
            >
              عرض التفاصيل الكاملة
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        );

      case "orders":
        return (
          <div className="space-y-4">
            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
                <div className="text-lg font-bold tabular-nums">{orders?.completed || 0}</div>
                <div className="text-[10px] text-muted-foreground">مكتمل</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Truck className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                <div className="text-lg font-bold tabular-nums">{orders?.accepted || 0}</div>
                <div className="text-[10px] text-muted-foreground">قيد التنفيذ</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Clock className="h-5 w-5 mx-auto text-amber-500 mb-1" />
                <div className="text-lg font-bold tabular-nums">{orders?.submitted || 0}</div>
                <div className="text-[10px] text-muted-foreground">معلقة</div>
              </div>
            </div>

            {/* Recent orders */}
            <div className="space-y-2">
              <div className="text-sm font-semibold">آخر الطلبات</div>
              {orders?.recentOrders && orders.recentOrders.length > 0 ? (
                orders.recentOrders.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40">
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        o.status === "completed" ? "secondary" : 
                        o.status === "accepted" ? "outline" : "destructive"
                      } className="text-[10px]">
                        {o.status === "completed" ? "مكتمل" : o.status === "accepted" ? "قيد التنفيذ" : "معلق"}
                      </Badge>
                      <span className="text-sm font-semibold tabular-nums">{(o.price_iqd || 0).toLocaleString()} د.ع</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatTime(o.created_at)}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">لا توجد طلبات</div>
              )}
            </div>

            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={() => navigate("/community/merchant/orders")}
            >
              إدارة جميع الطلبات
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        );

      case "conversations":
        return (
          <div className="space-y-4">
            {/* Stats */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <div className="h-12 w-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                <MessageCircle className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <div className="text-xl font-black text-purple-500">{conversations?.unreadCount || 0}</div>
                <div className="text-xs text-muted-foreground">محادثات غير مقروءة من أصل {conversations?.totalCount || 0}</div>
              </div>
            </div>

            {/* Conversations list */}
            <div className="space-y-2">
              <div className="text-sm font-semibold">آخر المحادثات</div>
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
                      {c.isUnread && <Badge variant="destructive" className="text-[10px]">جديد</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{c.lastMessage}</div>
                    {c.time && <div className="text-[10px] text-muted-foreground mt-1">{formatTime(c.time)}</div>}
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">لا توجد محادثات</div>
              )}
            </div>

            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={() => navigate("/community/messages")}
            >
              عرض جميع المحادثات
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        );

      case "ratings":
        return (
          <div className="space-y-4">
            {/* Stats */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="text-center">
                <div className="text-3xl font-black text-amber-500">{ratings?.avgRating?.toFixed(1) || "0.0"}</div>
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${i < Math.round(ratings?.avgRating || 0) ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}`}
                    />
                  ))}
                </div>
              </div>
              <div className="h-12 w-px bg-border" />
              <div>
                <div className="text-lg font-bold">{ratings?.totalCount || 0}</div>
                <div className="text-xs text-muted-foreground">إجمالي التقييمات</div>
                {(ratings?.newCount || 0) > 0 && (
                  <Badge variant="secondary" className="mt-1 text-[10px]">
                    {ratings?.newCount} جديد هذا الأسبوع
                  </Badge>
                )}
              </div>
            </div>

            {/* Ratings list */}
            <div className="space-y-2">
              <div className="text-sm font-semibold">آخر التقييمات</div>
              {ratings?.ratings && ratings.ratings.length > 0 ? (
                ratings.ratings.map((r: any) => (
                  <div 
                    key={r.id} 
                    className={`p-3 rounded-xl border ${
                      r.isNew ? "bg-amber-500/5 border-amber-500/20" : "bg-muted/30 border-border/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">{r.customerName}</span>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${i < r.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}`}
                          />
                        ))}
                      </div>
                    </div>
                    {r.review_text && (
                      <div className="text-xs text-muted-foreground">{r.review_text}</div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-1">{formatTime(r.created_at)}</div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">لا توجد تقييمات</div>
              )}
            </div>

            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={() => navigate(`/store/${merchantId}`)}
            >
              عرض صفحة المتجر
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        );

      case "requests":
        return (
          <div className="space-y-4">
            {/* Stats */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <div className="h-12 w-12 rounded-full bg-rose-500/20 flex items-center justify-center">
                {(newRequests?.count || 0) > 0 ? (
                  <AlertCircle className="h-6 w-6 text-rose-500 animate-pulse" />
                ) : (
                  <CheckCircle className="h-6 w-6 text-emerald-500" />
                )}
              </div>
              <div>
                <div className="text-xl font-black">
                  {(newRequests?.count || 0) > 0 ? (
                    <span className="text-rose-500">{newRequests?.count} طلب</span>
                  ) : (
                    <span className="text-emerald-500">لا توجد طلبات</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {(newRequests?.count || 0) > 0 ? "بانتظار عرض السعر منك" : "جميع الطلبات تم الرد عليها"}
                </div>
              </div>
            </div>

            {/* Requests list */}
            <div className="space-y-2">
              <div className="text-sm font-semibold">طلبات جديدة</div>
              {newRequests?.requests && newRequests.requests.length > 0 ? (
                newRequests.requests.map((r: any) => (
                  <div 
                    key={r.id} 
                    className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 cursor-pointer hover:bg-rose-500/10 transition-colors"
                    onClick={() => navigate("/community/customer/requests")}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold truncate">{r.title}</span>
                      <Badge variant="destructive" className="text-[10px] shrink-0">جديد</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">من: {r.userName}</div>
                    {r.description && (
                      <div className="text-xs text-muted-foreground truncate mt-1">{r.description}</div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-1">{formatTime(r.created_at)}</div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">لا توجد طلبات جديدة</div>
              )}
            </div>

            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={() => navigate("/community/requests")}
            >
              تصفح جميع الطلبات
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  // Get notification count for each tab
  const getTabNotification = (key: WidgetType): number => {
    switch (key) {
      case "conversations": return conversations?.unreadCount || 0;
      case "ratings": return ratings?.newCount || 0;
      case "requests": return newRequests?.count || 0;
      default: return 0;
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {widgetTabs.map((tab) => {
          const Icon = tab.icon;
          const notifCount = getTabNotification(tab.key);
          const isActive = activeWidget === tab.key;
          
          return (
            <button
              key={tab.key}
              onClick={() => setActiveWidget(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full shrink-0 transition-all ${
                isActive 
                  ? "bg-primary text-primary-foreground shadow-lg" 
                  : "bg-muted/50 text-foreground hover:bg-muted"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "" : tab.color}`} />
              <span className="text-sm font-semibold">{tab.label}</span>
              {notifCount > 0 && (
                <span className={`h-5 min-w-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-destructive text-destructive-foreground"
                }`}>
                  {notifCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active widget content */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          {renderWidgetContent()}
        </CardContent>
      </Card>
    </div>
  );
}

const MerchantDashboardWidgets = memo(MerchantDashboardWidgetsBase);
export default MerchantDashboardWidgets;
