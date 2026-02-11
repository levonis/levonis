import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Ticket,
  Wallet,
  ShoppingBag,
  CreditCard,
  Shield,
  User,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  XCircle,
  Printer,
  Trophy,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface AdminUserDetailsDialogProps {
  userId: string | null;
  userName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AdminUserDetailsDialog({
  userId,
  userName,
  open,
  onOpenChange,
}: AdminUserDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState("competitions");

  // Fetch user tickets count
  const { data: ticketsData, isLoading: ticketsLoading } = useQuery({
    queryKey: ["admin-user-tickets", userId],
    enabled: !!userId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_tickets")
        .select("id, ticket_number, purchased_at, is_winner, competition_id, competitions(title_ar)")
        .eq("user_id", userId!)
        .order("purchased_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  // Fetch wallet transactions
  const { data: walletTransactions, isLoading: walletLoading } = useQuery({
    queryKey: ["admin-user-wallet-transactions", userId],
    enabled: !!userId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  // Fetch orders
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["admin-user-orders", userId],
    enabled: !!userId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, total_amount, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  // Fetch user's active membership card
  const { data: userCard, isLoading: cardLoading } = useQuery({
    queryKey: ["admin-user-card", userId],
    enabled: !!userId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_cards")
        .select("*, loyalty_levels(name_ar, color, icon, frame_url)")
        .eq("user_id", userId!)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Fetch user's printers with insurance
  const { data: userPrinters, isLoading: printersLoading } = useQuery({
    queryKey: ["admin-user-printers", userId],
    enabled: !!userId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_printers")
        .select("*, store_printers(model_name_ar, brand_ar, image_url), protection_plans(name_ar, price, duration_months)")
        .eq("user_id", userId!);

      if (error) throw error;
      return data;
    },
  });

  // Fetch competition participation
  const { data: competitionData, isLoading: competitionsLoading } = useQuery({
    queryKey: ["admin-user-competitions", userId],
    enabled: !!userId && open,
    queryFn: async () => {
      // Get unique competitions the user participated in
      const { data: tickets, error } = await supabase
        .from("competition_tickets")
        .select("competition_id, is_winner, competitions(id, title_ar, status, competition_type, image_url, created_at)")
        .eq("user_id", userId!)
        .order("purchased_at", { ascending: false });

      if (error) throw error;

      // Group by competition
      const compMap = new Map<string, { competition: any; ticketCount: number; wonCount: number }>();
      tickets?.forEach((t: any) => {
        const compId = t.competition_id;
        if (!compId || !t.competitions) return;
        if (!compMap.has(compId)) {
          compMap.set(compId, { competition: t.competitions, ticketCount: 0, wonCount: 0 });
        }
        const entry = compMap.get(compId)!;
        entry.ticketCount++;
        if (t.is_winner) entry.wonCount++;
      });

      return Array.from(compMap.values());
    },
  });

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      deposit: "إيداع",
      withdrawal: "سحب",
      purchase: "شراء",
      refund: "استرداد",
      bonus: "مكافأة",
      transfer: "تحويل",
      order_payment: "دفع طلب",
      competition_entry: "دخول مسابقة",
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      completed: { variant: "default", icon: CheckCircle2 },
      pending: { variant: "secondary", icon: Clock },
      failed: { variant: "destructive", icon: XCircle },
      approved: { variant: "default", icon: CheckCircle2 },
      rejected: { variant: "destructive", icon: XCircle },
    };
    const config = variants[status] || { variant: "outline", icon: Clock };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status === "completed" ? "مكتمل" : 
         status === "pending" ? "قيد الانتظار" : 
         status === "failed" ? "فشل" : 
         status === "approved" ? "موافق" : 
         status === "rejected" ? "مرفوض" : status}
      </Badge>
    );
  };

  const getOrderStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "قيد الانتظار",
      processing: "قيد المعالجة",
      shipped: "تم الشحن",
      delivered: "تم التسليم",
      cancelled: "ملغي",
      completed: "مكتمل",
    };
    return labels[status] || status;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-3">
            <User className="h-5 w-5 text-primary" />
            تفاصيل المستخدم: {userName || "مستخدم"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-6">
            <TabsList className="w-full grid grid-cols-6">
              <TabsTrigger value="competitions" className="gap-1">
                <Trophy className="h-4 w-4" />
                <span className="hidden sm:inline">المسابقات</span>
              </TabsTrigger>
              <TabsTrigger value="tickets" className="gap-1">
                <Ticket className="h-4 w-4" />
                <span className="hidden sm:inline">التذاكر</span>
              </TabsTrigger>
              <TabsTrigger value="wallet" className="gap-1">
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">المحفظة</span>
              </TabsTrigger>
              <TabsTrigger value="orders" className="gap-1">
                <ShoppingBag className="h-4 w-4" />
                <span className="hidden sm:inline">الطلبات</span>
              </TabsTrigger>
              <TabsTrigger value="card" className="gap-1">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">البطاقة</span>
              </TabsTrigger>
              <TabsTrigger value="insurance" className="gap-1">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">التأمين</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[60vh] p-6 pt-4">
            {/* Competitions Tab */}
            <TabsContent value="competitions" className="m-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-primary" />
                      سجل المشاركة في المسابقات
                    </span>
                    <Badge variant="secondary" className="text-lg">
                      {competitionData?.length || 0} مسابقة
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {competitionsLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : competitionData?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Trophy className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>لم يشارك في أي مسابقة</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {competitionData?.map((entry: any) => (
                        <div
                          key={entry.competition.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {entry.competition.image_url ? (
                              <img src={entry.competition.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Trophy className="h-6 w-6 text-primary" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-sm">{entry.competition.title_ar}</p>
                              <p className="text-xs text-muted-foreground">
                                {entry.ticketCount} تذكرة • {entry.competition.competition_type}
                              </p>
                            </div>
                          </div>
                          <div className="text-left flex flex-col items-end gap-1">
                            {entry.wonCount > 0 ? (
                              <Badge className="bg-emerald-600 gap-1">
                                <Trophy className="h-3 w-3" />
                                فائز ({entry.wonCount})
                              </Badge>
                            ) : (
                              <Badge variant="outline">مشارك</Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {entry.competition.status === 'active' ? 'نشطة' : 
                               entry.competition.status === 'completed' ? 'منتهية' : 
                               entry.competition.status === 'draft' ? 'مسودة' : entry.competition.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tickets Tab */}
            <TabsContent value="tickets" className="m-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <Ticket className="h-5 w-5 text-primary" />
                      سجل التذاكر
                    </span>
                    <Badge variant="secondary" className="text-lg">
                      {ticketsData?.length || 0} تذكرة
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ticketsLoading ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : ticketsData?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      لا توجد تذاكر
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {ticketsData?.map((ticket: any) => (
                        <div
                          key={ticket.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Ticket className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {ticket.competitions?.title_ar || "مسابقة"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                رقم التذكرة: {ticket.ticket_number}
                              </p>
                            </div>
                          </div>
                          <div className="text-left">
                            {ticket.is_winner ? (
                              <Badge className="bg-emerald-600">فائز 🎉</Badge>
                            ) : (
                              <Badge variant="outline">مشارك</Badge>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDate(ticket.purchased_at)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Wallet Transactions Tab */}
            <TabsContent value="wallet" className="m-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wallet className="h-5 w-5 text-primary" />
                    سجل معاملات المحفظة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {walletLoading ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : walletTransactions?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      لا توجد معاملات
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {walletTransactions?.map((tx: any) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                tx.amount > 0
                                  ? "bg-emerald-600/10"
                                  : "bg-destructive/10"
                              }`}
                            >
                              {tx.amount > 0 ? (
                                <ArrowDownLeft className="h-5 w-5 text-emerald-600" />
                              ) : (
                                <ArrowUpRight className="h-5 w-5 text-destructive" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {getTransactionTypeLabel(tx.type)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(tx.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="text-left">
                            <p
                              className={`font-bold ${
                                tx.amount > 0 ? "text-emerald-600" : "text-destructive"
                              }`}
                            >
                              {tx.amount > 0 ? "+" : ""}
                              {tx.amount.toLocaleString()} د.ع
                            </p>
                            {getStatusBadge(tx.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Orders Tab */}
            <TabsContent value="orders" className="m-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <ShoppingBag className="h-5 w-5 text-primary" />
                      سجل الطلبات
                    </span>
                    <Badge variant="secondary" className="text-lg">
                      {orders?.length || 0} طلب
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ordersLoading ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : orders?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      لا توجد طلبات
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {orders?.map((order: any) => (
                        <div
                          key={order.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <ShoppingBag className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                طلب #{order.order_number || order.id.slice(0, 8)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(order.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-primary">
                              {order.total_amount?.toLocaleString()} د.ع
                            </p>
                            <Badge variant="outline">
                              {getOrderStatusLabel(order.status)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Membership Card Tab */}
            <TabsContent value="card" className="m-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="h-5 w-5 text-primary" />
                    بطاقة العضوية
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {cardLoading ? (
                    <Skeleton className="h-40 w-full" />
                  ) : !userCard ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>لا يملك بطاقة عضوية</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border-2 p-6 bg-gradient-to-br from-primary/10 to-primary/5">
                      <div className="flex items-center gap-4">
                        {userCard.loyalty_levels?.frame_url ? (
                          <img
                            src={userCard.loyalty_levels.frame_url}
                            alt="Card"
                            className="h-20 w-20 object-contain"
                          />
                        ) : (
                          <div
                            className="h-20 w-20 rounded-full flex items-center justify-center text-3xl"
                            style={{ backgroundColor: userCard.loyalty_levels?.color || "#6366f1" }}
                          >
                            {userCard.loyalty_levels?.icon || "⭐"}
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="text-xl font-bold">
                            {userCard.loyalty_levels?.name_ar || "بطاقة عضوية"}
                          </h3>
                          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>
                                شُرِيت: {formatDate(userCard.purchased_at)}
                              </span>
                            </div>
                            {userCard.expires_at && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                <span>
                                  تنتهي: {formatDate(userCard.expires_at)}
                                </span>
                              </div>
                            )}
                          </div>
                          {userCard.points_spent > 0 && (
                            <p className="mt-2 text-sm">
                              النقاط المستخدمة:{" "}
                              <span className="font-bold text-primary">
                                {userCard.points_spent.toLocaleString()}
                              </span>
                            </p>
                          )}
                        </div>
                        <Badge
                          variant={userCard.is_active ? "default" : "secondary"}
                          className="text-sm"
                        >
                          {userCard.is_active ? "نشطة" : "غير نشطة"}
                        </Badge>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Printer Insurance Tab */}
            <TabsContent value="insurance" className="m-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      تأمين الطابعات
                    </span>
                    <Badge variant="secondary" className="text-lg">
                      {userPrinters?.length || 0} طابعة
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {printersLoading ? (
                    <div className="space-y-3">
                      {[...Array(2)].map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full" />
                      ))}
                    </div>
                  ) : userPrinters?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Printer className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>لا يملك طابعات مسجلة</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userPrinters?.map((printer: any) => (
                        <div
                          key={printer.id}
                          className="flex items-center gap-4 p-4 rounded-xl border bg-card"
                        >
                          {printer.store_printers?.image_url ? (
                            <img
                              src={printer.store_printers.image_url}
                              alt="Printer"
                              className="h-16 w-16 object-contain rounded-lg bg-muted"
                            />
                          ) : (
                            <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                              <Printer className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1">
                            <h4 className="font-bold">
                              {printer.store_printers?.model_name_ar || "طابعة"}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {printer.store_printers?.brand_ar || ""}
                            </p>
                            {printer.protection_plans && (
                              <div className="mt-1 flex items-center gap-2">
                                <Badge className="bg-emerald-600 gap-1">
                                  <Shield className="h-3 w-3" />
                                  {printer.protection_plans.name_ar}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {printer.protection_plans.duration_months} شهر
                                </span>
                              </div>
                            )}
                          </div>
                          <Badge
                            variant={
                              printer.verification_status === "verified"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {printer.verification_status === "verified"
                              ? "موثقة"
                              : "قيد التحقق"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
