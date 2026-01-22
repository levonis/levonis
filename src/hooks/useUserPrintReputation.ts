import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type UserPrintReputation = {
  user_id: string;
  ratings_count: number;
  avg_stars: number;
  avg_quality_stars: number;
  avg_speed_stars: number;
  customer_requests_made: number;
  customer_requests_received: number;
  customer_receive_rate_percent: number;
  merchant_accepted_jobs: number;
  merchant_completed_jobs: number;
  merchant_completion_percent: number;
};

export function useUserPrintReputation(userId?: string) {
  return useQuery({
    queryKey: ["user-print-reputation", userId],
    queryFn: async () => {
      if (!userId) return null;
      // NOTE: generated DB types may lag behind migrations; cast to avoid TS table-name narrowing.
      const { data, error } = await (supabase as any)
        .from("user_print_reputation")
        .select(
          "user_id, ratings_count, avg_stars, avg_quality_stars, avg_speed_stars, customer_requests_made, customer_requests_received, customer_receive_rate_percent, merchant_accepted_jobs, merchant_completed_jobs, merchant_completion_percent"
        )
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as UserPrintReputation | null;
    },
    enabled: !!userId,
  });
}

export async function computeOverallPrintScore(params: {
  avgStars: number;
  completionPercent: number;
  receiveRatePercent: number;
  avgQualityStars: number;
  avgSpeedStars: number;
}) {
  const { data, error } = await supabase.rpc("compute_overall_print_score", {
    p_avg_stars: params.avgStars,
    p_completion_percent: params.completionPercent,
    p_receive_rate_percent: params.receiveRatePercent,
    p_avg_quality_stars: params.avgQualityStars,
    p_avg_speed_stars: params.avgSpeedStars,
  });
  if (error) throw error;
  return Number(data ?? 0);
}
