import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText, Search, Eye, Trash2, CheckCircle, XCircle,
  Image as ImageIcon, Video, MapPin, Clock, User, Package,
  AlertTriangle, ExternalLink, RefreshCw, Filter
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PrintRequest {
  id: string;
  user_id: string;
  title: string;
  description: string;
  size: string;
  colors: string;
  quantity: number | null;
  material_type: string | null;
  customer_governorate: string | null;
  images: string[] | null;
  image_url: string | null;
  video_url: string | null;
  status: string;
  created_at: string;
  notes: string | null;
  admin_notes: string | null;
  accepted_offer_id: string | null;
  profile?: {
    username: string | null;
    avatar_url: string | null;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "قيد المراجعة", color: "bg-amber-500/15 text-amber-600", icon: Clock },
  approved: { label: "منشور", color: "bg-emerald-500/15 text-emerald-600", icon: CheckCircle },
  rejected: { label: "مرفوض", color: "bg-red-500/15 text-red-600", icon: XCircle },
  completed: { label: "مكتمل", color: "bg-blue-500/15 text-blue-600", icon: Package },
};

export default function AdminCommunityRequests() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<PrintRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-community-requests", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("community_print_requests")
        .select(`
          id, user_id, title, description, size, colors, quantity,
          material_type, customer_governorate, images, image_url, video_url,
          status, created_at, notes, admin_notes, accepted_offer_id
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch user profiles
      const userIds = [...new Set(data?.map(r => r.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return (data || []).map(r => ({
        ...r,
        profile: profileMap.get(r.user_id),
      })) as PrintRequest[];
    },
  });

  const filteredRequests = requests.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.profile?.username?.toLowerCase().includes(q)
    );
  });

  const approveRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("community_print_requests")
        .update({ 
          status: "approved",
          admin_notes: adminNotes || null,
        })
        .eq("id", requestId);
      if (error) throw error;

      // Send notification to user
      const request = requests.find(r => r.id === requestId);
      if (request) {
        await supabase.from("notifications").insert({
          user_id: request.user_id,
          title: "تم نشر طلبك ✓",
          message: `تم الموافقة على طلب "${request.title}" وأصبح مرئياً للتجار.`,
          type: "success",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-community-requests"] });
      toast.success("تم نشر الطلب");
      setSelectedRequest(null);
      setAdminNotes("");
    },
    onError: () => toast.error("فشل نشر الطلب"),
  });

  const rejectRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      if (!rejectReason.trim()) throw new Error("يجب تحديد سبب الرفض");

      const { error } = await supabase
        .from("community_print_requests")
        .update({ 
          status: "rejected",
          admin_notes: rejectReason,
        })
        .eq("id", requestId);
      if (error) throw error;

      // Send notification to user
      const request = requests.find(r => r.id === requestId);
      if (request) {
        await supabase.from("notifications").insert({
          user_id: request.user_id,
          title: "تم رفض طلبك",
          message: `تم رفض طلب "${request.title}". السبب: ${rejectReason}`,
          type: "error",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-community-requests"] });
      toast.success("تم رفض الطلب");
      setSelectedRequest(null);
      setRejectReason("");
    },
    onError: (err: any) => toast.error(err.message || "فشل رفض الطلب"),
  });

  const deleteRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      // Delete related offers first
      await supabase
        .from("print_offers")
        .delete()
        .eq("request_id", requestId);

      // Delete the request
      const { error } = await supabase
        .from("community_print_requests")
        .delete()
        .eq("id", requestId);
      if (error) throw error;

      // Send notification
      const request = requests.find(r => r.id === requestId);
      if (request) {
        await supabase.from("notifications").insert({
          user_id: request.user_id,
          title: "تم حذف طلبك",
          message: `تم حذف طلب "${request.title}" من قبل الإدارة. السبب: ${adminNotes || "مخالفة للشروط"}`,
          type: "warning",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-community-requests"] });
      toast.success("تم حذف الطلب");
      setSelectedRequest(null);
      setShowDeleteConfirm(false);
      setAdminNotes("");
    },
    onError: () => toast.error("فشل حذف الطلب"),
  });

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === "pending").length,
    approved: requests.filter(r => r.status === "approved").length,
    rejected: requests.filter(r => r.status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">إجمالي الطلبات</div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-500">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">قيد المراجعة</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-500">{stats.approved}</div>
            <div className="text-xs text-muted-foreground">منشور</div>
          </CardContent>
        </Card>
        <Card className="border-red-500/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-500">{stats.rejected}</div>
            <div className="text-xs text-muted-foreground">مرفوض</div>
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
            placeholder="البحث بالعنوان أو الوصف أو اسم المستخدم..."
            className="pr-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 ml-2" />
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="pending">قيد المراجعة</SelectItem>
            <SelectItem value="approved">منشور</SelectItem>
            <SelectItem value="rejected">مرفوض</SelectItem>
            <SelectItem value="completed">مكتمل</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => refetch()} size="icon">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Requests List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold">لا توجد طلبات</h3>
            <p className="text-sm text-muted-foreground">لم يتم العثور على طلبات مطابقة</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map(request => {
            const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;
            const hasMedia = request.images?.length || request.image_url || request.video_url;

            return (
              <Card 
                key={request.id} 
                className="hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedRequest(request);
                  setAdminNotes(request.admin_notes || "");
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* User Avatar */}
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={request.profile?.avatar_url || undefined} />
                      <AvatarFallback>
                        {request.profile?.username?.charAt(0) || "؟"}
                      </AvatarFallback>
                    </Avatar>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-foreground truncate">
                            {request.title}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            @{request.profile?.username || "مجهول"} • {format(new Date(request.created_at), "dd MMM yyyy HH:mm", { locale: ar })}
                          </p>
                        </div>
                        <Badge className={cn("shrink-0", statusConfig.color)}>
                          <StatusIcon className="h-3 w-3 ml-1" />
                          {statusConfig.label}
                        </Badge>
                      </div>

                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {request.description}
                      </p>

                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                        {request.customer_governorate && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {request.customer_governorate}
                          </span>
                        )}
                        <span>الحجم: {request.size}</span>
                        <span>الألوان: {request.colors}</span>
                        {request.quantity && <span>الكمية: {request.quantity}</span>}
                        {hasMedia && (
                          <span className="flex items-center gap-1 text-primary">
                            {request.video_url ? <Video className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                            مرفقات
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Preview Image */}
                    {(request.images?.[0] || request.image_url) && (
                      <div className="h-16 w-16 rounded-lg overflow-hidden shrink-0 border">
                        <img
                          src={request.images?.[0] || request.image_url || ""}
                          alt="صورة"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Request Detail Dialog */}
      <Dialog open={!!selectedRequest && !showDeleteConfirm} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              تفاصيل الطلب
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              {/* User Info */}
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={selectedRequest.profile?.avatar_url || undefined} />
                  <AvatarFallback>
                    {selectedRequest.profile?.username?.charAt(0) || "؟"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">@{selectedRequest.profile?.username || "مجهول"}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(selectedRequest.created_at), "dd MMMM yyyy - HH:mm", { locale: ar })}
                  </p>
                </div>
                <Badge className={cn("mr-auto", STATUS_CONFIG[selectedRequest.status]?.color)}>
                  {STATUS_CONFIG[selectedRequest.status]?.label}
                </Badge>
              </div>

              {/* Request Details */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-bold text-lg">{selectedRequest.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{selectedRequest.description}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="p-2 bg-muted/20 rounded-lg">
                    <span className="text-muted-foreground">الحجم</span>
                    <p className="font-medium">{selectedRequest.size}</p>
                  </div>
                  <div className="p-2 bg-muted/20 rounded-lg">
                    <span className="text-muted-foreground">الألوان</span>
                    <p className="font-medium">{selectedRequest.colors}</p>
                  </div>
                  <div className="p-2 bg-muted/20 rounded-lg">
                    <span className="text-muted-foreground">الكمية</span>
                    <p className="font-medium">{selectedRequest.quantity || 1}</p>
                  </div>
                  <div className="p-2 bg-muted/20 rounded-lg">
                    <span className="text-muted-foreground">المادة</span>
                    <p className="font-medium">{selectedRequest.material_type || "غير محدد"}</p>
                  </div>
                </div>

                {selectedRequest.customer_governorate && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>المحافظة: {selectedRequest.customer_governorate}</span>
                  </div>
                )}

                {selectedRequest.notes && (
                  <div className="p-3 bg-muted/20 rounded-lg">
                    <span className="text-sm text-muted-foreground">ملاحظات العميل:</span>
                    <p className="text-sm mt-1">{selectedRequest.notes}</p>
                  </div>
                )}
              </div>

              {/* Media */}
              {(selectedRequest.images?.length || selectedRequest.image_url || selectedRequest.video_url) && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">المرفقات</h4>
                  <div className="flex flex-wrap gap-2">
                    {(selectedRequest.images || [selectedRequest.image_url].filter(Boolean)).map((url, i) => (
                      <a
                        key={i}
                        href={url || ""}
                        target="_blank"
                        rel="noreferrer"
                        className="h-20 w-20 rounded-lg overflow-hidden border hover:opacity-80 transition-opacity"
                      >
                        <img src={url || ""} alt={`صورة ${i + 1}`} className="h-full w-full object-cover" />
                      </a>
                    ))}
                    {selectedRequest.video_url && (
                      <a
                        href={selectedRequest.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="h-20 w-20 rounded-lg border flex items-center justify-center bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <Video className="h-6 w-6 text-primary" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Admin Notes */}
              {selectedRequest.status === "pending" ? (
                <div className="space-y-3 pt-4 border-t">
                  <div>
                    <label className="text-sm font-medium">ملاحظات الإدارة (اختياري)</label>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="أضف ملاحظات للسجل..."
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-destructive">سبب الرفض (مطلوب للرفض)</label>
                    <Textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="اكتب سبب الرفض إذا أردت رفض الطلب..."
                      className="mt-1.5 border-destructive/30"
                    />
                  </div>
                </div>
              ) : selectedRequest.admin_notes && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <span className="text-sm font-medium text-amber-600">ملاحظات الإدارة:</span>
                  <p className="text-sm mt-1">{selectedRequest.admin_notes}</p>
                </div>
              )}

              <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
                {selectedRequest.status === "pending" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      حذف
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => rejectRequestMutation.mutate(selectedRequest.id)}
                      disabled={!rejectReason.trim() || rejectRequestMutation.isPending}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      {rejectRequestMutation.isPending ? "جارٍ الرفض..." : "رفض"}
                    </Button>
                    <Button
                      onClick={() => approveRequestMutation.mutate(selectedRequest.id)}
                      disabled={approveRequestMutation.isPending}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {approveRequestMutation.isPending ? "جارٍ النشر..." : "نشر الطلب"}
                    </Button>
                  </>
                )}
                {selectedRequest.status !== "pending" && (
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    حذف الطلب
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              تأكيد الحذف
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف هذا الطلب؟ سيتم إخطار العميل بالحذف.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">سبب الحذف</label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="اكتب سبب حذف الطلب..."
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedRequest && deleteRequestMutation.mutate(selectedRequest.id)}
              disabled={deleteRequestMutation.isPending}
            >
              {deleteRequestMutation.isPending ? "جارٍ الحذف..." : "تأكيد الحذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
