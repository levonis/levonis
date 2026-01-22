import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Footer from '@/components/Footer';

export default function Community() {
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
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-primary">مجتمع ليفو</h1>
              <p className="text-sm text-muted-foreground">محادثات المجتمع والدعم في مكان واحد</p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-bold text-foreground mb-2">مجتمع ليفو</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            المحادثات والتواصل داخل المجتمع
          </p>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {loading ? (
              <>
                <div className="h-11 rounded-xl bg-muted animate-pulse" />
                <div className="h-11 rounded-xl bg-muted animate-pulse" />
              </>
            ) : (
              <>
                <Button
                  onClick={() => navigate('/community/home')}
                  className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                >
                  الدخول
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/community/messages')}
                  className="w-full"
                >
                  المحادثات
                </Button>
              </>
            )}
          </div>
        </section>

        {/* Simple placeholders for future sections */}
        <section className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4">
              <div className="h-4 w-28 bg-muted rounded animate-pulse" />
              <div className="mt-3 h-20 w-full bg-muted rounded-xl animate-pulse" />
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
