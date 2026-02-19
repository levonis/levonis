import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Percent, Truck, Gift, Tag, Edit, Sparkles, Zap, Package } from "lucide-react";
import { toast } from "sonner";

interface Discount {
  id: string;
  merchant_id: string;
  merchant_store_name: string | null;
  discount_type: string;
  discount_value: number;
  min_purchase_amount: number;
  gift_description: string | null;
  title_ar: string;
  description_ar: string | null;
  is_active: boolean;
  valid_until: string | null;
  created_at: string;
}

const typeOptions = [
  { value: "percentage", label: "خصم نسبة %", icon: Percent, color: "text-primary" },
  { value: "fixed_amount", label: "خصم مبلغ ثابت", icon: Tag, color: "text-amber-500" },
  { value: "free_delivery", label: "توصيل مجاني", icon: Truck, color: "text-blue-500" },
  { value: "free_gift", label: "هدية مع الطلب", icon: Gift, color: "text-emerald-500" },
  { value: "min_purchase_percentage", label: "خصم عند حد أدنى", icon: Percent, color: "text-purple-500" },
  { value: "min_purchase_delivery", label: "توصيل مجاني عند حد أدنى", icon: Truck, color: "text-cyan-500" },
];

interface Props {
  merchantId: string;
  merchantName: string;
}

export default function MerchantDiscountsManager({ merchantId, merchantName }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Discount | null>(null);
  const [form, setForm] = useState({
    title_ar: "",
    description_ar: "",
    discount_type: "percentage",
    discount_value: 0,
    min_purchase_amount: 0,
    gift_description: "",
    valid_until: "",
  });

  const { data: discounts = [], isLoading } = useQuery({
    queryKey: ["merchant-discounts", merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_store_discounts")
        .select("*")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Discount[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        merchant_id: merchantId,
        merchant_store_name: merchantName,
        title_ar: form.title_ar,
        description_ar: form.description_ar || null,
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        min_purchase_amount: form.min_purchase_amount,
        gift_description: form.gift_description || null,
        valid_until: form.valid_until || null,
      };
      if (editing) {
        const { error } = await supabase.from("merchant_store_discounts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("merchant_store_discounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "تم التحديث" : "تم الإنشاء");
      queryClient.invalidateQueries({ queryKey: ["merchant-discounts"] });
      queryClient.invalidateQueries({ queryKey: ["store-discounts-active"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: () => toast.error("حدث خطأ"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("merchant_store_discounts").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["merchant-discounts"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("merchant_store_discounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      queryClient.invalidateQueries({ queryKey: ["merchant-discounts"] });
    },
  });

  const resetForm = () => {
    setEditing(null);
    setForm({ title_ar: "", description_ar: "", discount_type: "percentage", discount_value: 0, min_purchase_amount: 0, gift_description: "", valid_until: "" });
  };

  const openEdit = (d: Discount) => {
    setEditing(d);
    setForm({
      title_ar: d.title_ar,
      description_ar: d.description_ar || "",
      discount_type: d.discount_type,
      discount_value: d.discount_value,
      min_purchase_amount: d.min_purchase_amount,
      gift_description: d.gift_description || "",
      valid_until: d.valid_until ? d.valid_until.slice(0, 16) : "",
    });
    setDialogOpen(true);
  };

  const showMinPurchase = ["min_purchase_percentage", "min_purchase_delivery"].includes(form.discount_type);
  const showValue = !["free_delivery", "free_gift"].includes(form.discount_type) || showMinPurchase;
  const showGift = form.discount_type === "free_gift";

  const activeCount = discounts.filter(d => d.is_active).length;

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-black text-foreground">إدارة العروض</h3>
            <p className="text-[9px] text-muted-foreground">
              {discounts.length} عرض · {activeCount} نشط
            </p>
          </div>
        </div>
        <Button size="sm" className="h-9 gap-1.5 rounded-xl text-xs font-bold" onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5" />
          عرض جديد
        </Button>
      </div>

      {/* Empty State */}
      {discounts.length === 0 && !isLoading && (
        <div className="text-center py-10 border border-dashed border-border/50 rounded-2xl">
          <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
            <Gift className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-xs font-bold text-muted-foreground">لم تنشئ أي عروض بعد</p>
          <p className="text-[9px] text-muted-foreground/70 mt-0.5">أنشئ عروضاً لجذب المزيد من العملاء</p>
        </div>
      )}

      {/* Discount Cards */}
      <div className="space-y-2">
        {discounts.map(d => {
          const typeInfo = typeOptions.find(t => t.value === d.discount_type);
          const Icon = typeInfo?.icon || Percent;
          const iconColor = typeInfo?.color || "text-primary";
          return (
            <div key={d.id} className={`rounded-xl border ${d.is_active ? 'border-primary/20 bg-card' : 'border-border/30 bg-muted/20 opacity-60'} overflow-hidden transition-all`}>
              <div className="flex items-center gap-3 p-3">
                <div className={`w-10 h-10 rounded-xl ${d.is_active ? 'bg-primary/10' : 'bg-muted/30'} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-5 w-5 ${d.is_active ? iconColor : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[11px] font-bold text-foreground truncate">{d.title_ar}</h4>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-muted-foreground">{typeInfo?.label}</span>
                    {d.discount_value > 0 && (
                      <Badge variant="outline" className="text-[8px] h-4 px-1 border-primary/20 text-primary">
                        {d.discount_type.includes('percentage') ? `${d.discount_value}%` : `${d.discount_value.toLocaleString()} د.ع`}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch 
                    checked={d.is_active} 
                    onCheckedChange={(v) => toggleActive.mutate({ id: d.id, active: v })}
                    className="scale-75"
                  />
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(d)}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(d.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black">{editing ? "تعديل العرض" : "عرض جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">عنوان العرض</Label>
              <Input 
                value={form.title_ar} 
                onChange={e => setForm(p => ({ ...p, title_ar: e.target.value }))} 
                placeholder="مثال: خصم 10% على كل الطلبات"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">الوصف (اختياري)</Label>
              <Textarea 
                value={form.description_ar} 
                onChange={e => setForm(p => ({ ...p, description_ar: e.target.value }))} 
                rows={2}
                className="rounded-xl resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">نوع الخصم</Label>
              <Select value={form.discount_type} onValueChange={v => setForm(p => ({ ...p, discount_type: v }))}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {typeOptions.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-2">
                        <t.icon className={`h-3.5 w-3.5 ${t.color}`} />
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showValue && form.discount_type !== "free_delivery" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">
                  {form.discount_type === "percentage" || form.discount_type === "min_purchase_percentage" ? "نسبة الخصم %" : "مبلغ الخصم (د.ع)"}
                </Label>
                <Input type="number" value={form.discount_value} onChange={e => setForm(p => ({ ...p, discount_value: Number(e.target.value) }))} className="h-10 rounded-xl" />
              </div>
            )}
            {showMinPurchase && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">الحد الأدنى للشراء (د.ع)</Label>
                <Input type="number" value={form.min_purchase_amount} onChange={e => setForm(p => ({ ...p, min_purchase_amount: Number(e.target.value) }))} className="h-10 rounded-xl" />
              </div>
            )}
            {showGift && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">وصف الهدية</Label>
                <Input value={form.gift_description} onChange={e => setForm(p => ({ ...p, gift_description: e.target.value }))} placeholder="مثال: ستيكر مجاني مع كل طلب" className="h-10 rounded-xl" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">صالح حتى (اختياري)</Label>
              <Input type="datetime-local" value={form.valid_until} onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))} className="h-10 rounded-xl" />
            </div>
            <Button 
              className="w-full h-11 rounded-xl font-bold text-sm" 
              onClick={() => saveMutation.mutate()} 
              disabled={saveMutation.isPending || !form.title_ar}
            >
              {editing ? "تحديث العرض" : "إنشاء العرض"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
