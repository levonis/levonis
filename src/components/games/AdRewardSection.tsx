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

const SOCIAL_BAR_SCRIPT_URL = "https://pl29046248.profitablecpmratenetwork.com/d0/f2/b6/d0f2b62f2043abab1c57a0ceebbea3aa.js";

export default function AdRewardSection() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [watchCount, setWatchCount] = useState(0);
  const [adState, setAdState] = useState<"idle" | "viewing" | "completing">("idle");
  const [ticketAwarded, setTicketAwarded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const countdownRef = useRef<number | null>(null);
  const adContainerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!sessionId) startNewSession();
  }, [sessionId, startNewSession]);

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) window.clearInterval(countdownRef.current);
    };
  }, []);

  const triggerAd = () => {
    if (!user || !canEarnMore || adState !== "idle") return;

    setAdState("viewing");
    setCountdown(AD_VIEW_SECONDS);

    // Inject ad script into document body (Social Bar renders as floating overlay on page)
    const script = document.createElement("script");
    script.src = SOCIAL_BAR_SCRIPT_URL;
    script.async = true;
    script.dataset.adReward = "true";
    document.body.appendChild(script);
    script.onload = () => {
      try { document.body.removeChild(script); } catch {}
    };
    script.onerror = () => {
      try { document.body.removeChild(script); } catch {}
    };

    // Start countdown
    countdownRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) window.clearInterval(countdownRef.current);
          countdownRef.current = null;
          handleAdComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleAdComplete = async () => {
    if (!user || !sessionId) return;
    setAdState("completing");
    setLoading(true);
    const newCount = watchCount + 1;

    // Clean up ad container
    if (adContainerRef.current) adContainerRef.current.innerHTML = "";

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
  };

  const cancelAd = () => {
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (adContainerRef.current) adContainerRef.current.innerHTML = "";
    setAdState("idle");
    setCountdown(0);
  };

  if (!user) return null;

  const isActive = adState === "viewing";

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
          {isAdmin ? "وضع الأدمن" : `${dailyEarned}/${MAX_DAILY_TICKETS} اليوم`}
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

      {/* In-page ad overlay */}
      {isActive && (
        <div className="relative rounded border border-border bg-background overflow-hidden">
          <div className="flex items-center justify-between px-2 py-1 bg-muted/50 border-b border-border">
            <span className="text-[10px] font-mono text-muted-foreground">
              📺 الإعلان — انتظر {countdown} ثانية
            </span>
            <button onClick={cancelAd} className="text-muted-foreground hover:text-destructive transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div
            ref={adContainerRef}
            className="min-h-[200px] flex items-center justify-center bg-muted/10"
          >
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-muted/30">
            <div
              className="h-full bg-primary transition-all duration-1000 ease-linear"
              style={{ width: `${((AD_VIEW_SECONDS - countdown) / AD_VIEW_SECONDS) * 100}%` }}
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
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {!canEarnMore ? (isAdmin ? "شاهد الإعلان" : "الحد اليومي") : watchCount === 0 ? "شاهد الإعلان الأول" : "شاهد الإعلان الثاني"}
          </Button>
        )}
      </div>
    </div>
  );
}
