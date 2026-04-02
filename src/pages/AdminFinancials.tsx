import { useState, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  DollarSign, TrendingUp, Truck, CreditCard, Package, Check, X, Plus, Eye, Trash2, BarChart3, ChevronLeft, ChevronRight, FileSpreadsheet, Search
} from 'lucide-react';
import { ADMIN_ROUTES } from '@/config/adminConfig';
import { formatPrice } from '@/lib/utils';
import { useShippingSettings } from '@/hooks/useShippingCalculator';
import { calcAutoOrderProductCost } from '@/lib/orderFinancials';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import AdminLayout, { AdminSection, AdminStatsGrid, AdminStatCard, AdminLoading } from '@/components/admin/AdminLayout';
import BatchProfitAnalysis from '@/components/admin/BatchProfitAnalysis';

interface EditingCell { orderId: string; field: string; value: number; }

interface OrderWithDetails {
  id: string; order_number: string; created_at: string; total_amount: number;
  subtotal?: number | null; discount_amount?: number | null;
  customer_paid_amount: number | null; admin_paid_amount: number | null;
  admin_product_cost: number | null; admin_shipping_cost: number | null;
  admin_other_costs: number | null; tax_amount: number | null;
  remaining_amount: number | null; status: string; financial_notes: string | null;
  user_id: string; order_type?: string;
  profile?: { username: string; full_name: string | null; };
  order_items?: { id: string; product_name: string; product_name_ar: string; quantity: number; unit_price: number; total_price: number; cost_price?: number; product_id?: string; products?: any; }[];
}

interface ManualOrderProduct {
  type: 'manual' | 'site';
  name: string;
  product_id?: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
}

interface ManualOrderForm {
  order_type: 'direct' | 'preorder';
  customer_name: string;
  products: ManualOrderProduct[];
  total_amount: number;
  customer_paid_amount: number;
  remaining_amount: number;
  admin_shipping_cost: number;
  admin_product_cost: number;
  status: string;
  financial_notes: string;
}

const PAGE_SIZE = 50;

const calcItemRevenue = (item: NonNullable<OrderWithDetails['order_items']>[number]): number => {
  if (typeof item.total_price === 'number' && item.total_price > 0) return item.total_price;
  return (item.unit_price || 0) * (item.quantity || 1);
};

const getOrderItemsSubtotal = (order: OrderWithDetails): number => {
  if (typeof order.subtotal === 'number' && order.subtotal > 0) return order.subtotal;
  if (!order.order_items?.length) return 0;
  return order.order_items.reduce((sum, item) => sum + calcItemRevenue(item), 0);
};

// Calculate delivery cost (respect manual admin_shipping_cost even when it's 0)
const calcDeliveryCost = (order: OrderWithDetails): number => {
  if (order.admin_shipping_cost != null) {
    return order.admin_shipping_cost;
  }
  const subtotal = getOrderItemsSubtotal(order);
  if (subtotal > 0) {
    return (order.total_amount || 0) - subtotal + (order.discount_amount || 0);
  }
  return 0;
};

// Calculate product cost (admin_product_cost, then admin_other_costs, then auto-derived)
const calcProductCost = (order: OrderWithDetails, usdToIqdRate: number): number => {
  if (order.admin_product_cost != null && order.admin_product_cost > 0) {
    return order.admin_product_cost;
  }
  if (order.admin_other_costs != null && order.admin_other_costs > 0) {
    return order.admin_other_costs;
  }
  return calcAutoOrderProductCost(order, usdToIqdRate);
};

const calcAllocatedItemCost = (order: OrderWithDetails, item: NonNullable<OrderWithDetails['order_items']>[number], usdToIqdRate: number): number => {
  const orderProductCost = calcProductCost(order, usdToIqdRate);
  const subtotal = getOrderItemsSubtotal(order);
  const itemRevenue = calcItemRevenue(item);

  if (subtotal <= 0 || itemRevenue <= 0) return 0;
  return (orderProductCost * itemRevenue) / subtotal;
};

// Total costs = |delivery| + product costs (negative delivery still counts as cost)
const calcOrderCost = (order: OrderWithDetails, usdToIqdRate: number): number => {
  return Math.abs(calcDeliveryCost(order)) + calcProductCost(order, usdToIqdRate);
};

// Profit (commission) = total_amount - all costs (delivered only)
const calcOrderProfit = (order: OrderWithDetails, usdToIqdRate: number): number => {
  if (order.status !== 'delivered') return 0;
  return (order.total_amount || 0) - calcOrderCost(order, usdToIqdRate);
};

const AdminFinancials = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: shippingSettings } = useShippingSettings();
  const usdToIqdRate = shippingSettings?.usd_to_iqd_rate ?? 1500;
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [quickFilter, setQuickFilter] = useState<string>('');
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [mainTab, setMainTab] = useState('all');
  const [subTab, setSubTab] = useState('general');
  const [currentPage, setCurrentPage] = useState(1);
  const [manualOrderForm, setManualOrderForm] = useState<ManualOrderForm>({
    order_type: 'direct', customer_name: '', products: [{ type: 'manual', name: '', quantity: 1, unit_price: 0, cost_price: 0 }],
    total_amount: 0, customer_paid_amount: 0, remaining_amount: 0, admin_shipping_cost: 0,
    admin_product_cost: 0, status: 'delivered', financial_notes: '',
  });
  const [productSearch, setProductSearch] = useState('');

  // Fetch site products for product selector
  const { data: siteProducts } = useQuery({
    queryKey: ['admin-products-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name_ar, price, cost_price').order('name_ar').limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin && isAddDialogOpen,
  });

  const applyQuickFilter = (filter: string) => {
    const now = new Date();
    let fromDate = '';
    let toDate = format(now, 'yyyy-MM-dd');
    switch (filter) {
      case 'last_week': fromDate = format(new Date(now.getTime() - 7*24*60*60*1000), 'yyyy-MM-dd'); break;
      case 'last_month': fromDate = format(new Date(now.getFullYear(), now.getMonth()-1, now.getDate()), 'yyyy-MM-dd'); break;
      case 'last_3_months': fromDate = format(new Date(now.getFullYear(), now.getMonth()-3, now.getDate()), 'yyyy-MM-dd'); break;
      case 'last_6_months': fromDate = format(new Date(now.getFullYear(), now.getMonth()-6, now.getDate()), 'yyyy-MM-dd'); break;
      case 'last_year': fromDate = format(new Date(now.getFullYear()-1, now.getMonth(), now.getDate()), 'yyyy-MM-dd'); break;
      case 'this_month': fromDate = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd'); break;
      case 'this_year': fromDate = format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd'); break;
      default: fromDate = ''; toDate = '';
    }
    setQuickFilter(filter); setDateFrom(fromDate); setDateTo(toDate);
  };

  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-financials', dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase.from('orders').select(`
        *, order_type,
        profile:profiles!orders_user_id_fkey_profiles(username, full_name),
        order_items!order_items_order_id_fkey(id, product_name, product_name_ar, quantity, unit_price, total_price, cost_price, product_id, bundle_id, shipping_option_name_ar, custom_request_id,
          products!order_items_product_id_fkey(id, name_ar, price_usd, cost_price, shipping_cost_iqd, other_costs_iqd, category_id,
            categories!products_category_id_fkey(id, name_ar, main_section_id,
              main_sections!categories_main_section_id_fkey(id, name_ar)
            )
          )
        )
      `).neq('status', 'cancelled').order('created_at', { ascending: false });
      if (dateFrom) query = query.gte('created_at', dateFrom);
      if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as OrderWithDetails[];
    },
    enabled: isAdmin,
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, field, value }: { orderId: string; field: string; value: number }) => {
      const currentOrder = (orders || []).find(order => order.id === orderId);
      if (!currentOrder) throw new Error('Order not found');

      const currentTotal = currentOrder.total_amount || 0;
      const currentPaid = currentOrder.customer_paid_amount || 0;
      const currentShipping = currentOrder.admin_shipping_cost || 0;
      const isPreorderOrder = (currentOrder as any).order_type === 'preorder';

      const updates: Record<string, number> = { [field]: value };

      if (isPreorderOrder) {
        if (field === 'total_amount') {
          updates.total_amount = value;
          updates.remaining_amount = Math.max(0, value - currentPaid - currentShipping);
        } else if (field === 'customer_paid_amount') {
          updates.customer_paid_amount = value;
          updates.remaining_amount = Math.max(0, currentTotal - value - currentShipping);
        } else if (field === 'admin_shipping_cost') {
          updates.admin_shipping_cost = value;
          updates.remaining_amount = Math.max(0, currentTotal - currentPaid - value);
        } else if (field === 'remaining_amount') {
          updates.remaining_amount = value;
          updates.customer_paid_amount = Math.max(0, currentTotal - currentShipping - value);
        }
      }

      const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-financials'] }); toast.success('تم تحديث البيانات'); setEditingCell(null); },
    onError: () => { toast.error('حدث خطأ أثناء التحديث'); },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error: itemsError } = await supabase.from('order_items').delete().eq('order_id', orderId);
      if (itemsError) throw itemsError;
      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-financials'] }); toast.success('تم حذف الطلب بنجاح'); },
    onError: () => { toast.error('حدث خطأ أثناء حذف الطلب'); },
  });

  const addManualOrderMutation = useMutation({
    mutationFn: async (form: ManualOrderForm) => {
      const orderNumber = `MAN-${Date.now()}`;
      const totalProductCost = form.products.reduce((s, p) => s + (p.cost_price * p.quantity), 0);
      const { data: order, error: orderError } = await supabase.from('orders').insert({
        order_number: orderNumber, user_id: user?.id || '', total_amount: form.total_amount,
        customer_paid_amount: form.customer_paid_amount, admin_paid_amount: 0,
        admin_product_cost: form.admin_product_cost || totalProductCost, admin_shipping_cost: form.admin_shipping_cost, admin_other_costs: 0,
        tax_amount: 0, financial_notes: `اسم العميل: ${form.customer_name}\n${form.financial_notes}`,
        remaining_amount: form.remaining_amount, status: form.status,
        order_type: form.order_type,
        shipping_address: 'طلب يدوي', phone_number: '-', governorate: '-',
      }).select().single();
      if (orderError) throw orderError;
      if (order) {
        const validProducts = form.products.filter(p => p.name.trim());
        if (validProducts.length > 0) {
          const orderItems = validProducts.map(p => ({
            order_id: order.id, product_name: p.name, product_name_ar: p.name,
            product_id: p.product_id || null,
            quantity: p.quantity, unit_price: p.unit_price,
            total_price: p.unit_price * p.quantity, cost_price: p.cost_price,
          }));
          const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
          if (itemsError) throw itemsError;
        }
      }
      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-financials'] });
      toast.success('تم إضافة الطلب بنجاح'); setIsAddDialogOpen(false);
      setManualOrderForm({
        order_type: 'direct', customer_name: '', products: [{ type: 'manual', name: '', quantity: 1, unit_price: 0, cost_price: 0 }],
        total_amount: 0, customer_paid_amount: 0, remaining_amount: 0, admin_shipping_cost: 0,
        admin_product_cost: 0, status: 'delivered', financial_notes: '',
      });
    },
    onError: () => { toast.error('حدث خطأ أثناء إضافة الطلب'); },
  });

  // Filtering
  const filteredOrders = useMemo(() => {
    return (orders || []).filter(order => {
      if (statusFilter === 'delivered') return order.status === 'delivered';
      if (statusFilter === 'in_progress') return order.status !== 'delivered';
      return true;
    });
  }, [orders, statusFilter]);

  // Orders filtered by main tab (sale type)
  const tabFilteredOrders = useMemo(() => {
    if (mainTab === 'direct') return filteredOrders.filter(o => (o as any).order_type === 'direct');
    if (mainTab === 'preorder') return filteredOrders.filter(o => (o as any).order_type === 'preorder');
    return filteredOrders;
  }, [filteredOrders, mainTab]);


  // Global totals (all delivered orders, shipping excluded)
  const globalProfit = useMemo(() => {
    return (orders || []).filter(o => o.status === 'delivered').reduce((s, o) => s + calcOrderProfit(o, usdToIqdRate), 0);
  }, [orders, usdToIqdRate]);

  // Totals for current filtered view
  const totals = useMemo(() => {
    return filteredOrders.reduce((acc, order) => {
      return {
        totalRevenue: acc.totalRevenue + (order.total_amount || 0),
        totalDeliveryCost: acc.totalDeliveryCost + calcDeliveryCost(order),
          totalProductCost: acc.totalProductCost + calcProductCost(order, usdToIqdRate),
          totalCost: acc.totalCost + calcOrderCost(order, usdToIqdRate),
          totalProfit: acc.totalProfit + calcOrderProfit(order, usdToIqdRate),
        orderCount: acc.orderCount + 1,
        deliveredCount: acc.deliveredCount + (order.status === 'delivered' ? 1 : 0),
      };
    }, { totalRevenue: 0, totalDeliveryCost: 0, totalProductCost: 0, totalCost: 0, totalProfit: 0, orderCount: 0, deliveredCount: 0 });
  }, [filteredOrders, usdToIqdRate]);

  // Monthly chart data (delivered only, shipping excluded)
  const monthlyChartData = useMemo(() => {
    const delivered = (orders || []).filter(o => o.status === 'delivered');
    const map: Record<string, { month: string; revenue: number; cost: number; profit: number }> = {};
    delivered.forEach(o => {
      const m = format(new Date(o.created_at), 'yyyy-MM');
      if (!map[m]) map[m] = { month: m, revenue: 0, cost: 0, profit: 0 };
      map[m].revenue += (o.total_amount || 0);
      map[m].cost += calcOrderCost(o, usdToIqdRate);
      map[m].profit += calcOrderProfit(o, usdToIqdRate);
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).map(d => ({
      ...d, month: format(new Date(d.month + '-01'), 'MMM yyyy', { locale: ar }),
    }));
  }, [orders, usdToIqdRate]);

  // Section/product aggregation helpers
  const aggregateBySection = (ordersList: OrderWithDetails[]) => {
    const map: Record<string, { name: string; revenue: number; cost: number; count: number }> = {};
    ordersList.filter(o => o.status === 'delivered').forEach(order => {
      order.order_items?.forEach((item: any) => {
        const section = item.products?.categories?.main_sections;
        const name = section?.name_ar || 'غير مصنف';
        const id = section?.id || 'unknown';
        if (!map[id]) map[id] = { name, revenue: 0, cost: 0, count: 0 };
          map[id].revenue += calcItemRevenue(item);
          map[id].cost += calcAllocatedItemCost(order, item, usdToIqdRate);
        map[id].count += 1;
      });
    });
    return Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue);
  };

  const aggregateByProduct = (ordersList: OrderWithDetails[]) => {
    const map: Record<string, { name: string; revenue: number; cost: number; qty: number }> = {};
    ordersList.filter(o => o.status === 'delivered').forEach(order => {
      order.order_items?.forEach((item: any) => {
        const name = item.product_name_ar || item.product_name || 'غير محدد';
        const id = item.product_id || name;
        if (!map[id]) map[id] = { name, revenue: 0, cost: 0, qty: 0 };
          map[id].revenue += calcItemRevenue(item);
          map[id].cost += calcAllocatedItemCost(order, item, usdToIqdRate);
        map[id].qty += item.quantity;
      });
    });
    return Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue);
  };

  // Pagination for orders table
  const totalPages = Math.ceil(tabFilteredOrders.length / PAGE_SIZE);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return tabFilteredOrders.slice(start, start + PAGE_SIZE);
  }, [tabFilteredOrders, currentPage]);

  // Reset page when filters change
  useMemo(() => { setCurrentPage(1); }, [mainTab, statusFilter, dateFrom, dateTo]);

  const getProductNames = (order: OrderWithDetails): string => {
    if (!order.order_items || order.order_items.length === 0) return '-';
    return order.order_items.map(item => item.product_name_ar || item.product_name).join('، ');
  };
  const getUsername = (order: OrderWithDetails): string => order.profile ? (order.profile.full_name || order.profile.username) : '-';
  const isManualOrder = (n: string) => n.startsWith('MAN-');

  const renderEditableCell = (orderId: string, field: string, value: number, colorClass: string) => {
    const isEditing = editingCell?.orderId === orderId && editingCell?.field === field;
    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <Input type="number" step="0.01" value={editingCell.value}
            onChange={(e) => setEditingCell({ ...editingCell, value: parseFloat(e.target.value) || 0 })}
            className="w-24 h-7 text-xs" autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') { updateOrderMutation.mutate({ orderId: editingCell.orderId, field: editingCell.field, value: editingCell.value }); } if (e.key === 'Escape') setEditingCell(null); }}
          />
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateOrderMutation.mutate({ orderId: editingCell.orderId, field: editingCell.field, value: editingCell.value })} disabled={updateOrderMutation.isPending}>
            <Check className="h-3 w-3 text-green-600" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingCell(null)}><X className="h-3 w-3 text-red-600" /></Button>
        </div>
      );
    }
    return (
      <span className={`${colorClass} cursor-pointer hover:underline hover:opacity-80 transition-opacity`}
        onClick={() => setEditingCell({ orderId, field, value })} title="اضغط للتعديل">
        {formatPrice(value)}
      </span>
    );
  };

  if (authLoading) return <AdminLayout title="التقارير المالية" icon={<BarChart3 className="h-5 w-5" />}><AdminLoading /></AdminLayout>;
  if (!isAdmin) { navigate('/'); return null; }

  // Tab totals for display
  const tabTotals = tabFilteredOrders.filter(o => o.status === 'delivered').reduce((acc, o) => ({
    revenue: acc.revenue + (o.total_amount || 0),
    cost: acc.cost + calcOrderCost(o, usdToIqdRate),
    profit: acc.profit + calcOrderProfit(o, usdToIqdRate),
    count: acc.count + 1,
  }), { revenue: 0, cost: 0, profit: 0, count: 0 });

  return (
    <AdminLayout
      title="التقارير المالية" icon={<BarChart3 className="h-5 w-5" />}
      description="تتبع الإيرادات والمصاريف والأرباح" maxWidth="full"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => navigate(ADMIN_ROUTES.inventory)}>
            <Package className="h-4 w-4" /><span className="hidden sm:inline">المخزون</span>
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => navigate(ADMIN_ROUTES.financialDrafts)}>
            <FileSpreadsheet className="h-4 w-4" /><span className="hidden sm:inline">المسودات</span>
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="admin-btn-primary gap-2"><Plus className="h-4 w-4" /><span className="hidden sm:inline">إضافة طلب يدوي</span></Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader><DialogTitle>إضافة طلب يدوي</DialogTitle></DialogHeader>
            <div className="admin-form space-y-4">
              {/* Order type & customer */}
              <div className="grid grid-cols-2 gap-3">
                <div className="admin-form-group">
                  <Label>نوع البيع</Label>
                  <Select value={manualOrderForm.order_type} onValueChange={(v: 'direct' | 'preorder') => setManualOrderForm({ ...manualOrderForm, order_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">بيع مباشر</SelectItem>
                      <SelectItem value="preorder">بيع مسبق</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="admin-form-group"><Label>اسم العميل</Label><Input value={manualOrderForm.customer_name} onChange={(e) => setManualOrderForm({ ...manualOrderForm, customer_name: e.target.value })} placeholder="اسم العميل" /></div>
              </div>

              {/* Status */}
              <div className="admin-form-group">
                <Label>الحالة</Label>
                <Select value={manualOrderForm.status} onValueChange={(v) => setManualOrderForm({ ...manualOrderForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delivered">مكتمل</SelectItem>
                    <SelectItem value="pending">قيد الانتظار</SelectItem>
                    <SelectItem value="confirmed">مؤكد</SelectItem>
                    <SelectItem value="processing">قيد التجهيز</SelectItem>
                    <SelectItem value="shipped">تم الشحن</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Products */}
              <div className="admin-form-group">
                <div className="flex items-center justify-between mb-2">
                  <Label>المنتجات</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setManualOrderForm({ ...manualOrderForm, products: [...manualOrderForm.products, { type: 'manual', name: '', quantity: 1, unit_price: 0, cost_price: 0 }] })}>
                    <Plus className="h-3 w-3 ml-1" /> إضافة منتج
                  </Button>
                </div>
                {manualOrderForm.products.map((prod, idx) => (
                  <div key={idx} className="border rounded-lg p-3 mb-2 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Select value={prod.type} onValueChange={(v: 'manual' | 'site') => {
                        const updated = [...manualOrderForm.products];
                        updated[idx] = { ...updated[idx], type: v, name: '', product_id: undefined, unit_price: 0, cost_price: 0 };
                        setManualOrderForm({ ...manualOrderForm, products: updated });
                      }}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">إدخال يدوي</SelectItem>
                          <SelectItem value="site">من الموقع</SelectItem>
                        </SelectContent>
                      </Select>
                      {manualOrderForm.products.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                          const updated = manualOrderForm.products.filter((_, i) => i !== idx);
                          setManualOrderForm({ ...manualOrderForm, products: updated });
                        }}><Trash2 className="h-3 w-3" /></Button>
                      )}
                    </div>
                    {prod.type === 'manual' ? (
                      <Input value={prod.name} onChange={(e) => {
                        const updated = [...manualOrderForm.products];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setManualOrderForm({ ...manualOrderForm, products: updated });
                      }} placeholder="اسم المنتج" />
                    ) : (
                      <div className="space-y-1">
                        <div className="relative">
                          <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input className="pr-8" placeholder="ابحث عن منتج..." value={prod.name && prod.product_id ? prod.name : productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            onFocus={() => setProductSearch('')}
                          />
                        </div>
                        {(!prod.product_id || productSearch) && (siteProducts || []).filter(p => !productSearch || p.name_ar?.includes(productSearch)).slice(0, 8).map(sp => (
                          <div key={sp.id} className="flex justify-between items-center p-2 hover:bg-muted rounded cursor-pointer text-sm" onClick={() => {
                            const updated = [...manualOrderForm.products];
                            updated[idx] = { ...updated[idx], name: sp.name_ar, product_id: sp.id, unit_price: sp.price || 0, cost_price: sp.cost_price || 0 };
                            setManualOrderForm({ ...manualOrderForm, products: updated });
                            setProductSearch('');
                          }}>
                            <span>{sp.name_ar}</span>
                            <span className="text-muted-foreground">{formatPrice(sp.price || 0)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label className="text-xs">الكمية</Label><Input type="number" min={1} value={prod.quantity} onChange={(e) => {
                        const updated = [...manualOrderForm.products];
                        updated[idx] = { ...updated[idx], quantity: parseInt(e.target.value) || 1 };
                        setManualOrderForm({ ...manualOrderForm, products: updated });
                      }} /></div>
                      <div><Label className="text-xs">سعر البيع</Label><Input type="number" value={prod.unit_price} onChange={(e) => {
                        const updated = [...manualOrderForm.products];
                        updated[idx] = { ...updated[idx], unit_price: parseFloat(e.target.value) || 0 };
                        setManualOrderForm({ ...manualOrderForm, products: updated });
                      }} /></div>
                      <div><Label className="text-xs">تكلفة المنتج</Label><Input type="number" value={prod.cost_price} onChange={(e) => {
                        const updated = [...manualOrderForm.products];
                        updated[idx] = { ...updated[idx], cost_price: parseFloat(e.target.value) || 0 };
                        setManualOrderForm({ ...manualOrderForm, products: updated });
                      }} /></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Financial fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="admin-form-group"><Label>المبلغ الإجمالي</Label><Input type="number" value={manualOrderForm.total_amount} onChange={(e) => {
                  const total = parseFloat(e.target.value) || 0;
                  setManualOrderForm({ ...manualOrderForm, total_amount: total, remaining_amount: Math.max(0, total - manualOrderForm.customer_paid_amount - manualOrderForm.admin_shipping_cost) });
                }} /></div>
                <div className="admin-form-group"><Label>المدفوع مقدماً</Label><Input type="number" value={manualOrderForm.customer_paid_amount} onChange={(e) => {
                  const paid = parseFloat(e.target.value) || 0;
                  setManualOrderForm({ ...manualOrderForm, customer_paid_amount: paid, remaining_amount: Math.max(0, manualOrderForm.total_amount - paid - manualOrderForm.admin_shipping_cost) });
                }} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="admin-form-group"><Label>تكلفة التوصيل</Label><Input type="number" value={manualOrderForm.admin_shipping_cost} onChange={(e) => {
                  const ship = parseFloat(e.target.value) || 0;
                  setManualOrderForm({ ...manualOrderForm, admin_shipping_cost: ship, remaining_amount: Math.max(0, manualOrderForm.total_amount - manualOrderForm.customer_paid_amount - ship) });
                }} /></div>
                <div className="admin-form-group"><Label>المتبقي</Label><Input type="number" value={manualOrderForm.remaining_amount} onChange={(e) => setManualOrderForm({ ...manualOrderForm, remaining_amount: parseFloat(e.target.value) || 0 })} /></div>
                <div className="admin-form-group"><Label>تكلفة المنتج (إجمالي)</Label><Input type="number" value={manualOrderForm.admin_product_cost} onChange={(e) => setManualOrderForm({ ...manualOrderForm, admin_product_cost: parseFloat(e.target.value) || 0 })} /></div>
              </div>
              {/* Auto commission preview */}
              <div className="p-3 rounded-lg bg-muted/50 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">العمولة (تلقائي)</span>
                <span className={`font-bold ${(manualOrderForm.total_amount - (manualOrderForm.admin_product_cost || manualOrderForm.products.reduce((s, p) => s + p.cost_price * p.quantity, 0)) - manualOrderForm.admin_shipping_cost) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {formatPrice(manualOrderForm.total_amount - (manualOrderForm.admin_product_cost || manualOrderForm.products.reduce((s, p) => s + p.cost_price * p.quantity, 0)) - manualOrderForm.admin_shipping_cost)}
                </span>
              </div>
              {/* Notes */}
              <div className="admin-form-group"><Label>ملاحظات</Label><Textarea value={manualOrderForm.financial_notes} onChange={(e) => setManualOrderForm({ ...manualOrderForm, financial_notes: e.target.value })} rows={2} /></div>
              <Button onClick={() => addManualOrderMutation.mutate(manualOrderForm)} disabled={addManualOrderMutation.isPending || !manualOrderForm.customer_name.trim()} className="w-full">
                {addManualOrderMutation.isPending ? 'جاري الإضافة...' : 'إضافة الطلب'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      }
    >
      {/* ===== 1. Global Profit Bar ===== */}
      <div className="rounded-xl border border-primary/30 from-primary/15 via-primary/10 to-transparent p-4 sm:p-5 mb-6 bg-[sidebar-accent-foreground] bg-sidebar">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">صافي العمولة (المبلغ - التكاليف)</p>
              <p className={`text-2xl sm:text-3xl font-black ${globalProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {formatPrice(globalProfit)}
              </p>
            </div>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => setIsChartOpen(true)}>
            <BarChart3 className="h-4 w-4" />
            عرض الرسم البياني
          </Button>
        </div>
      </div>

      {/* ===== 2. Chart Dialog ===== */}
      <Dialog open={isChartOpen} onOpenChange={setIsChartOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>الإيرادات والتكاليف والأرباح الشهرية</DialogTitle></DialogHeader>
          <div className="h-[350px] mt-4">
            {monthlyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }} />
                  <Legend />
                  <Bar dataKey="revenue" name="الإيرادات" fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="cost" name="التكاليف" fill="#ef4444" radius={[4,4,0,0]} />
                  <Bar dataKey="profit" name="الأرباح" fill="#3b82f6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">لا توجد بيانات</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== 3. Filters ===== */}
      <AdminSection>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {[['', 'الكل'], ['this_month', 'هذا الشهر'], ['last_month', 'آخر شهر'], ['last_3_months', 'آخر 3 أشهر'], ['last_6_months', 'آخر 6 أشهر'], ['this_year', 'هذه السنة']].map(([val, label]) => (
              <Button key={val} variant={quickFilter === val ? 'default' : 'outline'} size="sm"
                onClick={() => { if (val === '') { setQuickFilter(''); setDateFrom(''); setDateTo(''); } else applyQuickFilter(val); }}>
                {label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="admin-form-group"><Label>من تاريخ</Label><Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setQuickFilter(''); }} className="w-40" /></div>
            <div className="admin-form-group"><Label>إلى تاريخ</Label><Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setQuickFilter(''); }} className="w-40" /></div>
            <div className="admin-form-group">
              <Label>حالة الطلب</Label>
              <div className="flex gap-2 flex-wrap">
                {[['all', 'الكل'], ['delivered', 'مكتمل'], ['in_progress', 'قيد التنفيذ']].map(([val, label]) => (
                  <Button key={val} variant={statusFilter === val ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(val)}>{label}</Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AdminSection>

      {/* ===== 4. Stats Cards ===== */}
      <div className="mt-6"><AdminStatsGrid>
        <AdminStatCard icon={<DollarSign className="h-5 w-5" />} value={formatPrice(totals.totalRevenue)} label="إجمالي الإيرادات" colorClass="text-green-600" bgClass="bg-green-500/10" />
        <AdminStatCard icon={<Truck className="h-5 w-5" />} value={formatPrice(totals.totalDeliveryCost)} label="تكلفة التوصيل" colorClass="text-orange-600" bgClass="bg-orange-500/10" />
        <AdminStatCard icon={<Package className="h-5 w-5" />} value={formatPrice(totals.totalProductCost)} label="تكلفة المنتجات" colorClass="text-red-600" bgClass="bg-red-500/10" />
        <AdminStatCard icon={<TrendingUp className="h-5 w-5" />} value={formatPrice(totals.totalProfit)} label={`العمولة (${totals.deliveredCount} مسلّم)`} colorClass="text-primary" bgClass="bg-primary/10" />
      </AdminStatsGrid></div>

      {/* ===== 5. Main Tabs: Sale Type ===== */}
      <AdminSection title="تحليل الأرباح" className="mt-6">
        <Tabs value={mainTab} onValueChange={(v) => { setMainTab(v); setSubTab('general'); setCurrentPage(1); }} className="w-full">
          <TabsList className="mb-4 w-full sm:w-auto text-muted bg-card">
            <TabsTrigger value="all">ربح عام</TabsTrigger>
            <TabsTrigger value="direct">بيع مباشر</TabsTrigger>
            <TabsTrigger value="preorder">بيع مسبق</TabsTrigger>
          </TabsList>

          {['all', 'direct', 'preorder'].map(tab => (
            <TabsContent key={tab} value={tab}>
              {/* Summary bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">عدد المسلّم</p><p className="text-lg font-bold">{tabTotals.count}</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">الإيرادات</p><p className="text-lg font-bold text-green-600">{formatPrice(tabTotals.revenue)}</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">التكاليف</p><p className="text-lg font-bold text-red-500">{formatPrice(tabTotals.cost)}</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">العمولة</p><p className={`text-lg font-bold ${tabTotals.profit >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatPrice(tabTotals.profit)}</p></CardContent></Card>
              </div>

              {/* Sub tabs */}
              <Tabs value={subTab} onValueChange={setSubTab}>
                <TabsList className="mb-3 bg-sidebar">
                  <TabsTrigger value="general">عام</TabsTrigger>
                  <TabsTrigger value="by-section">حسب القسم الرئيسي</TabsTrigger>
                  <TabsTrigger value="by-product">حسب المنتج</TabsTrigger>
                  {tab === 'direct' && <TabsTrigger value="by-batch">حسب الوجبات</TabsTrigger>}
                </TabsList>

                <TabsContent value="general">
                  {/* Orders table with pagination */}
                  <div className="rounded-lg border overflow-x-auto">
                    <Table>
                      <TableHeader>
                         <TableRow>
                          <TableHead className="text-right whitespace-nowrap">رقم الطلب</TableHead>
                          <TableHead className="text-right whitespace-nowrap">المستخدم</TableHead>
                          <TableHead className="text-right whitespace-nowrap">المنتجات</TableHead>
                          <TableHead className="text-right whitespace-nowrap">المبلغ</TableHead>
                          {mainTab === 'preorder' && <TableHead className="text-right whitespace-nowrap">المدفوع مقدماً</TableHead>}
                          {mainTab === 'preorder' && <TableHead className="text-right whitespace-nowrap">المتبقي</TableHead>}
                          {mainTab === 'preorder' && <TableHead className="text-right whitespace-nowrap">المتبقي + التوصيل</TableHead>}
                          {mainTab === 'direct' && <TableHead className="text-right whitespace-nowrap">المجموع بدون التوصيل</TableHead>}
                          <TableHead className="text-right whitespace-nowrap">تكلفة التوصيل</TableHead>
                          <TableHead className="text-right whitespace-nowrap">تكلفة المنتج</TableHead>
                          <TableHead className="text-right whitespace-nowrap">العمولة</TableHead>
                          <TableHead className="text-right whitespace-nowrap">الحالة</TableHead>
                          <TableHead className="text-center whitespace-nowrap">التاريخ</TableHead>
                          <TableHead className="text-center whitespace-nowrap">إجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                         {isLoading ? (
                          <TableRow><TableCell colSpan={mainTab === 'preorder' ? 14 : mainTab === 'direct' ? 12 : 10} className="text-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" /></TableCell></TableRow>
                         ) : paginatedOrders.length === 0 ? (
                          <TableRow><TableCell colSpan={mainTab === 'preorder' ? 14 : mainTab === 'direct' ? 12 : 10} className="text-center py-8 text-muted-foreground">لا توجد طلبات</TableCell></TableRow>
                        ) : paginatedOrders.map(order => {
                          const profit = calcOrderProfit(order, usdToIqdRate);
                          return (
                            <TableRow key={order.id}>
                              <TableCell className="font-mono text-sm">{order.order_number}</TableCell>
                              <TableCell><span className="font-medium">{getUsername(order)}</span></TableCell>
                              <TableCell className="max-w-[200px] truncate" title={getProductNames(order)}>{getProductNames(order)}</TableCell>
                              <TableCell>{renderEditableCell(order.id, 'total_amount', order.total_amount || 0, 'text-green-600 font-medium')}</TableCell>
                              {mainTab === 'preorder' && (
                                <TableCell>{renderEditableCell(order.id, 'customer_paid_amount', order.customer_paid_amount || 0, 'text-blue-600 font-medium')}</TableCell>
                              )}
                              {mainTab === 'preorder' && (
                                <TableCell>{renderEditableCell(order.id, 'remaining_amount', order.remaining_amount || 0, 'text-amber-600 font-medium')}</TableCell>
                              )}
                              {mainTab === 'preorder' && (
                                <TableCell className="text-red-600 font-medium">{formatPrice((order.remaining_amount || 0) + (order.admin_shipping_cost || 0))}</TableCell>
                              )}
                              <TableCell>{renderEditableCell(order.id, 'admin_shipping_cost', calcDeliveryCost(order), 'text-orange-500')}</TableCell>
                              <TableCell>{renderEditableCell(order.id, 'admin_product_cost', calcProductCost(order, usdToIqdRate), 'text-red-500')}</TableCell>
                              <TableCell className={order.status === 'delivered' ? (profit >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold') : 'text-muted-foreground'}>
                                {order.status === 'delivered' ? formatPrice(profit) : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                                  {order.status === 'delivered' ? 'مكتمل' : order.status === 'cancelled' ? 'ملغي' : 'قيد التنفيذ'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center text-sm text-muted-foreground">
                                {format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ar })}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelectedOrder(order)} title="عرض التفاصيل"><Eye className="h-4 w-4" /></Button>
                                  <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" title="حذف"><Trash2 className="h-4 w-4" /></Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>حذف الطلب</AlertDialogTitle><AlertDialogDescription>هل أنت متأكد من حذف الطلب {order.order_number}؟ لا يمكن التراجع.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteOrderMutation.mutate(order.id)}>حذف</AlertDialogAction></AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {/* Totals row */}
                        {tabFilteredOrders.length > 0 && (() => {
                          const totals = tabFilteredOrders.reduce((acc, order) => {
                            acc.totalAmount += order.total_amount || 0;
                            acc.customerPaid += order.customer_paid_amount || 0;
                            acc.remaining += order.remaining_amount || 0;
                            acc.adminShipping += order.admin_shipping_cost || 0;
                            acc.shippingCost += calcDeliveryCost(order);
                            acc.productCost += calcProductCost(order, usdToIqdRate);
                            acc.profit += order.status === 'delivered' ? calcOrderProfit(order, usdToIqdRate) : 0;
                            return acc;
                          }, { totalAmount: 0, customerPaid: 0, remaining: 0, adminShipping: 0, shippingCost: 0, productCost: 0, profit: 0 });
                          return (
                            <TableRow className="bg-muted/40 font-bold border-t-2">
                              <TableCell>المجموع</TableCell>
                              <TableCell>{tabFilteredOrders.length} طلب</TableCell>
                              <TableCell></TableCell>
                              <TableCell className="text-green-600">{formatPrice(totals.totalAmount)}</TableCell>
                              {mainTab === 'preorder' && <TableCell className="text-blue-600">{formatPrice(totals.customerPaid)}</TableCell>}
                              {mainTab === 'preorder' && <TableCell className="text-amber-600">{formatPrice(totals.remaining)}</TableCell>}
                              {mainTab === 'preorder' && <TableCell className="text-red-600">{formatPrice(totals.remaining + totals.adminShipping)}</TableCell>}
                              <TableCell className="text-orange-500">{formatPrice(totals.shippingCost)}</TableCell>
                              <TableCell className="text-red-500">{formatPrice(totals.productCost)}</TableCell>
                              <TableCell className={totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}>{formatPrice(totals.profit)}</TableCell>
                              <TableCell></TableCell>
                              <TableCell></TableCell>
                              <TableCell></TableCell>
                            </TableRow>
                          );
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-4">
                      <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                        <ChevronRight className="h-4 w-4" /> السابق
                      </Button>
                      <span className="text-sm text-muted-foreground">صفحة {currentPage} من {totalPages}</span>
                      <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                        التالي <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="by-section">
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">القسم الرئيسي</TableHead>
                          <TableHead className="text-right">عدد المنتجات</TableHead>
                          <TableHead className="text-right">الإيرادات</TableHead>
                          <TableHead className="text-right">التكلفة</TableHead>
                          <TableHead className="text-right">صافي الربح</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {aggregateBySection(tabFilteredOrders).map(([id, data]) => (
                          <TableRow key={id}>
                            <TableCell className="font-bold">{data.name}</TableCell>
                            <TableCell>{data.count}</TableCell>
                            <TableCell className="text-green-600">{formatPrice(data.revenue)}</TableCell>
                            <TableCell className="text-red-500">{formatPrice(data.cost)}</TableCell>
                            <TableCell className={data.revenue - data.cost >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{formatPrice(data.revenue - data.cost)}</TableCell>
                          </TableRow>
                        ))}
                        {aggregateBySection(tabFilteredOrders).length === 0 && (
                          <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="by-product">
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">المنتج</TableHead>
                          <TableHead className="text-right">الكمية</TableHead>
                          <TableHead className="text-right">الإيرادات</TableHead>
                          <TableHead className="text-right">التكلفة</TableHead>
                          <TableHead className="text-right">صافي الربح</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {aggregateByProduct(tabFilteredOrders).slice(0, 50).map(([id, data]) => (
                          <TableRow key={id}>
                            <TableCell className="font-medium max-w-[200px] truncate">{data.name}</TableCell>
                            <TableCell>{data.qty}</TableCell>
                            <TableCell className="text-green-600">{formatPrice(data.revenue)}</TableCell>
                            <TableCell className="text-red-500">{formatPrice(data.cost)}</TableCell>
                            <TableCell className={data.revenue - data.cost >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{formatPrice(data.revenue - data.cost)}</TableCell>
                          </TableRow>
                        ))}
                        {aggregateByProduct(tabFilteredOrders).length === 0 && (
                          <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {tab === 'direct' && (
                  <TabsContent value="by-batch">
                    <BatchProfitAnalysis
                      usdToIqdRate={usdToIqdRate}
                    />
                  </TabsContent>
                )}
              </Tabs>
            </TabsContent>
          ))}
        </Tabs>
      </AdminSection>

      {/* ===== 6. Total Costs Display ===== */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-orange-500/15 flex items-center justify-center">
            <Truck className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">إجمالي تكلفة التوصيل <span className="text-xs">(يمكن تعديلها يدوياً)</span></p>
            <p className="text-xl font-bold text-orange-600">{formatPrice(totals.totalDeliveryCost)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-red-500/15 flex items-center justify-center">
            <Package className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">إجمالي تكلفة المنتجات <span className="text-xs">(يمكن تعديلها يدوياً)</span></p>
            <p className="text-xl font-bold text-red-600">{formatPrice(totals.totalProductCost)}</p>
          </div>
        </div>
      </div>

      {/* ===== 7. Order Details Dialog ===== */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle>تفاصيل الطلب {selectedOrder?.order_number}</DialogTitle></DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-muted-foreground">المستخدم</Label><p className="font-medium">{getUsername(selectedOrder)}</p></div>
                <div><Label className="text-muted-foreground">الحالة</Label><Badge variant={selectedOrder.status === 'delivered' ? 'default' : 'secondary'}>{selectedOrder.status === 'delivered' ? 'مكتمل' : selectedOrder.status === 'cancelled' ? 'ملغي' : 'قيد التنفيذ'}</Badge></div>
              </div>
              <div>
                <Label className="text-muted-foreground">المنتجات</Label>
                <div className="mt-2 space-y-2">
                  {selectedOrder.order_items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between p-2 bg-muted/50 rounded">
                      <span>{item.product_name_ar || item.product_name}</span>
                      <span className="text-muted-foreground">x{item.quantity} - {formatPrice(item.total_price)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t">
                <div><Label className="text-muted-foreground">المبلغ الإجمالي</Label><p className="font-bold text-green-600">{formatPrice(selectedOrder.total_amount || 0)}</p></div>
                <div><Label className="text-muted-foreground">تكلفة التوصيل</Label><p className="font-bold text-orange-600">{formatPrice(calcDeliveryCost(selectedOrder))}</p></div>
                <div><Label className="text-muted-foreground">تكلفة المنتج</Label><p className="font-bold text-red-600">{formatPrice(calcProductCost(selectedOrder, usdToIqdRate))}</p></div>
                <div><Label className="text-muted-foreground">العمولة</Label><p className={`font-bold ${calcOrderProfit(selectedOrder, usdToIqdRate) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{selectedOrder.status === 'delivered' ? formatPrice(calcOrderProfit(selectedOrder, usdToIqdRate)) : 'غير محسوب'}</p></div>
              </div>
              {selectedOrder.financial_notes && (
                <div className="pt-4 border-t"><Label className="text-muted-foreground">ملاحظات مالية</Label><p className="whitespace-pre-wrap text-sm">{selectedOrder.financial_notes}</p></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminFinancials;
