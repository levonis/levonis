import { useEffect, useState } from 'react';
import { MessageSquare, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Footer from '@/components/Footer';
import CommunityCustomerStrip from '@/components/community/CommunityCustomerStrip';
import CommunityExploreStrip from '@/components/community/CommunityExploreStrip';

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
              <button
                type="button"
                onClick={() => navigate('/community/customer')}
                className="text-right"
                aria-label="الدخول إلى مجتمع ليفو"
              >
                <h1 className="text-2xl sm:text-3xl font-black text-primary hover:opacity-90 transition-opacity">
                  مجتمع ليفو
                </h1>
              </button>
              <p className="text-sm text-muted-foreground">المحادثات والتواصل داخل المجتمع</p>
            </div>
          </div>
        </header>

        {/* الشريط الأول (لوحة الزبون) */}
        <CommunityCustomerStrip className="mt-4" />

        <div className="my-6 h-px bg-border" />

        {/* الشريط الثاني (Placeholder للاستكشاف) */}
        {loading ? (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />
            ))}
          </section>
        ) : (
          <CommunityExploreStrip />
        )}

        <div className="mt-6">
          <Button variant="outline" onClick={() => navigate('/community/messages')} className="w-full gap-2">
            <MessageSquare className="h-4 w-4" />
            فتح المحادثات
          </Button>
        </div>

        <div className="mt-10">
          <Footer />
        </div>
      </main>
    </div>
  );
}

