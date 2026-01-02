import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShoppingBag, Search, Package, Truck, CheckCircle, Eye, Edit2, Loader2, User, Calendar, Gift, MapPin } from "lucide-react";
import { toast } from "sonner";
import { format, addHours } from "date-fns";
import { ar } from "date-fns/locale";

const formatBaghdadTime = (dateString: string) => {
  const date = new Date(dateString);
  const baghdadDate = addHours(date, 3);
  return format(baghdadDate, "dd MMM yyyy - hh:mm a", { locale: ar });
};

interface Purchase {
  id: string;
  user_id: string;
  offer_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  gift_tickets_awarded: number;
  purchase_status: string;
  shipping_requested_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  product_offers: {
    title_ar: string;
    image_url: string | null;
  } | null;
  profiles: {
    username: string;
    full_name: string | null;
    phone_number: string | null;
  } | null;
}

const statusLabels: Record<string, { label: string; color: string; icon: any }> = {
  purchased: { label: "تم الشراء", color: "bg-blue-500", icon: ShoppingBag },
  shipping_requested: { label: "طلب شحن", color: "bg-yellow-500", icon: Package },
  shipped: { label: "تم الشحن", color: "bg-purple-500", icon: Truck },
  delivered: { label: "تم التسليم", color: "bg-green-500", icon: CheckCircle },
};

export default function AdminOfferPurchases() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const { data: purchases, isLoading } = useQuery({
    queryKey: ["admin-offer-purchases"],
    queryFn: async () => {
      // First get purchases
      const { data: purchasesData, error: purchasesError } = await supabase
        .from("product_offer_purchases")
        .select(`
          *,
          product_offers(title_ar, image_url)
        `)
        .order("created_at", { ascending: false });

      if (purchasesError) throw purchasesError;

      // Get unique user IDs
      const userIds = [...new Set(purchasesData?.map(p => p.user_id) || [])];
      
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, full_name, phone_number")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Create lookup map
      const profilesMap: Record<string, { username: string; full_name: string | null; phone_number: string | null }> = {};
      profiles?.forEach(p => {
        profilesMap[p.id] = { username: p.username, full_name: p.full_name, phone_number: p.phone_number };
      });

      // Merge data
      return purchasesData?.map(p => ({
        ...p,
        profiles: profilesMap[p.user_id] || null
      })) as Purchase[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: any = { purchase_status: status };
      
      if (status === "shipped") {
        updateData.shipped_at = new Date().toISOString();
      } else if (status === "delivered") {
        updateData.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("product_offer_purchases")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-offer-purchases"] });
      toast.success("تم تحديث الحالة بنجاح");
      setShowEditDialog(false);
    },
    onError: (error) => {
      toast.error("حدث خطأ: " + error.message);
    },
  });

  const filteredPurchases = purchases?.filter((p) => {
    const matchesSearch =
      p.profiles?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.product_offers?.title_ar?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || p.purchase_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: purchases?.length || 0,
    purchased: purchases?.filter((p) => p.purchase_status === "purchased").length || 0,
    shipping_requested: purchases?.filter((p) => p.purchase_status === "shipping_requested").length || 0,
    shipped: purchases?.filter((p) => p.purchase_status === "shipped").length || 0,
    delivered: purchases?.filter((p) => p.purchase_status === "delivered").length || 0,
    totalRevenue: purchases?.reduce((sum, p) => sum + p.total_price, 0) || 0,
  };

  const handleEditClick = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setEditStatus(purchase.purchase_status);
    setEditNotes("");
    setShowEditDialog(true);
  };

  const handleSaveStatus = () => {
    if (!selectedPurchase) return;
    updateStatusMutation.mutate({ id: selectedPurchase.id, status: editStatus });
  };

  return (
    <AdminLayout title="إدارة مشتريات العروض" icon={<ShoppingBag className="h-6 w-6" />}>
      <div className="space-y-6" dir="rtl">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{stats.total}</div>
              <div className="text-xs text-muted-foreground">إجمالي</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-500">{stats.purchased}</div>
              <div className="text-xs text-muted-foreground">تم الشراء</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-500">{stats.shipping_requested}</div>
              <div className="text-xs text-muted-foreground">طلب شحن</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-500">{stats.shipped}</div>
              <div className="text-xs text-muted-foreground">تم الشحن</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-500">{stats.delivered}</div>
              <div className="text-xs text-muted-foreground">تم التسليم</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">{stats.totalRevenue.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">إجمالي الإيرادات</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث بالاسم أو المنتج..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-9"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  {Object.entries(statusLabels).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">قائمة المشتريات ({filteredPurchases?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredPurchases?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>لا توجد مشتريات</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المستخدم</TableHead>
                      <TableHead className="text-right">المنتج</TableHead>
                      <TableHead className="text-center">الكمية</TableHead>
                      <TableHead className="text-center">السعر</TableHead>
                      <TableHead className="text-center">التذاكر</TableHead>
                      <TableHead className="text-center">الحالة</TableHead>
                      <TableHead className="text-center">التاريخ</TableHead>
                      <TableHead className="text-center">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPurchases?.map((purchase) => {
                      const status = statusLabels[purchase.purchase_status] || statusLabels.purchased;
                      const StatusIcon = status.icon;
                      
                      return (
                        <TableRow key={purchase.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-sm">{purchase.profiles?.full_name || purchase.profiles?.username}</p>
                                <p className="text-xs text-muted-foreground">{purchase.profiles?.phone_number}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {purchase.product_offers?.image_url && (
                                <img src={purchase.product_offers.image_url} alt="" className="w-10 h-10 rounded object-cover" />
                              )}
                              <span className="text-sm font-medium">{purchase.product_offers?.title_ar}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{purchase.quantity}</TableCell>
                          <TableCell className="text-center font-medium">{purchase.total_price.toLocaleString()} د.ع</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="gap-1">
                              <Gift className="h-3 w-3" />
                              {purchase.gift_tickets_awarded}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`${status.color} text-white gap-1`}>
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {formatBaghdadTime(purchase.created_at)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditClick(purchase)}
                              className="gap-1"
                            >
                              <Edit2 className="h-3 w-3" />
                              تعديل
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>تعديل حالة الشراء</DialogTitle>
            </DialogHeader>
            {selectedPurchase && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  {selectedPurchase.product_offers?.image_url && (
                    <img src={selectedPurchase.product_offers.image_url} alt="" className="w-16 h-16 rounded object-cover" />
                  )}
                  <div>
                    <p className="font-medium">{selectedPurchase.product_offers?.title_ar}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedPurchase.profiles?.full_name || selectedPurchase.profiles?.username}
                    </p>
                    <p className="text-sm">الكمية: {selectedPurchase.quantity} - السعر: {selectedPurchase.total_price.toLocaleString()} د.ع</p>
                  </div>
                </div>

                <div>
                  <Label>الحالة الجديدة</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowEditDialog(false)} className="flex-1">
                    إلغاء
                  </Button>
                  <Button onClick={handleSaveStatus} className="flex-1" disabled={updateStatusMutation.isPending}>
                    {updateStatusMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                    حفظ
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
