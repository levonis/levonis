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
  /** stored value in IQD (or null = use base) */
  price_adjustment_iqd: number | null;
  /** what the user is currently typing, in the selected currency */
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
  /** product cost stored as IQD (canonical) */
  const [productCostIqd, setProductCostIqd] = useState<number | null>(null);
  /** user input string in current currency */
  const [productInput, setProductInput] = useState<string>("");
  const [options, setOptions] = useState<OptionRow[]>([]);

  // Conversion helpers
  const toIqd = (val: number, cur: Currency): number => {
    if (cur === "IQD") return Math.round(val);
    if (cur === "USD") return Math.round(val * usdToIqd);
    // CNY -> USD -> IQD
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
          .select("cost_price, original_price_usd")
          .eq("id", product.id)
          .single();
        if (productError) throw productError;

        // Prefer original_price_usd × rate; fall back to cost_price
        let baseIqd: number | null = null;
        const opu = Number(productRow?.original_price_usd);
        if (opu > 0) baseIqd = Math.round(opu * usdToIqd);
        else if (productRow?.cost_price != null && Number(productRow.cost_price) > 0) {
          baseIqd = Math.round(Number(productRow.cost_price));
        }
        if (!cancel) setProductCostIqd(baseIqd);

        const { data, error } = await (supabase as any)
          .from("product_options")
          .select("id, name_ar, name, price_adjustment")
          .eq("product_id", product.id)
          .order("name_ar");
        if (error) throw error;
        if (!cancel) {
          setOptions(
            (data || []).map((o: any) => ({
              id: o.id,
              name_ar: o.name_ar,
              name: o.name,
              price_adjustment_iqd:
                o.price_adjustment != null && Number(o.price_adjustment) > 0
                  ? Number(o.price_adjustment)
                  : null,
              input: "",
            })),
          );
        }
      } catch (e: any) {
        toast({ title: "خطأ", description: e.message ?? "تعذر تحميل الخيارات", variant: "destructive" });
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
        input: o.price_adjustment_iqd != null && o.price_adjustment_iqd > 0
          ? String(fromIqd(o.price_adjustment_iqd, currency))
          : "",
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
      const payloadOptions = options.map((o) => ({
        id: o.id,
        cost: o.input === "" ? null : toIqd(parseFloat(o.input) || 0, currency),
      }));
      const { error } = await (supabase as any).rpc("admin_quick_update_costs", {
        _product_id: product.id,
        _product_cost: productCostIqdToSave,
        _options: payloadOptions,
      });
      if (error) throw error;

      // Also persist original_price_usd so it matches the new cost source
      if (productCostIqdToSave != null) {
        const usdVal = Math.round((productCostIqdToSave / usdToIqd) * 100) / 100;
        await (supabase as any)
          .from("products")
          .update({ original_price_usd: usdVal })
          .eq("id", product.id);
      }

      toast({ title: "تم الحفظ", description: "تم تحديث تكلفة المنتج والخيارات" });
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
            {/* Currency selector */}
            <div className="flex items-center gap-2">
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
                placeholder={currency === "IQD" ? "0" : "0.00"}
              />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                {previewIqd != null ? (
                  <span>≈ {formatPrice(previewIqd)} د.ع</span>
                ) : <span />}
                {product?.price != null && (
                  <span>سعر البيع: {formatPrice(Number(product.price))} د.ع</span>
                )}
              </div>
            </div>

            {options.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold">الخيارات / الألوان ({currencyLabel})</h4>
                <div className="max-h-[40vh] overflow-y-auto space-y-1.5 pr-1">
                  {options.map((opt, idx) => {
                    const iqdPreview =
                      opt.input !== "" && Number.isFinite(parseFloat(opt.input)) && parseFloat(opt.input) > 0
                        ? toIqd(parseFloat(opt.input), currency)
                        : null;
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
                            placeholder="اتركه فارغًا"
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

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>إلغاء</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                حفظ وتحديث السعر
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
