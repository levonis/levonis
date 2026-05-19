import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Link2, Sparkles, Upload, Loader2, FileBox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import QuoteResultCard, { QuoteResult } from "@/components/community/QuoteResultCard";
import { useLanguage } from "@/lib/i18n";
import { analyzeModelFile, detectExt } from "@/lib/modelAnalysis/analyzeClient";
import type { ModelMetrics, QualityReport } from "@/lib/modelAnalysis/types";

const SUPPORTED_HOSTS = ["thingiverse.com", "printables.com", "makerworld.com", "cults3d.com"];

export default function CommunityQuoteFromLink() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const t = (ar: string, en: string) => (isAr ? ar : en);

  const [tab, setTab] = useState<"link" | "file">("link");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressStage, setProgressStage] = useState("");
  // For geometry-based quotes we keep metrics so material switching can re-price.
  const [analysis, setAnalysis] = useState<{
    metrics: ModelMetrics; quality: QualityReport; fileHash: string; fileName: string;
  } | null>(null);
  const [materialChanging, setMaterialChanging] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  const submitUrl = async () => {
    if (!url.trim()) return;
    setLoading(true); setResult(null); setAnalysis(null);
    try {
      const { data, error } = await supabase.functions.invoke("print-quote-from-link", {
        body: { url: url.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult({ ...data, sourceUrl: url.trim() });
    } catch (e: any) {
      toast({
        title: t("تعذّر تحليل الرابط", "Could not parse link"),
        description: e.message || t("جرّب رفع ملف STL بدلًا من ذلك", "Try uploading an STL file instead"),
        variant: "destructive",
      });
      setTab("file");
    } finally { setLoading(false); }
  };

  const priceFromGeometry = async (
    metrics: ModelMetrics, quality: QualityReport, fileHash: string, fileName: string, materialCode: string,
  ) => {
    const { data, error } = await supabase.functions.invoke("price-3d-model", {
      body: { metrics, quality, file_hash: fileHash, file_name: fileName, material_code: materialCode },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as QuoteResult;
  };

  const handleFile = async (file: File) => {
    const ext = detectExt(file.name);
    if (!ext) {
      toast({ title: t("امتداد غير مدعوم", "Unsupported file"), description: "STL / 3MF / OBJ", variant: "destructive" });
      return;
    }
    setLoading(true); setResult(null); setProgressPct(0); setProgressStage(t("قراءة الملف", "Reading file"));
    setFileToUpload(file);
    try {
      const analyzed = await analyzeModelFile(file, {
        onProgress: (stage, pct) => { setProgressStage(stage); setProgressPct(pct); },
      });
      setAnalysis({ ...analyzed, fileName: file.name });
      const priced = await priceFromGeometry(
        analyzed.metrics, analyzed.quality, analyzed.fileHash, file.name, "pla",
      );
      setResult({ ...priced, sourceFileName: file.name });
    } catch (e: any) {
      // Geometry parsing fallback → AI estimation from file size.
      try {
        const { data, error } = await supabase.functions.invoke("print-quote-from-link", {
          body: { file_meta: { name: file.name, size_bytes: file.size } },
        });
        if (error || data?.error) throw new Error(error?.message || data?.error);
        setResult({ ...data, sourceFileName: file.name });
        toast({
          title: t("تم استخدام تقدير ذكي", "Used AI fallback"),
          description: t("تعذر التحليل الدقيق، تم تقدير القيم", "Couldn't analyze geometry; estimated instead"),
        });
      } catch (e2: any) {
        toast({ title: t("فشل التحليل", "Analysis failed"), description: e.message || e2.message, variant: "destructive" });
      }
    } finally { setLoading(false); setProgressPct(0); }
  };

  const handleMaterialChange = async (code: string) => {
    if (!analysis) return;
    setMaterialChanging(true);
    try {
      const priced = await priceFromGeometry(
        analysis.metrics, analysis.quality, analysis.fileHash, analysis.fileName, code,
      );
      setResult({ ...priced, sourceFileName: analysis.fileName });
    } catch (e: any) {
      toast({ title: t("خطأ", "Error"), description: e.message, variant: "destructive" });
    } finally { setMaterialChanging(false); }
  };

  const createRequest = async () => {
    if (!result) return;
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t("يجب تسجيل الدخول", "Login required"));

      let fileUrl: string | null = null;
      if (fileToUpload) {
        const path = `${user.id}/${Date.now()}-${fileToUpload.name}`;
        const { error: upErr } = await supabase.storage.from("print-quote-files").upload(path, fileToUpload, { upsert: false });
        if (!upErr) fileUrl = path;
      }

      const m = result.model;
      const b = result.breakdown;
      const insertPayload: any = {
        user_id: user.id,
        title: m.name?.slice(0, 80) || t("طلب طباعة فوري", "Instant print request"),
        description: [
          t("طلب من تحليل ملف ثلاثي الأبعاد", "Auto-quote from 3D model file"),
          result.sourceUrl ? `Link: ${result.sourceUrl}` : "",
          fileUrl ? `File: ${fileUrl}` : "",
        ].filter(Boolean).join("\n"),
        size: m.dimensions_mm
          ? `${Math.round(m.dimensions_mm.x)}×${Math.round(m.dimensions_mm.y)}×${Math.round(m.dimensions_mm.z)} mm`
          : t("حسب النموذج", "As per model"),
        colors: t("أي لون متاح", "Any available color"),
        notes: t(
          `وزن مقدّر: ${b.inputs.weight_g}g · وقت الطباعة: ~${Math.round(b.inputs.print_minutes / 60)}س · صعوبة: ${b.inputs.difficulty}`,
          `Est. weight: ${b.inputs.weight_g}g · Print time: ~${Math.round(b.inputs.print_minutes / 60)}h · Difficulty: ${b.inputs.difficulty}`,
        ),
        image_url: m.thumbnail,
        images: m.thumbnail ? [m.thumbnail] : [],
        reference_links: result.sourceUrl ? [result.sourceUrl] : [],
        material_type: result.material?.code ?? "any",
        quote_source: result.sourceUrl ? "url_quote" : "file_quote",
        quote_url: result.sourceUrl || null,
        estimated_weight_g: b.inputs.weight_g,
        estimated_print_minutes: b.inputs.print_minutes,
        difficulty: b.inputs.difficulty,
        estimated_price_min: b.price_min,
        estimated_price_max: b.price_max,
        quote_breakdown: b,
        status: "pending_review",
      };

      const { data: inserted, error } = await supabase
        .from("community_print_requests").insert(insertPayload).select("id").single();
      if (error) throw error;

      toast({
        title: t("تم إنشاء طلب الطباعة", "Print request created"),
        description: t("سيتم نشره للتجار للموافقة عليه", "It will be sent to traders for approval"),
      });
      navigate(`/community/customer/track?id=${inserted.id}`);
    } catch (e: any) {
      toast({ title: t("تعذّر الإنشاء", "Create failed"), description: e.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="container mx-auto max-w-2xl px-4 py-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" />{t("رجوع", "Back")}
        </Button>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              {t("سعر طباعتك الفوري", "Instant 3D Print Quote")}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {t("ألصق رابط نموذج، أو ارفع ملف STL/3MF/OBJ لتحليل دقيق وتسعير فوري.",
                 "Paste a model link, or upload an STL/3MF/OBJ for precise analysis and instant pricing.")}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "link" | "file")}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="link"><Link2 className="h-4 w-4 me-1" />{t("رابط", "Link")}</TabsTrigger>
                <TabsTrigger value="file"><FileBox className="h-4 w-4 me-1" />{t("ملف", "File")}</TabsTrigger>
              </TabsList>

              <TabsContent value="link" className="space-y-3 pt-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link2 className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="https://www.printables.com/model/..."
                      value={url} onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submitUrl()}
                      className="ps-10" dir="ltr"
                    />
                  </div>
                  <Button onClick={submitUrl} disabled={loading || !url.trim()}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("احسب", "Quote")}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                  {SUPPORTED_HOSTS.map((h) => (
                    <span key={h} className="px-2 py-0.5 rounded-full bg-muted/40 border border-border/40">{h}</span>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="file" className="space-y-3 pt-3">
                <label className="block">
                  <input type="file" accept=".stl,.3mf,.obj" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                  <div className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:bg-muted/30 transition">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">{t("اضغط لرفع ملف STL / 3MF / OBJ", "Click to upload STL / 3MF / OBJ")}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("الحد الأقصى 100MB · تحليل محلي في المتصفح", "Up to 100MB · Analyzed locally in your browser")}</p>
                  </div>
                </label>
                {loading && progressPct > 0 && (
                  <div className="space-y-1">
                    <Progress value={progressPct} className="h-2" />
                    <div className="text-xs text-muted-foreground text-center">{progressStage} · {progressPct}%</div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {loading && !progressPct && (
          <Card className="glass-panel mt-4">
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        )}

        {result && !loading && (
          <div className="mt-4">
            <QuoteResultCard
              result={result}
              onCreate={createRequest}
              creating={creating}
              onUseFile={() => setTab("file")}
              onMaterialChange={analysis ? handleMaterialChange : undefined}
              materialChanging={materialChanging}
            />
          </div>
        )}
      </div>
    </div>
  );
}
