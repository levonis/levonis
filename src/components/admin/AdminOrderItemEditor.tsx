import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2, Plus, Save, Package, Receipt, Truck, Wallet, BadgePercent, Calculator, Eye } from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/utils";
import { adminUpdateOrder } from "@/lib/adminMutations";

interface OrderItem {
  id: string;
  product_id: string;
  bundle_id?: string | null;
  product_name_ar?: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  selected_color?: string | null;
  selected_option?: string | null;
  color_image_url?: string | null;
  products?: any;
  product_bundles?: { id: string; title_ar?: string; image_url?: string; bundle_items?: Array<{ quantity: number; products?: { name_ar?: string; image_url?: string } }> } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderItems: OrderItem[];
  onSaved: (updated?: { subtotal: number; total_amount: number; items: OrderItem[] }) => void;
}

interface Finance {
  admin_shipping_cost: number;
  cod_fee: number;
  discount_amount: number;
  tax_amount: number;
}

export default function AdminOrderItemEditor({ open, onOpenChange, orderId, orderItems, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<OrderItem[]>(() => orderItems.map(i => ({ ...i })));
  const [saving, setSaving] = useState(false);
  const [finance, setFinance] = useState<Finance>({ admin_shipping_cost: 0, cod_fee: 0, discount_amount: 0, tax_amount: 0 });
  const [financeLoaded, setFinanceLoaded] = useState(false);

  // Reset state when reopened
  useEffect(() => {
    if (open) {
      setItems(orderItems.map(i => ({ ...i })));
      setFinanceLoaded(false);
    }
  }, [open, orderItems]);

  // Fetch current order finance
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('orders_admin')
        .select('admin_shipping_cost, cod_fee, discount_amount, tax_amount, subtotal, total_amount')
        .eq('id', orderId)
        .maybeSingle();
      if (data) {
        const prevSubtotal = Number(data.subtotal) || 0;
        const prevTotal = Number(data.total_amount) || 0;
        const prevDiscount = Number(data.discount_amount) || 0;
        const prevTax = Number(data.tax_amount) || 0;
        const prevCod = Number(data.cod_fee) || 0;
        let prevShipping = Number(data.admin_shipping_cost) || 0;
        // If admin_shipping_cost is 0 but there's an inferred delivery in total, derive it
        if (prevShipping === 0 && prevSubtotal > 0) {
          const inferred = prevTotal - prevSubtotal - prevCod - prevTax + prevDiscount;
          if (inferred > 0) prevShipping = inferred;
        }
        setFinance({
          admin_shipping_cost: prevShipping,
          cod_fee: prevCod,
          discount_amount: prevDiscount,
          tax_amount: prevTax,
        });
      }
      setFinanceLoaded(true);
    })();
  }, [open, orderId]);

  // Fetch products for adding new items
  const { data: allProducts } = useQuery({
    queryKey: ["admin-products-for-order"],
    enabled: open,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("products_admin")
        .select("id, name, name_ar, price, colors, direct_stock")
        .order("name_ar");
      return (data ?? []) as any[];
    },
  });

  const updateItem = (index: number, field: string, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === "quantity" || field === "unit_price") {
        updated.total_price = (updated.quantity || 1) * (updated.unit_price || 0);
      }
      return updated;
    }));
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const addItem = (productId: string) => {
    const product = allProducts?.find(p => p.id === productId);
    if (!product) return;
    setItems(prev => [...prev, {
      id: `new-${Date.now()}`,
      product_id: product.id,
      product_name_ar: product.name_ar || product.name,
      product_name: product.name,
      quantity: 1,
      unit_price: product.price,
      total_price: product.price,
      selected_color: null,
      selected_option: null,
    }]);
  };

  // Live totals
  const subtotal = useMemo(() => items.reduce((s, i) => s + (Number(i.total_price) || 0), 0), [items]);
  const customerTotal = useMemo(() => {
    return Math.max(0, subtotal + (finance.admin_shipping_cost || 0) + (finance.cod_fee || 0) + (finance.tax_amount || 0) - (finance.discount_amount || 0));
  }, [subtotal, finance]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const originalItems = orderItems;

      // 1. Removed items - restore stock
      for (const orig of originalItems) {
        const stillExists = items.find(i => i.id === orig.id);
        if (!stillExists) {
          if (orig.product_id) {
            await supabase.rpc("admin_adjust_order_inventory", {
              p_product_id: orig.product_id,
              p_option_name: orig.selected_option || null,
              p_selected_color: orig.selected_color || null,
              p_quantity_change: orig.quantity,
            });
          }
          await supabase.from("order_items").delete().eq("id", orig.id);
        }
      }

      // 2. Modified / new items
      for (const item of items) {
        const orig = originalItems.find(o => o.id === item.id);
        const isManual = (item as any).is_manual === true || !item.product_id;

        if (orig) {
          if (!isManual && orig.product_id) {
            const qtyDiff = orig.quantity - item.quantity;
            const colorChanged = orig.selected_color !== item.selected_color;
            if (colorChanged) {
              await supabase.rpc("admin_adjust_order_inventory", { p_product_id: orig.product_id, p_option_name: orig.selected_option || null, p_selected_color: orig.selected_color || null, p_quantity_change: orig.quantity });
              await supabase.rpc("admin_adjust_order_inventory", { p_product_id: item.product_id, p_option_name: item.selected_option || null, p_selected_color: item.selected_color || null, p_quantity_change: -item.quantity });
            } else if (qtyDiff !== 0) {
              await supabase.rpc("admin_adjust_order_inventory", { p_product_id: item.product_id, p_option_name: item.selected_option || null, p_selected_color: item.selected_color || null, p_quantity_change: qtyDiff });
            }
          }
          await supabase.from("order_items").update({
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            selected_color: item.selected_color,
            selected_option: item.selected_option,
          }).eq("id", item.id);
        } else {
          if (!isManual) {
            await supabase.rpc("admin_adjust_order_inventory", { p_product_id: item.product_id, p_option_name: item.selected_option || null, p_selected_color: item.selected_color || null, p_quantity_change: -item.quantity });
          }
          await supabase.from("order_items").insert({
            order_id: orderId,
            product_id: isManual ? null : item.product_id,
            product_name_ar: item.product_name_ar,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            selected_color: item.selected_color,
            selected_option: item.selected_option,
          });
        }
      }

      // 3. Update order finance with explicit values
      await adminUpdateOrder(orderId, {
        subtotal,
        total_amount: customerTotal,
        admin_shipping_cost: finance.admin_shipping_cost || 0,
        cod_fee: finance.cod_fee || 0,
        discount_amount: finance.discount_amount || 0,
        tax_amount: finance.tax_amount || 0,
      });

      toast.success("تم حفظ التعديلات بنجاح");
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      onSaved({ subtotal, total_amount: customerTotal, items });
      onOpenChange(false);
    } catch (err: any) {
      toast.error("فشل في الحفظ: " + (err?.message || "خطأ غير متوقع"));
    } finally {
      setSaving(false);
    }
  };

  const [addProductId, setAddProductId] = useState("");
  const [addMode, setAddMode] = useState<"existing" | "manual">("existing");
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState<number>(0);
  const [manualQty, setManualQty] = useState<number>(1);

  const addManualItem = () => {
    const name = manualName.trim();
    if (!name || manualPrice < 0 || manualQty < 1) return;
    setItems(prev => [...prev, {
      id: `manual-${Date.now()}`,
      product_id: null as any,
      product_name_ar: name,
      product_name: name,
      quantity: manualQty,
      unit_price: manualPrice,
      total_price: manualQty * manualPrice,
      selected_color: null,
      selected_option: null,
      is_manual: true,
    } as any]);
    setManualName(""); setManualPrice(0); setManualQty(1);
  };

  const setFin = (k: keyof Finance, v: number) => setFinance(prev => ({ ...prev, [k]: isNaN(v) ? 0 : Math.max(0, v) }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-3xl !overflow-hidden !max-h-none flex flex-col p-0" dir="rtl">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-5 w-5 text-primary" />
            تعديل الطلب وحساب المجموع
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            عدّل المنتجات والقيم المالية — المجموع النهائي يتحدّث فورياً ويُحفظ في الطلب كما يراه الزبون.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* SECTION 1: Products */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold flex items-center gap-1.5 text-foreground/90">
                <Package className="h-3.5 w-3.5 text-primary" />
                المنتجات ({items.length})
              </h3>
              <span className="text-[11px] text-muted-foreground">
                المجموع الفرعي: <span className="font-bold text-foreground">{formatPrice(subtotal)}</span>
              </span>
            </div>

            {items.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground rounded-xl border border-dashed border-border/50">
                لا توجد منتجات — أضف منتجاً أدناه
              </div>
            )}

            {items.map((item, index) => (
              <div key={item.id} className="p-3 rounded-xl border border-border/40 bg-card/60 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold truncate flex-1 flex items-center gap-1.5">
                    {item.bundle_id && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 font-bold shrink-0">📦 بندل</span>}
                    {((item as any).is_manual || (!item.product_id && !item.bundle_id)) && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 font-bold shrink-0">✏️ يدوي</span>}
                    {((item as any).is_manual || (!item.product_id && !item.bundle_id)) ? (
                      <Input
                        value={item.product_name_ar || ""}
                        onChange={e => updateItem(index, "product_name_ar", e.target.value)}
                        placeholder="اسم المنتج"
                        className="h-7 text-sm rounded-lg flex-1"
                      />
                    ) : (
                      <span className="truncate">{item.product_bundles?.title_ar || item.product_name_ar || item.product_name || "منتج"}</span>
                    )}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0" onClick={() => removeItem(index)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">الكمية</Label>
                    <Input type="number" min={1} value={item.quantity}
                      onChange={e => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                      className="h-8 text-sm rounded-lg" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">سعر الوحدة</Label>
                    <Input type="number" min={0} value={item.unit_price}
                      onChange={e => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                      className="h-8 text-sm rounded-lg" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">المجموع</Label>
                    <Input value={formatPrice(item.total_price)} disabled className="h-8 text-sm rounded-lg bg-muted/30" />
                  </div>
                </div>

                <Input
                  value={item.selected_color || ""}
                  onChange={e => updateItem(index, "selected_color", e.target.value || null)}
                  placeholder="اللون (اختياري)"
                  className="h-8 text-sm rounded-lg"
                />

                {item.bundle_id && item.product_bundles?.bundle_items && item.product_bundles.bundle_items.length > 0 && (
                  <div className="mt-1 pt-2 border-t border-border/30">
                    <Label className="text-[10px] text-muted-foreground mb-1.5 block">📦 محتويات البندل:</Label>
                    <div className="space-y-1">
                      {item.product_bundles.bundle_items.map((bi, bIdx) => (
                        <div key={bIdx} className="flex items-center gap-2 text-xs bg-muted/30 rounded p-1.5">
                          {bi.products?.image_url && <img src={bi.products.image_url} alt="" className="w-7 h-7 rounded object-cover" />}
                          <span className="flex-1 truncate">{bi.products?.name_ar || 'منتج'}</span>
                          <span className="text-muted-foreground">×{bi.quantity * item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add new product */}
            <div className="p-3 rounded-xl border border-dashed border-border/50 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">إضافة منتج</Label>
                <div className="flex gap-1 p-0.5 rounded-lg bg-muted/40">
                  <button type="button" onClick={() => setAddMode("existing")}
                    className={`px-2 py-1 text-[11px] rounded-md font-bold transition ${addMode === "existing" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
                    منتج موجود
                  </button>
                  <button type="button" onClick={() => setAddMode("manual")}
                    className={`px-2 py-1 text-[11px] rounded-md font-bold transition ${addMode === "manual" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
                    ✏️ يدوي
                  </button>
                </div>
              </div>

              {addMode === "existing" ? (
                <div className="flex gap-2">
                  <Select value={addProductId} onValueChange={setAddProductId}>
                    <SelectTrigger className="flex-1 h-8 text-sm rounded-lg"><SelectValue placeholder="اختر منتج" /></SelectTrigger>
                    <SelectContent>
                      {allProducts?.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name_ar || p.name} ({(p as any).direct_stock ?? 0} متاح)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-8 rounded-lg gap-1" disabled={!addProductId}
                    onClick={() => { addItem(addProductId); setAddProductId(""); }}>
                    <Plus className="h-3.5 w-3.5" /> إضافة
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input value={manualName} onChange={e => setManualName(e.target.value.slice(0, 200))}
                    placeholder="اسم المنتج" className="h-8 text-sm rounded-lg" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">السعر</Label>
                      <Input type="number" min={0} value={manualPrice}
                        onChange={e => setManualPrice(parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm rounded-lg" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">الكمية</Label>
                      <Input type="number" min={1} value={manualQty}
                        onChange={e => setManualQty(parseInt(e.target.value) || 1)}
                        className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="w-full h-8 rounded-lg gap-1"
                    disabled={!manualName.trim() || manualPrice < 0 || manualQty < 1} onClick={addManualItem}>
                    <Plus className="h-3.5 w-3.5" /> إضافة منتج يدوي
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center">ⓘ المنتج اليدوي لا يؤثر على المخزون</p>
                </div>
              )}
            </div>
          </section>

          {/* SECTION 2: Financial Adjustments */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-bold flex items-center gap-1.5 text-foreground/90">
              <Calculator className="h-3.5 w-3.5 text-primary" />
              التعديلات المالية
            </h3>

            {!financeLoaded ? (
              <div className="h-24 flex items-center justify-center text-muted-foreground text-xs">
                <Loader2 className="h-4 w-4 animate-spin ml-2" /> تحميل بيانات الطلب…
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-xl border border-border/40 bg-card/60">
                  <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Truck className="h-3 w-3" /> التوصيل (د.ع)
                  </Label>
                  <Input type="number" min={0} value={finance.admin_shipping_cost}
                    onChange={e => setFin('admin_shipping_cost', parseFloat(e.target.value))}
                    className="h-9 text-sm rounded-lg mt-1 font-bold" />
                </div>
                <div className="p-2.5 rounded-xl border border-border/40 bg-card/60">
                  <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Wallet className="h-3 w-3" /> عمولة الدفع عند الاستلام (د.ع)
                  </Label>
                  <Input type="number" min={0} value={finance.cod_fee}
                    onChange={e => setFin('cod_fee', parseFloat(e.target.value))}
                    className="h-9 text-sm rounded-lg mt-1 font-bold" />
                </div>
                <div className="p-2.5 rounded-xl border border-border/40 bg-card/60">
                  <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <BadgePercent className="h-3 w-3" /> الخصم (د.ع)
                  </Label>
                  <Input type="number" min={0} value={finance.discount_amount}
                    onChange={e => setFin('discount_amount', parseFloat(e.target.value))}
                    className="h-9 text-sm rounded-lg mt-1 font-bold" />
                </div>
                <div className="p-2.5 rounded-xl border border-border/40 bg-card/60">
                  <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Receipt className="h-3 w-3" /> الضريبة (د.ع)
                  </Label>
                  <Input type="number" min={0} value={finance.tax_amount}
                    onChange={e => setFin('tax_amount', parseFloat(e.target.value))}
                    className="h-9 text-sm rounded-lg mt-1 font-bold" />
                </div>
              </div>
            )}
          </section>

          {/* SECTION 3: Customer Preview */}
          <section className="space-y-2">
            <h3 className="text-xs font-bold flex items-center gap-1.5 text-foreground/90">
              <Eye className="h-3.5 w-3.5 text-primary" />
              ما سيراه الزبون
            </h3>
            <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent overflow-hidden">
              <div className="p-3.5 space-y-1.5 text-sm">
                <Row label="سعر المنتجات" value={formatPrice(subtotal)} />
                {finance.admin_shipping_cost > 0 && <Row label="التوصيل" value={formatPrice(finance.admin_shipping_cost)} />}
                {finance.cod_fee > 0 && <Row label="عمولة الدفع عند الاستلام" value={formatPrice(finance.cod_fee)} />}
                {finance.tax_amount > 0 && <Row label="الضريبة" value={formatPrice(finance.tax_amount)} />}
                {finance.discount_amount > 0 && <Row label="الخصم" value={`- ${formatPrice(finance.discount_amount)}`} negative />}
              </div>
              <div className="px-3.5 py-3 bg-primary/10 border-t border-primary/20 flex items-center justify-between">
                <span className="text-sm font-bold">المجموع الكلي للزبون</span>
                <span className="text-lg font-black text-primary">{formatPrice(customerTotal)}</span>
              </div>
            </div>
          </section>
        </div>

        {/* Sticky footer */}
        <div className="border-t border-border/40 px-5 py-3 bg-background/95 backdrop-blur flex items-center gap-2">
          <Button variant="outline" className="rounded-xl flex-1" disabled={saving} onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button className="rounded-xl gap-2 flex-[2]" disabled={saving || !financeLoaded} onClick={handleSave}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ التعديلات — {formatPrice(customerTotal)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold ${negative ? 'text-emerald-600' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}
