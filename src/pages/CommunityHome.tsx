import { useState, useMemo, useCallback } from "react";
import { Search, Store, Users, Boxes, X } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CommunityProductsHub from "@/components/community/hub/CommunityProductsHub";
import CommunityMerchantsHub from "@/components/community/hub/CommunityMerchantsHub";
import CommunityRequestsHub from "@/components/community/hub/CommunityRequestsHub";
import {
  CommunitySortSelect,
  ProductSortKey,
  RequestSortKey,
  MerchantSortKey,
} from "@/components/community/hub/CommunitySortSelect";

export default function CommunityHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const tab = searchParams.get("tab") || "products";

  // Sorting state
  const [productSort, setProductSort] = useState<ProductSortKey>("newest");
  const [requestSort, setRequestSort] = useState<RequestSortKey>("newest");
  const [merchantSort, setMerchantSort] = useState<MerchantSortKey>("newest");

  // Check if user is a merchant
  const { data: merchantApp } = useQuery({
    queryKey: ["my-merchant-app", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("merchant_applications")
        .select("id, status")
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .maybeSingle();
      return data;
    },
  });

  const isMerchant = useMemo(() => !!merchantApp, [merchantApp]);

  const setQ = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value.trim()) next.set("q", value);
      else next.delete("q");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const setTab = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams);
      next.set("tab", value);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const clearSearch = useCallback(() => setQ(""), [setQ]);

  const placeholderText = useMemo(() => {
    switch (tab) {
      case "merchants":
        return "ابحث عن تاجر...";
      case "requests":
        return "ابحث عن طلب...";
      default:
        return "ابحث عن منتج...";
    }
  }, [tab]);

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-3 py-4 pt-20 max-w-5xl">
        {/* Compact Search Bar */}
        <div className="mb-3">
          <div className="relative">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholderText}
              className="h-8 text-xs pr-8 pl-8 rounded-lg border-border/60 bg-card/80 backdrop-blur-sm"
            />
            {q && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={clearSearch}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Tabs with Sort Controls */}
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <div className="flex items-center gap-2 mb-3">
            <TabsList className="flex-1 grid grid-cols-3 h-8 bg-card/60 backdrop-blur-sm rounded-lg p-0.5">
              <TabsTrigger
                value="products"
                className="h-7 text-[11px] font-semibold rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1"
              >
                <Store className="h-3 w-3" />
                <span className="hidden xs:inline">منتجات</span>
              </TabsTrigger>
              <TabsTrigger
                value="requests"
                className="h-7 text-[11px] font-semibold rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1"
              >
                <Users className="h-3 w-3" />
                <span className="hidden xs:inline">طلبات</span>
              </TabsTrigger>
              <TabsTrigger
                value="merchants"
                className="h-7 text-[11px] font-semibold rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1"
              >
                <Boxes className="h-3 w-3" />
                <span className="hidden xs:inline">تجار</span>
              </TabsTrigger>
            </TabsList>

            {/* Sort selector based on active tab */}
            {tab === "products" && (
              <CommunitySortSelect
                type="products"
                value={productSort}
                onChange={setProductSort}
              />
            )}
            {tab === "requests" && (
              <CommunitySortSelect
                type="requests"
                value={requestSort}
                onChange={setRequestSort}
                isMerchant={isMerchant}
              />
            )}
            {tab === "merchants" && (
              <CommunitySortSelect
                type="merchants"
                value={merchantSort}
                onChange={setMerchantSort}
              />
            )}
          </div>

          <TabsContent value="products" className="mt-0">
            <CommunityProductsHub
              mode="hub"
              onOpenStore={(merchantId) => navigate(`/store/${merchantId}`)}
              searchQuery={q}
              sortKey={productSort}
            />
          </TabsContent>

          <TabsContent value="requests" className="mt-0">
            <CommunityRequestsHub
              mode="hub"
              searchQuery={q}
              sortKey={requestSort}
              isMerchant={isMerchant}
            />
          </TabsContent>

          <TabsContent value="merchants" className="mt-0">
            <CommunityMerchantsHub
              mode="hub"
              onOpenStore={(merchantId) => navigate(`/store/${merchantId}`)}
              searchQuery={q}
              sortKey={merchantSort}
            />
          </TabsContent>
        </Tabs>

        <div className="mt-8">
          <Footer />
        </div>
      </main>
    </div>
  );
}
