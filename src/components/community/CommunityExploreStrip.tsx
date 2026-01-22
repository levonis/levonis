import { Boxes, Store, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CommunityExploreStrip({ className }: { className?: string }) {
  const navigate = useNavigate();

  return (
    <section className={className} aria-label="استكشاف المجتمع">
      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-card border border-border rounded-xl p-1">
          <TabsTrigger
            value="products"
            className="shrink-0"
            onClick={() => navigate("/community/merchants/all-products")}
          >
            <Store className="ml-2 h-4 w-4" />
            منتجات التجار
          </TabsTrigger>
          <TabsTrigger
            value="requests"
            className="shrink-0"
            onClick={() => navigate("/community/requests")}
          >
            <Users className="ml-2 h-4 w-4" />
            طلبات الزبائن
          </TabsTrigger>
          <TabsTrigger
            value="merchants"
            className="shrink-0"
            onClick={() => navigate("/community/merchants")}
          >
            <Boxes className="ml-2 h-4 w-4" />
            صفحات التجار
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-3">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">منتجات من التجار</CardTitle>
              <CardDescription>اضغط للانتقال إلى صفحة جميع منتجات التجار</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const items = [1, 2, 3, 4, 5, 6];
                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {items.map((i) => (
                  <div key={i} className="rounded-xl bg-muted/20 p-3">
                    <div className="aspect-square rounded-lg bg-background/40" />
                    <p className="mt-2 text-sm font-semibold">منتج #{i}</p>
                    <p className="mt-1 text-xs text-muted-foreground">تاجر • سعر • وقت</p>
                  </div>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      className="mt-4 w-full h-10"
                      onClick={() => navigate("/community/merchants/all-products")}
                    >
                      عرض جميع المنتجات
                    </Button>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="mt-3">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">طلبات لزبائن آخرين</CardTitle>
              <CardDescription>اضغط للانتقال إلى صفحة طلبات الزبائن</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const items = [1, 2, 3, 4, 5, 6];
                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {items.map((i) => (
                  <div key={i} className="rounded-xl bg-muted/20 p-3">
                    <div className="aspect-square rounded-lg bg-background/40" />
                    <p className="mt-2 text-sm font-semibold">طلب #{i}</p>
                    <p className="mt-1 text-xs text-muted-foreground">عنوان • فئة • حالة</p>
                  </div>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      className="mt-4 w-full h-10"
                      onClick={() => navigate("/community/requests")}
                    >
                      عرض جميع الطلبات
                    </Button>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="merchants" className="mt-3">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">صفحات التجار</CardTitle>
              <CardDescription>اضغط للانتقال إلى دليل التجار</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const items = [1, 2, 3, 4, 5, 6];
                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {items.map((i) => (
                  <div key={i} className="rounded-xl bg-muted/20 p-3">
                    <div className="aspect-square rounded-lg bg-background/40" />
                    <p className="mt-2 text-sm font-semibold">تاجر #{i}</p>
                    <p className="mt-1 text-xs text-muted-foreground">تقييم • مدينة • خدمات</p>
                  </div>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      className="mt-4 w-full h-10"
                      onClick={() => navigate("/community/merchants")}
                    >
                      عرض جميع التجار
                    </Button>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
