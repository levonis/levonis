import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Pencil, Trash2, Ticket, Copy, Tag, Percent, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import AdminLayout, { AdminCard, AdminCardHeader, AdminCardContent, AdminStatsGrid, AdminStatCard, AdminEmptyState, AdminLoading } from '@/components/admin/AdminLayout';

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
    onError: () => {
      toast.error('حدث خطأ أثناء تحديث الكوبون');
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
    onError: () => {
      toast.error('حدث خطأ أثناء حذف الكوبون');
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

  // Calculate stats
  const activeCoupons = coupons?.filter(c => c.active && !isExpired(c.expires_at) && !isMaxUsesReached(c)) || [];
  const totalUses = coupons?.reduce((sum, c) => sum + (c.current_uses || 0), 0) || 0;

  if (authLoading || isLoading) {
    return (
      <AdminLayout title="إدارة الكوبونات" icon={<Ticket className="h-5 w-5" />}>
        <AdminLoading />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="إدارة الكوبونات"
      description="إدارة كوبونات وأكواد الخصم"
      icon={<Ticket className="h-5 w-5" />}
      maxWidth="6xl"
      actions={
        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button className="admin-btn-primary gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">إضافة كوبون</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? 'تعديل الكوبون' : 'إضافة كوبون جديد'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="admin-form-group">
                <Label className="admin-form-label">رمز الكوبون</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="مثال: SUMMER2024"
                  className="admin-input font-mono"
                  required
                />
              </div>

              <div className="admin-form-row-2">
                <div className="admin-form-group">
                  <Label className="admin-form-label">نوع الخصم</Label>
                  <Select value={formData.discount_type} onValueChange={(value) => setFormData({ ...formData, discount_type: value })}>
                    <SelectTrigger className="admin-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                      <SelectItem value="fixed">مبلغ ثابت</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="admin-form-group">
                  <Label className="admin-form-label">قيمة الخصم</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                    className="admin-input"
                    required
                  />
                </div>
              </div>

              <div className="admin-form-row-2">
                <div className="admin-form-group">
                  <Label className="admin-form-label">الحد الأدنى للطلب</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.min_purchase_amount}
                    onChange={(e) => setFormData({ ...formData, min_purchase_amount: parseFloat(e.target.value) || 0 })}
                    className="admin-input"
                  />
                </div>

                <div className="admin-form-group">
                  <Label className="admin-form-label">الحد الأقصى للاستخدام</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.max_uses || ''}
                    onChange={(e) => setFormData({ ...formData, max_uses: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="غير محدود"
                    className="admin-input"
                  />
                </div>
              </div>

              <div className="admin-form-group">
                <Label className="admin-form-label">تاريخ الانتهاء</Label>
                <Input
                  type="datetime-local"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  className="admin-input"
                />
                <p className="admin-form-hint">اترك فارغاً للكوبون بدون تاريخ انتهاء</p>
              </div>

              <div className="flex items-center gap-3 py-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label htmlFor="active" className="text-sm font-medium cursor-pointer">فعال</Label>
              </div>

              <Button
                type="submit"
                className="admin-btn-primary w-full"
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
      }
    >
      {/* Stats */}
      <AdminStatsGrid>
        <AdminStatCard
          icon={<Tag className="h-5 w-5" />}
          value={coupons?.length || 0}
          label="إجمالي الكوبونات"
          colorClass="text-blue-600"
          bgClass="bg-blue-500/10"
        />
        <AdminStatCard
          icon={<Ticket className="h-5 w-5" />}
          value={activeCoupons.length}
          label="كوبونات نشطة"
          colorClass="text-green-600"
          bgClass="bg-green-500/10"
        />
        <AdminStatCard
          icon={<Percent className="h-5 w-5" />}
          value={totalUses}
          label="إجمالي الاستخدامات"
          colorClass="text-purple-600"
          bgClass="bg-purple-500/10"
        />
        <AdminStatCard
          icon={<Calendar className="h-5 w-5" />}
          value={coupons?.filter(c => isExpired(c.expires_at)).length || 0}
          label="كوبونات منتهية"
          colorClass="text-red-600"
          bgClass="bg-red-500/10"
        />
      </AdminStatsGrid>

      {/* Coupons Table */}
      <div className="mt-6">
        <AdminCard>
          <AdminCardHeader 
            title="الكوبونات الحالية" 
            icon={<Ticket className="h-5 w-5" />}
            description="جميع كوبونات الخصم في الموقع"
          />
          <AdminCardContent noPadding>
            {!coupons || coupons.length === 0 ? (
              <AdminEmptyState
                icon={<Ticket className="h-16 w-16" />}
                title="لا توجد كوبونات"
                description="ابدأ بإضافة كوبون خصم جديد"
                action={
                  <Button onClick={() => setDialogOpen(true)} className="admin-btn-primary gap-2">
                    <Plus className="h-4 w-4" />
                    إضافة كوبون
                  </Button>
                }
              />
            ) : (
              <div className="admin-table-responsive">
                <div className="admin-table-wrapper">
                  <Table className="admin-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>الرمز</TableHead>
                        <TableHead>الخصم</TableHead>
                        <TableHead>الاستخدام</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead className="text-left w-24">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coupons.map((coupon) => (
                        <TableRow key={coupon.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-primary">{coupon.code}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyCouponCode(coupon.code)}
                                className="admin-btn-icon-sm"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">
                              {coupon.discount_type === 'percentage' 
                                ? `${coupon.discount_value}%`
                                : `${coupon.discount_value.toLocaleString()} د.ع`
                              }
                            </span>
                            {coupon.min_purchase_amount > 0 && (
                              <span className="text-xs text-muted-foreground block">
                                حد أدنى: {coupon.min_purchase_amount.toLocaleString()}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium">
                              {coupon.current_uses || 0}
                              <span className="text-muted-foreground">
                                {coupon.max_uses ? ` / ${coupon.max_uses}` : ' / ∞'}
                              </span>
                            </span>
                            {coupon.expires_at && (
                              <span className="text-xs text-muted-foreground block">
                                ينتهي: {new Date(coupon.expires_at).toLocaleDateString('ar-SA')}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {!coupon.active ? (
                              <Badge className="admin-badge admin-badge-muted">غير فعال</Badge>
                            ) : isExpired(coupon.expires_at) ? (
                              <Badge className="admin-badge admin-badge-danger">منتهي</Badge>
                            ) : isMaxUsesReached(coupon) ? (
                              <Badge className="admin-badge admin-badge-warning">مكتمل</Badge>
                            ) : (
                              <Badge className="admin-badge admin-badge-success">فعال</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(coupon)}
                                className="admin-btn-icon-sm"
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
                                className="admin-btn-icon-sm text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </AdminCardContent>
        </AdminCard>
      </div>
    </AdminLayout>
  );
};

export default AdminCoupons;
