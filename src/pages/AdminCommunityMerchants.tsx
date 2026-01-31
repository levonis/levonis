import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Store, CheckCircle2, XCircle, Image as ImageIcon, Trash2, ChevronRight, ChevronLeft, Search, Ban, Eye } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { ADMIN_ROUTES } from "@/config/adminConfig";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import MerchantBadgesEditor from "@/components/admin/MerchantBadgesEditor";
import { MerchantBadgesDisplay, BadgeTier } from "@/components/community/MerchantBadges";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const PAGE_SIZE = 50;

const rowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  display_name: z.string().nullable().optional(),
  phone_number: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  store_image_url: z.string().nullable().optional(),
  social_links: z.any().nullable().optional(),
  status: z.string(),
  admin_notes: z.string().nullable().optional(),
  created_at: z.string(),
  is_verified: z.boolean().default(false),
  badge_tier: z.string().default("none"),
  badge_override: z.boolean().default(false),
});

type Row = z.infer<typeof rowSchema>;

interface Props {
  embedded?: boolean;
}

function MerchantsContent() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Row | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [badgeTier, setBadgeTier] = useState<BadgeTier>("none");
  const [badgeOverride, setBadgeOverride] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [rejectionReason, setRejectionReason] = useState("");
  
  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-merchant-applications", status, q, currentPage],
    queryFn: async () => {
      let query = supabase
        .from("merchant_applications")
        .select(
          "id, user_id, display_name, phone_number, city, bio, store_image_url, social_links, status, admin_notes, created_at, is_verified, badge_tier, badge_override",
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      // Filter out incomplete drafts - only show drafts that have completed step 3 (submitted as pending)
      // or those with meaningful data (display_name filled)
      if (status === "all") {
        // Hide drafts that have no store name OR are still incomplete
        query = query.or('status.eq.pending,status.eq.approved,status.eq.rejected');
      } else if (status === "draft") {
        // Drafts tab should be hidden or empty - users must complete all steps to submit
        query = query.eq("status", "draft").not("display_name", "is", null);
      } else {
        query = query.eq("status", status);
      }
      
      if (q.trim()) query = query.ilike("display_name", `%${q.trim()}%`);

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: z.array(rowSchema).parse(data ?? []), totalCount: count || 0 };
    },
    staleTime: 10_000,
  });

  const rows = data?.rows ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const { data: privateInfo, isLoading: privateLoading } = useQuery({
    queryKey: ["admin-merchant-private", active?.id],
    enabled: open && !!active?.id,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_application_private")
        .select("legal_full_name, nickname, phone_number, address, birth_date, gender")
        .eq("application_id", active!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    for (const r of rows) {
      if (r.status === "pending") c.pending++;
      if (r.status === "approved") c.approved++;
      if (r.status === "rejected") c.rejected++;
    }
    return c;
  }, [rows]);

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (payload: { 
      id: string; 
      user_id: string;
      admin_notes?: string | null;
      is_verified?: boolean;
      badge_tier?: string;
      badge_override?: boolean;
    }) => {
      const { data: feeSettings } = await supabase
        .from("community_settings")
        .select("value")
        .eq("key", "merchant_registration_fee")
        .maybeSingle();
      
      const MERCHANT_FEE = (feeSettings?.value as any)?.amount || 25000;

      const { data: wallet, error: walletError } = await supabase
        .from("user_wallets")
        .select("balance")
        .eq("user_id", payload.user_id)
        .maybeSingle();
      
      if (walletError) throw walletError;
      
      const currentBalance = wallet?.balance || 0;
      
      if (currentBalance < MERCHANT_FEE) {
        throw new Error(`رصيد المحفظة غير كافي. المطلوب: ${MERCHANT_FEE.toLocaleString()} IQD، المتوفر: ${currentBalance.toLocaleString()} IQD`);
      }

      const { error: deductError } = await supabase.rpc('admin_adjust_wallet', {
        p_user_id: payload.user_id,
        p_amount: -MERCHANT_FEE,
        p_type: 'merchant_fee',
        p_description: 'رسوم التسجيل كتاجر في مجتمع ليفو'
      });

      if (deductError) throw new Error(deductError.message || 'فشل خصم رسوم التسجيل');

      const { error: updateError } = await supabase
        .from("merchant_applications")
        .update({ 
          status: "approved", 
          admin_notes: payload.admin_notes ?? null,
          is_verified: payload.is_verified ?? false,
          badge_tier: payload.badge_tier ?? "none",
          badge_override: payload.badge_override ?? false,
        })
        .eq("id", payload.id);
      
      if (updateError) throw updateError;

      await supabase
        .from("merchant_public_profiles")
        .update({
          is_verified: payload.is_verified ?? false,
          badge_tier: payload.badge_tier ?? "none",
        })
        .eq("id", payload.user_id);

      await supabase.from("notifications").insert({
        user_id: payload.user_id,
        title: "تم قبول طلبك كتاجر! 🎉",
        message: `تهانينا! تم قبول طلبك للانضمام كتاجر في مجتمع ليفو. تم خصم ${MERCHANT_FEE.toLocaleString()} IQD من محفظتك كرسوم تسجيل.`,
        type: "success",
      });

      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-merchant-applications"] });
      toast({ title: "تم قبول التاجر", description: "تم خصم رسوم التسجيل من محفظته" });
      setOpen(false);
      setActive(null);
    },
    onError: (err: any) => {
      toast({ title: "تعذر القبول", description: err?.message ?? "حدث خطأ", variant: "destructive" });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (payload: { 
      id: string; 
      user_id: string;
      rejection_reason: string;
    }) => {
      if (!payload.rejection_reason.trim()) {
        throw new Error("يجب تحديد سبب الرفض");
      }

      const { error: updateError } = await supabase
        .from("merchant_applications")
        .update({ 
          status: "rejected", 
          admin_notes: payload.rejection_reason,
          rejected_at: new Date().toISOString(),
        })
        .eq("id", payload.id);

      if (updateError) throw updateError;

      await supabase.from("notifications").insert({
        user_id: payload.user_id,
        title: "تم رفض طلب التاجر",
        message: `للأسف، تم رفض طلبك للانضمام كتاجر. السبب: ${payload.rejection_reason}`,
        type: "error",
      });

      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-merchant-applications"] });
      toast({ title: "تم رفض الطلب" });
      setOpen(false);
      setActive(null);
      setRejectionReason("");
    },
    onError: (err: any) => {
      toast({ title: "تعذر الرفض", description: err?.message ?? "حدث خطأ", variant: "destructive" });
    },
  });

  // Delete mutation - full cleanup from all tables
  const deleteMutation = useMutation({
    mutationFn: async ({ appId, userId }: { appId: string; userId: string }) => {
      // Delete from merchant_application_private
      await supabase
        .from("merchant_application_private")
        .delete()
        .eq("application_id", appId);
      
      // Delete from merchant_public_profiles
      await supabase
        .from("merchant_public_profiles")
        .delete()
        .eq("id", userId);
      
      // Delete merchant application
      const { error } = await supabase
        .from("merchant_applications")
        .delete()
        .eq("id", appId);
      
      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-merchant-applications"] });
      toast({ title: "تم حذف التاجر نهائياً", description: "تم حذف جميع بيانات التاجر من المجتمع" });
      setOpen(false);
      setActive(null);
      setDeleteDialogOpen(false);
      setDeleteConfirmName("");
    },
    onError: (err: any) => {
      toast({ title: "تعذر الحذف", description: err?.message ?? "حدث خطأ", variant: "destructive" });
    },
  });

  const openDialog = (r: Row) => {
    setActive(r);
    setAdminNotes(r.admin_notes ?? "");
    setIsVerified(r.is_verified);
    setBadgeTier((r.badge_tier || "none") as BadgeTier);
    setBadgeOverride(r.badge_override);
    setRejectionReason("");
    setOpen(true);
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "approved": return <Badge className="bg-emerald-500/20 text-emerald-500 text-[10px]">مقبول</Badge>;
      case "pending": return <Badge className="bg-amber-500/20 text-amber-500 text-[10px]">قيد المراجعة</Badge>;
      case "rejected": return <Badge className="bg-red-500/20 text-red-500 text-[10px]">مرفوض</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">مسودة</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-3 flex-wrap text-sm">
        <Badge variant="outline" className="px-3 py-1.5 gap-2">
          <Store className="h-3.5 w-3.5" />
          {totalCount} تاجر
        </Badge>
        <Badge variant="outline" className="px-3 py-1.5 gap-2 border-amber-500/30 text-amber-500">
          {counts.pending} قيد المراجعة
        </Badge>
        <Badge variant="outline" className="px-3 py-1.5 gap-2 border-emerald-500/30 text-emerald-500">
          {counts.approved} مقبول
        </Badge>
        <Badge variant="outline" className="px-3 py-1.5 gap-2 border-red-500/30 text-red-500">
          {counts.rejected} مرفوض
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="البحث بالاسم..."
            className="pr-10 h-9"
          />
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden h-9">
          {(["all", "pending", "approved", "rejected"] as const).map((f) => (
            <button
              key={f}
              className={cn(
                "px-3 text-xs font-medium transition-colors",
                status === f 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-background hover:bg-muted"
              )}
              onClick={() => { setStatus(f); setCurrentPage(0); }}
            >
              {f === "all" ? "الكل" : f === "pending" ? "قيد المراجعة" : f === "approved" ? "مقبول" : "مرفوض"}
            </button>
          ))}
        </div>
      </div>

      {/* Merchants Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Store className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <h3 className="font-semibold">لا يوجد تجار</h3>
            <p className="text-sm text-muted-foreground">لم يتقدم أي تاجر بعد</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rows.map((r) => (
              <Card 
                key={r.id} 
                className={cn(
                  "hover:border-primary/30 transition-colors cursor-pointer",
                  r.status === "rejected" && "border-red-500/30 bg-red-500/5"
                )}
                onClick={() => openDialog(r)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-14 w-14 rounded-xl border-2 border-border">
                      {r.store_image_url ? (
                        <AvatarImage src={r.store_image_url} className="object-cover" />
                      ) : (
                        <AvatarFallback className="rounded-xl bg-primary/10">
                          <Store className="h-6 w-6 text-primary" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm truncate">{r.display_name || "(بدون اسم)"}</h3>
                        <MerchantBadgesDisplay 
                          isVerified={r.is_verified} 
                          badgeTier={(r.badge_tier || "none") as BadgeTier} 
                          size="sm"
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(r.status)}
                        {r.city && (
                          <span className="text-[10px] text-muted-foreground">{r.city}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {format(new Date(r.created_at), "dd/MM/yyyy", { locale: ar })}
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

      {/* Merchant Detail Dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); setActive(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" />
              تفاصيل التاجر
            </DialogTitle>
          </DialogHeader>

          {active && (
            <div className="space-y-4">
              {/* Merchant Header */}
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <Avatar className="h-14 w-14 rounded-xl">
                  {active.store_image_url ? (
                    <AvatarImage src={active.store_image_url} className="object-cover" />
                  ) : (
                    <AvatarFallback className="rounded-xl">
                      <Store className="h-6 w-6" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold">{active.display_name || "(بدون اسم)"}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusBadge(active.status)}
                    <MerchantBadgesDisplay 
                      isVerified={active.is_verified} 
                      badgeTier={(active.badge_tier || "none") as BadgeTier} 
                      size="sm"
                    />
                  </div>
                </div>
              </div>

              {/* Public Info */}
              <div className="space-y-2">
                {active.city && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">المدينة:</span>
                    <span>{active.city}</span>
                  </div>
                )}
                {active.phone_number && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">الهاتف:</span>
                    <span dir="ltr">{active.phone_number}</span>
                  </div>
                )}
                {active.bio && (
                  <div className="text-sm">
                    <span className="text-muted-foreground block mb-1">النبذة:</span>
                    <p className="bg-muted/20 rounded p-2 text-xs">{active.bio}</p>
                  </div>
                )}
              </div>

              {/* Private Info */}
              {privateLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : privateInfo && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-2">
                  <h4 className="text-sm font-medium text-amber-600">معلومات خاصة (للأدمن فقط)</h4>
                  {privateInfo.legal_full_name && (
                    <div className="flex justify-between text-xs">
                      <span>الاسم القانوني:</span>
                      <span>{privateInfo.legal_full_name}</span>
                    </div>
                  )}
                  {privateInfo.address && (
                    <div className="flex justify-between text-xs">
                      <span>العنوان:</span>
                      <span>{privateInfo.address}</span>
                    </div>
                  )}
                  {privateInfo.birth_date && (
                    <div className="flex justify-between text-xs">
                      <span>تاريخ الميلاد:</span>
                      <span>{privateInfo.birth_date}</span>
                    </div>
                  )}
                  {privateInfo.gender && (
                    <div className="flex justify-between text-xs">
                      <span>الجنس:</span>
                      <span>{privateInfo.gender === "male" ? "ذكر" : "أنثى"}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Badges Editor */}
              <MerchantBadgesEditor
                isVerified={isVerified}
                badgeTier={badgeTier}
                badgeOverride={badgeOverride}
                onVerifiedChange={setIsVerified}
                onBadgeTierChange={setBadgeTier}
                onBadgeOverrideChange={setBadgeOverride}
              />

              {/* Admin Notes */}
              <div>
                <label className="text-sm font-medium block mb-1">ملاحظات الأدمن</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="أضف ملاحظاتك..."
                  className="h-20"
                />
              </div>

              {/* Rejection Reason (for pending) */}
              {active.status === "pending" && (
                <div>
                  <label className="text-sm font-medium block mb-1">سبب الرفض (مطلوب للرفض)</label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="اكتب سبب الرفض..."
                    className="h-16"
                  />
                </div>
              )}

              <DialogFooter className="flex-col sm:flex-row gap-2">
                {/* Delete Button - opens confirmation dialog */}
                {(active.status === "rejected" || active.status === "draft") && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDeleteConfirmName("");
                      setDeleteDialogOpen(true);
                    }}
                    disabled={deleteMutation.isPending}
                    className="gap-2 text-destructive border-destructive/30"
                  >
                    <Trash2 className="h-4 w-4" />
                    حذف نهائياً
                  </Button>
                )}

                {/* Pending Actions */}
                {active.status === "pending" && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => rejectMutation.mutate({
                        id: active.id,
                        user_id: active.user_id,
                        rejection_reason: rejectionReason
                      })}
                      disabled={!rejectionReason.trim() || rejectMutation.isPending}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      {rejectMutation.isPending ? "جارٍ الرفض..." : "رفض"}
                    </Button>
                    <Button
                      onClick={() => approveMutation.mutate({
                        id: active.id,
                        user_id: active.user_id,
                        admin_notes: adminNotes,
                        is_verified: isVerified,
                        badge_tier: badgeTier,
                        badge_override: badgeOverride
                      })}
                      disabled={approveMutation.isPending}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {approveMutation.isPending ? "جارٍ القبول..." : "قبول + خصم الرسوم"}
                    </Button>
                  </>
                )}

                {/* Approved - delete with confirmation */}
                {active.status === "approved" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDeleteConfirmName("");
                      setDeleteDialogOpen(true);
                    }}
                    disabled={deleteMutation.isPending}
                    className="gap-2 text-destructive border-destructive/30"
                  >
                    <Ban className="h-4 w-4" />
                    حذف التاجر من المجتمع
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              تأكيد حذف التاجر نهائياً
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                سيتم حذف التاجر <strong className="text-foreground">{active?.display_name || "(بدون اسم)"}</strong> من مجتمع ليفو بشكل نهائي.
              </p>
              <p className="text-destructive font-medium">
                هذا الإجراء لا يمكن التراجع عنه!
              </p>
              <div className="pt-2">
                <label className="text-sm font-medium block mb-2">
                  للتأكيد، اكتب اسم التاجر: <strong>{active?.display_name || "(بدون اسم)"}</strong>
                </label>
                <Input
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  placeholder="اكتب الاسم للتأكيد..."
                  className="border-destructive/50"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmName("")}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (active) {
                  deleteMutation.mutate({ appId: active.id, userId: active.user_id });
                }
              }}
              disabled={deleteConfirmName !== (active?.display_name || "(بدون اسم)") || deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "جارٍ الحذف..." : "حذف نهائياً"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AdminCommunityMerchants({ embedded }: Props) {
  if (embedded) {
    return <MerchantsContent />;
  }

  return (
    <AdminLayout
      title="إدارة التجار"
      description="مراجعة وإدارة طلبات التجار"
      icon={<Store className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.levoCommunity}
      maxWidth="6xl"
    >
      <MerchantsContent />
    </AdminLayout>
  );
}
