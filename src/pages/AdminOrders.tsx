import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Package, Truck, ExternalLink, Calendar, Pencil, Search, Trash2, Plus } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import LevelBadge from '@/components/LevelBadge';

const AdminOrders = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const status = searchParams.get('status');
    if (status) setStatusFilter(status);
  }, [searchParams]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            *,
            products(name_ar, image_url)
          ),
          profiles(full_name, email, username)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin && !authLoading
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: any }) => {
      const { error } = await supabase
        .from('orders')
        .update(values)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('تم تحديث الطلب بنجاح');
      setDialogOpen(false);
      setEditingOrder(null);
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء تحديث الطلب');
      console.error(error);
    }
  });

  const createOrderMutation = useMutation({
    mutationFn: async (values: any) => {
      // Generate order number
      const { data: orderNumberData } = await supabase.rpc('generate_order_number');
      const orderNumber = orderNumberData || `ORD-${Date.now()}`;

      const { data, error } = await supabase
        .from('orders')
        .insert([{
          ...values,
          order_number: orderNumber,
          status: values.status || 'pending',
          currency: values.currency || 'دينار عراقي',
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('تم إنشاء الطلب بنجاح');
      setCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء إنشاء الطلب');
      console.error(error);
    }
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // حذف عناصر الطلب أولاً
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;

      // ثم حذف الطلب
      const { error: orderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (orderError) throw orderError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('تم حذف الطلب بنجاح');
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء حذف الطلب');
      console.error(error);
    }
  });

  const handleCreateOrder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const values: any = {
      user_id: formData.get('user_id') as string,
      total_amount: Number(formData.get('total_amount')),
      shipping_address: formData.get('shipping_address') as string,
      phone_number: formData.get('phone_number') as string,
      governorate: formData.get('governorate') as string,
      status: formData.get('status') as string || 'pending',
      currency: formData.get('currency') as string || 'دينار عراقي',
      shipping_notes: formData.get('shipping_notes') as string || null,
    };

    createOrderMutation.mutate(values);
  };

  const handleUpdateOrder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const values: any = {
      order_number: formData.get('order_number') as string,
      status: formData.get('status') as string,
      tracking_number: formData.get('tracking_number') as string || null,
      tracking_url: formData.get('tracking_url') as string || null,
      shipping_company: formData.get('shipping_company') as string || null,
      shipping_notes: formData.get('shipping_notes') as string || null,
    };

    // تحديث تاريخ الشحن إذا تم تغيير الحالة إلى "تم الشحن"
    if (values.status === 'shipped' && editingOrder?.status !== 'shipped') {
      values.shipped_at = new Date().toISOString();
    }

    // تحديث تاريخ التوصيل إذا تم تغيير الحالة إلى "تم التوصيل"
    if (values.status === 'delivered' && editingOrder?.status !== 'delivered') {
      values.delivered_at = new Date().toISOString();
    }

    updateOrderMutation.mutate({ id: editingOrder.id, values });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      pending: { variant: 'outline', label: 'قيد الانتظار' },
      confirmed: { variant: 'secondary', label: 'مؤكد' },
      processing: { variant: 'default', label: 'قيد التجهيز' },
      shipped: { variant: 'default', label: 'تم الشحن' },
      delivered: { variant: 'secondary', label: 'تم التوصيل' },
      cancelled: { variant: 'destructive', label: 'ملغي' },
    };

    const statusInfo = statusMap[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  // تصفية الطلبات
  const filteredOrders = orders?.filter(order => {
    const matchesSearch = searchTerm === '' ||
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.tracking_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.profiles as any)?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.profiles as any)?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.profiles as any)?.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (!authLoading && !isAdmin) {
    navigate('/');
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm relative overflow-hidden">
      <main className="container mx-auto px-4 py-8 pt-24 relative z-10">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black text-primary mb-2">إدارة الطلبات</h1>
            <p className="text-muted-foreground">تتبع وإدارة جميع الطلبات ومعلومات الشحن</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90">
                <Package className="ml-2 h-4 w-4" />
                إنشاء طلب جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>إنشاء طلب جديد</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleCreateOrder} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="user_id">معرف المستخدم *</Label>
                  <Input
                    id="user_id"
                    name="user_id"
                    placeholder="UUID للمستخدم"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    يجب إدخال معرف المستخدم من جدول المستخدمين
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="total_amount">المبلغ الإجمالي *</Label>
                  <Input
                    id="total_amount"
                    name="total_amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">العملة</Label>
                  <Input
                    id="currency"
                    name="currency"
                    defaultValue="دينار عراقي"
                    placeholder="دينار عراقي"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone_number">رقم الهاتف *</Label>
                  <Input
                    id="phone_number"
                    name="phone_number"
                    placeholder="07XXXXXXXXX"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="governorate">المحافظة *</Label>
                  <Input
                    id="governorate"
                    name="governorate"
                    placeholder="بغداد"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shipping_address">عنوان الشحن *</Label>
                  <Textarea
                    id="shipping_address"
                    name="shipping_address"
                    placeholder="العنوان الكامل"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">الحالة *</Label>
                  <select
                    id="status"
                    name="status"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  >
                    <option value="pending">قيد الانتظار</option>
                    <option value="confirmed">مؤكد</option>
                    <option value="processing">قيد التجهيز</option>
                    <option value="shipped">تم الشحن</option>
                    <option value="delivered">تم التوصيل</option>
                    <option value="cancelled">ملغي</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shipping_notes">ملاحظات الشحن</Label>
                  <Textarea
                    id="shipping_notes"
                    name="shipping_notes"
                    placeholder="أي ملاحظات إضافية..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    disabled={createOrderMutation.isPending}
                  >
                    {createOrderMutation.isPending ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        جاري الإنشاء...
                      </>
                    ) : (
                      'إنشاء الطلب'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* البحث والتصفية */}
        <Card className="mb-6 border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">البحث والتصفية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs mb-2 block">البحث</Label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="رقم الطلب، اسم المستخدم، الاسم، رقم التتبع، أو البريد..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs mb-2 block">الحالة</Label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">جميع الحالات</option>
                  <option value="pending">قيد الانتظار</option>
                  <option value="confirmed">مؤكد</option>
                  <option value="processing">قيد التجهيز</option>
                  <option value="shipped">تم الشحن</option>
                  <option value="delivered">تم التوصيل</option>
                  <option value="cancelled">ملغي</option>
                </select>
              </div>
            </div>

            {(searchTerm || statusFilter !== 'all') && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {filteredOrders?.length || 0} طلب من أصل {orders?.length || 0}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                  }}
                >
                  إعادة تعيين
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* جدول الطلبات */}
        <Card className="border-primary/20 shadow-lg">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">رقم الطلب</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">رقم التتبع</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders && filteredOrders.length > 0 ? (
                  filteredOrders.map((order: any) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono font-bold">{order.order_number}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {order.profiles?.username && `@${order.profiles.username}`}
                              {order.profiles?.username && order.profiles?.full_name && ' - '}
                              {order.profiles?.full_name || 'غير محدد'}
                            </span>
                            {order.user_id && <LevelBadge userId={order.user_id} size="sm" />}
                          </div>
                          <div className="text-xs text-muted-foreground">{order.profiles?.email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ar })}
                      </TableCell>
                      <TableCell className="font-bold text-primary">
                        {formatPrice(Number(order.total_amount))} {order.currency}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        {order.tracking_number ? (
                          <code className="font-mono text-xs bg-primary/10 px-2 py-1 rounded">
                            {order.tracking_number}
                          </code>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/order/${order.id}`)}
                          >
                            <Package className="h-4 w-4 ml-2" />
                            عرض التفاصيل
                          </Button>
                          <Dialog open={dialogOpen && editingOrder?.id === order.id} onOpenChange={(open) => {
                            setDialogOpen(open);
                            if (!open) setEditingOrder(null);
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingOrder(order);
                                  setDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4 ml-2" />
                                تحديث
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>تحديث الطلب {order.order_number}</DialogTitle>
                              </DialogHeader>

                              <form onSubmit={handleUpdateOrder} className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="order_number">رقم الطلب *</Label>
                                  <Input
                                    id="order_number"
                                    name="order_number"
                                    defaultValue={order.order_number}
                                    placeholder="ORD-20250107-1234"
                                    required
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    يمكنك تعديل رقم الطلب أو إضافته يدوياً
                                  </p>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="status">الحالة *</Label>
                                  <select
                                    id="status"
                                    name="status"
                                    defaultValue={order.status}
                                    required
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    <option value="pending">قيد الانتظار</option>
                                    <option value="confirmed">مؤكد</option>
                                    <option value="processing">قيد التجهيز</option>
                                    <option value="shipped">تم الشحن</option>
                                    <option value="delivered">تم التوصيل</option>
                                    <option value="cancelled">ملغي</option>
                                  </select>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="shipping_company">شركة الشحن</Label>
                                  <Input
                                    id="shipping_company"
                                    name="shipping_company"
                                    defaultValue={order.shipping_company || ''}
                                    placeholder="مثال: DHL، FedEx، aramex"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="tracking_number">رقم التتبع</Label>
                                  <Input
                                    id="tracking_number"
                                    name="tracking_number"
                                    defaultValue={order.tracking_number || ''}
                                    placeholder="رقم تتبع الشحنة"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="tracking_url">رابط التتبع</Label>
                                  <Input
                                    id="tracking_url"
                                    name="tracking_url"
                                    type="url"
                                    defaultValue={order.tracking_url || ''}
                                    placeholder="https://..."
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="shipping_notes">ملاحظات الشحن</Label>
                                  <Textarea
                                    id="shipping_notes"
                                    name="shipping_notes"
                                    defaultValue={order.shipping_notes || ''}
                                    placeholder="أي ملاحظات إضافية..."
                                    rows={3}
                                  />
                                </div>

                                <div className="flex gap-3 justify-end pt-4">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                      setDialogOpen(false);
                                      setEditingOrder(null);
                                    }}
                                  >
                                    إلغاء
                                  </Button>
                                  <Button type="submit" disabled={updateOrderMutation.isPending}>
                                    {updateOrderMutation.isPending && (
                                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                    )}
                                    حفظ التغييرات
                                  </Button>
                                </div>
                              </form>
                            </DialogContent>
                          </Dialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                              >
                                <Trash2 className="h-4 w-4 ml-2" />
                                حذف
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                                <AlertDialogDescription>
                                  سيتم حذف الطلب {order.order_number} نهائياً من قاعدة البيانات. هذا الإجراء لا يمكن التراجع عنه.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteOrderMutation.mutate(order.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {deleteOrderMutation.isPending && (
                                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                  )}
                                  حذف نهائياً
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      لا توجد طلبات
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default AdminOrders;
