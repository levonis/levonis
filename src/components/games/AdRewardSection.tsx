import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ticket, Play, CheckCircle2, Tv, Loader2, X, Gift, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const AD_VIEW_SECONDS = 15;
const ADS_REQUIRED = 2;
const MAX_DAILY_TICKETS = 5;
const AD_LOAD_TIMEOUT_MS = 5000;

const AD_BANNER_KEY = "a1726696a5eb0fca2ce34179481ff13f";
const AD_BANNER_INVOKE_URL = `https://www.highperformanceformat.com/${AD_BANNER_KEY}/invoke.js`;
const AD_SMARTLINK_URL = "https://www.profitablecpmratenetwork.com/ywvuwywmv?key=02c371897e5f719a5867bb155a764826";
const AD_SOCIAL_BAR_URL = "https://pl29046248.profitablecpmratenetwork.com/d0/f2/b6/d0f2b62f2043abab1c57a0ceebbea3aa.js";

type AdState = "idle" | "loading" | "viewing" | "completing";
type AdType = "banner" | "social" | "smartlink" | null;

export default function AdRewardSection() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [watchCount, setWatchCount] = useState(0);
  const [adState, setAdState] = useState<AdState>("idle");
  const [activeAdType, setActiveAdType] = useState<AdType>(null);
  const [fallbackMode, setFallbackMode] = useState<"none" | "smartlink">("none");
  const [ticketAwarded, setTicketAwarded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const countdownRef = useRef<number | null>(null);
  const loadTimeoutRef = useRef<number | null>(null);
  const adSlotRef = useRef<HTMLDivElement>(null);
  const bannerScriptRef = useRef<HTMLScriptElement | null>(null);
  const socialScriptRef = useRef<HTMLScriptElement | null>(null);
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

  const clearAdSlot = useCallback(() => {
    if (adSlotRef.current) {
      adSlotRef.current.innerHTML = "";
    }
  }, []);

  const removeInjectedScripts = useCallback(() => {
    if (bannerScriptRef.current) {
      try {
        bannerScriptRef.current.remove();
      } catch {}
      bannerScriptRef.current = null;
    }

    if (socialScriptRef.current) {
      try {
        socialScriptRef.current.remove();
      } catch {}
      socialScriptRef.current = null;
    }
  }, []);

  const cleanup = useCallback(
    (options?: { clearSlot?: boolean }) => {
      if (countdownRef.current) {
        window.clearInterval(countdownRef.current);
        countdownRef.current = null;
      }

      if (loadTimeoutRef.current) {
        window.clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }

      removeInjectedScripts();
      countdownStartedRef.current = false;
      setActiveAdType(null);
      setFallbackMode("none");

      if (options?.clearSlot !== false) {
        clearAdSlot();
      }
    },
    [clearAdSlot, removeInjectedScripts]
  );

  useEffect(() => {
    if (!sessionId) startNewSession();
  }, [sessionId, startNewSession]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const handleAdComplete = useCallback(async () => {
    if (!user || !sessionId) return;

    cleanup({ clearSlot: false });
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
          clearAdSlot();
        }, 2000);
      } else {
        setAdState("idle");
        clearAdSlot();
      }
    } catch (err: any) {
      console.error("Ad watch error:", err);
      toast.error("حدث خطأ، حاول مرة أخرى");
      setAdState("idle");
    }

    setLoading(false);
  }, [cleanup, clearAdSlot, queryClient, sessionId, startNewSession, user, watchCount]);

  const startCountdown = useCallback(
    (adType: Exclude<AdType, null>) => {
      if (countdownStartedRef.current) return;

      if (loadTimeoutRef.current) {
        window.clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }

      countdownStartedRef.current = true;
      setActiveAdType(adType);
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
    },
    [handleAdComplete]
  );

  const showSmartlinkFallback = useCallback(() => {
    removeInjectedScripts();
    clearAdSlot();
    setFallbackMode("smartlink");
  }, [clearAdSlot, removeInjectedScripts]);

  const trySocialBarAd = useCallback(() => {
    clearAdSlot();

    if (adSlotRef.current) {
      adSlotRef.current.innerHTML = `
        <div style="min-height:280px;display:flex;align-items:center;justify-content:center;padding:16px;text-align:center;color:hsl(var(--muted-foreground));font-family:monospace;font-size:12px;">
          Social Bar is opening on the page...
        </div>
      `;
    }

    const script = document.createElement("script");
    script.src = AD_SOCIAL_BAR_URL;
    script.async = true;
    script.onload = () => {
      startCountdown("social");
    };
    script.onerror = () => {
      showSmartlinkFallback();
    };

    socialScriptRef.current = script;
    document.body.appendChild(script);
  }, [clearAdSlot, showSmartlinkFallback, startCountdown]);

  const tryBannerAd = useCallback(() => {
    const slot = adSlotRef.current;
    if (!slot) {
      trySocialBarAd();
      return;
    }

    clearAdSlot();

    (window as Window & { atOptions?: unknown }).atOptions = {
      key: AD_BANNER_KEY,
      format: "iframe",
      height: 250,
      width: 300,
      params: {},
    };

    const script = document.createElement("script");
    script.src = AD_BANNER_INVOKE_URL;
    script.async = true;
    script.onload = () => {
      window.setTimeout(() => {
        const hasBanner = !!slot.querySelector("iframe");
        if (hasBanner) {
          startCountdown("banner");
          return;
        }
        trySocialBarAd();
      }, 1200);
    };
    script.onerror = () => {
      trySocialBarAd();
    };

    bannerScriptRef.current = script;
    slot.appendChild(script);
  }, [clearAdSlot, startCountdown, trySocialBarAd]);

  const triggerAd = useCallback(() => {
    if (!user || !canEarnMore || adState !== "idle") return;

    cleanup();
    setCountdown(0);
    setAdState("loading");

    loadTimeoutRef.current = window.setTimeout(() => {
      if (!countdownStartedRef.current) {
        showSmartlinkFallback();
      }
    }, AD_LOAD_TIMEOUT_MS);

    tryBannerAd();
  }, [adState, canEarnMore, cleanup, showSmartlinkFallback, tryBannerAd, user]);

  const handleSmartlinkOpen = () => {
    window.open(AD_SMARTLINK_URL, "_blank", "noopener,noreferrer");
    setFallbackMode("none");
    startCountdown("smartlink");
  };

  const cancelAd = () => {
    cleanup();
    setAdState("idle");
    setCountdown(0);
  };

  if (!user || !isAdmin) return null;

  const isLoadingAd = adState === "loading";
  const isViewingAd = adState === "viewing";
  const isActive = isLoadingAd || isViewingAd;

  const statusText =
    fallbackMode === "smartlink"
      ? "Banner/Social Bar unavailable — open Smartlink instead"
      : isLoadingAd
        ? "Loading ad..."
        : activeAdType === "banner"
          ? `Banner ad is showing — ${countdown}s left`
          : activeAdType === "social"
            ? `Social Bar opened on the page — ${countdown}s left`
            : activeAdType === "smartlink"
              ? `Smartlink opened — ${countdown}s left`
              : `Watch the ad — ${countdown}s left`;

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
            ) : i === watchCount && isActive ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{isLoadingAd ? "Loading..." : `${countdown}s`}</span>
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                <span>إعلان {i + 1}</span>
              </>
            )}
          </div>
        ))}

        <div
          className={cn(
            "h-10 w-10 rounded flex items-center justify-center border transition-all",
            ticketAwarded ? "bg-yellow-500/20 border-yellow-500/40" : "bg-muted/20 border-border/30"
          )}
        >
          <Ticket className={cn("h-4 w-4", ticketAwarded ? "text-yellow-400" : "text-muted-foreground/40")} />
        </div>
      </div>

      {isActive && (
        <div className="relative rounded border border-border bg-background overflow-hidden">
          <div className="flex items-center justify-between px-2 py-1 bg-muted/50 border-b border-border">
            <span className="text-[10px] font-mono text-muted-foreground">{statusText}</span>
            <button onClick={cancelAd} className="text-muted-foreground hover:text-destructive transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div ref={adSlotRef} className="min-h-[280px] flex items-center justify-center bg-muted/10" />

          {fallbackMode === "smartlink" && (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="pixel-frame bg-background/95 p-4 text-center space-y-3 max-w-xs">
                <p className="text-xs font-mono text-muted-foreground">Banner and Social Bar did not load. Open Smartlink ad.</p>
                <Button size="sm" onClick={handleSmartlinkOpen} className="font-mono text-xs gap-1.5 pixel-frame bg-primary hover:bg-primary/90 text-ring">
                  <ExternalLink className="h-3.5 w-3.5" /> Open Smartlink
                </Button>
              </div>
            </div>
          )}

          <div className="h-1.5 bg-muted/30">
            <div
              className="h-full bg-primary transition-all duration-1000 ease-linear"
              style={{ width: isViewingAd ? `${((AD_VIEW_SECONDS - countdown) / AD_VIEW_SECONDS) * 100}%` : "0%" }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {isActive ? (
          <Button variant="outline" size="sm" onClick={cancelAd} className="flex-1 font-mono text-xs gap-1 pixel-frame">
            <X className="h-3.5 w-3.5" /> Cancel
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
            {!canEarnMore ? (isAdmin ? "Watch ad" : "Daily limit") : watchCount === 0 ? "Watch first ad" : "Watch second ad"}
          </Button>
        )}
      </div>
    </div>
  );
}
