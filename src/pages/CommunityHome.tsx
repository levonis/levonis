import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import Footer from '@/components/Footer';

export default function CommunityHome() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 300);
    return () => window.clearTimeout(t);
  }, []);

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
