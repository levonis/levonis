import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useDailyLogin() {
  const { user } = useAuth();

  useEffect(() => {
    const checkAndAwardDailyLogin = async () => {
      if (!user?.id) return;

      try {
        // التحقق من آخر تسجيل دخول
        const { data: lastLogin } = await supabase
          .from("user_task_completions")
          .select("completed_at")
          .eq("user_id", user.id)
          .eq("task_key", "daily_login")
          .order("completed_at", { ascending: false })
          .limit(1)
          .single();

        const today = new Date().toISOString().split('T')[0];
        const lastLoginDate = lastLogin?.completed_at ? 
          new Date(lastLogin.completed_at).toISOString().split('T')[0] : null;

        // إذا لم يسجل دخول اليوم، امنحه النقاط
        if (lastLoginDate !== today) {
          const { data, error } = await supabase.rpc("complete_daily_task", {
            task_key_param: "daily_login",
          });

          if (error) throw error;

          const result = data as any;
          if (result.success) {
            toast.success(`مرحباً! حصلت على ${result.points_earned} نقطة لتسجيل الدخول اليومي 🎉`);
          }
        }
      } catch (error: any) {
        console.error("Error awarding daily login:", error);
      }
    };

    // تأخير بسيط لتجنب التحميل المفرط
    const timer = setTimeout(checkAndAwardDailyLogin, 2000);
    return () => clearTimeout(timer);
  }, [user?.id]);
}
