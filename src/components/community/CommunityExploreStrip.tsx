import { Boxes, Store, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CommunityExploreStrip({ className }: { className?: string }) {
  return (
    <section className={className} aria-label="استكشاف المجتمع">
      <Tabs defaultValue="products" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="products" className="shrink-0">
            <Store className="ml-2 h-4 w-4" />
            منتجات التجار
          </TabsTrigger>
          <TabsTrigger value="requests" className="shrink-0">
            <Users className="ml-2 h-4 w-4" />
            طلبات الزبائن
          </TabsTrigger>
          <TabsTrigger value="merchants" className="shrink-0">
            <Boxes className="ml-2 h-4 w-4" />
            صفحات التجار
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-3">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">منتجات من التجار</CardTitle>
              <CardDescription>هيكلة أولية — سيتم عرض بطاقات منتجات/خدمات هنا</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-sm font-semibold">بطاقة منتج #{i}</p>
                    <p className="mt-1 text-xs text-muted-foreground">اسم التاجر • السعر • وقت الإنجاز</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="mt-3">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">طلبات لزبائن آخرين</CardTitle>
              <CardDescription>هيكلة أولية — سيتم عرض قائمة الطلبات هنا</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-sm font-semibold">طلب #{i}</p>
                    <p className="mt-1 text-xs text-muted-foreground">عنوان • فئة • تاريخ • حالة</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="merchants" className="mt-3">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">صفحات التجار</CardTitle>
              <CardDescription>هيكلة أولية — سيتم عرض بطاقات التجار هنا</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-sm font-semibold">تاجر #{i}</p>
                    <p className="mt-1 text-xs text-muted-foreground">تقييم • مدينة • خدمات</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
