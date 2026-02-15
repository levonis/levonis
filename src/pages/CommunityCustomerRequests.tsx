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
  ShieldAlert,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import RateRequestButton from "@/components/merchant/RateRequestButton";

export default function CommunityCustomerRequests() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSize, setEditSize] = useState("");
  const [editColors, setEditColors] = useState("");

  const requestSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    size: z.string().nullable().optional(),
    colors: z.string().nullable().optional(),
    reference_links: z.array(z.string()).nullable().default([]),
    images: z.array(z.string()).nullable().optional(),
    status: z.string(),
    admin_notes: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    accepted_at: z.string().nullable().optional(),
    delivered_at: z.string().nullable().optional(),
    customer_confirmed_at: z.string().nullable().optional(),
  });
  type PrintRequest = z.infer<typeof requestSchema>;

  const { data, isLoading } = useQuery({
    queryKey: ["my-print-requests", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_print_requests")
        .select(
          "id, user_id, title, description, notes, size, colors, reference_links, images, status, admin_notes, created_at, updated_at, accepted_at, delivered_at, customer_confirmed_at"
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return z.array(requestSchema).parse(data ?? []);
    },
    staleTime: 20_000,
  });

  const requests = data ?? [];

  const statusUi = useMemo(() => {
    const map: Record<PrintRequest["status"], { label: string; icon: any; variant?: "default" | "secondary" | "destructive" | "outline" }>
      = {
        pending_review: { label: "قيد المراجعة", icon: Clock, variant: "secondary" },
        approved: { label: "مقبول", icon: CheckCircle2, variant: "outline" },
        rejected: { label: "مرفوض", icon: XCircle, variant: "destructive" },
        in_progress: { label: "قيد التنفيذ", icon: Package, variant: "outline" },
        completed: { label: "مكتمل", icon: CheckCircle2, variant: "outline" },
        delivered: { label: "تم التوصيل", icon: Truck, variant: "outline" },
        cancelled: { label: "ملغي", icon: XCircle, variant: "secondary" },
      };
    return map;
  }, []);

  const openEdit = (r: PrintRequest) => {
    setEditingId(r.id);
    setEditTitle(r.title ?? "");
    setEditDescription(r.description ?? "");
    setEditNotes(r.notes ?? "");
    setEditSize(r.size ?? "");
    setEditColors(r.colors ?? "");
  };

  const canEditOrDelete = (r: PrintRequest) => r.status === "pending_review" || r.status === "pending" || r.status === "rejected";

  const editSchema = z.object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(1500).optional().or(z.literal("")),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
    size: z.string().trim().max(120).optional().or(z.literal("")),
    colors: z.string().trim().max(120).optional().or(z.literal("")),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; values: z.infer<typeof editSchema> }) => {
      const parsed = editSchema.parse(payload.values);
      const { error } = await supabase
        .from("community_print_requests")
        .update({
          title: parsed.title,
          description: parsed.description?.trim() ? parsed.description.trim() : null,
          notes: parsed.notes?.trim() ? parsed.notes.trim() : null,
          size: parsed.size?.trim() ? parsed.size.trim() : null,
          colors: parsed.colors?.trim() ? parsed.colors.trim() : null,
        })
        .eq("id", payload.id);
      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-print-requests", user?.id] });
      toast({ title: "تم حفظ التعديل", description: "سيتم مراجعة طلبك من قبل الإدارة" });
      setEditingId(null);
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
      await qc.invalidateQueries({ queryKey: ["my-print-requests", user?.id] });
      toast({ title: "تم حذف الطلب" });
    },
    onError: (err: any) => {
      toast({ title: "تعذر حذف الطلب", description: err?.message ?? "حدث خطأ", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 pt-24 max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-primary">طلباتي</h1>
              <p className="text-sm text-muted-foreground">واجهة مبدئية — سيتم ربطها لاحقاً</p>
            </div>
          </div>

          <Button variant="outline" onClick={() => navigate('/community/customer')} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
        </header>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              طلباتي
            </CardTitle>
            <CardDescription>قائمة طلباتك مع الحالة وإمكانية التعديل/الحذف (قبل التنفيذ)</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : requests.length === 0 ? (
              <div className="rounded-xl border border-border bg-background/40 p-4">
                <p className="text-sm text-muted-foreground">لا توجد طلبات بعد. ابدأ بإضافة طلب جديد.</p>
                <Button className="mt-3" onClick={() => navigate("/community/customer/new")}>
                  إضافة طلب جديد
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => {
                  const ui = statusUi[r.status];
                  const StatusIcon = ui.icon;
                  const editable = canEditOrDelete(r);

                  return (
                    <div key={r.id} className="rounded-xl border border-border bg-background/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <p className="font-bold truncate">{r.title}</p>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant={ui.variant ?? "secondary"} className="gap-1">
                              <StatusIcon className="h-3.5 w-3.5" />
                              {ui.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(r.created_at).toLocaleDateString("ar-IQ")}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEdit(r)}
                            disabled={!editable}
                            title={!editable ? "لا يمكن التعديل بعد بدء التنفيذ" : "تعديل"}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                disabled={!editable || deleteMutation.isPending}
                                title={!editable ? "لا يمكن الحذف بعد بدء التنفيذ" : "حذف"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>حذف الطلب؟</AlertDialogTitle>
                                <AlertDialogDescription>
                                  سيتم حذف الطلب نهائياً. هذا الإجراء لا يمكن التراجع عنه.
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
                        </div>
                      </div>
                      <RateRequestButton requestId={r.id} requestStatus={r.status} />

                      <Separator className="my-3" />

                      {/* Tracking (inline) */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div className="rounded-lg bg-muted/20 p-3">
                          <p className="text-[11px] text-muted-foreground">المراجعة</p>
                          <p className="mt-1 text-sm font-semibold">{r.status === "pending_review" || r.status === "pending" ? "جارية" : "تم"}</p>
                        </div>
                        <div className="rounded-lg bg-muted/20 p-3">
                          <p className="text-[11px] text-muted-foreground">تم القبول</p>
                          <p className="mt-1 text-sm font-semibold">
                            {r.accepted_at ? new Date(r.accepted_at).toLocaleDateString("ar-IQ") : "—"}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/20 p-3">
                          <p className="text-[11px] text-muted-foreground">تم التوصيل</p>
                          <p className="mt-1 text-sm font-semibold">
                            {r.delivered_at ? new Date(r.delivered_at).toLocaleDateString("ar-IQ") : "—"}
                          </p>
                        </div>
                      </div>

                      {r.status === "rejected" && (r.admin_notes?.trim() ?? "") && (
                        <div className="mt-3 rounded-lg border border-border bg-background/50 p-3">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-primary" />
                            <p className="text-sm font-semibold">سبب الرفض</p>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{r.admin_notes}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!editingId} onOpenChange={(o) => (!o ? setEditingId(null) : null)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>تعديل الطلب</DialogTitle>
              <DialogDescription>بعد الحفظ سيظهر تنبيه: سيتم مراجعة طلبك من قبل الإدارة.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold">العنوان</p>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={120} />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">الوصف</p>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  maxLength={1500}
                  className="min-h-24"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">الحجم</p>
                  <Input value={editSize} onChange={(e) => setEditSize(e.target.value)} maxLength={120} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">الألوان</p>
                  <Input value={editColors} onChange={(e) => setEditColors(e.target.value)} maxLength={120} />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">ملاحظات</p>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} maxLength={500} className="min-h-20" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingId(null)}>
                إلغاء
              </Button>
              <Button
                onClick={() =>
                  editingId &&
                  updateMutation.mutate({
                    id: editingId,
                    values: {
                      title: editTitle,
                      description: editDescription,
                      notes: editNotes,
                      size: editSize,
                      colors: editColors,
                    },
                  })
                }
                disabled={updateMutation.isPending}
                className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
              >
                {updateMutation.isPending ? "جارٍ الحفظ..." : "حفظ"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
