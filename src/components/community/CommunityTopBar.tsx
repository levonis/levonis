import { memo, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Search,
  Users,
  Menu,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import CommunityNavGrid from "./CommunityNavGrid";

/**
 * يظهر فقط داخل /community* ويستبدل شريط الموقع.
 * - عند التمرير يظهر حقل البحث داخل الشريط العلوي.
 * - البحث يُخزن في ?q= ... حتى تتشاركه المكونات بدون تمرير props.
 */
const CommunityTopBar = memo(() => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
          {/* Left Side - Back + Title */}
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-9 w-9 shrink-0"
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
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0 shadow-sm">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-foreground truncate">مجتمع ليفو</p>
                <p className="text-[10px] text-muted-foreground truncate leading-tight">
                  {tab === "products" ? "منتجات التجار" : tab === "merchants" ? "صفحات التجار" : "طلبات الزبائن"}
                </p>
              </div>
            </Link>
          </div>

          {/* Right Side - Menu Button */}
          <div className="flex items-center gap-2">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full h-9 w-9 border-primary/20 hover:border-primary/40"
                  aria-label="قائمة التنقل"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[320px] sm:w-[380px] p-0">
                <SheetHeader className="p-4 border-b border-border/30 bg-muted/10">
                  <SheetTitle className="text-right flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <span>قائمة مجتمع ليفو</span>
                  </SheetTitle>
                </SheetHeader>
                <div className="p-4 overflow-y-auto max-h-[calc(100vh-80px)]">
                  <CommunityNavGrid />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Search collapses into topbar after scrolling */}
        {isCommunityRoot && (
          <div
            className={
              isScrolled
                ? "pb-3 transition-all duration-200"
                : "pb-0 h-0 overflow-hidden transition-all duration-200"
            }
          >
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tab === "products" ? "ابحث عن منتج..." : tab === "merchants" ? "ابحث عن تاجر..." : "ابحث عن طلب..."}
                className="pr-10 h-10 rounded-xl border-border/50 focus:border-primary/40"
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
