import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, AlertTriangle, TrendingUp, ArrowDownCircle,
  Search, BarChart3, Boxes, DollarSign, ArrowRight, Truck,
  Plus, CheckCircle2, Clock, ShoppingCart, FileText, ChevronLeft,
  ChevronRight, Trash2, X, Send
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
  blue: 'hsl(210 100% 60%)',
};
const PIE_COLORS = [NEON.cyan, NEON.purple, NEON.emerald, NEON.amber, NEON.red, 'hsl(200 80% 55%)'];

type Section = 'dashboard' | 'drafts' | 'shipments' | 'inventory';

interface DraftItem {
  product_id: string;
  product_name: string;
  color: string;
  option: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
}

const GlassCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-2xl transition-all duration-300 hover:border-white/15 ${className}`}>
    {children}
  </div>
);

const StatCard3D = ({ icon: Icon, label, value, color, sub }: { icon: any; label: string; value: string | number; color: string; sub?: string }) => (
  <motion.div whileHover={{ scale: 1.02, rotateY: 2 }} style={{ perspective: 1000 }}>
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
  </motion.div>
);

const NAV_ITEMS: { id: Section; icon: any; label: string; color: string }[] = [
  { id: 'dashboard', icon: BarChart3, label: 'لوحة التحكم', color: NEON.cyan },
  { id: 'drafts', icon: FileText, label: 'مسودات الشراء', color: NEON.purple },
  { id: 'shipments', icon: Truck, label: 'الشحنات', color: NEON.blue },
  { id: 'inventory', icon: Package, label: 'المخزون المباشر', color: NEON.emerald },
];

export default function AdminInventory() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState('all');

  // Draft creation state
  const [showDraftForm, setShowDraftForm] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [draftNotes, setDraftNotes] = useState('');

  // Draft item form
  const [draftItemForm, setDraftItemForm] = useState({ product_id: '', color: '', option: '', quantity: 0, unit_cost: 0 });

  // ====== DATA QUERIES ======
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['inventory-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name_ar, price, cost_price, direct_stock, image_url, category_id, colors, categories!products_category_id_fkey(id, name_ar)').order('name_ar');
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['inventory-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('id, name_ar');
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

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

  const { data: movements = [] } = useQuery({
    queryKey: ['inventory-movements'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inventory_movements').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: drafts = [], isLoading: draftsLoading } = useQuery({
    queryKey: ['purchase-drafts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_drafts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  // ====== MUTATIONS ======
  const createDraftMutation = useMutation({
    mutationFn: async () => {
      const totalValue = draftItems.reduce((s, i) => s + i.line_total, 0);
      const { error } = await supabase.from('purchase_drafts').insert({
        title: draftTitle || `مسودة ${format(new Date(), 'dd/MM/yyyy')}`,
        items: draftItems as any,
        total_value: totalValue,
        notes: draftNotes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-drafts'] });
      toast.success('تم إنشاء المسودة بنجاح');
      setShowDraftForm(false);
      setDraftTitle('');
      setDraftItems([]);
      setDraftNotes('');
    },
    onError: () => toast.error('خطأ في إنشاء المسودة'),
  });

  const convertDraftMutation = useMutation({
    mutationFn: async (draft: any) => {
      const items = (draft.items || []) as DraftItem[];
      const totalCost = items.reduce((s: number, i: DraftItem) => s + i.line_total, 0);
      const totalQty = items.reduce((s: number, i: DraftItem) => s + i.quantity, 0);

      // Get the first product_id for backward compat
      const firstProductId = items[0]?.product_id;

      const { error: shipErr } = await supabase.from('future_shipments').insert({
        product_id: firstProductId || null,
        quantity: totalQty,
        total_cost: totalCost,
        note: `مسودة: ${draft.title || ''}`,
        draft_id: draft.id,
        items: items as any,
      });
      if (shipErr) throw shipErr;

      const { error: draftErr } = await supabase.from('purchase_drafts').update({
        status: 'converted',
        converted_at: new Date().toISOString(),
      }).eq('id', draft.id);
      if (draftErr) throw draftErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-drafts'] });
      queryClient.invalidateQueries({ queryKey: ['future-shipments'] });
      toast.success('تم تحويل المسودة إلى شحنة معلقة');
    },
    onError: () => toast.error('خطأ في تحويل المسودة'),
  });

  const deleteDraftMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('purchase_drafts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-drafts'] });
      toast.success('تم حذف المسودة');
    },
  });

  const mergeShipmentMutation = useMutation({
    mutationFn: async (shipment: any) => {
      const items = (shipment.items || []) as DraftItem[];

      if (items.length > 0) {
        // Update stock for each product in the shipment
        const productUpdates: Record<string, number> = {};
        items.forEach((item: DraftItem) => {
          productUpdates[item.product_id] = (productUpdates[item.product_id] || 0) + item.quantity;
        });

        for (const [pid, qty] of Object.entries(productUpdates)) {
          const product = products.find(p => p.id === pid);
          const currentStock = Number(product?.direct_stock) || 0;
          const { error } = await supabase.from('products').update({ direct_stock: currentStock + qty }).eq('id', pid);
          if (error) throw error;

          await supabase.from('inventory_movements').insert({
            product_id: pid,
            movement_type: 'inbound',
            quantity: qty,
            stock_field: 'direct_stock',
            note: `استلام شحنة: ${shipment.note || ''}`,
          });
        }
      } else {
        // Legacy single-product shipment
        const product = products.find(p => p.id === shipment.product_id);
        if (!product) throw new Error('المنتج غير موجود');
        const currentStock = Number(product.direct_stock) || 0;
        const { error } = await supabase.from('products').update({ direct_stock: currentStock + shipment.quantity }).eq('id', shipment.product_id);
        if (error) throw error;

        await supabase.from('inventory_movements').insert({
          product_id: shipment.product_id,
          movement_type: 'inbound',
          quantity: shipment.quantity,
          stock_field: 'direct_stock',
          note: `استلام شحنة: ${shipment.note || ''} (تكلفة: ${formatPrice(shipment.total_cost)})`,
        });
      }

      const { error: mergeErr } = await supabase.from('future_shipments').update({ status: 'merged', merged_at: new Date().toISOString() }).eq('id', shipment.id);
      if (mergeErr) throw mergeErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
      queryClient.invalidateQueries({ queryKey: ['future-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      toast.success('تم استلام الشحنة وإضافتها للمخزون');
    },
    onError: (err: any) => toast.error(err.message || 'خطأ في استلام الشحنة'),
  });

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

  // ====== DRAFT ITEM HELPERS ======
  const selectedProduct = useMemo(() => products.find(p => p.id === draftItemForm.product_id), [products, draftItemForm.product_id]);

  const productColors = useMemo(() => {
    if (!selectedProduct?.colors) return [];
    try {
      const colors = typeof selectedProduct.colors === 'string' ? JSON.parse(selectedProduct.colors) : selectedProduct.colors;
      if (Array.isArray(colors)) return colors;
      return [];
    } catch { return []; }
  }, [selectedProduct]);

  const selectedColorOptions = useMemo(() => {
    if (!draftItemForm.color || productColors.length === 0) return [];
    const colorObj = productColors.find((c: any) => c.name === draftItemForm.color || c.color === draftItemForm.color);
    if (!colorObj) return [];
    if (Array.isArray(colorObj.options)) return colorObj.options;
    if (Array.isArray(colorObj.option_stocks)) return colorObj.option_stocks;
    return [];
  }, [productColors, draftItemForm.color]);

  const addItemToDraft = useCallback(() => {
    if (!draftItemForm.product_id || draftItemForm.quantity <= 0 || draftItemForm.unit_cost <= 0) return;
    const product = products.find(p => p.id === draftItemForm.product_id);
    const newItem: DraftItem = {
      product_id: draftItemForm.product_id,
      product_name: product?.name_ar || '',
      color: draftItemForm.color,
      option: draftItemForm.option,
      quantity: draftItemForm.quantity,
      unit_cost: draftItemForm.unit_cost,
      line_total: draftItemForm.quantity * draftItemForm.unit_cost,
    };
    setDraftItems(prev => [...prev, newItem]);
    setDraftItemForm({ product_id: '', color: '', option: '', quantity: 0, unit_cost: 0 });
  }, [draftItemForm, products]);

  const removeItemFromDraft = (index: number) => {
    setDraftItems(prev => prev.filter((_, i) => i !== index));
  };

  const draftGrandTotal = useMemo(() => draftItems.reduce((s, i) => s + i.line_total, 0), [draftItems]);

  // ====== COMPUTED ======
  const pendingShipments = useMemo(() => shipments.filter(s => s.status === 'pending'), [shipments]);
  const mergedShipments = useMemo(() => shipments.filter(s => s.status === 'merged'), [shipments]);
  const activeDrafts = useMemo(() => drafts.filter((d: any) => d.status === 'draft'), [drafts]);

  const totalInventoryCost = useMemo(() => {
    return products.reduce((sum, p) => sum + ((Number(p.cost_price) || 0) * (Number(p.direct_stock) || 0)), 0);
  }, [products]);

  const totalRevenue = useMemo(() => {
    return orders.reduce((sum, o) => sum + (Number(o.subtotal) || 0), 0);
  }, [orders]);

  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalStock = products.reduce((s, p) => s + (Number(p.direct_stock) || 0), 0);
    const lowStock = products.filter(p => { const s = Number(p.direct_stock) || 0; return s > 0 && s <= LOW_STOCK_THRESHOLD; }).length;
    const outOfStock = products.filter(p => (Number(p.direct_stock) || 0) <= 0).length;
    const avgUnitCost = totalStock > 0 ? Math.round(totalInventoryCost / totalStock) : 0;
    return { totalProducts, totalStock, lowStock, outOfStock, avgUnitCost };
  }, [products, totalInventoryCost]);

  const pendingShipmentsByProduct = useMemo(() => {
    const map: Record<string, { qty: number; cost: number }> = {};
    pendingShipments.forEach(s => {
      const items = (s as any).items as DraftItem[] | undefined;
      if (items && items.length > 0) {
        items.forEach((item: DraftItem) => {
          if (!map[item.product_id]) map[item.product_id] = { qty: 0, cost: 0 };
          map[item.product_id].qty += item.quantity;
          map[item.product_id].cost += item.line_total;
        });
      } else if (s.product_id) {
        if (!map[s.product_id]) map[s.product_id] = { qty: 0, cost: 0 };
        map[s.product_id].qty += s.quantity;
        map[s.product_id].cost += Number(s.total_cost);
      }
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

      {/* Floating Sidebar */}
      <motion.aside
        className="fixed top-4 right-4 bottom-4 z-50 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden"
        animate={{ width: sidebarOpen ? 220 : 64 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Logo area */}
        <div className="p-3 border-b border-white/5 flex items-center gap-3">
          <button onClick={() => navigate(ADMIN_ROUTES.financials)} className="p-2 rounded-xl hover:bg-white/10 transition-colors shrink-0">
            <ArrowRight className="h-4 w-4 text-white/60" />
          </button>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm font-bold text-white/80 whitespace-nowrap">
                إدارة المخزون
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.map(item => {
            const isActive = activeSection === item.id;
            const count = item.id === 'shipments' ? pendingShipments.length : item.id === 'drafts' ? activeDrafts.length : 0;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 relative group ${isActive ? 'bg-white/10' : 'hover:bg-white/[0.06]'}`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl border"
                    style={{ borderColor: `${item.color}40`, background: `linear-gradient(135deg, ${item.color}15, transparent)` }}
                  />
                )}
                <div className="relative z-10 shrink-0">
                  <item.icon className="h-5 w-5" style={{ color: isActive ? item.color : 'rgba(255,255,255,0.5)' }} />
                  {count > 0 && (
                    <span className="absolute -top-1.5 -left-1.5 min-w-[14px] h-3.5 px-1 rounded-full text-[8px] font-bold flex items-center justify-center text-white" style={{ background: item.color }}>{count}</span>
                  )}
                </div>
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                      className="relative z-10 text-xs whitespace-nowrap" style={{ color: isActive ? item.color : 'rgba(255,255,255,0.6)' }}>
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </nav>

        {/* Toggle button */}
        <div className="p-3 border-t border-white/5">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-full p-2 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center">
            {sidebarOpen ? <ChevronRight className="h-4 w-4 text-white/50" /> : <ChevronLeft className="h-4 w-4 text-white/50" />}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="relative z-10 transition-all duration-300" style={{ marginRight: sidebarOpen ? 236 : 80, padding: '24px 24px 24px 24px' }}>
        <AnimatePresence mode="wait">
          <motion.div key={activeSection} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>

            {/* ===== DASHBOARD ===== */}
            {activeSection === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <StatCard3D icon={DollarSign} label="قيمة المخزون" value={formatPrice(totalInventoryCost)} color={NEON.emerald} sub="بسعر التكلفة" />
                  <StatCard3D icon={ShoppingCart} label="إجمالي الإيرادات" value={formatPrice(totalRevenue)} color={NEON.cyan} sub="بدون التوصيل" />
                  <StatCard3D icon={Clock} label="شحنات معلقة" value={pendingShipments.length} color={NEON.amber} sub={pendingShipments.length > 0 ? `${pendingShipments.reduce((s, sh) => s + sh.quantity, 0)} وحدة` : 'لا يوجد'} />
                  <StatCard3D icon={FileText} label="مسودات نشطة" value={activeDrafts.length} color={NEON.purple} sub={activeDrafts.length > 0 ? `${formatPrice(activeDrafts.reduce((s: number, d: any) => s + Number(d.total_value || 0), 0))}` : 'لا يوجد'} />
                  <StatCard3D icon={Package} label="إجمالي المخزون" value={stats.totalStock} color={NEON.blue} sub={`متوسط الوحدة: ${stats.avgUnitCost > 0 ? formatPrice(stats.avgUnitCost) : '—'}`} />
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
                          <Tooltip contentStyle={{ background: 'rgba(15,15,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
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
                              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[9px]">+{pendingShipmentsByProduct[p.id].qty} قادم</Badge>
                            )}
                            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] font-mono">{Number(p.direct_stock) || 0}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </div>

                {/* Monthly trends */}
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
            )}

            {/* ===== DRAFTS ===== */}
            {activeSection === 'drafts' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white/90 flex items-center gap-2">
                    <FileText className="h-5 w-5" style={{ color: NEON.purple }} /> مسودات الشراء
                  </h2>
                  <Button onClick={() => setShowDraftForm(true)}
                    className="text-white border"
                    style={{ background: `linear-gradient(135deg, ${NEON.purple}33, ${NEON.purple}15)`, borderColor: `${NEON.purple}40` }}>
                    <Plus className="h-4 w-4 ml-1" /> مسودة جديدة
                  </Button>
                </div>

                {/* Draft Creation Form */}
                <AnimatePresence>
                  {showDraftForm && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                      <GlassCard className="p-6 border-purple-500/20">
                        <div className="flex items-center justify-between mb-5">
                          <h3 className="text-sm font-semibold text-white/80">إنشاء مسودة شراء جديدة</h3>
                          <button onClick={() => { setShowDraftForm(false); setDraftItems([]); setDraftTitle(''); }} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                            <X className="h-4 w-4 text-white/50" />
                          </button>
                        </div>

                        <div className="space-y-5">
                          {/* Draft title */}
                          <div>
                            <Label className="text-white/50 text-xs">عنوان المسودة</Label>
                            <Input value={draftTitle} onChange={e => setDraftTitle(e.target.value)}
                              className="bg-white/[0.04] border-white/10 text-white mt-1" placeholder="مثال: طلبية مارس 2026" />
                          </div>

                          {/* Add item form */}
                          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-3">
                            <p className="text-xs font-medium text-white/60">إضافة عنصر</p>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                              <div>
                                <Label className="text-white/40 text-[10px]">المنتج</Label>
                                <Select value={draftItemForm.product_id} onValueChange={v => setDraftItemForm(f => ({ ...f, product_id: v, color: '', option: '' }))}>
                                  <SelectTrigger className="bg-white/[0.04] border-white/10 text-white/70 mt-1 h-9 text-xs">
                                    <SelectValue placeholder="اختر" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-slate-900 border-white/10 max-h-60">
                                    {products.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.name_ar}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label className="text-white/40 text-[10px]">اللون (اختياري)</Label>
                                <Select value={draftItemForm.color} onValueChange={v => setDraftItemForm(f => ({ ...f, color: v, option: '' }))}>
                                  <SelectTrigger className="bg-white/[0.04] border-white/10 text-white/70 mt-1 h-9 text-xs">
                                    <SelectValue placeholder="—" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-slate-900 border-white/10">
                                    <SelectItem value="none" className="text-xs">بدون</SelectItem>
                                    {productColors.map((c: any, i: number) => (
                                      <SelectItem key={i} value={c.name || c.color || `color-${i}`} className="text-xs">{c.name || c.color}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label className="text-white/40 text-[10px]">الخيار (اختياري)</Label>
                                <Select value={draftItemForm.option} onValueChange={v => setDraftItemForm(f => ({ ...f, option: v }))}>
                                  <SelectTrigger className="bg-white/[0.04] border-white/10 text-white/70 mt-1 h-9 text-xs">
                                    <SelectValue placeholder="—" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-slate-900 border-white/10">
                                    <SelectItem value="none" className="text-xs">بدون</SelectItem>
                                    {selectedColorOptions.map((o: any, i: number) => (
                                      <SelectItem key={i} value={o.name || o.option || `opt-${i}`} className="text-xs">{o.name || o.option}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label className="text-white/40 text-[10px]">تكلفة الوحدة</Label>
                                <Input type="number" min={0} value={draftItemForm.unit_cost || ''} onChange={e => setDraftItemForm(f => ({ ...f, unit_cost: Number(e.target.value) }))}
                                  className="bg-white/[0.04] border-white/10 text-white font-mono mt-1 h-9 text-xs" placeholder="0" />
                              </div>

                              <div>
                                <Label className="text-white/40 text-[10px]">الكمية</Label>
                                <div className="flex gap-2 mt-1">
                                  <Input type="number" min={1} value={draftItemForm.quantity || ''} onChange={e => setDraftItemForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                                    className="bg-white/[0.04] border-white/10 text-white font-mono h-9 text-xs flex-1" placeholder="0" />
                                  <Button size="sm" className="h-9 px-3 shrink-0" onClick={addItemToDraft}
                                    disabled={!draftItemForm.product_id || draftItemForm.quantity <= 0 || draftItemForm.unit_cost <= 0}
                                    style={{ background: `linear-gradient(135deg, ${NEON.purple}44, ${NEON.purple}22)` }}>
                                    <Plus className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {draftItemForm.quantity > 0 && draftItemForm.unit_cost > 0 && (
                              <p className="text-[10px] text-white/40">
                                المجموع: <span className="font-mono font-bold" style={{ color: NEON.purple }}>{formatPrice(draftItemForm.quantity * draftItemForm.unit_cost)}</span>
                              </p>
                            )}
                          </div>

                          {/* Items table */}
                          {draftItems.length > 0 && (
                            <div className="rounded-xl overflow-hidden border border-white/5">
                              <Table>
                                <TableHeader>
                                  <TableRow className="border-white/5 hover:bg-transparent">
                                    <TableHead className="text-white/50 text-[10px]">المنتج</TableHead>
                                    <TableHead className="text-white/50 text-[10px]">اللون</TableHead>
                                    <TableHead className="text-white/50 text-[10px]">الخيار</TableHead>
                                    <TableHead className="text-white/50 text-[10px]">تكلفة الوحدة</TableHead>
                                    <TableHead className="text-white/50 text-[10px]">الكمية</TableHead>
                                    <TableHead className="text-white/50 text-[10px]">المجموع</TableHead>
                                    <TableHead className="text-white/50 text-[10px] w-10"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {draftItems.map((item, i) => (
                                    <TableRow key={i} className="border-white/5 hover:bg-white/[0.02]">
                                      <TableCell className="text-xs text-white/70">{item.product_name}</TableCell>
                                      <TableCell className="text-xs text-white/50">{item.color && item.color !== 'none' ? item.color : '—'}</TableCell>
                                      <TableCell className="text-xs text-white/50">{item.option && item.option !== 'none' ? item.option : '—'}</TableCell>
                                      <TableCell className="text-xs text-white/60 font-mono">{formatPrice(item.unit_cost)}</TableCell>
                                      <TableCell className="text-xs text-white/70 font-mono">{item.quantity}</TableCell>
                                      <TableCell className="text-xs font-mono font-bold" style={{ color: NEON.purple }}>{formatPrice(item.line_total)}</TableCell>
                                      <TableCell>
                                        <button onClick={() => removeItemFromDraft(i)} className="p-1 rounded hover:bg-red-500/20 transition-colors">
                                          <Trash2 className="h-3 w-3 text-red-400" />
                                        </button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}

                          {/* Grand total & actions */}
                          <div className="flex items-center justify-between pt-2">
                            <div className="space-y-1">
                              <p className="text-[10px] text-white/40">إجمالي المسودة</p>
                              <p className="text-lg font-bold font-mono" style={{ color: NEON.purple }}>{formatPrice(draftGrandTotal)}</p>
                              <p className="text-[10px] text-white/30">{draftItems.length} عنصر · {draftItems.reduce((s, i) => s + i.quantity, 0)} وحدة</p>
                            </div>

                            <div className="space-y-2">
                              <Textarea value={draftNotes} onChange={e => setDraftNotes(e.target.value)}
                                className="bg-white/[0.04] border-white/10 text-white/80 resize-none text-xs w-64" rows={2} placeholder="ملاحظات (اختياري)..." />
                              <Button className="w-full text-white"
                                style={{ background: `linear-gradient(135deg, ${NEON.purple}44, ${NEON.purple}22)`, borderColor: `${NEON.purple}40` }}
                                disabled={draftItems.length === 0 || createDraftMutation.isPending}
                                onClick={() => createDraftMutation.mutate()}>
                                {createDraftMutation.isPending ? 'جاري...' : 'حفظ المسودة'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </GlassCard>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Existing Drafts */}
                <div className="space-y-4">
                  {draftsLoading ? (
                    <div className="text-center py-12 text-white/30 text-xs">جاري التحميل...</div>
                  ) : drafts.length === 0 ? (
                    <GlassCard className="p-12 text-center">
                      <FileText className="h-10 w-10 mx-auto mb-3" style={{ color: `${NEON.purple}44` }} />
                      <p className="text-white/40 text-xs">لا توجد مسودات بعد</p>
                    </GlassCard>
                  ) : drafts.map((draft: any) => {
                    const items = (draft.items || []) as DraftItem[];
                    const isConverted = draft.status === 'converted';
                    return (
                      <GlassCard key={draft.id} className={`p-5 ${isConverted ? 'opacity-60' : ''}`}>
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-white/80">{draft.title || 'مسودة بدون عنوان'}</h3>
                              <Badge className={isConverted ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px]' : 'bg-purple-500/20 text-purple-400 border-purple-500/30 text-[9px]'}>
                                {isConverted ? 'تم التحويل' : 'مسودة'}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-white/40 mt-1">{format(new Date(draft.created_at), 'dd/MM/yyyy HH:mm', { locale: ar })}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {!isConverted && (
                              <>
                                <Button size="sm" className="h-7 text-[10px] px-3 text-white border"
                                  style={{ background: `linear-gradient(135deg, ${NEON.blue}33, ${NEON.blue}15)`, borderColor: `${NEON.blue}40` }}
                                  disabled={convertDraftMutation.isPending}
                                  onClick={() => convertDraftMutation.mutate(draft)}>
                                  <Send className="h-3 w-3 ml-1" /> تحويل لشحنة
                                </Button>
                                <button onClick={() => deleteDraftMutation.mutate(draft.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors">
                                  <Trash2 className="h-3.5 w-3.5 text-red-400/60" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Items summary */}
                        <div className="space-y-1.5">
                          {items.map((item: DraftItem, i: number) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] text-xs">
                              <div className="flex items-center gap-3">
                                <span className="text-white/70">{item.product_name}</span>
                                {item.color && item.color !== 'none' && <span className="text-white/30">• {item.color}</span>}
                                {item.option && item.option !== 'none' && <span className="text-white/30">• {item.option}</span>}
                              </div>
                              <div className="flex items-center gap-4 font-mono">
                                <span className="text-white/40">{item.quantity}×</span>
                                <span className="text-white/50">{formatPrice(item.unit_cost)}</span>
                                <span className="font-bold" style={{ color: NEON.purple }}>{formatPrice(item.line_total)}</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                          <span className="text-[10px] text-white/40">{items.length} عنصر · {items.reduce((s: number, i: DraftItem) => s + i.quantity, 0)} وحدة</span>
                          <span className="text-sm font-bold font-mono" style={{ color: NEON.purple }}>{formatPrice(Number(draft.total_value) || 0)}</span>
                        </div>
                      </GlassCard>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ===== SHIPMENTS ===== */}
            {activeSection === 'shipments' && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-white/90 flex items-center gap-2">
                  <Truck className="h-5 w-5" style={{ color: NEON.blue }} /> الشحنات المستقبلية
                  {pendingShipments.length > 0 && (
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">{pendingShipments.length} معلقة</Badge>
                  )}
                </h2>

                {/* Pending Shipments */}
                {pendingShipments.length === 0 ? (
                  <GlassCard className="p-12 text-center">
                    <Truck className="h-10 w-10 mx-auto mb-3" style={{ color: `${NEON.blue}33` }} />
                    <p className="text-white/40 text-xs">لا توجد شحنات معلقة</p>
                    <p className="text-[10px] text-white/30 mt-1">قم بتحويل مسودة شراء لإنشاء شحنة</p>
                  </GlassCard>
                ) : (
                  <div className="space-y-4">
                    {pendingShipments.map(s => {
                      const items = ((s as any).items || []) as DraftItem[];
                      const totalQty = items.length > 0 ? items.reduce((sum: number, i: DraftItem) => sum + i.quantity, 0) : s.quantity;
                      const totalCost = Number(s.total_cost);
                      return (
                        <GlassCard key={s.id} className="p-5">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <p className="text-xs text-white/80">{s.note || 'شحنة بدون وصف'}</p>
                              <p className="text-[10px] text-white/40 mt-1">{format(new Date(s.created_at), 'dd/MM/yyyy HH:mm', { locale: ar })}</p>
                            </div>
                            <div className="text-left">
                              <p className="text-xs font-mono font-bold text-white/80">{totalQty} وحدة</p>
                              <p className="text-xs font-mono" style={{ color: NEON.cyan }}>{formatPrice(totalCost)}</p>
                              <p className="text-[10px] font-mono text-white/40">الوحدة: {totalQty > 0 ? formatPrice(Math.round(totalCost / totalQty)) : '—'}</p>
                            </div>
                          </div>

                          {/* Items details */}
                          {items.length > 0 && (
                            <div className="space-y-1.5 mb-4">
                              {items.map((item: DraftItem, i: number) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] text-[11px]">
                                  <div className="flex items-center gap-2">
                                    <span className="text-white/60">{item.product_name}</span>
                                    {item.color && item.color !== 'none' && <span className="text-white/25">• {item.color}</span>}
                                    {item.option && item.option !== 'none' && <span className="text-white/25">• {item.option}</span>}
                                  </div>
                                  <span className="font-mono text-white/50">{item.quantity}×</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <Button className="w-full text-white border h-9 text-xs"
                            style={{ background: `linear-gradient(135deg, ${NEON.emerald}33, ${NEON.emerald}15)`, borderColor: `${NEON.emerald}40` }}
                            disabled={mergeShipmentMutation.isPending}
                            onClick={() => mergeShipmentMutation.mutate(s)}>
                            <CheckCircle2 className="h-3.5 w-3.5 ml-1" /> تم الاستلام — إضافة للمخزون
                          </Button>
                        </GlassCard>
                      );
                    })}
                  </div>
                )}

                {/* Merged History */}
                {mergedShipments.length > 0 && (
                  <GlassCard className="p-5">
                    <h3 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" style={{ color: NEON.emerald }} /> الشحنات المستلمة
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
                      {mergedShipments.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-lg" style={{ background: `${NEON.emerald}15` }}>
                              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: NEON.emerald }} />
                            </div>
                            <div>
                              <p className="text-xs text-white/60">{s.note || 'شحنة'}</p>
                              <p className="text-[10px] text-white/30">{s.merged_at ? format(new Date(s.merged_at), 'dd/MM/yyyy HH:mm') : ''}</p>
                            </div>
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-mono text-white/50">+{s.quantity} وحدة</p>
                            <p className="text-[10px] font-mono text-white/30">{formatPrice(Number(s.total_cost))}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                )}
              </div>
            )}

            {/* ===== LIVE INVENTORY ===== */}
            {activeSection === 'inventory' && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white/90 flex items-center gap-2">
                  <Package className="h-5 w-5" style={{ color: NEON.emerald }} /> المخزون المباشر
                </h2>

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
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
