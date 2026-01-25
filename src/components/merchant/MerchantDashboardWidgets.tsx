import { memo } from "react";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface MerchantDashboardWidgetsProps {
  merchantId: string;
}

function MerchantDashboardWidgetsBase({ merchantId }: MerchantDashboardWidgetsProps) {
  const navigate = useNavigate();

  // Fetch financial summary
  const { data: financials, isLoading: financialsLoading } = useQuery({
    queryKey: ["merchant-financials", merchantId],
    queryFn: async () => {
      const now = new Date();
      const thisMonth = now.toISOString().slice(0, 7);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);

      const { data: offers, error } = await supabase
        .from("print_offers")
        .select("price_iqd, status, created_at")
        .eq("trader_id", merchantId);

      if (error) throw error;

      const thisMonthOffers = offers?.filter(o => o.created_at?.startsWith(thisMonth)) || [];
      const lastMonthOffers = offers?.filter(o => o.created_at?.startsWith(lastMonth)) || [];
      
      const thisMonthRevenue = thisMonthOffers
        .filter(o => o.status === "completed")
        .reduce((sum, o) => sum + (o.price_iqd || 0), 0);
      
      const lastMonthRevenue = lastMonthOffers
        .filter(o => o.status === "completed")
        .reduce((sum, o) => sum + (o.price_iqd || 0), 0);

      const growth = lastMonthRevenue > 0 
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
        : 0;

      return {
        thisMonthRevenue,
        lastMonthRevenue,
        growth,
        totalOrders: offers?.length || 0,
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
        .select("id, status")
        .eq("trader_id", merchantId);

      if (error) throw error;

      const delivered = data?.filter(o => o.status === "completed").length || 0;
      const accepted = data?.filter(o => o.status === "accepted").length || 0;
      const pending = data?.filter(o => o.status === "submitted").length || 0;
      const total = data?.length || 0;

      return { delivered, accepted, pending, total };
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

      // Filter to unread conversations (where latest message is unread and not from merchant)
      const unread = (convs || [])
        .filter(c => {
          const messages = c.listing_messages || [];
          const lastMsg = messages.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];
          return lastMsg && !lastMsg.is_read && lastMsg.sender_id !== merchantId;
        })
        .slice(0, 3);

      // Fetch buyer profiles
      const buyerIds = unread.map(c => c.buyer_id);
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
        conversations: unread.map(c => ({
          id: c.id,
          buyerName: buyerMap[c.buyer_id] || "زبون",
          lastMessage: (c.listing_messages as any[])?.[0]?.content?.slice(0, 50) || "",
        })),
      };
    },
    staleTime: 30_000,
  });

  // Fetch new ratings
  const { data: ratings, isLoading: ratingsLoading } = useQuery({
    queryKey: ["merchant-new-ratings", merchantId],
    queryFn: async () => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from("merchant_ratings")
        .select("id, rating, review_text, created_at")
        .eq("merchant_id", merchantId)
        .gte("created_at", oneWeekAgo)
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;

      return {
        newCount: data?.length || 0,
        ratings: data || [],
      };
    },
    staleTime: 30_000,
  });

  // Fetch new requests without price
  const { data: newRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ["merchant-pending-requests", merchantId],
    queryFn: async () => {
      // Get requests where this merchant hasn't made an offer yet
      const { data: allRequests, error } = await supabase
        .from("print_requests")
        .select("id, title, created_at, user_id")
        .eq("status", "pending_review")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      // Check which ones have offers from this merchant
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

      return {
        count: pendingRequests.length,
        requests: pendingRequests.slice(0, 3),
      };
    },
    staleTime: 30_000,
  });

  const isLoading = financialsLoading || ordersLoading || conversationsLoading || ratingsLoading || requestsLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {/* Financial Widget */}
      <Card 
        className="border-border/60 cursor-pointer hover:border-primary/40 transition-colors"
        onClick={() => navigate("/community/merchant/orders")}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <h3 className="text-sm font-bold text-foreground">التقرير المالي</h3>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">هذا الشهر</span>
              <span className="text-sm font-bold text-primary tabular-nums">
                {financials?.thisMonthRevenue?.toLocaleString() || 0} د.ع
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">الشهر الماضي</span>
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {financials?.lastMonthRevenue?.toLocaleString() || 0} د.ع
              </span>
            </div>
            {financials?.growth !== 0 && (
              <Badge 
                variant={financials?.growth && financials.growth > 0 ? "secondary" : "outline"}
                className="text-xs"
              >
                {financials?.growth && financials.growth > 0 ? "+" : ""}
                {financials?.growth?.toFixed(1) || 0}% نمو
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Orders Widget */}
      <Card 
        className="border-border/60 cursor-pointer hover:border-primary/40 transition-colors"
        onClick={() => navigate("/community/merchant/orders")}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Package className="h-4 w-4 text-blue-500" />
            </div>
            <h3 className="text-sm font-bold text-foreground">الطلبات</h3>
            <Badge variant="secondary" className="mr-auto text-xs">{orders?.total || 0}</Badge>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <CheckCircle className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
              <div className="text-xs text-muted-foreground">مكتمل</div>
              <div className="text-sm font-bold tabular-nums">{orders?.delivered || 0}</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <Truck className="h-4 w-4 mx-auto text-blue-500 mb-1" />
              <div className="text-xs text-muted-foreground">قيد التنفيذ</div>
              <div className="text-sm font-bold tabular-nums">{orders?.accepted || 0}</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <Clock className="h-4 w-4 mx-auto text-amber-500 mb-1" />
              <div className="text-xs text-muted-foreground">معلقة</div>
              <div className="text-sm font-bold tabular-nums">{orders?.pending || 0}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conversations Widget */}
      <Card 
        className="border-border/60 cursor-pointer hover:border-primary/40 transition-colors"
        onClick={() => navigate("/community/messages")}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-purple-500" />
            </div>
            <h3 className="text-sm font-bold text-foreground">المحادثات</h3>
            {(conversations?.unreadCount || 0) > 0 && (
              <Badge variant="destructive" className="mr-auto text-xs">
                {conversations?.unreadCount} غير مقروءة
              </Badge>
            )}
          </div>
          
          {conversations?.conversations && conversations.conversations.length > 0 ? (
            <div className="space-y-2">
              {conversations.conversations.map((c) => (
                <div key={c.id} className="p-2 rounded-lg bg-muted/30">
                  <div className="text-xs font-semibold text-foreground">{c.buyerName}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{c.lastMessage}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">لا توجد محادثات غير مقروءة</p>
          )}
        </CardContent>
      </Card>

      {/* Ratings Widget */}
      <Card 
        className="border-border/60 cursor-pointer hover:border-primary/40 transition-colors"
        onClick={() => navigate(`/store/${merchantId}`)}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Star className="h-4 w-4 text-amber-500" />
            </div>
            <h3 className="text-sm font-bold text-foreground">التقييمات الجديدة</h3>
            {(ratings?.newCount || 0) > 0 && (
              <Badge variant="secondary" className="mr-auto text-xs">
                {ratings?.newCount} جديد
              </Badge>
            )}
          </div>
          
          {ratings?.ratings && ratings.ratings.length > 0 ? (
            <div className="space-y-2">
              {ratings.ratings.map((r) => (
                <div key={r.id} className="p-2 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-1 mb-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${i < r.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}`}
                      />
                    ))}
                  </div>
                  {r.review_text && (
                    <div className="text-[11px] text-muted-foreground truncate">{r.review_text}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">لا توجد تقييمات جديدة</p>
          )}
        </CardContent>
      </Card>

      {/* New Requests Widget */}
      <Card 
        className="border-border/60 cursor-pointer hover:border-primary/40 transition-colors"
        onClick={() => navigate("/community/customer/requests")}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-rose-500" />
            </div>
            <h3 className="text-sm font-bold text-foreground">طلبات جديدة</h3>
            {(newRequests?.count || 0) > 0 && (
              <Badge variant="destructive" className="mr-auto text-xs animate-pulse">
                <AlertCircle className="h-3 w-3 ml-1" />
                {newRequests?.count} بانتظار السعر
              </Badge>
            )}
          </div>
          
          {newRequests?.requests && newRequests.requests.length > 0 ? (
            <div className="space-y-2">
              {newRequests.requests.map((r) => (
                <div key={r.id} className="p-2 rounded-lg bg-muted/30">
                  <div className="text-xs font-semibold text-foreground truncate">{r.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("ar-IQ")}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">لا توجد طلبات بانتظار السعر</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const MerchantDashboardWidgets = memo(MerchantDashboardWidgetsBase);
export default MerchantDashboardWidgets;
