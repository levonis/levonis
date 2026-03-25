import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CheckCircle, Search, Package, Gift, Ticket, Shield, TrendingUp, Loader2, User, Eye, DollarSign } from "lucide-react";
import { format, addHours } from "date-fns";
import { ar } from "date-fns/locale";

const formatBaghdadTime = (dateString: string) => {
  const date = new Date(dateString);
  const baghdadDate = addHours(date, 3);
  return format(baghdadDate, "dd MMM yyyy - hh:mm a", { locale: ar });
};

interface DeliveredOrder {
  id: string;
  source: "site" | "offer" | "shipment";
  user_id: string;
  user_name: string;
  user_phone: string | null;
  product_name: string;
  product_image: string | null;
  quantity: number;
  total_price: number;
  currency: string;
  delivered_at: string;
  profit: number;
  points_awarded: number;
  tickets_awarded: number;
  has_insurance: boolean;
  gifts: string | null;
}

export default function AdminDeliveredOrders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<DeliveredOrder | null>(null);

  const { data: deliveredOrders, isLoading } = useQuery({
    queryKey: ["admin-delivered-orders"],
    queryFn: async () => {
      const orders: DeliveredOrder[] = [];

      // 1. Fetch delivered site orders
      const { data: siteOrders } = await supabase
        .from("orders")
        .select("*, profiles(full_name, phone_number, username), order_items(product_name_ar, quantity, price, product_id)")
        .eq("status", "delivered")
        .order("delivered_at", { ascending: false });

      for (const order of siteOrders || []) {
        const items = (order.order_items as any[]) || [];
        const productNames = items.map((i: any) => i.product_name_ar || "منتج").join(", ");
        const totalQty = items.reduce((s: number, i: any) => s + (i.quantity || 1), 0);
        const profile = order.profiles as any;

        orders.push({
          id: order.id,
          source: "site",
          user_id: order.user_id,
          user_name: profile?.full_name || profile?.username || "مستخدم",
          user_phone: profile?.phone_number || null,
          product_name: productNames,
          product_image: null,
          quantity: totalQty,
          total_price: order.total_amount || 0,
          currency: order.currency || "د.ع",
          delivered_at: order.delivered_at || order.updated_at,
          profit: order.profit_amount || 0,
          points_awarded: 0,
          tickets_awarded: 0,
          has_insurance: false,
          gifts: null,
        });
      }

      // 2. Fetch delivered offer purchases
      const { data: offerPurchases } = await supabase
        .from("product_offer_purchases")
        .select("*, product_offers(title_ar, image_url, points_reward)")
        .eq("purchase_status", "delivered")
        .order("delivered_at", { ascending: false });

      if (offerPurchases) {
        const userIds = [...new Set(offerPurchases.map(p => p.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, phone_number, username")
          .in("id", userIds);

        const profilesMap: Record<string, any> = {};
        profiles?.forEach(p => { profilesMap[p.id] = p; });

        for (const purchase of offerPurchases) {
          const profile = profilesMap[purchase.user_id];
          const offer = purchase.product_offers as any;

          orders.push({
            id: purchase.id,
            source: "offer",
            user_id: purchase.user_id,
            user_name: profile?.full_name || profile?.username || "مستخدم",
            user_phone: profile?.phone_number || null,
            product_name: offer?.title_ar || "عرض",
            product_image: offer?.image_url || null,
            quantity: purchase.quantity,
            total_price: purchase.total_price,
            currency: "د.ع",
            delivered_at: purchase.delivered_at || purchase.updated_at,
            profit: 0,
            points_awarded: offer?.points_reward || 0,
            tickets_awarded: purchase.gift_tickets_awarded || 0,
            has_insurance: false,
            gifts: null,
          });
        }
      }

      // 3. Fetch delivered shipment requests
      const { data: shipments } = await supabase
        .from("shipment_requests")
        .select("*")
        .eq("status", "delivered")
        .order("delivered_at", { ascending: false });

      if (shipments) {
        const userIds = [...new Set(shipments.map(s => s.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, phone_number, username")
          .in("id", userIds);

        const profilesMap: Record<string, any> = {};
        profiles?.forEach(p => { profilesMap[p.id] = p; });

        for (const shipment of shipments) {
          const profile = profilesMap[shipment.user_id];
          orders.push({
            id: shipment.id,
            source: "shipment",
            user_id: shipment.user_id,
            user_name: profile?.full_name || profile?.username || "مستخدم",
            user_phone: profile?.phone_number || null,
            product_name: "طلب شحن عروض",
            product_image: null,
            quantity: 1,
            total_price: 0,
            currency: "د.ع",
            delivered_at: shipment.delivered_at || shipment.updated_at,
            profit: 0,
            points_awarded: 0,
            tickets_awarded: 0,
            has_insurance: false,
            gifts: null,
          });
        }
      }

      // Sort all by delivered_at
      orders.sort((a, b) => new Date(b.delivered_at).getTime() - new Date(a.delivered_at).getTime());
      return orders;
    },
  });

  const filtered = useMemo(() => {
    let items = deliveredOrders || [];
    if (activeTab !== "all") {
      items = items.filter(o => o.source === activeTab);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      items = items.filter(o =>
        o.user_name.toLowerCase().includes(q) ||
        o.product_name.toLowerCase().includes(q) ||
        o.user_phone?.includes(q)
      );
    }
    return items;
  }, [deliveredOrders, activeTab, searchTerm]);

  const stats = useMemo(() => {
    const items = deliveredOrders || [];
    return {
      total: items.length,
      site: items.filter(o => o.source === "site").length,
      offer: items.filter(o => o.source === "offer").length,
      totalRevenue: items.reduce((s, o) => s + o.total_price, 0),
      totalProfit: items.reduce((s, o) => s + o.profit, 0),
      totalTickets: items.reduce((s, o) => s + o.tickets_awarded, 0),
    };
  }, [deliveredOrders]);

  const sourceLabel = (s: string) => {
    if (s === "site") return { label: "طلب موقع", color: "bg-blue-500" };
    if (s === "offer") return { label: "عرض منتج", color: "bg-amber-500" };
    return { label: "شحن عروض", color: "bg-purple-500" };
  };

  return (
    <AdminLayout title="الطلبات المسلّمة" icon={<CheckCircle className="h-6 w-6" />}>
      <div className="space-y-6" dir="rtl">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{stats.total}</div>
              <div className="text-xs text-muted-foreground">إجمالي المسلّمة</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-500">{stats.site}</div>
              <div className="text-xs text-muted-foreground">طلبات الموقع</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-500">{stats.offer}</div>
              <div className="text-xs text-muted-foreground">عروض منتجات</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.totalRevenue.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">إجمالي الإيرادات</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{stats.totalProfit.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">إجمالي الأرباح</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-500">{stats.totalTickets}</div>
              <div className="text-xs text-muted-foreground">التذاكر الممنوحة</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو المنتج..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-9"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="all">الكل ({stats.total})</TabsTrigger>
            <TabsTrigger value="site">طلبات الموقع ({stats.site})</TabsTrigger>
            <TabsTrigger value="offer">عروض المنتجات ({stats.offer})</TabsTrigger>
            <TabsTrigger value="shipment">شحن عروض</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">لا توجد طلبات مسلّمة</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">المستخدم</TableHead>
                        <TableHead className="text-right">المنتج</TableHead>
                        <TableHead className="text-center">المصدر</TableHead>
                        <TableHead className="text-center">المبلغ</TableHead>
                        <TableHead className="text-center">المجموع الكلي</TableHead>
                        <TableHead className="text-center">العمولة</TableHead>
                        <TableHead className="text-center">التذاكر</TableHead>
                        <TableHead className="text-center">تاريخ التسليم</TableHead>
                        <TableHead className="text-center">تفاصيل</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((order) => {
                        const src = sourceLabel(order.source);
                        return (
                          <TableRow key={`${order.source}-${order.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium text-sm">{order.user_name}</p>
                                  {order.user_phone && (
                                    <p className="text-xs text-muted-foreground">{order.user_phone}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {order.product_image && (
                                  <img src={order.product_image} alt="" className="w-8 h-8 rounded object-cover" />
                                )}
                                <span className="text-sm line-clamp-1 max-w-[200px]">{order.product_name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={`${src.color} text-white`}>{src.label}</Badge>
                            </TableCell>
                            <TableCell className="text-center font-medium text-sm">
                              {order.total_price.toLocaleString()} {order.currency}
                            </TableCell>
                            <TableCell className="text-center">
                              {order.profit > 0 ? (
                                <span className="text-green-600 font-medium">{order.profit.toLocaleString()}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {order.tickets_awarded > 0 ? (
                                <Badge variant="outline" className="gap-1">
                                  <Ticket className="h-3 w-3" />
                                  {order.tickets_awarded}
                                </Badge>
                              ) : "-"}
                            </TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground">
                              {formatBaghdadTime(order.delivered_at)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedOrder(order)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              تفاصيل الطلب المسلّم
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-3">
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">المستخدم</span>
                  <span className="font-medium text-sm">{selectedOrder.user_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">المنتج</span>
                  <span className="font-medium text-sm line-clamp-1">{selectedOrder.product_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">المصدر</span>
                  <Badge className={`${sourceLabel(selectedOrder.source).color} text-white`}>
                    {sourceLabel(selectedOrder.source).label}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">المبلغ</span>
                  <span className="font-bold">{selectedOrder.total_price.toLocaleString()} {selectedOrder.currency}</span>
                </div>
                {selectedOrder.profit > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> الربح</span>
                    <span className="font-bold text-green-600">{selectedOrder.profit.toLocaleString()}</span>
                  </div>
                )}
                {selectedOrder.tickets_awarded > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1"><Ticket className="h-3 w-3" /> التذاكر</span>
                    <span className="font-bold text-amber-600">{selectedOrder.tickets_awarded}</span>
                  </div>
                )}
                {selectedOrder.has_insurance && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1"><Shield className="h-3 w-3" /> التأمين</span>
                    <Badge variant="outline" className="text-green-600">مؤمّن</Badge>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">تاريخ التسليم</span>
                  <span className="text-xs">{formatBaghdadTime(selectedOrder.delivered_at)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
