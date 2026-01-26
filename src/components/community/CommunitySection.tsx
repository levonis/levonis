import { Suspense, lazy, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import CommunityExploreStrip from '@/components/community/CommunityExploreStrip';
import AnimatedDivider from '@/components/ui/animated-divider';

const MerchantDashboardWidgets = lazy(() => import('@/components/merchant/MerchantDashboardWidgets'));

interface CommunitySectionProps {
  noFrame?: boolean;
}

export default function CommunitySection({ noFrame = false }: CommunitySectionProps) {
  const { user } = useAuth();

  const { data: merchantApp } = useQuery({
    queryKey: ["merchant-status", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("merchant_applications")
        .select("id, status")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const isMerchant = useMemo(() => !!merchantApp, [merchantApp]);

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

      {/* Merchant Dashboard Widgets */}
      {isMerchant && user?.id && (
        <>
          <Suspense fallback={<div className="h-40 animate-pulse bg-muted/30 rounded-xl" />}>
            <MerchantDashboardWidgets merchantId={user.id} />
          </Suspense>
          <AnimatedDivider className="mt-5 mb-3 opacity-80" />
        </>
      )}

      {/* Explore tabs */}
      <div className={isMerchant ? "mt-4" : "mt-6"}>
        <CommunityExploreStrip />
      </div>
    </section>
  );
}
