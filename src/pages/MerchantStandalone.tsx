import { lazy, Suspense, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import StandaloneShell from "@/components/merchant/StandaloneShell";

const CommunityMerchantStorePage = lazy(
  () => import("./CommunityMerchantStorePage")
);
const CommunityMerchantProfessionalDashboard = lazy(
  () => import("./CommunityMerchantProfessionalDashboard")
);

interface MerchantBasic {
  id: string;
  display_name: string;
  store_image_url: string | null;
  selected_frame_id: string | null;
  store_slug: string | null;
}

/**
 * /s/:slug             → standalone storefront for the merchant
 * /s/:slug/dashboard   → standalone owner dashboard (auth + ownership required)
 *
 * Both routes share a merchant-branded header and a "Powered by Levonis" footer
 * to give the merchant the feeling of an independent website.
 */
export default function MerchantStandalone() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isDashboard = location.pathname.endsWith("/dashboard");

  const { data: merchant, isLoading } = useQuery({
    queryKey: ["merchant-by-slug", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_public_profiles")
        .select("id, display_name, store_image_url, selected_frame_id, store_slug")
        .eq("store_slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data as MerchantBasic | null;
    },
  });

  const { data: frame } = useQuery({
    queryKey: ["merchant-frame", merchant?.selected_frame_id],
    enabled: !!merchant?.selected_frame_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("avatar_frames")
        .select("image_url")
        .eq("id", merchant!.selected_frame_id!)
        .maybeSingle();
      return data;
    },
  });

  const { data: isOwner } = useQuery({
    queryKey: ["merchant-owner", merchant?.id, user?.id],
    enabled: !!merchant?.id && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("merchant_applications")
        .select("id")
        .eq("id", merchant!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  useEffect(() => {
    if (merchant?.display_name) {
      const suffix = isDashboard ? " — لوحة التحكم" : "";
      document.title = `${merchant.display_name}${suffix} | Levonis`;
    }
  }, [merchant?.display_name, isDashboard]);

  const headerAction = useMemo(() => {
    if (!merchant) return null;
    if (isDashboard) {
      return (
        <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1">
          <Link to={`/s/${merchant.store_slug}`}>
            <ArrowRight className="h-3.5 w-3.5" />
            للمتجر
          </Link>
        </Button>
      );
    }
    if (isOwner) {
      return (
        <Button asChild size="sm" className="h-8 text-xs gap-1">
          <Link to={`/s/${merchant.store_slug}/dashboard`}>
            <LayoutDashboard className="h-3.5 w-3.5" />
            لوحة التحكم
          </Link>
        </Button>
      );
    }
    return null;
  }, [merchant, isOwner, isDashboard]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Skeleton className="h-14 w-full mb-6" />
        <Skeleton className="h-48 w-full max-w-5xl mx-auto rounded-2xl" />
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <div>
          <h1 className="text-xl font-bold mb-2">المتجر غير موجود</h1>
          <p className="text-sm text-muted-foreground mb-4">
            تأكد من الرابط أو عد إلى الصفحة الرئيسية.
          </p>
          <Button onClick={() => navigate("/")}>الرئيسية</Button>
        </div>
      </div>
    );
  }

  if (isDashboard) {
    if (!user) {
      navigate(`/auth?redirect=/s/${merchant.store_slug}/dashboard`, {
        replace: true,
      });
      return null;
    }
    if (isOwner === false) {
      return (
        <StandaloneShell
          merchantName={merchant.display_name}
          merchantImage={merchant.store_image_url}
          frameUrl={frame?.image_url}
          slug={merchant.store_slug || ""}
        >
          <div className="container mx-auto max-w-3xl px-4 py-12 text-center">
            <h2 className="text-lg font-bold mb-2">غير مصرّح بالدخول</h2>
            <p className="text-sm text-muted-foreground mb-4">
              لوحة التحكم متاحة لصاحب المتجر فقط.
            </p>
            <Button asChild>
              <Link to={`/s/${merchant.store_slug}`}>عودة للمتجر</Link>
            </Button>
          </div>
        </StandaloneShell>
      );
    }
  }

  return (
    <StandaloneShell
      merchantName={merchant.display_name}
      merchantImage={merchant.store_image_url}
      frameUrl={frame?.image_url}
      slug={merchant.store_slug || ""}
      headerAction={headerAction}
    >
      <Suspense
        fallback={
          <div className="container mx-auto max-w-5xl px-4 py-6">
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        }
      >
        {isDashboard ? (
          <CommunityMerchantProfessionalDashboard />
        ) : (
          <CommunityMerchantStorePage merchantIdOverride={merchant.id} />
        )}
      </Suspense>
    </StandaloneShell>
  );
}
