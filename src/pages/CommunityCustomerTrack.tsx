import { ArrowRight, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CommunityCustomerTrack() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-primary">تتبع الطلب</h1>
              <p className="text-sm text-muted-foreground">هيكلة أولية — سيتم ربطها بالطلبات لاحقاً</p>
            </div>
          </div>

          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
        </header>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>معلومات التتبع</CardTitle>
            <CardDescription>سيتم إضافة رقم الطلب، الحالة، وخط زمني للإنجاز</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">رقم الطلب</p>
                <p className="mt-1 font-semibold">—</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">الحالة</p>
                <p className="mt-1 font-semibold">—</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">آخر تحديث</p>
                <p className="mt-1 font-semibold">—</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
