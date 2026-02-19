import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Gift, Tag, Plus, Pencil, Trash2, Trophy, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import AdminLayout, { AdminSection, AdminCard, AdminStatsGrid, AdminStatCard, AdminLoading, AdminEmptyState } from "@/components/admin/AdminLayout";

interface Giveaway {
  id: string;
  title_ar: string;
  description_ar: string | null;
  prize_name_ar: string;
  prize_image_url: string | null;
  prize_value: number;
  status: string;
  winner_merchant_id: string | null;
  max_participants: number | null;
  start_date: string;
  end_date: string | null;
  draw_date: string | null;
  product_id: string | null;
}

interface SpecialCoupon {
  id: string;
  title_ar: string;
  description_ar: string | null;
  coupon_type: string;
  discount_value: number;
  coupon_code: string | null;
  image_url: string | null;
  merchant_store_name: string | null;
  is_active: boolean;
  valid_until: string | null;
}

export default function AdminGiveawaysCoupons() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("giveaways");
  const [giveawayDialogOpen, setGiveawayDialogOpen] = useState(false);
  const [couponDialogOpen, setCouponDialogOpen] = useState(false);
  const [editingGiveaway, setEditingGiveaway] = useState<Giveaway | null>(null);
  const [editingCoupon, setEditingCoupon] = useState<SpecialCoupon | null>(null);

  // Form state for giveaway
  const [gForm, setGForm] = useState({
    title_ar: "", description_ar: "", prize_name_ar: "", prize_image_url: "",
    prize_value: 0, status: "draft", max_participants: 0, draw_date: "",
  });

  // Form state for coupon
  const [cForm, setCForm] = useState({
    title_ar: "", description_ar: "", coupon_type: "percentage",
    discount_value: 0, coupon_code: "", merchant_store_name: "", valid_until: "",
  });

  // Queries
  const { data: giveaways, isLoading: loadingG } = useQuery({
    queryKey: ["admin-giveaways"],
    queryFn: async () => {
      const { data, error } = await supabase.from("merchant_giveaways").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Giveaway[];
    },
  });

  const { data: entries } = useQuery({
    queryKey: ["admin-giveaway-entries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("merchant_giveaway_entries").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: coupons, isLoading: loadingC } = useQuery({
    queryKey: ["admin-special-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customer_special_coupons").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as SpecialCoupon[];
    },
  });

  // Giveaway mutations
  const saveGiveaway = useMutation({
    mutationFn: async () => {
      const payload = {
        title_ar: gForm.title_ar,
        description_ar: gForm.description_ar || null,
        prize_name_ar: gForm.prize_name_ar,
        prize_image_url: gForm.prize_image_url || null,
        prize_value: gForm.prize_value,
        status: gForm.status,
        max_participants: gForm.max_participants || null,
        draw_date: gForm.draw_date || null,
      };
      if (editingGiveaway) {
        const { error } = await supabase.from("merchant_giveaways").update(payload).eq("id", editingGiveaway.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("merchant_giveaways").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingGiveaway ? "تم التحديث" : "تم الإنشاء");
      queryClient.invalidateQueries({ queryKey: ["admin-giveaways"] });
      setGiveawayDialogOpen(false);
      setEditingGiveaway(null);
    },
    onError: () => toast.error("حدث خطأ"),
  });

  const deleteGiveaway = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("merchant_giveaways").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      queryClient.invalidateQueries({ queryKey: ["admin-giveaways"] });
    },
  });

  // Draw winner
  const drawWinner = useMutation({
    mutationFn: async (giveawayId: string) => {
      const gEntries = entries?.filter((e: any) => e.giveaway_id === giveawayId);
      if (!gEntries || gEntries.length === 0) throw new Error("لا يوجد مشاركون");
      const winner = gEntries[Math.floor(Math.random() * gEntries.length)];
      const { error } = await supabase.from("merchant_giveaways").update({
        winner_merchant_id: winner.merchant_id,
        status: "completed",
      }).eq("id", giveawayId);
      if (error) throw error;
      return winner.merchant_name;
    },
    onSuccess: (name) => {
      toast.success(`🎉 الفائز: ${name}`);
      queryClient.invalidateQueries({ queryKey: ["admin-giveaways"] });
      queryClient.invalidateQueries({ queryKey: ["admin-giveaway-entries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Coupon mutations
  const saveCoupon = useMutation({
    mutationFn: async () => {
      const payload = {
        title_ar: cForm.title_ar,
        description_ar: cForm.description_ar || null,
        coupon_type: cForm.coupon_type,
        discount_value: cForm.discount_value,
        coupon_code: cForm.coupon_code || null,
        merchant_store_name: cForm.merchant_store_name || null,
        valid_until: cForm.valid_until || null,
      };
      if (editingCoupon) {
        const { error } = await supabase.from("customer_special_coupons").update(payload).eq("id", editingCoupon.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customer_special_coupons").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingCoupon ? "تم التحديث" : "تم الإنشاء");
      queryClient.invalidateQueries({ queryKey: ["admin-special-coupons"] });
      setCouponDialogOpen(false);
      setEditingCoupon(null);
    },
    onError: () => toast.error("حدث خطأ"),
  });

  const deleteCoupon = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customer_special_coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      queryClient.invalidateQueries({ queryKey: ["admin-special-coupons"] });
    },
  });

  const openEditGiveaway = (g: Giveaway) => {
    setEditingGiveaway(g);
    setGForm({
      title_ar: g.title_ar, description_ar: g.description_ar || "",
      prize_name_ar: g.prize_name_ar, prize_image_url: g.prize_image_url || "",
      prize_value: g.prize_value, status: g.status,
      max_participants: g.max_participants || 0,
      draw_date: g.draw_date ? g.draw_date.slice(0, 16) : "",
    });
    setGiveawayDialogOpen(true);
  };

  const openNewGiveaway = () => {
    setEditingGiveaway(null);
    setGForm({ title_ar: "", description_ar: "", prize_name_ar: "", prize_image_url: "", prize_value: 0, status: "draft", max_participants: 0, draw_date: "" });
    setGiveawayDialogOpen(true);
  };

  const openEditCoupon = (c: SpecialCoupon) => {
    setEditingCoupon(c);
    setCForm({
      title_ar: c.title_ar, description_ar: c.description_ar || "",
      coupon_type: c.coupon_type, discount_value: c.discount_value,
      coupon_code: c.coupon_code || "", merchant_store_name: c.merchant_store_name || "",
      valid_until: c.valid_until ? c.valid_until.slice(0, 16) : "",
    });
    setCouponDialogOpen(true);
  };

  const openNewCoupon = () => {
    setEditingCoupon(null);
    setCForm({ title_ar: "", description_ar: "", coupon_type: "percentage", discount_value: 0, coupon_code: "", merchant_store_name: "", valid_until: "" });
    setCouponDialogOpen(true);
  };

  const getEntryCount = (id: string) => entries?.filter((e: any) => e.giveaway_id === id).length || 0;

  if (loadingG || loadingC) return <AdminLayout title="الهدايا والكوبونات" icon={<Gift className="h-5 w-5" />}><AdminLoading /></AdminLayout>;

  const statusLabels: Record<string, string> = { draft: "مسودة", active: "نشطة", completed: "مكتملة", cancelled: "ملغاة" };
  const statusColors: Record<string, string> = { draft: "bg-muted text-muted-foreground", active: "bg-green-500/10 text-green-600", completed: "bg-blue-500/10 text-blue-600", cancelled: "bg-red-500/10 text-red-600" };

  return (
    <AdminLayout title="الهدايا والكوبونات" icon={<Gift className="h-5 w-5" />} description="إدارة هدايا التجار وكوبونات العملاء">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full mb-6">
          <TabsTrigger value="giveaways" className="flex-1 gap-2"><Gift className="h-4 w-4" />هدايا التجار</TabsTrigger>
          <TabsTrigger value="coupons" className="flex-1 gap-2"><Tag className="h-4 w-4" />كوبونات العملاء</TabsTrigger>
        </TabsList>

        {/* Giveaways Tab */}
        <TabsContent value="giveaways" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openNewGiveaway} className="admin-btn-primary gap-2"><Plus className="h-4 w-4" />هدية جديدة</Button>
          </div>

          <AdminStatsGrid>
            <AdminStatCard icon={<Gift className="h-5 w-5" />} value={giveaways?.filter(g => g.status === "active").length || 0} label="نشطة" colorClass="text-green-600" bgClass="bg-green-500/10" />
            <AdminStatCard icon={<Users className="h-5 w-5" />} value={entries?.length || 0} label="إجمالي المشاركات" colorClass="text-primary" bgClass="bg-primary/10" />
            <AdminStatCard icon={<Trophy className="h-5 w-5" />} value={giveaways?.filter(g => g.status === "completed").length || 0} label="مكتملة" colorClass="text-blue-600" bgClass="bg-blue-500/10" />
            <AdminStatCard icon={<Gift className="h-5 w-5" />} value={giveaways?.length || 0} label="الإجمالي" colorClass="text-purple-600" bgClass="bg-purple-500/10" />
          </AdminStatsGrid>

          {!giveaways || giveaways.length === 0 ? (
            <AdminEmptyState icon={<Gift className="h-12 w-12" />} title="لا توجد هدايا" action={<Button onClick={openNewGiveaway} className="admin-btn-primary gap-2"><Plus className="h-4 w-4" />إنشاء هدية</Button>} />
          ) : (
            <div className="admin-grid-3">
              {giveaways.map((g) => (
                <AdminCard key={g.id} className="overflow-hidden">
                  {g.prize_image_url && (
                    <div className="aspect-video overflow-hidden"><img src={g.prize_image_url} alt="" className="w-full h-full object-cover" /></div>
                  )}
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm line-clamp-1">{g.title_ar}</h3>
                      <Badge className={statusColors[g.status]}>{statusLabels[g.status]}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{g.prize_name_ar}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{getEntryCount(g.id)}</span>
                      {g.winner_merchant_id && <span className="flex items-center gap-1 text-amber-600"><Trophy className="h-3 w-3" />فائز</span>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => openEditGiveaway(g)}><Pencil className="h-3 w-3 ml-1" />تعديل</Button>
                      {g.status === "active" && (
                        <Button size="sm" className="flex-1 text-xs bg-amber-500 hover:bg-amber-600 text-white" onClick={() => drawWinner.mutate(g.id)} disabled={drawWinner.isPending}>
                          <Trophy className="h-3 w-3 ml-1" />سحب
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" className="text-xs" onClick={() => { if (confirm("حذف؟")) deleteGiveaway.mutate(g.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </AdminCard>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Coupons Tab */}
        <TabsContent value="coupons" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openNewCoupon} className="admin-btn-primary gap-2"><Plus className="h-4 w-4" />كوبون جديد</Button>
          </div>

          {!coupons || coupons.length === 0 ? (
            <AdminEmptyState icon={<Tag className="h-12 w-12" />} title="لا توجد كوبونات" action={<Button onClick={openNewCoupon} className="admin-btn-primary gap-2"><Plus className="h-4 w-4" />إنشاء كوبون</Button>} />
          ) : (
            <div className="admin-grid-3">
              {coupons.map((c) => (
                <AdminCard key={c.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm line-clamp-1">{c.title_ar}</h3>
                    <Badge className={c.is_active ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}>
                      {c.is_active ? "نشط" : "معطل"}
                    </Badge>
                  </div>
                  {c.description_ar && <p className="text-xs text-muted-foreground line-clamp-2">{c.description_ar}</p>}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{c.coupon_type === "percentage" ? `${c.discount_value}%` : c.coupon_type === "free_delivery" ? "توصيل مجاني" : c.coupon_type === "free_product" ? "منتج هدية" : `${c.discount_value} د.ع`}</Badge>
                    {c.coupon_code && <code className="px-1.5 py-0.5 bg-muted rounded text-[10px]">{c.coupon_code}</code>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => openEditCoupon(c)}><Pencil className="h-3 w-3 ml-1" />تعديل</Button>
                    <Button size="sm" variant="destructive" className="text-xs" onClick={() => { if (confirm("حذف؟")) deleteCoupon.mutate(c.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </AdminCard>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Giveaway Dialog */}
      <Dialog open={giveawayDialogOpen} onOpenChange={setGiveawayDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingGiveaway ? "تعديل الهدية" : "هدية جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>العنوان</Label><Input value={gForm.title_ar} onChange={e => setGForm(p => ({ ...p, title_ar: e.target.value }))} /></div>
            <div><Label>الوصف</Label><Textarea value={gForm.description_ar} onChange={e => setGForm(p => ({ ...p, description_ar: e.target.value }))} /></div>
            <div><Label>اسم الجائزة</Label><Input value={gForm.prize_name_ar} onChange={e => setGForm(p => ({ ...p, prize_name_ar: e.target.value }))} /></div>
            <div><Label>رابط صورة الجائزة</Label><Input value={gForm.prize_image_url} onChange={e => setGForm(p => ({ ...p, prize_image_url: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>القيمة</Label><Input type="number" value={gForm.prize_value} onChange={e => setGForm(p => ({ ...p, prize_value: +e.target.value }))} /></div>
              <div><Label>الحد الأقصى</Label><Input type="number" value={gForm.max_participants} onChange={e => setGForm(p => ({ ...p, max_participants: +e.target.value }))} /></div>
            </div>
            <div><Label>الحالة</Label>
              <Select value={gForm.status} onValueChange={v => setGForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">مسودة</SelectItem>
                  <SelectItem value="active">نشطة</SelectItem>
                  <SelectItem value="completed">مكتملة</SelectItem>
                  <SelectItem value="cancelled">ملغاة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>تاريخ السحب</Label><Input type="datetime-local" value={gForm.draw_date} onChange={e => setGForm(p => ({ ...p, draw_date: e.target.value }))} /></div>
            <Button className="w-full" onClick={() => saveGiveaway.mutate()} disabled={saveGiveaway.isPending || !gForm.title_ar || !gForm.prize_name_ar}>
              {saveGiveaway.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingGiveaway ? "تحديث" : "إنشاء"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Coupon Dialog */}
      <Dialog open={couponDialogOpen} onOpenChange={setCouponDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingCoupon ? "تعديل الكوبون" : "كوبون جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>العنوان</Label><Input value={cForm.title_ar} onChange={e => setCForm(p => ({ ...p, title_ar: e.target.value }))} /></div>
            <div><Label>الوصف</Label><Textarea value={cForm.description_ar} onChange={e => setCForm(p => ({ ...p, description_ar: e.target.value }))} /></div>
            <div><Label>نوع الكوبون</Label>
              <Select value={cForm.coupon_type} onValueChange={v => setCForm(p => ({ ...p, coupon_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">خصم نسبة %</SelectItem>
                  <SelectItem value="free_delivery">توصيل مجاني</SelectItem>
                  <SelectItem value="free_product">منتج هدية</SelectItem>
                  <SelectItem value="fixed_amount">خصم مبلغ ثابت</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>القيمة</Label><Input type="number" value={cForm.discount_value} onChange={e => setCForm(p => ({ ...p, discount_value: +e.target.value }))} /></div>
              <div><Label>كود الكوبون</Label><Input value={cForm.coupon_code} onChange={e => setCForm(p => ({ ...p, coupon_code: e.target.value }))} /></div>
            </div>
            <div><Label>اسم المتجر (اختياري)</Label><Input value={cForm.merchant_store_name} onChange={e => setCForm(p => ({ ...p, merchant_store_name: e.target.value }))} /></div>
            <div><Label>صالح حتى</Label><Input type="datetime-local" value={cForm.valid_until} onChange={e => setCForm(p => ({ ...p, valid_until: e.target.value }))} /></div>
            <Button className="w-full" onClick={() => saveCoupon.mutate()} disabled={saveCoupon.isPending || !cForm.title_ar}>
              {saveCoupon.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingCoupon ? "تحديث" : "إنشاء"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
