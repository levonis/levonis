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
 * Required fields: full_name, phone_number, username, birth_date, gender, avatar_url, email_verified
 */
export function useCommunityProfileCheck() {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["community-profile-status", user?.id],
    queryFn: async () => {
      if (!user?.id) return { isComplete: false, isEmailVerified: false, isMerchantApproved: false };
      
      // Check profile fields, community profile, AND merchant status
      const [profileRes, communityRes, merchantRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, phone_number, username, birth_date, gender, avatar_url, email_verified, created_at")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("community_customer_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("merchant_applications")
          .select("id, status")
          .eq("user_id", user.id)
          .eq("status", "approved")
          .maybeSingle(),
      ]);
      
      if (profileRes.error) throw profileRes.error;
      const profile = profileRes.data;
      if (!profile) return { isComplete: false, isEmailVerified: false, isMerchantApproved: false };
      
      const hasCommunityProfile = !!communityRes.data;
      const isMerchantApproved = !!merchantRes.data;
      
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
      
      const isEmailVerified = profile.email_verified === true;

      // Profile is complete when ALL fields are filled AND email is verified AND (community profile exists OR merchant is approved)
      const isComplete = hasBasicFields && hasExtendedFields && hasValidAvatar && isEmailVerified && (hasCommunityProfile || isMerchantApproved);
      
      console.log("[CommunityProfileCheck]", {
        userId: user.id,
        hasBasicFields,
        hasExtendedFields,
        hasValidAvatar,
        isEmailVerified,
        hasCommunityProfile,
        isMerchantApproved,
        isComplete,
      });
      
      return { 
        isComplete, 
        profile, 
        hasBasicFields, 
        hasExtendedFields,
        hasValidAvatar,
        isEmailVerified,
        hasCommunityProfile,
        isMerchantApproved,
      };
    },
    enabled: !!user?.id && !authLoading,
    staleTime: 5_000,
    refetchOnMount: true,
    gcTime: 10_000,
  });

  return {
    isProfileComplete: data?.isComplete ?? false,
    isEmailVerified: data?.isEmailVerified ?? false,
    isMerchantApproved: data?.isMerchantApproved ?? false,
    profile: data?.profile ?? null,
    isLoading: authLoading || isLoading,
    user,
    refetch,
  };
}
