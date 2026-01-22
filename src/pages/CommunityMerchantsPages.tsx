import { ArrowRight, Boxes } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CommunityMerchantsPages() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 pt-24 max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Boxes className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-primary">صفحات التجار</h1>
              <p className="text-sm text-muted-foreground">هيكلة أولية — بطاقات تجار وروابط لصفحاتهم لاحقاً</p>
            </div>
          </div>

          <Button variant="outline" onClick={() => navigate("/community/customer")} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">تاجر #{i}</CardTitle>
                <CardDescription>تقييم • مدينة • عدد الطلبات</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-24 rounded-xl border border-border bg-muted/20" />
                <Button variant="outline" className="mt-3 w-full" disabled>
                  فتح الصفحة (قريباً)
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
