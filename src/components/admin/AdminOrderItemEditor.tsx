import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";
import {
  Loader2, Trash2, Plus, Save, Package, Receipt, Truck, Wallet,
  BadgePercent, Eye, ShoppingBag, Pencil, X, Sparkles, ArrowDown,
  Search, Clock, Box, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/utils";
import { adminUpdateOrder } from "@/lib/adminMutations";
import { isAllDirectStockDepleted } from "@/lib/stockUtils";

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
  const [originalFinance, setOriginalFinance] = useState<Finance | null>(null);
  const [originalTotal, setOriginalTotal] = useState<number>(0);
  const [financeLoaded, setFinanceLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"items" | "finance">("items");
  const [orderType, setOrderType] = useState<"direct" | "preorder">("direct");

  useEffect(() => {
    if (open) {
      setItems(orderItems.map(i => ({ ...i })));
      setFinanceLoaded(false);
      setActiveTab("items");
    }
  }, [open, orderItems]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [finResp, orderResp] = await Promise.all([
        (supabase as any)
          .from('orders_admin')
          .select('admin_shipping_cost, cod_fee, discount_amount, tax_amount, subtotal, total_amount')
          .eq('id', orderId)
          .maybeSingle(),
        (supabase as any)
          .from('orders')
          .select('order_type')
          .eq('id', orderId)
          .maybeSingle(),
      ]);
      const data = finResp?.data;
      if (data) {
        const prevSubtotal = Number(data.subtotal) || 0;
        const prevTotal = Number(data.total_amount) || 0;
        const prevDiscount = Number(data.discount_amount) || 0;
        const prevTax = Number(data.tax_amount) || 0;
        const prevCod = Number(data.cod_fee) || 0;
        let prevShipping = Number(data.admin_shipping_cost) || 0;
        if (prevShipping === 0 && prevSubtotal > 0) {
          const inferred = prevTotal - prevSubtotal - prevCod - prevTax + prevDiscount;
          if (inferred > 0) prevShipping = inferred;
        }
        const fin = {
          admin_shipping_cost: prevShipping,
          cod_fee: prevCod,
          discount_amount: prevDiscount,
          tax_amount: prevTax,
        };
        setFinance(fin);
        setOriginalFinance(fin);
        setOriginalTotal(prevTotal);
      }
      const ot = (orderResp?.data?.order_type === 'preorder') ? 'preorder' : 'direct';
      setOrderType(ot);
      setFinanceLoaded(true);
    })();
  }, [open, orderId]);

  const { data: allProducts } = useQuery({
    queryKey: ["admin-products-for-order-editor"],
    enabled: open,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("products_admin")
        .select("id, name, name_ar, price, image_url, colors, direct_stock, pre_order_stock, has_in_stock, has_pre_order, availability_type, sold_count")
        .order("name_ar");
      return (data ?? []) as any[];
    },
  });

  // Eligible products filtered by order type
  const eligibleProducts = useMemo(() => {
    const list = allProducts ?? [];
    if (orderType === 'preorder') {
      return list.filter(p => p.has_pre_order === true);
    }
    // direct: in-stock and not depleted
    return list.filter(p => p.has_in_stock !== false && !isAllDirectStockDepleted(p));
  }, [allProducts, orderType]);

  // Compute available stock for an item (direct sale only)
  const getAvailableStock = (productId: string, color?: string | null): number | null => {
    if (orderType !== 'direct') return null;
    const p = allProducts?.find(x => x.id === productId);
    if (!p) return null;
    const colors = Array.isArray(p.colors) ? p.colors : [];
    if (color && colors.length > 0) {
      const c = colors.find((cc: any) =>
        (cc?.name_ar || '').toString().trim().toLowerCase() === color.trim().toLowerCase() ||
        (cc?.name || '').toString().trim().toLowerCase() === color.trim().toLowerCase()
      );
      if (c?.option_stocks && typeof c.option_stocks === 'object') {
        return Object.values(c.option_stocks).reduce<number>((s, v: any) => s + Math.max(0, Number(v) || 0), 0);
      }
      if (c?.stock_quantity != null) return Math.max(0, Number(c.stock_quantity));
    }
    return Math.max(0, Number(p.direct_stock) || 0);
  };


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

  const subtotal = useMemo(() => items.reduce((s, i) => s + (Number(i.total_price) || 0), 0), [items]);
  const customerTotal = useMemo(() => {
    return Math.max(0, subtotal + (finance.admin_shipping_cost || 0) + (finance.cod_fee || 0) + (finance.tax_amount || 0) - (finance.discount_amount || 0));
  }, [subtotal, finance]);

  const totalDelta = customerTotal - originalTotal;
  const hasChanges = useMemo(() => {
    if (totalDelta !== 0) return true;
    if (items.length !== orderItems.length) return true;
    return items.some((it, i) => {
      const o = orderItems[i];
      return !o || o.id !== it.id || o.quantity !== it.quantity || Number(o.unit_price) !== Number(it.unit_price) || (o.selected_color || null) !== (it.selected_color || null);
    });
  }, [items, orderItems, totalDelta]);

  const handleSave = async () => {
    // Pre-save stock validation for direct sale orders
    if (orderType === 'direct') {
      for (const item of items) {
        const isManual = (item as any).is_manual === true || !item.product_id;
        if (isManual) continue;
        const orig = orderItems.find(o => o.id === item.id);
        const prevQty = orig && orig.product_id === item.product_id && (orig.selected_color || null) === (item.selected_color || null)
          ? orig.quantity : 0;
        const additional = item.quantity - prevQty;
        if (additional > 0) {
          const avail = getAvailableStock(item.product_id, item.selected_color);
          if (avail != null && additional > avail) {
            toast.error(`المخزون المتاح لـ "${item.product_name_ar || item.product_name}" غير كافٍ (المتاح: ${avail})`);
            return;
          }
        }
      }
    }

    setSaving(true);
    try {
      const originalItems = orderItems;
      const adjust = (productId: string, optionName: string | null, color: string | null, qtyChange: number) =>
        supabase.rpc("admin_adjust_product_counters" as any, {
          p_product_id: productId,
          p_order_type: orderType,
          p_option_name: optionName,
          p_selected_color: color,
          p_quantity_change: qtyChange,
        });

      // 1) Removed items → restore stock + decrement sold_count
      for (const orig of originalItems) {
        const stillExists = items.find(i => i.id === orig.id);
        if (!stillExists) {
          if (orig.product_id) {
            await adjust(orig.product_id, orig.selected_option || null, orig.selected_color || null, orig.quantity);
          }
          await supabase.from("order_items").delete().eq("id", orig.id);
        }
      }

      // 2) Updated or newly added items
      for (const item of items) {
        const orig = originalItems.find(o => o.id === item.id);
        const isManual = (item as any).is_manual === true || !item.product_id;

        if (orig) {
          if (!isManual && orig.product_id) {
            const qtyDiff = orig.quantity - item.quantity; // positive = restore, negative = deduct
            const colorChanged = (orig.selected_color || null) !== (item.selected_color || null);
            const productChanged = orig.product_id !== item.product_id;
            if (productChanged || colorChanged) {
              await adjust(orig.product_id, orig.selected_option || null, orig.selected_color || null, orig.quantity);
              await adjust(item.product_id, item.selected_option || null, item.selected_color || null, -item.quantity);
            } else if (qtyDiff !== 0) {
              await adjust(item.product_id, item.selected_option || null, item.selected_color || null, qtyDiff);
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
            await adjust(item.product_id, item.selected_option || null, item.selected_color || null, -item.quantity);
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
      queryClient.invalidateQueries({ queryKey: ["admin-products-for-order-editor"] });
      onSaved({ subtotal, total_amount: customerTotal, items });
      onOpenChange(false);
    } catch (err: any) {
      toast.error("فشل في الحفظ: " + (err?.message || "خطأ غير متوقع"));
    } finally {
      setSaving(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [addMode, setAddMode] = useState<"existing" | "manual">("existing");
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState<number>(0);
  const [manualQty, setManualQty] = useState<number>(1);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = eligibleProducts;
    if (!q) return base.slice(0, 25);
    return base.filter(p =>
      (p.name_ar || '').toLowerCase().includes(q) ||
      (p.name || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [eligibleProducts, searchQuery]);


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
  const itemsCount = items.reduce((s, i) => s + (i.quantity || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-3xl !overflow-hidden !max-h-none flex flex-col p-0 gap-0" dir="rtl">
        {/* ====== HERO HEADER with live total ====== */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/40 bg-gradient-to-bl from-primary/10 via-primary/[0.04] to-transparent">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base mb-1">
                <div className="h-8 w-8 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                  <Receipt className="h-4 w-4 text-primary" />
                </div>
                تعديل الطلب
              </DialogTitle>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1 ${orderType === 'preorder' ? 'bg-violet-500/15 text-violet-600 border border-violet-500/30' : 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'}`}>
                  {orderType === 'preorder' ? <><Clock className="h-2.5 w-2.5" /> حجز مسبق</> : <><Box className="h-2.5 w-2.5" /> بيع مباشر</>}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {itemsCount} قطعة · {items.length} منتج
                </span>
              </div>
            </div>
            <div className="text-end shrink-0">
              <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">المجموع للزبون</div>
              <div className="text-2xl font-black text-primary leading-tight tabular-nums">{formatPrice(customerTotal)}</div>
              {originalFinance && totalDelta !== 0 && (
                <div className={`text-[10px] font-bold tabular-nums ${totalDelta > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {totalDelta > 0 ? '↑' : '↓'} {formatPrice(Math.abs(totalDelta))} عن السابق
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-muted/40 mt-3">
            <button type="button" onClick={() => setActiveTab("items")}
              className={`flex-1 px-3 py-1.5 text-xs rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${activeTab === "items" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <ShoppingBag className="h-3.5 w-3.5" /> المنتجات
              <span className="text-[10px] px-1.5 rounded-full bg-primary/15 text-primary">{items.length}</span>
            </button>
            <button type="button" onClick={() => setActiveTab("finance")}
              className={`flex-1 px-3 py-1.5 text-xs rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${activeTab === "finance" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Wallet className="h-3.5 w-3.5" /> المالية والمعاينة
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* ============= TAB 1: ITEMS ============= */}
          {activeTab === "items" && (
            <>
              {items.length === 0 && (
                <div className="p-6 text-center rounded-2xl border-2 border-dashed border-border/50 bg-muted/20">
                  <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-bold text-muted-foreground">لا توجد منتجات في الطلب</p>
                  <p className="text-[11px] text-muted-foreground mt-1">أضف منتجاً من النموذج أدناه</p>
                </div>
              )}

              {items.map((item, index) => {
                const isManual = (item as any).is_manual === true || (!item.product_id && !item.bundle_id);
                const isBundle = !!item.bundle_id;
                return (
                  <div key={item.id} className="group relative rounded-2xl border border-border/40 bg-card/60 hover:bg-card/80 hover:border-primary/30 transition-all overflow-hidden">
                    {/* Item header */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 bg-muted/20">
                      <span className="h-6 w-6 rounded-lg bg-primary/15 text-primary text-[11px] font-black flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      {isBundle && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-600 font-bold">📦 بندل</span>}
                      {isManual && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 font-bold flex items-center gap-0.5"><Pencil className="h-2.5 w-2.5" /> يدوي</span>}
                      <div className="flex-1 min-w-0">
                        {isManual ? (
                          <Input
                            value={item.product_name_ar || ""}
                            onChange={e => updateItem(index, "product_name_ar", e.target.value)}
                            placeholder="اسم المنتج"
                            className="h-7 text-sm rounded-lg border-0 bg-transparent px-1 font-bold focus-visible:bg-background"
                          />
                        ) : (
                          <span className="text-sm font-bold truncate block">{item.product_bundles?.title_ar || item.product_name_ar || item.product_name || "منتج"}</span>
                        )}
                      </div>
                      <div className="text-sm font-black text-primary tabular-nums shrink-0">{formatPrice(item.total_price)}</div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0" onClick={() => removeItem(index)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Item editable fields */}
                    <div className="p-3 grid grid-cols-12 gap-2">
                      <div className="col-span-3">
                        <Label className="text-[10px] text-muted-foreground font-bold flex items-center justify-between">
                          <span>الكمية</span>
                          {!isManual && !isBundle && item.product_id && orderType === 'direct' && (() => {
                            const orig = orderItems.find(o => o.id === item.id);
                            const prevQty = orig && orig.product_id === item.product_id && (orig.selected_color || null) === (item.selected_color || null) ? orig.quantity : 0;
                            const avail = getAvailableStock(item.product_id, item.selected_color);
                            if (avail == null) return null;
                            const maxAllowed = avail + prevQty;
                            const exceeds = item.quantity > maxAllowed;
                            return (
                              <span className={`text-[9px] px-1 rounded ${exceeds ? 'bg-destructive/15 text-destructive' : 'bg-emerald-500/15 text-emerald-600'}`}>
                                متاح: {maxAllowed}
                              </span>
                            );
                          })()}
                        </Label>
                        <Input type="number" min={1} value={item.quantity}
                          onChange={e => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                          className="h-9 text-sm rounded-lg mt-1 text-center font-bold tabular-nums" />
                      </div>
                      <div className="col-span-5">
                        <Label className="text-[10px] text-muted-foreground font-bold">سعر الوحدة (د.ع)</Label>
                        <FormattedNumberInput value={item.unit_price}
                          onChange={v => updateItem(index, "unit_price", v)}
                          className="h-9 text-sm rounded-lg mt-1 font-bold" />
                      </div>
                      <div className="col-span-4">
                        <Label className="text-[10px] text-muted-foreground font-bold">اللون</Label>
                        <Input
                          value={item.selected_color || ""}
                          onChange={e => updateItem(index, "selected_color", e.target.value || null)}
                          placeholder="—"
                          className="h-9 text-sm rounded-lg mt-1"
                        />
                      </div>
                    </div>

                    {isBundle && item.product_bundles?.bundle_items && item.product_bundles.bundle_items.length > 0 && (
                      <div className="px-3 pb-3">
                        <div className="pt-2 border-t border-border/30">
                          <Label className="text-[10px] text-muted-foreground mb-1.5 block font-bold">📦 محتويات البندل</Label>
                          <div className="space-y-1">
                            {item.product_bundles.bundle_items.map((bi, bIdx) => (
                              <div key={bIdx} className="flex items-center gap-2 text-xs bg-muted/30 rounded-lg p-1.5">
                                {bi.products?.image_url && <img src={bi.products.image_url} alt="" className="w-7 h-7 rounded object-cover" />}
                                <span className="flex-1 truncate">{bi.products?.name_ar || 'منتج'}</span>
                                <span className="text-muted-foreground tabular-nums">×{bi.quantity * item.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add new product card */}
              <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/[0.03] overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-primary/15 bg-primary/5">
                  <Label className="text-xs font-bold flex items-center gap-1.5 text-primary">
                    <Plus className="h-3.5 w-3.5" /> إضافة منتج جديد
                  </Label>
                  <div className="flex gap-0.5 p-0.5 rounded-lg bg-background/60">
                    <button type="button" onClick={() => setAddMode("existing")}
                      className={`px-2 py-1 text-[10px] rounded-md font-bold transition ${addMode === "existing" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}>
                      من القائمة
                    </button>
                    <button type="button" onClick={() => setAddMode("manual")}
                      className={`px-2 py-1 text-[10px] rounded-md font-bold transition ${addMode === "manual" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}>
                      يدوي
                    </button>
                  </div>
                </div>

                <div className="p-3">
                  {addMode === "existing" ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder={orderType === 'preorder' ? "ابحث في منتجات الحجز المسبق…" : "ابحث في منتجات البيع المباشر…"}
                          className="h-9 text-sm rounded-lg pr-9"
                        />
                      </div>
                      <div className="max-h-64 overflow-y-auto rounded-xl border border-border/40 bg-background/50 divide-y divide-border/30">
                        {searchResults.length === 0 ? (
                          <div className="p-4 text-center text-[11px] text-muted-foreground flex flex-col items-center gap-1">
                            <AlertTriangle className="h-4 w-4" />
                            {(allProducts?.length ?? 0) === 0
                              ? "جاري التحميل…"
                              : orderType === 'preorder'
                                ? "لا توجد منتجات متاحة للحجز المسبق"
                                : "لا توجد منتجات بيع مباشر متاحة بهذا البحث"}
                          </div>
                        ) : (
                          searchResults.map(p => {
                            const stock = orderType === 'direct'
                              ? Math.max(0, Number(p.direct_stock) || 0)
                              : Math.max(0, Number(p.pre_order_stock) || 0);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => { addItem(p.id); setSearchQuery(""); }}
                                className="w-full flex items-center gap-2.5 p-2 text-right hover:bg-primary/5 transition-colors"
                              >
                                {p.image_url ? (
                                  <img src={p.image_url} alt="" loading="lazy" className="h-10 w-10 rounded-lg object-cover shrink-0 bg-muted" />
                                ) : (
                                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-bold truncate">{p.name_ar || p.name}</div>
                                  <div className="text-[10px] text-muted-foreground tabular-nums flex items-center gap-2">
                                    <span className="text-primary font-bold">{formatPrice(p.price)}</span>
                                    <span className={`px-1.5 py-0.5 rounded ${orderType === 'direct' ? (stock > 0 ? 'bg-emerald-500/15 text-emerald-600' : 'bg-destructive/15 text-destructive') : 'bg-violet-500/15 text-violet-600'}`}>
                                      {orderType === 'direct' ? `متاح: ${stock}` : (stock > 0 ? `حجز: ${stock}` : 'حجز مفتوح')}
                                    </span>
                                  </div>
                                </div>
                                <Plus className="h-4 w-4 text-primary shrink-0" />
                              </button>
                            );
                          })
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center">
                        المنتجات المعروضة مفلترة حسب نوع الطلب ({orderType === 'preorder' ? 'حجز مسبق' : 'بيع مباشر'})
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input value={manualName} onChange={e => setManualName(e.target.value.slice(0, 200))}
                        placeholder="اسم المنتج اليدوي" className="h-9 text-sm rounded-lg" />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px] text-muted-foreground font-bold">السعر (د.ع)</Label>
                          <FormattedNumberInput value={manualPrice} onChange={setManualPrice} className="h-9 text-sm rounded-lg mt-1" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground font-bold">الكمية</Label>
                          <Input type="number" min={1} value={manualQty}
                            onChange={e => setManualQty(parseInt(e.target.value) || 1)}
                            className="h-9 text-sm rounded-lg mt-1 text-center font-bold" />
                        </div>
                      </div>
                      <Button size="sm" variant="default" className="w-full h-9 rounded-lg gap-1"
                        disabled={!manualName.trim() || manualPrice < 0 || manualQty < 1} onClick={addManualItem}>
                        <Plus className="h-3.5 w-3.5" /> إضافة يدوي
                      </Button>
                      <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
                        <Sparkles className="h-3 w-3" /> المنتج اليدوي لا يؤثر على المخزون
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick jump to finance */}
              <button type="button" onClick={() => setActiveTab("finance")}
                className="w-full p-3 rounded-2xl border border-border/40 bg-card/40 hover:bg-card/70 hover:border-primary/40 transition-all flex items-center justify-between group">
                <div className="text-start">
                  <div className="text-xs font-bold text-foreground">المالية والمعاينة</div>
                  <div className="text-[10px] text-muted-foreground">التوصيل · العمولات · الخصم · معاينة الزبون</div>
                </div>
                <ArrowDown className="h-4 w-4 text-muted-foreground group-hover:text-primary -rotate-90" />
              </button>
            </>
          )}

          {/* ============= TAB 2: FINANCE + PREVIEW ============= */}
          {activeTab === "finance" && (
            <>
              {!financeLoaded ? (
                <div className="h-32 flex items-center justify-center text-muted-foreground text-xs">
                  <Loader2 className="h-4 w-4 animate-spin ml-2" /> تحميل بيانات الطلب…
                </div>
              ) : (
                <>
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-black text-foreground/90 flex items-center gap-1.5 uppercase tracking-wider">
                      <Wallet className="h-3.5 w-3.5 text-primary" /> التعديلات المالية
                    </h3>

                    <FinanceField
                      icon={<Truck className="h-4 w-4" />}
                      label="رسوم التوصيل"
                      hint="ما يدفعه الزبون مقابل توصيل الطلب"
                      value={finance.admin_shipping_cost}
                      onChange={v => setFin('admin_shipping_cost', v)}
                      color="blue"
                    />
                    <FinanceField
                      icon={<Wallet className="h-4 w-4" />}
                      label="عمولة الدفع عند الاستلام"
                      hint="رسوم إضافية على طلبات COD"
                      value={finance.cod_fee}
                      onChange={v => setFin('cod_fee', v)}
                      color="amber"
                    />
                    <FinanceField
                      icon={<BadgePercent className="h-4 w-4" />}
                      label="الخصم"
                      hint="يُطرح من المجموع الكلي"
                      value={finance.discount_amount}
                      onChange={v => setFin('discount_amount', v)}
                      color="emerald"
                      isNegative
                    />
                    <FinanceField
                      icon={<Receipt className="h-4 w-4" />}
                      label="الضريبة"
                      hint="ضرائب إضافية على الطلب"
                      value={finance.tax_amount}
                      onChange={v => setFin('tax_amount', v)}
                      color="slate"
                    />
                  </div>

                  {/* Customer preview */}
                  <div className="space-y-2.5 pt-2">
                    <h3 className="text-xs font-black text-foreground/90 flex items-center gap-1.5 uppercase tracking-wider">
                      <Eye className="h-3.5 w-3.5 text-primary" /> ما سيراه الزبون
                    </h3>
                    <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/[0.03] to-transparent overflow-hidden shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.3)]">
                      <div className="px-4 py-3 space-y-2 text-sm">
                        <PreviewRow label="سعر المنتجات" value={formatPrice(subtotal)} />
                        {finance.admin_shipping_cost > 0 && <PreviewRow label="التوصيل" value={formatPrice(finance.admin_shipping_cost)} />}
                        {finance.cod_fee > 0 && <PreviewRow label="عمولة الدفع عند الاستلام" value={formatPrice(finance.cod_fee)} />}
                        {finance.tax_amount > 0 && <PreviewRow label="الضريبة" value={formatPrice(finance.tax_amount)} />}
                        {finance.discount_amount > 0 && <PreviewRow label="الخصم" value={`- ${formatPrice(finance.discount_amount)}`} negative />}
                      </div>
                      <div className="px-4 py-3.5 bg-primary/15 border-t-2 border-primary/30 flex items-center justify-between">
                        <span className="text-sm font-black">المجموع الكلي</span>
                        <span className="text-xl font-black text-primary tabular-nums">{formatPrice(customerTotal)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* ====== Sticky footer ====== */}
        <div className="border-t border-border/40 px-5 py-3 bg-background/95 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-xl flex-1 h-11" disabled={saving} onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button variant="glass-primary" className="rounded-xl gap-2 flex-[2] h-11"
              disabled={saving || !financeLoaded || !hasChanges} onClick={handleSave}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="font-black">
                {hasChanges ? `حفظ — ${formatPrice(customerTotal)}` : 'لا توجد تغييرات'}
              </span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewRow({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold tabular-nums ${negative ? 'text-emerald-600' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}

function FinanceField({
  icon, label, hint, value, onChange, color, isNegative,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  color: 'blue' | 'amber' | 'emerald' | 'slate';
  isNegative?: boolean;
}) {
  const colorMap = {
    blue: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    slate: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  };
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl border border-border/40 bg-card/60 hover:border-border/70 transition-colors">
      <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${colorMap[color]}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-foreground">{label}</span>
          {isNegative && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 font-bold">يُطرح</span>}
        </div>
        <p className="text-[10px] text-muted-foreground truncate">{hint}</p>
      </div>
      <div className="w-32 shrink-0">
        <FormattedNumberInput value={value} onChange={onChange} suffix="د.ع"
          className="h-9 text-sm rounded-lg font-bold text-end" />
      </div>
    </div>
  );
}
