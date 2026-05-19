import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Link2, Sparkles, Upload, Loader2, FileBox, Box, Maximize2 } from "lucide-react";
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
import Model3DViewer from "@/components/community/viewer/Model3DViewer";
import ViewerDialog from "@/components/community/viewer/ViewerDialog";

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
  const [paramsChanging, setParamsChanging] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [quoteParams, setQuoteParams] = useState<{ qty: number; rush_tier: "standard" | "fast" | "rush" }>({ qty: 1, rush_tier: "standard" });

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  /** Detect direct downloadable model URLs (.stl/.3mf/.obj/.glb/.gltf). */
  const isDirectModelUrl = (s: string) => /\.(stl|3mf|obj|glb|gltf)(\?.*)?$/i.test(s.trim());

  const submitUrl = async () => {
    if (!url.trim()) return;
    setLoading(true); setResult(null); setAnalysis(null);
    // If the URL points directly to a model file, surface it in the 3D viewer too.
    setViewerUrl(isDirectModelUrl(url) ? url.trim() : null);
    setFileToUpload(null);
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
    params?: { qty: number; rush_tier: "standard" | "fast" | "rush" },
  ) => {
    const p = params ?? quoteParams;
    const { data, error } = await supabase.functions.invoke("price-3d-model", {
      body: { metrics, quality, file_hash: fileHash, file_name: fileName, material_code: materialCode, qty: p.qty, rush_tier: p.rush_tier },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as QuoteResult;
  };

  const handleParamsChange = async (next: { qty: number; rush_tier: "standard" | "fast" | "rush" }) => {
    setQuoteParams(next);
    if (!analysis) return;
    setParamsChanging(true);
    try {
      const priced = await priceFromGeometry(
        analysis.metrics, analysis.quality, analysis.fileHash, analysis.fileName,
        result?.material?.code ?? "pla", next,
      );
      setResult({ ...priced, sourceFileName: analysis.fileName });
    } catch (e: any) {
      toast({ title: t("خطأ", "Error"), description: e.message, variant: "destructive" });
    } finally { setParamsChanging(false); }
  };


  const handleFile = async (file: File) => {
    const ext = detectExt(file.name);
    if (!ext) {
      toast({ title: t("امتداد غير مدعوم", "Unsupported file"), description: "STL / 3MF / OBJ", variant: "destructive" });
      return;
    }
    setLoading(true); setResult(null); setProgressPct(0); setProgressStage(t("قراءة الملف", "Reading file"));
    setFileToUpload(file);
    setViewerUrl(null);
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

      // Mark url-analytics conversion (non-blocking)
      if (result.url_hash) {
        supabase.functions.invoke("print-quote-from-link", {
          body: { mark_converted: { url_hash: result.url_hash } },
        }).catch(() => {});
      }

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
    <div className="min-h-screen pb-24 relative overflow-hidden">
      {/* Glass aurora background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-32 -start-24 h-80 w-80 rounded-full bg-primary/30 blur-3xl animate-pulse" style={{ animationDuration: "6s" }} />
        <div className="absolute top-1/3 -end-24 h-96 w-96 rounded-full bg-accent/25 blur-3xl animate-pulse" style={{ animationDuration: "8s" }} />
        <div className="absolute bottom-0 start-1/4 h-72 w-72 rounded-full bg-primary/20 blur-3xl animate-pulse" style={{ animationDuration: "7s" }} />
      </div>

      <div className="container mx-auto max-w-2xl px-4 py-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 gap-2 glass-trigger rounded-full">
          <ArrowLeft className="h-4 w-4" />{t("رجوع", "Back")}
        </Button>

        <div className="space-y-4">


        <Card className="!bg-card/25 !backdrop-blur-2xl !border-white/15 shadow-2xl shadow-primary/10 rounded-3xl">


          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <span className="inline-flex items-center justify-center h-9 w-9 rounded-full glass-panel">
                <Sparkles className="h-5 w-5 text-primary" />
              </span>
              {t("سعر طباعتك الفوري", "Instant 3D Print Quote")}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {t("ألصق رابط نموذج، أو ارفع ملف STL/3MF/OBJ لتحليل دقيق وتسعير فوري.",
                 "Paste a model link, or upload an STL/3MF/OBJ for precise analysis and instant pricing.")}
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "link" | "file")}>
              <TabsList className="grid grid-cols-2 w-full glass-panel">
                <TabsTrigger value="link" className="glass-trigger"><Link2 className="h-4 w-4 me-1" />{t("رابط", "Link")}</TabsTrigger>
                <TabsTrigger value="file" className="glass-trigger"><FileBox className="h-4 w-4 me-1" />{t("ملف", "File")}</TabsTrigger>
              </TabsList>

              <TabsContent value="link" className="space-y-3 pt-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link2 className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="https://www.printables.com/model/..."
                      value={url} onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submitUrl()}
                      className="ps-10 glass-panel" dir="ltr"
                    />
                  </div>
                  <Button onClick={submitUrl} disabled={loading || !url.trim()} className="glass-trigger rounded-full">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("احسب", "Quote")}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                  {SUPPORTED_HOSTS.map((h) => (
                    <span key={h} className="glass-panel px-2 py-0.5 rounded-full">{h}</span>

                  ))}
                </div>
              </TabsContent>

              <TabsContent value="file" className="space-y-3 pt-3">
                <label className="block">
                  <input type="file" accept=".stl,.3mf,.obj" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                  <div className="glass-panel border-2 border-dashed border-foreground/15 rounded-xl p-6 text-center cursor-pointer hover:bg-foreground/[0.04] transition">
                    <span className="inline-flex items-center justify-center h-12 w-12 rounded-full glass-panel mb-2">
                      <Upload className="h-6 w-6 text-primary" />
                    </span>
                    <p className="text-sm font-medium">{t("اضغط لرفع ملف STL / 3MF / OBJ", "Click to upload STL / 3MF / OBJ")}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("الحد الأقصى 200MB · تحليل ومعاينة 3D في المتصفح", "Up to 200MB · Analyzed & previewed in 3D locally")}</p>
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
          <Card className="!bg-card/25 !backdrop-blur-2xl !border-white/15 shadow-2xl shadow-primary/10 rounded-3xl mt-4">
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        )}

        {result && !loading && (
          <div className="mt-4 space-y-4">
            {(fileToUpload || viewerUrl) && (
              <Card className="!bg-card/25 !backdrop-blur-2xl !border-white/15 shadow-2xl shadow-primary/10 rounded-3xl overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center h-8 w-8 rounded-full glass-panel">
                        <Box className="h-4 w-4 text-primary" />
                      </span>
                      {t("معاينة ثلاثية الأبعاد", "3D Preview")}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setViewerOpen(true)} className="glass-trigger rounded-full gap-1.5">
                      <Maximize2 className="h-4 w-4" />
                      {t("ملء الشاشة", "Fullscreen")}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="h-[360px] w-full">
                    <Model3DViewer file={fileToUpload} url={viewerUrl} language={isAr ? "ar" : "en"} />
                  </div>
                </CardContent>
              </Card>
            {!fileToUpload && !viewerUrl && result.sourceUrl && (
              <Card className="!bg-card/25 !backdrop-blur-2xl !border-white/15 shadow-xl rounded-3xl">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="inline-flex items-center justify-center h-10 w-10 rounded-full glass-panel shrink-0">
                    <Box className="h-5 w-5 text-primary" />
                  </span>
                  <div className="flex-1 text-sm">
                    <p className="font-medium">
                      {t("المعاينة ثلاثية الأبعاد تتطلب ملف النموذج", "3D preview needs the actual model file")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t(
                        "صفحات Printables/Thingiverse لا تكشف الملف مباشرة. حمّل ملف STL/3MF/OBJ من الرابط ثم ارفعه هنا لتفعيل المعاينة.",
                        "Printables/Thingiverse pages don't expose the file directly. Download the STL/3MF/OBJ from the link, then upload it here to enable the 3D preview.",
                      )}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setTab("file")} className="glass-trigger rounded-full gap-1.5 shrink-0">
                    <Upload className="h-4 w-4" />
                    {t("ارفع الملف", "Upload file")}
                  </Button>
                </CardContent>
              </Card>
            )}

            <QuoteResultCard
              result={result}
              onCreate={createRequest}
              creating={creating}
              onUseFile={() => setTab("file")}
              onMaterialChange={analysis ? handleMaterialChange : undefined}
              materialChanging={materialChanging}
              onParamsChange={analysis ? handleParamsChange : undefined}
              paramsChanging={paramsChanging}
            />
          </div>
        )}
        </div>
      </div>

      <ViewerDialog
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        file={fileToUpload}
        url={viewerUrl}
        language={isAr ? "ar" : "en"}
      />
    </div>

  );
}
