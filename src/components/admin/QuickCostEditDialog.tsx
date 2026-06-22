import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/utils";

interface OptionRow {
  id: string;
  name_ar: string;
  name?: string | null;
  price_adjustment: number | null;
  cost_iqd?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any | null;
  onSaved?: () => void;
}

export default function QuickCostEditDialog({ open, onOpenChange, product, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productCost, setProductCost] = useState<string>("");
  const [options, setOptions] = useState<OptionRow[]>([]);

  useEffect(() => {
    if (!open || !product?.id) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const { data: productRow, error: productError } = await (supabase as any)
          .from("products_admin")
          .select("cost_price")
          .eq("id", product.id)
          .single();
        if (productError) throw productError;
        setProductCost(productRow?.cost_price != null ? String(productRow.cost_price) : "");
        const { data, error } = await (supabase as any)
          .from("product_options")
          .select("id, name_ar, name, price_adjustment, cost_iqd")
          .eq("product_id", product.id)
          .order("name_ar");
        if (error) throw error;
        if (!cancel) setOptions(data || []);
      } catch (e: any) {
        toast({ title: "خطأ", description: e.message ?? "تعذر تحميل الخيارات", variant: "destructive" });
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [open, product?.id, product?.cost_price]);

  const handleSave = async () => {
    if (!product?.id) return;
    setSaving(true);
    try {
      const payloadOptions = options.map((o) => ({
        id: o.id,
        cost: o.price_adjustment === null || o.price_adjustment === undefined || (o.price_adjustment as any) === ""
          ? null
          : Number(o.price_adjustment),
      }));
      const productCostNum = productCost === "" ? null : Number(productCost);
      const { error } = await (supabase as any).rpc("admin_quick_update_costs", {
        _product_id: product.id,
        _product_cost: productCostNum,
        _options: payloadOptions,
      });
      if (error) throw error;
      toast({ title: "تم الحفظ", description: "تم تحديث تكلفة المنتج والخيارات" });
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "فشل الحفظ", description: e.message ?? "تعذر الحفظ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            تحديث التكلفة السريع
          </DialogTitle>
          <DialogDescription className="text-xs">
            {product?.name_ar} — التكلفة = سعر بيع الخيار. اتركه فارغًا لاستخدام السعر الأساسي.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">تكلفة المنتج الأساسي (د.ع)</label>
              <Input
                type="number"
                inputMode="numeric"
                value={productCost}
                onChange={(e) => setProductCost(e.target.value)}
                placeholder="0"
              />
              {product?.price != null && (
                <p className="text-[11px] text-muted-foreground">سعر البيع الحالي: {formatPrice(Number(product.price))} د.ع</p>
              )}
            </div>

            {options.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold">الخيارات / الألوان</h4>
                <div className="max-h-[40vh] overflow-y-auto space-y-1.5 pr-1">
                  {options.map((opt, idx) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <span className="text-xs flex-1 truncate">{opt.name_ar || opt.name}</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        className="w-32 h-8 text-xs"
                        value={opt.price_adjustment === null || opt.price_adjustment === undefined ? "" : String(opt.price_adjustment)}
                        placeholder="اتركه فارغًا = السعر الأساسي"
                        onChange={(e) => {
                          const v = e.target.value;
                          setOptions((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], price_adjustment: v === "" ? null : (Number(v) as any) };
                            return next;
                          });
                        }}
                      />
                    </div>
                  ))}
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
