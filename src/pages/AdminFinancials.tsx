import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  DollarSign, 
  TrendingUp, 
  Truck, 
  CreditCard, 
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Package
} from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const AdminFinancials = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-financials', dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }
      if (dateTo) {
        query = query.lte('created_at', dateTo + 'T23:59:59');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

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
    // الربح الصافي = المبلغ الذي دفعه الزبون - تكلفة المنتج - تكاليف أخرى (بدون تكلفة الشحن)
    const netProfit = (order.customer_paid_amount || 0) - (order.admin_product_cost || 0) - (order.admin_other_costs || 0);
    
    return {
      totalRevenue: acc.totalRevenue + (order.total_amount || 0),
      totalCustomerPaid: acc.totalCustomerPaid + (order.customer_paid_amount || 0),
      totalAdminPaid: acc.totalAdminPaid + (order.admin_paid_amount || 0),
      totalRemaining: acc.totalRemaining + (order.remaining_amount || 0),
      totalProductCost: acc.totalProductCost + (order.admin_product_cost || 0),
      totalShippingCost: acc.totalShippingCost + (order.admin_shipping_cost || 0),
      totalOtherCosts: acc.totalOtherCosts + (order.admin_other_costs || 0),
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
    totalProfit: 0,
    orderCount: 0,
    deliveredCount: 0,
  };

  // الربح الصافي بدون تكلفة الشحن
  const totalCosts = totals.totalProductCost + totals.totalOtherCosts;
  const calculatedProfit = totals.totalCustomerPaid - totalCosts;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">التحليلات المالية</h1>
            <p className="text-muted-foreground">تتبع الإيرادات والتكاليف والأرباح</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/admin')}>
            العودة للوحة التحكم
          </Button>
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
                  <ArrowDownRight className="h-5 w-5 text-cyan-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ما دفعناه</p>
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
                  <p className="text-xs text-muted-foreground">التكاليف (بدون الشحن)</p>
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">رقم الطلب</TableHead>
                          <TableHead className="text-right">التاريخ</TableHead>
                          <TableHead className="text-right">المبلغ الإجمالي</TableHead>
                          <TableHead className="text-right">دفع الزبون</TableHead>
                          <TableHead className="text-right">دفعنا</TableHead>
                          <TableHead className="text-right">تكلفة المنتج</TableHead>
                          <TableHead className="text-right">تكلفة الشحن</TableHead>
                          <TableHead className="text-right">تكاليف أخرى</TableHead>
                          <TableHead className="text-right">الربح الصافي</TableHead>
                          <TableHead className="text-right">الحالة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders?.map((order) => {
                          // الربح الصافي = المبلغ الذي دفعه الزبون - تكلفة المنتج - تكاليف أخرى (بدون تكلفة الشحن)
                          const orderProfit = (order.customer_paid_amount || 0) - 
                            (order.admin_product_cost || 0) - 
                            (order.admin_other_costs || 0);
                          
                          return (
                            <TableRow key={order.id}>
                              <TableCell className="font-mono text-xs">
                                {order.order_number}
                              </TableCell>
                              <TableCell className="text-xs">
                                {format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ar })}
                              </TableCell>
                              <TableCell>{formatPrice(order.total_amount)}</TableCell>
                              <TableCell className="text-green-600">
                                {formatPrice(order.customer_paid_amount || 0)}
                              </TableCell>
                              <TableCell className="text-blue-600">
                                {formatPrice(order.admin_paid_amount || 0)}
                              </TableCell>
                              <TableCell className="text-red-600">
                                {formatPrice(order.admin_product_cost || 0)}
                              </TableCell>
                              <TableCell className="text-amber-600">
                                {formatPrice(order.admin_shipping_cost || 0)}
                              </TableCell>
                              <TableCell className="text-pink-600">
                                {formatPrice(order.admin_other_costs || 0)}
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
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">رقم الطلب</TableHead>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-right">تكلفة المنتج</TableHead>
                        <TableHead className="text-right">تكلفة الشحن</TableHead>
                        <TableHead className="text-right">تكاليف أخرى</TableHead>
                        <TableHead className="text-right">الربح</TableHead>
                        <TableHead className="text-right">ملاحظات مالية</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders?.filter(o => 
                        (o.admin_product_cost || 0) > 0 || 
                        (o.admin_shipping_cost || 0) > 0 || 
                        (o.admin_other_costs || 0) > 0
                      ).map((order) => {
                        // الربح الصافي = المبلغ الذي دفعه الزبون - تكلفة المنتج - تكاليف أخرى (بدون تكلفة الشحن)
                        const orderProfit = (order.customer_paid_amount || 0) - 
                          (order.admin_product_cost || 0) - 
                          (order.admin_other_costs || 0);
                        
                        return (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono text-xs">
                              {order.order_number}
                            </TableCell>
                            <TableCell className="text-xs">
                              {format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ar })}
                            </TableCell>
                            <TableCell className="text-red-600">
                              {formatPrice(order.admin_product_cost || 0)}
                            </TableCell>
                            <TableCell className="text-amber-600">
                              {formatPrice(order.admin_shipping_cost || 0)}
                            </TableCell>
                            <TableCell className="text-pink-600">
                              {formatPrice(order.admin_other_costs || 0)}
                            </TableCell>
                            <TableCell className={orderProfit >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                              {formatPrice(orderProfit)}
                            </TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">
                              {order.financial_notes || '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profitable">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">الطلبات المربحة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">رقم الطلب</TableHead>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-right">المبلغ المدفوع</TableHead>
                        <TableHead className="text-right">إجمالي التكاليف</TableHead>
                        <TableHead className="text-right">صافي الربح</TableHead>
                        <TableHead className="text-right">نسبة الربح</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders?.filter(o => {
                        // الربح الصافي = المبلغ الذي دفعه الزبون - تكلفة المنتج - تكاليف أخرى (بدون تكلفة الشحن)
                        const orderProfit = (o.customer_paid_amount || 0) - 
                          (o.admin_product_cost || 0) - 
                          (o.admin_other_costs || 0);
                        const hasCosts = (o.admin_product_cost || 0) > 0 || (o.admin_other_costs || 0) > 0;
                        return orderProfit > 0 && hasCosts;
                      }).map((order) => {
                        const orderTotalCost = (order.admin_product_cost || 0) + (order.admin_other_costs || 0);
                        const orderProfit = (order.customer_paid_amount || 0) - orderTotalCost;
                        const profitPercent = orderTotalCost > 0 ? ((orderProfit / orderTotalCost) * 100).toFixed(1) : 0;
                        
                        return (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono text-xs">
                              {order.order_number}
                            </TableCell>
                            <TableCell className="text-xs">
                              {format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ar })}
                            </TableCell>
                            <TableCell className="text-green-600">
                              {formatPrice(order.customer_paid_amount || 0)}
                            </TableCell>
                            <TableCell className="text-red-600">
                              {formatPrice(orderTotalCost)}
                            </TableCell>
                            <TableCell className="text-emerald-600 font-semibold">
                              {formatPrice(orderProfit)}
                            </TableCell>
                            <TableCell className="text-emerald-600">
                              {profitPercent}%
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminFinancials;
