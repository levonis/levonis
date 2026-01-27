import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  ArrowRight,
  FileText,
  Package,
  Pencil,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Eye,
  Plus,
  ChevronDown,
  MapPin,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import RateRequestButton from "@/components/merchant/RateRequestButton";

const requestSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  colors: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  images: z.array(z.string()).nullable().optional(),
  image_url: z.string().nullable().optional(),
  status: z.string(),
  created_at: z.string(),
  quantity: z.number().nullable().optional(),
  customer_governorate: z.string().nullable().optional(),
});
type PrintRequest = z.infer<typeof requestSchema>;

interface CustomerRequestsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewRequest?: () => void;
}

const STATUS_UI: Record<string, { label: string; icon: any; color: string }> = {
  pending_review: { label: "قيد المراجعة", icon: Clock, color: "bg-amber-500/20 text-amber-600" },
  approved: { label: "منشور", icon: CheckCircle2, color: "bg-emerald-500/20 text-emerald-600" },
  rejected: { label: "مرفوض", icon: XCircle, color: "bg-destructive/20 text-destructive" },
  in_progress: { label: "قيد التنفيذ", icon: Package, color: "bg-blue-500/20 text-blue-600" },
  completed: { label: "مكتمل", icon: CheckCircle2, color: "bg-emerald-500/20 text-emerald-600" },
  delivered: { label: "تم التوصيل", icon: Truck, color: "bg-emerald-600/20 text-emerald-700" },
  cancelled: { label: "ملغي", icon: XCircle, color: "bg-muted text-muted-foreground" },
};

export default function CustomerRequestsSheet({
  open,
  onOpenChange,
  onNewRequest,
}: CustomerRequestsSheetProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [selectedRequest, setSelectedRequest] = useState<PrintRequest | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["my-print-requests-sheet", user?.id],
    enabled: !!user?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_print_requests")
        .select("id, user_id, title, description, size, colors, notes, images, image_url, status, created_at, quantity, customer_governorate")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return z.array(requestSchema).parse(data ?? []);
    },
    staleTime: 20_000,
  });

  const requests = data ?? [];

  const canEdit = (r: PrintRequest) => r.status === "pending_review" || r.status === "approved";

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; title: string; description: string }) => {
      const { error } = await supabase
        .from("community_print_requests")
        .update({ title: payload.title, description: payload.description || null })
        .eq("id", payload.id);
      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-print-requests-sheet"] });
      toast({ title: "تم حفظ التعديل" });
      setEditDialogOpen(false);
      setSelectedRequest(null);
    },
    onError: (err: any) => {
      toast({ title: "تعذر حفظ التعديل", description: err?.message ?? "حدث خطأ", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("community_print_requests").delete().eq("id", id);
      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-print-requests-sheet"] });
      toast({ title: "تم حذف الطلب" });
    },
    onError: (err: any) => {
      toast({ title: "تعذر حذف الطلب", description: err?.message ?? "حدث خطأ", variant: "destructive" });
    },
  });

  const openEdit = (r: PrintRequest) => {
    setSelectedRequest(r);
    setEditTitle(r.title ?? "");
    setEditDescription(r.description ?? "");
    setEditDialogOpen(true);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-4 py-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <SheetTitle className="text-base">طلباتي</SheetTitle>
                  <SheetDescription className="text-xs">{requests.length} طلب</SheetDescription>
                </div>
              </div>
              {onNewRequest && (
                <Button size="sm" onClick={onNewRequest} className="h-8 gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  طلب جديد
                </Button>
              )}
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))
              ) : requests.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium">لا توجد طلبات</p>
                  <p className="text-xs text-muted-foreground mb-4">ابدأ بإضافة طلب جديد</p>
                  {onNewRequest && (
                    <Button onClick={onNewRequest}>إضافة طلب جديد</Button>
                  )}
                </div>
              ) : (
                requests.map((r) => {
                  const status = STATUS_UI[r.status] || STATUS_UI.pending_review;
                  const StatusIcon = status.icon;
                  const mainImage = r.images?.[0] || r.image_url;
                  const editable = canEdit(r);

                  return (
                    <div
                      key={r.id}
                      className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-all"
                    >
                      <div className="flex gap-3 p-3">
                        {/* Image */}
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                          {mainImage ? (
                            <img src={mainImage} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-6 w-6 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-bold text-sm truncate">{r.title}</h4>
                            <Badge className={`shrink-0 text-[10px] gap-1 ${status.color}`}>
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                            {r.quantity && r.quantity > 1 && (
                              <span className="flex items-center gap-0.5">
                                <Package className="h-3 w-3" />
                                {r.quantity}×
                              </span>
                            )}
                            {r.customer_governorate && (
                              <span className="flex items-center gap-0.5 text-primary">
                                <MapPin className="h-3 w-3" />
                                {r.customer_governorate}
                              </span>
                            )}
                            <span>{new Date(r.created_at).toLocaleDateString("ar-IQ")}</span>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[10px]"
                              onClick={() => navigate(`/community/messages?request=${r.id}`)}
                            >
                              <Eye className="h-3 w-3 ml-1" />
                              العروض
                            </Button>
                            {editable && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => openEdit(r)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>حذف الطلب؟</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        سيتم حذف الطلب نهائياً.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => deleteMutation.mutate(r.id)}>
                                        حذف
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                            <RateRequestButton requestId={r.id} requestStatus={r.status} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">تعديل الطلب</DialogTitle>
            <DialogDescription className="text-xs">تعديل العنوان والوصف فقط</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">العنوان</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={120} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">الوصف</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                maxLength={1500}
                className="min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>إلغاء</Button>
            <Button
              onClick={() => selectedRequest && updateMutation.mutate({
                id: selectedRequest.id,
                title: editTitle,
                description: editDescription,
              })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
