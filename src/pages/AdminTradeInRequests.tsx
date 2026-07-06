import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Recycle, Eye, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_LABEL: Record<string, string> = {
  pending_review: "قيد المراجعة",
  approved_pending_inspection: "بانتظار الفحص",
  inspected_adjusted: "تم الفحص",
  coupon_issued: "تم إصدار الكوبون",
  rejected: "مرفوض",
  cancelled: "ملغى",
};

export default function AdminTradeInRequests() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<any>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-trade-in-requests", statusFilter],
    queryFn: async () => {
      let q = supabase.from("trade_in_requests")
        .select("*, trade_in_eligible_printers(brand, printer_model), products:target_new_product_id(id, name_ar), profiles:user_id(id, full_name, phone)")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <div className="container max-w-6xl mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Recycle className="h-6 w-6 text-primary" />
          طلبات استبدال الطابعات
        </h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <p>جاري التحميل...</p> :
        data.length === 0 ? <Card><CardContent className="p-6 text-center text-muted-foreground">لا توجد طلبات</CardContent></Card> :
        data.map((req) => (
          <Card key={req.id}>
            <CardContent className="p-4 flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold">
                    {req.trade_in_eligible_printers?.brand} — {req.trade_in_eligible_printers?.printer_model}
                  </p>
                  <Badge variant={req.status === "coupon_issued" ? "default" : req.status === "rejected" ? "destructive" : "outline"}>
                    {STATUS_LABEL[req.status]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {req.profiles?.full_name || "مستخدم"} · {req.profiles?.phone || ""} · {format(new Date(req.created_at), "yyyy-MM-dd")}
                </p>
                <div className="text-xs">
                  ساعات: {req.operating_hours} · صور: {(req.photos as any[])?.length || 0} · تقدير: <strong>{Number(req.estimated_coupon_value).toLocaleString()} د.ع</strong>
                  {req.final_coupon_value && <> · نهائي: <strong className="text-primary">{Number(req.final_coupon_value).toLocaleString()} د.ع</strong></>}
                </div>
                {req.products && <p className="text-xs">→ {req.products.name_ar}</p>}
              </div>
              <Button size="sm" variant="outline" onClick={() => setSelected(req)}>
                <Eye className="h-4 w-4 ml-1" /> تفاصيل
              </Button>
            </CardContent>
          </Card>
        ))
      }

      {selected && <RequestDetail req={selected} onClose={() => setSelected(null)} onChanged={() => qc.invalidateQueries({ queryKey: ["admin-trade-in-requests"] })} />}
    </div>
  );
}

function RequestDetail({ req, onClose, onChanged }: { req: any; onClose: () => void; onChanged: () => void }) {
  const [finalValue, setFinalValue] = useState<number>(req.final_coupon_value ?? req.estimated_coupon_value ?? 0);
  const [adminNotes, setAdminNotes] = useState<string>(req.admin_notes ?? "");
  const [rejectReason, setRejectReason] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const loadPhotos = async () => {
    const urls: string[] = [];
    for (const path of req.photos ?? []) {
      const { data } = await supabase.storage.from("trade-in-uploads").createSignedUrl(path, 3600);
      if (data?.signedUrl) urls.push(data.signedUrl);
    }
    if (req.receipt_image_url) {
      const { data } = await supabase.storage.from("trade-in-uploads").createSignedUrl(req.receipt_image_url, 3600);
      if (data?.signedUrl) urls.push(data.signedUrl);
    }
    setPhotoUrls(urls);
  };
  useState(() => { loadPhotos(); return 0; });

  const approve = async () => {
    setBusy(true);
    const { error } = await supabase.from("trade_in_requests")
      .update({ status: "approved_pending_inspection", admin_notes: adminNotes || null })
      .eq("id", req.id);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("تمت الموافقة المبدئية"); onChanged(); onClose(); }
  };

  const recordInspection = async () => {
    setBusy(true);
    const { error } = await supabase.from("trade_in_requests")
      .update({ status: "inspected_adjusted", final_coupon_value: finalValue, admin_notes: adminNotes || null })
      .eq("id", req.id);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("تم تسجيل نتيجة الفحص"); onChanged(); onClose(); }
  };

  const issueCoupon = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_issue_trade_in_coupon" as any, {
      _request_id: req.id, _final_value: finalValue, _admin_notes: adminNotes || null, _valid_days: 30,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("تم إصدار الكوبون: " + (data as any)?.[0]?.coupon_code); onChanged(); onClose(); }
  };

  const reject = async () => {
    if (!rejectReason.trim()) return toast.error("اذكر سبب الرفض");
    setBusy(true);
    const { error } = await supabase.from("trade_in_requests")
      .update({ status: "rejected", rejection_reason: rejectReason, admin_notes: adminNotes || null })
      .eq("id", req.id);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("تم الرفض"); onChanged(); onClose(); }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl !overflow-hidden !max-h-none">
        <DialogHeader><DialogTitle>تفاصيل طلب الاستبدال</DialogTitle></DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><strong>الشركة:</strong> {req.printer_brand || req.trade_in_eligible_printers?.brand}</div>
            <div><strong>الموديل:</strong> {req.printer_model || req.trade_in_eligible_printers?.printer_model}</div>
            <div><strong>ساعات التشغيل:</strong> {req.operating_hours}</div>
            <div><strong>مصدر الشراء:</strong> {req.purchase_source || "—"}</div>
            <div>{req.has_original_box ? "✓" : "✗"} كرتون أصلي</div>
            <div>{req.has_receipt ? "✓" : "✗"} وصل شراء</div>
            <div>{req.has_scratches ? "⚠️" : "—"} خدوش</div>
            <div>{req.has_defects ? "⚠️" : "—"} عطل</div>
          </div>
          {req.notes && <div className="text-xs bg-muted p-2 rounded">ملاحظات المستخدم: {req.notes}</div>}

          <div>
            <p className="text-sm font-bold mb-2">الصور</p>
            <div className="grid grid-cols-3 gap-2">
              {photoUrls.map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noreferrer">
                  <img src={u} alt="" className="w-full h-24 object-cover rounded border hover:scale-105 transition-transform" />
                </a>
              ))}
              {photoUrls.length === 0 && <p className="text-xs text-muted-foreground col-span-3">جاري تحميل الصور...</p>}
            </div>
          </div>

          <div className="border-t pt-3 space-y-3">
            <div>
              <Label>القيمة النهائية للكوبون (د.ع)</Label>
              <Input type="number" value={finalValue} onChange={(e) => setFinalValue(+e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">التقدير الأولي: {Number(req.estimated_coupon_value).toLocaleString()} د.ع</p>
            </div>
            <div>
              <Label>ملاحظات الإدارة</Label>
              <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2} />
            </div>
            {req.status !== "coupon_issued" && (
              <div>
                <Label>سبب الرفض (إن وُجد)</Label>
                <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="اترك فارغاً إذا لن ترفض" />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {req.status === "pending_review" && (
            <Button onClick={approve} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 ml-1 animate-spin" />} <CheckCircle2 className="h-4 w-4 ml-1" /> موافقة مبدئية
            </Button>
          )}
          {(req.status === "approved_pending_inspection" || req.status === "pending_review") && (
            <Button variant="secondary" onClick={recordInspection} disabled={busy}>تسجيل نتيجة الفحص</Button>
          )}
          {(req.status === "inspected_adjusted" || req.status === "approved_pending_inspection") && (
            <Button onClick={issueCoupon} disabled={busy || !finalValue}>
              {busy && <Loader2 className="h-4 w-4 ml-1 animate-spin" />} إصدار الكوبون
            </Button>
          )}
          {req.status !== "coupon_issued" && req.status !== "rejected" && (
            <Button variant="destructive" onClick={reject} disabled={busy}>
              <XCircle className="h-4 w-4 ml-1" /> رفض
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
