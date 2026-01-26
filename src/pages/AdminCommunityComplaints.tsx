import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Eye, CheckCircle, XCircle, Clock, MessageSquare, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout, { AdminSection } from "@/components/admin/AdminLayout";
import { ADMIN_ROUTES } from "@/config/adminConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

interface Complaint {
  id: string;
  complainant_id: string;
  reported_user_id: string | null;
  reported_merchant_id: string | null;
  complaint_type: string;
  title: string;
  description: string;
  images: string[];
  status: string;
  priority: string;
  admin_notes: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  embedded?: boolean;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "قيد الانتظار", color: "bg-yellow-500/20 text-yellow-400", icon: <Clock className="h-3 w-3" /> },
  investigating: { label: "قيد التحقيق", color: "bg-blue-500/20 text-blue-400", icon: <Eye className="h-3 w-3" /> },
  resolved: { label: "تم الحل", color: "bg-green-500/20 text-green-400", icon: <CheckCircle className="h-3 w-3" /> },
  rejected: { label: "مرفوض", color: "bg-red-500/20 text-red-400", icon: <XCircle className="h-3 w-3" /> },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "منخفض", color: "bg-gray-500/20 text-gray-400" },
  normal: { label: "عادي", color: "bg-blue-500/20 text-blue-400" },
  high: { label: "عالي", color: "bg-orange-500/20 text-orange-400" },
  urgent: { label: "عاجل", color: "bg-red-500/20 text-red-400" },
};

function ComplaintsContent() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [resolution, setResolution] = useState("");

  const { data: complaints, isLoading } = useQuery({
    queryKey: ["community-complaints", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("community_complaints")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Complaint[];
    },
  });

  const updateComplaint = useMutation({
    mutationFn: async ({ id, status, admin_notes, resolution }: { id: string; status: string; admin_notes?: string; resolution?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const updateData: Record<string, unknown> = { status };
      if (admin_notes) updateData.admin_notes = admin_notes;
      if (resolution) {
        updateData.resolution = resolution;
        updateData.resolved_by = user?.id;
        updateData.resolved_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from("community_complaints")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-complaints"] });
      setSelectedComplaint(null);
      toast.success("تم تحديث الشكوى بنجاح");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء تحديث الشكوى");
    },
  });

  const handleResolve = () => {
    if (!selectedComplaint) return;
    updateComplaint.mutate({
      id: selectedComplaint.id,
      status: "resolved",
      admin_notes: adminNotes,
      resolution,
    });
  };

  const handleReject = () => {
    if (!selectedComplaint) return;
    updateComplaint.mutate({
      id: selectedComplaint.id,
      status: "rejected",
      admin_notes: adminNotes,
    });
  };

  const stats = {
    total: complaints?.length || 0,
    pending: complaints?.filter(c => c.status === "pending").length || 0,
    investigating: complaints?.filter(c => c.status === "investigating").length || 0,
    resolved: complaints?.filter(c => c.status === "resolved").length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="levo-card-frame">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">إجمالي الشكاوى</div>
          </CardContent>
        </Card>
        <Card className="levo-card-frame border-yellow-500/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">قيد الانتظار</div>
          </CardContent>
        </Card>
        <Card className="levo-card-frame border-blue-500/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.investigating}</div>
            <div className="text-xs text-muted-foreground">قيد التحقيق</div>
          </CardContent>
        </Card>
        <Card className="levo-card-frame border-green-500/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{stats.resolved}</div>
            <div className="text-xs text-muted-foreground">تم الحل</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="فلترة حسب الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الشكاوى</SelectItem>
            <SelectItem value="pending">قيد الانتظار</SelectItem>
            <SelectItem value="investigating">قيد التحقيق</SelectItem>
            <SelectItem value="resolved">تم الحل</SelectItem>
            <SelectItem value="rejected">مرفوض</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Complaints List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : complaints?.length === 0 ? (
        <Card className="levo-card-frame">
          <CardContent className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">لا توجد شكاوى</h3>
            <p className="text-sm text-muted-foreground">لم يتم تقديم أي شكاوى حتى الآن</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {complaints?.map((complaint) => (
            <Card key={complaint.id} className="levo-card-frame hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground truncate">{complaint.title}</h3>
                      <Badge className={statusConfig[complaint.status]?.color || ""}>
                        {statusConfig[complaint.status]?.icon}
                        <span className="mr-1">{statusConfig[complaint.status]?.label}</span>
                      </Badge>
                      <Badge className={priorityConfig[complaint.priority]?.color || ""}>
                        {priorityConfig[complaint.priority]?.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {complaint.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        {format(new Date(complaint.created_at), "dd MMM yyyy - HH:mm", { locale: ar })}
                      </span>
                      <span>نوع: {complaint.complaint_type}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedComplaint(complaint);
                      setAdminNotes(complaint.admin_notes || "");
                      setResolution(complaint.resolution || "");
                    }}
                  >
                    <Eye className="h-4 w-4 ml-1" />
                    عرض
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Complaint Detail Dialog */}
      <Dialog open={!!selectedComplaint} onOpenChange={() => setSelectedComplaint(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              تفاصيل الشكوى
            </DialogTitle>
          </DialogHeader>
          
          {selectedComplaint && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{selectedComplaint.title}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={statusConfig[selectedComplaint.status]?.color || ""}>
                    {statusConfig[selectedComplaint.status]?.label}
                  </Badge>
                  <Badge className={priorityConfig[selectedComplaint.priority]?.color || ""}>
                    {priorityConfig[selectedComplaint.priority]?.label}
                  </Badge>
                </div>
              </div>

              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{selectedComplaint.description}</p>
              </div>

              {selectedComplaint.images?.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {selectedComplaint.images.map((img, i) => (
                    <img key={i} src={img} alt="" className="rounded-lg object-cover aspect-square" />
                  ))}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">ملاحظات الإدارة</label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="أضف ملاحظاتك هنا..."
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">القرار / الحل</label>
                  <Textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="اكتب القرار أو الحل المتخذ..."
                    className="mt-1"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                {selectedComplaint.status === "pending" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      updateComplaint.mutate({
                        id: selectedComplaint.id,
                        status: "investigating",
                        admin_notes: adminNotes,
                      });
                    }}
                  >
                    <Eye className="h-4 w-4 ml-1" />
                    بدء التحقيق
                  </Button>
                )}
                <Button variant="destructive" onClick={handleReject}>
                  <XCircle className="h-4 w-4 ml-1" />
                  رفض
                </Button>
                <Button onClick={handleResolve} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="h-4 w-4 ml-1" />
                  حل الشكوى
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminCommunityComplaints({ embedded }: Props) {
  if (embedded) {
    return <ComplaintsContent />;
  }

  return (
    <AdminLayout
      title="الشكاوى والنزاعات"
      description="مراجعة الشكاوى والتدخل في النزاعات بين التجار والزبائن"
      icon={<AlertTriangle className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.levoCommunity}
      maxWidth="6xl"
    >
      <ComplaintsContent />
    </AdminLayout>
  );
}
