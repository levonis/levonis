import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Gift, Ticket, Mail, Plus, Trash2, Edit2, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const subTabs = [
  { id: "competitions", label: "مسابقات التجار", icon: Trophy },
  { id: "gifts", label: "الهدايا", icon: Gift },
  { id: "coupons", label: "الكوبونات", icon: Ticket },
  { id: "envelopes", label: "الظروف الحمراء", icon: Mail },
] as const;

type SubTab = typeof subTabs[number]["id"];

// ── Merchant Competitions Tab ──
function CompetitionsTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title_ar: "", prize_name_ar: "", description_ar: "", prize_value: 0, prize_image_url: "", start_date: "", end_date: "", draw_date: "", max_participants: 0 });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-merchant-giveaways"],
    queryFn: async () => {
      const { data, error } = await supabase.from("merchant_giveaways").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, prize_value: form.prize_value || null, max_participants: form.max_participants || null, draw_date: form.draw_date || null, end_date: form.end_date || null, prize_image_url: form.prize_image_url || null, description_ar: form.description_ar || null };
      if (editing) {
        const { error } = await supabase.from("merchant_giveaways").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("merchant_giveaways").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "تم التحديث" : "تمت الإضافة");
      queryClient.invalidateQueries({ queryKey: ["admin-merchant-giveaways"] });
      resetForm();
    },
    onError: () => toast.error("حدث خطأ"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("merchant_giveaways").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      queryClient.invalidateQueries({ queryKey: ["admin-merchant-giveaways"] });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ title_ar: "", prize_name_ar: "", description_ar: "", prize_value: 0, prize_image_url: "", start_date: "", end_date: "", draw_date: "", max_participants: 0 });
  };

  const startEdit = (item: any) => {
    setEditing(item);
    setForm({ title_ar: item.title_ar, prize_name_ar: item.prize_name_ar, description_ar: item.description_ar || "", prize_value: item.prize_value || 0, prize_image_url: item.prize_image_url || "", start_date: item.start_date?.split("T")[0] || "", end_date: item.end_date?.split("T")[0] || "", draw_date: item.draw_date?.split("T")[0] || "", max_participants: item.max_participants || 0 });
    setShowForm(true);
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{items.length} مسابقة</span>
        <Button size="sm" className="h-7 text-[10px] gap-1" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-3 w-3" /> إضافة مسابقة
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={(o) => !o && resetForm()}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-sm">{editing ? "تعديل مسابقة" : "إضافة مسابقة"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-[10px]">العنوان</Label><Input value={form.title_ar} onChange={e => setForm(f => ({ ...f, title_ar: e.target.value }))} className="h-8 text-xs" /></div>
            <div><Label className="text-[10px]">اسم الجائزة</Label><Input value={form.prize_name_ar} onChange={e => setForm(f => ({ ...f, prize_name_ar: e.target.value }))} className="h-8 text-xs" /></div>
            <div><Label className="text-[10px]">الوصف</Label><Input value={form.description_ar} onChange={e => setForm(f => ({ ...f, description_ar: e.target.value }))} className="h-8 text-xs" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-[10px]">قيمة الجائزة</Label><Input type="number" value={form.prize_value} onChange={e => setForm(f => ({ ...f, prize_value: Number(e.target.value) }))} className="h-8 text-xs" /></div>
              <div><Label className="text-[10px]">الحد الأقصى للمشاركين</Label><Input type="number" value={form.max_participants} onChange={e => setForm(f => ({ ...f, max_participants: Number(e.target.value) }))} className="h-8 text-xs" /></div>
            </div>
            <div><Label className="text-[10px]">رابط صورة الجائزة</Label><Input value={form.prize_image_url} onChange={e => setForm(f => ({ ...f, prize_image_url: e.target.value }))} className="h-8 text-xs" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-[10px]">تاريخ البدء</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="h-8 text-xs" /></div>
              <div><Label className="text-[10px]">تاريخ الانتهاء</Label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="h-8 text-xs" /></div>
              <div><Label className="text-[10px]">تاريخ السحب</Label><Input type="date" value={form.draw_date} onChange={e => setForm(f => ({ ...f, draw_date: e.target.value }))} className="h-8 text-xs" /></div>
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.title_ar || !form.prize_name_ar} className="w-full h-8 text-xs">
              {saveMutation.isPending ? "جارٍ الحفظ..." : editing ? "تحديث" : "إضافة"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border border-border/40 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px] text-right">العنوان</TableHead>
              <TableHead className="text-[10px] text-right">الجائزة</TableHead>
              <TableHead className="text-[10px] text-right">الحالة</TableHead>
              <TableHead className="text-[10px] text-right">الفائز</TableHead>
              <TableHead className="text-[10px] text-right w-20">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => (
              <TableRow key={item.id}>
                <TableCell className="text-xs font-medium">{item.title_ar}</TableCell>
                <TableCell className="text-xs">{item.prize_name_ar}</TableCell>
                <TableCell>
                  <Badge variant={item.status === "active" ? "default" : "secondary"} className="text-[9px]">
                    {item.status === "active" ? "نشطة" : item.status === "completed" ? "منتهية" : item.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {item.winner_merchant_id ? <div className="flex items-center gap-1"><Crown className="h-3 w-3 text-primary" /><span className="text-[10px]">تم التحديد</span></div> : <span className="text-muted-foreground text-[10px]">-</span>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => startEdit(item)}><Edit2 className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Gifts Tab ──
function GiftsTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title_ar: "", description_ar: "", image_url: "", max_claims: 10, is_active: true });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-assistance-gifts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assistance_gifts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: claims = [] } = useQuery({
    queryKey: ["admin-gift-claims"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assistance_gift_claims").select("*");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { title_ar: form.title_ar, description_ar: form.description_ar || null, image_url: form.image_url || null, max_claims: form.max_claims, is_active: form.is_active };
      if (editing) {
        const { error } = await supabase.from("assistance_gifts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("assistance_gifts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "تم التحديث" : "تمت الإضافة");
      queryClient.invalidateQueries({ queryKey: ["admin-assistance-gifts"] });
      resetForm();
    },
    onError: () => toast.error("حدث خطأ"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assistance_gifts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      queryClient.invalidateQueries({ queryKey: ["admin-assistance-gifts"] });
    },
  });

  const resetForm = () => { setShowForm(false); setEditing(null); setForm({ title_ar: "", description_ar: "", image_url: "", max_claims: 10, is_active: true }); };

  const startEdit = (item: any) => {
    setEditing(item);
    setForm({ title_ar: item.title_ar, description_ar: item.description_ar || "", image_url: item.image_url || "", max_claims: item.max_claims, is_active: item.is_active });
    setShowForm(true);
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{items.length} هدية</span>
        <Button size="sm" className="h-7 text-[10px] gap-1" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-3 w-3" /> إضافة هدية
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={(o) => !o && resetForm()}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-sm">{editing ? "تعديل هدية" : "إضافة هدية"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-[10px]">العنوان</Label><Input value={form.title_ar} onChange={e => setForm(f => ({ ...f, title_ar: e.target.value }))} className="h-8 text-xs" /></div>
            <div><Label className="text-[10px]">الوصف</Label><Input value={form.description_ar} onChange={e => setForm(f => ({ ...f, description_ar: e.target.value }))} className="h-8 text-xs" /></div>
            <div><Label className="text-[10px]">رابط الصورة</Label><Input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} className="h-8 text-xs" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-[10px]">الحد الأقصى للتحصيل</Label><Input type="number" value={form.max_claims} onChange={e => setForm(f => ({ ...f, max_claims: Number(e.target.value) }))} className="h-8 text-xs" /></div>
              <div className="flex items-center gap-2 pt-4"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label className="text-[10px]">نشط</Label></div>
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.title_ar} className="w-full h-8 text-xs">
              {saveMutation.isPending ? "جارٍ الحفظ..." : editing ? "تحديث" : "إضافة"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border border-border/40 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px] text-right">العنوان</TableHead>
              <TableHead className="text-[10px] text-right">التحصيلات</TableHead>
              <TableHead className="text-[10px] text-right">الحالة</TableHead>
              <TableHead className="text-[10px] text-right w-20">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => {
              const itemClaims = claims.filter(c => c.gift_id === item.id).length;
              return (
                <TableRow key={item.id}>
                  <TableCell className="text-xs font-medium">{item.title_ar}</TableCell>
                  <TableCell className="text-xs">{itemClaims} / {item.max_claims}</TableCell>
                  <TableCell><Badge variant={item.is_active ? "default" : "secondary"} className="text-[9px]">{item.is_active ? "نشط" : "معطل"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => startEdit(item)}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Coupons Tab ──
function CouponsTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title_ar: "", description_ar: "", discount_type: "percentage" as string, discount_value: 10, max_claims: 50, is_active: true, valid_until: "" });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-assistance-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assistance_coupons").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: claims = [] } = useQuery({
    queryKey: ["admin-coupon-claims"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assistance_coupon_claims").select("*");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { title_ar: form.title_ar, description_ar: form.description_ar || null, discount_type: form.discount_type, discount_value: form.discount_value, max_claims: form.max_claims, is_active: form.is_active, valid_until: form.valid_until || null };
      if (editing) {
        const { error } = await supabase.from("assistance_coupons").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("assistance_coupons").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "تم التحديث" : "تمت الإضافة");
      queryClient.invalidateQueries({ queryKey: ["admin-assistance-coupons"] });
      resetForm();
    },
    onError: () => toast.error("حدث خطأ"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assistance_coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      queryClient.invalidateQueries({ queryKey: ["admin-assistance-coupons"] });
    },
  });

  const resetForm = () => { setShowForm(false); setEditing(null); setForm({ title_ar: "", description_ar: "", discount_type: "percentage", discount_value: 10, max_claims: 50, is_active: true, valid_until: "" }); };

  const startEdit = (item: any) => {
    setEditing(item);
    setForm({ title_ar: item.title_ar, description_ar: item.description_ar || "", discount_type: item.discount_type, discount_value: item.discount_value, max_claims: item.max_claims, is_active: item.is_active, valid_until: item.valid_until?.split("T")[0] || "" });
    setShowForm(true);
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{items.length} كوبون</span>
        <Button size="sm" className="h-7 text-[10px] gap-1" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-3 w-3" /> إضافة كوبون
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={(o) => !o && resetForm()}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-sm">{editing ? "تعديل كوبون" : "إضافة كوبون"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-[10px]">العنوان</Label><Input value={form.title_ar} onChange={e => setForm(f => ({ ...f, title_ar: e.target.value }))} className="h-8 text-xs" /></div>
            <div><Label className="text-[10px]">الوصف</Label><Input value={form.description_ar} onChange={e => setForm(f => ({ ...f, description_ar: e.target.value }))} className="h-8 text-xs" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">نوع الخصم</Label>
                <Select value={form.discount_type} onValueChange={v => setForm(f => ({ ...f, discount_type: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage" className="text-xs">نسبة مئوية %</SelectItem>
                    <SelectItem value="fixed" className="text-xs">مبلغ ثابت</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-[10px]">قيمة الخصم</Label><Input type="number" value={form.discount_value} onChange={e => setForm(f => ({ ...f, discount_value: Number(e.target.value) }))} className="h-8 text-xs" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-[10px]">العدد المحدود</Label><Input type="number" value={form.max_claims} onChange={e => setForm(f => ({ ...f, max_claims: Number(e.target.value) }))} className="h-8 text-xs" /></div>
              <div><Label className="text-[10px]">صالح حتى</Label><Input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} className="h-8 text-xs" /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label className="text-[10px]">نشط</Label></div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.title_ar} className="w-full h-8 text-xs">
              {saveMutation.isPending ? "جارٍ الحفظ..." : editing ? "تحديث" : "إضافة"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border border-border/40 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px] text-right">العنوان</TableHead>
              <TableHead className="text-[10px] text-right">الخصم</TableHead>
              <TableHead className="text-[10px] text-right">التحصيلات</TableHead>
              <TableHead className="text-[10px] text-right">الحالة</TableHead>
              <TableHead className="text-[10px] text-right w-20">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => {
              const itemClaims = claims.filter(c => c.coupon_id === item.id).length;
              return (
                <TableRow key={item.id}>
                  <TableCell className="text-xs font-medium">{item.title_ar}</TableCell>
                  <TableCell className="text-xs">{item.discount_type === "percentage" ? `${item.discount_value}%` : `${item.discount_value.toLocaleString()} د.ع`}</TableCell>
                  <TableCell className="text-xs">{itemClaims} / {item.max_claims}</TableCell>
                  <TableCell><Badge variant={item.is_active ? "default" : "secondary"} className="text-[9px]">{item.is_active ? "نشط" : "معطل"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => startEdit(item)}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Red Envelopes Tab ──
function EnvelopesTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title_ar: "", description_ar: "", spend_threshold: 50000, discount_amount: 5000, max_discount: 15000, max_claims: 100, is_limited: true, is_active: true });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-assistance-envelopes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assistance_red_envelopes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: claims = [] } = useQuery({
    queryKey: ["admin-envelope-claims"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assistance_envelope_claims").select("*");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { title_ar: form.title_ar, description_ar: form.description_ar || null, spend_threshold: form.spend_threshold, discount_amount: form.discount_amount, max_discount: form.max_discount, max_claims: form.is_limited ? form.max_claims : null, is_limited: form.is_limited, is_active: form.is_active };
      if (editing) {
        const { error } = await supabase.from("assistance_red_envelopes").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("assistance_red_envelopes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "تم التحديث" : "تمت الإضافة");
      queryClient.invalidateQueries({ queryKey: ["admin-assistance-envelopes"] });
      resetForm();
    },
    onError: () => toast.error("حدث خطأ"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assistance_red_envelopes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      queryClient.invalidateQueries({ queryKey: ["admin-assistance-envelopes"] });
    },
  });

  const resetForm = () => { setShowForm(false); setEditing(null); setForm({ title_ar: "", description_ar: "", spend_threshold: 50000, discount_amount: 5000, max_discount: 15000, max_claims: 100, is_limited: true, is_active: true }); };

  const startEdit = (item: any) => {
    setEditing(item);
    setForm({ title_ar: item.title_ar, description_ar: item.description_ar || "", spend_threshold: item.spend_threshold, discount_amount: item.discount_amount, max_discount: item.max_discount, max_claims: item.max_claims || 100, is_limited: item.is_limited, is_active: item.is_active });
    setShowForm(true);
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{items.length} ظرف</span>
        <Button size="sm" className="h-7 text-[10px] gap-1" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-3 w-3" /> إضافة ظرف
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={(o) => !o && resetForm()}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-sm">{editing ? "تعديل ظرف" : "إضافة ظرف"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-[10px]">العنوان</Label><Input value={form.title_ar} onChange={e => setForm(f => ({ ...f, title_ar: e.target.value }))} className="h-8 text-xs" /></div>
            <div><Label className="text-[10px]">الوصف</Label><Input value={form.description_ar} onChange={e => setForm(f => ({ ...f, description_ar: e.target.value }))} className="h-8 text-xs" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-[10px]">حد الإنفاق</Label><Input type="number" value={form.spend_threshold} onChange={e => setForm(f => ({ ...f, spend_threshold: Number(e.target.value) }))} className="h-8 text-xs" /></div>
              <div><Label className="text-[10px]">مبلغ الخصم</Label><Input type="number" value={form.discount_amount} onChange={e => setForm(f => ({ ...f, discount_amount: Number(e.target.value) }))} className="h-8 text-xs" /></div>
              <div><Label className="text-[10px]">الحد الأعلى</Label><Input type="number" value={form.max_discount} onChange={e => setForm(f => ({ ...f, max_discount: Number(e.target.value) }))} className="h-8 text-xs" /></div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2"><Switch checked={form.is_limited} onCheckedChange={v => setForm(f => ({ ...f, is_limited: v }))} /><Label className="text-[10px]">محدود العدد</Label></div>
              {form.is_limited && <Input type="number" value={form.max_claims} onChange={e => setForm(f => ({ ...f, max_claims: Number(e.target.value) }))} className="h-8 text-xs w-24" placeholder="العدد" />}
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label className="text-[10px]">نشط</Label></div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.title_ar} className="w-full h-8 text-xs">
              {saveMutation.isPending ? "جارٍ الحفظ..." : editing ? "تحديث" : "إضافة"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border border-border/40 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px] text-right">العنوان</TableHead>
              <TableHead className="text-[10px] text-right">الآلية</TableHead>
              <TableHead className="text-[10px] text-right">التحصيلات</TableHead>
              <TableHead className="text-[10px] text-right">الحالة</TableHead>
              <TableHead className="text-[10px] text-right w-20">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => {
              const itemClaims = claims.filter(c => c.envelope_id === item.id).length;
              return (
                <TableRow key={item.id}>
                  <TableCell className="text-xs font-medium">{item.title_ar}</TableCell>
                  <TableCell className="text-[10px]">كل {item.spend_threshold.toLocaleString()} → {item.discount_amount.toLocaleString()} (حد {item.max_discount.toLocaleString()})</TableCell>
                  <TableCell className="text-xs">{itemClaims}{item.is_limited ? ` / ${item.max_claims}` : ""}</TableCell>
                  <TableCell><Badge variant={item.is_active ? "default" : "secondary"} className="text-[9px]">{item.is_active ? "نشط" : "معطل"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => startEdit(item)}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Main Component ──
export default function AdminAssistanceManager() {
  const [activeTab, setActiveTab] = useState<SubTab>("competitions");

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide border-b border-border/40 pb-2">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all whitespace-nowrap",
              activeTab === tab.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <tab.icon className="h-3 w-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "competitions" && <CompetitionsTab />}
      {activeTab === "gifts" && <GiftsTab />}
      {activeTab === "coupons" && <CouponsTab />}
      {activeTab === "envelopes" && <EnvelopesTab />}
    </div>
  );
}
