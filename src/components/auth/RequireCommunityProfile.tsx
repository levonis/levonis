import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useCommunityProfileCheck } from "@/hooks/useCommunityProfileCheck";
import { Loader2 } from "lucide-react";

interface Props {
  children: ReactNode;
}

/**
 * Wrapper that ensures user has completed their community profile
 * before accessing community pages. Redirects to profile completion
 * if required fields are missing.
 */
export default function RequireCommunityProfile({ children }: Props) {
  const { user, isProfileComplete, isLoading } = useCommunityProfileCheck();
  const location = useLocation();

  // Show loading while checking auth and profile status
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in - redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  // Profile not complete - redirect to profile completion
  // But allow access to the profile page itself to avoid infinite loop
  if (!isProfileComplete && location.pathname !== "/community/customer/profile") {
    return <Navigate to="/community/customer/profile" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
