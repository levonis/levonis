import { useState } from "react";
import { ArrowRight, Package, Search, TrendingUp, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserGachaInventory, useGachaSettings } from "./useGachaData";
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

export default function GachaCollection({ onBack }: Props) {
  const { data: inventory = [], isLoading } = useUserGachaInventory();
  const { data: settings } = useGachaSettings();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selling, setSelling] = useState(false);
  const [listingPrice, setListingPrice] = useState("");
  const [showSellDialog, setShowSellDialog] = useState(false);

  const filtered = inventory.filter((item: any) =>
    pickI18n(item.gacha_dolls, "name", language)?.includes(search) || item.gacha_dolls?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleInstantSell = async (item: any) => {
    if (selling) return;
    setSelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("gacha-sell", {
        body: { inventory_item_id: item.id, sell_type: "instant" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast({ title: `تم البيع بـ ${data.sell_price} نقطة`, description: `خصم ${data.discount_percent}% من سعر السوق` });
      queryClient.invalidateQueries({ queryKey: ["gacha-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["user-points-game"] });
      setSelectedItem(null);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSelling(false);
    }
  };

  const handleListForSale = async (item: any) => {
    if (selling || !listingPrice) return;
    setSelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("gacha-sell", {
        body: { inventory_item_id: item.id, sell_type: "list", asking_price: parseInt(listingPrice) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast({ title: "تم عرض الدمية في السوق" });
      queryClient.invalidateQueries({ queryKey: ["gacha-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["gacha-marketplace"] });
      setShowSellDialog(false);
      setSelectedItem(null);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSelling(false);
    }
  };

  const getInstantSellPrice = (doll: any) => {
    const maxDiscount = Number(settings?.instant_sell_max_discount ?? 50);
    const minDiscount = Number(settings?.instant_sell_min_discount ?? 10);
    const demand = doll.demand_score ?? 0;
    const demandFactor = Math.min(demand / 100, 1);
    const discount = maxDiscount - (demandFactor * (maxDiscount - minDiscount));
    return Math.max(1, Math.round(doll.current_price * (1 - discount / 100)));
  };

  return (
    <div className="min-h-screen pb-20" dir="rtl">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-primary/20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground">
            <ArrowRight className="h-4 w-4" /> رجوع
          </Button>
          <span className="text-sm font-bold text-foreground flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" /> مجموعتي ({inventory.length})
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-3">
        <div className="relative mb-4">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ابحث في مجموعتك..."
            className="pr-9 bg-card border-border/30"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="aspect-square rounded-xl bg-card animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <span className="text-4xl mb-3 block">🧸</span>
            <p className="text-sm">لا تملك دُمى بعد</p>
            <p className="text-xs mt-1">العب في آلات الغاتشا لتجمع الدُمى!</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {filtered.map((item: any) => {
              const doll = item.gacha_dolls;
              const rarity = doll?.gacha_rarity_tiers;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="relative rounded-xl border border-border/20 overflow-hidden hover:border-primary/30 transition-all group"
                  style={{ boxShadow: rarity ? `0 0 12px ${rarity.glow_color}15` : undefined }}
                >
                  <div className="aspect-square bg-card flex items-center justify-center p-2">
                    {doll?.image_url ? (
                      <img src={doll.image_url} alt={pickI18n(doll, "name", language)} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-3xl">🧸</span>
                    )}
                  </div>
                  {item.is_listed && (
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-amber-500/80 text-[8px] text-white font-bold">
                      معروض
                    </div>
                  )}
                  <div className="p-1.5 bg-card/80">
                    <p className="text-[10px] font-medium text-foreground truncate">{pickI18n(doll, "name", language)}</p>
                    {rarity && (
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: rarity.color }} />
                        <span className="text-[8px] text-muted-foreground">{pickI18n(rarity, "name", language)}</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Item Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          {selectedItem && (() => {
            const doll = selectedItem.gacha_dolls;
            const rarity = doll?.gacha_rarity_tiers;
            const instantPrice = doll ? getInstantSellPrice(doll) : 0;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-right">{pickI18n(doll, "name", language)}</DialogTitle>
                </DialogHeader>
                <div className="text-center py-4">
                  {doll?.image_url ? (
                    <img src={doll.image_url} alt={pickI18n(doll, "name", language)} className="w-24 h-24 mx-auto object-contain mb-3" />
                  ) : (
                    <span className="text-5xl block mb-3">🧸</span>
                  )}
                  {rarity && (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mb-2"
                      style={{ backgroundColor: `${rarity.color}20`, color: rarity.color, border: `1px solid ${rarity.color}30` }}>
                      {pickI18n(rarity, "name", language)}
                    </span>
                  )}
                  {pickI18n(doll, "description", language) && <p className="text-xs text-muted-foreground mb-3">{pickI18n(doll, "description", language)}</p>}
                  
                  <div className="flex items-center justify-center gap-4 text-xs mb-4">
                    <div className="text-center">
                      <p className="text-muted-foreground">سعر السوق</p>
                      <p className="font-bold text-foreground">{doll?.current_price} نقطة</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground flex items-center gap-1 justify-center">
                        <TrendingUp className="h-3 w-3" /> الطلب
                      </p>
                      <p className="font-bold text-foreground">{doll?.demand_score ?? 0}</p>
                    </div>
                  </div>

                  {doll?.is_tradable && !selectedItem.is_listed && (
                    <div className="space-y-2">
                      <Button
                        onClick={() => handleInstantSell(selectedItem)}
                        disabled={selling}
                        className="w-full bg-red-500 hover:bg-red-600 text-white"
                        size="sm"
                      >
                        ⚡ بيع فوري ({instantPrice} نقطة)
                      </Button>
                      <Button
                        onClick={() => { setListingPrice(String(doll.current_price)); setShowSellDialog(true); }}
                        variant="outline"
                        size="sm"
                        className="w-full border-primary/30"
                      >
                        <ShoppingBag className="h-3.5 w-3.5 ml-1" /> عرض في السوق
                      </Button>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* List for Sale Dialog */}
      <Dialog open={showSellDialog} onOpenChange={setShowSellDialog}>
        <DialogContent className="max-w-xs" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">عرض في السوق</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">السعر المطلوب (نقاط)</label>
              <Input
                type="number"
                value={listingPrice}
                onChange={e => setListingPrice(e.target.value)}
                min={1}
                className="bg-card"
              />
            </div>
            <Button
              onClick={() => selectedItem && handleListForSale(selectedItem)}
              disabled={selling || !listingPrice}
              className="w-full"
            >
              {selling ? "جاري العرض..." : "تأكيد العرض"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
