import { useNavigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

const ReelsFeed = lazy(() => import('@/components/reels/ReelsFeed'));

export default function ReelsPage() {
  const navigate = useNavigate();

  return (
    <Suspense fallback={
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-muted/20 animate-pulse" />
        <div className="space-y-2 w-48">
          <div className="h-3 w-full rounded bg-muted/20 animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-muted/20 animate-pulse" />
        </div>
      </div>
    }>
      <ReelsFeed onClose={() => navigate(-1)} />
    </Suspense>
  );
}
