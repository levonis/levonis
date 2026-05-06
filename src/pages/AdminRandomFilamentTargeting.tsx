import { useEffect, useMemo, useRef, useState } from "react";
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
import { Search, Save, Check, Package2, Layers, Sliders, Info, ChevronDown, RotateCcw } from "lucide-react";

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
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            <h1 className="text-lg font-bold">إدارة استهداف العروض العشوائية</h1>
          </div>

          {/* شرح الخوارزمية */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-primary">
              <Info className="size-3.5" /> كيف يعمل النظام؟
            </div>
            <div className="text-muted-foreground">
              يختار النظام عشوائياً بهذا الترتيب:
              <span className="mx-1 px-1.5 py-0.5 rounded bg-primary/20 text-primary font-semibold">١. المنتج</span>
              ←
              <span className="mx-1 px-1.5 py-0.5 rounded bg-primary/20 text-primary font-semibold">٢. الخيار</span>
              ←
              <span className="mx-1 px-1.5 py-0.5 rounded bg-primary/20 text-primary font-semibold">٣. اللون</span>
            </div>
            <div className="text-muted-foreground">
              <b>الوزن</b> = احتمال الظهور النسبي. القيمة الافتراضية <b>1</b>.
              منتج بوزن <b>3</b> ظهوره أكثر بـ 3 أضعاف من منتج بوزن <b>1</b>.
              ضع <b>0</b> لاستبعاد العنصر تماماً، أو اتركه فارغاً للافتراضي.
            </div>
            <div className="text-muted-foreground">
              💡 يمكنك ضبط الوزن لكل منتج، ولكل خيار/لون داخله. التغييرات <b>تُحفظ تلقائياً</b>.
            </div>
          </div>
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
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  const { data: products } = useQuery({
    queryKey: ["rf-targeting-products", offer.id, offer.sale_type, categoryIds],
    enabled: categoryIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("products_admin")
        .select(`id, name_ar, image_url, category_id, in_stock, colors, product_options(id, name_ar, name, available_for_pre_order, available_for_direct_sale, in_stock, stock_quantity)`)
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
    // ترتيب: الأكثر اختياراً أولاً (المنتجات داخل allowed بأعلى أوزان)
    list.sort((a: any, b: any) => {
      const aIn = allowed.includes(a.id) ? 1 : 0;
      const bIn = allowed.includes(b.id) ? 1 : 0;
      if (aIn !== bIn) return bIn - aIn;
      const aw = weights[a.id]?.weight ?? (aIn ? 1 : 0);
      const bw = weights[b.id]?.weight ?? (bIn ? 1 : 0);
      return bw - aw;
    });
    return list;
  }, [products, offer.sale_type, productSearch, allowed, weights]);

  const toggleCat = (id: string) => {
    setCategoryIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };
  const toggleProduct = (id: string) => {
    setAllowed((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };
  const selectAll = () => setAllowed(filteredProducts.map((p: any) => p.id));
  const clearAll = () => setAllowed([]);

  // حفظ يدوي (للأقسام والمنتجات المختارة)
  const save = async (silent = false) => {
    if (!categoryIds.length) {
      if (!silent) toast.error("اختر قسماً فرعياً واحداً على الأقل");
      return;
    }
    setSaving(true);
    try {
      const validIds = new Set((products || []).map((p: any) => p.id));
      const cleaned = allowed.filter((id) => validIds.has(id));
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
      if (!silent) toast.success("تم الحفظ");
      onSaved();
    } catch (e: any) {
      if (!silent) toast.error("فشل الحفظ: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  // حفظ تلقائي للأوزان (debounced)
  const autoSaveTimer = useRef<any>(null);
  const updateWeight = (productId: string, updater: (cur: ProductWeight) => ProductWeight) => {
    setWeights((curMap) => {
      const cur = curMap[productId] || {};
      const next = updater(cur);
      const isEmpty =
        next.weight === undefined &&
        !Object.keys(next.colors || {}).length &&
        !Object.keys(next.options || {}).length;
      const newMap = { ...curMap };
      if (isEmpty) delete newMap[productId];
      else newMap[productId] = next;

      // debounce save
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(async () => {
        try {
          const { error } = await (supabase as any)
            .from("random_filament_offers")
            .update({ product_weights: newMap })
            .eq("id", offer.id);
          if (error) throw error;
          toast.success("تم حفظ الوزن", { duration: 1200 });
        } catch (e: any) {
          toast.error("فشل الحفظ التلقائي");
        }
      }, 700);

      return newMap;
    });
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
              المنتجات ({allowed.length} مختار من {filteredProducts.length}) — مرتبة حسب الأكثر ظهوراً
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
            <ScrollArea className="h-[28rem] border rounded-md">
              <div className="flex flex-col gap-1.5 p-2">
                {filteredProducts.map((p: any) => {
                  const isOn = allowed.includes(p.id);
                  const isExpanded = expandedProductId === p.id;
                  const pw = weights[p.id];
                  const w = pw?.weight;
                  return (
                    <ProductRow
                      key={p.id}
                      product={p}
                      isOn={isOn}
                      isExpanded={isExpanded}
                      saleType={offer.sale_type}
                      productWeightValue={w}
                      colorWeights={pw?.colors || {}}
                      optionWeights={pw?.options || {}}
                      onToggle={() => {
                        toggleProduct(p.id);
                        if (!isOn) setExpandedProductId(p.id);
                      }}
                      onExpandToggle={() =>
                        setExpandedProductId((cur) => (cur === p.id ? null : p.id))
                      }
                      onProductWeight={(v) => updateWeight(p.id, (c) => ({ ...c, weight: v }))}
                      onColorWeight={(key, v) =>
                        updateWeight(p.id, (c) => {
                          const colors = { ...(c.colors || {}) };
                          if (v === undefined) delete colors[key];
                          else colors[key] = v;
                          return { ...c, colors };
                        })
                      }
                      onOptionWeight={(key, v) =>
                        updateWeight(p.id, (c) => {
                          const options = { ...(c.options || {}) };
                          if (v === undefined) delete options[key];
                          else options[key] = v;
                          return { ...c, options };
                        })
                      }
                      onResetAll={() =>
                        setWeights((cur) => {
                          const next = { ...cur };
                          delete next[p.id];
                          // persist
                          if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
                          autoSaveTimer.current = setTimeout(async () => {
                            await (supabase as any)
                              .from("random_filament_offers")
                              .update({ product_weights: next })
                              .eq("id", offer.id);
                            toast.success("تمت إعادة التعيين", { duration: 1200 });
                          }, 300);
                          return next;
                        })
                      }
                    />
                  );
                })}
                {filteredProducts.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-6">
                    لا منتجات متاحة
                  </p>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={() => save(false)} disabled={saving} className="gap-2">
            <Save className="size-4" />
            {saving ? "جاري الحفظ..." : "حفظ الأقسام والمنتجات"}
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function ProductRow({
  product, isOn, isExpanded, saleType,
  productWeightValue, colorWeights, optionWeights,
  onToggle, onExpandToggle,
  onProductWeight, onColorWeight, onOptionWeight, onResetAll,
}: {
  product: any;
  isOn: boolean;
  isExpanded: boolean;
  saleType: SaleType;
  productWeightValue: number | undefined;
  colorWeights: Record<string, number>;
  optionWeights: Record<string, number>;
  onToggle: () => void;
  onExpandToggle: () => void;
  onProductWeight: (v: number | undefined) => void;
  onColorWeight: (key: string, v: number | undefined) => void;
  onOptionWeight: (key: string, v: number | undefined) => void;
  onResetAll: () => void;
}) {
  const colors: any[] = Array.isArray(product.colors) ? product.colors : [];
  const eligibleColors = colors.filter((c: any) =>
    saleType === "direct"
      ? c?.available_for_direct_sale === true &&
        Object.values(c?.option_stocks || {}).some((v: any) => Number(v) > 0)
      : c?.available_for_pre_order !== false
  );

  // الخيارات لكل لون
  const options: any[] = Array.isArray(product.product_options) ? product.product_options : [];
  let optionKeys: string[] = [];
  if (saleType === "direct") {
    optionKeys = Array.from(new Set(
      eligibleColors.flatMap((c: any) =>
        Object.keys(c?.option_stocks || {}).filter((k) => Number((c.option_stocks || {})[k]) > 0)
      )
    ));
  } else {
    optionKeys = options
      .filter((o: any) => o?.available_for_pre_order !== false)
      .map((o: any) => o?.name_ar || o?.name)
      .filter(Boolean);
  }

  const hasCustom =
    productWeightValue !== undefined ||
    Object.keys(colorWeights).length > 0 ||
    Object.keys(optionWeights).length > 0;

  return (
    <div
      className={`rounded-lg border transition-all ${
        isOn ? "border-primary bg-primary/5" : "hover:border-primary/40"
      }`}
    >
      {/* الصف الرئيسي */}
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={onToggle}
          className={`size-5 rounded border flex items-center justify-center shrink-0 transition ${
            isOn ? "bg-primary border-primary text-primary-foreground" : "bg-background"
          }`}
          aria-label={isOn ? "إلغاء التحديد" : "تحديد"}
        >
          {isOn && <Check className="size-3.5" />}
        </button>

        {product.image_url ? (
          <img src={product.image_url} alt="" className="size-10 rounded object-cover shrink-0" />
        ) : (
          <div className="size-10 rounded bg-muted shrink-0" />
        )}

        <div className="flex-1 min-w-0 cursor-pointer" onClick={isOn ? onExpandToggle : onToggle}>
          <div className="text-sm font-medium truncate">{product.name_ar}</div>
          {isOn && (
            <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-0.5">
                <Sliders className="size-2.5" />
                وزن المنتج: <b className={productWeightValue !== undefined ? "text-primary" : ""}>
                  {productWeightValue ?? "1 (افتراضي)"}
                </b>
              </span>
              {Object.keys(colorWeights).length > 0 && (
                <span>· ألوان مخصصة: {Object.keys(colorWeights).length}</span>
              )}
              {Object.keys(optionWeights).length > 0 && (
                <span>· خيارات مخصصة: {Object.keys(optionWeights).length}</span>
              )}
            </div>
          )}
        </div>

        {isOn && (
          <button
            type="button"
            onClick={onExpandToggle}
            className="size-7 rounded-md hover:bg-primary/10 flex items-center justify-center shrink-0"
            aria-label={isExpanded ? "طيّ" : "توسيع"}
          >
            <ChevronDown className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {/* محرر الأوزان (يتمدد) */}
      {isOn && isExpanded && (
        <div className="border-t bg-background/40 p-3 space-y-3 animate-glass-expand">
          {/* وزن المنتج */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold flex-1 flex items-center gap-1.5">
              <Sliders className="size-3.5 text-primary" />
              وزن المنتج (في مجموعة المنتجات)
            </label>
            <WeightInput
              value={productWeightValue}
              onChange={onProductWeight}
            />
          </div>

          {/* الخيارات */}
          {optionKeys.length > 0 && (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-muted-foreground">
                ٢. الخيارات (أوزان داخلية)
              </div>
              <div className="border rounded-md divide-y bg-card/40">
                {optionKeys.map((k) => (
                  <div key={k} className="flex items-center justify-between gap-2 p-2">
                    <span className="text-xs flex-1 truncate">{k}</span>
                    <div className="flex items-center gap-1.5">
                      {optionWeights[k] !== undefined && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                          ×{optionWeights[k]}
                        </Badge>
                      )}
                      <WeightInput
                        value={optionWeights[k]}
                        onChange={(v) => onOptionWeight(k, v)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* الألوان */}
          {eligibleColors.length > 0 && (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-muted-foreground">
                ٣. الألوان (أوزان داخلية)
              </div>
              <div className="border rounded-md divide-y bg-card/40">
                {eligibleColors.map((c: any, i: number) => {
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
                      <div className="flex items-center gap-1.5">
                        {colorWeights[key] !== undefined && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                            ×{colorWeights[key]}
                          </Badge>
                        )}
                        <WeightInput
                          value={colorWeights[key]}
                          onChange={(v) => onColorWeight(key, v)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {hasCustom && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={onResetAll} className="h-7 text-xs gap-1">
                <RotateCcw className="size-3" /> إعادة تعيين أوزان هذا المنتج
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** حقل وزن: يكتب القيمة كـ string، يحفظ تلقائياً عند البلور أو بعد توقف الكتابة */
function WeightInput({
  value, onChange,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  const [text, setText] = useState<string>(value !== undefined ? String(value) : "");

  // مزامنة لو تغيّرت القيمة من خارج (مثل reset)
  useEffect(() => {
    setText(value !== undefined ? String(value) : "");
  }, [value]);

  const commit = (raw: string) => {
    const t = raw.trim();
    if (!t) {
      onChange(undefined);
      return;
    }
    const n = Number(t);
    if (Number.isFinite(n) && n >= 0) onChange(n);
  };

  return (
    <Input
      type="number"
      min={0}
      step="0.1"
      inputMode="decimal"
      placeholder="1"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        commit(e.target.value);
      }}
      onBlur={(e) => commit(e.target.value)}
      className="h-7 w-16 text-xs text-center"
    />
  );
}
