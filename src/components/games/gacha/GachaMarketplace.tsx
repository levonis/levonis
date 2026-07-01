import { useState } from "react";
import { ArrowRight, ShoppingBag, TrendingUp, Search, SortAsc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGachaMarketplace } from "./useGachaData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/lib/i18n";
import { pickI18n } from "@/lib/i18nField";

interface Props {
  onBack: () => void;
}

type SortOption = "newest" | "price_high" | "price_low" | "demand";

export default function GachaMarketplace({ onBack }: Props) {
  const { data: listings = [], isLoading } = useGachaMarketplace();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<any>(null);

  let filtered = listings.filter((l: any) =>
    pickI18n(l.gacha_dolls, "name", language)?.includes(search) || l.gacha_dolls?.name?.toLowerCase().includes(search.toLowerCase())
  );

  // Sort
  filtered = [...filtered].sort((a: any, b: any) => {
    switch (sort) {
      case "price_high": return b.asking_price - a.asking_price;
      case "price_low": return a.asking_price - b.asking_price;
      case "demand": return (b.gacha_dolls?.demand_score ?? 0) - (a.gacha_dolls?.demand_score ?? 0);
      default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const handleBuy = async (listing: any) => {
    if (!user) {
      toast({ title: "يجب تسجيل الدخول", variant: "destructive" });
      return;
    }
    setBuyingId(listing.id);
    try {
      const { data, error } = await supabase.functions.invoke("gacha-market-buy", {
        body: { listing_id: listing.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "تم الشراء بنجاح!", description: `تم خصم ${data.price_paid} نقطة` });
      queryClient.invalidateQueries({ queryKey: ["gacha-marketplace"] });
      queryClient.invalidateQueries({ queryKey: ["gacha-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["user-points-game"] });
      setConfirmItem(null);
    } catch (err: any) {
      toast({ title: "خطأ في الشراء", description: err.message, variant: "destructive" });
    } finally {
      setBuyingId(null);
    }
  };

  const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: "newest", label: "الأحدث" },
    { value: "price_low", label: "الأرخص" },
    { value: "price_high", label: "الأغلى" },
    { value: "demand", label: "الأكثر طلباً" },
  ];

  return (
    <div className="min-h-screen pb-20" dir="rtl">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-primary/20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground">
            <ArrowRight className="h-4 w-4" /> رجوع
          </Button>
          <span className="text-sm font-bold text-foreground flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-primary" /> السوق
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-3 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن دمية..." className="pr-9 bg-card border-border/30" />
        </div>

        {/* Sort */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              className={`px-3 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors ${
                sort === opt.value ? "bg-primary text-primary-foreground" : "bg-card border border-border/30 text-muted-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Listings */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[1,2,3,4].map(i => <div key={i} className="aspect-[3/4] rounded-xl bg-card animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <span className="text-4xl mb-3 block">🏪</span>
            <p className="text-sm">لا توجد عروض حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((listing: any) => {
              const doll = listing.gacha_dolls;
              const rarity = doll?.gacha_rarity_tiers;
              const isMine = listing.seller_id === user?.id;
              return (
                <button
                  key={listing.id}
                  onClick={() => !isMine && setConfirmItem(listing)}
                  className="rounded-xl border border-border/20 overflow-hidden hover:border-primary/30 transition-all text-right"
                  disabled={isMine}
                >
                  <div className="aspect-square bg-card flex items-center justify-center p-3 relative">
                    {doll?.image_url ? (
                      <img src={doll.image_url} alt={pickI18n(doll, "name", language)} className="w-full h-full object-contain" loading="lazy" decoding="async" />
                    ) : (
                      <span className="text-4xl">🧸</span>
                    )}
                    {rarity && (
                      <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ backgroundColor: rarity.color, boxShadow: `0 0 6px ${rarity.glow_color}` }} />
                    )}
                    {isMine && (
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-primary/80 text-[8px] text-primary-foreground font-bold">
                        عرضك
                      </div>
                    )}
                  </div>
                  <div className="p-2 bg-card/80">
                    <p className="text-xs font-medium text-foreground truncate">{pickI18n(doll, "name", language)}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-bold text-primary">{listing.asking_price} ⭐</span>
                      {doll?.demand_score > 0 && (
                        <span className="text-[9px] text-amber-500 flex items-center gap-0.5">
                          <TrendingUp className="h-2.5 w-2.5" /> {doll.demand_score}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Buy Confirmation */}
      <Dialog open={!!confirmItem} onOpenChange={() => setConfirmItem(null)}>
        <DialogContent className="max-w-xs" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">تأكيد الشراء</DialogTitle>
          </DialogHeader>
          {confirmItem && (
            <div className="text-center py-3">
              {confirmItem.gacha_dolls?.image_url ? (
                <img src={confirmItem.gacha_dolls.image_url} className="w-20 h-20 mx-auto object-contain mb-3" alt="" loading="lazy" decoding="async" />
              ) : (
                <span className="text-4xl block mb-3">🧸</span>
              )}
              <p className="font-bold text-foreground mb-1">{pickI18n(confirmItem.gacha_dolls, "name", language)}</p>
              <p className="text-lg font-bold text-primary mb-4">{confirmItem.asking_price} نقطة</p>
              <Button
                onClick={() => handleBuy(confirmItem)}
                disabled={buyingId === confirmItem.id}
                className="w-full"
              >
                {buyingId === confirmItem.id ? "جاري الشراء..." : "شراء الآن"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
