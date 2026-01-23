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
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t-2 border-primary/20" />
        </div>
        <div className="relative flex justify-center">
          <Link
            to="/community"
            className="bg-background px-6 py-2 flex items-center gap-2 rounded-full border border-primary/30 shadow-sm hover:border-primary/50 transition-colors"
            aria-label="الانتقال إلى صفحة مجتمع ليفو"
          >
            <Users className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary">مجتمع ليفو</span>
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
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

        {/* Mobile: 2×2 buttons (chats + 3 actions). Desktop: inline */}
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <Suspense fallback={null}>
            <ListingConversations>
              <Button
                size="sm"
                variant="outline"
                className="h-10 w-full"
              >
                المحادثات
              </Button>
            </ListingConversations>
          </Suspense>

          {/* actions beside chats */}
          <CommunityCustomerActionsInline mode="items" />
        </div>
      </div>

      {/* subtle animated separator */}
      <AnimatedDivider className="mt-4 mb-2 opacity-90" />

      {/* Explore tabs (products/requests/merchant pages) */}
      <div className="mt-6">
        <CommunityExploreStrip />
      </div>
    </section>
  );
}
