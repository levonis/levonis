import { Suspense, lazy } from 'react';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ListingConversations = lazy(() => import('@/components/marketplace/ListingConversations'));

export default function CommunitySection() {
  return (
    <section className="container mx-auto px-4 py-10">
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t-2 border-primary/20" />
        </div>
        <div className="relative flex justify-center">
          <div className="bg-background px-6 py-2 flex items-center gap-2 rounded-full border border-primary/30 shadow-sm">
            <Users className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary">مجتمع ليفو</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-primary">مجتمع ليفو</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">المحادثات والتواصل داخل المجتمع</p>
        </div>

        <div className="flex items-center gap-2">
          <Suspense fallback={null}>
            <ListingConversations>
              <Button size="sm">المحادثات</Button>
            </ListingConversations>
          </Suspense>
        </div>
      </div>
    </section>
  );
}
