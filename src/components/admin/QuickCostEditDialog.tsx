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

interface OptionRow {
  id: string;
  name_ar: string;
  name?: string | null;
  /** canonical IQD value (cost_iqd → fallback price_adjustment) */
  cost_iqd: number | null;
  /** input in the currently selected currency */
  input: string;
}

interface ColorRow {
  /** index inside products.colors JSON */
  idx: number;
  name_ar?: string | null;
  name?: string | null;
  cost_iqd: number | null;
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
  const [productCostIqd, setProductCostIqd] = useState<number | null>(null);
  const [productInput, setProductInput] = useState<string>("");
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [colors, setColors] = useState<ColorRow[]>([]);
  const [rawColors, setRawColors] = useState<any[]>([]);

  const toIqd = (val: number, cur: Currency): number => {
    if (cur === "IQD") return Math.round(val);
    if (cur === "USD") return Math.round(val * usdToIqd);
    return Math.round((val / cnyToUsd) * usdToIqd);
  };
  const fromIqd = (iqd: number, cur: Currency): number => {
    if (cur === "IQD") return Math.round(iqd);
    if (cur === "USD") return Math.round((iqd / usdToIqd) * 100) / 100;
    return Math.round((iqd / usdToIqd) * cnyToUsd * 100) / 100;
  };

  useEffect(() => {
    if (!open || !product?.id) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const { data: productRow, error: productError } = await (supabase as any)
          .from("products_admin")
          .select("cost_price, original_price_usd, colors")
          .eq("id", product.id)
          .single();
        if (productError) throw productError;

        const cp = Number(productRow?.cost_price);
        const opu = Number(productRow?.original_price_usd);
        let baseIqd: number | null = null;
        if (Number.isFinite(cp) && cp > 0) {
          baseIqd = Math.round(cp);
        } else if (Number.isFinite(opu) && opu > 0) {
          baseIqd = Math.round(opu * usdToIqd);
        }
        if (!cancel) setProductCostIqd(baseIqd);


        const rawCols = Array.isArray(productRow?.colors) ? productRow.colors : [];
        if (!cancel) {
          setRawColors(rawCols);
          setColors(
            rawCols.map((c: any, idx: number) => {
              const iqd = Number(c?.cost_iqd);
              const usd = Number(c?.cost_usd);
              const canonical = Number.isFinite(iqd) && iqd > 0
                ? Math.round(iqd)
                : (Number.isFinite(usd) && usd > 0 ? Math.round(usd * usdToIqd) : null);
              return {
                idx,
                name_ar: c?.name_ar,
                name: c?.name,
                cost_iqd: canonical,
                input: "",
              };
            }),
          );
        }

        const { data, error } = await (supabase as any)
          .from("product_options")
          .select("id, name_ar, name, price_adjustment, cost_iqd")
          .eq("product_id", product.id)
          .order("name_ar");
        if (error) throw error;
        if (!cancel) {
          setOptions(
            (data || []).map((o: any) => {
              const ci = Number(o.cost_iqd);
              const pa = Number(o.price_adjustment);
              const canonical = Number.isFinite(ci) && ci > 0
                ? Math.round(ci)
                : (Number.isFinite(pa) && pa > 0 ? Math.round(pa) : null);
              return {
                id: o.id,
                name_ar: o.name_ar,
                name: o.name,
                cost_iqd: canonical,
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

  // Re-derive input strings when currency or canonical IQD values change
  useEffect(() => {
    setProductInput(productCostIqd != null && productCostIqd > 0 ? String(fromIqd(productCostIqd, currency)) : "");
    setOptions((prev) =>
      prev.map((o) => ({
        ...o,
        input: o.cost_iqd != null && o.cost_iqd > 0 ? String(fromIqd(o.cost_iqd, currency)) : "",
      })),
    );
    setColors((prev) =>
      prev.map((c) => ({
        ...c,
        input: c.cost_iqd != null && c.cost_iqd > 0 ? String(fromIqd(c.cost_iqd, currency)) : "",
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, productCostIqd, usdToIqd, cnyToUsd]);

  const previewIqd = useMemo(() => {
    const v = parseFloat(productInput);
    return Number.isFinite(v) && v > 0 ? toIqd(v, currency) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productInput, currency, usdToIqd, cnyToUsd]);

  const handleSave = async () => {
    if (!product?.id) return;
    setSaving(true);
    try {
      const productCostIqdToSave =
        productInput === "" ? null : toIqd(parseFloat(productInput) || 0, currency);
      const productUsdToSave =
        productCostIqdToSave == null
          ? null
          : Math.round((productCostIqdToSave / usdToIqd) * 100) / 100;
      const payloadOptions = options.map((o) => ({
        id: o.id,
        cost: o.input === "" ? null : toIqd(parseFloat(o.input) || 0, currency),
      }));
      const { data: savedRows, error } = await (supabase as any).rpc("admin_quick_update_costs", {
        _product_id: product.id,
        _product_cost: productCostIqdToSave,
        _options: payloadOptions,
        _original_price_usd: productUsdToSave,
      });
      if (error) throw error;

      const savedProduct = Array.isArray(savedRows) ? savedRows[0] : savedRows;
      if (!savedProduct) throw new Error("لم يتم تحديث تكلفة المنتج");

      const savedCost = savedProduct.cost_price == null ? null : Math.round(Number(savedProduct.cost_price));
      const savedUsd = savedProduct.original_price_usd == null ? null : Number(savedProduct.original_price_usd);
      const expectedUsd = productUsdToSave == null ? null : Math.round(productUsdToSave * 100) / 100;
      if (savedCost !== productCostIqdToSave || (savedUsd == null ? null : Math.round(savedUsd * 100) / 100) !== expectedUsd) {
        throw new Error("لم تتطابق القيم المحفوظة مع المدخلة");
      }
      setProductCostIqd(savedCost);


      // Update colors JSON in-place (preserves all other fields per color)
      if (colors.length > 0 && rawColors.length > 0) {
        const updated = rawColors.map((c: any, idx: number) => {
          const row = colors.find((cc) => cc.idx === idx);
          if (!row) return c;
          if (row.input === "") {
            return { ...c, cost_iqd: null, cost_usd: null };
          }
          const iqd = toIqd(parseFloat(row.input) || 0, currency);
          const usd = Math.round((iqd / usdToIqd) * 100) / 100;
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
            {product?.name_ar} — أدخل بأي عملة وسيُحفظ بالدينار تلقائياً.
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
              <label className="text-xs font-medium">تكلفة المنتج الأساسي ({currencyLabel})</label>
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                value={productInput}
                onChange={(e) => setProductInput(e.target.value)}
                placeholder="اتركه فارغاً"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                {previewIqd != null ? <span>≈ {formatPrice(previewIqd)} د.ع</span> : <span />}
                {product?.price != null && (
                  <span>سعر البيع: {formatPrice(Number(product.price))} د.ع</span>
                )}
              </div>
            </div>

            {options.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold">تكلفة الخيارات ({currencyLabel})</h4>
                <div className="max-h-[28vh] overflow-y-auto space-y-1.5 pr-1">
                  {options.map((opt, idx) => {
                    const iqdPreview = opt.input !== "" && Number.isFinite(parseFloat(opt.input)) && parseFloat(opt.input) > 0
                      ? toIqd(parseFloat(opt.input), currency) : null;
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
                <h4 className="text-xs font-semibold">تكلفة الألوان ({currencyLabel})</h4>
                <div className="max-h-[28vh] overflow-y-auto space-y-1.5 pr-1">
                  {colors.map((col, idx) => {
                    const iqdPreview = col.input !== "" && Number.isFinite(parseFloat(col.input)) && parseFloat(col.input) > 0
                      ? toIqd(parseFloat(col.input), currency) : null;
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
