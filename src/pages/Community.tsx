import { useEffect, useState } from 'react';
import { MessageSquare, Store, User, Users } from 'lucide-react';
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
              <p className="text-sm text-muted-foreground">المحادثات والتواصل داخل المجتمع</p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-bold text-foreground mb-1">اختر طريقة الدخول</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            اختر إذا كنت زبون أو بائع داخل المجتمع، أو ادخل مباشرة إلى المحادثات.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            {loading ? (
              <>
                <div className="h-24 rounded-2xl bg-muted animate-pulse" />
                <div className="h-24 rounded-2xl bg-muted animate-pulse" />
                <div className="h-24 rounded-2xl bg-muted animate-pulse" />
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/community/customer')}
                  className="text-right rounded-2xl border border-border bg-background/40 hover:bg-background/60 transition-colors p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="text-base font-black text-foreground">زبون</div>
                      <div className="text-xs text-muted-foreground mt-1">طلب طباعة + متابعة + محادثة</div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/community/home')}
                  className="text-right rounded-2xl border border-border bg-background/40 hover:bg-background/60 transition-colors p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Store className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="text-base font-black text-foreground">بائع</div>
                      <div className="text-xs text-muted-foreground mt-1">قريباً — لوحة البائع قيد التطوير</div>
                    </div>
                  </div>
                </button>

                <Button
                  variant="outline"
                  onClick={() => navigate('/community/messages')}
                  className="h-auto py-4 rounded-2xl justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black">المحادثات</div>
                      <div className="text-xs text-muted-foreground mt-1">افتح واجهة المحادثات الحالية</div>
                    </div>
                  </div>
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
