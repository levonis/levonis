import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ticket, Play, CheckCircle2, Tv, Loader2, X, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const AD_VIEW_SECONDS = 15;
const ADS_REQUIRED = 2;
const MAX_DAILY_TICKETS = 5;

const AD_BANNER_KEY = "a1726696a5eb0fca2ce34179481ff13f";
const AD_INVOKE_URL = `https://www.highperformanceformat.com/${AD_BANNER_KEY}/invoke.js`;

export default function AdRewardSection() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [watchCount, setWatchCount] = useState(0);
  const [adState, setAdState] = useState<"idle" | "loading" | "viewing" | "completing">("idle");
  const [ticketAwarded, setTicketAwarded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const countdownRef = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const countdownStartedRef = useRef(false);

  const { data: dailyEarned = 0 } = useQuery({
    queryKey: ["ad-daily-earned", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("ad_watch_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("ticket_awarded", true)
        .gte("created_at", today.toISOString());
      return count ?? 0;
    },
    enabled: !!user,
  });

  const canEarnMore = isAdmin || dailyEarned < MAX_DAILY_TICKETS;

  const startNewSession = useCallback(() => {
    setSessionId(crypto.randomUUID());
    setWatchCount(0);
    setTicketAwarded(false);
  }, []);

  const clearIframe = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;

    iframeDoc.open();
    iframeDoc.write("");
    iframeDoc.close();
  }, []);

  const cleanup = useCallback((options?: { clearIframe?: boolean }) => {
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    countdownStartedRef.current = false;

    if (options?.clearIframe) {
      clearIframe();
    }
  }, [clearIframe]);

  useEffect(() => {
    if (!sessionId) startNewSession();
  }, [sessionId, startNewSession]);

  useEffect(() => {
    return () => {
      cleanup({ clearIframe: true });
    };
  }, [cleanup]);

  const handleAdComplete = useCallback(async () => {
    if (!user || !sessionId) return;
    cleanup();
    setAdState("completing");
    setLoading(true);
    const newCount = watchCount + 1;

    try {
      const { data, error } = await supabase.rpc("record_ad_watch_and_award", {
        p_user_id: user.id,
        p_session_id: sessionId,
        p_watch_number: newCount,
      });

      if (error) throw error;

      const result = data as any;
      if (result?.error === "daily_limit_reached") {
        toast.info("وصلت للحد اليومي! عد غداً 🎟️");
        setAdState("idle");
        setLoading(false);
        return;
      }

      setWatchCount(newCount);

      if (result?.ticket_awarded) {
        setTicketAwarded(true);
        toast.success("🎟️ حصلت على تذكرة مجانية!");
        queryClient.invalidateQueries({ queryKey: ["user-tickets-game"] });
        queryClient.invalidateQueries({ queryKey: ["user-tickets"] });
        queryClient.invalidateQueries({ queryKey: ["ad-daily-earned"] });
        setTimeout(() => {
          startNewSession();
          setAdState("idle");
        }, 2000);
      } else {
        setAdState("idle");
      }
    } catch (err: any) {
      console.error("Ad watch error:", err);
      toast.error("حدث خطأ، حاول مرة أخرى");
      setAdState("idle");
    }

    setLoading(false);
  }, [cleanup, queryClient, sessionId, startNewSession, user, watchCount]);

  const startCountdown = useCallback(() => {
    if (countdownStartedRef.current) return;

    countdownStartedRef.current = true;
    setAdState("viewing");
    setCountdown(AD_VIEW_SECONDS);

    countdownRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) {
            window.clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          void handleAdComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [handleAdComplete]);

  const triggerAd = useCallback(() => {
    if (!user || !canEarnMore || adState !== "idle") return;

    cleanup({ clearIframe: true });
    setCountdown(0);
    setAdState("loading");

    // Load the Smartlink URL directly in the iframe
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.src = AD_SMARTLINK_URL;
      iframe.onload = () => {
        startCountdown();
      };
      // Fallback: start countdown after 3s even if onload doesn't fire (cross-origin)
      window.setTimeout(() => {
        if (!countdownStartedRef.current) {
          startCountdown();
        }
      }, 3000);
    }
  }, [adState, canEarnMore, cleanup, startCountdown, user]);

  const cancelAd = () => {
    cleanup({ clearIframe: true });
    setAdState("idle");
    setCountdown(0);
  };

  if (!user) return null;

  const isLoadingAd = adState === "loading";
  const isViewingAd = adState === "viewing";
  const isActive = isLoadingAd || isViewingAd;

  return (
    <div className="pixel-frame p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-primary/20">
            <Tv className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-xs font-bold font-mono text-foreground">تذكرة مجانية</h3>
            <p className="text-[10px] text-muted-foreground font-mono">شاهد إعلانين واحصل على تذكرة</p>
          </div>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground px-2 py-0.5 rounded bg-muted/50">
          {isAdmin ? "وضع الأدمن" : `${dailyEarned}/${MAX_DAILY_TICKETS} اليوم`}
        </div>
      </div>

      {/* Progress indicators */}
      <div className="flex items-center gap-2">
        {Array.from({ length: ADS_REQUIRED }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 h-10 rounded flex items-center justify-center gap-1.5 border transition-all font-mono text-[10px]",
              i < watchCount
                ? "bg-green-500/20 border-green-500/40 text-green-400"
                : i === watchCount && isActive
                  ? "bg-primary/20 border-primary/40 text-primary animate-pulse"
                  : "bg-muted/30 border-border/50 text-muted-foreground"
            )}
          >
            {i < watchCount ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>تم</span>
              </>
            ) : i === watchCount && isLoadingAd ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>تحميل...</span>
              </>
            ) : i === watchCount && isViewingAd ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{countdown}s</span>
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                <span>إعلان {i + 1}</span>
              </>
            )}
          </div>
        ))}

        <div className={cn(
          "h-10 w-10 rounded flex items-center justify-center border transition-all",
          ticketAwarded ? "bg-yellow-500/20 border-yellow-500/40" : "bg-muted/20 border-border/30"
        )}>
          <Ticket className={cn("h-4 w-4", ticketAwarded ? "text-yellow-400" : "text-muted-foreground/40")} />
        </div>
      </div>

      {/* In-page ad iframe container */}
      {isActive && (
        <div className="relative rounded border border-border bg-background overflow-hidden">
          <div className="flex items-center justify-between px-2 py-1 bg-muted/50 border-b border-border">
            <span className="text-[10px] font-mono text-muted-foreground">
              {isLoadingAd
                ? "⏳ جارِ تحميل الإعلان..."
                : `📺 شاهد الإعلان — ${countdown} ثانية متبقية`}
            </span>
            <button onClick={cancelAd} className="text-muted-foreground hover:text-destructive transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Ad renders inside this iframe */}
          <iframe
            ref={iframeRef}
            title="ad-frame"
            className="w-full border-0 bg-black/90"
            style={{ height: "280px" }}
            sandbox="allow-scripts allow-popups allow-same-origin allow-popups-to-escape-sandbox"
          />

          {/* Progress bar */}
          <div className="h-1.5 bg-muted/30">
            <div
              className="h-full bg-primary transition-all duration-1000 ease-linear"
              style={{ width: isViewingAd ? `${((AD_VIEW_SECONDS - countdown) / AD_VIEW_SECONDS) * 100}%` : "0%" }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {isActive ? (
          <Button
            variant="outline"
            size="sm"
            onClick={cancelAd}
            className="flex-1 font-mono text-xs gap-1 pixel-frame"
          >
            <X className="h-3.5 w-3.5" /> إلغاء
          </Button>
        ) : ticketAwarded ? (
          <div className="flex-1 flex items-center justify-center gap-1.5 py-2 text-green-400 font-mono text-xs">
            <Gift className="h-4 w-4" />
            <span>تم الحصول على التذكرة!</span>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={triggerAd}
            disabled={!canEarnMore || loading}
            className="flex-1 font-mono text-xs gap-1.5 pixel-frame bg-primary hover:bg-primary/90 text-ring"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {!canEarnMore ? (isAdmin ? "شاهد الإعلان" : "الحد اليومي") : watchCount === 0 ? "شاهد الإعلان الأول" : "شاهد الإعلان الثاني"}
          </Button>
        )}
      </div>
    </div>
  );
}
