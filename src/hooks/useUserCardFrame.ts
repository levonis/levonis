import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserCardFrame {
  frame_url: string | null;
  frame_animation: string | null;
  card_name: string | null;
  card_color: string | null;
}

export function useUserCardFrame(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-card-frame", userId],
    queryFn: async (): Promise<UserCardFrame | null> => {
      if (!userId) return null;

      const { data, error } = await supabase
        .rpc("get_user_card_frame", { p_user_id: userId });

      if (error) throw error;
      
      // RPC returns array, get first item
      if (data && data.length > 0) {
        return data[0] as UserCardFrame;
      }
      
      return null;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

// Map animation type to tailwind class
export function getFrameAnimationClass(animationType: string | null | undefined): string {
  switch (animationType) {
    case "pulse":
      return "animate-avatar-frame-pulse";
    case "shimmer":
      return "animate-avatar-frame-shimmer";
    case "glow":
      return "animate-avatar-frame-glow-cyan";
    case "rainbow":
      return "animate-avatar-frame-rainbow";
    case "sparkle":
      return "animate-avatar-frame-sparkle";
    case "rotate":
      return "animate-avatar-frame-rotate";
    default:
      return "animate-avatar-frame-pulse";
  }
}
