import { Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import Footer from "@/components/Footer";
import CommunitySection from "@/components/community/CommunitySection";
import { Input } from "@/components/ui/input";

export default function CommunityHome() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const tab = searchParams.get("tab") || "products";

  const setQ = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set("q", value);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-6 pt-20 max-w-6xl">
        {/* Search bar */}
        <div className="mb-4">
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

        <CommunitySection noFrame />

        <div className="mt-10">
          <Footer />
        </div>
      </main>
    </div>
  );
}
