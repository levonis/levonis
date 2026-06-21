import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowLeft, Loader2, Lightbulb, CheckCircle2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { suggestPrinterLocal } from "@/lib/printerAdvisor";

interface AdvisorResult {
  recommended: {
    id: string;
    name: string;
    slug: string;
    image_url: string | null;
    brand: string | null;
    price_iqd: number;
  } | null;
  reasoning: string;
  key_features: string[];
  upgrade_suggestion: {
    product: AdvisorResult["recommended"];
    additional_budget_iqd: number;
    message: string;
  } | null;
}

const PURPOSE_OPTIONS = [
  "هواية شخصية",
  "تعليمي / أطفال",
  "استخدام احترافي",
  "مشروع صغير / تجاري",
  "نماذج ميكانيكية دقيقة",
  "طباعة بأحجام كبيرة",
  "Resin / مجسمات تفصيلية",
];

const EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "مبتدئ" },
  { value: "intermediate", label: "متوسط" },
  { value: "advanced", label: "محترف" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function PrinterAdvisorDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [budget, setBudget] = useState<number>(0);
  const [purposes, setPurposes] = useState<string[]>([]);
  const [experience, setExperience] = useState<string>("beginner");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdvisorResult | null>(null);

  const reset = () => {
    setResult(null);
  };

  const handleBudgetBlur = () => {
    if (budget > 0 && budget < 10000) {
      const adjusted = budget * 1000;
      setBudget(adjusted);
      toast.info(`تم تحويل المبلغ تلقائياً إلى ${adjusted.toLocaleString()} د.ع`);
    }
  };

  const togglePurpose = (p: string) => {
    setPurposes((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const submit = async () => {
    if (budget < 50000) {
      toast.error("يرجى إدخال ميزانية حقيقية (50,000 د.ع على الأقل)");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-printer", {
        body: {
          budget_iqd: budget,
          purposes,
          experience_level: experience,
          notes,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data as AdvisorResult);
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ، حاول مجدداً");
    } finally {
      setLoading(false);
    }
  };

  const goToProduct = (slug?: string) => {
    if (!slug) return;
    onOpenChange(false);
    navigate(`/product/${slug}`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setResult(null); } }}>
      <DialogContent dir="rtl" className="!overflow-hidden !max-h-none max-w-2xl p-0">
        <div className="overflow-y-auto max-h-[85vh]">
          <DialogHeader className="p-5 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              اقتراح طابعة من ليفو
            </DialogTitle>
            <DialogDescription>
              أخبرنا بميزانيتك والغرض من الطابعة وسنقترح لك الأنسب من متجرنا.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-5">
            {!result && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-bold">ميزانيتك (دينار عراقي)</Label>
                  <FormattedNumberInput
                    value={budget}
                    onChange={setBudget}
                    onBlur={handleBudgetBlur}
                    suffix="د.ع"
                    placeholder="مثال: 1,000,000"
                    className="h-12 text-lg"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    إذا كتبت رقماً صغيراً (مثلاً 500) سيتم تحويله تلقائياً إلى 500,000 د.ع
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-bold">الغرض من الطابعة</Label>
                  <div className="flex flex-wrap gap-2">
                    {PURPOSE_OPTIONS.map((p) => {
                      const active = purposes.includes(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => togglePurpose(p)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                            active
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-secondary border-border"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-bold">مستوى خبرتك</Label>
                  <div className="flex gap-2">
                    {EXPERIENCE_OPTIONS.map((e) => (
                      <button
                        key={e.value}
                        type="button"
                        onClick={() => setExperience(e.value)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                          experience === e.value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-secondary border-border"
                        }`}
                      >
                        {e.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-bold">ملاحظات إضافية (اختياري)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="مثال: أحتاج طابعة هادئة، أو طباعة بمواد متعددة..."
                    maxLength={500}
                    className="min-h-20"
                  />
                </div>

                <Button onClick={submit} disabled={loading} className="w-full h-12 text-base font-bold gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      جاري التحليل...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      اقترح لي الأنسب
                    </>
                  )}
                </Button>
              </>
            )}

            {result && result.recommended && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-bold">الاختيار الأنسب لك:</span>
                </div>

                <button
                  onClick={() => goToProduct(result.recommended?.slug)}
                  className="w-full text-right rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 p-4 hover:border-primary transition"
                >
                  <div className="flex gap-4 items-center">
                    <img
                      src={result.recommended.image_url || "/placeholder.svg"}
                      alt={result.recommended.name}
                      className="w-24 h-24 object-contain rounded-xl bg-background"
                      loading="lazy"
                    />
                    <div className="flex-1 min-w-0">
                      {result.recommended.brand && (
                        <Badge variant="secondary" className="mb-1 text-[10px]">
                          {result.recommended.brand}
                        </Badge>
                      )}
                      <h3 className="font-black text-lg leading-tight mb-1">{result.recommended.name}</h3>
                      <p className="text-primary font-bold text-xl">
                        {result.recommended.price_iqd.toLocaleString()} <span className="text-xs">د.ع</span>
                      </p>
                    </div>
                  </div>
                </button>

                {result.reasoning && (
                  <div className="rounded-xl bg-secondary/40 p-3 border">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm leading-relaxed">{result.reasoning}</p>
                    </div>
                  </div>
                )}

                {result.key_features.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold">لماذا هي الأفضل لك:</p>
                    <ul className="space-y-1.5">
                      {result.key_features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.upgrade_suggestion?.product && (
                  <div className="rounded-xl border-2 border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <TrendingUp className="h-5 w-5" />
                      <span className="font-bold text-sm">ننصح بزيادة الميزانية للحصول على:</span>
                    </div>
                    <button
                      onClick={() => goToProduct(result.upgrade_suggestion?.product?.slug)}
                      className="w-full text-right flex gap-3 items-center"
                    >
                      <img
                        src={result.upgrade_suggestion.product.image_url || "/placeholder.svg"}
                        alt={result.upgrade_suggestion.product.name}
                        className="w-16 h-16 object-contain rounded-lg bg-background"
                        loading="lazy"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold leading-tight">{result.upgrade_suggestion.product.name}</p>
                        <p className="text-sm text-primary font-bold">
                          {result.upgrade_suggestion.product.price_iqd.toLocaleString()} د.ع
                        </p>
                        {result.upgrade_suggestion.additional_budget_iqd > 0 && (
                          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                            بزيادة {result.upgrade_suggestion.additional_budget_iqd.toLocaleString()} د.ع فقط
                          </p>
                        )}
                      </div>
                    </button>
                    {result.upgrade_suggestion.message && (
                      <p className="text-xs text-muted-foreground">{result.upgrade_suggestion.message}</p>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={reset} className="flex-1 gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    اقتراح آخر
                  </Button>
                  <Button onClick={() => goToProduct(result.recommended?.slug)} className="flex-1 gap-2 font-bold">
                    عرض الطابعة
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
