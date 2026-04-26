// Auto-completes "daily_login" task on every app open (once per day)
// and "weekly_purchase" task when the user has bought a product within
// the current Sunday→Saturday window (once per week).
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

// Sunday=0 ... Saturday=6 → start of current week (Sunday)
function getWeekStartSunday(d = new Date()) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

export function useDailyLogin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const ranRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // Run only once per session per user
    if (ranRef.current === user.id) return;
    ranRef.current = user.id;

    const run = async () => {
      try {
        // ---- daily_login (once per day) ----
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayIso = today.toISOString();

        const { data: dailyDone } = await supabase
          .from("user_task_completions")
          .select("id")
          .eq("user_id", user.id)
          .eq("task_key", "daily_login")
          .gte("completed_at", todayIso)
          .maybeSingle();

        if (!dailyDone) {
          await supabase.rpc("complete_daily_task", {
            task_key_param: "daily_login",
          });
        }

        // ---- weekly_purchase (once per Sun→Sat week) ----
        const weekStart = getWeekStartSunday();
        const weekStartIso = weekStart.toISOString();

        const { data: weeklyDone } = await supabase
          .from("user_task_completions")
          .select("id")
          .eq("user_id", user.id)
          .eq("task_key", "weekly_purchase")
          .gte("completed_at", weekStartIso)
          .maybeSingle();

        if (!weeklyDone) {
          // Verify the user actually bought something during this week window
          const { count } = await supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .neq("status", "cancelled")
            .gte("created_at", weekStartIso);

          if ((count || 0) > 0) {
            await supabase.rpc("complete_daily_task", {
              task_key_param: "weekly_purchase",
            });
          }
        }

        // Refresh UI
        queryClient.invalidateQueries({ queryKey: ["user-completed-tasks-today"] });
        queryClient.invalidateQueries({ queryKey: ["user-points"] });
        queryClient.invalidateQueries({ queryKey: ["user-streak"] });
        queryClient.invalidateQueries({ queryKey: ["points-transactions"] });
      } catch (e) {
        // Silent — non-blocking side-effect
        console.warn("[useDailyLogin] auto-task error", e);
      }
    };

    run();
  }, [user, queryClient]);
}
