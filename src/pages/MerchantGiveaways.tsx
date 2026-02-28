import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Crown, Trophy, Gift, Ticket, Mail, Sparkles } from "lucide-react";
import Footer from "@/components/Footer";
import AssistanceCompetitions from "@/components/assistance/AssistanceCompetitions";
import AssistanceGifts from "@/components/assistance/AssistanceGifts";
import AssistanceCoupons from "@/components/assistance/AssistanceCoupons";
import AssistanceEnvelopes from "@/components/assistance/AssistanceEnvelopes";

export default function MerchantGiveaways() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("competitions");

  const { data: merchantApp } = useQuery({
    queryKey: ["my-merchant-app", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("merchant_applications")
        .select("id, display_name, store_image_url, is_verified, status")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const isVerifiedMerchant = merchantApp?.is_verified === true;

  const tabs = [
    { key: "competitions", label: "مسابقات", icon: Trophy },
    { key: "gifts", label: "هدايا", icon: Gift },
    { key: "coupons", label: "كوبونات", icon: Ticket },
    { key: "envelopes", label: "ظروف حمراء", icon: Mail },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent p-[2px] shadow-lg shadow-primary/20">
              <div className="w-full h-full rounded-[10px] bg-card flex items-center justify-center">
                <Crown className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div>
              <h1 className="text-sm font-black text-foreground tracking-tight">المساعدات</h1>
              <p className="text-[10px] text-muted-foreground">مقدمة من مجتمع ليفو</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl hover:bg-accent" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <main className="flex-1 px-4 py-5 space-y-5">
        {/* Hero */}
        <div className="relative rounded-2xl overflow-hidden border border-primary/20 bg-card">
          <div className="absolute inset-0 bg-gradient-to-bl from-primary/10 via-transparent to-accent/5" />
          <div className="relative px-5 py-6 flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1">
                <Sparkles className="h-3 w-3" />
                حصرياً للتجار الموثقين
              </div>
              <h2 className="text-lg font-black text-foreground leading-tight">مسابقات وهدايا وكوبونات</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">استكشف المساعدات المتاحة واحصل على مزايا حصرية</p>
            </div>
            <div className="relative w-16 h-16 shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 blur-xl" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-xl">
                <Gift className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-auto p-1 bg-muted/50 rounded-xl grid grid-cols-4">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="flex flex-col items-center gap-1 py-2 px-1 text-[10px] font-bold rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="competitions" className="mt-4">
            <AssistanceCompetitions />
          </TabsContent>
          <TabsContent value="gifts" className="mt-4">
            <AssistanceGifts />
          </TabsContent>
          <TabsContent value="coupons" className="mt-4">
            <AssistanceCoupons />
          </TabsContent>
          <TabsContent value="envelopes" className="mt-4">
            <AssistanceEnvelopes />
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
}
