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
        <TabsList className="levo-strip-frame grid w-full grid-cols-3 bg-transparent border-0 p-1">
          <TabsTrigger
            value="products"
            className="levo-tab-frame shrink-0 data-[state=active]:text-primary"
          >
            <Store className="ml-2 h-4 w-4" />
            منتجات التجار
          </TabsTrigger>
          <TabsTrigger
            value="requests"
            className="levo-tab-frame shrink-0 data-[state=active]:text-primary"
          >
            <Users className="ml-2 h-4 w-4" />
            طلبات الزبائن
          </TabsTrigger>
          <TabsTrigger
            value="merchants"
            className="levo-tab-frame shrink-0 data-[state=active]:text-primary"
          >
            <Boxes className="ml-2 h-4 w-4" />
            صفحات التجار
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <div className="levo-panel-frame p-4">
            <div className="mb-4">
              <h3 className="text-base font-bold text-foreground">منتجات من التجار</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {isCommunityHub
                  ? "تحميل تدريجي — 4 ثم 4 حتى 50، ثم يمكنك إظهار المزيد"
                  : "معاينة سريعة (اختيار عشوائي) — للمزيد استخدم زر العرض"}
              </p>
            </div>
            
            <CommunityProductsHub
              mode={isCommunityHub ? "hub" : "preview"}
              onOpenStore={(merchantId) => navigate(`/store/${merchantId}`)}
            />

            {!isCommunityHub && (
              <Button
                variant="outline"
                className="mt-4 w-full h-10"
                onClick={() => openHubTab("products")}
              >
                عرض جميع المنتجات
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          <div className="levo-panel-frame p-4">
            <div className="mb-4">
              <h3 className="text-base font-bold text-foreground">طلبات لزبائن آخرين</h3>
              <p className="text-xs text-muted-foreground mt-1">استعرض آخر الطلبات، وللمزيد استخدم زر العرض بالأسفل</p>
            </div>
            
            <div className="levo-wall-frame">
              <p className="text-sm text-muted-foreground text-center py-4">
                سيتم تفعيل عرض الطلبات داخل /community بنفس مبدأ التحميل التدريجي (مثل المنتجات).
              </p>
            </div>

            {!isCommunityHub && (
              <Button
                variant="outline"
                className="mt-4 w-full h-10"
                onClick={() => openHubTab("requests")}
              >
                عرض جميع الطلبات
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="merchants" className="mt-4">
          <div className="levo-panel-frame p-4">
            <div className="mb-4">
              <h3 className="text-base font-bold text-foreground">صفحات التجار</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {isCommunityHub
                  ? "عرض أكبر — 25 تاجر (تحميل تدريجي) ثم يمكنك إظهار المزيد"
                  : "معاينة 10 متاجر (اختيار عشوائي)"}
              </p>
            </div>
            
            <CommunityMerchantsHub
              mode={isCommunityHub ? "hub" : "preview"}
              onOpenStore={(merchantId) => navigate(`/store/${merchantId}`)}
            />

            {!isCommunityHub && (
              <Button
                variant="outline"
                className="mt-4 w-full h-10"
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
