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
  Package, AlertTriangle, TrendingUp, ArrowDownCircle, ArrowUpCircle,
  Search, BarChart3, Boxes, Activity, DollarSign, ArrowRight
} from 'lucide-react';
import { ADMIN_ROUTES, ADMIN_BASE_PATH } from '@/config/adminConfig';
import { useNavigate } from 'react-router-dom';
import { formatPrice } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const LOW_STOCK_THRESHOLD = 5;

const NEON_COLORS = {
  cyan: 'hsl(185 100% 50%)',
  purple: 'hsl(270 100% 65%)',
  emerald: 'hsl(155 100% 45%)',
  red: 'hsl(0 100% 60%)',
  amber: 'hsl(40 100% 55%)',
};

const PIE_COLORS = [NEON_COLORS.cyan, NEON_COLORS.purple, NEON_COLORS.emerald, NEON_COLORS.amber, NEON_COLORS.red, 'hsl(200 80% 55%)', 'hsl(320 80% 55%)'];

// Glass card component
const GlassCard = ({ children, className = '', glow = '' }: { children: React.ReactNode; className?: string; glow?: string }) => (
  <div className={`relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-2xl transition-all duration-500 hover:shadow-[0_8px_40px_-8px_${glow || 'hsl(185_100%_50%/0.15)'}] hover:border-white/20 ${className}`}>
    {children}
  </div>
);

// Stat card with 3D effect
const StatCard3D = ({ icon: Icon, label, value, color, sub }: { icon: any; label: string; value: string | number; color: string; sub?: string }) => (
  <GlassCard className="p-5 group cursor-default" glow={color}>
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-xs text-white/50 tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white/90 tabular-nums">{value}</p>
        {sub && <p className="text-[10px] text-white/40">{sub}</p>}
      </div>
      <div className="p-2.5 rounded-xl transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-0.5" style={{ background: `linear-gradient(135deg, ${color}33, ${color}11)`, boxShadow: `0 4px 20px ${color}22` }}>
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
  const [movementForm, setMovementForm] = useState({ product_id: '', movement_type: 'inbound' as 'inbound' | 'outbound', quantity: 0, stock_field: 'direct_stock', note: '' });

  // Fetch products with categories
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['inventory-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name_ar, price, cost_price, direct_stock, pre_order_stock, image_url, colors, category_id, categories!products_category_id_fkey(id, name_ar)').order('name_ar');
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

  // Add movement mutation
  const addMovementMutation = useMutation({
    mutationFn: async (form: typeof movementForm) => {
      const product = products.find(p => p.id === form.product_id);
      if (!product) throw new Error('المنتج غير موجود');
      const field = form.stock_field as 'direct_stock' | 'pre_order_stock';
      const currentStock = Number(product[field]) || 0;
      const newStock = form.movement_type === 'inbound' ? currentStock + form.quantity : currentStock - form.quantity;
      if (newStock < 0) throw new Error('لا يمكن أن يكون المخزون سالباً');

      const { error: movErr } = await supabase.from('inventory_movements').insert({
        product_id: form.product_id, movement_type: form.movement_type, quantity: form.quantity,
        stock_field: form.stock_field, note: form.note,
      });
      if (movErr) throw movErr;

      const { error: updErr } = await supabase.from('products').update({ [field]: newStock }).eq('id', form.product_id);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      toast.success('تم تسجيل الحركة بنجاح');
      setMovementForm({ product_id: '', movement_type: 'inbound', quantity: 0, stock_field: 'direct_stock', note: '' });
    },
    onError: (err: any) => toast.error(err.message || 'حدث خطأ'),
  });

  // Inline stock edit mutation
  const updateStockMutation = useMutation({
    mutationFn: async ({ productId, field, value }: { productId: string; field: string; value: number }) => {
      const { error } = await supabase.from('products').update({ [field]: value }).eq('id', productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
      toast.success('تم تحديث المخزون');
    },
    onError: () => toast.error('خطأ في التحديث'),
  });

  // Computed stats
  const stats = useMemo(() => {
    const totalProducts = products.length;
    const lowStock = products.filter(p => (Number(p.direct_stock) || 0) <= LOW_STOCK_THRESHOLD && (Number(p.direct_stock) || 0) > 0).length;
    const outOfStock = products.filter(p => (Number(p.direct_stock) || 0) <= 0).length;
    const totalValue = products.reduce((s, p) => s + (Number(p.cost_price) || 0) * (Number(p.direct_stock) || 0), 0);
    const todayMovements = movements.filter(m => new Date(m.created_at).toDateString() === new Date().toDateString()).length;
    return { totalProducts, lowStock, outOfStock, totalValue, todayMovements };
  }, [products, movements]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (searchQuery && !(p.name_ar || '').includes(searchQuery)) return false;
      if (categoryFilter !== 'all' && p.category_id !== categoryFilter) return false;
      const stock = Number(p.direct_stock) || 0;
      if (stockStatusFilter === 'in_stock' && stock <= 0) return false;
      if (stockStatusFilter === 'low' && (stock > LOW_STOCK_THRESHOLD || stock <= 0)) return false;
      if (stockStatusFilter === 'out' && stock > 0) return false;
      return true;
    });
  }, [products, searchQuery, categoryFilter, stockStatusFilter]);

  // Category stock chart data
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

  // Low stock items
  const lowStockProducts = useMemo(() => {
    return products.filter(p => {
      const stock = Number(p.direct_stock) || 0;
      return stock > 0 && stock <= LOW_STOCK_THRESHOLD;
    }).sort((a, b) => (Number(a.direct_stock) || 0) - (Number(b.direct_stock) || 0));
  }, [products]);

  // Monthly movements trend
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
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.07]" style={{ background: `radial-gradient(circle, ${NEON_COLORS.cyan}, transparent 70%)` }} />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.05]" style={{ background: `radial-gradient(circle, ${NEON_COLORS.purple}, transparent 70%)` }} />
        <div className="absolute top-[40%] left-[30%] w-[400px] h-[400px] rounded-full opacity-[0.04]" style={{ background: `radial-gradient(circle, ${NEON_COLORS.emerald}, transparent 70%)` }} />
      </div>

      {/* Header */}
      <div className="relative z-10 sticky top-0 border-b border-white/5 backdrop-blur-2xl bg-white/[0.02]">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(ADMIN_ROUTES.financials)} className="text-white/60 hover:text-white hover:bg-white/10">
                <ArrowRight className="h-5 w-5" />
              </Button>
              <div className="p-2 rounded-xl" style={{ background: `linear-gradient(135deg, ${NEON_COLORS.cyan}33, ${NEON_COLORS.purple}22)` }}>
                <Boxes className="h-5 w-5" style={{ color: NEON_COLORS.cyan }} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white/90">إدارة المخزون</h1>
                <p className="text-[10px] text-white/40">Inventory Management</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 max-w-7xl py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full bg-white/[0.04] border border-white/10 backdrop-blur-xl rounded-xl p-1 mb-6">
            <TabsTrigger value="dashboard" className="flex-1 data-[state=active]:bg-white/10 data-[state=active]:text-cyan-400 text-white/60 rounded-lg text-xs gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> لوحة التحكم
            </TabsTrigger>
            <TabsTrigger value="products" className="flex-1 data-[state=active]:bg-white/10 data-[state=active]:text-cyan-400 text-white/60 rounded-lg text-xs gap-1.5">
              <Package className="h-3.5 w-3.5" /> المنتجات
            </TabsTrigger>
            <TabsTrigger value="movements" className="flex-1 data-[state=active]:bg-white/10 data-[state=active]:text-cyan-400 text-white/60 rounded-lg text-xs gap-1.5">
              <Activity className="h-3.5 w-3.5" /> الحركات
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex-1 data-[state=active]:bg-white/10 data-[state=active]:text-cyan-400 text-white/60 rounded-lg text-xs gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> التقارير
            </TabsTrigger>
          </TabsList>

          {/* ===== DASHBOARD ===== */}
          <TabsContent value="dashboard" className="space-y-6 mt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard3D icon={Package} label="إجمالي المنتجات" value={stats.totalProducts} color={NEON_COLORS.cyan} />
              <StatCard3D icon={AlertTriangle} label="مخزون منخفض" value={stats.lowStock} color={NEON_COLORS.amber} sub={`≤ ${LOW_STOCK_THRESHOLD} وحدات`} />
              <StatCard3D icon={DollarSign} label="قيمة المخزون" value={formatPrice(stats.totalValue)} color={NEON_COLORS.emerald} />
              <StatCard3D icon={Activity} label="حركات اليوم" value={stats.todayMovements} color={NEON_COLORS.purple} />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Stock by category chart */}
              <GlassCard className="p-5">
                <h3 className="text-sm font-semibold text-white/80 mb-4">المخزون حسب الفئة</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" width={80} stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: 'rgba(15,15,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, backdropFilter: 'blur(20px)' }} labelStyle={{ color: 'rgba(255,255,255,0.8)' }} />
                      <Bar dataKey="stock" fill={NEON_COLORS.cyan} radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              {/* Low stock alerts */}
              <GlassCard className="p-5">
                <h3 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" style={{ color: NEON_COLORS.amber }} /> تنبيهات المخزون المنخفض
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
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] font-mono">{Number(p.direct_stock) || 0}</Badge>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          </TabsContent>

          {/* ===== PRODUCTS ===== */}
          <TabsContent value="products" className="space-y-4 mt-0">
            {/* Search & Filters */}
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
                  </SelectContent>
                </Select>
              </div>
            </GlassCard>

            {/* Products table */}
            <GlassCard className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-white/50 text-xs">المنتج</TableHead>
                      <TableHead className="text-white/50 text-xs">الفئة</TableHead>
                      <TableHead className="text-white/50 text-xs">السعر</TableHead>
                      <TableHead className="text-white/50 text-xs">مخزون مباشر</TableHead>
                      <TableHead className="text-white/50 text-xs">مخزون مسبق</TableHead>
                      <TableHead className="text-white/50 text-xs">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-white/40 py-12 text-xs">لا توجد منتجات</TableCell></TableRow>
                    ) : filteredProducts.map(p => {
                      const directStock = Number(p.direct_stock) || 0;
                      const preOrderStock = Number(p.pre_order_stock) || 0;
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
                          <TableCell>
                            <Input type="number" value={directStock} className="w-20 h-8 text-xs bg-white/[0.04] border-white/10 text-white font-mono text-center"
                              onChange={e => updateStockMutation.mutate({ productId: p.id, field: 'direct_stock', value: Number(e.target.value) })} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" value={preOrderStock} className="w-20 h-8 text-xs bg-white/[0.04] border-white/10 text-white font-mono text-center"
                              onChange={e => updateStockMutation.mutate({ productId: p.id, field: 'pre_order_stock', value: Number(e.target.value) })} />
                          </TableCell>
                          <TableCell>{getStockBadge(directStock)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </GlassCard>
          </TabsContent>

          {/* ===== MOVEMENTS ===== */}
          <TabsContent value="movements" className="space-y-6 mt-0">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Add movement form */}
              <GlassCard className="p-5 md:col-span-1">
                <h3 className="text-sm font-semibold text-white/80 mb-4">تسجيل حركة جديدة</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant={movementForm.movement_type === 'inbound' ? 'default' : 'outline'}
                      className={movementForm.movement_type === 'inbound' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30' : 'bg-white/[0.04] border-white/10 text-white/50 hover:bg-white/10'}
                      onClick={() => setMovementForm(f => ({ ...f, movement_type: 'inbound' }))}>
                      <ArrowDownCircle className="h-4 w-4 ml-1" /> وارد
                    </Button>
                    <Button variant={movementForm.movement_type === 'outbound' ? 'default' : 'outline'}
                      className={movementForm.movement_type === 'outbound' ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30' : 'bg-white/[0.04] border-white/10 text-white/50 hover:bg-white/10'}
                      onClick={() => setMovementForm(f => ({ ...f, movement_type: 'outbound' }))}>
                      <ArrowUpCircle className="h-4 w-4 ml-1" /> صادر
                    </Button>
                  </div>

                  <div>
                    <Label className="text-white/50 text-xs">المنتج</Label>
                    <Select value={movementForm.product_id} onValueChange={v => setMovementForm(f => ({ ...f, product_id: v }))}>
                      <SelectTrigger className="bg-white/[0.04] border-white/10 text-white/70 mt-1">
                        <SelectValue placeholder="اختر المنتج" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 max-h-60">
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name_ar}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-white/50 text-xs">نوع المخزون</Label>
                    <Select value={movementForm.stock_field} onValueChange={v => setMovementForm(f => ({ ...f, stock_field: v }))}>
                      <SelectTrigger className="bg-white/[0.04] border-white/10 text-white/70 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10">
                        <SelectItem value="direct_stock">مخزون مباشر</SelectItem>
                        <SelectItem value="pre_order_stock">مخزون طلب مسبق</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-white/50 text-xs">الكمية</Label>
                    <Input type="number" min={1} value={movementForm.quantity || ''} onChange={e => setMovementForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                      className="bg-white/[0.04] border-white/10 text-white font-mono mt-1" />
                  </div>

                  <div>
                    <Label className="text-white/50 text-xs">ملاحظة</Label>
                    <Textarea value={movementForm.note} onChange={e => setMovementForm(f => ({ ...f, note: e.target.value }))}
                      className="bg-white/[0.04] border-white/10 text-white/80 resize-none mt-1" rows={2} />
                  </div>

                  <Button className="w-full text-white border-0" disabled={!movementForm.product_id || movementForm.quantity <= 0 || addMovementMutation.isPending}
                    style={{ background: `linear-gradient(135deg, ${movementForm.movement_type === 'inbound' ? NEON_COLORS.emerald : NEON_COLORS.red}44, ${movementForm.movement_type === 'inbound' ? NEON_COLORS.emerald : NEON_COLORS.red}22)` }}
                    onClick={() => addMovementMutation.mutate(movementForm)}>
                    {addMovementMutation.isPending ? 'جاري...' : 'تسجيل الحركة'}
                  </Button>
                </div>
              </GlassCard>

              {/* Movements log */}
              <GlassCard className="p-5 md:col-span-2">
                <h3 className="text-sm font-semibold text-white/80 mb-4">سجل الحركات</h3>
                <div className="max-h-[500px] overflow-y-auto space-y-2 scrollbar-thin">
                  {movements.length === 0 ? (
                    <p className="text-white/40 text-xs text-center py-12">لا توجد حركات مسجلة</p>
                  ) : movements.map(m => {
                    const product = products.find(p => p.id === m.product_id);
                    const isInbound = m.movement_type === 'inbound';
                    return (
                      <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 rounded-lg" style={{ background: isInbound ? `${NEON_COLORS.emerald}22` : `${NEON_COLORS.red}22` }}>
                            {isInbound ? <ArrowDownCircle className="h-4 w-4" style={{ color: NEON_COLORS.emerald }} /> : <ArrowUpCircle className="h-4 w-4" style={{ color: NEON_COLORS.red }} />}
                          </div>
                          <div>
                            <p className="text-xs text-white/70">{product?.name_ar || 'منتج محذوف'}</p>
                            <p className="text-[10px] text-white/40">{m.note || (m.stock_field === 'direct_stock' ? 'مخزون مباشر' : 'مخزون مسبق')}</p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-mono font-bold" style={{ color: isInbound ? NEON_COLORS.emerald : NEON_COLORS.red }}>
                            {isInbound ? '+' : '-'}{m.quantity}
                          </p>
                          <p className="text-[10px] text-white/30">{format(new Date(m.created_at), 'dd/MM HH:mm')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            </div>
          </TabsContent>

          {/* ===== ANALYTICS ===== */}
          <TabsContent value="analytics" className="space-y-6 mt-0">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Inventory valuation by category */}
              <GlassCard className="p-5">
                <h3 className="text-sm font-semibold text-white/80 mb-4">تقييم المخزون حسب الفئة</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={40} strokeWidth={0}>
                        {categoryChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'rgba(15,15,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} labelStyle={{ color: 'rgba(255,255,255,0.8)' }}
                        formatter={(val: number) => formatPrice(val)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {categoryChartData.slice(0, 6).map((c, i) => (
                    <div key={c.name} className="flex items-center gap-2 text-[10px] text-white/50">
                      <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="truncate">{c.name}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Monthly movements trend */}
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
                        <Bar dataKey="inbound" name="وارد" fill={NEON_COLORS.emerald} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="outbound" name="صادر" fill={NEON_COLORS.red} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </GlassCard>
            </div>

            {/* Top moving products */}
            <GlassCard className="p-5">
              <h3 className="text-sm font-semibold text-white/80 mb-4">أكثر المنتجات حركة</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(() => {
                  const productMovements: Record<string, { name: string; total: number; inbound: number; outbound: number }> = {};
                  movements.forEach(m => {
                    const prod = products.find(p => p.id === m.product_id);
                    const name = prod?.name_ar || 'محذوف';
                    if (!productMovements[m.product_id]) productMovements[m.product_id] = { name, total: 0, inbound: 0, outbound: 0 };
                    productMovements[m.product_id].total += m.quantity;
                    if (m.movement_type === 'inbound') productMovements[m.product_id].inbound += m.quantity;
                    else productMovements[m.product_id].outbound += m.quantity;
                  });
                  return Object.entries(productMovements).sort((a, b) => b[1].total - a[1].total).slice(0, 6).map(([id, data]) => (
                    <div key={id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <p className="text-xs text-white/70 truncate mb-2">{data.name}</p>
                      <div className="flex items-center gap-4 text-[10px]">
                        <span className="text-emerald-400">↓ {data.inbound}</span>
                        <span className="text-red-400">↑ {data.outbound}</span>
                        <span className="text-white/40 mr-auto">المجموع: {data.total}</span>
                      </div>
                    </div>
                  ));
                })()}
                {movements.length === 0 && <p className="text-white/40 text-xs col-span-3 text-center py-8">لا توجد حركات مسجلة بعد</p>}
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
