import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Store, Boxes, Users } from "lucide-react";

export default function CommunityExploreStrip({ className }: { className?: string }) {
  return (
    <section className={className} aria-label="استكشاف المجتمع">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" />
              منتجات من التجار
            </CardTitle>
            <CardDescription>Placeholder — سيتم تفعيلها لاحقاً</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>
              فتح (قريباً)
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              طلبات لزبائن آخرين
            </CardTitle>
            <CardDescription>Placeholder — سيتم تفعيلها لاحقاً</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>
              فتح (قريباً)
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Boxes className="h-4 w-4 text-primary" />
              صفحات التجار
            </CardTitle>
            <CardDescription>Placeholder — سيتم تفعيلها لاحقاً</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>
              فتح (قريباً)
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
