import { Users } from 'lucide-react';
import Footer from '@/components/Footer';
import CommunitySection from '@/components/community/CommunitySection';

export default function CommunityHome() {
  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 pt-24 max-w-6xl">
        <header className="mb-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-primary">مجتمع ليفو</h1>
            <p className="text-sm text-muted-foreground">نفس وظائف المجتمع الموجودة في الصفحة الرئيسية</p>
          </div>
        </header>

        <CommunitySection />

        <div className="mt-10">
          <Footer />
        </div>
      </main>
    </div>
  );
}
