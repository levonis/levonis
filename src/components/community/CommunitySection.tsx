import { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CommunityCustomerActionsInline } from '@/components/community/CommunityCustomerStrip';
import CommunityExploreStrip from '@/components/community/CommunityExploreStrip';
import AnimatedDivider from '@/components/ui/animated-divider';

const ListingConversations = lazy(() => import('@/components/marketplace/ListingConversations'));

interface CommunitySectionProps {
  noFrame?: boolean;
}

export default function CommunitySection({ noFrame = false }: CommunitySectionProps) {
  const sectionClass = noFrame 
    ? "container mx-auto px-0" 
    : "levo-section-frame container mx-auto px-0";

  return (
    <section className={sectionClass}>
      {/* Header badge */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-primary/15" />
        </div>
        <div className="relative flex justify-center">
          <Link
            to="/community"
            className="levo-badge-frame"
            aria-label="الانتقال إلى صفحة مجتمع ليفو"
          >
            <div className="levo-icon-frame h-8 w-8">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-bold text-primary">مجتمع ليفو</span>
          </Link>
        </div>
      </div>

      {/* Title and actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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

        {/* Action buttons */}
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <Suspense fallback={null}>
            <ListingConversations>
              <Button
                size="sm"
                variant="outline"
                className="h-10 w-full levo-action-frame border-0"
              >
                المحادثات
              </Button>
            </ListingConversations>
          </Suspense>

          <CommunityCustomerActionsInline mode="items" />
        </div>
      </div>

      {/* Divider */}
      <AnimatedDivider className="mt-5 mb-3 opacity-80" />

      {/* Explore tabs */}
      <div className="mt-6">
        <CommunityExploreStrip />
      </div>
    </section>
  );
}
