import { Boxes, Store, Users, SlidersHorizontal, Film } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CommunityProductsHub from "@/components/community/hub/CommunityProductsHub";
import CommunityMerchantsHub from "@/components/community/hub/CommunityMerchantsHub";
import CommunityRequestsHub from "@/components/community/hub/CommunityRequestsHub";
import { useLanguage } from "@/lib/i18n";
import { TranslationKeys } from "@/lib/i18n/types";

interface CommunityExploreStripProps {
  className?: string;
  searchQuery?: string;
}

export default function CommunityExploreStrip({ className, searchQuery: externalSearchQuery }: CommunityExploreStripProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const isCommunityHub = location.pathname === "/community";
  const tabFromUrl = searchParams.get("tab") || undefined;
  const searchFromUrl = searchParams.get("q") || "";

  // Sort options using translation keys
  const PRODUCT_SORTS: { value: string; label: string }[] = [
    { value: "newest", label: t('explore_sort_newest') },
    { value: "best_selling", label: t('explore_sort_best_selling') },
    { value: "resin", label: t('explore_sort_resin') },
    { value: "filament", label: t('explore_sort_filament') },
    { value: "price_low", label: t('explore_sort_price_low') },
    { value: "price_high", label: t('explore_sort_price_high') },
    { value: "alpha_asc", label: t('explore_sort_alpha_asc') },
    { value: "alpha_desc", label: t('explore_sort_alpha_desc') },
  ];

  const REQUEST_SORTS_MERCHANT = [
    { value: "newest", label: t('explore_sort_newest') },
    { value: "not_priced", label: t('explore_sort_not_priced') },
    { value: "resin", label: t('explore_sort_resin') },
    { value: "filament", label: t('explore_sort_filament') },
    { value: "completed", label: t('explore_sort_completed') },
  ];

  const REQUEST_SORTS_CUSTOMER = [
    { value: "newest", label: t('explore_sort_newest') },
    { value: "resin", label: t('explore_sort_resin') },
    { value: "filament", label: t('explore_sort_filament') },
    { value: "completed", label: t('explore_sort_completed') },
  ];

  const MERCHANT_SORTS = [
    { value: "newest", label: t('explore_sort_newest') },
    { value: "filament_specialist", label: t('explore_sort_filament_specialist') },
    { value: "resin_specialist", label: t('explore_sort_resin_specialist') },
    { value: "verified", label: t('explore_sort_verified') },
  ];

  // Check if user is a merchant
  const { data: merchantApp } = useQuery({
    queryKey: ["merchant-status-strip", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("merchant_applications")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const isMerchant = !!merchantApp;

  const defaultTab = useMemo(() => {
    if (!isCommunityHub) return "products";
    if (tabFromUrl === "products" || tabFromUrl === "requests" || tabFromUrl === "merchants") {
      return tabFromUrl;
    }
    return "products";
  }, [isCommunityHub, tabFromUrl]);

  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [productSort, setProductSort] = useState("newest");
  const [requestSort, setRequestSort] = useState("newest");
  const [merchantSort, setMerchantSort] = useState("newest");

  const searchQuery = externalSearchQuery ?? searchFromUrl;

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const openHubTab = (tab: "products" | "requests" | "merchants") => {
    navigate(`/community?tab=${tab}`);
  };

  const requestSortOptions = isMerchant ? REQUEST_SORTS_MERCHANT : REQUEST_SORTS_CUSTOMER;

  return (
    <section className={className} aria-label={t('explore_community')}>
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          if (isCommunityHub && (v === "products" || v === "requests" || v === "merchants")) {
            navigate(`/community?tab=${v}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""}`, { replace: true });
          }
        }}
        className="w-full"
      >
        <div className="flex items-center gap-2">
          <TabsList className="levo-strip-frame grid flex-1 grid-cols-3 bg-transparent border-0 p-0.5 h-auto">
            <TabsTrigger
              value="products"
              className="levo-tab-frame shrink-0 data-[state=active]:text-primary text-[11px] h-8 gap-1"
            >
              <Store className="h-3.5 w-3.5" />
              {t('explore_merchant_products')}
            </TabsTrigger>
            <TabsTrigger
              value="requests"
              className="levo-tab-frame shrink-0 data-[state=active]:text-primary text-[11px] h-8 gap-1"
            >
              <Users className="h-3.5 w-3.5" />
              {t('explore_customer_requests')}
            </TabsTrigger>
            <TabsTrigger
              value="merchants"
              className="levo-tab-frame shrink-0 data-[state=active]:text-primary text-[11px] h-8 gap-1"
            >
              <Boxes className="h-3.5 w-3.5" />
              {t('explore_merchant_pages')}
            </TabsTrigger>
          </TabsList>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full h-8 w-8 shrink-0 border-primary/30 hover:border-primary hover:bg-primary/10"
            aria-label={t('explore_reels')}
            onClick={() => navigate("/community/reels")}
          >
            <Film className="h-3.5 w-3.5 text-primary" />
          </Button>
        </div>

        <TabsContent value="products" className="mt-3">
          <div className="levo-panel-frame p-3">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-bold text-foreground">{t('explore_from_merchants')}</h3>
              <Select value={productSort} onValueChange={setProductSort}>
                <SelectTrigger className="w-auto h-6 text-[10px] gap-1 px-2 rounded-lg">
                  <SlidersHorizontal className="h-3 w-3" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_SORTS.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-xs">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <CommunityProductsHub
              mode={isCommunityHub ? "hub" : "preview"}
              onOpenStore={(merchantId) => navigate(`/store/${merchantId}`)}
              searchQuery={searchQuery}
              sortBy={productSort}
            />

            {!isCommunityHub && (
              <Button
                variant="outline"
                className="mt-3 w-full h-8 text-xs"
                onClick={() => openHubTab("products")}
              >
                {t('explore_view_all_products')}
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="requests" className="mt-3">
          <div className="levo-panel-frame p-3">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-bold text-foreground">{t('explore_other_requests')}</h3>
              <Select value={requestSort} onValueChange={setRequestSort}>
                <SelectTrigger className="w-auto h-6 text-[10px] gap-1 px-2 rounded-lg">
                  <SlidersHorizontal className="h-3 w-3" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {requestSortOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-xs">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <CommunityRequestsHub
              mode={isCommunityHub ? "hub" : "preview"}
              searchQuery={searchQuery}
              sortBy={requestSort}
            />

            {!isCommunityHub && (
              <Button
                variant="outline"
                className="mt-3 w-full h-8 text-xs"
                onClick={() => openHubTab("requests")}
              >
                {t('explore_view_all_requests')}
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="merchants" className="mt-3">
          <div className="levo-panel-frame p-3">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-bold text-foreground">{t('explore_merchant_pages')}</h3>
              <Select value={merchantSort} onValueChange={setMerchantSort}>
                <SelectTrigger className="w-auto h-6 text-[10px] gap-1 px-2 rounded-lg">
                  <SlidersHorizontal className="h-3 w-3" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MERCHANT_SORTS.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-xs">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <CommunityMerchantsHub
              mode={isCommunityHub ? "hub" : "preview"}
              onOpenStore={(merchantId) => navigate(`/store/${merchantId}`)}
              searchQuery={searchQuery}
              sortBy={merchantSort}
            />

            {!isCommunityHub && (
              <Button
                variant="outline"
                className="mt-3 w-full h-8 text-xs"
                onClick={() => openHubTab("merchants")}
              >
                {t('explore_view_all_merchants')}
              </Button>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
