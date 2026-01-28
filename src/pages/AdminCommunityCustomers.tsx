import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Users, Search, Ban, CheckCircle, Eye, Star, FileText, 
  MessageCircle, Download, Loader2, AlertTriangle, Clock,
  ShoppingBag, User, MapPin, Calendar, RefreshCw, Filter
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout, { AdminSection } from "@/components/admin/AdminLayout";
import { ADMIN_ROUTES } from "@/config/adminConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  // Fetch customers from community_customer_profiles
  const { data: customers = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-community-customers", filterSuspended],
    queryFn: async () => {
      let query = supabase
        .from("community_customer_profiles")
        .select(`
          id, user_id, display_name, bio, avatar_url,
          total_requests_made, reputation_score, is_verified,
          is_suspended, suspension_reason, suspended_at, created_at
        `)
        .order("created_at", { ascending: false });

      if (filterSuspended === "active") {
        query = query.eq("is_suspended", false);
      } else if (filterSuspended === "suspended") {
        query = query.eq("is_suspended", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CustomerProfile[];
    },
  });

  // Fetch customer requests when selected
  const { data: customerRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["customer-requests", selectedCustomer?.user_id],
    enabled: !!selectedCustomer,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_print_requests")
        .select("id, title, status, created_at, quantity, customer_governorate")
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

      // Send notification
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
    total: customers.length,
    active: customers.filter(c => !c.is_suspended).length,
    suspended: customers.filter(c => c.is_suspended).length,
    verified: customers.filter(c => c.is_verified).length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">إجمالي العملاء</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-500">{stats.active}</div>
            <div className="text-xs text-muted-foreground">نشط</div>
          </CardContent>
        </Card>
        <Card className="border-red-500/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-500">{stats.suspended}</div>
            <div className="text-xs text-muted-foreground">موقوف</div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-500">{stats.verified}</div>
            <div className="text-xs text-muted-foreground">موثق</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث بالاسم أو المعرف..."
            className="pr-10"
          />
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              filterSuspended === "all" 
                ? "bg-primary text-primary-foreground" 
                : "bg-background hover:bg-muted"
            )}
            onClick={() => setFilterSuspended("all")}
          >
            الكل
          </button>
          <button
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              filterSuspended === "active" 
                ? "bg-primary text-primary-foreground" 
                : "bg-background hover:bg-muted"
            )}
            onClick={() => setFilterSuspended("active")}
          >
            نشط
          </button>
          <button
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              filterSuspended === "suspended" 
                ? "bg-primary text-primary-foreground" 
                : "bg-background hover:bg-muted"
            )}
            onClick={() => setFilterSuspended("suspended")}
          >
            موقوف
          </button>
        </div>
        <Button variant="outline" onClick={() => refetch()} size="icon">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Customers List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold">لا يوجد عملاء</h3>
            <p className="text-sm text-muted-foreground">لم يسجل أي عميل في المجتمع بعد</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
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
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={customer.avatar_url || undefined} />
                      <AvatarFallback>
                        {customer.display_name?.charAt(0) || "؟"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{customer.display_name || "بدون اسم"}</h3>
                        {customer.is_verified && (
                          <CheckCircle className="h-4 w-4 text-blue-500" />
                        )}
                        {customer.is_suspended && (
                          <Badge variant="destructive" className="text-xs">موقوف</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {customer.total_requests_made || 0} طلب
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          {(customer.reputation_score || 0).toFixed(1)}
                        </span>
                        <span>
                          انضم {format(new Date(customer.created_at), "dd MMM yyyy", { locale: ar })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Eye className="h-4 w-4" />
                    إدارة
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Customer Detail Dialog */}
      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              إدارة العميل
            </DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Customer Header */}
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl mb-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedCustomer.avatar_url || undefined} />
                  <AvatarFallback className="text-xl">
                    {selectedCustomer.display_name?.charAt(0) || "؟"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{selectedCustomer.display_name || "بدون اسم"}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ID: {selectedCustomer.user_id.slice(0, 8)}...
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {selectedCustomer.is_verified && (
                      <Badge className="bg-blue-500/20 text-blue-500">موثق</Badge>
                    )}
                    {selectedCustomer.is_suspended && (
                      <Badge variant="destructive">موقوف</Badge>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={exportCustomerData} className="gap-2">
                  <Download className="h-4 w-4" />
                  تصدير
                </Button>
              </div>

              {/* Tabs */}
              <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="info" className="gap-2">
                    <User className="h-4 w-4" />
                    المعلومات
                  </TabsTrigger>
                  <TabsTrigger value="requests" className="gap-2">
                    <FileText className="h-4 w-4" />
                    الطلبات ({customerRequests.length})
                  </TabsTrigger>
                  <TabsTrigger value="conversations" className="gap-2">
                    <MessageCircle className="h-4 w-4" />
                    المحادثات ({customerConversations.length})
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 mt-4">
                  <TabsContent value="info" className="m-0">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-muted/20 rounded-lg">
                          <div className="text-xl font-bold">{selectedCustomer.total_requests_made || 0}</div>
                          <div className="text-xs text-muted-foreground">طلبات مقدمة</div>
                        </div>
                        <div className="p-3 bg-muted/20 rounded-lg">
                          <div className="text-xl font-bold">{(selectedCustomer.reputation_score || 0).toFixed(1)}</div>
                          <div className="text-xs text-muted-foreground">التقييم</div>
                        </div>
                      </div>

                      {selectedCustomer.bio && (
                        <div className="p-3 bg-muted/20 rounded-lg">
                          <span className="text-sm text-muted-foreground">النبذة</span>
                          <p className="text-sm mt-1">{selectedCustomer.bio}</p>
                        </div>
                      )}

                      <div className="p-3 bg-muted/20 rounded-lg">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
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
                        <div className="space-y-3 pt-4 border-t">
                          <label className="text-sm font-medium">سبب الإيقاف</label>
                          <Textarea
                            value={suspensionReason}
                            onChange={(e) => setSuspensionReason(e.target.value)}
                            placeholder="اكتب سبب إيقاف الحساب..."
                          />
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="requests" className="m-0">
                    {requestsLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                      </div>
                    ) : customerRequests.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p>لا توجد طلبات</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {customerRequests.map(request => (
                          <div 
                            key={request.id} 
                            className="p-3 bg-muted/20 rounded-lg flex items-center justify-between"
                          >
                            <div>
                              <p className="font-medium text-sm">{request.title}</p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                <span>{format(new Date(request.created_at), "dd MMM", { locale: ar })}</span>
                                {request.customer_governorate && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {request.customer_governorate}
                                  </span>
                                )}
                                {request.quantity && <span>الكمية: {request.quantity}</span>}
                              </div>
                            </div>
                            <Badge variant={
                              request.status === "approved" ? "default" :
                              request.status === "pending" ? "secondary" :
                              request.status === "completed" ? "outline" :
                              "destructive"
                            }>
                              {request.status === "approved" ? "منشور" :
                               request.status === "pending" ? "قيد المراجعة" :
                               request.status === "completed" ? "مكتمل" :
                               "مرفوض"}
                            </Badge>
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
                          <div 
                            key={conv.id} 
                            className="p-3 bg-muted/20 rounded-lg flex items-center justify-between"
                          >
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

              <DialogFooter className="mt-4 pt-4 border-t">
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
