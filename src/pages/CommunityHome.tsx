import { useEffect, useState } from "react";
import { Search, Users } from "lucide-react";
import { useSearchParams, Link } from "react-router-dom";
import Footer from "@/components/Footer";
import CommunityQuickActions from "@/components/community/CommunityQuickActions";
import CommunityExploreStrip from "@/components/community/CommunityExploreStrip";
import AnimatedDivider from "@/components/ui/animated-divider";
import { Input } from "@/components/ui/input";

export default function CommunityHome() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const tab = searchParams.get("tab") || "products";
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

  const setQ = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set("q", value);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Hero header */}
        <div className="text-center py-6">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-gradient-to-b from-primary/10 to-primary/5 border border-primary/20 mb-4">
            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary">مجتمع ليفو</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-primary">
            منصة الطباعة ثلاثية الأبعاد
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            تواصل مع التجار، أضف طلباتك، واستعرض المنتجات والخدمات المتاحة
          </p>
        </div>

        {/* Search bar */}
        <div className={isScrolled ? "h-0 overflow-hidden" : "sticky top-14 z-40 pb-4"}>
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                tab === "products"
                  ? "ابحث عن منتج..."
                  : tab === "merchants"
                  ? "ابحث عن تاجر..."
                  : "ابحث عن طلب..."
              }
              className="pr-11 h-12 rounded-2xl border-border/50 bg-background/80 backdrop-blur-sm shadow-sm focus:shadow-md transition-shadow"
            />
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="mt-6">
          <CommunityQuickActions />
        </div>

        <AnimatedDivider className="mt-8 mb-6 opacity-80" />

        {/* Explore tabs */}
        <CommunityExploreStrip />

        <div className="mt-10">
          <Footer />
        </div>
      </main>
    </div>
  );
}
