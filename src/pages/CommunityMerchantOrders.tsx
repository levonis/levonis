import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  ClipboardList, ArrowRight, TrendingUp, Package, CheckCircle, Truck, Clock,
  ArrowUpRight, ArrowDownRight, Filter, MessageSquare, Loader2, Play, DollarSign,
  Eye, User, Calendar
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
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
  images: string[] | null;
  image_url: string | null;
  customer_governorate: string | null;
};

type FilterStatus = "all" | "pending" | "accepted" | "in_progress" | "delivered" | "completed";

const statusFilters: { key: FilterStatus; label: string; icon: any }[] = [
  { key: "all", label: "الكل", icon: Package },
  { key: "pending", label: "بانتظار", icon: Clock },
  { key: "accepted", label: "مقبول", icon: CheckCircle },
  { key: "in_progress", label: "قيد التنفيذ", icon: Package },
  { key: "delivered", label: "تم التوصيل", icon: Truck },
  { key: "completed", label: "مكتمل", icon: CheckCircle },
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

  const { data: myOffers = [], isLoading: offersLoading } = useQuery({
    queryKey: ["merchant-offers", merchantApp?.id],
    enabled: !!merchantApp?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_offers")
        .select("id, request_id, trader_id, price_iqd, duration_days, status, created_at, accepted_at, offer_sent_at")
        .eq("trader_id", merchantApp!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PrintOfferRow[];
    },
  });

  const requestIds = myOffers.map((o) => o.request_id);
  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["merchant-community-requests", requestIds],
    enabled: requestIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_print_requests")
        .select("id, user_id, title, status, created_at, accepted_offer_id, delivered_at, customer_confirmed_at, images, image_url, customer_governorate")
        .in("id", requestIds);
      if (error) throw error;
      return data as PrintRequestRow[];
    },
  });

  // Fetch customer profiles
  const customerIds = [...new Set(requests.map(r => r.user_id))];
  const { data: customerProfiles = [] } = useQuery({
    queryKey: ["order-customers", customerIds],
    enabled: customerIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", customerIds);
      return data ?? [];
    },
  });
  const customerMap = new Map(customerProfiles.map(c => [c.id, c]));

  const updateStatusMutation = useMutation({
    mutationFn: async ({ offerId, requestId, status }: { offerId: string; requestId: string; status: string }) => {
      await supabase.from("print_offers").update({ status } as any).eq("id", offerId);
      const updateData: any = { status };
      if (status === "delivered") updateData.delivered_at = new Date().toISOString();
      await supabase.from("community_print_requests").update(updateData).eq("id", requestId);

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

          // Send Telegram notification to customer
          supabase.functions.invoke('send-user-telegram-notification', {
            body: {
              user_id: request.user_id,
              title: status === "delivered" ? "📦 تم توصيل الطلب" : "⚙️ تحديث حالة الطلب",
              message: statusMessages[status],
              notification_type: status === "delivered" ? "success" : "info",
            },
          }).catch(err => console.error('Telegram notify customer failed:', err));
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

  const financialAnalytics = useMemo(() => {
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
    const thisMonthRevenue = myOffers.filter(o => o.created_at?.startsWith(thisMonth) && o.status === "completed").reduce((sum, o) => sum + (o.price_iqd || 0), 0);
    const lastMonthRevenue = myOffers.filter(o => o.created_at?.startsWith(lastMonth) && o.status === "completed").reduce((sum, o) => sum + (o.price_iqd || 0), 0);
    const growth = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : thisMonthRevenue > 0 ? 100 : 0;
    const totalRevenue = myOffers.filter(o => o.status === "completed").reduce((sum, o) => sum + (o.price_iqd || 0), 0);
    return { thisMonthRevenue, lastMonthRevenue, growth, totalRevenue, totalOrders: myOffers.length, completedOrders: myOffers.filter(o => o.status === "completed").length };
  }, [myOffers]);

  const statusCounts = useMemo(() => ({
    all: myOffers.length,
    pending: myOffers.filter(o => o.status === "pending" && !o.accepted_at).length,
    accepted: myOffers.filter(o => o.status === "accepted" || (o.accepted_at && !["in_progress","delivered","completed"].includes(o.status))).length,
    in_progress: myOffers.filter(o => o.status === "in_progress").length,
    delivered: myOffers.filter(o => o.status === "delivered").length,
    completed: myOffers.filter(o => o.status === "completed").length,
  }), [myOffers]);

  const filteredOffers = useMemo(() => {
    if (activeFilter === "all") return myOffers;
    if (activeFilter === "pending") return myOffers.filter(o => o.status === "pending" && !o.accepted_at);
    if (activeFilter === "accepted") return myOffers.filter(o => o.status === "accepted" || (o.accepted_at && !["in_progress","delivered","completed"].includes(o.status)));
    return myOffers.filter(o => o.status === activeFilter);
  }, [myOffers, activeFilter]);

  const requestsMap = new Map(requests.map((r) => [r.id, r]));

  const getStatusBadge = (offer: PrintOfferRow, request?: PrintRequestRow) => {
    const isAccepted = !!offer.accepted_at || request?.accepted_offer_id === offer.id;
    if (offer.status === "completed" || request?.customer_confirmed_at) return { label: "مكتمل", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" };
    if (offer.status === "delivered" || request?.delivered_at) return { label: "تم التوصيل", color: "bg-orange-500/15 text-orange-500 border-orange-500/30" };
    if (offer.status === "in_progress") return { label: "قيد التنفيذ", color: "bg-purple-500/15 text-purple-500 border-purple-500/30" };
    if (isAccepted) return { label: "مقبول", color: "bg-blue-500/15 text-blue-500 border-blue-500/30" };
    if (offer.offer_sent_at) return { label: "تم الإرسال", color: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30" };
    return { label: "بانتظار", color: "bg-amber-500/15 text-amber-500 border-amber-500/30" };
  };

  const getAvailableActions = (offer: PrintOfferRow, request?: PrintRequestRow) => {
    const isAccepted = !!offer.accepted_at || request?.accepted_offer_id === offer.id;
    const actions: { label: string; status: string; icon: any }[] = [];
    if (isAccepted && !["in_progress","delivered","completed"].includes(offer.status)) {
      actions.push({ label: "بدء التنفيذ", status: "in_progress", icon: Play });
    }
    if (offer.status === "in_progress") {
      actions.push({ label: "تم التوصيل", status: "delivered", icon: Truck });
    }
    return actions;
  };

  if (appLoading || offersLoading || requestsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8 pt-24 max-w-3xl space-y-4">
          <Skeleton className="h-12 w-48 rounded-xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </main>
      </div>
    );
  }

  if (!merchantApp) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8 pt-24 max-w-3xl">
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">هذه الصفحة متاحة للتجار المقبولين فقط</p>
            <Button variant="outline" onClick={() => navigate("/community")}>العودة للمجتمع</Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 pt-20 max-w-3xl space-y-5">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <ClipboardList className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-black text-foreground">إدارة الطلبات</h1>
              <p className="text-[10px] text-muted-foreground">{financialAnalytics.totalOrders} طلب · {financialAnalytics.completedOrders} مكتمل</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => navigate("/community")}>
            <ArrowRight className="ml-1 h-3 w-3" />رجوع
          </Button>
        </header>

        {/* Financial Summary - Compact */}
        <div className="grid grid-cols-4 gap-1.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="text-[8px] text-muted-foreground">هذا الشهر</div>
            <div className="text-sm font-black text-emerald-500 tabular-nums">
              {financialAnalytics.thisMonthRevenue.toLocaleString()}
              <span className="text-[7px] font-normal mr-0.5">د.ع</span>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
            <div className="text-[8px] text-muted-foreground">الماضي</div>
            <div className="text-sm font-bold text-foreground tabular-nums">
              {financialAnalytics.lastMonthRevenue.toLocaleString()}
              <span className="text-[7px] font-normal mr-0.5">د.ع</span>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
            <div className="text-[8px] text-muted-foreground">الإجمالي</div>
            <div className="text-sm font-bold text-foreground tabular-nums">
              {financialAnalytics.totalRevenue.toLocaleString()}
              <span className="text-[7px] font-normal mr-0.5">د.ع</span>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
            <div className="text-[8px] text-muted-foreground">النمو</div>
            <div className={`text-sm font-black tabular-nums flex items-center gap-0.5 ${financialAnalytics.growth >= 0 ? "text-emerald-500" : "text-destructive"}`}>
              {financialAnalytics.growth >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(financialAnalytics.growth).toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {statusFilters.map((filter) => {
            const Icon = filter.icon;
            const count = statusCounts[filter.key];
            const isActive = activeFilter === filter.key;
            return (
              <button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl shrink-0 text-xs font-medium transition-all border ${
                  isActive 
                    ? "bg-primary text-primary-foreground border-primary shadow-md" 
                    : "bg-card text-muted-foreground border-border/50 hover:border-primary/30"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {filter.label}
                <span className={`h-4 min-w-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center ${
                  isActive ? "bg-primary-foreground/20" : "bg-muted"
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Orders List */}
        {filteredOffers.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <Package className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground mb-3">
              {activeFilter === "all" ? "لا توجد طلبات بعد" : `لا توجد طلبات بهذه الحالة`}
            </p>
            {activeFilter === "all" && (
              <Button size="sm" className="text-xs h-7" onClick={() => navigate("/community/requests")}>تصفح طلبات الزبائن</Button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredOffers.map((offer) => {
              const req = requestsMap.get(offer.request_id);
              const statusInfo = getStatusBadge(offer, req);
              const actions = getAvailableActions(offer, req);
              const customer = req ? customerMap.get(req.user_id) : null;
              const mainImage = req?.images?.[0] || req?.image_url;
              
              return (
                <div key={offer.id} className="rounded-xl border border-border/50 bg-card overflow-hidden hover:border-primary/30 transition-all p-2.5">
                  <div className="flex gap-2.5">
                    {/* Image */}
                    {mainImage && (
                      <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden shrink-0">
                        <img src={mainImage} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      {/* Title & Status */}
                      <div className="flex items-center justify-between gap-1.5 mb-0.5">
                        <h3 className="font-bold text-xs text-foreground truncate">
                          {req?.title || "طلب #" + offer.request_id.slice(0, 6)}
                        </h3>
                        <Badge variant="outline" className={`shrink-0 text-[7px] px-1.5 py-0 h-4 ${statusInfo.color} border`}>
                          {statusInfo.label}
                        </Badge>
                      </div>

                      {/* Customer + Price row */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-3.5 w-3.5">
                            <AvatarImage src={customer?.avatar_url || undefined} />
                            <AvatarFallback className="text-[5px] bg-muted"><User className="h-2 w-2" /></AvatarFallback>
                          </Avatar>
                          <span className="text-[9px] text-muted-foreground truncate max-w-[60px]">
                            {customer?.full_name || "عميل"}
                          </span>
                          {req?.customer_governorate && (
                            <span className="text-[8px] text-muted-foreground">📍{req.customer_governorate}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-bold text-xs text-primary tabular-nums">{offer.price_iqd.toLocaleString()}</span>
                          <span className="text-[7px] text-primary/60">د.ع</span>
                          <span className="text-[8px] text-muted-foreground">· {offer.duration_days}ي</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {(actions.length > 0) && (
                    <div className="flex gap-1 mt-2 pt-2 border-t border-border/30">
                      <Button size="sm" variant="outline" className="h-6 text-[9px] gap-0.5 px-2"
                        onClick={() => navigate(`/community/messages?user_id=${req?.user_id}&request_id=${offer.request_id}`)}>
                        <MessageSquare className="h-2.5 w-2.5" />مراسلة
                      </Button>
                      {actions.map((action) => (
                        <Button key={action.status} size="sm" className="h-6 text-[9px] gap-0.5 px-2"
                          onClick={() => { setUpdateStatusOffer(offer); setNewStatus(action.status); }}>
                          <action.icon className="h-2.5 w-2.5" />{action.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
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
              {updateStatusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "تأكيد"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
