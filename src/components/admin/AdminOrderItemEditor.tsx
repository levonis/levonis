import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2, Plus, Save, Package } from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/utils";

interface OrderItem {
  id: string;
  product_id: string;
  product_name_ar?: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  selected_color?: string | null;
  selected_option?: string | null;
  color_image_url?: string | null;
  products?: any;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderItems: OrderItem[];
  onSaved: () => void;
}

export default function AdminOrderItemEditor({ open, onOpenChange, orderId, orderItems, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<OrderItem[]>(() => orderItems.map(i => ({ ...i })));
  const [saving, setSaving] = useState(false);

  // Fetch products for adding new items
  const { data: allProducts } = useQuery({
    queryKey: ["admin-products-for-order"],
    enabled: open,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, name_ar, price, colors, direct_stock")
        .order("name_ar");
      return data ?? [];
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const originalItems = orderItems;
      
      // 1. Handle removed items - restore their stock
      for (const orig of originalItems) {
        const stillExists = items.find(i => i.id === orig.id);
        if (!stillExists) {
          // Item was removed - restore stock
          await supabase.rpc("admin_adjust_order_inventory" as any, {
            p_product_id: orig.product_id,
            p_option_id: orig.selected_option || null,
            p_selected_color: orig.selected_color || null,
            p_quantity_change: orig.quantity, // positive = restore
          });
          // Delete the order item
          await supabase.from("order_items").delete().eq("id", orig.id);
        }
      }

      // 2. Handle modified items - adjust stock difference
      for (const item of items) {
        const orig = originalItems.find(o => o.id === item.id);
        
        if (orig) {
          // Existing item - check for changes
          const qtyDiff = orig.quantity - item.quantity; // positive = restoring, negative = deducting
          const colorChanged = orig.selected_color !== item.selected_color;
          
          if (colorChanged) {
            // Restore old color stock
            await supabase.rpc("admin_adjust_order_inventory" as any, {
              p_product_id: orig.product_id,
              p_option_id: orig.selected_option || null,
              p_selected_color: orig.selected_color || null,
              p_quantity_change: orig.quantity,
            });
            // Deduct new color stock
            await supabase.rpc("admin_adjust_order_inventory" as any, {
              p_product_id: item.product_id,
              p_option_id: item.selected_option || null,
              p_selected_color: item.selected_color || null,
              p_quantity_change: -item.quantity,
            });
          } else if (qtyDiff !== 0) {
            await supabase.rpc("admin_adjust_order_inventory" as any, {
              p_product_id: item.product_id,
              p_option_id: item.selected_option || null,
              p_selected_color: item.selected_color || null,
              p_quantity_change: qtyDiff,
            });
          }

          // Update the order item
          await supabase.from("order_items").update({
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            selected_color: item.selected_color,
            selected_option: item.selected_option,
          }).eq("id", item.id);
        } else {
          // New item - deduct stock and insert
          await supabase.rpc("admin_adjust_order_inventory" as any, {
            p_product_id: item.product_id,
            p_option_id: item.selected_option || null,
            p_selected_color: item.selected_color || null,
            p_quantity_change: -item.quantity,
          });

          await supabase.from("order_items").insert({
            order_id: orderId,
            product_id: item.product_id,
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

      // 3. Update order total
      const newTotal = items.reduce((sum, i) => sum + i.total_price, 0);
      await supabase.from("orders").update({ total_amount: newTotal }).eq("id", orderId);

      toast.success("تم تحديث المنتجات والمخزون بنجاح");
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("فشل في تحديث المنتجات: " + (err?.message || "خطأ غير متوقع"));
    } finally {
      setSaving(false);
    }
  };

  const [addProductId, setAddProductId] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            تعديل منتجات الطلب
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={item.id} className="p-3 rounded-xl border border-border/40 bg-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold truncate flex-1">
                  {item.product_name_ar || item.product_name || "منتج"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => removeItem(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">الكمية</Label>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={e => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                    className="h-8 text-sm rounded-lg"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">سعر الوحدة</Label>
                  <Input
                    type="number"
                    min={0}
                    value={item.unit_price}
                    onChange={e => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                    className="h-8 text-sm rounded-lg"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">المجموع</Label>
                  <Input
                    value={formatPrice(item.total_price)}
                    disabled
                    className="h-8 text-sm rounded-lg bg-muted/30"
                  />
                </div>
              </div>

              <div>
                <Label className="text-[10px] text-muted-foreground">اللون</Label>
                <Input
                  value={item.selected_color || ""}
                  onChange={e => updateItem(index, "selected_color", e.target.value || null)}
                  placeholder="اللون (اختياري)"
                  className="h-8 text-sm rounded-lg"
                />
              </div>
            </div>
          ))}

          {/* Add new product */}
          <div className="p-3 rounded-xl border border-dashed border-border/50 space-y-2">
            <Label className="text-xs text-muted-foreground">إضافة منتج جديد</Label>
            <div className="flex gap-2">
              <Select value={addProductId} onValueChange={setAddProductId}>
                <SelectTrigger className="flex-1 h-8 text-sm rounded-lg">
                  <SelectValue placeholder="اختر منتج" />
                </SelectTrigger>
                <SelectContent>
                  {allProducts?.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name_ar || p.name} ({(p as any).direct_stock ?? 0} متاح)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-lg gap-1"
                disabled={!addProductId}
                onClick={() => { addItem(addProductId); setAddProductId(""); }}
              >
                <Plus className="h-3.5 w-3.5" />
                إضافة
              </Button>
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
            <span className="text-sm font-bold">المجموع الكلي</span>
            <span className="text-base font-black text-primary">
              {formatPrice(items.reduce((s, i) => s + i.total_price, 0))}
            </span>
          </div>

          <Button
            className="w-full rounded-xl gap-2"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ التعديلات وتحديث المخزون
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
