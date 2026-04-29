import { useState, useEffect } from "react";
import { ExternalLink, Globe, Loader2, ShieldCheck, AlertCircle, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Props {
  slug: string;
  onOpen: () => void;
}

const APEX_DOMAIN = "levonisiq.com";

/**
 * Shows both the path-based URL (always works) and the subdomain URL
 * (works when wildcard DNS + Lovable custom domain are set up).
 * Admins can trigger automatic Cloudflare wildcard setup with one click.
 */
export default function StandaloneLinkCard({ slug, onOpen }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(false);
  const [setting, setSetting] = useState(false);
  const [wildcardStatus, setWildcardStatus] = useState<"unknown" | "ready" | "missing">("unknown");

  const pathUrl = `${window.location.origin}/s/${slug}`;
  const subdomainUrl = `https://${slug}.${APEX_DOMAIN}`;

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user?.id]);

  // Auto-check wildcard status on mount, and auto-setup if admin & missing
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("cloudflare-api", {
          body: { action: "subdomain_check", params: { slug } },
        });
        if (cancelled) return;
        if (data?.covered_by_wildcard) {
          setWildcardStatus("ready");
          return;
        }
        setWildcardStatus("missing");
        // Auto-create wildcard if user is admin
        if (isAdmin) {
          const { data: setupData } = await supabase.functions.invoke("cloudflare-api", {
            body: { action: "wildcard_setup", params: { proxied: true } },
          });
          if (!cancelled && setupData?.success) {
            setWildcardStatus("ready");
            toast({
              title: "✅ Wildcard مُفعّل تلقائياً",
              description: "نطاقات المتاجر الفرعية جاهزة للعمل",
            });
          }
        }
      } catch {
        if (!cancelled) setWildcardStatus("missing");
      }
    })();
    return () => { cancelled = true; };
  }, [slug, isAdmin, toast]);

  const checkWildcard = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("cloudflare-api", {
        body: { action: "subdomain_check", params: { slug } },
      });
      if (error) throw error;
      setWildcardStatus(data?.covered_by_wildcard ? "ready" : "missing");
    } catch (e) {
      setWildcardStatus("missing");
    } finally {
      setChecking(false);
    }
  };

  const setupWildcard = async () => {
    setSetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("cloudflare-api", {
        body: { action: "wildcard_setup", params: { proxied: true } },
      });
      if (error) throw error;
      toast({
        title: data?.status === "exists" ? "Wildcard موجود مسبقاً" : "تم إنشاء Wildcard",
        description: data?.message || "DNS جاهز للنطاقات الفرعية",
      });
      setWildcardStatus("ready");
    } catch (e: any) {
      toast({ title: "فشل الإعداد", description: e.message, variant: "destructive" });
    } finally {
      setSetting(false);
    }
  };

  const copy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: "تم نسخ الرابط" });
  };

  return (
    <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">موقع متجرك المستقل</h3>
          {wildcardStatus === "ready" && (
            <Badge variant="secondary" className="gap-1 text-[10px] h-5">
              <ShieldCheck className="h-3 w-3" /> النطاق الفرعي جاهز
            </Badge>
          )}
        </div>

        {/* Path-based URL — always works */}
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">الرابط الأساسي (يعمل دائماً):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] bg-muted/50 px-2 py-1.5 rounded break-all">{pathUrl}</code>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copy(pathUrl)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Subdomain URL — requires wildcard */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">الرابط الاحترافي (نطاق فرعي):</p>
            {wildcardStatus !== "ready" && (
              <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={checkWildcard} disabled={checking}>
                {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : "فحص الحالة"}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] bg-muted/50 px-2 py-1.5 rounded break-all">{subdomainUrl}</code>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copy(subdomainUrl)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          {wildcardStatus === "missing" && (
            <div className="flex items-start gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>النطاق الفرعي لم يُفعّل بعد. {isAdmin && "اضغط الزر أدناه للإعداد التلقائي."}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="gap-1" onClick={onOpen}>
            <ExternalLink className="h-3.5 w-3.5" />
            افتح المتجر
          </Button>

          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={setupWildcard}
              disabled={setting}
            >
              {setting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
              {setting ? "جاري الإعداد..." : "إعداد Wildcard DNS (مدير)"}
            </Button>
          )}
        </div>

        {isAdmin && (
          <p className="text-[10px] text-muted-foreground border-t pt-2">
            💡 الإعداد التلقائي يُنشئ سجل DNS واحد <code className="bg-muted px-1">*.{APEX_DOMAIN}</code> في Cloudflare يُغطّي جميع المتاجر تلقائياً. تحتاج بعدها لإضافة <code className="bg-muted px-1">*.{APEX_DOMAIN}</code> كنطاق مخصص في إعدادات Lovable مرة واحدة.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
