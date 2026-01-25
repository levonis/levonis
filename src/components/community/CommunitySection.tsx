import { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CommunityCustomerActionsInline } from '@/components/community/CommunityCustomerStrip';
import CommunityExploreStrip from '@/components/community/CommunityExploreStrip';
import AnimatedDivider from '@/components/ui/animated-divider';

const ListingConversations = lazy(() => import('@/components/marketplace/ListingConversations'));

export default function CommunitySection() {
  return (
    <section className="container mx-auto px-4 py-10">
      {/* Section header pill - refined with subtle glow */}
      <div className="relative mb-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-primary/15" />
        </div>
        <div className="relative flex justify-center">
          <Link
            to="/community"
            className="bg-gradient-to-b from-background to-muted/30 px-5 py-2 flex items-center gap-2.5 rounded-full border border-primary/20 shadow-sm hover:border-primary/40 hover:shadow-md transition-all duration-200"
            aria-label="الانتقال إلى صفحة مجتمع ليفو"
          >
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary">مجتمع ليفو</span>
          </Link>
        </div>
      </div>

      {/* Title + actions strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <Link to="/community" className="inline-block">
            <h2 className="text-xl sm:text-2xl font-black text-primary hover:opacity-90 transition-opacity">
              مجتمع ليفو
            </h2>
          </Link>
          <Link to="/community" className="inline-block">
            <p className="text-xs sm:text-sm text-muted-foreground hover:text-foreground/70 transition-colors">
              المحادثات والتواصل داخل المجتمع
            </p>
          </Link>
        </div>

        {/* Actions grid - refined spacing */}
        <div className="grid w-full grid-cols-2 gap-2.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-2">
          <Suspense fallback={null}>
            <ListingConversations>
              <Button
                size="sm"
                variant="outline"
                className="h-10 w-full rounded-xl border-primary/20 hover:border-primary/40 hover:bg-primary/5"
              >
                المحادثات
              </Button>
            </ListingConversations>
          </Suspense>

          <CommunityCustomerActionsInline mode="items" />
        </div>
      </div>

      <AnimatedDivider className="mt-6 mb-4 opacity-80" />

      {/* Explore tabs */}
      <div className="mt-6">
        <CommunityExploreStrip />
      </div>
    </section>
  );
}
