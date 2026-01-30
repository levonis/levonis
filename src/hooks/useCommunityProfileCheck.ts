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
 * Required fields: full_name, phone_number, username
 * For NEW users joining community: also requires birth_date, gender, avatar_url
 * For existing users: we check if they have the minimum required fields
 */
export function useCommunityProfileCheck() {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading } = useQuery({
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
      
      // Check minimum required fields for ALL users
      const hasBasicFields = Boolean(
        profile.full_name?.trim() &&
        profile.phone_number?.trim() &&
        profile.username?.trim()
      );

      // For profile completion, we need all fields including avatar, birth_date, gender
      const hasAllFields = hasBasicFields && Boolean(
        profile.birth_date &&
        profile.gender?.trim() &&
        isValidAvatar(profile.avatar_url)
      );

      // Legacy users (created before community feature) might not have all fields
      // Check if user was created more than 30 days ago
      const createdAt = profile.created_at ? new Date(profile.created_at) : new Date();
      const isLegacyUser = (Date.now() - createdAt.getTime()) > 30 * 24 * 60 * 60 * 1000;

      // Legacy users only need basic fields, new users need all
      const isComplete = isLegacyUser ? hasBasicFields : hasAllFields;
      
      return { isComplete, profile, hasBasicFields, hasAllFields };
    },
    enabled: !!user?.id && !authLoading,
    staleTime: 5_000, // Cache for 5 seconds to respond faster after profile updates
    refetchOnMount: true,
  });

  return {
    isProfileComplete: data?.isComplete ?? false,
    profile: data?.profile ?? null,
    isLoading: authLoading || isLoading,
    user,
  };
}
