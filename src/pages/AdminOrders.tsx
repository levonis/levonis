import { useState, useEffect, memo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Package, Truck, ExternalLink, Calendar, Pencil, Search, Trash2, Plus, Upload, X, Ship, Plane, ShoppingBag } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import AdminCreateOrderDialog from '@/components/admin/AdminCreateOrderDialog';
import LevelBadge from '@/components/LevelBadge';
import AdminLayout, { AdminSection, AdminCard, AdminCardHeader, AdminCardContent, AdminStatsGrid, AdminStatCard, AdminLoading, AdminEmptyState } from '@/components/admin/AdminLayout';

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
  const [uploadingImage, setUploadingImage] = useState(false);
  const [serialImageFile, setSerialImageFile] = useState<File | null>(null);
  const [adminImageFiles, setAdminImageFiles] = useState<File[]>([]);
  const [adminFilesArray, setAdminFilesArray] = useState<File[]>([]);
  const [adminImagePreviews, setAdminImagePreviews] = useState<string[]>([]);
  const [existingAdminImages, setExistingAdminImages] = useState<string[]>([]);
  const [existingAdminFiles, setExistingAdminFiles] = useState<string[]>([]);
  const [serialImagePreview, setSerialImagePreview] = useState<string>('');
  
  // Financial fields state for live calculation
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [adminProductCost, setAdminProductCost] = useState<number>(0);
  const [adminShippingCost, setAdminShippingCost] = useState<number>(0);
  const [adminOtherCosts, setAdminOtherCosts] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [subtotalAmount, setSubtotalAmount] = useState<number>(0);
  const [taxPercentage, setTaxPercentage] = useState<number>(0);
  
  // Auto-calculate tax_amount when tax_percentage or subtotal changes
  useEffect(() => {
    if (taxPercentage > 0 && subtotalAmount > 0) {
      const calculatedTax = Math.round((subtotalAmount * taxPercentage) / 100);
      setTaxAmount(calculatedTax);
    }
  }, [taxPercentage, subtotalAmount]);
  
  // Calculate profit dynamically
  const calculatedProfit = totalAmount - adminProductCost - adminShippingCost - adminOtherCosts + taxAmount;
  
  useEffect(() => {
    const status = searchParams.get('status');
    if (status) setStatusFilter(status);
  }, [searchParams]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-orders', isAdmin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          profiles(full_name, email, username),
          order_items!order_items_order_id_fkey(shipping_option_name_ar, custom_request_id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Helper function to check if order is pre-order
  const checkIfPreOrder = (orderItems: any[]): boolean => {
    if (!orderItems || orderItems.length === 0) return true;
    for (const item of orderItems) {
      if (item.custom_request_id) return true;
      if (item.shipping_option_name_ar && item.shipping_option_name_ar.includes('متاح في المخزون')) continue;
      return true;
    }
    return false;
  };

  // Helper function to get shipping info
  const getShippingInfo = (orderItems: any[]): { name: string; isFast: boolean } => {
    const shippingItem = orderItems?.find((item: any) => item.shipping_option_name_ar);
    const name = shippingItem?.shipping_option_name_ar || '';
    const isFast = name.includes('سريع') || name.includes('جوي');
    return { name, isFast };
  };

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
      setSerialImageFile(null);
      setSerialImagePreview('');
      setAdminImageFiles([]);
      setAdminFilesArray([]);
      setAdminImagePreviews([]);
      setExistingAdminImages([]);
      setExistingAdminFiles([]);
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء تحديث الطلب');
      console.error(error);
    }
  });

  const createOrderMutation = useMutation({
    mutationFn: async (values: any) => {
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
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;

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

  const cancelOrderWithRefundMutation = useMutation({
    mutationFn: async (order: any) => {
      const paidAmount = Number(order.customer_paid_amount) || Number(order.paid_amount) || 0;
      
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          payment_status: 'refunded',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (updateError) throw updateError;

      if (paidAmount > 0) {
        const { data: wallet, error: walletFetchError } = await supabase
          .from('user_wallets')
          .select('balance')
          .eq('user_id', order.user_id)
          .maybeSingle();

        if (walletFetchError) throw walletFetchError;

        const currentBalance = wallet?.balance || 0;

        const { error: walletError } = await supabase
          .from('user_wallets')
          .upsert({
            user_id: order.user_id,
            balance: currentBalance + paidAmount,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        if (walletError) throw walletError;

        const { error: transactionError } = await supabase
          .from('wallet_transactions')
          .insert({
            user_id: order.user_id,
            type: 'refund',
            amount: paidAmount,
            status: 'completed',
            admin_notes: `استرجاع مبلغ الطلب الملغي رقم ${order.order_number}`,
          });

        if (transactionError) throw transactionError;

        await supabase
          .from('notifications')
          .insert({
            user_id: order.user_id,
            title: 'تم إلغاء طلبك واسترجاع المبلغ',
            message: `تم إلغاء الطلب رقم ${order.order_number} واسترجاع مبلغ ${paidAmount.toLocaleString()} دينار عراقي إلى محفظتك`,
            type: 'info',
            related_id: order.id
          });
      }

      return { paidAmount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      if (data.paidAmount > 0) {
        toast.success(`تم إلغاء الطلب واسترجاع ${data.paidAmount.toLocaleString()} د.ع للمحفظة`);
      } else {
        toast.success('تم إلغاء الطلب بنجاح');
      }
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء إلغاء الطلب');
      console.error(error);
    }
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      pending: { label: 'قيد الانتظار', className: 'admin-badge-warning' },
      processing: { label: 'قيد المعالجة', className: 'admin-badge-info' },
      shipped: { label: 'تم الشحن', className: 'admin-badge-info' },
      delivered: { label: 'تم التوصيل', className: 'admin-badge-success' },
      cancelled: { label: 'ملغي', className: 'admin-badge-error' },
      arrived_warehouse: { label: 'وصل المخزن', className: 'admin-badge-info' },
      arrived_iraq: { label: 'وصل العراق', className: 'admin-badge-success' },
    };

    const config = statusConfig[status] || { label: status, className: 'admin-badge' };
    return <span className={config.className}>{config.label}</span>;
  };

  // Filter orders
  const filteredOrders = orders?.filter(order => {
    const matchesSearch = 
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.profiles?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.phone_number?.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  }) || [];

  // Count by status
  const statusCounts = orders?.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  if (authLoading) {
    return <AdminLoading />;
  }

  if (!isAdmin) {
    navigate('/');
    return null;
  }

  return (
    <AdminLayout
      title="إدارة الطلبات"
      description="عرض وإدارة جميع طلبات العملاء"
      icon={<Package className="h-5 w-5" />}
      actions={
        <AdminCreateOrderDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />
      }
    >
      {/* Stats Grid */}
      <AdminStatsGrid>
        <AdminStatCard
          icon={<Package className="h-5 w-5" />}
          value={orders?.length || 0}
          label="إجمالي الطلبات"
        />
        <AdminStatCard
          icon={<Loader2 className="h-5 w-5" />}
          value={statusCounts['pending'] || 0}
          label="قيد الانتظار"
          colorClass="text-amber-500"
          bgClass="bg-amber-500/10"
        />
        <AdminStatCard
          icon={<Truck className="h-5 w-5" />}
          value={statusCounts['shipped'] || 0}
          label="تم الشحن"
          colorClass="text-blue-500"
          bgClass="bg-blue-500/10"
        />
        <AdminStatCard
          icon={<ShoppingBag className="h-5 w-5" />}
          value={statusCounts['delivered'] || 0}
          label="تم التوصيل"
          colorClass="text-green-500"
          bgClass="bg-green-500/10"
        />
      </AdminStatsGrid>

      {/* Filters */}
      <AdminSection className="mt-6">
        <AdminCard>
          <AdminCardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالرقم، الاسم، أو الهاتف..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={statusFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('all')}
                >
                  الكل ({orders?.length || 0})
                </Button>
                <Button
                  variant={statusFilter === 'pending' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('pending')}
                >
                  قيد الانتظار ({statusCounts['pending'] || 0})
                </Button>
                <Button
                  variant={statusFilter === 'shipped' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('shipped')}
                >
                  تم الشحن ({statusCounts['shipped'] || 0})
                </Button>
                <Button
                  variant={statusFilter === 'delivered' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('delivered')}
                >
                  تم التوصيل ({statusCounts['delivered'] || 0})
                </Button>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>
      </AdminSection>

      {/* Orders Table */}
      <AdminSection className="mt-6">
        <AdminCard hover={false}>
          {isLoading ? (
            <AdminLoading />
          ) : filteredOrders.length === 0 ? (
            <AdminEmptyState
              icon={<Package className="h-12 w-12" />}
              title="لا توجد طلبات"
              description="لم يتم العثور على طلبات تطابق معايير البحث"
            />
          ) : (
            <div className="admin-table-container">
              <Table>
                <TableHeader>
                  <TableRow className="admin-table-header">
                    <TableHead>رقم الطلب</TableHead>
                    <TableHead>العميل</TableHead>
                    <TableHead>المحافظة</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>نوع الشحن</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => {
                    const shippingInfo = getShippingInfo(order.order_items || []);
                    const isPreOrder = checkIfPreOrder(order.order_items || []);
                    
                    return (
                      <TableRow key={order.id} className="admin-table-row">
                        <TableCell className="font-mono text-sm font-medium">
                          {order.order_number}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{order.profiles?.full_name || order.profiles?.username}</span>
                            <span className="text-xs text-muted-foreground">{order.phone_number}</span>
                          </div>
                        </TableCell>
                        <TableCell>{order.governorate}</TableCell>
                        <TableCell className="font-medium">{formatPrice(order.total_amount)}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {shippingInfo.isFast ? (
                              <Plane className="h-4 w-4 text-blue-500" />
                            ) : (
                              <Ship className="h-4 w-4 text-green-500" />
                            )}
                            <span className="text-xs">{isPreOrder ? 'طلب مسبق' : 'متوفر'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ar })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => navigate(`/order/${order.id}`)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingOrder(order);
                                setDialogOpen(true);
                                setTotalAmount(order.total_amount || 0);
                                setAdminProductCost(order.admin_product_cost || 0);
                                setAdminShippingCost(order.admin_shipping_cost || 0);
                                setAdminOtherCosts(order.admin_other_costs || 0);
                                setTaxAmount(order.tax_amount || 0);
                                setSubtotalAmount(order.subtotal || 0);
                                setTaxPercentage(order.tax_percentage || 0);
                                setExistingAdminImages(order.admin_images || []);
                                setExistingAdminFiles(order.admin_files || []);
                                if (order.serial_number_image_url) {
                                  setSerialImagePreview(order.serial_number_image_url);
                                }
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>حذف الطلب</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => deleteOrderMutation.mutate(order.id)}
                                  >
                                    حذف
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </AdminCard>
      </AdminSection>
    </AdminLayout>
  );
};

export default AdminOrders;
