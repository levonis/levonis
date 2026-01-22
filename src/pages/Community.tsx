import { Suspense, lazy } from 'react';
import { Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Footer from '@/components/Footer';

const ListingConversations = lazy(() => import('@/components/marketplace/ListingConversations'));

export default function Community() {
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

          <Suspense fallback={null}>
            <ListingConversations>
              <Button variant="outline" className="gap-2">
                افتح المحادثات
              </Button>
            </ListingConversations>
          </Suspense>
        </header>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-bold text-foreground mb-2">ملاحظة</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            تم إزالة نظام سوق المستعمل (المنتجات/الملفات) بالكامل، وتم الإبقاء على واجهة الرسائل.
          </p>
        </section>

        <div className="mt-10">
          <Footer />
        </div>
      </main>
    </div>
  );
}
