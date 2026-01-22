import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] container mx-auto px-4 flex items-center justify-center">
        <div className="w-full max-w-md space-y-3">
          <div className="h-6 w-40 bg-muted rounded animate-pulse mx-auto" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse mx-auto" />
          <div className="h-10 w-full bg-muted rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
