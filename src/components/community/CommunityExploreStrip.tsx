import { Boxes, Store, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        <TabsList className="grid w-full grid-cols-3 bg-card border border-border rounded-xl p-1">
          <TabsTrigger
            value="products"
            className="shrink-0"
          >
            <Store className="ml-2 h-4 w-4" />
            منتجات التجار
          </TabsTrigger>
          <TabsTrigger
            value="requests"
            className="shrink-0"
          >
            <Users className="ml-2 h-4 w-4" />
            طلبات الزبائن
          </TabsTrigger>
          <TabsTrigger
            value="merchants"
            className="shrink-0"
          >
            <Boxes className="ml-2 h-4 w-4" />
            صفحات التجار
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-3">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">منتجات من التجار</CardTitle>
              <CardDescription>
                {isCommunityHub
                  ? "تحميل تدريجي — 4 ثم 4 حتى 50، ثم يمكنك إظهار المزيد"
                  : "معاينة سريعة (اختيار عشوائي) — للمزيد استخدم زر العرض"}
              </CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="mt-3">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">طلبات لزبائن آخرين</CardTitle>
              <CardDescription>استعرض آخر الطلبات، وللمزيد استخدم زر العرض بالأسفل</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-border bg-muted/10 p-4">
                <p className="text-sm text-muted-foreground">
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="merchants" className="mt-3">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">صفحات التجار</CardTitle>
              <CardDescription>
                {isCommunityHub
                  ? "عرض أكبر — 25 تاجر (تحميل تدريجي) ثم يمكنك إظهار المزيد"
                  : "معاينة 10 متاجر (اختيار عشوائي)"}
              </CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
