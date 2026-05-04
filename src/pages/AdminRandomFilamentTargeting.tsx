import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Search, Save, Check, Package2, Layers, Settings2, Sliders } from "lucide-react";

type SaleType = "direct" | "preorder";
type ProductWeight = {
  weight?: number;
  colors?: Record<string, number>;
  options?: Record<string, number>;
};
type ProductWeights = Record<string, ProductWeight>;
type Offer = {
  id: string;
  sale_type: SaleType;
  title_ar: string;
  category_id: string | null;
  category_ids: string[];
  allowed_product_ids: string[];
  product_weights: ProductWeights;
  enabled: boolean;
};

const PRINTING_MATERIALS_ID = "c3177652-b079-46a5-9435-f641e4c5fd58";

export default function AdminRandomFilamentTargeting() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: offers, refetch } = useQuery<Offer[]>({
    queryKey: ["admin-rf-targeting-offers"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("random_filament_offers")
        .select("id, sale_type, title_ar, category_id, category_ids, allowed_product_ids, product_weights, enabled")
        .order("sale_type")
        .order("display_order");
      return (data || []) as Offer[];
    },
  });

  const { data: subCategories } = useQuery({
    queryKey: ["rf-targeting-subcats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories").select("id, name_ar")
        .eq("main_section_id", PRINTING_MATERIALS_ID).order("name_ar");
      return data || [];
    },
  });

  return (
    <div className="container mx-auto p-4 space-y-4">
      <Card className="glass-panel">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="size-5 text-primary" />
            <h1 className="text-lg font-bold">إدارة استهداف العروض العشوائية</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            اختر الأقسام الفرعية والمنتجات المسموح بها لكل عرض. التغييرات تُحفظ فوراً.
          </p>
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث باسم العرض..."
          className="pr-9"
        />
      </div>

      <Accordion type="multiple" className="space-y-2">
        {(offers || [])
          .filter((o) => !search.trim() || o.title_ar.toLowerCase().includes(search.toLowerCase()))
          .map((offer) => (
            <OfferTargetingRow
              key={offer.id}
              offer={offer}
              subCategories={subCategories || []}
              onSaved={() => {
                refetch();
                qc.invalidateQueries({ queryKey: ["admin-rf-offers"] });
              }}
            />
          ))}
        {!offers?.length && (
          <p className="text-center text-sm text-muted-foreground py-8">لا توجد عروض</p>
        )}
      </Accordion>
    </div>
  );
}

function OfferTargetingRow({
  offer,
  subCategories,
  onSaved,
}: {
  offer: Offer;
  subCategories: { id: string; name_ar: string }[];
  onSaved: () => void;
}) {
  const [categoryIds, setCategoryIds] = useState<string[]>(
    offer.category_ids?.length ? offer.category_ids : (offer.category_id ? [offer.category_id] : [])
  );
  const [allowed, setAllowed] = useState<string[]>(offer.allowed_product_ids || []);
  const [weights, setWeights] = useState<ProductWeights>(offer.product_weights || {});
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

  const { data: products } = useQuery({
    queryKey: ["rf-targeting-products", offer.id, offer.sale_type, categoryIds],
    enabled: categoryIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select(`id, name_ar, image_url, category_id, in_stock, colors, product_options(available_for_pre_order)`)
        .in("category_id", categoryIds)
        .order("name_ar")
        .limit(500);
      return (data || []) as any[];
    },
  });

  const filteredProducts = useMemo(() => {
    let list = (products || []).map((p: any) => {
      const colors = Array.isArray(p.colors) ? p.colors : [];
      let directStock = 0;
      for (const c of colors) {
        if (c?.available_for_direct_sale !== true) continue;
        const stocks = c?.option_stocks;
        if (stocks && typeof stocks === "object") {
          for (const v of Object.values(stocks)) {
            const n = Number(v) || 0;
            if (n > 0) directStock += n;
          }
        }
      }
      return { ...p, directStock };
    });
    if (offer.sale_type === "direct") {
      list = list.filter((p: any) => p.in_stock !== false && p.directStock > 0);
    }
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      list = list.filter((p: any) => (p.name_ar || "").toLowerCase().includes(q));
    }
    return list;
  }, [products, offer.sale_type, productSearch]);

  const toggleCat = (id: string) => {
    setCategoryIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };
  const toggleProduct = (id: string) => {
    setAllowed((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };
  const selectAll = () => setAllowed(filteredProducts.map((p: any) => p.id));
  const clearAll = () => setAllowed([]);

  const save = async () => {
    if (!categoryIds.length) {
      toast.error("اختر قسماً فرعياً واحداً على الأقل");
      return;
    }
    setSaving(true);
    try {
      // Drop allowed products no longer matching the categories
      const validIds = new Set((products || []).map((p: any) => p.id));
      const cleaned = allowed.filter((id) => validIds.has(id));
      // Drop weights for products no longer in the whitelist
      const cleanedWeights: ProductWeights = {};
      for (const id of cleaned) {
        if (weights[id]) cleanedWeights[id] = weights[id];
      }

      const { error } = await (supabase as any)
        .from("random_filament_offers")
        .update({
          category_ids: categoryIds,
          category_id: categoryIds[0],
          allowed_product_ids: cleaned,
          product_weights: cleanedWeights,
        })
        .eq("id", offer.id);
      if (error) throw error;
      setAllowed(cleaned);
      setWeights(cleanedWeights);
      toast.success("تم الحفظ");
      onSaved();
    } catch (e: any) {
      toast.error("فشل الحفظ: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccordionItem value={offer.id} className="glass-panel border rounded-lg">
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex items-center gap-2 flex-1 text-right">
          <Badge variant={offer.sale_type === "direct" ? "default" : "secondary"}>
            {offer.sale_type === "direct" ? "مباشر" : "مسبق"}
          </Badge>
          <span className="font-semibold flex-1 text-right">{offer.title_ar}</span>
          <Badge variant="outline" className="gap-1">
            <Layers className="size-3" /> {categoryIds.length}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Package2 className="size-3" /> {allowed.length}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 space-y-4">
        {/* Categories */}
        <div>
          <div className="text-xs font-semibold mb-2 text-muted-foreground">الأقسام الفرعية</div>
          <div className="flex flex-wrap gap-2">
            {subCategories.map((c) => {
              const on = categoryIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCat(c.id)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${
                    on
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:border-primary"
                  }`}
                >
                  {on && <Check className="inline size-3 mr-1" />} {c.name_ar}
                </button>
              );
            })}
          </div>
        </div>

        {/* Products */}
        <div>
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="text-xs font-semibold text-muted-foreground">
              المنتجات ({allowed.length} مختار من {filteredProducts.length})
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={selectAll} disabled={!filteredProducts.length}>
                تحديد الكل
              </Button>
              <Button size="sm" variant="ghost" onClick={clearAll} disabled={!allowed.length}>
                مسح
              </Button>
            </div>
          </div>
          <div className="relative mb-2">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="ابحث منتج..."
              className="pr-9 h-9 text-sm"
            />
          </div>
          {!categoryIds.length ? (
            <p className="text-xs text-muted-foreground py-4 text-center">اختر قسماً فرعياً أولاً</p>
          ) : (
            <ScrollArea className="h-64 border rounded-md">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2">
                {filteredProducts.map((p: any) => {
                  const isOn = allowed.includes(p.id);
                  const w = weights[p.id]?.weight;
                  const hasCustomWeights =
                    !!weights[p.id] &&
                    (w !== undefined ||
                      Object.keys(weights[p.id]?.colors || {}).length > 0 ||
                      Object.keys(weights[p.id]?.options || {}).length > 0);
                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleProduct(p.id)}
                      role="button"
                      tabIndex={0}
                      className={`relative rounded-md border p-2 text-right transition cursor-pointer ${
                        isOn ? "border-primary bg-primary/10" : "hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="size-10 rounded object-cover" />
                        ) : (
                          <div className="size-10 rounded bg-muted" />
                        )}
                        <span className="text-xs line-clamp-2 flex-1">{p.name_ar}</span>
                      </div>
                      {isOn && (
                        <Check className="absolute top-1 left-1 size-4 text-primary bg-background rounded-full p-0.5" />
                      )}
                      {isOn && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setEditingProduct(p); }}
                          title="إعدادات الأوزان"
                          className={`absolute bottom-1 left-1 size-6 rounded-full flex items-center justify-center transition ${
                            hasCustomWeights
                              ? "bg-primary text-primary-foreground"
                              : "bg-background/80 hover:bg-primary hover:text-primary-foreground border"
                          }`}
                        >
                          <Settings2 className="size-3.5" />
                        </button>
                      )}
                      {hasCustomWeights && w !== undefined && (
                        <Badge variant="outline" className="absolute top-1 right-1 text-[9px] px-1 py-0 gap-0.5">
                          <Sliders className="size-2.5" />×{w}
                        </Badge>
                      )}
                    </div>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <p className="col-span-full text-center text-xs text-muted-foreground py-6">
                    لا منتجات متاحة
                  </p>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="gap-2">
            <Save className="size-4" />
            {saving ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </div>
      </AccordionContent>

      <WeightEditorDialog
        product={editingProduct}
        value={editingProduct ? weights[editingProduct.id] : undefined}
        onClose={() => setEditingProduct(null)}
        onSave={(w) => {
          if (!editingProduct) return;
          setWeights((cur) => {
            const next = { ...cur };
            const isEmpty =
              w.weight === undefined &&
              !Object.keys(w.colors || {}).length &&
              !Object.keys(w.options || {}).length;
            if (isEmpty) delete next[editingProduct.id];
            else next[editingProduct.id] = w;
            return next;
          });
          setEditingProduct(null);
          toast.info("لا تنسَ الضغط على حفظ");
        }}
      />
    </AccordionItem>
  );
}

function WeightEditorDialog({
  product, value, onClose, onSave,
}: {
  product: any | null;
  value: ProductWeight | undefined;
  onClose: () => void;
  onSave: (w: ProductWeight) => void;
}) {
  const [productWeight, setProductWeight] = useState<string>("");
  const [colorWeights, setColorWeights] = useState<Record<string, string>>({});
  const [optionWeights, setOptionWeights] = useState<Record<string, string>>({});

  // Reset whenever a different product opens
  useMemo(() => {
    if (!product) return;
    setProductWeight(value?.weight !== undefined ? String(value.weight) : "");
    const cw: Record<string, string> = {};
    Object.entries(value?.colors || {}).forEach(([k, v]) => { cw[k] = String(v); });
    setColorWeights(cw);
    const ow: Record<string, string> = {};
    Object.entries(value?.options || {}).forEach(([k, v]) => { ow[k] = String(v); });
    setOptionWeights(ow);
  }, [product?.id]);

  if (!product) return null;

  const colors: any[] = Array.isArray(product.colors) ? product.colors : [];
  const directColors = colors.filter((c: any) => c?.available_for_direct_sale === true);

  // Collect option keys from all option_stocks across colors
  const optionKeys = Array.from(new Set(
    directColors.flatMap((c: any) =>
      Object.keys(c?.option_stocks || {}).filter((k) => Number((c.option_stocks || {})[k]) > 0)
    )
  ));

  const parse = (s: string): number | undefined => {
    const t = s.trim();
    if (!t) return undefined;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  const handleSave = () => {
    const out: ProductWeight = {};
    const pw = parse(productWeight);
    if (pw !== undefined) out.weight = pw;
    const cOut: Record<string, number> = {};
    Object.entries(colorWeights).forEach(([k, v]) => {
      const n = parse(v); if (n !== undefined) cOut[k] = n;
    });
    if (Object.keys(cOut).length) out.colors = cOut;
    const oOut: Record<string, number> = {};
    Object.entries(optionWeights).forEach(([k, v]) => {
      const n = parse(v); if (n !== undefined) oOut[k] = n;
    });
    if (Object.keys(oOut).length) out.options = oOut;
    onSave(out);
  };

  const reset = () => {
    setProductWeight("");
    setColorWeights({});
    setOptionWeights({});
  };

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="!overflow-hidden !max-h-none max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <Sliders className="size-5 text-primary" />
            أوزان: {product.name_ar}
          </DialogTitle>
          <DialogDescription className="text-right text-xs">
            القيمة الافتراضية = 1. ارفع الرقم لزيادة احتمال الاختيار. اتركه فارغاً للوزن الافتراضي.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1 space-y-4">
          {/* Product weight */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">وزن المنتج (في مجموعة المنتجات)</label>
            <Input
              type="number" min={0} step="0.1" inputMode="decimal"
              placeholder="1"
              value={productWeight}
              onChange={(e) => setProductWeight(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Options table */}
          {optionKeys.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">أوزان الخيارات</label>
              <div className="border rounded-md divide-y">
                {optionKeys.map((k) => (
                  <div key={k} className="flex items-center justify-between gap-2 p-2">
                    <span className="text-xs flex-1 truncate">{k}</span>
                    <Input
                      type="number" min={0} step="0.1" inputMode="decimal"
                      placeholder="1"
                      value={optionWeights[k] || ""}
                      onChange={(e) => setOptionWeights((cur) => ({ ...cur, [k]: e.target.value }))}
                      className="h-8 w-20 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Colors table */}
          {directColors.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">أوزان الألوان</label>
              <div className="border rounded-md divide-y">
                {directColors.map((c: any, i: number) => {
                  const key = c?.name_ar || c?.name || "";
                  if (!key) return null;
                  return (
                    <div key={`${key}-${i}`} className="flex items-center justify-between gap-2 p-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span
                          className="size-4 rounded-full border shrink-0"
                          style={{ background: c?.hex_code || c?.hex || c?.color || "#888" }}
                        />
                        <span className="text-xs truncate">{key}</span>
                      </div>
                      <Input
                        type="number" min={0} step="0.1" inputMode="decimal"
                        placeholder="1"
                        value={colorWeights[key] || ""}
                        onChange={(e) => setColorWeights((cur) => ({ ...cur, [key]: e.target.value }))}
                        className="h-8 w-20 text-sm"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={reset}>إعادة تعيين</Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>إلغاء</Button>
            <Button size="sm" onClick={handleSave} className="gap-1.5">
              <Save className="size-3.5" /> تطبيق
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
