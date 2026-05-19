import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Link2, Sparkles, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import QuoteResultCard, { QuoteResult } from "@/components/community/QuoteResultCard";
import { useLanguage } from "@/contexts/LanguageContext";

const SUPPORTED_HOSTS = ["thingiverse.com", "printables.com", "makerworld.com", "cults3d.com"];

export default function CommunityQuoteFromLink() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [showFileFallback, setShowFileFallback] = useState(false);

  const t = (ar: string, en: string) => (isAr ? ar : en);

  const submit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    setShowFileFallback(false);
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
      setShowFileFallback(true);
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (file: File) => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("print-quote-from-link", {
        body: { file_meta: { name: file.name, size_bytes: file.size } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult({ ...data, sourceFileName: file.name });
    } catch (e: any) {
      toast({ title: t("خطأ", "Error"), description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const createRequest = async () => {
    if (!result) return;
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t("يجب تسجيل الدخول", "Login required"));

      const m = result.model;
      const b = result.breakdown;
      const title = m.name?.slice(0, 80) || t("طلب طباعة فوري", "Instant print request");
      const description = [
        t("طلب من رابط نموذج ثلاثي الأبعاد", "Auto-quote from 3D model link"),
        result.sourceUrl ? `${t("الرابط", "Link")}: ${result.sourceUrl}` : "",
        m.description?.slice(0, 400) || "",
      ].filter(Boolean).join("\n");

      const insertPayload: any = {
        user_id: user.id,
        title,
        description,
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
        material_type: "any",
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
        .from("community_print_requests")
        .insert(insertPayload)
        .select("id")
        .single();
      if (error) throw error;

      toast({
        title: t("تم إنشاء طلب الطباعة", "Print request created"),
        description: t("سيتم نشره للتجار للموافقة عليه", "It will be sent to traders for approval"),
      });
      navigate(`/community/customer/track?id=${inserted.id}`);
    } catch (e: any) {
      toast({ title: t("تعذّر الإنشاء", "Create failed"), description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="container mx-auto max-w-2xl px-4 py-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t("رجوع", "Back")}
        </Button>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              {t("سعر طباعتك من رابط النموذج", "Instant Quote from Model Link")}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {t(
                "ألصق رابط نموذج من Thingiverse / Printables / MakerWorld / Cults وسنقدّر لك السعر فوريًا.",
                "Paste a link from Thingiverse, Printables, MakerWorld, or Cults — we'll estimate the price.",
              )}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="https://www.printables.com/model/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  className="ps-10"
                  dir="ltr"
                />
              </div>
              <Button onClick={submit} disabled={loading || !url.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("احسب", "Quote")}
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
              {SUPPORTED_HOSTS.map((h) => (
                <span key={h} className="px-2 py-0.5 rounded-full bg-muted/40 border border-border/40">
                  {h}
                </span>
              ))}
            </div>

            {(showFileFallback || result?.sourceFileName) && (
              <label className="block">
                <input
                  type="file"
                  accept=".stl,.3mf,.obj"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                <div className="border border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:bg-muted/30 transition">
                  <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-sm">{t("ارفع ملف STL / 3MF بدلًا من ذلك", "Upload STL / 3MF instead")}</p>
                </div>
              </label>
            )}
          </CardContent>
        </Card>

        {loading && (
          <Card className="glass-panel mt-4">
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        )}

        {result && !loading && (
          <div className="mt-4">
            <QuoteResultCard
              result={result}
              onCreate={createRequest}
              creating={creating}
              onUseFile={() => setShowFileFallback(true)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
