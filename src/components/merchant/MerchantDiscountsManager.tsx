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
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Percent, Truck, Gift, Tag, Edit, Sparkles } from "lucide-react";
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
  { value: "percentage", label: "خصم نسبة %", icon: Percent },
  { value: "fixed_amount", label: "خصم مبلغ ثابت", icon: Tag },
  { value: "free_delivery", label: "توصيل مجاني", icon: Truck },
  { value: "free_gift", label: "هدية مع الطلب", icon: Gift },
  { value: "min_purchase_percentage", label: "خصم عند حد أدنى", icon: Percent },
  { value: "min_purchase_delivery", label: "توصيل مجاني عند حد أدنى", icon: Truck },
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">العروض والخصومات</h3>
          <Badge variant="outline" className="text-[9px]">{discounts.length}</Badge>
        </div>
        <Button size="sm" className="h-8 text-xs gap-1" onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5" />
          عرض جديد
        </Button>
      </div>

      {discounts.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <Gift className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">لم تنشئ أي عروض بعد</p>
          </CardContent>
        </Card>
      )}

      {discounts.map(d => {
        const typeInfo = typeOptions.find(t => t.value === d.discount_type);
        const Icon = typeInfo?.icon || Percent;
        return (
          <Card key={d.id} className="border-border/40">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-foreground truncate">{d.title_ar}</h4>
                  {!d.is_active && <Badge variant="secondary" className="text-[8px]">معطل</Badge>}
                </div>
                <p className="text-[10px] text-muted-foreground">{typeInfo?.label}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Switch checked={d.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: d.id, active: v })} />
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(d)}>
                  <Edit className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteMutation.mutate(d.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل العرض" : "عرض جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>عنوان العرض</Label>
              <Input value={form.title_ar} onChange={e => setForm(p => ({ ...p, title_ar: e.target.value }))} placeholder="مثال: خصم 10% على كل الطلبات" />
            </div>
            <div>
              <Label>الوصف</Label>
              <Textarea value={form.description_ar} onChange={e => setForm(p => ({ ...p, description_ar: e.target.value }))} rows={2} />
            </div>
            <div>
              <Label>نوع الخصم</Label>
              <Select value={form.discount_type} onValueChange={v => setForm(p => ({ ...p, discount_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {typeOptions.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showValue && form.discount_type !== "free_delivery" && (
              <div>
                <Label>{form.discount_type === "percentage" || form.discount_type === "min_purchase_percentage" ? "نسبة الخصم %" : "مبلغ الخصم (د.ع)"}</Label>
                <Input type="number" value={form.discount_value} onChange={e => setForm(p => ({ ...p, discount_value: Number(e.target.value) }))} />
              </div>
            )}
            {showMinPurchase && (
              <div>
                <Label>الحد الأدنى للشراء (د.ع)</Label>
                <Input type="number" value={form.min_purchase_amount} onChange={e => setForm(p => ({ ...p, min_purchase_amount: Number(e.target.value) }))} />
              </div>
            )}
            {showGift && (
              <div>
                <Label>وصف الهدية</Label>
                <Input value={form.gift_description} onChange={e => setForm(p => ({ ...p, gift_description: e.target.value }))} placeholder="مثال: ستيكر مجاني مع كل طلب" />
              </div>
            )}
            <div>
              <Label>صالح حتى (اختياري)</Label>
              <Input type="datetime-local" value={form.valid_until} onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.title_ar}>
              {editing ? "تحديث" : "إنشاء العرض"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
