import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  ClipboardList, 
  ArrowRight, 
  TrendingUp, 
  Package, 
  CheckCircle, 
  Truck, 
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  MessageSquare,
  Loader2,
  Play,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type PrintOfferRow = {
  id: string;
  request_id: string;
  trader_id: string;
  price_iqd: number;
  duration_days: number;
  status: string;
  created_at: string;
  accepted_at: string | null;
  offer_sent_at: string | null;
};

type PrintRequestRow = {
  id: string;
  user_id: string;
  title: string;
  status: string;
  created_at: string;
  accepted_offer_id: string | null;
  delivered_at: string | null;
  customer_confirmed_at: string | null;
};

type FilterStatus = "all" | "pending" | "accepted" | "in_progress" | "delivered" | "completed";

const statusFilters: { key: FilterStatus; label: string; icon: any; color: string }[] = [
  { key: "all", label: "الكل", icon: Package, color: "text-foreground" },
  { key: "pending", label: "بانتظار القبول", icon: Clock, color: "text-amber-500" },
  { key: "accepted", label: "تم القبول", icon: CheckCircle, color: "text-blue-500" },
  { key: "in_progress", label: "قيد التنفيذ", icon: Package, color: "text-purple-500" },
  { key: "delivered", label: "تم التوصيل", icon: Truck, color: "text-orange-500" },
  { key: "completed", label: "مكتمل", icon: CheckCircle, color: "text-emerald-500" },
];

export default function CommunityMerchantOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");
  const [updateStatusOffer, setUpdateStatusOffer] = useState<PrintOfferRow | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");

  const { data: merchantApp, isLoading: appLoading } = useQuery({
    queryKey: ["merchant-app", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_applications")
        .select("id, status")
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch offers submitted by this merchant
  const { data: myOffers = [], isLoading: offersLoading } = useQuery({
    queryKey: ["merchant-offers", user?.id],
    enabled: !!user?.id && !!merchantApp,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_offers")
        .select("id, request_id, trader_id, price_iqd, duration_days, status, created_at, accepted_at, offer_sent_at")
        .eq("trader_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PrintOfferRow[];
    },
  });

  // Fetch corresponding requests from community_print_requests
  const requestIds = myOffers.map((o) => o.request_id);
  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["merchant-community-requests", requestIds],
    enabled: requestIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_print_requests")
        .select("id, user_id, title, status, created_at, accepted_offer_id, delivered_at, customer_confirmed_at")
        .in("id", requestIds);
      if (error) throw error;
      return data as PrintRequestRow[];
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ offerId, requestId, status }: { offerId: string; requestId: string; status: string }) => {
      // Update offer status (cast as any to bypass enum type)
      await supabase.from("print_offers").update({ status } as any).eq("id", offerId);

      // Update request status
      const updateData: any = { status };
      if (status === "delivered") {
        updateData.delivered_at = new Date().toISOString();
      }

      await supabase.from("community_print_requests").update(updateData).eq("id", requestId);

      // Notify customer
      const request = requests.find((r) => r.id === requestId);
      if (request) {
        const statusMessages: Record<string, string> = {
          in_progress: "بدأ التاجر بتنفيذ طلبك",
          delivered: "تم توصيل طلبك! يرجى تأكيد الاستلام خلال 3 أيام",
        };
        
        if (statusMessages[status]) {
          await supabase.from("notifications").insert({
            user_id: request.user_id,
            title: status === "delivered" ? "تم توصيل الطلب 📦" : "تحديث حالة الطلب",
            message: statusMessages[status],
            type: "order_status",
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-offers", user?.id] });
      qc.invalidateQueries({ queryKey: ["merchant-community-requests"] });
      toast({ title: "تم تحديث الحالة" });
      setUpdateStatusOffer(null);
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err?.message, variant: "destructive" });
    },
  });

  // Calculate financial analytics
  const financialAnalytics = useMemo(() => {
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);

    const thisMonthOffers = myOffers.filter(o => o.created_at?.startsWith(thisMonth) && o.status === "completed");
    const lastMonthOffers = myOffers.filter(o => o.created_at?.startsWith(lastMonth) && o.status === "completed");

    const thisMonthRevenue = thisMonthOffers.reduce((sum, o) => sum + (o.price_iqd || 0), 0);
    const lastMonthRevenue = lastMonthOffers.reduce((sum, o) => sum + (o.price_iqd || 0), 0);

    const growth = lastMonthRevenue > 0 
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
      : thisMonthRevenue > 0 ? 100 : 0;

    const totalRevenue = myOffers
      .filter(o => o.status === "completed")
      .reduce((sum, o) => sum + (o.price_iqd || 0), 0);

    return {
      thisMonthRevenue,
      lastMonthRevenue,
      growth,
      totalRevenue,
      totalOrders: myOffers.length,
      completedOrders: myOffers.filter(o => o.status === "completed").length,
    };
  }, [myOffers]);

  // Calculate status counts
  const statusCounts = useMemo(() => ({
    all: myOffers.length,
    pending: myOffers.filter(o => o.status === "pending" && !o.accepted_at).length,
    accepted: myOffers.filter(o => o.status === "accepted" || (o.accepted_at && o.status !== "in_progress" && o.status !== "delivered" && o.status !== "completed")).length,
    in_progress: myOffers.filter(o => o.status === "in_progress").length,
    delivered: myOffers.filter(o => o.status === "delivered").length,
    completed: myOffers.filter(o => o.status === "completed").length,
  }), [myOffers]);

  // Filter offers
  const filteredOffers = useMemo(() => {
    if (activeFilter === "all") return myOffers;
    if (activeFilter === "pending") return myOffers.filter(o => o.status === "pending" && !o.accepted_at);
    if (activeFilter === "accepted") return myOffers.filter(o => o.status === "accepted" || (o.accepted_at && o.status !== "in_progress" && o.status !== "delivered" && o.status !== "completed"));
    return myOffers.filter(o => o.status === activeFilter);
  }, [myOffers, activeFilter]);

  const requestsMap = new Map(requests.map((r) => [r.id, r]));

  const getStatusBadge = (offer: PrintOfferRow, request?: PrintRequestRow) => {
    const isAccepted = !!offer.accepted_at || request?.accepted_offer_id === offer.id;
    
    if (offer.status === "completed" || request?.customer_confirmed_at) {
      return { label: "مكتمل", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" };
    }
    if (offer.status === "delivered" || request?.delivered_at) {
      return { label: "تم التوصيل", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" };
    }
    if (offer.status === "in_progress") {
      return { label: "قيد التنفيذ", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" };
    }
    if (isAccepted) {
      return { label: "تم القبول - ابدأ التنفيذ", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" };
    }
    if (offer.offer_sent_at) {
      return { label: "تم إرسال العرض", color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" };
    }
    return { label: "بانتظار الإرسال", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" };
  };

  const getAvailableActions = (offer: PrintOfferRow, request?: PrintRequestRow) => {
    const isAccepted = !!offer.accepted_at || request?.accepted_offer_id === offer.id;
    const actions: { label: string; status: string; icon: any }[] = [];

    if (isAccepted && offer.status !== "in_progress" && offer.status !== "delivered" && offer.status !== "completed") {
      actions.push({ label: "بدء التنفيذ", status: "in_progress", icon: Play });
    }
    if (offer.status === "in_progress") {
      actions.push({ label: "تم التوصيل", status: "delivered", icon: Truck });
    }

    return actions;
  };

  if (appLoading || offersLoading || requestsLoading) {
    return (
      <div className="min-h-screen bg-background/95">
        <main className="container mx-auto px-4 py-8 pt-24 max-w-5xl">
          <Skeleton className="h-12 w-64 rounded-xl mb-6" />
          <Skeleton className="h-32 rounded-2xl mb-4" />
          <Skeleton className="h-14 rounded-2xl mb-4" />
          <Skeleton className="h-40 rounded-2xl" />
        </main>
      </div>
    );
  }

  if (!merchantApp) {
    return (
      <div className="min-h-screen bg-background/95">
        <main className="container mx-auto px-4 py-8 pt-24 max-w-4xl">
          <Card className="border-border bg-card p-6 rounded-3xl">
            <p className="text-sm text-muted-foreground">لا يمكن الوصول لهذه الصفحة إلا للتجار المقبولين.</p>
            <Button className="mt-4" variant="outline" onClick={() => navigate("/community")}>
              العودة للمجتمع
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 pt-24 max-w-5xl space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
              <ClipboardList className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">إدارة الطلبات</h1>
              <p className="text-sm text-muted-foreground">التحليل المالي وتتبع الطلبات</p>
            </div>
          </div>
          <Button variant="outline" className="rounded-xl" onClick={() => navigate("/community")}>
            <ArrowRight className="ml-2 h-4 w-4" />
            رجوع
          </Button>
        </header>

        {/* Financial Analytics Section */}
        <Card className="border-0 bg-gradient-to-br from-primary/5 via-card to-card rounded-3xl shadow-xl shadow-primary/5 overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">التحليل المالي</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border border-emerald-500/20">
                <div className="text-xs text-muted-foreground mb-1">إيرادات هذا الشهر</div>
                <div className="text-xl font-black text-emerald-600 tabular-nums">
                  {financialAnalytics.thisMonthRevenue.toLocaleString()}
                  <span className="text-xs font-normal mr-1">د.ع</span>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
                <div className="text-xs text-muted-foreground mb-1">الشهر الماضي</div>
                <div className="text-xl font-bold text-foreground tabular-nums">
                  {financialAnalytics.lastMonthRevenue.toLocaleString()}
                  <span className="text-xs font-normal mr-1">د.ع</span>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
                <div className="text-xs text-muted-foreground mb-1">إجمالي الإيرادات</div>
                <div className="text-xl font-bold text-foreground tabular-nums">
                  {financialAnalytics.totalRevenue.toLocaleString()}
                  <span className="text-xs font-normal mr-1">د.ع</span>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
                <div className="text-xs text-muted-foreground mb-1">الطلبات المكتملة</div>
                <div className="text-xl font-bold text-foreground tabular-nums">
                  {financialAnalytics.completedOrders}
                  <span className="text-xs font-normal mr-1">/ {financialAnalytics.totalOrders}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-background/50 border border-border/50">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                financialAnalytics.growth >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10"
              }`}>
                {financialAnalytics.growth >= 0 ? (
                  <ArrowUpRight className="h-6 w-6 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="h-6 w-6 text-rose-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-lg font-black">
                  {financialAnalytics.growth >= 0 ? "+" : ""}{financialAnalytics.growth.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">نسبة النمو مقارنة بالشهر الماضي</div>
              </div>
              <div className="hidden sm:block flex-1 max-w-xs">
                <div className="text-xs text-muted-foreground mb-1">نسبة الإنجاز</div>
                <Progress 
                  value={financialAnalytics.totalOrders > 0 ? (financialAnalytics.completedOrders / financialAnalytics.totalOrders) * 100 : 0} 
                  className="h-2" 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Filters */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">تصفية حسب الحالة</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {statusFilters.map((filter) => {
              const Icon = filter.icon;
              const count = statusCounts[filter.key];
              const isActive = activeFilter === filter.key;
              
              return (
                <button
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl shrink-0 transition-all border ${
                    isActive 
                      ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" 
                      : "bg-card text-foreground border-border/60 hover:border-primary/30 hover:bg-muted/50"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "" : filter.color}`} />
                  <span className="text-sm font-semibold">{filter.label}</span>
                  <span className={`h-5 min-w-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    isActive 
                      ? "bg-primary-foreground/20 text-primary-foreground" 
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Orders List */}
        {filteredOffers.length === 0 ? (
          <Card className="border-border bg-card p-8 rounded-3xl text-center">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {activeFilter === "all" 
                ? "لا توجد طلبات بعد. تصفح طلبات العملاء وقدّم عروضاً."
                : `لا توجد طلبات بحالة "${statusFilters.find(f => f.key === activeFilter)?.label}"`}
            </p>
            {activeFilter === "all" && (
              <Button className="rounded-xl" onClick={() => navigate("/community/requests")}>
                تصفح طلبات العملاء
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredOffers.map((offer) => {
              const req = requestsMap.get(offer.request_id);
              const statusInfo = getStatusBadge(offer, req);
              const actions = getAvailableActions(offer, req);
              
              return (
                <Card key={offer.id} className="border-border/60 bg-card rounded-2xl hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-base truncate">
                            {req?.title || "طلب #" + offer.request_id.slice(0, 8)}
                          </h3>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="font-bold text-primary tabular-nums">
                            {offer.price_iqd.toLocaleString()} د.ع
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">
                            {offer.duration_days} يوم
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(offer.created_at).toLocaleDateString("ar-IQ")}
                          </span>
                        </div>
                      </div>
                      <Badge className={`shrink-0 ${statusInfo.color} border`}>
                        {statusInfo.label}
                      </Badge>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs rounded-lg"
                        onClick={() => navigate(`/community/messages?request_id=${offer.request_id}`)}
                      >
                        <MessageSquare className="h-3 w-3 ml-1" />
                        المحادثة
                      </Button>

                      {actions.map((action) => (
                        <Button
                          key={action.status}
                          size="sm"
                          className="h-8 text-xs rounded-lg bg-gradient-to-b from-primary to-accent"
                          onClick={() => {
                            setUpdateStatusOffer(offer);
                            setNewStatus(action.status);
                          }}
                        >
                          <action.icon className="h-3 w-3 ml-1" />
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Status Update Dialog */}
      <AlertDialog open={!!updateStatusOffer} onOpenChange={(o) => !o && setUpdateStatusOffer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تحديث حالة الطلب</AlertDialogTitle>
            <AlertDialogDescription>
              {newStatus === "in_progress" && "هل تريد بدء تنفيذ هذا الطلب؟ سيتم إعلام العميل."}
              {newStatus === "delivered" && "هل تم توصيل الطلب للعميل؟ سيتم إعلامه لتأكيد الاستلام."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => updateStatusOffer && updateStatusMutation.mutate({
                offerId: updateStatusOffer.id,
                requestId: updateStatusOffer.request_id,
                status: newStatus,
              })}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "تأكيد"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
