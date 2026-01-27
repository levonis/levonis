import { Boxes, Store, Users, SlidersHorizontal } from "lucide-react";
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

// Sort options for each tab
const PRODUCT_SORTS = [
  { value: "newest", label: "الأحدث" },
  { value: "best_selling", label: "الأفضل مبيعاً" },
  { value: "resin", label: "رزن" },
  { value: "filament", label: "فلمنت" },
  { value: "price_low", label: "أقل سعر" },
  { value: "price_high", label: "أعلى سعر" },
  { value: "alpha_asc", label: "أ - ي" },
  { value: "alpha_desc", label: "ي - أ" },
];

const REQUEST_SORTS_MERCHANT = [
  { value: "newest", label: "الأحدث" },
  { value: "not_priced", label: "لم يتم تسعيره" },
  { value: "resin", label: "رزن" },
  { value: "filament", label: "فلمنت" },
];

const REQUEST_SORTS_CUSTOMER = [
  { value: "newest", label: "الأحدث" },
  { value: "resin", label: "رزن" },
  { value: "filament", label: "فلمنت" },
];

const MERCHANT_SORTS = [
  { value: "newest", label: "الأحدث" },
  { value: "filament_specialist", label: "متخصص فلمنت" },
  { value: "resin_specialist", label: "متخصص رزن" },
  { value: "verified", label: "الموثوق" },
];

interface CommunityExploreStripProps {
  className?: string;
  searchQuery?: string;
}

export default function CommunityExploreStrip({ className, searchQuery: externalSearchQuery }: CommunityExploreStripProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const isCommunityHub = location.pathname === "/community";
  const tabFromUrl = searchParams.get("tab") || undefined;
  const searchFromUrl = searchParams.get("q") || "";

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

  // Use external search query if provided, otherwise use URL
  const searchQuery = externalSearchQuery ?? searchFromUrl;

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const openHubTab = (tab: "products" | "requests" | "merchants") => {
    navigate(`/community?tab=${tab}`);
  };

  const requestSortOptions = isMerchant ? REQUEST_SORTS_MERCHANT : REQUEST_SORTS_CUSTOMER;

  return (
    <section className={className} aria-label="استكشاف المجتمع">
      {/* Search bar is in CommunitySection header, not here */}

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
        <TabsList className="levo-strip-frame grid w-full grid-cols-3 bg-transparent border-0 p-0.5 h-auto">
          <TabsTrigger
            value="products"
            className="levo-tab-frame shrink-0 data-[state=active]:text-primary text-[11px] h-8 gap-1"
          >
            <Store className="h-3.5 w-3.5" />
            منتجات التجار
          </TabsTrigger>
          <TabsTrigger
            value="requests"
            className="levo-tab-frame shrink-0 data-[state=active]:text-primary text-[11px] h-8 gap-1"
          >
            <Users className="h-3.5 w-3.5" />
            طلبات العملاء
          </TabsTrigger>
          <TabsTrigger
            value="merchants"
            className="levo-tab-frame shrink-0 data-[state=active]:text-primary text-[11px] h-8 gap-1"
          >
            <Boxes className="h-3.5 w-3.5" />
            صفحات التجار
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-3">
          <div className="levo-panel-frame p-3">
            {/* Header with Sort */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-bold text-foreground">منتجات من التجار</h3>
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
                عرض جميع المنتجات
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="requests" className="mt-3">
          <div className="levo-panel-frame p-3">
            {/* Header with Sort */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-bold text-foreground">طلبات لزبائن آخرين</h3>
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
            
            <div className="levo-wall-frame">
              <p className="text-[11px] text-muted-foreground text-center py-3">
                سيتم تفعيل عرض الطلبات قريباً
              </p>
            </div>

            {!isCommunityHub && (
              <Button
                variant="outline"
                className="mt-3 w-full h-8 text-xs"
                onClick={() => openHubTab("requests")}
              >
                عرض جميع الطلبات
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="merchants" className="mt-3">
          <div className="levo-panel-frame p-3">
            {/* Header with Sort */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-bold text-foreground">صفحات التجار</h3>
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
                عرض جميع التجار
              </Button>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
