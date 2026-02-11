import { useNavigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const ReelsFeed = lazy(() => import('@/components/reels/ReelsFeed'));

export default function ReelsPage() {
  const navigate = useNavigate();

  return (
    <Suspense fallback={
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <ReelsFeed onClose={() => navigate(-1)} />
    </Suspense>
  );
}
