import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const DEFAULT_AVATAR = "/placeholder.svg";

// Check if avatar is a valid user-uploaded image (not placeholder or default dicebear)
function isValidAvatar(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return false;
  if (url === DEFAULT_AVATAR) return false;
  // Dicebear avatars are auto-generated and not considered "complete"
  if (url.includes("dicebear.com") || url.includes("api.dicebear")) return false;
  return true;
}

/**
 * Hook to check if user has completed their community profile
 * Required fields: full_name, phone_number, username, birth_date, gender, avatar_url
 */
export function useCommunityProfileCheck() {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["community-profile-status", user?.id],
    queryFn: async () => {
      if (!user?.id) return { isComplete: false };
      
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("full_name, phone_number, username, birth_date, gender, avatar_url, created_at")
        .eq("id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      if (!profile) return { isComplete: false };
      
      // Check all required fields for community access
      const hasBasicFields = Boolean(
        profile.full_name?.trim() &&
        profile.phone_number?.trim() &&
        profile.username?.trim()
      );

      const hasExtendedFields = Boolean(
        profile.birth_date &&
        profile.gender?.trim()
      );

      const hasValidAvatar = isValidAvatar(profile.avatar_url);

      // Profile is complete when ALL fields are filled
      const isComplete = hasBasicFields && hasExtendedFields && hasValidAvatar;
      
      console.log("[CommunityProfileCheck]", {
        userId: user.id,
        hasBasicFields,
        hasExtendedFields,
        hasValidAvatar,
        isComplete,
        avatar_url: profile.avatar_url?.substring(0, 50),
      });
      
      return { 
        isComplete, 
        profile, 
        hasBasicFields, 
        hasExtendedFields,
        hasValidAvatar,
      };
    },
    enabled: !!user?.id && !authLoading,
    staleTime: 5_000, // Cache for 5 seconds to respond faster after profile updates
    refetchOnMount: true,
    gcTime: 10_000, // Garbage collect after 10 seconds
  });

  return {
    isProfileComplete: data?.isComplete ?? false,
    profile: data?.profile ?? null,
    isLoading: authLoading || isLoading,
    user,
    refetch,
  };
}
