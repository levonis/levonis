import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserCardFrame } from "@/hooks/useUserCardFrame";
import { useLanguage } from "@/lib/i18n";

import ProfileHeader from "@/components/profile/ProfileHeader";
import OrdersCenter from "@/components/profile/OrdersCenter";
import QuickServicesGrid from "@/components/profile/QuickServicesGrid";
import CouponsStrip from "@/components/profile/CouponsStrip";
import PriceProtectionSection from "@/components/profile/PriceProtectionSection";
import NotificationPromptBanner from "@/components/profile/NotificationPromptBanner";

export default function Profile() {
  const { user } = useAuth();
  const { dir } = useLanguage();

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, phone_verified, phone_verification_status")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: cardFrame } = useUserCardFrame(user?.id);

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 pt-6 pb-24 max-w-lg space-y-4" dir={dir}>
        {user?.id && (
          <ProfileHeader
            userId={user.id}
            profile={profile ? { full_name: profile.full_name, username: profile.username, avatar_url: profile.avatar_url } : null}
            cardFrame={cardFrame ? { frame_url: cardFrame.frame_url, frame_animation: cardFrame.frame_animation, card_color: cardFrame.card_color } : null}
          />
        )}

        {user?.id && <NotificationPromptBanner />}

        {user?.id && <OrdersCenter userId={user.id} />}

        <QuickServicesGrid />

        {user?.id && <CouponsStrip userId={user.id} />}

        {user?.id && <PriceProtectionSection userId={user.id} />}
      </main>
    </div>
  );
}
