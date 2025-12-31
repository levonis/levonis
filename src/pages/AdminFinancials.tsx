import { useState, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  DollarSign, 
  TrendingUp, 
  Truck, 
  CreditCard, 
  ArrowDownRight,
  Package,
  Check,
  X,
  Plus,
  Eye,
  Trash2,
  BarChart3
} from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import AdminLayout, { AdminSection, AdminStatsGrid, AdminStatCard, AdminLoading } from '@/components/admin/AdminLayout';

interface EditingCell {
  orderId: string;
  field: string;
  value: number;
}

interface OrderWithDetails {
  id: string;
  order_number: string;
  created_at: string;
  total_amount: number;
  customer_paid_amount: number | null;
  admin_paid_amount: number | null;
  admin_product_cost: number | null;
  admin_shipping_cost: number | null;
  admin_other_costs: number | null;
  tax_amount: number | null;
  remaining_amount: number | null;
  status: string;
  financial_notes: string | null;
  user_id: string;
  profile?: {
    username: string;
    full_name: string | null;
  };
  order_items?: {
    id: string;
    product_name: string;
    product_name_ar: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }[];
}

interface ManualOrderForm {
  customer_name: string;
  product_names: string;
  total_amount: number;
  customer_paid_amount: number;
  admin_paid_amount: number;
  admin_product_cost: number;
  admin_shipping_cost: number;
  admin_other_costs: number;
  tax_amount: number;
  financial_notes: string;
}

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const AdminFinancials = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [manualOrderForm, setManualOrderForm] = useState<ManualOrderForm>({
    customer_name: '',
    product_names: '',
    total_amount: 0,
    customer_paid_amount: 0,
    admin_paid_amount: 0,
    admin_product_cost: 0,
    admin_shipping_cost: 0,
    admin_other_costs: 0,
    tax_amount: 0,
    financial_notes: '',
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-financials', dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          profile:profiles!orders_user_id_fkey_profiles(username, full_name),
          order_items(id, product_name, product_name_ar, quantity, unit_price, total_price)
        `)
        .order('created_at', { ascending: false });

      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }
      if (dateTo) {
        query = query.lte('created_at', dateTo + 'T23:59:59');
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as OrderWithDetails[];
    },
    enabled: isAdmin,
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, field, value }: { orderId: string; field: string; value: number }) => {
      const { error } = await supabase
        .from('orders')
        .update({ [field]: value })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-financials'] });
      toast.success('تم تحديث البيانات');
      setEditingCell(null);
    },
    onError: () => {
      toast.error('حدث خطأ أثناء التحديث');
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);
      if (itemsError) throw itemsError;

      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-financials'] });
      toast.success('تم حذف الطلب بنجاح');
    },
    onError: (error) => {
      console.error('Error deleting order:', error);
      toast.error('حدث خطأ أثناء حذف الطلب');
    },
  });

  const addManualOrderMutation = useMutation({
    mutationFn: async (form: ManualOrderForm) => {
      const orderNumber = `MAN-${Date.now()}`;
      
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          user_id: user?.id || '',
          total_amount: form.total_amount,
          customer_paid_amount: form.customer_paid_amount,
          admin_paid_amount: form.admin_paid_amount,
          admin_product_cost: form.admin_product_cost,
          admin_shipping_cost: form.admin_shipping_cost,
          admin_other_costs: form.admin_other_costs,
          tax_amount: form.tax_amount,
          financial_notes: `اسم العميل: ${form.customer_name}\n${form.financial_notes}`,
          remaining_amount: form.total_amount - form.customer_paid_amount,
          status: 'delivered',
          shipping_address: 'طلب يدوي',
          phone_number: '-',
          governorate: '-',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      if (form.product_names.trim() && order) {
        const productNames = form.product_names.split('\n').filter(n => n.trim());
        const orderItems = productNames.map(name => ({
          order_id: order.id,
          product_name: name.trim(),
          product_name_ar: name.trim(),
          quantity: 1,
          unit_price: form.total_amount / productNames.length,
          total_price: form.total_amount / productNames.length,
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) throw itemsError;
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-financials'] });
      toast.success('تم إضافة الطلب بنجاح');
      setIsAddDialogOpen(false);
      setManualOrderForm({
        customer_name: '',
        product_names: '',
        total_amount: 0,
        customer_paid_amount: 0,
        admin_paid_amount: 0,
        admin_product_cost: 0,
        admin_shipping_cost: 0,
        admin_other_costs: 0,
        tax_amount: 0,
        financial_notes: '',
      });
    },
    onError: (error) => {
      console.error('Error adding manual order:', error);
      toast.error('حدث خطأ أثناء إضافة الطلب');
    },
  });

  const handleCellClick = (orderId: string, field: string, currentValue: number) => {
    setEditingCell({ orderId, field, value: currentValue });
  };

  const handleSaveEdit = () => {
    if (editingCell) {
      updateOrderMutation.mutate({
        orderId: editingCell.orderId,
        field: editingCell.field,
        value: editingCell.value,
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
  };

  const isManualOrder = (orderNumber: string): boolean => {
    return orderNumber.startsWith('MAN-');
  };

  const getProductNames = (order: OrderWithDetails): string => {
    if (!order.order_items || order.order_items.length === 0) {
      return '-';
    }
    return order.order_items.map(item => item.product_name_ar || item.product_name).join('، ');
  };

  const getUsername = (order: OrderWithDetails): string => {
    if (order.profile) {
      return order.profile.full_name || order.profile.username;
    }
    return '-';
  };

  const renderEditableCell = (orderId: string, field: string, value: number, colorClass: string) => {
    const isEditing = editingCell?.orderId === orderId && editingCell?.field === field;

    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            step="0.01"
            value={editingCell.value}
            onChange={(e) => setEditingCell({ ...editingCell, value: parseFloat(e.target.value) || 0 })}
            className="w-24 h-7 text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit();
              if (e.key === 'Escape') handleCancelEdit();
            }}
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={handleSaveEdit}
            disabled={updateOrderMutation.isPending}
          >
            <Check className="h-3 w-3 text-green-600" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={handleCancelEdit}
          >
            <X className="h-3 w-3 text-red-600" />
          </Button>
        </div>
      );
    }

    return (
      <span
        className={`${colorClass} cursor-pointer hover:underline hover:opacity-80 transition-opacity`}
        onClick={() => handleCellClick(orderId, field, value)}
        title="اضغط للتعديل"
      >
        {formatPrice(value)}
      </span>
    );
  };

  if (authLoading) {
    return (
      <AdminLayout title="التقارير المالية" icon={<BarChart3 className="h-5 w-5" />}>
        <AdminLoading />
      </AdminLayout>
    );
  }

  if (!isAdmin) {
    navigate('/');
    return null;
  }

  // Calculate totals
  const totals = orders?.reduce((acc, order) => {
    const netProfit = (order.total_amount || 0) - (order.admin_product_cost || 0) - (order.admin_shipping_cost || 0) - (order.admin_other_costs || 0);
    
    return {
      totalRevenue: acc.totalRevenue + (order.total_amount || 0),
      totalCustomerPaid: acc.totalCustomerPaid + (order.customer_paid_amount || 0),
      totalAdminPaid: acc.totalAdminPaid + (order.admin_paid_amount || 0),
      totalRemaining: acc.totalRemaining + (order.remaining_amount || 0),
      totalProductCost: acc.totalProductCost + (order.admin_product_cost || 0),
      totalShippingCost: acc.totalShippingCost + (order.admin_shipping_cost || 0),
      totalOtherCosts: acc.totalOtherCosts + (order.admin_other_costs || 0),
      totalTax: acc.totalTax + (order.tax_amount || 0),
      totalProfit: acc.totalProfit + netProfit,
      orderCount: acc.orderCount + 1,
      deliveredCount: acc.deliveredCount + (order.status === 'delivered' ? 1 : 0),
    };
  }, {
    totalRevenue: 0,
    totalCustomerPaid: 0,
    totalAdminPaid: 0,
    totalRemaining: 0,
    totalProductCost: 0,
    totalShippingCost: 0,
    totalOtherCosts: 0,
    totalTax: 0,
    totalProfit: 0,
    orderCount: 0,
    deliveredCount: 0,
  }) || {
    totalRevenue: 0,
    totalCustomerPaid: 0,
    totalAdminPaid: 0,
    totalRemaining: 0,
    totalProductCost: 0,
    totalShippingCost: 0,
    totalOtherCosts: 0,
    totalTax: 0,
    totalProfit: 0,
    orderCount: 0,
    deliveredCount: 0,
  };

  const totalCosts = totals.totalProductCost + totals.totalShippingCost + totals.totalOtherCosts;
  const calculatedProfit = totals.totalRevenue - totalCosts;

  return (
    <AdminLayout
      title="التقارير المالية"
      icon={<BarChart3 className="h-5 w-5" />}
      description="تتبع الإيرادات والمصاريف والأرباح"
      maxWidth="full"
      actions={
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="admin-btn-primary gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">إضافة طلب يدوي</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>إضافة طلب يدوي</DialogTitle>
            </DialogHeader>
            <div className="admin-form space-y-4">
              <div className="admin-form-group">
                <Label>اسم العميل</Label>
                <Input
                  value={manualOrderForm.customer_name}
                  onChange={(e) => setManualOrderForm({ ...manualOrderForm, customer_name: e.target.value })}
                  placeholder="اسم العميل"
                />
              </div>
              <div className="admin-form-group">
                <Label>المنتجات (سطر لكل منتج)</Label>
                <Textarea
                  value={manualOrderForm.product_names}
                  onChange={(e) => setManualOrderForm({ ...manualOrderForm, product_names: e.target.value })}
                  placeholder="منتج 1&#10;منتج 2"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="admin-form-group">
                  <Label>المبلغ الإجمالي</Label>
                  <Input
                    type="number"
                    value={manualOrderForm.total_amount}
                    onChange={(e) => setManualOrderForm({ ...manualOrderForm, total_amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="admin-form-group">
                  <Label>دفع الزبون</Label>
                  <Input
                    type="number"
                    value={manualOrderForm.customer_paid_amount}
                    onChange={(e) => setManualOrderForm({ ...manualOrderForm, customer_paid_amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <Button 
                onClick={() => addManualOrderMutation.mutate(manualOrderForm)}
                disabled={addManualOrderMutation.isPending}
                className="w-full"
              >
                {addManualOrderMutation.isPending ? 'جاري الإضافة...' : 'إضافة الطلب'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      {/* Stats */}
      <AdminStatsGrid>
        <AdminStatCard
          icon={<DollarSign className="h-5 w-5" />}
          value={formatPrice(totals.totalRevenue)}
          label="إجمالي الإيرادات"
          colorClass="text-green-600"
          bgClass="bg-green-500/10"
        />
        <AdminStatCard
          icon={<CreditCard className="h-5 w-5" />}
          value={formatPrice(totals.totalCustomerPaid)}
          label="المدفوع من الزبائن"
          colorClass="text-blue-600"
          bgClass="bg-blue-500/10"
        />
        <AdminStatCard
          icon={<Package className="h-5 w-5" />}
          value={formatPrice(totalCosts)}
          label="إجمالي التكاليف"
          colorClass="text-red-600"
          bgClass="bg-red-500/10"
        />
        <AdminStatCard
          icon={<TrendingUp className="h-5 w-5" />}
          value={formatPrice(calculatedProfit)}
          label="صافي الربح"
          colorClass="text-primary"
          bgClass="bg-primary/10"
        />
      </AdminStatsGrid>

      {/* Date Filter */}
      <AdminSection className="mt-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="admin-form-group">
            <Label>من تاريخ</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="admin-form-group">
            <Label>إلى تاريخ</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </AdminSection>

      {/* Orders Table */}
      <AdminSection title="سجل الطلبات" className="mt-6">
        {isLoading ? (
          <AdminLoading />
        ) : (
          <div className="admin-table-wrapper">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">رقم الطلب</TableHead>
                  <TableHead className="text-right">المستخدم</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">المبلغ الإجمالي</TableHead>
                  <TableHead className="text-right">دفع الزبون</TableHead>
                  <TableHead className="text-right">تكلفة المنتج</TableHead>
                  <TableHead className="text-right">تكلفة الشحن</TableHead>
                  <TableHead className="text-right">الربح الصافي</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders?.map((order) => {
                  const orderProfit = (order.total_amount || 0) - 
                    (order.admin_product_cost || 0) - 
                    (order.admin_shipping_cost || 0) -
                    (order.admin_other_costs || 0);
                  
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">
                        <span className={isManualOrder(order.order_number) ? 'text-purple-600' : ''}>
                          {order.order_number}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {getUsername(order)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ar })}
                      </TableCell>
                      <TableCell>{formatPrice(order.total_amount)}</TableCell>
                      <TableCell>
                        {renderEditableCell(order.id, 'customer_paid_amount', order.customer_paid_amount || 0, 'text-green-600')}
                      </TableCell>
                      <TableCell>
                        {renderEditableCell(order.id, 'admin_product_cost', order.admin_product_cost || 0, 'text-red-600')}
                      </TableCell>
                      <TableCell>
                        {renderEditableCell(order.id, 'admin_shipping_cost', order.admin_shipping_cost || 0, 'text-amber-600')}
                      </TableCell>
                      <TableCell className={orderProfit >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {formatPrice(orderProfit)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {isManualOrder(order.order_number) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
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
                                    onClick={() => deleteOrderMutation.mutate(order.id)}
                                    className="bg-destructive text-destructive-foreground"
                                  >
                                    حذف
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </AdminSection>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تفاصيل الطلب {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">العميل:</span>
                  <span className="mr-2 font-medium">{getUsername(selectedOrder)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">التاريخ:</span>
                  <span className="mr-2 font-medium">{format(new Date(selectedOrder.created_at), 'dd/MM/yyyy', { locale: ar })}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">المبلغ الإجمالي:</span>
                  <span className="mr-2 font-medium">{formatPrice(selectedOrder.total_amount)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">الحالة:</span>
                  <span className="mr-2 font-medium">{selectedOrder.status}</span>
                </div>
              </div>
              
              {selectedOrder.order_items && selectedOrder.order_items.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">المنتجات:</h4>
                  <ul className="space-y-1 text-sm">
                    {selectedOrder.order_items.map((item) => (
                      <li key={item.id} className="flex justify-between">
                        <span>{item.product_name_ar}</span>
                        <span>{item.quantity} × {formatPrice(item.unit_price)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {selectedOrder.financial_notes && (
                <div>
                  <h4 className="font-semibold mb-2">ملاحظات:</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedOrder.financial_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminFinancials;
