import { Boxes, Store, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import CommunityProductsHub from "@/components/community/hub/CommunityProductsHub";
import CommunityMerchantsHub from "@/components/community/hub/CommunityMerchantsHub";

export default function CommunityExploreStrip({ className }: { className?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const isCommunityHub = location.pathname === "/community";
  const tabFromUrl = searchParams.get("tab") || undefined;

  const defaultTab = useMemo(() => {
    if (!isCommunityHub) return "products";
    if (tabFromUrl === "products" || tabFromUrl === "requests" || tabFromUrl === "merchants") {
      return tabFromUrl;
    }
    return "products";
  }, [isCommunityHub, tabFromUrl]);

  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const openHubTab = (tab: "products" | "requests" | "merchants") => {
    navigate(`/community?tab=${tab}`);
  };

  return (
    <section className={className} aria-label="استكشاف المجتمع">
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          if (isCommunityHub && (v === "products" || v === "requests" || v === "merchants")) {
            navigate(`/community?tab=${v}`, { replace: true });
          }
        }}
        className="w-full"
      >
        {/* Tabs strip - refined with subtle background */}
        <TabsList className="grid w-full grid-cols-3 bg-gradient-to-b from-muted/40 to-muted/20 border border-border/60 rounded-2xl p-1.5 gap-1">
          <TabsTrigger
            value="products"
            className="shrink-0 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Store className="ml-2 h-4 w-4" />
            منتجات التجار
          </TabsTrigger>
          <TabsTrigger
            value="requests"
            className="shrink-0 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Users className="ml-2 h-4 w-4" />
            طلبات الزبائن
          </TabsTrigger>
          <TabsTrigger
            value="merchants"
            className="shrink-0 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Boxes className="ml-2 h-4 w-4" />
            صفحات التجار
          </TabsTrigger>
        </TabsList>

        {/* Content cards - refined with premium styling */}
        <TabsContent value="products" className="mt-4">
          <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-card/80 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border/30 bg-muted/10">
              <h3 className="text-base font-bold text-foreground">منتجات من التجار</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isCommunityHub
                  ? "تحميل تدريجي — 4 ثم 4 حتى 50، ثم يمكنك إظهار المزيد"
                  : "معاينة سريعة (اختيار عشوائي) — للمزيد استخدم زر العرض"}
              </p>
            </div>
            <div className="p-4 sm:p-5">
              <CommunityProductsHub
                mode={isCommunityHub ? "hub" : "preview"}
                onOpenStore={(merchantId) => navigate(`/store/${merchantId}`)}
              />

              {!isCommunityHub && (
                <Button
                  variant="outline"
                  className="mt-4 w-full h-10 rounded-xl border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                  onClick={() => openHubTab("products")}
                >
                  عرض جميع المنتجات
                </Button>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-card/80 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border/30 bg-muted/10">
              <h3 className="text-base font-bold text-foreground">طلبات لزبائن آخرين</h3>
              <p className="text-xs text-muted-foreground mt-0.5">استعرض آخر الطلبات، وللمزيد استخدم زر العرض بالأسفل</p>
            </div>
            <div className="p-4 sm:p-5">
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/5 p-4">
                <p className="text-sm text-muted-foreground">
                  سيتم تفعيل عرض الطلبات داخل /community بنفس مبدأ التحميل التدريجي (مثل المنتجات).
                </p>
              </div>

              {!isCommunityHub && (
                <Button
                  variant="outline"
                  className="mt-4 w-full h-10 rounded-xl border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                  onClick={() => openHubTab("requests")}
                >
                  عرض جميع الطلبات
                </Button>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="merchants" className="mt-4">
          <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-card/80 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border/30 bg-muted/10">
              <h3 className="text-base font-bold text-foreground">صفحات التجار</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isCommunityHub
                  ? "عرض أكبر — 25 تاجر (تحميل تدريجي) ثم يمكنك إظهار المزيد"
                  : "معاينة 10 متاجر (اختيار عشوائي)"}
              </p>
            </div>
            <div className="p-4 sm:p-5">
              <CommunityMerchantsHub
                mode={isCommunityHub ? "hub" : "preview"}
                onOpenStore={(merchantId) => navigate(`/store/${merchantId}`)}
              />

              {!isCommunityHub && (
                <Button
                  variant="outline"
                  className="mt-4 w-full h-10 rounded-xl border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                  onClick={() => openHubTab("merchants")}
                >
                  عرض جميع التجار
                </Button>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
