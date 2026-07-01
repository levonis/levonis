import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Gift, Trophy } from "lucide-react";

export default function AdminLevelPrizesTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrize, setEditingPrize] = useState<any>(null);
  const [levelNumber, setLevelNumber] = useState("5");
  const [titleAr, setTitleAr] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [prizeType, setPrizeType] = useState("custom");
  const [prizeValue, setPrizeValue] = useState("0");
  const [imageUrl, setImageUrl] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [autoGrant, setAutoGrant] = useState(true);
  const [couponCode, setCouponCode] = useState("");
  const [ticketsCount, setTicketsCount] = useState("");
  const [productId, setProductId] = useState("");
  const [isRandomProduct, setIsRandomProduct] = useState(false);
  const [showClaims, setShowClaims] = useState(false);

  const { data: levels } = useQuery({
    queryKey: ['admin-loyalty-levels-prizes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_levels')
        .select('id, level_number, name_ar, color')
        .order('level_number', { ascending: true });
      if (error) throw error;
      return (data || []).filter((l: any) => l.level_number && l.level_number % 5 === 0);
    },
  });

  const { data: prizes, isLoading } = useQuery({
    queryKey: ['admin-level-prizes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('level_prizes')
        .select('*')
        .order('level_number', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: claims } = useQuery({
    queryKey: ['admin-level-prize-claims'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_level_prize_claims')
        .select('*, level_prizes:prize_id(title_ar, prize_type), profiles:user_id(full_name, username)')
        .in('status', ['requested', 'pending', 'shipped'])
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: showClaims,
  });

  const savePrize = useMutation({
    mutationFn: async () => {
      const ln = parseInt(levelNumber);
      // Find matching level_id from level_number
      const level = levels?.find((l: any) => l.level_number === ln);
      if (!level) throw new Error('المستوى غير موجود (يجب أن يكون مضاعفاً للـ 5)');

      const prizeData: any = {
        level_id: level.id,
        level_number: ln,
        title_ar: titleAr,
        description_ar: descriptionAr || null,
        prize_type: prizeType,
        prize_value: parseFloat(prizeValue) || 0,
        image_url: imageUrl || null,
        display_order: parseInt(displayOrder),
        is_active: isActive,
        auto_grant: autoGrant,
        coupon_code: couponCode || null,
        tickets_count: ticketsCount ? parseInt(ticketsCount) : null,
        product_id: productId || null,
        is_random_product: isRandomProduct,
      };

      if (editingPrize) {
        const { error } = await supabase.from('level_prizes').update(prizeData).eq('id', editingPrize.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('level_prizes').insert(prizeData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-level-prizes'] });
      queryClient.invalidateQueries({ queryKey: ['level-prizes'] });
      toast.success(editingPrize ? "تم تعديل الجائزة" : "تم إضافة الجائزة");
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePrize = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('level_prizes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-level-prizes'] });
      toast.success("تم الحذف");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateClaim = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { data, error } = await supabase.rpc('admin_update_level_prize_claim', {
        p_claim_id: id,
        p_new_status: status,
        p_notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-level-prize-claims'] });
      toast.success('تم التحديث');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setIsDialogOpen(false);
    setEditingPrize(null);
    setLevelNumber("5");
    setTitleAr("");
    setDescriptionAr("");
    setPrizeType("custom");
    setPrizeValue("0");
    setImageUrl("");
    setDisplayOrder("0");
    setIsActive(true);
    setAutoGrant(true);
    setCouponCode("");
    setTicketsCount("");
    setProductId("");
    setIsRandomProduct(false);
  };

  const openEdit = (prize: any) => {
    setEditingPrize(prize);
    setLevelNumber(String(prize.level_number || 5));
    setTitleAr(prize.title_ar);
    setDescriptionAr(prize.description_ar || "");
    setPrizeType(prize.prize_type);
    setPrizeValue(prize.prize_value?.toString() || "0");
    setImageUrl(prize.image_url || "");
    setDisplayOrder(prize.display_order?.toString() || "0");
    setIsActive(prize.is_active);
    setAutoGrant(prize.auto_grant ?? true);
    setCouponCode(prize.coupon_code || "");
    setTicketsCount(prize.tickets_count?.toString() || "");
    setProductId(prize.product_id || "");
    setIsRandomProduct(prize.is_random_product ?? false);
    setIsDialogOpen(true);
  };

  // Auto-set auto_grant based on type
  const onTypeChange = (newType: string) => {
    setPrizeType(newType);
    if (['points', 'tickets', 'coupon'].includes(newType)) setAutoGrant(true);
    else if (['product', 'random_product', 'card'].includes(newType)) setAutoGrant(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-bold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          جوائز المستويات (كل 5 مستويات)
        </h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowClaims(!showClaims)}>
            {showClaims ? 'الجوائز' : 'طلبات المستخدمين'}
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gap-1">
            <Plus className="h-4 w-4" /> إضافة
          </Button>
        </div>
      </div>

      {showClaims ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">طلبات المستخدمين بانتظار معالجة الإدارة</p>
          {!claims || claims.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">لا توجد طلبات حالياً</CardContent></Card>
          ) : claims.map((c: any) => (
            <Card key={c.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{c.level_prizes?.title_ar}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {c.profiles?.full_name || c.profiles?.username || c.user_id.slice(0, 8)} • مستوى {c.level_number} • {c.status}
                  </p>
                </div>
                <Select value="" onValueChange={(v) => updateClaim.mutate({ id: c.id, status: v })}>
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="تغيير الحالة" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="granted">مُسلَّمة</SelectItem>
                    <SelectItem value="shipped">شُحنت</SelectItem>
                    <SelectItem value="delivered">تم الاستلام</SelectItem>
                    <SelectItem value="cancelled">إلغاء</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-4">جاري التحميل...</p>
      ) : prizes?.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Gift className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">لا توجد جوائز بعد</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {prizes?.map((prize: any) => (
            <Card key={prize.id} className={!prize.is_active ? 'opacity-50' : ''}>
              <CardContent className="p-3 flex items-center gap-3">
                {prize.image_url ? (
                  <img src={prize.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" loading="lazy" decoding="async" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center">
                    <Gift className="h-5 w-5 text-purple-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{prize.title_ar}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[9px] px-1.5">المستوى {prize.level_number}</Badge>
                    <Badge variant="outline" className="text-[9px] px-1.5">{prize.prize_type}</Badge>
                    {prize.auto_grant ? (
                      <Badge className="text-[9px] bg-green-500/15 text-green-600 border-0 px-1.5">تلقائي</Badge>
                    ) : (
                      <Badge className="text-[9px] bg-amber-500/15 text-amber-600 border-0 px-1.5">يدوي</Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(prize)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => deletePrize.mutate(prize.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPrize ? "تعديل جائزة" : "إضافة جائزة جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>المستوى (مضاعفات الـ 5)</Label>
              <Select value={levelNumber} onValueChange={setLevelNumber}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {levels?.map((l: any) => (
                    <SelectItem key={l.id} value={String(l.level_number)}>
                      <span style={{ color: l.color }}>●</span> المستوى {l.level_number} ({l.name_ar})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>اسم الجائزة</Label>
              <Input value={titleAr} onChange={e => setTitleAr(e.target.value)} placeholder="مثال: كوبون 5000 د.ع" />
            </div>
            <div>
              <Label>الوصف</Label>
              <Textarea value={descriptionAr} onChange={e => setDescriptionAr(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>نوع الجائزة</Label>
              <Select value={prizeType} onValueChange={onTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="points">نقاط (تلقائي)</SelectItem>
                  <SelectItem value="tickets">تذاكر (تلقائي)</SelectItem>
                  <SelectItem value="coupon">كوبون خصم</SelectItem>
                  <SelectItem value="product">منتج (يدوي/شحن)</SelectItem>
                  <SelectItem value="random_product">منتج عشوائي (يدوي)</SelectItem>
                  <SelectItem value="card">بطاقة ولاء (يدوي)</SelectItem>
                  <SelectItem value="custom">مخصص</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Type-specific fields */}
            {prizeType === 'points' && (
              <div>
                <Label>عدد النقاط</Label>
                <Input type="number" value={prizeValue} onChange={e => setPrizeValue(e.target.value)} />
              </div>
            )}
            {prizeType === 'tickets' && (
              <div>
                <Label>عدد التذاكر</Label>
                <Input type="number" value={ticketsCount} onChange={e => setTicketsCount(e.target.value)} />
              </div>
            )}
            {prizeType === 'coupon' && (
              <>
                <div>
                  <Label>كود الكوبون</Label>
                  <Input value={couponCode} onChange={e => setCouponCode(e.target.value)} dir="ltr" placeholder="LEVEL10-GIFT" />
                </div>
                <div>
                  <Label>قيمة الخصم</Label>
                  <Input type="number" value={prizeValue} onChange={e => setPrizeValue(e.target.value)} />
                </div>
              </>
            )}
            {prizeType === 'product' && (
              <div>
                <Label>معرّف المنتج (UUID)</Label>
                <Input value={productId} onChange={e => setProductId(e.target.value)} dir="ltr" placeholder="product-uuid" />
              </div>
            )}
            {prizeType === 'random_product' && (
              <div className="flex items-center gap-2">
                <Switch checked={isRandomProduct} onCheckedChange={setIsRandomProduct} />
                <Label>منتج عشوائي من المتجر</Label>
              </div>
            )}

            <div>
              <Label>صورة (رابط)</Label>
              <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} dir="ltr" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ترتيب العرض</Label>
                <Input type="number" value={displayOrder} onChange={e => setDisplayOrder(e.target.value)} />
              </div>
              <div className="space-y-2 pt-5">
                <div className="flex items-center gap-2">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                  <Label className="text-xs">نشط</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={autoGrant} onCheckedChange={setAutoGrant} />
                  <Label className="text-xs">منح تلقائي</Label>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              💡 التلقائي = يُمنح فوراً عند بلوغ المستوى. اليدوي = يظهر للمستخدم في "جوائزي" لطلب الشحن.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>إلغاء</Button>
            <Button onClick={() => savePrize.mutate()} disabled={!levelNumber || !titleAr || savePrize.isPending}>
              {editingPrize ? "تعديل" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
