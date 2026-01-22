import { useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import Footer from '@/components/Footer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function CommunityHome() {
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'products' | 'requests' | 'merchants'>('all');

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 300);
    return () => window.clearTimeout(t);
  }, []);

  const placeholderHint = useMemo(() => {
    switch (scope) {
      case 'products':
        return 'ابحث داخل منتجات التجار…';
      case 'requests':
        return 'ابحث داخل طلبات الزبائن…';
      case 'merchants':
        return 'ابحث داخل صفحات التجار…';
      default:
        return 'ابحث داخل المجتمع…';
    }
  }, [scope]);

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 pt-24 max-w-6xl">
        <header className="mb-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-primary">مجتمع ليفو</h1>
            <p className="text-sm text-muted-foreground">الصفحة الرئيسية للمجتمع (قيد التطوير)</p>
          </div>
        </header>

        {/* Sticky search + filter bar */}
        <div className="sticky top-20 z-20 -mx-4 px-4 pb-3">
          <div className="rounded-2xl border border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/70 p-3">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_190px_110px] gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholderHint}
                className="h-10"
              />

              <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="الفلترة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="products">منتجات</SelectItem>
                  <SelectItem value="requests">طلبات</SelectItem>
                  <SelectItem value="merchants">تجار</SelectItem>
                </SelectContent>
              </Select>

              <Button className="h-10">بحث</Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {query.trim()
                ? `بحث: “${query.trim()}” — الفلترة: ${scope === 'all' ? 'الكل' : scope}`
                : 'اكتب كلمة للبحث واختر فلترة (اختياري).'}
            </p>
          </div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4">
              {loading ? (
                <>
                  <div className="h-4 w-28 bg-muted rounded animate-pulse" />
                  <div className="mt-3 h-24 w-full bg-muted rounded-xl animate-pulse" />
                  <div className="mt-3 h-9 w-24 bg-muted rounded-xl animate-pulse" />
                </>
              ) : (
                <>
                  <h2 className="text-sm font-bold text-foreground">قسم قادم</h2>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    Placeholder لبطاقات/أقسام المجتمع المستقبلية.
                  </p>
                  <div className="mt-4 h-9 w-28 rounded-xl border border-border bg-muted/20" />
                </>
              )}
            </div>
          ))}
        </section>

        <div className="mt-10">
          <Footer />
        </div>
      </main>
    </div>
  );
}
