import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Store, Boxes, Users } from "lucide-react";

export default function CommunityExploreStrip({ className }: { className?: string }) {
  const navigate = useNavigate();

  return (
    <section className={className} aria-label="استكشاف المجتمع">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" />
              منتجات من التجار
            </CardTitle>
            <CardDescription>تصفّح منتجات وخدمات التجار</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => navigate("/community/merchants/products")}>
              فتح
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              طلبات لزبائن آخرين
            </CardTitle>
            <CardDescription>تصفّح طلبات الزبائن (عرض فقط كبداية)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => navigate("/community/requests")}
            >
              فتح
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Boxes className="h-4 w-4 text-primary" />
              صفحات التجار
            </CardTitle>
            <CardDescription>استعرض صفحات التجار وتفاصيلهم</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => navigate("/community/merchants")}
            >
              فتح
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
