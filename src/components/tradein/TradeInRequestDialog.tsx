import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEligiblePrinters, useValuationRules } from "@/hooks/useTradeInEligibility";
import { estimateTradeInValue, type HoursTier, type ConditionRule } from "@/lib/tradeInPricing";
import { toast } from "sonner";
import { Upload, X, Loader2, Recycle, Info } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetProductId?: string | null;
  targetProductName?: string | null;
}

export default function TradeInRequestDialog({ open, onOpenChange, targetProductId, targetProductName }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [eligibleId, setEligibleId] = useState<string>("");
  const [operatingHours, setOperatingHours] = useState<string>("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [purchaseSource, setPurchaseSource] = useState("");
  const [hasBox, setHasBox] = useState(false);
  const [hasReceipt, setHasReceipt] = useState(false);
  const [hasScratches, setHasScratches] = useState(false);
  const [hasDefects, setHasDefects] = useState(false);
  const [hasAms, setHasAms] = useState(false);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: printers = [] } = useEligiblePrinters();
  const { data: rules = [] } = useValuationRules();

  const chosen = useMemo(() => printers.find((p) => p.id === eligibleId), [printers, eligibleId]);

  const estimate = useMemo(() => {
    if (!chosen) return null;
    const hoursTiers: HoursTier[] = rules.filter((r) => r.rule_type === "hours_tier").map((r) => ({
      rule_key: r.rule_key,
      min_hours: r.min_hours,
      max_hours: r.max_hours,
      multiplier_percent: r.multiplier_percent ?? 100,
    }));
    const conditionRules: ConditionRule[] = rules.filter((r) => r.rule_type === "condition_adjust").map((r) => ({
      rule_key: r.rule_key,
      adjust_percent: r.adjust_percent ?? 0,
    }));
    return estimateTradeInValue({
      baseValue: chosen.base_trade_in_value,
      operatingHours: parseInt(operatingHours || "0", 10) || 0,
      hasOriginalBox: hasBox,
      hasReceipt,
      hasScratches,
      hasDefects,
      hoursTiers,
      conditionRules,
    });
  }, [chosen, operatingHours, hasBox, hasReceipt, hasScratches, hasDefects, rules]);

  const overHoursLimit = !!(chosen?.max_operating_hours && parseInt(operatingHours || "0", 10) > chosen.max_operating_hours);

  const reset = () => {
    setStep(1); setEligibleId(""); setOperatingHours(""); setBrand(""); setModel("");
    setPurchaseSource(""); setHasBox(false); setHasReceipt(false); setHasScratches(false);
    setHasDefects(false); setNotes(""); setPhotos([]); setReceiptFile(null);
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("login_required");
      if (!chosen) throw new Error("no_printer");
      if (photos.length < 3) throw new Error("need_photos");

      setUploading(true);
      const requestId = crypto.randomUUID();
      const folder = `${user.id}/${requestId}`;

      // Upload photos
      const photoUrls: string[] = [];
      for (const [i, file] of photos.entries()) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${folder}/photo-${i + 1}.${ext}`;
        const { error } = await supabase.storage.from("trade-in-uploads").upload(path, file, { upsert: true });
        if (error) throw error;
        photoUrls.push(path);
      }
      let receiptPath: string | null = null;
      if (receiptFile) {
        const ext = receiptFile.name.split(".").pop() || "jpg";
        receiptPath = `${folder}/receipt.${ext}`;
        const { error } = await supabase.storage.from("trade-in-uploads").upload(receiptPath, receiptFile, { upsert: true });
        if (error) throw error;
      }

      const { error: insErr } = await supabase.from("trade_in_requests").insert({
        id: requestId,
        user_id: user.id,
        eligible_printer_id: chosen.id,
        target_new_product_id: targetProductId ?? null,
        operating_hours: parseInt(operatingHours || "0", 10) || 0,
        printer_brand: brand || chosen.brand,
        printer_model: model || chosen.printer_model,
        purchase_source: purchaseSource || null,
        has_original_box: hasBox,
        has_receipt: hasReceipt,
        has_scratches: hasScratches,
        has_defects: hasDefects,
        notes: notes || null,
        receipt_image_url: receiptPath,
        photos: photoUrls,
        estimated_coupon_value: estimate?.final ?? 0,
        status: "pending_review",
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success("تم إرسال طلب الاستبدال بنجاح");
      qc.invalidateQueries({ queryKey: ["my-trade-in-requests"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => {
      const msg = e?.message === "need_photos" ? "الرجاء رفع 3 صور شاملة على الأقل"
        : e?.message === "login_required" ? "يجب تسجيل الدخول أولاً"
        : e?.message === "no_printer" ? "اختر موديل طابعتك القديمة"
        : "تعذّر إرسال الطلب: " + (e?.message || "");
      toast.error(msg);
    },
    onSettled: () => setUploading(false),
  });

  const canNext =
    (step === 1 && !!eligibleId && !overHoursLimit) ||
    (step === 2 && parseInt(operatingHours || "0", 10) >= 0) ||
    (step === 3) ||
    (step === 4 && photos.length >= 3);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg !overflow-hidden !max-h-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Recycle className="h-5 w-5 text-primary" />
            استبدال طابعة قديمة
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto space-y-4 py-2">
          {targetProductName && (
            <div className="text-xs bg-primary/10 border border-primary/20 rounded-lg p-2">
              الطابعة الجديدة المطلوبة: <strong>{targetProductName}</strong>
            </div>
          )}

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className={step >= 1 ? "font-bold text-primary" : ""}>1. الطابعة</span> ·
            <span className={step >= 2 ? "font-bold text-primary" : ""}>2. البيانات</span> ·
            <span className={step >= 3 ? "font-bold text-primary" : ""}>3. الحالة</span> ·
            <span className={step >= 4 ? "font-bold text-primary" : ""}>4. الصور</span> ·
            <span className={step >= 5 ? "font-bold text-primary" : ""}>5. المراجعة</span>
          </div>

          {step === 1 && (
            <div className="space-y-3">
              <Label>موديل طابعتك القديمة</Label>
              <Select value={eligibleId} onValueChange={setEligibleId}>
                <SelectTrigger><SelectValue placeholder="اختر الموديل من القائمة" /></SelectTrigger>
                <SelectContent>
                  {printers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.brand} — {p.printer_model} · {p.base_trade_in_value.toLocaleString()} د.ع
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {printers.length === 0 && (
                <p className="text-xs text-muted-foreground">لا توجد طابعات مؤهلة حالياً.</p>
              )}
              {chosen && (
                <Card className="p-3 text-xs space-y-1">
                  <p>القيمة الأساسية: <strong>{chosen.base_trade_in_value.toLocaleString()} د.ع</strong></p>
                  {chosen.max_operating_hours && (
                    <p>حد ساعات التشغيل: {chosen.max_operating_hours.toLocaleString()} ساعة</p>
                  )}
                  {chosen.notes && <p className="text-muted-foreground">{chosen.notes}</p>}
                </Card>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div>
                <Label>ساعات التشغيل (تقريباً)</Label>
                <Input type="number" inputMode="numeric" min={0} value={operatingHours}
                  onChange={(e) => setOperatingHours(e.target.value)} placeholder="مثلاً 1200" />
                {overHoursLimit && (
                  <p className="text-xs text-destructive mt-1">تجاوزت الحد المسموح ({chosen?.max_operating_hours} ساعة)</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>الشركة المصنّعة</Label>
                  <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={chosen?.brand} />
                </div>
                <div>
                  <Label>الموديل الدقيق</Label>
                  <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={chosen?.printer_model} />
                </div>
              </div>
              <div>
                <Label>من أين اشتريتها؟</Label>
                <Input value={purchaseSource} onChange={(e) => setPurchaseSource(e.target.value)} placeholder="اسم المتجر أو الموقع" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={hasBox} onCheckedChange={(v) => setHasBox(!!v)} />
                تأتي مع الكرتون الأصلي للتغليف
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={hasReceipt} onCheckedChange={(v) => setHasReceipt(!!v)} />
                يوجد وصل شراء
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={hasScratches} onCheckedChange={(v) => setHasScratches(!!v)} />
                بها خدوش أو أضرار سطحية
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={hasDefects} onCheckedChange={(v) => setHasDefects(!!v)} />
                بها عطل أو عيب في التشغيل
              </label>
              <div>
                <Label>ملاحظات إضافية</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                  placeholder="اذكر أي تفاصيل مهمة عن حالة الطابعة" />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div>
                <Label>صور شاملة للطابعة (3 صور على الأقل)</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {photos.map((f, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border">
                      <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setPhotos((p) => p.filter((_, x) => x !== i))}
                        className="absolute top-0 right-0 bg-destructive text-white rounded-bl p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <label className="w-20 h-20 border-2 border-dashed rounded-md flex flex-col items-center justify-center cursor-pointer hover:bg-muted">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">إضافة</span>
                    <input type="file" accept="image/*" multiple hidden
                      onChange={(e) => setPhotos((p) => [...p, ...Array.from(e.target.files ?? [])].slice(0, 8))} />
                  </label>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">من كل الجوانب: أمام، خلف، جنب، شاشة التحكم، رأس الطباعة</p>
              </div>
              <div>
                <Label>صورة وصل الشراء (اختياري)</Label>
                <Input type="file" accept="image/*" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
          )}

          {step === 5 && estimate && (
            <div className="space-y-3">
              <Card className="p-4 space-y-2 bg-primary/5">
                <div className="flex justify-between text-sm">
                  <span>القيمة الأساسية</span>
                  <span>{estimate.base.toLocaleString()} د.ع</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>نسبة ساعات التشغيل</span>
                  <Badge variant="outline">{estimate.multiplier}%</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>تعديل الحالة</span>
                  <Badge variant={estimate.adjust >= 0 ? "outline" : "destructive"}>
                    {estimate.adjust >= 0 ? "+" : ""}{estimate.adjust}%
                  </Badge>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-primary">
                  <span>التقدير الأولي</span>
                  <span>{estimate.final.toLocaleString()} د.ع</span>
                </div>
              </Card>
              <div className="flex items-start gap-2 text-xs bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>هذا تقدير أولي. القيمة النهائية للكوبون تُحدد بعد فحص الطابعة فعلياً من قبل فريق ليفو.</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 justify-between">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={uploading}>السابق</Button>
          ) : <div />}
          {step < 5 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>التالي</Button>
          ) : (
            <Button onClick={() => submit.mutate()} disabled={submit.isPending || uploading}>
              {(submit.isPending || uploading) && <Loader2 className="h-4 w-4 ml-1 animate-spin" />}
              إرسال الطلب
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
