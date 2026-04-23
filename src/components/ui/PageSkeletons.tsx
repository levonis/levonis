import { Skeleton } from "@/components/ui/skeleton";

/* -------------------------------------------------------------------------- */
/*  Glassmorphism Skeleton system                                             */
/*  Every wrapper uses a frosted glass shell that matches the real cards in   */
/*  the app (see mem://ui/styling/product-card-glassmorphism). Sizes mirror   */
/*  the rendered content so swapping in real data causes zero layout shift.   */
/* -------------------------------------------------------------------------- */

const glassCard =
  "rounded-2xl border border-foreground/10 bg-foreground/[0.04] backdrop-blur-xl shadow-[0_8px_24px_-12px_hsl(var(--background)/0.5)]";
const glassCardSm =
  "rounded-xl border border-foreground/10 bg-foreground/[0.04] backdrop-blur-xl";

// Header with title + description
export function HeaderSkeleton() {
  return (
    <div className="mb-6">
      <Skeleton className="h-8 w-48 mb-2" />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}

// Grid of cards (categories, competitions, etc.)
export function GridCardsSkeleton({
  count = 6,
  cols = "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
}: {
  count?: number;
  cols?: string;
}) {
  return (
    <div className={`grid ${cols} gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${glassCard} p-4`}>
          <Skeleton className="aspect-square w-full rounded-lg mb-3" />
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

// Product grid skeleton — mirrors FloatingProductCard sizing
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${glassCardSm} p-1.5`}>
          <Skeleton className="aspect-square w-full rounded-md mb-1.5" />
          <Skeleton className="h-3 w-3/4 mb-1" />
          <Skeleton className="h-2.5 w-1/2 mb-1.5" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-6 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Vertical list of cards
export function ListCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${glassCard} p-4 flex items-center gap-3`}>
          <Skeleton className="w-14 h-14 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}

// Table skeleton for admin pages
export function TableSkeleton({
  rows = 5,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className={`${glassCard} overflow-hidden`}>
      <div className="bg-foreground/5 p-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-3 flex gap-4 border-t border-foreground/5">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// Form skeleton for settings pages
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className={`${glassCard} p-6`}>
      <Skeleton className="h-6 w-40 mb-5" />
      <div className="space-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}
        <Skeleton className="h-10 w-32 rounded-md mt-4" />
      </div>
    </div>
  );
}

// Chat / messages skeleton
export function ChatSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[true, false, true, false, true].map((isLeft, i) => (
        <div
          key={i}
          className={`flex ${isLeft ? "justify-start" : "justify-end"}`}
        >
          <div className="max-w-[70%] space-y-1">
            <Skeleton
              className={`h-12 ${isLeft ? "w-48" : "w-36"} rounded-2xl`}
            />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Detail page skeleton (product/order detail) — matches ProductDetail layout
export function DetailPageSkeleton() {
  return (
    <div className="min-h-screen bg-transparent">
      {/* Hero image */}
      <div className="relative">
        <Skeleton className="w-full aspect-square rounded-none" />
        <div className="absolute top-4 right-4">
          <Skeleton className="w-9 h-9 rounded-xl" />
        </div>
        <div className="absolute top-4 left-4">
          <Skeleton className="w-9 h-9 rounded-xl" />
        </div>
      </div>
      {/* Content card */}
      <div className="px-4 -mt-6 relative z-10 space-y-4">
        <div className={`${glassCard} p-4 space-y-3`}>
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
        </div>
        <div className={`${glassCard} p-4 space-y-3`}>
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </div>
        <div className="flex gap-3 sticky bottom-4">
          <Skeleton className="h-12 w-32 rounded-xl" />
          <Skeleton className="h-12 flex-1 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// Stats grid skeleton
export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${glassCard} p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-7 w-20" />
        </div>
      ))}
    </div>
  );
}

// Notifications list skeleton
export function NotificationsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${glassCard} p-3 flex items-start gap-3`}>
          <Skeleton className="w-8 h-8 rounded-full shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Banner skeleton for home page (matches BannerCarousel)
export function BannerSkeleton() {
  return <Skeleton className="w-full h-32 md:h-48 lg:h-64 rounded-xl" />;
}

// Cart items skeleton
export function CartSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${glassCard} p-3 flex gap-3`}>
          <Skeleton className="w-20 h-20 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>
        </div>
      ))}
      <div className={`${glassCard} p-4 space-y-3`}>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}

// Order list skeleton
export function OrderListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${glassCard} p-4`}>
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Profile skeleton
export function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="w-20 h-20 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <StatsGridSkeleton count={3} />
      <FormSkeleton fields={3} />
    </div>
  );
}

// Competition cards skeleton
export function CompetitionGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${glassCard} overflow-hidden`}>
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-7 w-20 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Admin page wrapper skeleton (with stats + table)
export function AdminPageSkeleton({
  statsCount = 4,
  tableRows = 6,
  tableCols = 5,
}: {
  statsCount?: number;
  tableRows?: number;
  tableCols?: number;
}) {
  return (
    <div className="space-y-6">
      <StatsGridSkeleton count={statsCount} />
      <TableSkeleton rows={tableRows} cols={tableCols} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page-shaped skeletons — match the exact layout of specific pages.         */
/* -------------------------------------------------------------------------- */

// Home page — wishes banner + carousel + reels strip + hero + categories grid
export function HomePageSkeleton() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-transparent">
      <main className="relative z-10 pt-6">
        {/* Wishes banner */}
        <section className="container mx-auto px-4 mb-2">
          <Skeleton className="h-14 w-full rounded-2xl" />
        </section>

        {/* Banner carousel */}
        <section className="w-full">
          <Skeleton className="w-full h-32 md:h-48 lg:h-64 rounded-none" />
        </section>

        {/* Reels strip */}
        <section className="container mx-auto px-4 py-3">
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                className="w-20 h-28 rounded-2xl shrink-0"
              />
            ))}
          </div>
        </section>

        {/* Hero text */}
        <section className="container mx-auto px-4 py-6 md:py-10 text-center space-y-3">
          <Skeleton className="h-9 md:h-12 w-40 mx-auto" />
          <Skeleton className="h-4 w-64 max-w-full mx-auto" />
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
        </section>

        {/* Stories strip */}
        <section className="container mx-auto px-4 py-2">
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
                <Skeleton className="w-16 h-16 rounded-full" />
                <Skeleton className="h-2.5 w-12" />
              </div>
            ))}
          </div>
        </section>

        {/* Sections heading */}
        <section className="container mx-auto px-4 py-8 md:py-12 space-y-6">
          <div className="text-center mb-6">
            <Skeleton className="h-10 md:h-12 w-72 max-w-full mx-auto rounded-xl mb-2" />
            <Skeleton className="h-3 w-48 mx-auto" />
          </div>

          {/* Section heading line */}
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="w-1 h-6 rounded-full" />
            <Skeleton className="h-5 w-32" />
          </div>

          {/* Category grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`${glassCardSm} p-3 md:p-4 h-[140px] md:h-[172px] flex flex-col items-center justify-center gap-2`}
              >
                <Skeleton className="w-8 h-8 md:w-12 md:h-12 rounded-xl" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

// Category detail page — header + filter bar + product grid
export function CategoryPageSkeleton() {
  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto px-4 py-6 space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-3 w-20" />
        </div>

        {/* Title + description */}
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>

        {/* Products grid (matches FloatingProductCard) */}
        <ProductGridSkeleton count={10} />
      </div>
    </div>
  );
}

// Cart page skeleton — cart items + order summary
export function CartPageSkeleton() {
  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-7 w-32" />
        <CartSkeleton count={3} />
      </div>
    </div>
  );
}

// Profile page skeleton
export function ProfilePageSkeleton() {
  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto px-4 py-6 space-y-4">
        <ProfileSkeleton />
      </div>
    </div>
  );
}
