import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hook to check if user has completed their community profile
 * Required fields: full_name, phone_number, username, birth_date, gender
 */
export function useCommunityProfileCheck() {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["community-profile-status", user?.id],
    queryFn: async () => {
      if (!user?.id) return { isComplete: false };
      
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("full_name, phone_number, username, birth_date, gender, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      if (!profile) return { isComplete: false };
      
      // Check all required fields are filled (including avatar)
      const isComplete = Boolean(
        profile.full_name?.trim() &&
        profile.phone_number?.trim() &&
        profile.username?.trim() &&
        profile.birth_date &&
        profile.gender?.trim() &&
        profile.avatar_url?.trim() &&
        profile.avatar_url !== '/placeholder.svg'
      );
      
      return { isComplete, profile };
    },
    enabled: !!user?.id && !authLoading,
    staleTime: 30_000, // Cache for 30 seconds
  });

  return {
    isProfileComplete: data?.isComplete ?? false,
    profile: data?.profile ?? null,
    isLoading: authLoading || isLoading,
    user,
  };
}
