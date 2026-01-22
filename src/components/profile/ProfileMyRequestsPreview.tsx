import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { CheckCircle2, Clock, FileText, Pencil, Truck, XCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const requestSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  status: z.enum([
    "pending_review",
    "approved",
    "rejected",
    "in_progress",
    "completed",
    "delivered",
    "cancelled",
  ]),
  created_at: z.string(),
});

type PrintRequest = z.infer<typeof requestSchema>;

export default function ProfileMyRequestsPreview() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["my-print-requests-preview", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_requests")
        .select("id, user_id, title, status, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return z.array(requestSchema).parse(data ?? []);
    },
    staleTime: 20_000,
  });

  const rows = data ?? [];

  const statusUi = useMemo(
    () =>
      ({
        pending_review: { label: "قيد المراجعة", icon: Clock, variant: "secondary" as const },
        approved: { label: "مقبول", icon: CheckCircle2, variant: "outline" as const },
        rejected: { label: "مرفوض", icon: XCircle, variant: "destructive" as const },
        in_progress: { label: "قيد التنفيذ", icon: Clock, variant: "outline" as const },
        completed: { label: "مكتمل", icon: CheckCircle2, variant: "outline" as const },
        delivered: { label: "تم التوصيل", icon: Truck, variant: "outline" as const },
        cancelled: { label: "ملغي", icon: XCircle, variant: "secondary" as const },
      }) as const,
    []
  );

  return (
    <section aria-label="طلباتك" className="mt-6">
      <Card className="glass-effect border-border/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-foreground">طلباتك الأخيرة</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">آخر 3 طلبات قمت بإنشائها</p>
            </div>

            <Button variant="outline" size="sm" className="h-9" onClick={() => navigate("/community/customer/requests")}
            >
              عرض الكل
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            {isLoading ? (
              <div className="rounded-2xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
                جارٍ التحميل…
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-2xl border border-border bg-background/40 p-4">
                <p className="text-sm text-muted-foreground">لا توجد طلبات بعد.</p>
                <Button className="mt-3" onClick={() => navigate("/community/customer/new")}
                >
                  إنشاء طلب جديد
                </Button>
              </div>
            ) : (
              rows.map((r: PrintRequest) => {
                const ui = statusUi[r.status];
                const Icon = ui.icon;
                return (
                  <div key={r.id} className="rounded-2xl border border-border bg-background/40 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <p className="text-sm font-bold text-foreground truncate">{r.title}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant={ui.variant} className="gap-1">
                            <Icon className="h-3.5 w-3.5" />
                            {ui.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(r.created_at).toLocaleDateString("ar-IQ")}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-xl"
                        onClick={() => navigate("/community/customer/requests")}
                        aria-label="تعديل الطلب"
                        title="تعديل عبر صفحة طلباتي"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
