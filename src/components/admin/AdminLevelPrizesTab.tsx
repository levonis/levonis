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
  const [levelId, setLevelId] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [prizeType, setPrizeType] = useState("custom");
  const [prizeValue, setPrizeValue] = useState("0");
  const [imageUrl, setImageUrl] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);

  const { data: levels } = useQuery({
    queryKey: ['admin-loyalty-levels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_levels')
        .select('id, name_ar, color, display_order')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: prizes, isLoading } = useQuery({
    queryKey: ['admin-level-prizes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('level_prizes')
        .select('*, loyalty_levels:level_id(name_ar, color)')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const savePrize = useMutation({
    mutationFn: async () => {
      const prizeData = {
        level_id: levelId,
        title_ar: titleAr,
        description_ar: descriptionAr || null,
        prize_type: prizeType,
        prize_value: parseFloat(prizeValue) || 0,
        image_url: imageUrl || null,
        display_order: parseInt(displayOrder),
        is_active: isActive,
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
      toast.success("تم حذف الجائزة");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setIsDialogOpen(false);
    setEditingPrize(null);
    setLevelId("");
    setTitleAr("");
    setDescriptionAr("");
    setPrizeType("custom");
    setPrizeValue("0");
    setImageUrl("");
    setDisplayOrder("0");
    setIsActive(true);
  };

  const openEdit = (prize: any) => {
    setEditingPrize(prize);
    setLevelId(prize.level_id);
    setTitleAr(prize.title_ar);
    setDescriptionAr(prize.description_ar || "");
    setPrizeType(prize.prize_type);
    setPrizeValue(prize.prize_value?.toString() || "0");
    setImageUrl(prize.image_url || "");
    setDisplayOrder(prize.display_order?.toString() || "0");
    setIsActive(prize.is_active);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          جوائز المستويات
        </h3>
        <Button size="sm" onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gap-1">
          <Plus className="h-4 w-4" /> إضافة جائزة
        </Button>
      </div>

      {isLoading ? (
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
                  <img src={prize.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center">
                    <Gift className="h-5 w-5 text-purple-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{prize.title_ar}</p>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5"
                      style={{ borderColor: prize.loyalty_levels?.color, color: prize.loyalty_levels?.color }}
                    >
                      {prize.loyalty_levels?.name_ar}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{prize.prize_type}</span>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPrize ? "تعديل جائزة" : "إضافة جائزة جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>المستوى</Label>
              <Select value={levelId} onValueChange={setLevelId}>
                <SelectTrigger><SelectValue placeholder="اختر المستوى" /></SelectTrigger>
                <SelectContent>
                  {levels?.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      <span style={{ color: l.color }}>●</span> {l.name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>اسم الجائزة</Label>
              <Input value={titleAr} onChange={e => setTitleAr(e.target.value)} placeholder="مثال: كوبون خصم 5000" />
            </div>
            <div>
              <Label>الوصف (اختياري)</Label>
              <Textarea value={descriptionAr} onChange={e => setDescriptionAr(e.target.value)} placeholder="تفاصيل الجائزة" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>النوع</Label>
                <Select value={prizeType} onValueChange={setPrizeType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="points">نقاط</SelectItem>
                    <SelectItem value="coupon">كوبون</SelectItem>
                    <SelectItem value="product">منتج</SelectItem>
                    <SelectItem value="badge">شارة</SelectItem>
                    <SelectItem value="custom">مخصص</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>القيمة</Label>
                <Input type="number" value={prizeValue} onChange={e => setPrizeValue(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>رابط الصورة (اختياري)</Label>
              <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." dir="ltr" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ترتيب العرض</Label>
                <Input type="number" value={displayOrder} onChange={e => setDisplayOrder(e.target.value)} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>نشط</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>إلغاء</Button>
            <Button onClick={() => savePrize.mutate()} disabled={!levelId || !titleAr || savePrize.isPending}>
              {editingPrize ? "تعديل" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
