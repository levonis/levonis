import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ShieldCheck, CheckCircle2, XCircle, TrendingDown, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type ClaimStatus = "pending" | "awaiting_admin" | "processed" | "rejected";

interface AdminClaim {
  id: string;
  user_id: string;
  order_id: string;
  product_id: string;
  product_name_ar: string | null;
  product_image: string | null;
  order_number: string | null;
  purchase_date: string;
  old_price: number;
  new_price: number;
  price_difference: number;
  quantity: number;
  total_refund: number;
  status: ClaimStatus;
  refunded_amount: number | null;
  rejection_reason: string | null;
  user_requested_at: string | null;
  created_at: string;
}

export default function AdminPriceProtection() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<ClaimStatus>("awaiting_admin");
  const [approveOpen, setApproveOpen] = useState<AdminClaim | null>(null);
  const [rejectOpen, setRejectOpen] = useState<AdminClaim | null>(null);
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState<string>("");

  const { data: claims, isLoading } = useQuery({
    queryKey: ["admin-price-protection", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_protection_claims")
        .select("*")
        .eq("status", tab)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AdminClaim[];
    },
  });

  const userIds = Array.from(new Set((claims ?? []).map((c) => c.user_id)));
  const { data: users } = useQuery({
    queryKey: ["admin-pp-users", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, username, avatar_url").in("id", userIds);
      const map: Record<string, any> = {};
      (data ?? []).forEach((u: any) => { map[u.id] = u; });
      return map;
    },
  });

  const approve = useMutation({
    mutationFn: async () => {
      if (!approveOpen) return;
      const amount = Number(refundAmount);
      if (!amount || amount <= 0) throw new Error("أدخل مبلغاً صحيحاً");
      const { data, error } = await (supabase.rpc as any)("approve_price_protection_claim", {
        p_claim_id: approveOpen.id,
        p_refund_amount: amount,
        p_admin_notes: adminNotes || null,
      });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error ?? "فشل");
    },
    onSuccess: () => {
      toast.success("تمت الموافقة وإيداع المبلغ في محفظة المستخدم");
      qc.invalidateQueries({ queryKey: ["admin-price-protection"] });
      setApproveOpen(null);
      setRefundAmount("");
      setAdminNotes("");
    },
    onError: (e: any) => toast.error(e?.message ?? "خطأ"),
  });

  const reject = useMutation({
    mutationFn: async () => {
      if (!rejectOpen) return;
      if (!rejectionReason.trim()) throw new Error("اكتب سبب الرفض");
      const { data, error } = await (supabase.rpc as any)("reject_price_protection_claim", {
        p_claim_id: rejectOpen.id,
        p_reason: rejectionReason.trim(),
      });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error ?? "فشل");
    },
    onSuccess: () => {
      toast.success("تم رفض الطلب");
      qc.invalidateQueries({ queryKey: ["admin-price-protection"] });
      setRejectOpen(null);
      setRejectionReason("");
    },
    onError: (e: any) => toast.error(e?.message ?? "خطأ"),
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">طلبات حماية السعر</h1>
          <p className="text-xs text-muted-foreground">مراجعة ومعالجة طلبات استرداد فرق السعر</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ClaimStatus)}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="awaiting_admin">قيد المراجعة</TabsTrigger>
          <TabsTrigger value="pending">مكتشف تلقائياً</TabsTrigger>
          <TabsTrigger value="processed">تمت المعالجة</TabsTrigger>
          <TabsTrigger value="rejected">مرفوض</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
            </div>
          ) : claims && claims.length > 0 ? (
            <div className="space-y-3">
              {claims.map((c) => {
                const u = users?.[c.user_id];
                return (
                  <Card key={c.id} className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                      {/* Product */}
                      <div className="flex gap-3 flex-1 min-w-0">
                        {c.product_image ? (
                          <img src={c.product_image} alt="" className="h-20 w-20 rounded-xl object-cover border" loading="lazy" decoding="async" />
                        ) : <div className="h-20 w-20 rounded-xl bg-muted" />}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm line-clamp-1">{c.product_name_ar ?? "منتج"}</h3>
                          <p className="text-xs text-muted-foreground font-mono">#{c.order_number ?? c.order_id.slice(0, 8)}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {u?.avatar_url && <img src={u.avatar_url} alt="" className="h-5 w-5 rounded-full" loading="lazy" decoding="async" />}
                            <span className="text-xs text-foreground font-semibold">{u?.full_name ?? u?.username ?? "—"}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            تاريخ الشراء: {new Date(c.purchase_date).toLocaleDateString("ar-IQ")}
                          </p>
                        </div>
                      </div>

                      {/* Prices */}
                      <div className="grid grid-cols-3 gap-2 md:w-[360px] rounded-xl bg-muted/30 p-3">
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground">السابق</p>
                          <p className="text-sm font-bold line-through opacity-70 tabular-nums">
                            {Number(c.old_price).toLocaleString("ar-IQ")}
                          </p>
                        </div>
                        <div className="text-center border-x">
                          <p className="text-[10px] text-muted-foreground">الحالي</p>
                          <p className="text-sm font-bold tabular-nums">{Number(c.new_price).toLocaleString("ar-IQ")}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-emerald-700">الفرق × {c.quantity}</p>
                          <p className="text-sm font-bold text-emerald-600 tabular-nums flex items-center justify-center gap-1">
                            <TrendingDown className="h-3 w-3" />
                            {Number(c.total_refund).toLocaleString("ar-IQ")}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex md:flex-col gap-2 md:w-[140px]">
                        {(c.status === "awaiting_admin" || c.status === "pending") ? (
                          <>
                            <Button
                              size="sm"
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => {
                                setApproveOpen(c);
                                setRefundAmount(String(Math.round(c.total_refund)));
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4 ml-1" /> موافقة
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-rose-600 border-rose-300 hover:bg-rose-50"
                              onClick={() => setRejectOpen(c)}
                            >
                              <XCircle className="h-4 w-4 ml-1" /> رفض
                            </Button>
                          </>
                        ) : c.status === "processed" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 self-center">
                            تم استرداد {Number(c.refunded_amount ?? c.total_refund).toLocaleString("ar-IQ")} د.ع
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-rose-700 border-rose-300 self-center">
                            مرفوض
                          </Badge>
                        )}
                      </div>
                    </div>

                    {c.rejection_reason && (
                      <div className="mt-3 rounded-lg bg-rose-500/5 border border-rose-500/20 p-2 text-xs text-rose-700">
                        سبب الرفض: {c.rejection_reason}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">لا توجد طلبات</div>
          )}
        </TabsContent>
      </Tabs>

      {/* Approve dialog */}
      <Dialog open={!!approveOpen} onOpenChange={(o) => !o && setApproveOpen(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إيداع فرق السعر في محفظة المستخدم</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold mb-1 block">مبلغ الاسترداد (د.ع)</label>
              <Input
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="text-lg font-bold tabular-nums"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                الفرق المحسوب: {approveOpen ? Number(approveOpen.total_refund).toLocaleString("ar-IQ") : 0} د.ع
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">ملاحظات (اختياري)</label>
              <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(null)}>إلغاء</Button>
            <Button onClick={() => approve.mutate()} disabled={approve.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {approve.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              تأكيد الإيداع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectOpen} onOpenChange={(o) => !o && setRejectOpen(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>رفض طلب حماية السعر</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-xs font-semibold mb-1 block">سبب الرفض</label>
            <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => reject.mutate()} disabled={reject.isPending}>
              {reject.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              تأكيد الرفض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
