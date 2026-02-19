import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShoppingBag, Search, Package, Truck, CheckCircle, Edit2, Loader2, User, Gift, Trash2, Undo2, Ticket, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, addHours } from "date-fns";
import { ar } from "date-fns/locale";
import { AdminCard, AdminCardContent, AdminStatsGrid, AdminStatCard, AdminEmptyState } from "@/components/admin/AdminLayout";

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
  ordered: { label: "تم الطلب", color: "bg-orange-500", icon: Package },
  shipping_requested: { label: "طلب شحن", color: "bg-yellow-500", icon: Package },
  confirmed: { label: "تم التأكيد", color: "bg-cyan-500", icon: CheckCircle },
  shipped: { label: "تم الشحن", color: "bg-purple-500", icon: Truck },
  on_the_way: { label: "في طريقه إليك", color: "bg-indigo-500", icon: Truck },
  delivered: { label: "تم التسليم", color: "bg-green-500", icon: CheckCircle },
};

export default function OfferPurchasesTab() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editStatus, setEditStatus] = useState("");
  const [refundMoney, setRefundMoney] = useState(true);
  const [deductTickets, setDeductTickets] = useState(true);

  const { data: purchases, isLoading } = useQuery({
    queryKey: ["admin-offer-purchases"],
    queryFn: async () => {
      const { data: purchasesData, error: purchasesError } = await supabase
        .from("product_offer_purchases")
        .select(`
          *,
          product_offers(title_ar, image_url)
        `)
        .order("created_at", { ascending: false });

      if (purchasesError) throw purchasesError;

      const userIds = [...new Set(purchasesData?.map(p => p.user_id) || [])];
      
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, full_name, phone_number")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      const profilesMap: Record<string, { username: string; full_name: string | null; phone_number: string | null }> = {};
      profiles?.forEach(p => {
        profilesMap[p.id] = { username: p.username, full_name: p.full_name, phone_number: p.phone_number };
      });

      return purchasesData?.map(p => ({
        ...p,
        profiles: profilesMap[p.user_id] || null
      })) as Purchase[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: any = { purchase_status: status, updated_at: new Date().toISOString() };
      
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

  const deletePurchaseMutation = useMutation({
    mutationFn: async ({ purchase, refund, deduct }: { purchase: Purchase; refund: boolean; deduct: boolean }) => {
      // 1. Refund money to wallet if requested
      if (refund && purchase.total_price > 0) {
        // Get current wallet balance
        const { data: wallet, error: walletFetchError } = await supabase
          .from("user_wallets")
          .select("balance")
          .eq("user_id", purchase.user_id)
          .maybeSingle();

        if (walletFetchError) throw walletFetchError;

        const currentBalance = wallet?.balance || 0;

        // Update or create wallet
        const { error: walletError } = await supabase
          .from("user_wallets")
          .upsert({
            user_id: purchase.user_id,
            balance: currentBalance + purchase.total_price,
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id" });

        if (walletError) throw walletError;

        // Record transaction
        const { error: transactionError } = await supabase
          .from("wallet_transactions")
          .insert({
            user_id: purchase.user_id,
            type: "refund",
            amount: purchase.total_price,
            status: "completed",
            admin_notes: `استرجاع مبلغ شراء العرض: ${purchase.product_offers?.title_ar}`
          });

        if (transactionError) throw transactionError;
      }

      // 2. Deduct tickets if requested
      if (deduct && purchase.gift_tickets_awarded > 0) {
        const { data: userTickets, error: ticketsFetchError } = await supabase
          .from("user_tickets")
          .select("ticket_count")
          .eq("user_id", purchase.user_id)
          .maybeSingle();

        if (ticketsFetchError) throw ticketsFetchError;

        const currentTickets = userTickets?.ticket_count || 0;
        const newTickets = Math.max(0, currentTickets - purchase.gift_tickets_awarded);

        const { error: ticketsUpdateError } = await supabase
          .from("user_tickets")
          .upsert({
            user_id: purchase.user_id,
            ticket_count: newTickets,
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id" });

        if (ticketsUpdateError) throw ticketsUpdateError;
      }

      // 3. Delete the purchase record
      const { error: deleteError } = await supabase
        .from("product_offer_purchases")
        .delete()
        .eq("id", purchase.id);

      if (deleteError) throw deleteError;

      // 4. Send notification to user
      await supabase
        .from("notifications")
        .insert({
          user_id: purchase.user_id,
          title: "تم إلغاء طلبك",
          message: `تم إلغاء طلب العرض "${purchase.product_offers?.title_ar}"${refund ? ` واسترجاع ${purchase.total_price.toLocaleString()} دينار إلى محفظتك` : ""}${deduct ? ` وخصم ${purchase.gift_tickets_awarded} تذكرة` : ""}`,
          type: "info"
        });

      return { refund, deduct };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-offer-purchases"] });
      let message = "تم حذف الطلب بنجاح";
      if (data.refund) message += " واسترجاع المبلغ";
      if (data.deduct) message += " وخصم التذاكر";
      toast.success(message);
      setShowDeleteDialog(false);
      setSelectedPurchase(null);
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

  const stats = {
    total: purchases?.length || 0,
    purchased: purchases?.filter((p) => p.purchase_status === "purchased").length || 0,
    shipping_requested: purchases?.filter((p) => p.purchase_status === "shipping_requested" || p.purchase_status === "ordered").length || 0,
    shipped: purchases?.filter((p) => p.purchase_status === "shipped").length || 0,
    delivered: purchases?.filter((p) => p.purchase_status === "delivered").length || 0,
    totalRevenue: purchases?.reduce((sum, p) => sum + p.total_price, 0) || 0,
  };

  const handleEditClick = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setEditStatus(purchase.purchase_status);
    setShowEditDialog(true);
  };

  const handleDeleteClick = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setRefundMoney(true);
    setDeductTickets(true);
    setShowDeleteDialog(true);
  };

  const handleSaveStatus = () => {
    if (!selectedPurchase) return;
    updateStatusMutation.mutate({ id: selectedPurchase.id, status: editStatus });
  };

  const handleConfirmDelete = () => {
    if (!selectedPurchase) return;
    deletePurchaseMutation.mutate({
      purchase: selectedPurchase,
      refund: refundMoney,
      deduct: deductTickets
    });
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Stats */}
      <AdminStatsGrid>
        <AdminStatCard
          icon={<ShoppingBag className="h-5 w-5" />}
          value={stats.total}
          label="إجمالي المشتريات"
        />
        <AdminStatCard
          icon={<Package className="h-5 w-5" />}
          value={stats.shipping_requested}
          label="طلبات الشحن"
          colorClass="text-yellow-500"
          bgClass="bg-yellow-500/10"
        />
        <AdminStatCard
          icon={<Truck className="h-5 w-5" />}
          value={stats.shipped}
          label="تم الشحن"
          colorClass="text-purple-500"
          bgClass="bg-purple-500/10"
        />
        <AdminStatCard
          icon={<CheckCircle className="h-5 w-5" />}
          value={stats.delivered}
          label="تم التسليم"
          colorClass="text-green-500"
          bgClass="bg-green-500/10"
        />
      </AdminStatsGrid>

      {/* Filters */}
      <AdminCard>
        <AdminCardContent>
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
        </AdminCardContent>
      </AdminCard>

      {/* Table */}
      <AdminCard hover={false}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">قائمة مشتريات العروض ({filteredPurchases?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredPurchases?.length === 0 ? (
            <AdminEmptyState
              icon={<ShoppingBag className="h-12 w-12" />}
              title="لا توجد مشتريات"
              description="لم يتم العثور على مشتريات تطابق معايير البحث"
            />
          ) : (
            <div className="overflow-x-auto">
              <ScrollArea className="h-[500px]">
                <Table className="min-w-[900px]">
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
                      <TableRow key={purchase.id} className={purchase.purchase_status === 'shipping_requested' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-r-4 border-r-yellow-500' : ''}>
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
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditClick(purchase)}
                              className="gap-1 h-8 px-2"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteClick(purchase)}
                              className="gap-1 h-8 px-2"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </AdminCard>

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

              {/* Status timestamps */}
              {selectedPurchase.shipped_at && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  تم الشحن: {formatBaghdadTime(selectedPurchase.shipped_at)}
                </p>
              )}
              {selectedPurchase.delivered_at && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  تم التسليم: {formatBaghdadTime(selectedPurchase.delivered_at)}
                </p>
              )}

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  إلغاء
                </Button>
                <Button onClick={handleSaveStatus} disabled={updateStatusMutation.isPending}>
                  {updateStatusMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                  حفظ
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              حذف الطلب
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              هل أنت متأكد من حذف هذا الطلب؟
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedPurchase && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                {selectedPurchase.product_offers?.image_url && (
                  <img src={selectedPurchase.product_offers.image_url} alt="" className="w-12 h-12 rounded object-cover" />
                )}
                <div>
                  <p className="font-medium text-sm">{selectedPurchase.product_offers?.title_ar}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedPurchase.profiles?.full_name || selectedPurchase.profiles?.username}
                  </p>
                </div>
              </div>

              {/* Refund option */}
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                <input
                  type="checkbox"
                  checked={refundMoney}
                  onChange={(e) => setRefundMoney(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Undo2 className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-sm">استرجاع المال للمحفظة</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    سيتم إضافة {selectedPurchase.total_price.toLocaleString()} د.ع لمحفظة المستخدم
                  </p>
                </div>
              </label>

              {/* Deduct tickets option */}
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                <input
                  type="checkbox"
                  checked={deductTickets}
                  onChange={(e) => setDeductTickets(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-amber-600" />
                    <span className="font-medium text-sm">خصم التذاكر الممنوحة</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    سيتم خصم {selectedPurchase.gift_tickets_awarded} تذكرة من رصيد المستخدم
                  </p>
                </div>
              </label>
            </div>
          )}

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletePurchaseMutation.isPending}
            >
              {deletePurchaseMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              حذف الطلب
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
