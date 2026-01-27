import { memo, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Boxes,
  MessageCircle,
  Search,
  Settings,
  Store,
  Package,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADMIN_ROUTES } from "@/config/adminConfig";

/**
 * يظهر فقط داخل /community* ويستبدل شريط الموقع.
 * - عند التمرير يظهر حقل البحث داخل الشريط العلوي.
 * - البحث يُخزن في ?q= ... حتى تتشاركه المكونات بدون تمرير props.
 */
const CommunityTopBar = memo(() => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 110);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const tab = searchParams.get("tab") || "products";
  const q = searchParams.get("q") || "";

  const setQ = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set("q", value);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };

  const isCommunityRoot = location.pathname === "/community";

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

  return (
    <header
      className="fixed left-0 right-0 z-50 border-b bg-background/95 backdrop-blur-xl border-border/40 shadow-md"
      style={{ top: 0 }}
    >
      <div className="container mx-auto px-4">
        <div className="h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              aria-label="العودة للرئيسية"
              onClick={() => navigate("/")}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>

            <Link
              to="/community?tab=products"
              className="flex items-center gap-2 min-w-0"
              aria-label="الانتقال إلى مجتمع ليفو"
            >
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-foreground truncate">مجتمع ليفو</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {tab === "products" ? "منتجات التجار" : tab === "merchants" ? "صفحات التجار" : "طلبات العملاء"}
                </p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2">
          {/* For merchants: Orders, Store, Messages, Settings */}
            {isMerchant ? (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  aria-label="الطلبات"
                  onClick={() => navigate("/community/merchant/orders")}
                >
                  <Package className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  aria-label="إدارة المتجر"
                  onClick={() => navigate("/community/merchant/store")}
                >
                  <Store className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  aria-label="المحادثات"
                  onClick={() => navigate("/community/messages")}
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  aria-label={isAdmin ? "لوحة التحكم" : "الإعدادات"}
                  onClick={() => navigate(isAdmin ? ADMIN_ROUTES.dashboard : "/profile/settings")}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  aria-label="المحادثات"
                  onClick={() => navigate("/community/messages")}
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>

                {isCommunityRoot && (
                  <Button
                    variant={tab === "merchants" ? "default" : "outline"}
                    size="icon"
                    className="rounded-full"
                    aria-label="صفحات التجار"
                    onClick={() => navigate("/community?tab=merchants", { replace: false })}
                  >
                    <Boxes className="h-4 w-4" />
                  </Button>
                )}

                {isAdmin && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    aria-label="لوحة التحكم"
                    onClick={() => navigate(ADMIN_ROUTES.dashboard)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* search collapses into topbar after scrolling */}
        {isCommunityRoot && (
          <div
            className={
              isScrolled
                ? "pb-3 transition-all"
                : "pb-0 h-0 overflow-hidden transition-all"
            }
          >
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tab === "products" ? "ابحث عن منتج..." : tab === "merchants" ? "ابحث عن تاجر..." : "ابحث عن طلب..."}
                className="pr-10"
              />
            </div>
          </div>
        )}
      </div>
    </header>
  );
});

CommunityTopBar.displayName = "CommunityTopBar";

export default CommunityTopBar;
