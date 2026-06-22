import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/utils";
import { useShippingSettings } from "@/hooks/useShippingCalculator";

type Currency = "USD" | "CNY" | "IQD";

const normalizeNumberInput = (value: string): string => {
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  return value
    .replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(persianDigits.indexOf(d)))
    .replace(/[٬,\s]/g, "")
    .replace(/٫/g, ".");
};

const parseNumberInput = (value: string): number | null => {
  const cleaned = normalizeNumberInput(value);
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

interface OptionRow {
  id: string;
  name_ar: string;
  name?: string | null;
  /** canonical USD value from product_options.price_adjustment */
  cost_usd: number | null;
  /** input in the currently selected currency */
  input: string;
}

interface ColorRow {
  /** index inside products.colors JSON */
  idx: number;
  name_ar?: string | null;
  name?: string | null;
  /** canonical USD from colors[].cost_usd */
  cost_usd: number | null;
  input: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any | null;
  onSaved?: () => void;
}

export default function QuickCostEditDialog({ open, onOpenChange, product, onSaved }: Props) {
  const { data: shippingSettings } = useShippingSettings();
  const usdToIqd = shippingSettings?.usd_to_iqd_rate || 1410;
  const cnyToUsd = shippingSettings?.cny_to_usd_rate || 6.7;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [productCostUsd, setProductCostUsd] = useState<number | null>(null);
  const [productInput, setProductInput] = useState<string>("");
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [colors, setColors] = useState<ColorRow[]>([]);
  const [rawColors, setRawColors] = useState<any[]>([]);

  // Convert input value (in `cur`) → canonical USD
  const toUsd = (val: number, cur: Currency): number => {
    if (cur === "USD") return Math.round(val * 100) / 100;
    if (cur === "IQD") return Math.round((val / usdToIqd) * 100) / 100;
    // CNY → USD
    return Math.round((val / cnyToUsd) * 100) / 100;
  };
  // Convert canonical USD → display value in `cur`
  const fromUsd = (usd: number, cur: Currency): number => {
    if (cur === "USD") return Math.round(usd * 100) / 100;
    if (cur === "IQD") return Math.round(usd * usdToIqd);
    return Math.round(usd * cnyToUsd * 100) / 100;
  };

  useEffect(() => {
    if (!open || !product?.id) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const { data: productRow, error: productError } = await (supabase as any)
          .from("products_admin")
          .select("original_price_usd, colors")
          .eq("id", product.id)
          .single();
        if (productError) throw productError;

        const opu = Number(productRow?.original_price_usd);
        const baseUsd: number | null = Number.isFinite(opu) && opu > 0 ? Math.round(opu * 100) / 100 : null;
        if (!cancel) setProductCostUsd(baseUsd);

        const rawCols = Array.isArray(productRow?.colors) ? productRow.colors : [];
        if (!cancel) {
          setRawColors(rawCols);
          setColors(
            rawCols.map((c: any, idx: number) => {
              const usd = Number(c?.cost_usd);
              return {
                idx,
                name_ar: c?.name_ar,
                name: c?.name,
                cost_usd: Number.isFinite(usd) && usd > 0 ? Math.round(usd * 100) / 100 : null,
                input: "",
              };
            }),
          );
        }

        const { data, error } = await (supabase as any)
          .from("product_options")
          .select("id, name_ar, name, price_adjustment")
          .eq("product_id", product.id)
          .order("name_ar");
        if (error) throw error;
        if (!cancel) {
          setOptions(
            (data || []).map((o: any) => {
              const pa = Number(o.price_adjustment);
              return {
                id: o.id,
                name_ar: o.name_ar,
                name: o.name,
                cost_usd: Number.isFinite(pa) && pa > 0 ? Math.round(pa * 100) / 100 : null,
                input: "",
              };
            }),
          );
        }
      } catch (e: any) {
        toast({ title: "خطأ", description: e.message ?? "تعذر تحميل البيانات", variant: "destructive" });
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [open, product?.id]);

  // Re-derive input strings when currency or canonical USD values change
  useEffect(() => {
    setProductInput(productCostUsd != null && productCostUsd > 0 ? String(fromUsd(productCostUsd, currency)) : "");
    setOptions((prev) =>
      prev.map((o) => ({
        ...o,
        input: o.cost_usd != null && o.cost_usd > 0 ? String(fromUsd(o.cost_usd, currency)) : "",
      })),
    );
    setColors((prev) =>
      prev.map((c) => ({
        ...c,
        input: c.cost_usd != null && c.cost_usd > 0 ? String(fromUsd(c.cost_usd, currency)) : "",
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, productCostUsd, usdToIqd, cnyToUsd]);

  const previewIqd = useMemo(() => {
    const v = parseNumberInput(productInput);
    if (v == null) return null;
    const usd = toUsd(v, currency);
    return Math.round(usd * usdToIqd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productInput, currency, usdToIqd, cnyToUsd]);

  const handleSave = async () => {
    if (!product?.id) return;
    setSaving(true);
    try {
      const parsedProductCost = parseNumberInput(productInput);
      const productUsdToSave = parsedProductCost == null ? null : toUsd(parsedProductCost, currency);
      const productCostIqdToSave = productUsdToSave == null ? null : Math.round(productUsdToSave * usdToIqd);

      // Save product cost via RPC (writes original_price_usd + cost_price IQD)
      const { data: savedRows, error } = await (supabase as any).rpc("admin_quick_update_costs", {
        _product_id: product.id,
        _product_cost: productCostIqdToSave,
        _options: [], // options handled below via direct update on price_adjustment
        _original_price_usd: productUsdToSave,
      });
      if (error) throw error;

      const savedProduct = Array.isArray(savedRows) ? savedRows[0] : savedRows;
      if (!savedProduct) throw new Error("لم يتم تحديث تكلفة المنتج");

      const savedUsd = savedProduct.original_price_usd == null ? null : Math.round(Number(savedProduct.original_price_usd) * 100) / 100;
      const expectedUsd = productUsdToSave == null ? null : Math.round(productUsdToSave * 100) / 100;
      if (savedUsd !== expectedUsd) {
        throw new Error("لم تتطابق قيمة سعر تكلفة المنتج ($) المحفوظة مع المدخلة");
      }
      setProductCostUsd(savedUsd);

      // Update each option's price_adjustment (USD) — matches the product edit form's "تكلفة مستقلة للخيار ($)"
      for (const opt of options) {
        const parsed = parseNumberInput(opt.input);
        const usd = parsed == null ? 0 : toUsd(parsed, currency);
        const { error: optErr } = await (supabase as any)
          .from("product_options")
          .update({ price_adjustment: usd })
          .eq("id", opt.id);
        if (optErr) throw optErr;
      }

      // Update colors JSON in-place — write cost_usd as canonical + sync cost_iqd
      if (colors.length > 0 && rawColors.length > 0) {
        const updated = rawColors.map((c: any, idx: number) => {
          const row = colors.find((cc) => cc.idx === idx);
          if (!row) return c;
          if (row.input === "") {
            return { ...c, cost_iqd: null, cost_usd: null };
          }
          const parsed = parseNumberInput(row.input);
          if (parsed == null) return { ...c, cost_iqd: null, cost_usd: null };
          const usd = toUsd(parsed, currency);
          const iqd = Math.round(usd * usdToIqd);
          return { ...c, cost_iqd: iqd, cost_usd: usd };
        });
        const { error: colorErr } = await (supabase as any)
          .from("products")
          .update({ colors: updated })
          .eq("id", product.id);
        if (colorErr) throw colorErr;
      }

      toast({ title: "تم الحفظ", description: "تم تحديث التكاليف" });
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "فشل الحفظ", description: e.message ?? "تعذر الحفظ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const currencyLabel = currency === "USD" ? "$" : currency === "CNY" ? "¥" : "د.ع";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            تحديث التكلفة السريع
          </DialogTitle>
          <DialogDescription className="text-xs">
            {product?.name_ar} — نفس حقول USD في تعديل المنتج. يمكن الإدخال بأي عملة ويُحفظ كـ USD.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium">العملة:</span>
              <div className="flex gap-1">
                {(["USD", "CNY", "IQD"] as Currency[]).map((c) => (
                  <Button
                    key={c}
                    type="button"
                    size="sm"
                    variant={currency === c ? "default" : "outline"}
                    className="h-7 px-3 text-xs"
                    onClick={() => setCurrency(c)}
                  >
                    {c === "USD" ? "$ USD" : c === "CNY" ? "¥ CNY" : "د.ع IQD"}
                  </Button>
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground mr-auto">
                1$={usdToIqd} د.ع · 1$={cnyToUsd}¥
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">سعر تكلفة المنتج ({currencyLabel})</label>
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                value={productInput}
                onChange={(e) => setProductInput(e.target.value)}
                placeholder="اتركه فارغاً"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                {previewIqd != null && currency !== "IQD" ? <span>≈ {formatPrice(previewIqd)} د.ع</span> : <span />}
                {product?.price != null && (
                  <span>سعر البيع: {formatPrice(Number(product.price))} د.ع</span>
                )}
              </div>
            </div>

            {options.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold">تكلفة مستقلة للخيار ({currencyLabel})</h4>
                <div className="max-h-[28vh] overflow-y-auto space-y-1.5 pr-1">
                  {options.map((opt, idx) => {
                    const parsed = parseNumberInput(opt.input);
                    const usd = parsed != null ? toUsd(parsed, currency) : null;
                    const iqdPreview = usd != null ? Math.round(usd * usdToIqd) : null;
                    return (
                      <div key={opt.id} className="flex items-center gap-2">
                        <span className="text-xs flex-1 truncate">{opt.name_ar || opt.name}</span>
                        <div className="flex flex-col items-end">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            className="w-28 h-8 text-xs"
                            value={opt.input}
                            placeholder="فارغ"
                            onChange={(e) => {
                              const v = e.target.value;
                              setOptions((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], input: v };
                                return next;
                              });
                            }}
                          />
                          {iqdPreview != null && currency !== "IQD" && (
                            <span className="text-[10px] text-muted-foreground">≈ {formatPrice(iqdPreview)} د.ع</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {colors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold">تكلفة اللون ({currencyLabel})</h4>
                <div className="max-h-[28vh] overflow-y-auto space-y-1.5 pr-1">
                  {colors.map((col, idx) => {
                    const parsed = parseNumberInput(col.input);
                    const usd = parsed != null ? toUsd(parsed, currency) : null;
                    const iqdPreview = usd != null ? Math.round(usd * usdToIqd) : null;
                    return (
                      <div key={col.idx} className="flex items-center gap-2">
                        <span className="text-xs flex-1 truncate">{col.name_ar || col.name || `لون ${col.idx + 1}`}</span>
                        <div className="flex flex-col items-end">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            className="w-28 h-8 text-xs"
                            value={col.input}
                            placeholder="فارغ"
                            onChange={(e) => {
                              const v = e.target.value;
                              setColors((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], input: v };
                                return next;
                              });
                            }}
                          />
                          {iqdPreview != null && currency !== "IQD" && (
                            <span className="text-[10px] text-muted-foreground">≈ {formatPrice(iqdPreview)} د.ع</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>إلغاء</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                حفظ
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
