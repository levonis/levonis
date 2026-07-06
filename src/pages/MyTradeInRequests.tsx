import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Recycle, Copy, Package } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "outline" | "secondary" | "destructive" }> = {
  pending_review: { label: "قيد المراجعة", variant: "secondary" },
  approved_pending_inspection: { label: "بانتظار الفحص", variant: "outline" },
  inspected_adjusted: { label: "تم الفحص", variant: "outline" },
  coupon_issued: { label: "تم إصدار الكوبون", variant: "default" },
  rejected: { label: "مرفوض", variant: "destructive" },
  cancelled: { label: "ملغى", variant: "outline" },
};

export default function MyTradeInRequests() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["my-trade-in-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_in_requests")
        .select("*, trade_in_eligible_printers(brand, printer_model), products:target_new_product_id(id, name_ar)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (!user) return <div className="p-6 text-center text-muted-foreground">سجّل الدخول لعرض طلباتك</div>;

  return (
    <div className="container max-w-3xl mx-auto py-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Recycle className="h-6 w-6 text-primary" />
        طلبات استبدال الطابعات
      </h1>

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : !data || data.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">لم تقدم أي طلب استبدال بعد</CardContent></Card>
      ) : (
        data.map((req: any) => {
          const st = STATUS_LABEL[req.status] ?? { label: req.status, variant: "outline" as const };
          return (
            <Card key={req.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">
                      {req.trade_in_eligible_printers?.brand} — {req.trade_in_eligible_printers?.printer_model}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      قُدّم في {format(new Date(req.created_at), "yyyy-MM-dd HH:mm")}
                    </p>
                  </div>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </div>

                {req.products && (
                  <div className="text-xs flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" />
                    الطابعة الجديدة: <strong>{req.products.name_ar}</strong>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>التقدير الأولي: <strong>{Number(req.estimated_coupon_value || 0).toLocaleString()} د.ع</strong></div>
                  {req.final_coupon_value != null && (
                    <div>القيمة النهائية: <strong className="text-primary">{Number(req.final_coupon_value).toLocaleString()} د.ع</strong></div>
                  )}
                </div>

                {req.status === "coupon_issued" && req.issued_coupon_code && (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">كود الكوبون</p>
                      <p className="font-mono font-bold text-primary">{req.issued_coupon_code}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => {
                      navigator.clipboard.writeText(req.issued_coupon_code);
                      toast.success("تم نسخ الكود");
                    }}>
                      <Copy className="h-3.5 w-3.5 ml-1" />
                      نسخ
                    </Button>
                  </div>
                )}

                {req.status === "rejected" && req.rejection_reason && (
                  <p className="text-xs text-destructive">سبب الرفض: {req.rejection_reason}</p>
                )}
                {req.admin_notes && (
                  <p className="text-xs text-muted-foreground">ملاحظة الإدارة: {req.admin_notes}</p>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
