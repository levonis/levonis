import { useLocation } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { ADMIN_BASE_PATH } from "@/config/adminConfig";

/**
 * RouteAwareSkeleton – renders a loading placeholder that mirrors the
 * TARGET route's real layout (grid columns, card sizes, spacing) so there's
 * zero layout shift when the lazy chunk resolves.
 *
 * Used as the Suspense fallback for all lazy routes.
 */
function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border/30 bg-card/40 p-1.5 space-y-1.5">
          <Skeleton className="aspect-square w-full rounded-md" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-2 w-1/2" />
          <div className="flex items-center justify-between pt-1">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-6 w-6 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border/30 bg-card/40 p-4 space-y-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border/30 overflow-hidden">
        <div className="bg-muted/40 p-3 flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-3 flex gap-4 border-t border-border/20">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3 p-3 rounded-xl border border-border/30 bg-card/40">
          <Skeleton className="h-20 w-20 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>
        </div>
      ))}
      <div className="rounded-xl border border-border/30 bg-card/40 p-4 space-y-3 mt-6">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-10 w-full rounded-md mt-2" />
      </div>
    </div>
  );
}

function ProductDetailsSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Skeleton className="aspect-square w-full max-w-md mx-auto rounded-xl" />
      <div className="space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
        <Skeleton className="h-12 w-40 rounded-md mt-4" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-16 rounded-full shrink-0" />
        ))}
      </div>
      <ProductGridSkeleton count={10} />
    </div>
  );
}

function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="max-w-2xl mx-auto space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card/40">
          <Skeleton className="h-12 w-12 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export default function RouteAwareSkeleton() {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith(ADMIN_BASE_PATH);

  let inner: React.ReactNode;

  if (pathname === "/" || pathname === "/home") {
    inner = <HomeSkeleton />;
  } else if (pathname.startsWith("/search") || pathname.startsWith("/product-shop") || pathname.startsWith("/category")) {
    inner = <ProductGridSkeleton count={12} />;
  } else if (pathname.startsWith("/product/") || pathname.startsWith("/products/")) {
    inner = <ProductDetailsSkeleton />;
  } else if (pathname === "/cart" || pathname.startsWith("/checkout")) {
    inner = <CartSkeleton />;
  } else if (pathname.startsWith("/profile") || pathname === "/user-info") {
    inner = <ProfileSkeleton />;
  } else if (
    pathname === "/notifications" ||
    pathname === "/favorites" ||
    pathname === "/rewards" ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/messages") ||
    pathname.startsWith("/community")
  ) {
    inner = <ListSkeleton rows={6} />;
  } else if (isAdmin) {
    inner = <TableSkeleton rows={8} cols={5} />;
  } else {
    inner = <ListSkeleton rows={4} />;
  }

  return (
    <div
      className="min-h-[50vh] w-full max-w-6xl mx-auto px-4 py-6"
      aria-busy="true"
      aria-live="polite"
    >
      {inner}
    </div>
  );
}
