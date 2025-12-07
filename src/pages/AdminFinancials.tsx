import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Loader2, 
  DollarSign, 
  TrendingUp, 
  Truck, 
  CreditCard, 
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Package,
  Check,
  X,
  Send,
  Plus,
  Eye
} from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

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

  const addManualOrderMutation = useMutation({
    mutationFn: async (form: ManualOrderForm) => {
      // Generate order number
      const orderNumber = `MAN-${Date.now()}`;
      
      // Create manual order (using admin's user_id as placeholder)
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

      // Add order items if product names provided
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    navigate('/');
    return null;
  }

  // Calculate totals
  const totals = orders?.reduce((acc, order) => {
    // الربح الصافي = المبلغ الإجمالي - تكلفة المنتج - تكلفة الشحن - تكاليف أخرى (الضريبة جزء من الربح)
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

  // الربح الصافي = المبلغ الإجمالي - جميع التكاليف (بدون الضريبة، الضريبة جزء من الربح)
  const totalCosts = totals.totalProductCost + totals.totalShippingCost + totals.totalOtherCosts;
  const calculatedProfit = totals.totalRevenue - totalCosts;

  const renderOrderTable = (ordersList: OrderWithDetails[] | undefined, showNotes = false) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">رقم الطلب</TableHead>
            <TableHead className="text-right">اسم المستخدم</TableHead>
            <TableHead className="text-right">المنتجات</TableHead>
            <TableHead className="text-right">التاريخ</TableHead>
            <TableHead className="text-right">المبلغ الإجمالي</TableHead>
            <TableHead className="text-right">دفع الزبون</TableHead>
            <TableHead className="text-right">المبلغ المحول</TableHead>
            <TableHead className="text-right">تكلفة المنتج</TableHead>
            <TableHead className="text-right">تكلفة الشحن</TableHead>
            <TableHead className="text-right">تكاليف أخرى</TableHead>
            <TableHead className="text-right">الضريبة</TableHead>
            <TableHead className="text-right">الربح الصافي</TableHead>
            <TableHead className="text-right">الحالة</TableHead>
            {showNotes && <TableHead className="text-right">ملاحظات مالية</TableHead>}
            <TableHead className="text-right">تفاصيل</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordersList?.map((order) => {
            const orderProfit = (order.total_amount || 0) - 
              (order.admin_product_cost || 0) - 
              (order.admin_shipping_cost || 0) -
              (order.admin_other_costs || 0);
            
            return (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-xs">
                  {order.order_number}
                </TableCell>
                <TableCell className="text-xs font-medium">
                  {getUsername(order)}
                </TableCell>
                <TableCell className="text-xs max-w-[150px] truncate" title={getProductNames(order)}>
                  {getProductNames(order)}
                </TableCell>
                <TableCell className="text-xs">
                  {format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ar })}
                </TableCell>
                <TableCell>{formatPrice(order.total_amount)}</TableCell>
                <TableCell>
                  {renderEditableCell(order.id, 'customer_paid_amount', order.customer_paid_amount || 0, 'text-green-600')}
                </TableCell>
                <TableCell>
                  {renderEditableCell(order.id, 'admin_paid_amount', order.admin_paid_amount || 0, 'text-cyan-600')}
                </TableCell>
                <TableCell>
                  {renderEditableCell(order.id, 'admin_product_cost', order.admin_product_cost || 0, 'text-red-600')}
                </TableCell>
                <TableCell>
                  {renderEditableCell(order.id, 'admin_shipping_cost', order.admin_shipping_cost || 0, 'text-amber-600')}
                </TableCell>
                <TableCell>
                  {renderEditableCell(order.id, 'admin_other_costs', order.admin_other_costs || 0, 'text-pink-600')}
                </TableCell>
                <TableCell>
                  {renderEditableCell(order.id, 'tax_amount', order.tax_amount || 0, 'text-teal-600')}
                </TableCell>
                <TableCell className={orderProfit >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                  {formatPrice(orderProfit)}
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                    order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {order.status === 'pending' ? 'قيد الانتظار' :
                     order.status === 'purchased' ? 'تم الشراء' :
                     order.status === 'confirmed' ? 'مؤكد' :
                     order.status === 'processing' ? 'قيد التجهيز' :
                     order.status === 'shipped' ? 'تم الشحن' :
                     order.status === 'delivered' ? 'تم التوصيل' :
                     order.status === 'cancelled' ? 'ملغي' : order.status}
                  </span>
                </TableCell>
                {showNotes && (
                  <TableCell className="text-xs max-w-[200px] truncate">
                    {order.financial_notes || '-'}
                  </TableCell>
                )}
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setSelectedOrder(order)}
                    aria-label="عرض التفاصيل"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">التحليلات المالية</h1>
            <p className="text-muted-foreground">تتبع الإيرادات والتكاليف والأرباح - اضغط على أي رقم لتعديله</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default" className="gap-2">
                  <Plus className="h-4 w-4" />
                  إضافة طلب يدوي
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader>
                  <DialogTitle>إضافة طلب يدوي</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>اسم العميل</Label>
                    <Input
                      value={manualOrderForm.customer_name}
                      onChange={(e) => setManualOrderForm({ ...manualOrderForm, customer_name: e.target.value })}
                      placeholder="اسم العميل"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>أسماء المنتجات (كل منتج في سطر)</Label>
                    <Textarea
                      value={manualOrderForm.product_names}
                      onChange={(e) => setManualOrderForm({ ...manualOrderForm, product_names: e.target.value })}
                      placeholder="منتج 1&#10;منتج 2&#10;منتج 3"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>المبلغ الإجمالي</Label>
                      <Input
                        type="number"
                        value={manualOrderForm.total_amount}
                        onChange={(e) => setManualOrderForm({ ...manualOrderForm, total_amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>دفع الزبون</Label>
                      <Input
                        type="number"
                        value={manualOrderForm.customer_paid_amount}
                        onChange={(e) => setManualOrderForm({ ...manualOrderForm, customer_paid_amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>المبلغ المحول</Label>
                      <Input
                        type="number"
                        value={manualOrderForm.admin_paid_amount}
                        onChange={(e) => setManualOrderForm({ ...manualOrderForm, admin_paid_amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>تكلفة المنتج</Label>
                      <Input
                        type="number"
                        value={manualOrderForm.admin_product_cost}
                        onChange={(e) => setManualOrderForm({ ...manualOrderForm, admin_product_cost: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>تكلفة الشحن</Label>
                      <Input
                        type="number"
                        value={manualOrderForm.admin_shipping_cost}
                        onChange={(e) => setManualOrderForm({ ...manualOrderForm, admin_shipping_cost: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>تكاليف أخرى</Label>
                      <Input
                        type="number"
                        value={manualOrderForm.admin_other_costs}
                        onChange={(e) => setManualOrderForm({ ...manualOrderForm, admin_other_costs: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>الضريبة</Label>
                      <Input
                        type="number"
                        value={manualOrderForm.tax_amount}
                        onChange={(e) => setManualOrderForm({ ...manualOrderForm, tax_amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>ملاحظات مالية</Label>
                    <Textarea
                      value={manualOrderForm.financial_notes}
                      onChange={(e) => setManualOrderForm({ ...manualOrderForm, financial_notes: e.target.value })}
                      placeholder="ملاحظات إضافية..."
                      rows={2}
                    />
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={() => addManualOrderMutation.mutate(manualOrderForm)}
                    disabled={addManualOrderMutation.isPending || !manualOrderForm.customer_name}
                  >
                    {addManualOrderMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    ) : null}
                    إضافة الطلب
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={() => navigate('/admin')}>
              العودة للوحة التحكم
            </Button>
          </div>
        </div>

        {/* Date Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <Label>من تاريخ</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-2">
                <Label>إلى تاريخ</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button 
                variant="ghost" 
                onClick={() => { setDateFrom(''); setDateTo(''); }}
              >
                إعادة تعيين
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">إجمالي الإيرادات</p>
                  <p className="text-lg font-bold text-green-600">{formatPrice(totals.totalRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">دفعات الزبائن</p>
                  <p className="text-lg font-bold text-blue-600">{formatPrice(totals.totalCustomerPaid)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <ArrowDownRight className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">المبالغ المتبقية</p>
                  <p className="text-lg font-bold text-orange-600">{formatPrice(totals.totalRemaining)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Package className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">عدد الطلبات</p>
                  <p className="text-lg font-bold text-purple-600">{totals.orderCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Costs & Profit Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/20 rounded-lg">
                  <Send className="h-5 w-5 text-cyan-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">المبلغ المحول</p>
                  <p className="text-lg font-bold text-cyan-600">{formatPrice(totals.totalAdminPaid)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <ArrowDownRight className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">تكلفة المنتجات</p>
                  <p className="text-lg font-bold text-red-600">{formatPrice(totals.totalProductCost)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Truck className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">تكلفة الشحن (معلومات)</p>
                  <p className="text-lg font-bold text-amber-600">{formatPrice(totals.totalShippingCost)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border-pink-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-pink-500/20 rounded-lg">
                  <ArrowDownRight className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">إجمالي التكاليف</p>
                  <p className="text-lg font-bold text-pink-600">{formatPrice(totalCosts)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">صافي الربح</p>
                  <p className={`text-lg font-bold ${calculatedProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatPrice(calculatedProfit)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Orders Table */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all">جميع الطلبات</TabsTrigger>
            <TabsTrigger value="with-costs">طلبات بتكاليف</TabsTrigger>
            <TabsTrigger value="profitable">طلبات مربحة</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">تفاصيل الطلبات المالية</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  renderOrderTable(orders)
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="with-costs">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">طلبات تم تسجيل تكاليفها</CardTitle>
              </CardHeader>
              <CardContent>
                {renderOrderTable(
                  orders?.filter(o => 
                    (o.admin_product_cost || 0) > 0 || 
                    (o.admin_shipping_cost || 0) > 0 || 
                    (o.admin_other_costs || 0) > 0
                  ),
                  true
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profitable">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">الطلبات المربحة</CardTitle>
              </CardHeader>
              <CardContent>
                {renderOrderTable(
                  orders?.filter(o => {
                    const orderProfit = (o.total_amount || 0) - 
                      (o.admin_product_cost || 0) - 
                      (o.admin_shipping_cost || 0) -
                      (o.admin_other_costs || 0);
                    const hasCosts = (o.admin_product_cost || 0) > 0 || (o.admin_shipping_cost || 0) > 0 || (o.admin_other_costs || 0) > 0;
                    return orderProfit > 0 && hasCosts;
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Order Details Dialog */}
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle>تفاصيل الطلب</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">رقم الطلب:</span>
                    <p className="font-mono font-semibold">{selectedOrder.order_number}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">اسم المستخدم:</span>
                    <p className="font-semibold">{getUsername(selectedOrder)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">التاريخ:</span>
                    <p>{format(new Date(selectedOrder.created_at), 'dd/MM/yyyy HH:mm', { locale: ar })}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">الحالة:</span>
                    <p className={`font-semibold ${
                      selectedOrder.status === 'delivered' ? 'text-green-600' :
                      selectedOrder.status === 'cancelled' ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {selectedOrder.status === 'pending' ? 'قيد الانتظار' :
                       selectedOrder.status === 'purchased' ? 'تم الشراء' :
                       selectedOrder.status === 'confirmed' ? 'مؤكد' :
                       selectedOrder.status === 'processing' ? 'قيد التجهيز' :
                       selectedOrder.status === 'shipped' ? 'تم الشحن' :
                       selectedOrder.status === 'delivered' ? 'تم التوصيل' :
                       selectedOrder.status === 'cancelled' ? 'ملغي' : selectedOrder.status}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">المنتجات:</h4>
                  {selectedOrder.order_items && selectedOrder.order_items.length > 0 ? (
                    <ul className="space-y-2">
                      {selectedOrder.order_items.map((item) => (
                        <li key={item.id} className="flex justify-between items-center text-sm bg-muted/50 p-2 rounded">
                          <span>{item.product_name_ar || item.product_name}</span>
                          <span className="text-muted-foreground">
                            {item.quantity} × {formatPrice(item.unit_price)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-sm">لا توجد منتجات</p>
                  )}
                </div>

                <div className="border-t pt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المبلغ الإجمالي:</span>
                    <span className="font-semibold">{formatPrice(selectedOrder.total_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">دفع الزبون:</span>
                    <span className="text-green-600">{formatPrice(selectedOrder.customer_paid_amount || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">تكلفة المنتج:</span>
                    <span className="text-red-600">{formatPrice(selectedOrder.admin_product_cost || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">تكلفة الشحن:</span>
                    <span className="text-amber-600">{formatPrice(selectedOrder.admin_shipping_cost || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">تكاليف أخرى:</span>
                    <span className="text-pink-600">{formatPrice(selectedOrder.admin_other_costs || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الضريبة:</span>
                    <span className="text-teal-600">{formatPrice(selectedOrder.tax_amount || 0)}</span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>صافي الربح:</span>
                    <span className={
                      ((selectedOrder.total_amount || 0) - (selectedOrder.admin_product_cost || 0) - (selectedOrder.admin_shipping_cost || 0) - (selectedOrder.admin_other_costs || 0)) >= 0 
                        ? 'text-emerald-600' 
                        : 'text-red-600'
                    }>
                      {formatPrice(
                        (selectedOrder.total_amount || 0) - 
                        (selectedOrder.admin_product_cost || 0) - 
                        (selectedOrder.admin_shipping_cost || 0) - 
                        (selectedOrder.admin_other_costs || 0)
                      )}
                    </span>
                  </div>
                </div>

                {selectedOrder.financial_notes && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">ملاحظات مالية:</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedOrder.financial_notes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminFinancials;
