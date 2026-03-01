import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Store } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/i18n";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CommunityMerchantDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  const { data: app, isLoading } = useQuery({
    queryKey: ["merchant-application", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_applications")
        .select("id, status, display_name")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const allowed = useMemo(() => app?.status === "approved", [app?.status]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background/95">
        <main className="container mx-auto px-4 py-8 max-w-5xl">
          <Skeleton className="h-12 w-64 rounded-xl" />
          <Skeleton className="mt-4 h-40 rounded-2xl" />
        </main>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-background/95">
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>{t('merchant_dashboard')}</CardTitle>
              <CardDescription>{t('merchant_dashboard_not_allowed')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button variant="outline" onClick={() => navigate("/community")}>{t('merchant_back_community')}</Button>
              <Button onClick={() => navigate("/community/customer/profile")}>{t('merchant_review_application')}</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Store className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-primary">{t('merchant_dashboard')}</h1>
              <p className="text-sm text-muted-foreground">{app?.display_name ?? ""}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/community")}>{t('merchant_back_community')}</Button>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">{t('merchant_my_offers')}</CardTitle>
              <CardDescription>{t('merchant_my_offers_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-24 rounded-xl border border-border bg-muted/20" />
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">{t('merchant_execution_tracking')}</CardTitle>
              <CardDescription>{t('merchant_execution_tracking_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-24 rounded-xl border border-border bg-muted/20" />
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">{t('merchant_product_management')}</CardTitle>
              <CardDescription>{t('merchant_product_management_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-24 rounded-xl border border-border bg-muted/20" />
            </CardContent>
          </Card>

          <Card className="border-border bg-card md:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">{t('merchant_store_settings')}</CardTitle>
              <CardDescription>{t('merchant_store_settings_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-24 rounded-xl border border-border bg-muted/20" />
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
