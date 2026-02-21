import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Footer from "@/components/Footer";
import CommunitySection from "@/components/community/CommunitySection";
import CommunityGiftsButton from "@/components/community/CommunityGiftsButton";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import MerchantGuide from "@/components/merchant/MerchantGuide";

export default function CommunityHome() {
  const { user } = useAuth();
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideDismissed, setGuideDismissed] = useState(() => {
    return localStorage.getItem("merchant_guide_dismissed") === "true";
  });

  const { data: isMerchant } = useQuery({
    queryKey: ["is-merchant-community", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from("merchant_applications")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id,
  });

  const dismissGuideForever = () => {
    localStorage.setItem("merchant_guide_dismissed", "true");
    setGuideDismissed(true);
    setGuideOpen(false);
  };

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-6 pt-20 max-w-6xl">
        <CommunitySection noFrame />

        <div className="mt-10">
          <Footer />
        </div>
      </main>
      <CommunityGiftsButton />

      {/* Merchant Guide FAB */}
      {isMerchant && !guideDismissed && (
        <Button
          onClick={() => setGuideOpen(true)}
          size="icon"
          variant="outline"
          className="fixed bottom-6 left-[9rem] sm:left-[9.5rem] h-11 w-11 rounded-full shadow-lg z-50 bg-primary/10 hover:bg-primary/20 border-primary/30 hover:border-primary/50 transition-all"
        >
          <BookOpen className="h-5 w-5 text-primary" />
        </Button>
      )}

      <MerchantGuide
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onDismissForever={dismissGuideForever}
      />
    </div>
  );
}
