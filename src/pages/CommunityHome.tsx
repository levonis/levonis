import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Footer from "@/components/Footer";
import CommunitySection from "@/components/community/CommunitySection";
import CommunityGiftsButton from "@/components/community/CommunityGiftsButton";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen } from "lucide-react";
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
        <button
          onClick={() => setGuideOpen(true)}
          className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md p-3 rounded-2xl border border-primary/30 bg-primary/10 backdrop-blur-xl flex items-center gap-3 text-right shadow-lg hover:border-primary/50 hover:bg-primary/15 transition-all active:scale-[0.98]"
        >
          <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">📖 دليل التاجر</p>
            <p className="text-[10px] text-muted-foreground">تعرّف على جميع مميزات متجرك وكيفية استخدامها</p>
          </div>
          <span className="text-lg">→</span>
        </button>
      )}

      <MerchantGuide
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onDismissForever={dismissGuideForever}
      />
    </div>
  );
}
