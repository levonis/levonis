import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Store, Filter, RefreshCw, CheckCircle2, XCircle, Image as ImageIcon, ExternalLink, Calculator } from "lucide-react";

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
import MerchantBadgesEditor from "@/components/admin/MerchantBadgesEditor";
import { MerchantBadgesDisplay, BadgeTier } from "@/components/community/MerchantBadges";

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

export default function AdminCommunityMerchants() {
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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-merchant-applications", status, q],
    queryFn: async () => {
      let query = supabase
        .from("merchant_applications")
        .select(
          "id, user_id, display_name, phone_number, city, bio, store_image_url, social_links, status, admin_notes, created_at, is_verified, badge_tier, badge_override"
        )
        .order("created_at", { ascending: false });

      if (status !== "all") query = query.eq("status", status);
      if (q.trim()) query = query.ilike("display_name", `%${q.trim()}%`);

      const { data, error } = await query;
      if (error) throw error;
      return z.array(rowSchema).parse(data ?? []);
    },
    staleTime: 10_000,
  });

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
      return (data ?? null) as
        | {
            legal_full_name: string | null;
            nickname: string | null;
            phone_number: string | null;
            address: string | null;
            birth_date: string | null;
            gender: string | null;
          }
        | null;
    },
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
    mutationFn: async (payload: { 
      id: string; 
      status: string; 
      admin_notes?: string | null;
      is_verified?: boolean;
      badge_tier?: string;
      badge_override?: boolean;
    }) => {
      const { error } = await supabase
        .from("merchant_applications")
        .update({ 
          status: payload.status, 
          admin_notes: payload.admin_notes ?? null,
          is_verified: payload.is_verified ?? false,
          badge_tier: payload.badge_tier ?? "none",
          badge_override: payload.badge_override ?? false,
        })
        .eq("id", payload.id);
      if (error) throw error;

      // Also update the public profile if approved
      if (payload.status === "approved") {
        const { data: app } = await supabase
          .from("merchant_applications")
          .select("user_id")
          .eq("id", payload.id)
          .single();
        
        if (app?.user_id) {
          await supabase
            .from("merchant_public_profiles")
            .update({
              is_verified: payload.is_verified ?? false,
              badge_tier: payload.badge_tier ?? "none",
            })
            .eq("id", app.user_id);
        }
      }
      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-merchant-applications"] });
      toast({ title: "تم تحديث البيانات" });
      setOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "تعذر التحديث", description: err?.message ?? "حدث خطأ", variant: "destructive" });
    },
  });

  // Mutation to recalculate all badges
  const recalculateBadgesMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("calculate-merchant-badges");
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["admin-merchant-applications"] });
      toast({ 
        title: "تم حساب الشارات", 
        description: `تم تحديث ${data?.updated || 0} تاجر من ${data?.processed || 0}` 
      });
    },
    onError: (err: any) => {
      toast({ title: "فشل حساب الشارات", description: err?.message ?? "حدث خطأ", variant: "destructive" });
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
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => recalculateBadgesMutation.mutate()} 
            disabled={recalculateBadgesMutation.isPending}
            className="gap-2"
          >
            <Calculator className="h-4 w-4" />
            {recalculateBadgesMutation.isPending ? "جارٍ الحساب..." : "حساب الشارات"}
          </Button>
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            تحديث
          </Button>
        </div>
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
            <Card key={r.id} className="p-4" dir="rtl">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-12 w-12 shrink-0 rounded-xl border border-border bg-muted/20 overflow-hidden flex items-center justify-center">
                    {r.store_image_url ? (
                      // Intentionally simple img to avoid layout shifts in admin lists
                      <img
                        src={r.store_image_url}
                        alt="صورة المتجر"
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold truncate">{r.display_name ?? "(بدون اسم)"}</p>
                      <MerchantBadgesDisplay 
                        isVerified={r.is_verified} 
                        badgeTier={(r.badge_tier || "none") as BadgeTier} 
                        size="sm"
                      />
                      <Badge variant="outline" className="text-xs">
                        {r.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground truncate">
                      {r.phone_number ?? "—"} • {r.city ?? "—"}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{r.bio ?? "—"}</p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {(r.social_links as any)?.instagram ? (
                        <a
                          className="text-xs text-primary underline underline-offset-4"
                          href={(r.social_links as any).instagram}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Instagram
                        </a>
                      ) : null}
                      {(r.social_links as any)?.facebook ? (
                        <a
                          className="text-xs text-primary underline underline-offset-4"
                          href={(r.social_links as any).facebook}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Facebook
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => {
                    setActive(r);
                    setAdminNotes(r.admin_notes ?? "");
                    setIsVerified(r.is_verified ?? false);
                    setBadgeTier((r.badge_tier || "none") as BadgeTier);
                    setBadgeOverride(r.badge_override ?? false);
                    setOpen(true);
                  }}
                  className="shrink-0"
                >
                  مراجعة
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>مراجعة الطلب</DialogTitle>
            <DialogDescription>يمكنك الموافقة/الرفض وإضافة ملاحظات.</DialogDescription>
          </DialogHeader>

          {active && (
            <div className="space-y-4">
              {/* Top summary */}
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{active.display_name ?? "(بدون اسم)"}</p>
                    <p className="mt-1 text-xs text-muted-foreground truncate">User ID: {active.user_id}</p>
                    <p className="mt-1 text-xs text-muted-foreground">الحالة الحالية: {active.status}</p>
                  </div>

                  {active.store_image_url ? (
                    <a
                      href={active.store_image_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-xs text-primary underline underline-offset-4 shrink-0"
                    >
                      <ExternalLink className="h-4 w-4" />
                      فتح صورة المتجر
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Public info */}
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="text-sm font-semibold text-foreground">معلومات المتجر (المرحلة الأولى)</div>
                  <div className="mt-2 space-y-2 text-sm">
                    <KV label="المدينة" value={active.city ?? "—"} />
                    <KV label="رقم الهاتف (المتجر)" value={active.phone_number ?? "—"} />
                    <KV label="نبذة" value={active.bio ?? "—"} multiline />

                    <div className="pt-2">
                      <div className="text-xs text-muted-foreground">الروابط الاجتماعية</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {(active.social_links as any)?.instagram ? (
                          <a
                            className="text-xs text-primary underline underline-offset-4"
                            href={(active.social_links as any).instagram}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Instagram
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Instagram: —</span>
                        )}
                        {(active.social_links as any)?.facebook ? (
                          <a
                            className="text-xs text-primary underline underline-offset-4"
                            href={(active.social_links as any).facebook}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Facebook
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Facebook: —</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Private info */}
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="text-sm font-semibold text-foreground">معلومات خاصة (المرحلة الثانية)</div>
                  <div className="mt-2 space-y-2 text-sm">
                    {privateLoading ? (
                      <div className="text-sm text-muted-foreground">جارٍ تحميل المعلومات الخاصة…</div>
                    ) : (
                      <>
                        <KV label="الاسم الكامل" value={privateInfo?.legal_full_name ?? "—"} />
                        <KV label="اللقب" value={privateInfo?.nickname ?? "—"} />
                        <KV label="هاتف شخصي" value={privateInfo?.phone_number ?? "—"} />
                        <KV label="العنوان" value={privateInfo?.address ?? "—"} multiline />
                        <KV label="تاريخ الميلاد" value={privateInfo?.birth_date ?? "—"} />
                        <KV label="الجنس" value={privateInfo?.gender ?? "—"} />
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Badges Editor */}
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="text-sm font-semibold text-foreground mb-3">شارات التاجر</div>
                <MerchantBadgesEditor
                  isVerified={isVerified}
                  badgeTier={badgeTier}
                  badgeOverride={badgeOverride}
                  onVerifiedChange={setIsVerified}
                  onBadgeTierChange={setBadgeTier}
                  onBadgeOverrideChange={setBadgeOverride}
                  disabled={updateMutation.isPending}
                />
              </div>

              <div className="rounded-xl border border-border bg-card p-3">
                <div className="text-sm font-semibold text-foreground">ملاحظات الإدارة</div>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="mt-2 min-h-24"
                  placeholder="أضف ملاحظات (اختياري)"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => active && updateMutation.mutate({ 
                id: active.id, 
                status: "rejected", 
                admin_notes: adminNotes || null,
                is_verified: isVerified,
                badge_tier: badgeTier,
                badge_override: badgeOverride,
              })}
              disabled={!active || updateMutation.isPending}
              className="gap-2"
            >
              <XCircle className="h-4 w-4" />
              رفض
            </Button>
            <Button
              onClick={() => active && updateMutation.mutate({ 
                id: active.id, 
                status: "approved", 
                admin_notes: adminNotes || null,
                is_verified: isVerified,
                badge_tier: badgeTier,
                badge_override: badgeOverride,
              })}
              disabled={!active || updateMutation.isPending}
              className="gap-2"
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

function KV({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-xs text-muted-foreground shrink-0">{label}</div>
      <div
        className={
          multiline
            ? "text-sm text-foreground text-right leading-relaxed whitespace-pre-wrap"
            : "text-sm text-foreground text-right"
        }
      >
        {value}
      </div>
    </div>
  );
}
