import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Pencil, Trash2, Ticket, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

const AdminCoupons = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: 0,
    min_purchase_amount: 0,
    max_uses: null as number | null,
    expires_at: '',
    active: true,
  });

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
      toast.error('ليس لديك صلاحية الوصول');
    }
  }, [user, isAdmin, authLoading, navigate]);

  const { data: coupons, isLoading } = useQuery({
    queryKey: ['coupons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  const createCoupon = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase
        .from('coupons')
        .insert([values]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast.success('تم إضافة الكوبون بنجاح');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('رمز الكوبون موجود بالفعل');
      } else {
        toast.error('حدث خطأ أثناء إضافة الكوبون');
      }
      console.error(error);
    },
  });

  const updateCoupon = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: any }) => {
      const { error } = await supabase
        .from('coupons')
        .update(values)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast.success('تم تحديث الكوبون بنجاح');
      setDialogOpen(false);
      setEditing(null);
      resetForm();
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء تحديث الكوبون');
      console.error(error);
    },
  });

  const deleteCoupon = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast.success('تم حذف الكوبون بنجاح');
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء حذف الكوبون');
      console.error(error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.code.trim()) {
      toast.error('يجب إدخال رمز الكوبون');
      return;
    }

    if (formData.discount_value <= 0) {
      toast.error('يجب أن تكون قيمة الخصم أكبر من صفر');
      return;
    }

    if (formData.discount_type === 'percentage' && formData.discount_value > 100) {
      toast.error('لا يمكن أن تتجاوز نسبة الخصم 100%');
      return;
    }

    const submitData = {
      ...formData,
      code: formData.code.toUpperCase().trim(),
      expires_at: formData.expires_at || null,
      max_uses: formData.max_uses || null,
    };

    if (editing) {
      updateCoupon.mutate({ id: editing.id, values: submitData });
    } else {
      createCoupon.mutate(submitData);
    }
  };

  const handleEdit = (coupon: any) => {
    setEditing(coupon);
    setFormData({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      min_purchase_amount: coupon.min_purchase_amount || 0,
      max_uses: coupon.max_uses,
      expires_at: coupon.expires_at ? new Date(coupon.expires_at).toISOString().slice(0, 16) : '',
      active: coupon.active,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      discount_type: 'percentage',
      discount_value: 0,
      min_purchase_amount: 0,
      max_uses: null,
      expires_at: '',
      active: true,
    });
    setEditing(null);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const copyCouponCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('تم نسخ الكوبون');
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const isMaxUsesReached = (coupon: any) => {
    if (!coupon.max_uses) return false;
    return coupon.current_uses >= coupon.max_uses;
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background/95 backdrop-blur-sm pt-24">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm pt-24">
      {/* Full page decorative border with animations */}
      <div 
        className="fixed top-0 left-0 right-0 bottom-0 pointer-events-none z-0 opacity-5 animate-float-decoration blur-sm"
        style={{
          backgroundImage: 'url(/images/decorative-border-new.png)',
          backgroundSize: '100% 100%',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      
      <main className="container mx-auto px-4 py-8 max-w-6xl relative z-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-primary mb-2 flex items-center gap-3">
              <Ticket className="h-8 w-8" />
              إدارة الكوبونات
            </h1>
            <p className="text-muted-foreground">إدارة كوبونات وأكواد الخصم</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90">
                <Plus className="ml-2 h-4 w-4" />
                إضافة كوبون
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editing ? 'تعديل الكوبون' : 'إضافة كوبون جديد'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">رمز الكوبون</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="مثال: SUMMER2024"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="discount_type">نوع الخصم</Label>
                    <Select value={formData.discount_type} onValueChange={(value) => setFormData({ ...formData, discount_type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                        <SelectItem value="fixed">مبلغ ثابت (ريال)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="discount_value">قيمة الخصم</Label>
                    <Input
                      id="discount_value"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.discount_value}
                      onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min_purchase_amount">الحد الأدنى للطلب (ريال)</Label>
                    <Input
                      id="min_purchase_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.min_purchase_amount}
                      onChange={(e) => setFormData({ ...formData, min_purchase_amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max_uses">الحد الأقصى للاستخدام</Label>
                    <Input
                      id="max_uses"
                      type="number"
                      min="1"
                      value={formData.max_uses || ''}
                      onChange={(e) => setFormData({ ...formData, max_uses: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="غير محدود"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expires_at">تاريخ الانتهاء</Label>
                  <Input
                    id="expires_at"
                    type="datetime-local"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">اترك فارغاً للكوبون بدون تاريخ انتهاء</p>
                </div>

                <div className="flex items-center space-x-2 space-x-reverse">
                  <Switch
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                  />
                  <Label htmlFor="active">فعال</Label>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                  disabled={createCoupon.isPending || updateCoupon.isPending}
                >
                  {(createCoupon.isPending || updateCoupon.isPending) && (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  )}
                  {editing ? 'تحديث' : 'إضافة'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="glass-effect border-border/50">
          <CardHeader>
            <CardTitle>الكوبونات الحالية</CardTitle>
            <CardDescription>جميع كوبونات الخصم في الموقع</CardDescription>
          </CardHeader>
          <CardContent>
            {!coupons || coupons.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد كوبونات بعد</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الرمز</TableHead>
                    <TableHead>الخصم</TableHead>
                    <TableHead>الاستخدام</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="text-left">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((coupon) => (
                    <TableRow key={coupon.id}>
                      <TableCell className="font-mono font-bold">
                        <div className="flex items-center gap-2">
                          {coupon.code}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyCouponCode(coupon.code)}
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {coupon.discount_type === 'percentage' 
                          ? `${coupon.discount_value}%`
                          : `${coupon.discount_value} ريال`
                        }
                        {coupon.min_purchase_amount > 0 && (
                          <span className="text-xs text-muted-foreground block">
                            حد أدنى: {coupon.min_purchase_amount} ريال
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {coupon.current_uses || 0}
                          {coupon.max_uses ? ` / ${coupon.max_uses}` : ' / ∞'}
                        </span>
                        {coupon.expires_at && (
                          <span className="text-xs text-muted-foreground block">
                            ينتهي: {new Date(coupon.expires_at).toLocaleDateString('ar-SA')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {!coupon.active ? (
                            <Badge variant="secondary">غير فعال</Badge>
                          ) : isExpired(coupon.expires_at) ? (
                            <Badge variant="destructive">منتهي</Badge>
                          ) : isMaxUsesReached(coupon) ? (
                            <Badge variant="secondary">مكتمل</Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-600">فعال</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-left">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(coupon)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm('هل أنت متأكد من حذف هذا الكوبون؟')) {
                                deleteCoupon.mutate(coupon.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminCoupons;