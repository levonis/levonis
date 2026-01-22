import { useEffect, useState } from 'react';
import { ArrowRight, FileText, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CommunityCustomerRequests() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 250);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 pt-24 max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-primary">طلباتي</h1>
              <p className="text-sm text-muted-foreground">واجهة مبدئية — سيتم ربطها لاحقاً</p>
            </div>
          </div>

          <Button variant="outline" onClick={() => navigate('/community/customer')} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
        </header>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              طلباتي
            </CardTitle>
            <CardDescription>سيظهر هنا سجل الطلبات مع إمكانية التعديل لاحقاً</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <div className="h-16 rounded-xl bg-muted animate-pulse" />
                <div className="h-16 rounded-xl bg-muted animate-pulse" />
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-background/40 p-4">
                <p className="text-sm text-muted-foreground">
                  عند التفعيل: كل طلب تقدر تعدله، وسيظهر تنبيه: "سيتم مراجعة طلبك من قبل الإدارة".
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
