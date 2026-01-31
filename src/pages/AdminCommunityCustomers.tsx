import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Users, Search, Ban, CheckCircle, Eye, Star, FileText, 
  MessageCircle, Download, Loader2, Trash2, AlertTriangle,
  User, MapPin, Calendar, Package, ChevronRight, ChevronLeft
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { ADMIN_ROUTES } from "@/config/adminConfig";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

interface CustomerProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  total_requests_made: number;
  reputation_score: number;
  is_verified: boolean;
  is_suspended: boolean;
  suspension_reason: string | null;
  suspended_at: string | null;
  created_at: string;
}

interface CustomerRequest {
  id: string;
  title: string;
  status: string;
  created_at: string;
  quantity: number | null;
  customer_governorate: string | null;
  description: string | null;
  colors: string | null;
  size: string | null;
}

interface Props {
  embedded?: boolean;
}

function CustomersContent() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSuspended, setFilterSuspended] = useState<"all" | "active" | "suspended">("all");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [activeDetailTab, setActiveDetailTab] = useState("info");
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  // Fetch customers with pagination
  const { data: customersData, isLoading } = useQuery({
    queryKey: ["admin-community-customers", filterSuspended, currentPage],
    queryFn: async () => {
      let query = supabase
        .from("community_customer_profiles")
        .select(`
          id, user_id, display_name, bio, avatar_url,
          total_requests_made, reputation_score, is_verified,
          is_suspended, suspension_reason, suspended_at, created_at
        `, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      if (filterSuspended === "active") {
        query = query.eq("is_suspended", false);
      } else if (filterSuspended === "suspended") {
        query = query.eq("is_suspended", true);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { customers: (data || []) as CustomerProfile[], totalCount: count || 0 };
    },
  });

  const customers = customersData?.customers || [];
  const totalCount = customersData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Fetch customer requests when selected
  const { data: customerRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["customer-requests", selectedCustomer?.user_id],
    enabled: !!selectedCustomer,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_print_requests")
        .select("id, title, status, created_at, quantity, customer_governorate, description, colors, size")
        .eq("user_id", selectedCustomer!.user_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CustomerRequest[];
    },
  });

  // Fetch customer conversations
  const { data: customerConversations = [], isLoading: convsLoading } = useQuery({
    queryKey: ["customer-conversations", selectedCustomer?.user_id],
    enabled: !!selectedCustomer,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_conversations")
        .select("id, created_at, updated_at")
        .or(`buyer_id.eq.${selectedCustomer!.user_id},seller_id.eq.${selectedCustomer!.user_id}`)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const filteredCustomers = customers.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.display_name?.toLowerCase().includes(q) ||
      c.user_id.toLowerCase().includes(q)
    );
  });

  const toggleSuspension = useMutation({
    mutationFn: async ({ 
      userId, 
      suspend, 
      reason 
    }: { 
      userId: string; 
      suspend: boolean; 
      reason?: string 
    }) => {
      const { error } = await supabase
        .from("community_customer_profiles")
        .update({
          is_suspended: suspend,
          suspension_reason: suspend ? reason : null,
          suspended_at: suspend ? new Date().toISOString() : null,
        })
        .eq("user_id", userId);

      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: userId,
        title: suspend ? "تم إيقاف حسابك مؤقتاً" : "تم إلغاء إيقاف حسابك",
        message: suspend 
          ? `تم إيقاف حسابك من مجتمع ليفو. السبب: ${reason}` 
          : "تم إلغاء إيقاف حسابك ويمكنك الآن استخدام المجتمع بشكل طبيعي.",
        type: suspend ? "error" : "success",
      });
    },
    onSuccess: (_, { suspend }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-community-customers"] });
      toast.success(suspend ? "تم إيقاف الحساب" : "تم إلغاء الإيقاف");
      setSelectedCustomer(null);
      setSuspensionReason("");
    },
    onError: () => {
      toast.error("حدث خطأ");
    },
  });

  const deleteCustomer = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("community_customer_profiles")
        .delete()
        .eq("user_id", userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-community-customers"] });
      toast.success("تم حذف سجل العميل");
      setSelectedCustomer(null);
      setShowDeleteDialog(false);
      setDeleteConfirmName("");
    },
    onError: () => {
      toast.error("فشل حذف العميل");
    },
  });

  const exportCustomerData = async () => {
    if (!selectedCustomer) return;

    const exportData = {
      profile: selectedCustomer,
      requests: customerRequests,
      conversations_count: customerConversations.length,
      exported_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customer_${selectedCustomer.user_id}_data.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تحميل البيانات");
  };

  const stats = {
    total: totalCount,
    active: customers.filter(c => !c.is_suspended).length,
    suspended: customers.filter(c => c.is_suspended).length,
  };

  const canDelete = selectedCustomer && 
    deleteConfirmName.trim().toLowerCase() === (selectedCustomer.display_name || "").toLowerCase();

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-3 flex-wrap text-sm">
        <Badge variant="outline" className="px-3 py-1.5 gap-2">
          <Users className="h-3.5 w-3.5" />
          {stats.total} عميل
        </Badge>
        <Badge variant="outline" className="px-3 py-1.5 gap-2 border-emerald-500/30 text-emerald-500">
          <CheckCircle className="h-3.5 w-3.5" />
          {stats.active} نشط
        </Badge>
        <Badge variant="outline" className="px-3 py-1.5 gap-2 border-red-500/30 text-red-500">
          <Ban className="h-3.5 w-3.5" />
          {stats.suspended} موقوف
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث بالاسم أو المعرف..."
            className="pr-10 h-9"
          />
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden h-9">
          {(["all", "active", "suspended"] as const).map((f) => (
            <button
              key={f}
              className={cn(
                "px-3 text-xs font-medium transition-colors",
                filterSuspended === f 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-background hover:bg-muted"
              )}
              onClick={() => { setFilterSuspended(f); setCurrentPage(0); }}
            >
              {f === "all" ? "الكل" : f === "active" ? "نشط" : "موقوف"}
            </button>
          ))}
        </div>
      </div>

      {/* Customers Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Users className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <h3 className="font-semibold">لا يوجد عملاء</h3>
            <p className="text-sm text-muted-foreground">لم يسجل أي عميل في المجتمع بعد</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredCustomers.map((customer) => (
              <Card 
                key={customer.id} 
                className={cn(
                  "hover:border-primary/30 transition-colors cursor-pointer",
                  customer.is_suspended && "border-red-500/30 bg-red-500/5"
                )}
                onClick={() => {
                  setSelectedCustomer(customer);
                  setActiveDetailTab("info");
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 border-border">
                      <AvatarImage src={customer.avatar_url || undefined} />
                      <AvatarFallback className="text-sm bg-primary/10">
                        {customer.display_name?.charAt(0) || "؟"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate">{customer.display_name || "بدون اسم"}</h3>
                        {customer.is_verified && (
                          <CheckCircle className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        )}
                        {customer.is_suspended && (
                          <Badge variant="destructive" className="text-[10px] h-4 shrink-0">موقوف</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {customer.total_requests_made || 0} طلب
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          {(customer.reputation_score || 0).toFixed(1)}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        انضم: {format(new Date(customer.created_at), "dd/MM/yyyy", { locale: ar })}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="gap-1"
              >
                <ChevronRight className="h-4 w-4" />
                السابق
              </Button>
              <span className="text-sm text-muted-foreground px-3">
                {currentPage + 1} من {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="gap-1"
              >
                التالي
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Customer Detail Dialog */}
      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              إدارة العميل
            </DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Customer Header */}
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg mb-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={selectedCustomer.avatar_url || undefined} />
                  <AvatarFallback>
                    {selectedCustomer.display_name?.charAt(0) || "؟"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{selectedCustomer.display_name || "بدون اسم"}</h3>
                  <p className="text-xs text-muted-foreground truncate">
                    ID: {selectedCustomer.user_id.slice(0, 12)}...
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedCustomer.is_verified && (
                      <Badge className="bg-blue-500/20 text-blue-500 text-[10px] h-5">موثق</Badge>
                    )}
                    {selectedCustomer.is_suspended && (
                      <Badge variant="destructive" className="text-[10px] h-5">موقوف</Badge>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={exportCustomerData} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  تصدير
                </Button>
              </div>

              {/* Tabs */}
              <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="grid w-full grid-cols-3 h-9">
                  <TabsTrigger value="info" className="gap-1.5 text-xs">
                    <User className="h-3.5 w-3.5" />
                    المعلومات
                  </TabsTrigger>
                  <TabsTrigger value="requests" className="gap-1.5 text-xs">
                    <Package className="h-3.5 w-3.5" />
                    الطلبات ({customerRequests.length})
                  </TabsTrigger>
                  <TabsTrigger value="conversations" className="gap-1.5 text-xs">
                    <MessageCircle className="h-3.5 w-3.5" />
                    المحادثات ({customerConversations.length})
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 mt-3">
                  <TabsContent value="info" className="m-0">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-muted/20 rounded-lg text-center">
                          <div className="text-xl font-bold">{selectedCustomer.total_requests_made || 0}</div>
                          <div className="text-xs text-muted-foreground">طلبات</div>
                        </div>
                        <div className="p-3 bg-muted/20 rounded-lg text-center">
                          <div className="text-xl font-bold">{(selectedCustomer.reputation_score || 0).toFixed(1)}</div>
                          <div className="text-xs text-muted-foreground">التقييم</div>
                        </div>
                      </div>

                      {selectedCustomer.bio && (
                        <div className="p-3 bg-muted/20 rounded-lg">
                          <span className="text-xs text-muted-foreground">النبذة</span>
                          <p className="text-sm mt-1">{selectedCustomer.bio}</p>
                        </div>
                      )}

                      <div className="p-3 bg-muted/20 rounded-lg">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          تاريخ الانضمام
                        </span>
                        <p className="text-sm mt-1">
                          {format(new Date(selectedCustomer.created_at), "dd MMMM yyyy", { locale: ar })}
                        </p>
                      </div>

                      {selectedCustomer.is_suspended && selectedCustomer.suspension_reason && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                          <p className="text-sm text-red-500">
                            <strong>سبب الإيقاف:</strong> {selectedCustomer.suspension_reason}
                          </p>
                          {selectedCustomer.suspended_at && (
                            <p className="text-xs text-muted-foreground mt-1">
                              تم الإيقاف: {format(new Date(selectedCustomer.suspended_at), "dd MMM yyyy HH:mm", { locale: ar })}
                            </p>
                          )}
                        </div>
                      )}

                      {!selectedCustomer.is_suspended && (
                        <div className="space-y-2 pt-3 border-t">
                          <label className="text-sm font-medium">سبب الإيقاف</label>
                          <Textarea
                            value={suspensionReason}
                            onChange={(e) => setSuspensionReason(e.target.value)}
                            placeholder="اكتب سبب إيقاف الحساب..."
                            className="h-20"
                          />
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="requests" className="m-0">
                    {requestsLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                      </div>
                    ) : customerRequests.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p>لا توجد طلبات</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {customerRequests.map(request => (
                          <div key={request.id} className="p-3 bg-muted/20 rounded-lg">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{request.title}</p>
                                {request.description && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {request.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                                  <span>{format(new Date(request.created_at), "dd MMM yyyy", { locale: ar })}</span>
                                  {request.customer_governorate && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {request.customer_governorate}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Badge variant={
                                request.status === "approved" ? "default" :
                                request.status === "pending" ? "secondary" :
                                request.status === "completed" ? "outline" :
                                "destructive"
                              } className="text-[10px] shrink-0">
                                {request.status === "approved" ? "منشور" :
                                 request.status === "pending" ? "قيد المراجعة" :
                                 request.status === "completed" ? "مكتمل" :
                                 "مرفوض"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="conversations" className="m-0">
                    {convsLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                      </div>
                    ) : customerConversations.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p>لا توجد محادثات</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {customerConversations.map(conv => (
                          <div key={conv.id} className="p-3 bg-muted/20 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <MessageCircle className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">محادثة #{conv.id.slice(0, 8)}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {conv.updated_at 
                                ? format(new Date(conv.updated_at), "dd MMM HH:mm", { locale: ar })
                                : format(new Date(conv.created_at), "dd MMM", { locale: ar })
                              }
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </ScrollArea>
              </Tabs>

              <DialogFooter className="mt-3 pt-3 border-t flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteDialog(true)}
                  className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                  حذف السجل
                </Button>
                
                {selectedCustomer.is_suspended ? (
                  <Button
                    onClick={() => toggleSuspension.mutate({ 
                      userId: selectedCustomer.user_id, 
                      suspend: false 
                    })}
                    disabled={toggleSuspension.isPending}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {toggleSuspension.isPending ? "جارٍ الإلغاء..." : "إلغاء الإيقاف"}
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={() => toggleSuspension.mutate({ 
                      userId: selectedCustomer.user_id, 
                      suspend: true, 
                      reason: suspensionReason 
                    })}
                    disabled={!suspensionReason.trim() || toggleSuspension.isPending}
                    className="gap-2"
                  >
                    <Ban className="h-4 w-4" />
                    {toggleSuspension.isPending ? "جارٍ الإيقاف..." : "إيقاف الحساب"}
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              تأكيد حذف العميل
            </DialogTitle>
            <DialogDescription>
              هذا الإجراء لا يمكن التراجع عنه. سيتم حذف سجل العميل نهائياً.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm">
              للتأكيد، اكتب اسم العميل: <strong>{selectedCustomer?.display_name || "بدون اسم"}</strong>
            </p>
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="اكتب اسم العميل للتأكيد..."
              className="text-center"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setDeleteConfirmName(""); }}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedCustomer && deleteCustomer.mutate(selectedCustomer.user_id)}
              disabled={!canDelete || deleteCustomer.isPending}
              className="gap-2"
            >
              {deleteCustomer.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              حذف نهائياً
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminCommunityCustomers({ embedded }: Props) {
  if (embedded) {
    return <CustomersContent />;
  }

  return (
    <AdminLayout
      title="إدارة العملاء"
      description="عرض وإدارة حسابات عملاء مجتمع ليفو"
      icon={<Users className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.levoCommunity}
      maxWidth="6xl"
    >
      <CustomersContent />
    </AdminLayout>
  );
}
