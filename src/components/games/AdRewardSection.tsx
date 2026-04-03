import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ticket, Play, CheckCircle2, Tv, Loader2, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ADS_REQUIRED = 2;
const MAX_DAILY_TICKETS = 5;

// Ezoic Rewarded Ads global types
declare global {
  interface Window {
    ezRewardedAds?: {
      cmd: Array<() => void>;
      requestAd: () => void;
      onAdRequested?: (ad: { showAd: () => void } | null) => void;
      onAdRewarded?: () => void;
      onAdClosed?: () => void;
      onAdError?: (error: any) => void;
    };
  }
}

export default function AdRewardSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [watchCount, setWatchCount] = useState(0);
  const [isWatching, setIsWatching] = useState(false);
  const [ticketAwarded, setTicketAwarded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adReady, setAdReady] = useState(false);
  const pendingAdRef = useRef<{ showAd: () => void } | null>(null);
  const watchCountRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => { watchCountRef.current = watchCount; }, [watchCount]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // Fetch today's earned tickets from ads
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

  const canEarnMore = dailyEarned < MAX_DAILY_TICKETS;

  const startNewSession = useCallback(() => {
    const newId = crypto.randomUUID();
    setSessionId(newId);
    sessionIdRef.current = newId;
    setWatchCount(0);
    watchCountRef.current = 0;
    setTicketAwarded(false);
  }, []);

  useEffect(() => {
    if (!sessionId) startNewSession();
  }, [sessionId, startNewSession]);

  // Record ad watch in database
  const recordAdWatch = useCallback(async () => {
    if (!user || !sessionIdRef.current) return;
    setLoading(true);
    const newCount = watchCountRef.current + 1;

    try {
      const { data, error } = await supabase.rpc("record_ad_watch_and_award", {
        p_user_id: user.id,
        p_session_id: sessionIdRef.current,
        p_watch_number: newCount,
      });

      if (error) throw error;

      const result = data as any;
      if (result?.error === "daily_limit_reached") {
        toast.info("وصلت للحد اليومي! عد غداً 🎟️");
        setIsWatching(false);
        setLoading(false);
        return;
      }

      setWatchCount(newCount);
      watchCountRef.current = newCount;

      if (result?.ticket_awarded) {
        setTicketAwarded(true);
        toast.success("🎟️ حصلت على تذكرة مجانية!");
        queryClient.invalidateQueries({ queryKey: ["user-tickets-game"] });
        queryClient.invalidateQueries({ queryKey: ["user-tickets"] });
        queryClient.invalidateQueries({ queryKey: ["ad-daily-earned"] });
        setTimeout(() => startNewSession(), 2000);
      }
    } catch (err: any) {
      console.error("Ad watch error:", err);
      toast.error("حدث خطأ، حاول مرة أخرى");
    }

    setIsWatching(false);
    setLoading(false);
  }, [user, queryClient, startNewSession]);

  // Setup Ezoic rewarded ad callbacks
  useEffect(() => {
    if (!window.ezRewardedAds) return;

    window.ezRewardedAds.cmd.push(() => {
      // Called when ad is fetched and ready to show
      window.ezRewardedAds!.onAdRequested = (ad) => {
        if (ad) {
          pendingAdRef.current = ad;
          setAdReady(true);
          // Auto-show the ad immediately
          ad.showAd();
        } else {
          toast.error("لا توجد إعلانات متاحة حالياً");
          setIsWatching(false);
          setLoading(false);
        }
      };

      // Called when user earns the reward (watched the full ad)
      window.ezRewardedAds!.onAdRewarded = () => {
        recordAdWatch();
      };

      // Called when ad is closed (may or may not have been rewarded)
      window.ezRewardedAds!.onAdClosed = () => {
        setAdReady(false);
        pendingAdRef.current = null;
      };

      // Called on ad error
      window.ezRewardedAds!.onAdError = (error) => {
        console.error("Ezoic ad error:", error);
        toast.error("حدث خطأ في تحميل الإعلان");
        setIsWatching(false);
        setLoading(false);
        setAdReady(false);
      };
    });
  }, [recordAdWatch]);

  const startWatchingAd = () => {
    if (!user || !canEarnMore || isWatching) return;
    setIsWatching(true);
    setLoading(true);

    // Request a rewarded ad from Ezoic
    if (window.ezRewardedAds) {
      window.ezRewardedAds.cmd.push(() => {
        window.ezRewardedAds!.requestAd();
      });
    } else {
      // Fallback: Ezoic not loaded yet
      toast.error("نظام الإعلانات غير جاهز، حاول مرة أخرى");
      setIsWatching(false);
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="pixel-frame p-3 space-y-3">
      {/* Header */}
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
          {dailyEarned}/{MAX_DAILY_TICKETS} اليوم
        </div>
      </div>

      {/* Ad Watching Progress */}
      <div className="flex items-center gap-2">
        {Array.from({ length: ADS_REQUIRED }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 h-10 rounded flex items-center justify-center gap-1.5 border transition-all font-mono text-[10px]",
              i < watchCount
                ? "bg-green-500/20 border-green-500/40 text-green-400"
                : i === watchCount && isWatching
                ? "bg-primary/20 border-primary/40 text-primary animate-pulse"
                : "bg-muted/30 border-border/50 text-muted-foreground"
            )}
          >
            {i < watchCount ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>تم</span>
              </>
            ) : i === watchCount && isWatching ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>جاري...</span>
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
          ticketAwarded
            ? "bg-yellow-500/20 border-yellow-500/40"
            : "bg-muted/20 border-border/30"
        )}>
          <Ticket className={cn(
            "h-4 w-4",
            ticketAwarded ? "text-yellow-400" : "text-muted-foreground/40"
          )} />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {ticketAwarded ? (
          <div className="flex-1 flex items-center justify-center gap-1.5 py-2 text-green-400 font-mono text-xs">
            <Gift className="h-4 w-4" />
            <span>تم الحصول على التذكرة!</span>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={startWatchingAd}
            disabled={!canEarnMore || isWatching || loading}
            className="flex-1 font-mono text-xs gap-1.5 pixel-frame bg-primary hover:bg-primary/90"
          >
            {isWatching || loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {!canEarnMore 
              ? "الحد اليومي" 
              : isWatching 
              ? "جاري عرض الإعلان..." 
              : watchCount === 0 
              ? "شاهد الإعلان الأول" 
              : "شاهد الإعلان الثاني"}
          </Button>
        )}
      </div>
    </div>
  );
}
