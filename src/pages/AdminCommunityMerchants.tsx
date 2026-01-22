import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Store, Filter, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import AdminLayout, { AdminSection } from "@/components/admin/AdminLayout";
import { ADMIN_ROUTES } from "@/config/adminConfig";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

const rowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  display_name: z.string().nullable().optional(),
  phone_number: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  status: z.string(),
  admin_notes: z.string().nullable().optional(),
  created_at: z.string(),
});

type Row = z.infer<typeof rowSchema>;

export default function AdminCommunityMerchants() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Row | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-merchant-applications", status, q],
    queryFn: async () => {
      let query = supabase
        .from("merchant_applications")
        .select("id, user_id, display_name, phone_number, city, bio, status, admin_notes, created_at")
        .order("created_at", { ascending: false });

      if (status !== "all") query = query.eq("status", status);
      if (q.trim()) query = query.ilike("display_name", `%${q.trim()}%`);

      const { data, error } = await query;
      if (error) throw error;
      return z.array(rowSchema).parse(data ?? []);
    },
    staleTime: 10_000,
  });

  const rows = data ?? [];

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    for (const r of rows) {
      if (r.status === "pending") c.pending++;
      if (r.status === "approved") c.approved++;
      if (r.status === "rejected") c.rejected++;
    }
    return c;
  }, [rows]);

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; status: string; admin_notes?: string | null }) => {
      const { error } = await supabase
        .from("merchant_applications")
        .update({ status: payload.status, admin_notes: payload.admin_notes ?? null })
        .eq("id", payload.id);
      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-merchant-applications"] });
      toast({ title: "تم تحديث الحالة" });
      setOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "تعذر التحديث", description: err?.message ?? "حدث خطأ", variant: "destructive" });
    },
  });

  return (
    <AdminLayout
      title="طلبات تسجيل التجار"
      description="مراجعة طلبات التسجيل كتاجر (موافقة/رفض/ملاحظات)"
      icon={<Store className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.dashboard}
      maxWidth="6xl"
      actions={
        <Button variant="outline" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          تحديث
        </Button>
      }
    >
      <AdminSection
        title="التصفية"
        actions={
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="pending">قيد المراجعة</SelectItem>
                <SelectItem value="approved">مقبول</SelectItem>
                <SelectItem value="rejected">مرفوض</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Pending: {counts.pending}</span>
            <span>Approved: {counts.approved}</span>
            <span>Rejected: {counts.rejected}</span>
          </div>
        </div>
      </AdminSection>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">لا توجد طلبات حالياً.</Card>
        ) : (
          rows.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold truncate">{r.display_name ?? "(بدون اسم)"}</p>
                    <Badge variant="outline">{r.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    {r.phone_number ?? "—"} • {r.city ?? "—"}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{r.bio ?? "—"}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setActive(r);
                    setAdminNotes(r.admin_notes ?? "");
                    setOpen(true);
                  }}
                >
                  مراجعة
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>مراجعة الطلب</DialogTitle>
            <DialogDescription>يمكنك الموافقة/الرفض وإضافة ملاحظات.</DialogDescription>
          </DialogHeader>

          {active && (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-sm font-semibold">{active.display_name ?? "(بدون اسم)"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{active.user_id}</p>
              </div>
              <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} className="min-h-24" />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => active && updateMutation.mutate({ id: active.id, status: "rejected", admin_notes: adminNotes || null })}
              disabled={!active || updateMutation.isPending}
              className="gap-2"
            >
              <XCircle className="h-4 w-4" />
              رفض
            </Button>
            <Button
              onClick={() => active && updateMutation.mutate({ id: active.id, status: "approved", admin_notes: adminNotes || null })}
              disabled={!active || updateMutation.isPending}
              className="gap-2 bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
            >
              <CheckCircle2 className="h-4 w-4" />
              موافقة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
