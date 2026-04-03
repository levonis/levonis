import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ticket, Play, CheckCircle2, Tv, Loader2, X, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MIN_AD_VIEW_SECONDS = 10; // minimum seconds user must spend on ad
const ADS_REQUIRED = 2;
const MAX_DAILY_TICKETS = 5;

const AD_SCRIPT_URL = "https://pl29046247.profitablecpmratenetwork.com/87/10/56/8710563ecddda67a01e4997f82c0a62c.js";
const SOCIAL_BAR_SCRIPT_URL = "https://pl29046248.profitablecpmratenetwork.com/d0/f2/b6/d0f2b62f2043abab1c57a0ceebbea3aa.js";

export default function AdRewardSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [watchCount, setWatchCount] = useState(0);
  const [adState, setAdState] = useState<"idle" | "waiting" | "viewing" | "completing">("idle");
  const [ticketAwarded, setTicketAwarded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timeAway, setTimeAway] = useState(0);

  const leftAtRef = useRef<number | null>(null);
  const adTriggeredRef = useRef(false);

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
    setSessionId(crypto.randomUUID());
    setWatchCount(0);
    setTicketAwarded(false);
  }, []);

  useEffect(() => {
    if (!sessionId) startNewSession();
  }, [sessionId, startNewSession]);

  // Track when user leaves/returns from ad tab
  useEffect(() => {
    if (adState !== "waiting" && adState !== "viewing") return;

    const handleVisibility = () => {
      if (document.hidden) {
        // User left (went to ad tab)
        leftAtRef.current = Date.now();
        setAdState("viewing");
      } else {
        // User returned
        if (leftAtRef.current && adState === "viewing") {
          const secondsAway = Math.floor((Date.now() - leftAtRef.current) / 1000);
          setTimeAway(secondsAway);
          leftAtRef.current = null;

          if (secondsAway >= MIN_AD_VIEW_SECONDS) {
            // User spent enough time on ad
            handleAdComplete();
          } else {
            toast.error(`يجب مشاهدة الإعلان لمدة ${MIN_AD_VIEW_SECONDS} ثوانٍ على الأقل. شاهدت ${secondsAway} ثانية فقط.`);
            setAdState("idle");
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [adState]);

  const triggerAd = () => {
    if (!user || !canEarnMore || adState !== "idle") return;
    setAdState("waiting");
    setTimeAway(0);
    adTriggeredRef.current = true;

    // Load the AdSterra script to trigger the real ad
    const script = document.createElement("script");
    script.src = AD_SCRIPT_URL;
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      // Script loaded and should trigger an ad (popunder/interstitial)
      setTimeout(() => {
        try { document.body.removeChild(script); } catch {}
      }, 3000);
    };

    script.onerror = () => {
      try { document.body.removeChild(script); } catch {}
      toast.error("تعذر تحميل الإعلان. حاول مرة أخرى.");
      setAdState("idle");
    };

  };

  const handleAdComplete = async () => {
    if (!user || !sessionId) return;
    setAdState("completing");
    setLoading(true);
    adTriggeredRef.current = false;
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
  };

  const cancelAd = () => {
    adTriggeredRef.current = false;
    leftAtRef.current = null;
    setAdState("idle");
    setTimeAway(0);
  };

  if (!user) return null;

  const isActive = adState !== "idle" && adState !== "completing";

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
                <span>
                  {adState === "waiting" ? "افتح الإعلان..." : "شاهد الإعلان"}
                </span>
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

      {/* Status message during ad */}
      {isActive && (
        <div className="text-center text-[10px] font-mono text-muted-foreground bg-muted/20 rounded p-2">
          {adState === "waiting" && "⏳ جاري تحميل الإعلان... شاهده بالكامل ثم عد هنا"}
          {adState === "viewing" && "📺 أنت تشاهد الإعلان الآن... عد بعد الانتهاء"}
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
            {!canEarnMore ? "الحد اليومي" : watchCount === 0 ? "شاهد الإعلان الأول" : "شاهد الإعلان الثاني"}
          </Button>
        )}
      </div>
    </div>
  );
}
