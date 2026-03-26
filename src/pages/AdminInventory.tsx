import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Package, AlertTriangle, TrendingUp, ArrowDownCircle,
  Search, BarChart3, Boxes, DollarSign, ArrowRight, Truck,
  Plus, CheckCircle2, Clock, ShoppingCart
} from 'lucide-react';
import { ADMIN_ROUTES } from '@/config/adminConfig';
import { useNavigate } from 'react-router-dom';
import { formatPrice } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const LOW_STOCK_THRESHOLD = 5;

const NEON = {
  cyan: 'hsl(185 100% 50%)',
  purple: 'hsl(270 100% 65%)',
  emerald: 'hsl(155 100% 45%)',
  red: 'hsl(0 100% 60%)',
  amber: 'hsl(40 100% 55%)',
};
const PIE_COLORS = [NEON.cyan, NEON.purple, NEON.emerald, NEON.amber, NEON.red, 'hsl(200 80% 55%)'];

const GlassCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-2xl transition-all duration-300 hover:border-white/15 ${className}`}>
    {children}
  </div>
);

const StatCard3D = ({ icon: Icon, label, value, color, sub }: { icon: any; label: string; value: string | number; color: string; sub?: string }) => (
  <GlassCard className="p-5 group cursor-default">
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-xs text-white/50 tracking-wide">{label}</p>
        <p className="text-xl font-bold text-white/90 tabular-nums">{value}</p>
        {sub && <p className="text-[10px] text-white/40">{sub}</p>}
      </div>
      <div className="p-2.5 rounded-xl transition-transform duration-500 group-hover:scale-110" style={{ background: `linear-gradient(135deg, ${color}33, ${color}11)`, boxShadow: `0 4px 20px ${color}22` }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
    </div>
  </GlassCard>
);

export default function AdminInventory() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState('all');

  // Shipment form state
  const [shipmentForm, setShipmentForm] = useState({ product_id: '', quantity: 0, total_cost: 0, note: '' });

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['inventory-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name_ar, price, cost_price, direct_stock, image_url, category_id, categories!products_category_id_fkey(id, name_ar)').order('name_ar');
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['inventory-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('id, name_ar');
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  // Fetch completed orders for revenue (direct sales, non-cancelled)
  const { data: orders = [] } = useQuery({
    queryKey: ['inventory-orders-revenue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, subtotal, total_amount, status, order_type')
        .in('order_type', ['direct', 'auto'])
        .not('status', 'eq', 'cancelled');
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  // Fetch future shipments
  const { data: shipments = [] } = useQuery({
    queryKey: ['future-shipments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('future_shipments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  // Fetch movements
  const { data: movements = [] } = useQuery({
    queryKey: ['inventory-movements'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inventory_movements').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  // Create future shipment
  const createShipmentMutation = useMutation({
    mutationFn: async (form: typeof shipmentForm) => {
      const { error } = await supabase.from('future_shipments').insert({
        product_id: form.product_id,
        quantity: form.quantity,
        total_cost: form.total_cost,
        note: form.note,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['future-shipments'] });
      toast.success('تم إنشاء الشحنة المستقبلية');
      setShipmentForm({ product_id: '', quantity: 0, total_cost: 0, note: '' });
    },
    onError: () => toast.error('خطأ في إنشاء الشحنة'),
  });

  // Merge shipment into live stock
  const mergeShipmentMutation = useMutation({
    mutationFn: async (shipment: any) => {
      const product = products.find(p => p.id === shipment.product_id);
      if (!product) throw new Error('المنتج غير موجود');

      const currentStock = Number(product.direct_stock) || 0;
      const newStock = currentStock + shipment.quantity;

      // Update product stock
      const { error: stockErr } = await supabase.from('products').update({ direct_stock: newStock }).eq('id', shipment.product_id);
      if (stockErr) throw stockErr;

      // Log the movement
      const { error: movErr } = await supabase.from('inventory_movements').insert({
        product_id: shipment.product_id,
        movement_type: 'inbound',
        quantity: shipment.quantity,
        stock_field: 'direct_stock',
        note: `شحنة مستقبلية: ${shipment.note || ''} (تكلفة: ${formatPrice(shipment.total_cost)})`,
      });
      if (movErr) throw movErr;

      // Mark shipment as merged
      const { error: mergeErr } = await supabase.from('future_shipments').update({ status: 'merged', merged_at: new Date().toISOString() }).eq('id', shipment.id);
      if (mergeErr) throw mergeErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
      queryClient.invalidateQueries({ queryKey: ['future-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      toast.success('تم إضافة الشحنة إلى المخزون المباشر بنجاح');
    },
    onError: (err: any) => toast.error(err.message || 'خطأ في دمج الشحنة'),
  });

  // Inline stock edit
  const updateStockMutation = useMutation({
    mutationFn: async ({ productId, value }: { productId: string; value: number }) => {
      const { error } = await supabase.from('products').update({ direct_stock: value }).eq('id', productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
      toast.success('تم تحديث المخزون');
    },
    onError: () => toast.error('خطأ في التحديث'),
  });

  // ====== COMPUTED ======
  const pendingShipments = useMemo(() => shipments.filter(s => s.status === 'pending'), [shipments]);
  const mergedShipments = useMemo(() => shipments.filter(s => s.status === 'merged'), [shipments]);

  // Total inventory cost = sum of (cost_price * direct_stock) for products + merged shipments extra cost
  const totalInventoryCost = useMemo(() => {
    return products.reduce((sum, p) => sum + ((Number(p.cost_price) || 0) * (Number(p.direct_stock) || 0)), 0);
  }, [products]);

  // Total revenue = sum of orders total_amount - shipping_cost
  const totalRevenue = useMemo(() => {
    return orders.reduce((sum, o) => {
      return sum + (Number(o.subtotal) || 0);
    }, 0);
  }, [orders]);

  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalStock = products.reduce((s, p) => s + (Number(p.direct_stock) || 0), 0);
    const lowStock = products.filter(p => { const s = Number(p.direct_stock) || 0; return s > 0 && s <= LOW_STOCK_THRESHOLD; }).length;
    const outOfStock = products.filter(p => (Number(p.direct_stock) || 0) <= 0).length;
    return { totalProducts, totalStock, lowStock, outOfStock };
  }, [products]);

  // Products with pending shipments map
  const pendingShipmentsByProduct = useMemo(() => {
    const map: Record<string, { qty: number; cost: number }> = {};
    pendingShipments.forEach(s => {
      if (!map[s.product_id]) map[s.product_id] = { qty: 0, cost: 0 };
      map[s.product_id].qty += s.quantity;
      map[s.product_id].cost += Number(s.total_cost);
    });
    return map;
  }, [pendingShipments]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (searchQuery && !(p.name_ar || '').includes(searchQuery)) return false;
      if (categoryFilter !== 'all' && p.category_id !== categoryFilter) return false;
      const stock = Number(p.direct_stock) || 0;
      if (stockStatusFilter === 'in_stock' && stock <= 0) return false;
      if (stockStatusFilter === 'low' && (stock > LOW_STOCK_THRESHOLD || stock <= 0)) return false;
      if (stockStatusFilter === 'out' && stock > 0) return false;
      if (stockStatusFilter === 'incoming' && !pendingShipmentsByProduct[p.id]) return false;
      return true;
    });
  }, [products, searchQuery, categoryFilter, stockStatusFilter, pendingShipmentsByProduct]);

  const categoryChartData = useMemo(() => {
    const map: Record<string, { name: string; stock: number; value: number }> = {};
    products.forEach(p => {
      const cat = (p as any).categories?.name_ar || 'غير مصنف';
      if (!map[cat]) map[cat] = { name: cat, stock: 0, value: 0 };
      map[cat].stock += Number(p.direct_stock) || 0;
      map[cat].value += (Number(p.cost_price) || 0) * (Number(p.direct_stock) || 0);
    });
    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [products]);

  const lowStockProducts = useMemo(() => {
    return products.filter(p => { const s = Number(p.direct_stock) || 0; return s > 0 && s <= LOW_STOCK_THRESHOLD; })
      .sort((a, b) => (Number(a.direct_stock) || 0) - (Number(b.direct_stock) || 0));
  }, [products]);

  const movementsTrend = useMemo(() => {
    const map: Record<string, { month: string; inbound: number; outbound: number }> = {};
    movements.forEach(m => {
      const month = format(new Date(m.created_at), 'yyyy-MM');
      if (!map[month]) map[month] = { month, inbound: 0, outbound: 0 };
      if (m.movement_type === 'inbound') map[month].inbound += m.quantity;
      else map[month].outbound += m.quantity;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).map(d => ({
      ...d, month: format(new Date(d.month + '-01'), 'MMM yyyy', { locale: ar }),
    }));
  }, [movements]);

  const getStockBadge = (stock: number) => {
    if (stock <= 0) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">نفذ</Badge>;
    if (stock <= LOW_STOCK_THRESHOLD) return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">منخفض</Badge>;
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">متوفر</Badge>;
  };

  if (authLoading || productsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(220 25% 8%), hsl(240 20% 12%), hsl(220 25% 8%))' }}>
        <div className="h-10 w-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative" dir="rtl" style={{ background: 'linear-gradient(135deg, hsl(220 25% 8%), hsl(240 20% 12%), hsl(220 25% 8%))' }}>
      {/* Mesh gradient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.07]" style={{ background: `radial-gradient(circle, ${NEON.cyan}, transparent 70%)` }} />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.05]" style={{ background: `radial-gradient(circle, ${NEON.purple}, transparent 70%)` }} />
        <div className="absolute top-[40%] left-[30%] w-[400px] h-[400px] rounded-full opacity-[0.04]" style={{ background: `radial-gradient(circle, ${NEON.emerald}, transparent 70%)` }} />
      </div>

      {/* Header */}
      <div className="relative z-10 sticky top-0 border-b border-white/5 backdrop-blur-2xl bg-white/[0.02]">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(ADMIN_ROUTES.financials)} className="text-white/60 hover:text-white hover:bg-white/10">
                <ArrowRight className="h-5 w-5" />
              </Button>
              <div className="p-2 rounded-xl" style={{ background: `linear-gradient(135deg, ${NEON.cyan}33, ${NEON.purple}22)` }}>
                <Boxes className="h-5 w-5" style={{ color: NEON.cyan }} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white/90">إدارة المخزون</h1>
                <p className="text-[10px] text-white/40">Direct Sales Inventory</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 max-w-7xl py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full bg-white/[0.04] border border-white/10 backdrop-blur-xl rounded-xl p-1 mb-6 flex-wrap h-auto">
            <TabsTrigger value="dashboard" className="flex-1 data-[state=active]:bg-white/10 data-[state=active]:text-cyan-400 text-white/60 rounded-lg text-xs gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> لوحة التحكم
            </TabsTrigger>
            <TabsTrigger value="products" className="flex-1 data-[state=active]:bg-white/10 data-[state=active]:text-cyan-400 text-white/60 rounded-lg text-xs gap-1.5">
              <Package className="h-3.5 w-3.5" /> المخزون
            </TabsTrigger>
            <TabsTrigger value="shipments" className="flex-1 data-[state=active]:bg-white/10 data-[state=active]:text-cyan-400 text-white/60 rounded-lg text-xs gap-1.5 relative">
              <Truck className="h-3.5 w-3.5" /> الشحنات المستقبلية
              {pendingShipments.length > 0 && (
                <span className="absolute -top-1 -left-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{ background: NEON.amber }}>{pendingShipments.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex-1 data-[state=active]:bg-white/10 data-[state=active]:text-cyan-400 text-white/60 rounded-lg text-xs gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> التقارير
            </TabsTrigger>
          </TabsList>

          {/* ===== DASHBOARD ===== */}
          <TabsContent value="dashboard" className="space-y-6 mt-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard3D icon={DollarSign} label="قيمة المخزون" value={formatPrice(totalInventoryCost)} color={NEON.emerald} sub="بسعر التكلفة" />
              <StatCard3D icon={ShoppingCart} label="إجمالي الإيرادات" value={formatPrice(totalRevenue)} color={NEON.cyan} sub="بدون التوصيل" />
              <StatCard3D icon={Clock} label="شحنات معلقة" value={pendingShipments.length} color={NEON.amber} sub={pendingShipments.length > 0 ? `${pendingShipments.reduce((s, sh) => s + sh.quantity, 0)} وحدة قادمة` : 'لا يوجد'} />
              <StatCard3D icon={Package} label="إجمالي المخزون" value={stats.totalStock} color={NEON.purple} sub={`${stats.lowStock} منخفض · ${stats.outOfStock} نفذ`} />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <GlassCard className="p-5">
                <h3 className="text-sm font-semibold text-white/80 mb-4">المخزون حسب الفئة</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" width={80} stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: 'rgba(15,15,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} labelStyle={{ color: 'rgba(255,255,255,0.8)' }} />
                      <Bar dataKey="stock" fill={NEON.cyan} radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              <GlassCard className="p-5">
                <h3 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" style={{ color: NEON.amber }} /> تنبيهات المخزون المنخفض
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
                  {lowStockProducts.length === 0 ? (
                    <p className="text-white/40 text-xs text-center py-8">لا توجد تنبيهات</p>
                  ) : lowStockProducts.slice(0, 10).map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-amber-500/20 transition-all">
                      <div className="flex items-center gap-3">
                        {p.image_url && <img src={p.image_url} className="w-8 h-8 rounded-lg object-cover" alt="" />}
                        <span className="text-xs text-white/70 truncate max-w-[140px]">{p.name_ar}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {pendingShipmentsByProduct[p.id] && (
                          <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[9px]">
                            +{pendingShipmentsByProduct[p.id].qty} قادم
                          </Badge>
                        )}
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] font-mono">{Number(p.direct_stock) || 0}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          </TabsContent>

          {/* ===== PRODUCTS / STOCK TABLE ===== */}
          <TabsContent value="products" className="space-y-4 mt-0">
            <GlassCard className="p-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <Input placeholder="بحث عن منتج..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="pr-10 bg-white/[0.04] border-white/10 text-white placeholder:text-white/30 focus:border-cyan-500/40" />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full md:w-48 bg-white/[0.04] border-white/10 text-white/70">
                    <SelectValue placeholder="الفئة" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10">
                    <SelectItem value="all">جميع الفئات</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name_ar}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={stockStatusFilter} onValueChange={setStockStatusFilter}>
                  <SelectTrigger className="w-full md:w-40 bg-white/[0.04] border-white/10 text-white/70">
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10">
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="in_stock">متوفر</SelectItem>
                    <SelectItem value="low">منخفض</SelectItem>
                    <SelectItem value="out">نفذ</SelectItem>
                    <SelectItem value="incoming">شحنات قادمة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </GlassCard>

            <GlassCard className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-white/50 text-xs">المنتج</TableHead>
                      <TableHead className="text-white/50 text-xs">الفئة</TableHead>
                      <TableHead className="text-white/50 text-xs">السعر</TableHead>
                      <TableHead className="text-white/50 text-xs">التكلفة</TableHead>
                      <TableHead className="text-white/50 text-xs">المخزون المباشر</TableHead>
                      <TableHead className="text-white/50 text-xs">الحالة</TableHead>
                      <TableHead className="text-white/50 text-xs">شحنات قادمة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-white/40 py-12 text-xs">لا توجد منتجات</TableCell></TableRow>
                    ) : filteredProducts.map(p => {
                      const directStock = Number(p.direct_stock) || 0;
                      const costPrice = Number(p.cost_price) || 0;
                      const incoming = pendingShipmentsByProduct[p.id];
                      return (
                        <TableRow key={p.id} className="border-white/5 hover:bg-white/[0.03] transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {p.image_url && <img src={p.image_url} className="w-9 h-9 rounded-lg object-cover border border-white/10" alt="" />}
                              <span className="text-xs text-white/80 truncate max-w-[180px]">{p.name_ar}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-white/50">{(p as any).categories?.name_ar || '-'}</TableCell>
                          <TableCell className="text-xs text-white/60 font-mono">{formatPrice(p.price)}</TableCell>
                          <TableCell className="text-xs text-white/50 font-mono">{costPrice > 0 ? formatPrice(costPrice) : '-'}</TableCell>
                          <TableCell>
                            <Input type="number" defaultValue={directStock} className="w-20 h-8 text-xs bg-white/[0.04] border-white/10 text-white font-mono text-center"
                              onBlur={e => {
                                const val = Number(e.target.value);
                                if (val !== directStock) updateStockMutation.mutate({ productId: p.id, value: val });
                              }} />
                          </TableCell>
                          <TableCell>{getStockBadge(directStock)}</TableCell>
                          <TableCell>
                            {incoming ? (
                              <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/20 text-[10px]">
                                <Truck className="h-3 w-3 ml-1" /> +{incoming.qty}
                              </Badge>
                            ) : (
                              <span className="text-white/20 text-[10px]">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="p-3 border-t border-white/5 text-[10px] text-white/30">
                عدد النتائج: {filteredProducts.length} من {products.length}
              </div>
            </GlassCard>
          </TabsContent>

          {/* ===== FUTURE SHIPMENTS ===== */}
          <TabsContent value="shipments" className="space-y-6 mt-0">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Create shipment form */}
              <GlassCard className="p-5 md:col-span-1">
                <h3 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
                  <Plus className="h-4 w-4" style={{ color: NEON.cyan }} /> شحنة جديدة
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label className="text-white/50 text-xs">المنتج</Label>
                    <Select value={shipmentForm.product_id} onValueChange={v => setShipmentForm(f => ({ ...f, product_id: v }))}>
                      <SelectTrigger className="bg-white/[0.04] border-white/10 text-white/70 mt-1">
                        <SelectValue placeholder="اختر المنتج" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 max-h-60">
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name_ar}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-white/50 text-xs">الكمية</Label>
                    <Input type="number" min={1} value={shipmentForm.quantity || ''} onChange={e => setShipmentForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                      className="bg-white/[0.04] border-white/10 text-white font-mono mt-1" placeholder="مثال: 400" />
                  </div>

                  <div>
                    <Label className="text-white/50 text-xs">التكلفة الإجمالية (IQD)</Label>
                    <Input type="number" min={0} value={shipmentForm.total_cost || ''} onChange={e => setShipmentForm(f => ({ ...f, total_cost: Number(e.target.value) }))}
                      className="bg-white/[0.04] border-white/10 text-white font-mono mt-1" placeholder="مثال: 4000000" />
                  </div>

                  {shipmentForm.quantity > 0 && shipmentForm.total_cost > 0 && (
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <p className="text-[10px] text-white/40 mb-1">تكلفة الوحدة المحسوبة</p>
                      <p className="text-sm font-bold font-mono" style={{ color: NEON.cyan }}>
                        {formatPrice(Math.round(shipmentForm.total_cost / shipmentForm.quantity))}
                      </p>
                    </div>
                  )}

                  <div>
                    <Label className="text-white/50 text-xs">ملاحظة</Label>
                    <Textarea value={shipmentForm.note} onChange={e => setShipmentForm(f => ({ ...f, note: e.target.value }))}
                      className="bg-white/[0.04] border-white/10 text-white/80 resize-none mt-1" rows={2} placeholder="رقم الفاتورة أو تفاصيل الشحنة..." />
                  </div>

                  <Button className="w-full text-white border border-cyan-500/30 hover:border-cyan-500/50"
                    style={{ background: `linear-gradient(135deg, ${NEON.cyan}22, ${NEON.cyan}11)` }}
                    disabled={!shipmentForm.product_id || shipmentForm.quantity <= 0 || shipmentForm.total_cost <= 0 || createShipmentMutation.isPending}
                    onClick={() => createShipmentMutation.mutate(shipmentForm)}>
                    {createShipmentMutation.isPending ? 'جاري...' : 'إنشاء الشحنة'}
                  </Button>
                </div>
              </GlassCard>

              {/* Pending shipments list */}
              <GlassCard className="p-5 md:col-span-2">
                <h3 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4" style={{ color: NEON.amber }} /> الشحنات المعلقة
                  {pendingShipments.length > 0 && (
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] mr-auto">{pendingShipments.length}</Badge>
                  )}
                </h3>
                <div className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-thin">
                  {pendingShipments.length === 0 ? (
                    <p className="text-white/40 text-xs text-center py-12">لا توجد شحنات معلقة</p>
                  ) : pendingShipments.map(s => {
                    const product = products.find(p => p.id === s.product_id);
                    const currentStock = Number(product?.direct_stock) || 0;
                    const unitCost = s.quantity > 0 ? Math.round(Number(s.total_cost) / s.quantity) : 0;
                    return (
                      <div key={s.id} className="p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-cyan-500/20 transition-all">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            {product?.image_url && <img src={product.image_url} className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0" alt="" />}
                            <div className="min-w-0">
                              <p className="text-xs text-white/80 truncate">{product?.name_ar || 'منتج محذوف'}</p>
                              <p className="text-[10px] text-white/40 mt-0.5">{format(new Date(s.created_at), 'dd/MM/yyyy', { locale: ar })}</p>
                              {s.note && <p className="text-[10px] text-white/30 mt-1 truncate">{s.note}</p>}
                            </div>
                          </div>
                          <div className="text-left shrink-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-white/40">الكمية:</span>
                              <span className="text-xs font-mono font-bold text-white/80">{s.quantity}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-white/40">التكلفة:</span>
                              <span className="text-xs font-mono" style={{ color: NEON.cyan }}>{formatPrice(Number(s.total_cost))}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-white/40">الوحدة:</span>
                              <span className="text-[10px] font-mono text-white/50">{formatPrice(unitCost)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Preview: what happens on merge */}
                        <div className="mt-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between flex-wrap gap-2">
                          <div className="text-[10px] text-white/40 flex items-center gap-2">
                            <span>{currentStock} حالي</span>
                            <span>+</span>
                            <span className="font-bold" style={{ color: NEON.emerald }}>{s.quantity} جديد</span>
                            <span>=</span>
                            <span className="font-bold text-white/70">{currentStock + s.quantity} إجمالي</span>
                          </div>
                          <Button size="sm"
                            className="h-7 text-[11px] px-3 border text-white"
                            style={{ background: `linear-gradient(135deg, ${NEON.emerald}33, ${NEON.emerald}15)`, borderColor: `${NEON.emerald}40` }}
                            disabled={mergeShipmentMutation.isPending}
                            onClick={() => mergeShipmentMutation.mutate(s)}>
                            <CheckCircle2 className="h-3 w-3 ml-1" /> إضافة للمخزون
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            </div>

            {/* Merged shipments history */}
            {mergedShipments.length > 0 && (
              <GlassCard className="p-5">
                <h3 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" style={{ color: NEON.emerald }} /> الشحنات المدمجة
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
                  {mergedShipments.map(s => {
                    const product = products.find(p => p.id === s.product_id);
                    return (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 rounded-lg" style={{ background: `${NEON.emerald}15` }}>
                            <CheckCircle2 className="h-3.5 w-3.5" style={{ color: NEON.emerald }} />
                          </div>
                          <div>
                            <p className="text-xs text-white/60">{product?.name_ar || 'محذوف'}</p>
                            <p className="text-[10px] text-white/30">{s.merged_at ? format(new Date(s.merged_at), 'dd/MM/yyyy HH:mm') : ''}</p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-mono text-white/50">+{s.quantity} وحدة</p>
                          <p className="text-[10px] font-mono text-white/30">{formatPrice(Number(s.total_cost))}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            )}
          </TabsContent>

          {/* ===== ANALYTICS ===== */}
          <TabsContent value="analytics" className="space-y-6 mt-0">
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard3D icon={DollarSign} label="قيمة المخزون الحالي" value={formatPrice(totalInventoryCost)} color={NEON.emerald} />
              <StatCard3D icon={ShoppingCart} label="الإيرادات (بدون توصيل)" value={formatPrice(totalRevenue)} color={NEON.cyan} />
              <StatCard3D icon={Package} label="إجمالي الوحدات" value={stats.totalStock} color={NEON.purple} />
              <StatCard3D icon={Truck} label="قادم في الطريق" value={pendingShipments.reduce((s, sh) => s + sh.quantity, 0)} color={NEON.amber} sub={`${pendingShipments.length} شحنة`} />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <GlassCard className="p-5">
                <h3 className="text-sm font-semibold text-white/80 mb-4">تقييم المخزون حسب الفئة</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={40} strokeWidth={0}>
                        {categoryChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'rgba(15,15,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                        formatter={(val: number) => formatPrice(val)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {categoryChartData.slice(0, 6).map((c, i) => (
                    <div key={c.name} className="flex items-center gap-2 text-[10px] text-white/50">
                      <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="truncate">{c.name}: {formatPrice(c.value)}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>

              <GlassCard className="p-5">
                <h3 className="text-sm font-semibold text-white/80 mb-4">اتجاهات الحركات الشهرية</h3>
                <div className="h-64">
                  {movementsTrend.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-white/30 text-xs">لا توجد بيانات كافية</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={movementsTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                        <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: 'rgba(15,15,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                        <Bar dataKey="inbound" name="وارد" fill={NEON.emerald} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="outbound" name="صادر" fill={NEON.red} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </GlassCard>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
