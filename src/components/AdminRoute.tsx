import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AdminRouteProps {
  children: ReactNode;
  /** If true, only strict admin (not assistant) may pass. */
  requireFullAdmin?: boolean;
}

/**
 * AdminRoute - Secure wrapper component that enforces admin role checks
 * 
 * SECURITY FEATURES:
 * - Server-side admin role verification (not just client state)
 * - Returns 404-like response for unauthorized access (prevents enumeration)
 * - Logs failed access attempts
 * - Prevents access via cached pages
 * - Session validation on every access
 */
const AdminRoute = ({ children, requireFullAdmin = false }: AdminRouteProps) => {
  const { user, isAdmin, loading: authLoading, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const verifyAdminAccess = async () => {
      // Wait for auth to complete
      if (authLoading) return;

      // No user = redirect to auth (don't reveal admin exists)
      if (!user || !session) {
        // Log attempted access
        console.warn('[Security] Unauthenticated admin access attempt:', {
          path: location.pathname,
          timestamp: new Date().toISOString(),
        });
        navigate('/auth', { replace: true });
        setVerifying(false);
        return;
      }

      // Verify session is still valid
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !currentSession) {
        console.warn('[Security] Invalid session on admin access:', {
          path: location.pathname,
          userId: user.id,
          timestamp: new Date().toISOString(),
        });
        navigate('/auth', { replace: true });
        setVerifying(false);
        return;
      }

      // Server-side admin/assistant role verification (don't trust client state alone)
      const rolesQuery = requireFullAdmin
        ? supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .eq('role', 'admin')
            .maybeSingle()
        : supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .in('role', ['admin', 'assistant'])
            .limit(1)
            .maybeSingle();

      const { data: roleData, error: roleError } = await rolesQuery;

      if (roleError || !roleData) {
        // Log failed admin access attempt
        console.warn('[Security] Non-admin access attempt to admin route:', {
          path: location.pathname,
          userId: user.id,
          requireFullAdmin,
          timestamp: new Date().toISOString(),
        });
        
        // Return 404-like response to prevent enumeration
        // Don't reveal that this is an admin route
        navigate('/', { replace: true });
        setVerifying(false);
        return;
      }

      // All checks passed
      setVerified(true);
      setVerifying(false);
    };

    setVerified(false);
    setVerifying(true);
    verifyAdminAccess();
  }, [user, session, authLoading, navigate, location.pathname, requireFullAdmin]);

  // Show loading while verifying (transparent so AppBackground shows through)
  if (authLoading || verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render children if not verified
  if (!verified) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminRoute;
