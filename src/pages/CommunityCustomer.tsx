import { useEffect, useState } from 'react';
import { ArrowRight, PlusCircle, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CommunityCustomer() {
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
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-primary">لوحة الزبون</h1>
              <p className="text-sm text-muted-foreground">واجهة مبدئية قابلة للتطوير لاحقاً</p>
            </div>
          </div>

          <Button variant="outline" onClick={() => navigate('/community')} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">إضافة طلب جديد</CardTitle>
              <CardDescription>ابدأ طلب طباعة جديد (واجهة فقط الآن)</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-11 rounded-xl bg-muted animate-pulse" />
              ) : (
                <Button
                  onClick={() => navigate('/community/customer/new')}
                  className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                >
                  <PlusCircle className="ml-2 h-4 w-4" />
                  إضافة طلب جديد
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">طلباتي</CardTitle>
              <CardDescription>سيتم تفعيلها لاحقاً</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-11 rounded-xl bg-muted/40" />
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">تتبع الطلب</CardTitle>
              <CardDescription>سيتم ربطها لاحقاً</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-11 rounded-xl bg-muted/40" />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
