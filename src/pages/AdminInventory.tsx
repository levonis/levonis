import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, AlertTriangle, TrendingUp, ArrowDownCircle,
  Search, BarChart3, Boxes, DollarSign, ArrowRight, Truck,
  Plus, CheckCircle2, Clock, ShoppingCart, FileText, ChevronLeft,
  ChevronRight, Trash2, X, Send, Palette, Settings2, Pencil, Undo2,
  ChevronDown, ChevronUp, Download } from
'lucide-react';
import { ADMIN_ROUTES } from '@/config/adminConfig';
import { useNavigate } from 'react-router-dom';
import { formatPrice } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { adminUpdateProduct } from '@/lib/adminMutations';
import { useHorizontalWheelScroll } from '@/hooks/useHorizontalWheelScroll';

const LOW_STOCK_THRESHOLD = 5;

const NEON = {
  cyan: 'hsl(185 100% 50%)',
  purple: 'hsl(270 100% 65%)',
  emerald: 'hsl(155 100% 45%)',
  red: 'hsl(0 100% 60%)',
  amber: 'hsl(40 100% 55%)',
  blue: 'hsl(210 100% 60%)'
};

type Section = 'dashboard' | 'drafts' | 'shipments' | 'inventory';

interface DraftItem {
  product_id: string;
  product_name: string;
  color: string;
  option: string;
  quantity: number;
  unit_cost: number;
  shipping_cost: number;
  commission: number;
  other_costs: number;
  sale_price: number;
  line_total: number;
}

interface DraftItemFormState {
  product_id: string;
  colors: string[];
  options: string[];
  quantity: number;
  unit_cost: number;
}

const parseProductColors = (rawColors: unknown): any[] => {
  if (!rawColors) return [];
  try {
    const parsed = typeof rawColors === 'string' ? JSON.parse(rawColors) : rawColors;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getVariantColorName = (color: any, fallback = ''): string =>
  String(color?.color || color?.name || color?.name_ar || fallback || '').trim();

const getVariantOptionName = (option: any): string => {
  if (typeof option === 'string') return option.trim();
  return String(option?.name || option?.option || option?.name_ar || option?.label || '').trim();
};

const collectVariantOptionNames = (colors: any[], selectedColor?: string): string[] => {
  const optionSet = new Set<string>();
  const relevantColors = selectedColor
    ? colors.filter((color) => getVariantColorName(color) === selectedColor)
    : colors;

  relevantColors.forEach((color: any) => {
    if (Array.isArray(color?.options)) {
      color.options.forEach((option: any) => {
        const name = getVariantOptionName(option);
        if (name) optionSet.add(name);
      });
    }

    if (Array.isArray(color?.linked_options)) {
      color.linked_options.forEach((option: any) => {
        const name = getVariantOptionName(option);
        if (name) optionSet.add(name);
      });
    }

    if (color?.option_stocks && typeof color.option_stocks === 'object' && !Array.isArray(color.option_stocks)) {
      Object.keys(color.option_stocks).forEach((key) => {
        const name = getVariantOptionName(key);
        if (name) optionSet.add(name);
      });
    }
  });

  return Array.from(optionSet);
};

// ====== GLASS COMPONENTS ======
const GlassCard = ({ children, className = '', style }: {children: React.ReactNode;className?: string;style?: React.CSSProperties;}) =>
<div className={`relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300 hover:border-white/[0.12] ${className}`} style={style}>
    {children}
  </div>;


const StatCard3D = ({ icon: Icon, label, value, color, sub }: {icon: any;label: string;value: string | number;color: string;sub?: string;}) =>
<div>
    <GlassCard className="p-5 cursor-default overflow-hidden">
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1">
          <p className="text-[11px] text-white/40 tracking-wide">{label}</p>
          <p className="text-xl font-bold text-white/90 tabular-nums">{value}</p>
          {sub && <p className="text-[10px] text-white/30">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-xl"
      style={{ background: `linear-gradient(135deg, ${color}22, ${color}08)` }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
      </div>
    </GlassCard>
  </div>;


// ====== SMART PRODUCT SEARCH ======
function ProductSearchDropdown({
  products,
  value,
  onSelect,
  placeholder = 'ابحث عن منتج...'





}: {products: any[];value: string;onSelect: (product: any) => void;placeholder?: string;}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedProduct = products.find((p) => p.id === value);

  const filtered = useMemo(() => {
    if (!query.trim()) return products.slice(0, 15);
    const q = query.toLowerCase();
    return products.filter((p) =>
    (p.name_ar || '').toLowerCase().includes(q) ||
    (p.id || '').toLowerCase().includes(q)
    ).slice(0, 20);
  }, [products, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (selectedProduct) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.06] border border-white/10">
        {selectedProduct.image_url &&
        <img src={selectedProduct.image_url} alt="" className="w-7 h-7 rounded-lg object-cover border border-white/10" />
        }
        <span className="flex-1 text-xs text-white/80 truncate">{selectedProduct.name_ar}</span>
        <button onClick={() => {onSelect({ id: '' });setQuery('');}} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
          <X className="h-3 w-3 text-white/40" />
        </button>
      </div>);

  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {setQuery(e.target.value);setOpen(true);}}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pr-9 bg-white/[0.04] border-white/10 text-white/80 placeholder:text-white/25 h-9 text-xs focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20" />
        
      </div>
      <AnimatePresence>
        {open &&
        <motion.div
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          className="absolute z-50 w-full mt-1.5 rounded-xl border border-white/10 bg-[hsl(230,25%,12%)] backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.5)] overflow-hidden">
          
            <div className="max-h-[240px] overflow-y-auto scrollbar-thin">
              {filtered.length === 0 ?
            <div className="p-6 text-center text-white/30 text-xs">لا توجد نتائج</div> :
            filtered.map((p) =>
            <button
              key={p.id}
              onClick={() => {onSelect(p);setOpen(false);setQuery('');}}
              className="w-full flex items-center gap-3 p-2.5 hover:bg-white/[0.06] transition-all text-right group/item">
              
                  {p.image_url ?
              <img src={p.image_url} alt="" className="w-8 h-8 rounded-lg object-cover border border-white/10 group-hover/item:border-cyan-500/30 transition-colors" /> :

              <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center">
                      <Package className="h-3.5 w-3.5 text-white/20" />
                    </div>
              }
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/70 truncate group-hover/item:text-white/90 transition-colors">{p.name_ar}</p>
                    <p className="text-[10px] text-white/25 font-mono">{formatPrice(p.price)}</p>
                  </div>
                  <span className="text-[10px] font-mono text-white/20">{Number(p.direct_stock) || 0}</span>
                </button>
            )}
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}

// ====== VARIANT SELECTOR (Color + Option) - Multi-Select ======
function VariantSelector({
  product,
  selectedColors,
  selectedOptions,
  onColorsChange,
  onOptionsChange
}: {product: any; selectedColors: string[]; selectedOptions: string[]; onColorsChange: (c: string[]) => void; onOptionsChange: (o: string[]) => void;}) {
  const productColors = useMemo(() => {
    return parseProductColors(product?.colors);
  }, [product]);

  // Collect all unique options from all colors (handle both array and object formats)
  const allOptions = useMemo(() => {
    let opts = collectVariantOptionNames(productColors);
    if (opts.length === 0 && Array.isArray(product?.product_options)) {
      opts = product.product_options.map((o: any) => o.name_ar || o.name || '').filter(Boolean);
    }
    return opts;
  }, [productColors, product]);

  if (productColors.length === 0 && allOptions.length === 0) return null;

  const getColorHint = (name: string): string => {
    const map: Record<string, string> = {
      'أحمر': '#ef4444', 'أزرق': '#3b82f6', 'أخضر': '#22c55e', 'أصفر': '#eab308',
      'أسود': '#1e1e1e', 'أبيض': '#f0f0f0', 'بنفسجي': '#a855f7', 'وردي': '#ec4899',
      'برتقالي': '#f97316', 'رمادي': '#6b7280', 'بني': '#92400e', 'سماوي': '#06b6d4',
      'red': '#ef4444', 'blue': '#3b82f6', 'green': '#22c55e', 'yellow': '#eab308',
      'black': '#1e1e1e', 'white': '#f0f0f0', 'purple': '#a855f7', 'pink': '#ec4899',
      'orange': '#f97316', 'gray': '#6b7280', 'grey': '#6b7280', 'brown': '#92400e'
    };
    const lower = name.toLowerCase();
    for (const [key, val] of Object.entries(map)) {
      if (lower.includes(key)) return val;
    }
    return NEON.cyan;
  };

  const toggleColor = (name: string) => {
    if (selectedColors.includes(name)) {
      onColorsChange(selectedColors.filter(c => c !== name));
    } else {
      onColorsChange([...selectedColors, name]);
    }
  };

  const toggleOption = (name: string) => {
    if (selectedOptions.includes(name)) {
      onOptionsChange(selectedOptions.filter(o => o !== name));
    } else {
      onOptionsChange([...selectedOptions, name]);
    }
  };

  const selectAllColors = () => {
    const allNames = productColors.map((c: any, i: number) => getVariantColorName(c, `color-${i}`)).filter(Boolean);
    onColorsChange(allNames);
  };

  const selectAllOptions = () => {
    onOptionsChange([...allOptions]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="space-y-2.5">
      
      {/* Colors */}
      {productColors.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-white/35 text-[10px] flex items-center gap-1.5">
              <Palette className="h-3 w-3" /> الألوان
              {selectedColors.length > 0 && <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[8px] px-1 py-0">{selectedColors.length}</Badge>}
            </Label>
            <button onClick={selectAllColors} className="text-[9px] text-cyan-400/60 hover:text-cyan-400 transition-colors">تحديد الكل</button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {productColors.map((c: any, i: number) => {
              const name = getVariantColorName(c, `color-${i}`);
              const hint = getColorHint(name);
              const isActive = selectedColors.includes(name);
              return (
                <button
                  key={i}
                  onClick={() => toggleColor(name)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] border transition-all duration-200 flex items-center gap-1.5
                    ${isActive ? 'border-white/25 text-white/80' : 'bg-white/[0.03] border-white/5 text-white/40 hover:border-white/15'}`}
                  style={isActive ? { background: `${hint}18`, borderColor: `${hint}50`, boxShadow: `0 0 12px ${hint}20` } : {}}>
                  <span className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                    style={{ background: hint, boxShadow: isActive ? `0 0 8px ${hint}60` : 'none' }} />
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Options */}
      {allOptions.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-white/35 text-[10px] flex items-center gap-1.5">
              <Settings2 className="h-3 w-3" /> الخيارات
              {selectedOptions.length > 0 && <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[8px] px-1 py-0">{selectedOptions.length}</Badge>}
            </Label>
            <button onClick={selectAllOptions} className="text-[9px] text-blue-400/60 hover:text-blue-400 transition-colors">تحديد الكل</button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {allOptions.map((name, i) => {
              const isActive = selectedOptions.includes(name);
              return (
                <button
                  key={i}
                  onClick={() => toggleOption(name)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] border transition-all
                    ${isActive ? 'bg-blue-500/15 border-blue-500/30 text-blue-300' : 'bg-white/[0.03] border-white/5 text-white/40 hover:border-white/15'}`}>
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ====== NAV ITEMS ======
const NAV_ITEMS: {id: Section;icon: any;label: string;color: string;}[] = [
{ id: 'dashboard', icon: BarChart3, label: 'لوحة التحكم', color: NEON.cyan },
{ id: 'drafts', icon: FileText, label: 'مسودات الشراء', color: NEON.purple },
{ id: 'shipments', icon: Truck, label: 'الشحنات', color: NEON.blue },
{ id: 'inventory', icon: Package, label: 'المخزون المباشر', color: NEON.emerald }];

// ====== MAIN COMPONENT ======
export default function AdminInventory() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState('all');
  const draftTableScrollRef = useHorizontalWheelScroll<HTMLDivElement>();
  const productsTableScrollRef = useHorizontalWheelScroll<HTMLDivElement>();

  // Draft creation/edit state
  const [showDraftForm, setShowDraftForm] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [draftNotes, setDraftNotes] = useState('');
  const [draftItemForm, setDraftItemForm] = useState<DraftItemFormState>({ product_id: '', colors: [], options: [], quantity: 0, unit_cost: 0 });
  const collapsedDraftsStorageKey = useMemo(() => `admin-inventory:collapsedDrafts:${user?.id || 'anon'}`, [user?.id]);
  const [collapsedDrafts, setCollapsedDrafts] = useState<Record<string, boolean>>(() => {
    try {
      if (typeof window === 'undefined') return {};
      const raw = localStorage.getItem(`admin-inventory:collapsedDrafts:anon`);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  // Reload when user identity becomes known
  useEffect(() => {
    try {
      const raw = localStorage.getItem(collapsedDraftsStorageKey);
      setCollapsedDrafts(raw ? JSON.parse(raw) : {});
    } catch { /* ignore */ }
  }, [collapsedDraftsStorageKey]);
  // Persist
  useEffect(() => {
    try { localStorage.setItem(collapsedDraftsStorageKey, JSON.stringify(collapsedDrafts)); } catch { /* ignore */ }
  }, [collapsedDrafts, collapsedDraftsStorageKey]);
  const toggleDraftCollapse = (id: string) => setCollapsedDrafts((prev) => ({ ...prev, [id]: !prev[id] }));

  // Inventory variant expansion
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  // ====== DATA QUERIES ======
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['inventory-products'],
    queryFn: async () => {
      const [prodRes, catRes, optRes] = await Promise.all([
        (supabase as any).from('products_admin').select('id, name_ar, price, cost_price, shipping_cost_iqd, commission_iqd, commission_direct_iqd, other_costs_iqd, direct_stock, image_url, category_id, colors').order('name_ar'),
        supabase.from('categories').select('id, name_ar'),
        supabase.from('product_options').select('id, product_id, name_ar'),
      ]);
      if (prodRes.error) throw prodRes.error;
      if (catRes.error) throw catRes.error;
      if (optRes.error) throw optRes.error;
      const catMap = new Map((catRes.data || []).map((c: any) => [c.id, c]));
      const optMap = new Map<string, any[]>();
      (optRes.data || []).forEach((o: any) => {
        const arr = optMap.get(o.product_id) || [];
        arr.push({ id: o.id, name_ar: o.name_ar });
        optMap.set(o.product_id, arr);
      });
      return (prodRes.data || []).map((p: any) => ({
        ...p,
        categories: catMap.get(p.category_id) || null,
        product_options: optMap.get(p.id) || [],
      }));
    },
    enabled: isAdmin
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['inventory-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('id, name_ar');
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['inventory-orders-revenue'],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('orders').
      select('id, subtotal, total_amount, status, order_type').
      in('order_type', ['direct', 'auto']).
      not('status', 'eq', 'cancelled');
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin
  });

  const { data: shipments = [] } = useQuery({
    queryKey: ['future-shipments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('future_shipments').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin
  });

  const { data: movements = [] } = useQuery({
    queryKey: ['inventory-movements'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inventory_movements').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin
  });

  const { data: drafts = [], isLoading: draftsLoading } = useQuery({
    queryKey: ['purchase-drafts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_drafts').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin
  });

  // ====== MUTATIONS ======
  const createDraftMutation = useMutation({
    mutationFn: async () => {
      const totalValue = draftItems.reduce((s, i) => s + i.line_total, 0);
      if (editingDraftId) {
        const { error } = await supabase.from('purchase_drafts').update({
          title: draftTitle || `مسودة ${format(new Date(), 'dd/MM/yyyy')}`,
          items: draftItems as any,
          total_value: totalValue,
          notes: draftNotes,
          reverted_from_shipment: false
        }).eq('id', editingDraftId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('purchase_drafts').insert({
          title: draftTitle || `مسودة ${format(new Date(), 'dd/MM/yyyy')}`,
          items: draftItems as any,
          total_value: totalValue,
          notes: draftNotes
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-drafts'] });
      toast.success(editingDraftId ? 'تم تحديث المسودة بنجاح' : 'تم إنشاء المسودة بنجاح');
      setShowDraftForm(false);
      setEditingDraftId(null);
      setDraftTitle('');
      setDraftItems([]);
      setDraftNotes('');
    },
    onError: () => toast.error('خطأ في حفظ المسودة')
  });

  const convertDraftMutation = useMutation({
    mutationFn: async (draft: any) => {
      const items = (draft.items || []) as DraftItem[];
      const totalCost = items.reduce((s: number, i: DraftItem) => s + i.line_total, 0);
      const totalQty = items.reduce((s: number, i: DraftItem) => s + i.quantity, 0);
      const firstProductId = items[0]?.product_id;

      if (!firstProductId) throw new Error('المسودة لا تحتوي على منتجات');

      const { error: shipErr } = await supabase.from('future_shipments').insert({
        product_id: firstProductId,
        quantity: totalQty,
        total_cost: totalCost,
        note: `مسودة: ${draft.title || ''}`,
        draft_id: draft.id,
        items: items as any
      });
      if (shipErr) throw shipErr;

      const { error: draftErr } = await supabase.from('purchase_drafts').delete().eq('id', draft.id);
      if (draftErr) throw draftErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-drafts'] });
      queryClient.invalidateQueries({ queryKey: ['future-shipments'] });
      toast.success('تم تحويل المسودة إلى شحنة معلقة');
    },
    onError: (err: any) => {
      console.error('Draft convert error:', err);
      toast.error(err?.message || 'خطأ في تحويل المسودة');
    }
  });

  const deleteDraftMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('purchase_drafts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-drafts'] });
      toast.success('تم حذف المسودة');
    }
  });

  const revertShipmentToDraftMutation = useMutation({
    mutationFn: async (shipment: any) => {
      const items = (shipment.items || []) as DraftItem[];
      // Create a new draft from shipment data
      const { error: draftErr } = await supabase.from('purchase_drafts').insert({
        title: shipment.note || 'مسودة شراء',
        items: items as any,
        total_value: Number(shipment.total_cost) || 0,
        status: 'draft'
      });
      if (draftErr) throw draftErr;
      // Delete the shipment
      const { error: delErr } = await supabase.from('future_shipments').delete().eq('id', shipment.id);
      if (delErr) throw delErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-drafts'] });
      queryClient.invalidateQueries({ queryKey: ['future-shipments'] });
      toast.success('تم إرجاع الشحنة إلى مسودات الشراء');
    },
    onError: (err: any) => toast.error(err.message || 'خطأ في إرجاع الشحنة')
  });

  const mergeShipmentMutation = useMutation({
    mutationFn: async (shipment: any) => {
      const items = (shipment.items || []) as DraftItem[];
      if (items.length > 0) {
        // Group items by product_id to batch updates
        const byProduct: Record<string, DraftItem[]> = {};
        items.forEach((item: DraftItem) => {
          if (!byProduct[item.product_id]) byProduct[item.product_id] = [];
          byProduct[item.product_id].push(item);
        });

        for (const [pid, pItems] of Object.entries(byProduct)) {
          // Fetch fresh product data
          const { data: product, error: fetchErr } = await (supabase as any)
            .from('products_admin')
            .select('id, direct_stock, colors, cost_price')
            .eq('id', pid)
            .single();
          if (fetchErr || !product) throw new Error('المنتج غير موجود: ' + pid);
          const adminProduct = product as any;

          let colors = (adminProduct.colors || []) as any[];
          let directStockAdd = 0;

          for (const item of pItems) {
            const hasColor = item.color && item.color !== 'none' && item.color !== '';
            const hasOption = item.option && item.option !== 'none' && item.option !== '';

            const normalize = (s: string) => String(s ?? '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '').replace(/\s+/g, ' ').trim();
            const itemColorNorm = normalize(item.color || '');
            const itemOptionNorm = normalize(item.option || '');

            const findColorIdx = () => colors.findIndex((c: any) => normalize(getVariantColorName(c)) === itemColorNorm);
            const findOptionKey = (optStocks: any, opt: string): string => {
              if (!optStocks || typeof optStocks !== 'object') return opt;
              const target = normalize(opt);
              const match = Object.keys(optStocks).find((k) => normalize(k) === target);
              return match || opt;
            };

            if (hasColor && hasOption) {
              // Update option_stocks within the matching color
              const colorIdx = findColorIdx();
              if (colorIdx >= 0) {
                const optStocks = colors[colorIdx].option_stocks || {};
                const key = findOptionKey(optStocks, item.option);
                optStocks[key] = (Number(optStocks[key]) || 0) + item.quantity;
                colors[colorIdx].option_stocks = optStocks;
              } else {
                // Color not found in JSONB, add it
                colors.push({
                  color: item.color,
                  image: '',
                  option_stocks: { [item.option]: item.quantity }
                });
              }
            } else if (hasColor && !hasOption) {
              // Color only - update direct_stock on color level or add quantity to product direct_stock
              const colorIdx = findColorIdx();
              if (colorIdx >= 0) {
                const optStocks = colors[colorIdx].option_stocks || {};
                optStocks['_default'] = (Number(optStocks['_default']) || 0) + item.quantity;
                colors[colorIdx].option_stocks = optStocks;
              } else {
                directStockAdd += item.quantity;
              }
            } else {
              // No color, no option - just add to direct_stock
              directStockAdd += item.quantity;
            }

            // Record inventory movement with details
            await supabase.from('inventory_movements').insert({
              product_id: pid,
              movement_type: 'inbound',
              quantity: item.quantity,
              stock_field: (hasColor && hasOption) ? 'option_stocks' : 'direct_stock',
              note: `استلام شحنة: ${shipment.note || ''} | لون: ${item.color || '-'} | خيار: ${item.option || '-'} | تكلفة: ${item.unit_cost}`
            });
          }

          // Build update object
          const updateObj: any = { colors };
          if (directStockAdd > 0) {
            updateObj.direct_stock = (Number(adminProduct.direct_stock) || 0) + directStockAdd;
          }

          // Weighted-average cost_price update from incoming items
          const totalQtyForProd = pItems.reduce((s, it) => s + Number(it.quantity || 0), 0);
          const totalCostForProd = pItems.reduce((s, it) => s + Number(it.line_total || 0), 0);
          if (totalQtyForProd > 0 && totalCostForProd > 0) {
            const oldStock = Number(adminProduct.direct_stock) || 0;
            const oldCost = Number(adminProduct.cost_price) || 0;
            const newAvgCost = ((oldStock * oldCost) + totalCostForProd) / (oldStock + totalQtyForProd);
            updateObj.cost_price = Math.round(newAvgCost);
          }

          await adminUpdateProduct(pid, updateObj);
        }
      } else {
        // Legacy fallback for shipments without items array
        const product = products.find((p) => p.id === shipment.product_id);
        if (!product) throw new Error('المنتج غير موجود');
        const currentStock = Number(product.direct_stock) || 0;
        await adminUpdateProduct(shipment.product_id, { direct_stock: currentStock + shipment.quantity });
        await supabase.from('inventory_movements').insert({
          product_id: shipment.product_id, movement_type: 'inbound', quantity: shipment.quantity, stock_field: 'direct_stock',
          note: `استلام شحنة: ${shipment.note || ''} (تكلفة: ${formatPrice(shipment.total_cost)})`
        });
      }
      const { error: mergeErr } = await supabase.from('future_shipments').update({ status: 'merged', merged_at: new Date().toISOString() }).eq('id', shipment.id);
      if (mergeErr) throw mergeErr;
    },
    onSuccess: (_data, shipment: any) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
      queryClient.invalidateQueries({ queryKey: ['future-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      const items = (shipment?.items || []) as DraftItem[];
      const totalQty = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
      const lines = items.slice(0, 5).map((it) => {
        const prod = products.find((p) => p.id === it.product_id);
        const pname = prod?.name_ar || 'منتج';
        const c = it.color && it.color !== 'none' ? ` • ${it.color}` : '';
        const o = it.option && it.option !== 'none' ? ` • ${it.option}` : '';
        return `${pname}${c}${o}: +${it.quantity}`;
      });
      const more = items.length > 5 ? `\n+${items.length - 5} منتج إضافي` : '';
      toast.success(`تم تحديث المخزون (${totalQty} وحدة)`, {
        description: lines.join('\n') + more,
        duration: 6000
      });
    },
    onError: (err: any) => toast.error(err.message || 'خطأ في استلام الشحنة')
  });

  const updateStockMutation = useMutation({
    mutationFn: async ({ productId, value }: {productId: string;value: number;}) => {
      await adminUpdateProduct(productId, { direct_stock: value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
      toast.success('تم تحديث المخزون');
    },
    onError: () => toast.error('خطأ في التحديث')
  });

  // ====== DRAFT HELPERS ======
  const selectedDraftProduct = useMemo(() => products.find((p) => p.id === draftItemForm.product_id), [products, draftItemForm.product_id]);

  const addItemToDraft = useCallback(() => {
    if (!draftItemForm.product_id || draftItemForm.quantity <= 0 || draftItemForm.unit_cost <= 0) return;
    const product = products.find((p) => p.id === draftItemForm.product_id);
    const colorsToAdd = draftItemForm.colors.length > 0 ? draftItemForm.colors : [''];
    const optionsToAdd = draftItemForm.options.length > 0 ? draftItemForm.options : [''];
    
    const newItems: DraftItem[] = [];
    const prodShipping = Number((product as any)?.shipping_cost_iqd) || 0;
    // Profit = Direct Sale commission only (do not fall back to regular commission)
    const prodCommission = Number((product as any)?.commission_direct_iqd) || 0;
    const prodOther = Number((product as any)?.other_costs_iqd) || 0;
    const prodSale = Number((product as any)?.price) || 0;
    for (const color of colorsToAdd) {
      for (const option of optionsToAdd) {
        newItems.push({
          product_id: draftItemForm.product_id,
          product_name: product?.name_ar || '',
          color,
          option,
          quantity: draftItemForm.quantity,
          unit_cost: draftItemForm.unit_cost,
          shipping_cost: prodShipping,
          commission: prodCommission,
          other_costs: prodOther,
          sale_price: prodSale,
          line_total: draftItemForm.quantity * draftItemForm.unit_cost
        });
      }
    }
    setDraftItems((prev) => [...prev, ...newItems]);
    setDraftItemForm({ product_id: '', colors: [], options: [], quantity: 0, unit_cost: 0 });
  }, [draftItemForm, products]);

  const removeItemFromDraft = (index: number) => setDraftItems((prev) => prev.filter((_, i) => i !== index));
  const draftGrandTotal = useMemo(() => draftItems.reduce((s, i) => s + i.line_total, 0), [draftItems]);

  const exportDraftItemsCsv = useCallback(() => {
    if (draftItems.length === 0) return;
    const headers = ['المنتج', 'اللون', 'الخيار', 'تكلفة الوحدة', 'الشحن', 'الربح', 'الكمية', 'المجموع'];
    const esc = (v: any) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = draftItems.map((it) => {
      return [it.product_name, it.color || '-', it.option || '-', it.unit_cost, it.shipping_cost || 0, it.commission || 0, it.quantity, it.line_total].map(esc).join(',');
    });
    const tQty = draftItems.reduce((s, i) => s + (i.quantity || 0), 0);
    const tUnit = draftItems.reduce((s, i) => s + (i.unit_cost || 0) * (i.quantity || 0), 0);
    const tShip = draftItems.reduce((s, i) => s + (i.shipping_cost || 0) * (i.quantity || 0), 0);
    const tComm = draftItems.reduce((s, i) => s + (i.commission || 0) * (i.quantity || 0), 0);
    const tLine = draftItems.reduce((s, i) => s + (i.line_total || 0), 0);
    const totalRow = ['الإجمالي', '', '', tUnit, tShip, tComm, tQty, tLine].map(esc).join(',');
    const csv = '\uFEFF' + [headers.join(','), ...rows, totalRow].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-draft-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [draftItems]);

  // Helper: get available colors and options for a draft item's product
  const getDraftProductVariants = useCallback((productId: string, selectedColor?: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return { colors: [] as string[], options: [] as string[] };
    const colorsRaw = parseProductColors(product.colors);
    const colorNames = [...new Set(colorsRaw.map((c: any, i: number) => getVariantColorName(c, `color-${i}`)).filter(Boolean))];
    let optionNames = collectVariantOptionNames(colorsRaw, selectedColor);
    // Also include options from product_options table if no inline options found
    if (optionNames.length === 0 && Array.isArray((product as any).product_options)) {
      optionNames = (product as any).product_options
        .map((o: any) => o.name_ar || o.name || '')
        .filter(Boolean);
    }
    return { colors: colorNames, options: optionNames };
  }, [products]);

  // ====== EXPORT DRAFT TO PDF ======
  const exportDraftPdf = async (draft: any) => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { default: jsPDF } = await import('jspdf');

      const items: DraftItem[] = (draft?.items || []) as DraftItem[];
      if (items.length === 0) {
        toast.error('لا توجد عناصر للتصدير');
        return;
      }

      const fmt = (n: number) => (Number(n) || 0).toLocaleString('en-US');
      const dateStr = new Date().toLocaleDateString('ar-IQ');
      const createdStr = draft?.created_at ? format(new Date(draft.created_at), 'dd/MM/yyyy HH:mm', { locale: ar }) : '';
      const title = draft?.title || 'مسودة بدون عنوان';

      const totalQty = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
      const totalUnitCost = items.reduce((s, i) => s + (Number(i.unit_cost) || 0) * (Number(i.quantity) || 0), 0);
      const totalShipping = items.reduce((s, i) => s + (Number(i.shipping_cost) || 0) * (Number(i.quantity) || 0), 0);
      const totalCommission = items.reduce((s, i) => s + (Number(i.commission) || 0) * (Number(i.quantity) || 0), 0);
      const totalLine = items.reduce((s, i) => s + (Number(i.line_total) || 0), 0);

      const rowsHtml = items.map((it, i) => {
        const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
        return `<tr>
          <td style="background:${bg};padding:6px 10px;border:1px solid #e2e8f0;text-align:center;color:#64748b;font-size:11px">${i + 1}</td>
          <td style="background:${bg};padding:6px 10px;border:1px solid #e2e8f0;font-size:11px;color:#1e293b">${(it.product_name || '').replace(/</g, '&lt;')}</td>
          <td style="background:${bg};padding:6px 10px;border:1px solid #e2e8f0;font-size:11px;color:#475569;text-align:center">${String(it.color || '—').replace(/</g, '&lt;')}</td>
          <td style="background:${bg};padding:6px 10px;border:1px solid #e2e8f0;font-size:11px;color:#475569;text-align:center">${String(it.option || '—').replace(/</g, '&lt;')}</td>
          <td style="background:${bg};padding:6px 10px;border:1px solid #e2e8f0;font-size:11px;color:#1e293b;direction:ltr;text-align:center;font-family:monospace;font-weight:bold">${fmt(it.quantity)}</td>
          <td style="background:${bg};padding:6px 10px;border:1px solid #e2e8f0;font-size:11px;color:#7c3aed;direction:ltr;text-align:right;font-family:monospace">${fmt(it.unit_cost)}</td>
          <td style="background:${bg};padding:6px 10px;border:1px solid #e2e8f0;font-size:11px;color:#0369a1;direction:ltr;text-align:right;font-family:monospace">${fmt(it.shipping_cost || 0)}</td>
          <td style="background:${bg};padding:6px 10px;border:1px solid #e2e8f0;font-size:11px;color:#059669;direction:ltr;text-align:right;font-family:monospace">${fmt(it.commission || 0)}</td>
          <td style="background:${bg};padding:6px 10px;border:1px solid #e2e8f0;font-size:11px;color:#ea580c;direction:ltr;text-align:right;font-family:monospace;font-weight:bold">${fmt(it.line_total)}</td>
        </tr>`;
      }).join('');

      const html = `
        <div style="padding:24px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;background:#fff;color:#1e293b;width:1240px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #7c3aed;padding-bottom:14px;margin-bottom:18px">
            <div>
              <h1 style="margin:0 0 4px;font-size:26px;color:#0f172a">${title.replace(/</g, '&lt;')}</h1>
              <div style="font-size:12px;color:#64748b">تاريخ التصدير: ${dateStr}${createdStr ? ` &nbsp;|&nbsp; تاريخ الإنشاء: ${createdStr}` : ''} &nbsp;|&nbsp; ${items.length} عنصر</div>
            </div>
            <div style="text-align:left;font-size:11px;color:#94a3b8">Levonis · Purchase Draft</div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">
            <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#eff6ff"><div style="font-size:10px;color:#64748b;margin-bottom:4px">إجمالي الكمية</div><div style="font-size:18px;font-weight:bold;color:#1d4ed8;direction:ltr;text-align:right;font-family:monospace">${fmt(totalQty)}</div></div>
            <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#f5f3ff"><div style="font-size:10px;color:#64748b;margin-bottom:4px">تكلفة الشراء</div><div style="font-size:18px;font-weight:bold;color:#6d28d9;direction:ltr;text-align:right;font-family:monospace">${fmt(totalUnitCost)}</div></div>
            <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#f0f9ff"><div style="font-size:10px;color:#64748b;margin-bottom:4px">إجمالي الشحن</div><div style="font-size:18px;font-weight:bold;color:#0369a1;direction:ltr;text-align:right;font-family:monospace">${fmt(totalShipping)}</div></div>
            <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#fff7ed"><div style="font-size:10px;color:#64748b;margin-bottom:4px">المجموع الكلي</div><div style="font-size:18px;font-weight:bold;color:#ea580c;direction:ltr;text-align:right;font-family:monospace">${fmt(totalLine)}</div></div>
          </div>

          <table style="border-collapse:collapse;width:100%;direction:rtl">
            <thead>
              <tr>
                ${['#','المنتج','اللون','الخيار','الكمية','تكلفة الوحدة','الشحن','الربح','المجموع'].map(h => `<th style="background:#7c3aed;color:#fff;padding:10px;border:1px solid #6d28d9;font-size:12px;white-space:nowrap">${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="4" style="background:#f1f5f9;padding:10px;border:1px solid #cbd5e1;font-weight:bold;font-size:12px">الإجمالي</td>
                <td style="background:#f1f5f9;padding:10px;border:1px solid #cbd5e1;font-weight:bold;font-size:12px;direction:ltr;text-align:center;font-family:monospace">${fmt(totalQty)}</td>
                <td style="background:#f1f5f9;padding:10px;border:1px solid #cbd5e1;font-weight:bold;font-size:12px;color:#6d28d9;direction:ltr;text-align:right;font-family:monospace">${fmt(totalUnitCost)}</td>
                <td style="background:#f1f5f9;padding:10px;border:1px solid #cbd5e1;font-weight:bold;font-size:12px;color:#0369a1;direction:ltr;text-align:right;font-family:monospace">${fmt(totalShipping)}</td>
                <td style="background:#f1f5f9;padding:10px;border:1px solid #cbd5e1;font-weight:bold;font-size:12px;color:#059669;direction:ltr;text-align:right;font-family:monospace">${fmt(totalCommission)}</td>
                <td style="background:#fff7ed;padding:10px;border:1px solid #cbd5e1;font-weight:bold;font-size:13px;color:#ea580c;direction:ltr;text-align:right;font-family:monospace">${fmt(totalLine)}</td>
              </tr>
            </tfoot>
          </table>

          ${draft?.notes ? `<div style="margin-top:16px;padding:12px;border:1px solid #e2e8f0;border-radius:8px;background:#fafafa"><div style="font-size:11px;color:#64748b;margin-bottom:4px;font-weight:bold">ملاحظات</div><div style="font-size:12px;color:#1e293b;white-space:pre-wrap">${String(draft.notes).replace(/</g, '&lt;')}</div></div>` : ''}

          <div style="margin-top:14px;text-align:center;font-size:10px;color:#94a3b8">© ${new Date().getFullYear()} Levonis — تم التوليد تلقائياً</div>
        </div>`;

      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-99999px;top:0;z-index:-1';
      container.innerHTML = html;
      document.body.appendChild(container);

      try {
        const canvas = await html2canvas(container.firstElementChild as HTMLElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 8;
        const usableW = pageW - margin * 2;
        const usableH = pageH - margin * 2;
        const scaleFactor = usableW / canvas.width;
        const fullH = canvas.height * scaleFactor;

        if (fullH <= usableH) {
          pdf.addImage(imgData, 'PNG', margin, margin, usableW, fullH);
        } else {
          const sliceH = Math.floor(usableH / scaleFactor);
          let srcY = 0;
          let pageIdx = 0;
          while (srcY < canvas.height) {
            if (pageIdx > 0) pdf.addPage();
            const cur = Math.min(sliceH, canvas.height - srcY);
            const sc = document.createElement('canvas');
            sc.width = canvas.width; sc.height = cur;
            sc.getContext('2d')!.drawImage(canvas, 0, srcY, canvas.width, cur, 0, 0, canvas.width, cur);
            pdf.addImage(sc.toDataURL('image/png'), 'PNG', margin, margin, usableW, cur * scaleFactor);
            srcY += cur; pageIdx++;
          }
        }
        const safeTitle = (title || 'draft').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
        pdf.save(`${safeTitle}-${new Date().toISOString().slice(0, 10)}.pdf`);
        toast.success('تم تصدير المسودة كـ PDF');
      } finally {
        document.body.removeChild(container);
      }
    } catch (e) {
      console.error('Draft PDF export error:', e);
      toast.error('حدث خطأ أثناء تصدير PDF');
    }
  };

  // ====== ENGLISH PDF EXPORT (Product, Color, Option, Price, Quantity, Total) ======
  const exportDraftPdfEn = async (draft: any) => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { default: jsPDF } = await import('jspdf');

      const items: DraftItem[] = (draft?.items || []) as DraftItem[];
      if (items.length === 0) {
        toast.error('No items to export');
        return;
      }

      // Fetch English names for products, colors, options
      const productIds = Array.from(new Set(items.map((i) => i.product_id).filter(Boolean)));
      const [prodRowsRes, optRowsRes] = await Promise.all([
        (supabase as any)
          .from('products_admin')
          .select('id, name_ar, name_en, colors')
          .in('id', productIds),
        supabase
          .from('product_options')
          .select('id, product_id, name, name_ar')
          .in('product_id', productIds),
      ]);
      const prodRows = prodRowsRes.data || [];
      const optRows = optRowsRes.data || [];
      const prodMap = new Map<string, any>();
      prodRows.forEach((p: any) => prodMap.set(p.id, { ...p, product_options: [] }));
      optRows.forEach((o: any) => {
        const p = prodMap.get(o.product_id);
        if (p) p.product_options.push({ id: o.id, name: o.name, name_ar: o.name_ar });
      });

      const translateColor = (productId: string, colorName: string): string => {
        if (!colorName) return '—';
        const p = prodMap.get(productId);
        const colors = parseProductColors(p?.colors);
        const match = colors.find((c: any) =>
          (c?.name_ar && c.name_ar === colorName) ||
          (c?.name && c.name === colorName) ||
          (c?.color && c.color === colorName)
        );
        return (match?.name || match?.color || colorName) as string;
      };

      const translateOption = (productId: string, optionName: string): string => {
        if (!optionName) return '—';
        const p = prodMap.get(productId);
        const opts: any[] = p?.product_options || [];
        const match = opts.find((o: any) => o?.name_ar === optionName || o?.name === optionName);
        return (match?.name || optionName) as string;
      };

      const fmt = (n: number) => (Number(n) || 0).toLocaleString('en-US');
      const dateStr = new Date().toLocaleDateString('en-US');
      const titleSrc = draft?.title || 'Untitled Draft';
      const product0 = prodMap.get(items[0]?.product_id);
      const titleEn = product0?.name_en || titleSrc;

      let totalQty = 0;
      let totalSum = 0;

      const rowsHtml = items.map((it, i) => {
        const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
        const p = prodMap.get(it.product_id);
        const productEn = p?.name_en || it.product_name || '';
        const colorEn = translateColor(it.product_id, it.color);
        const optionEn = translateOption(it.product_id, it.option);
        const price = Number(it.unit_cost) || 0;
        const qty = Number(it.quantity) || 0;
        const lineTotal = price * qty;
        totalQty += qty;
        totalSum += lineTotal;
        return `<tr>
          <td style="background:${bg};padding:7px 10px;border:1px solid #e2e8f0;text-align:center;color:#64748b;font-size:11px">${i + 1}</td>
          <td style="background:${bg};padding:7px 10px;border:1px solid #e2e8f0;font-size:11px;color:#1e293b">${String(productEn).replace(/</g, '&lt;')}</td>
          <td style="background:${bg};padding:7px 10px;border:1px solid #e2e8f0;font-size:11px;color:#475569;text-align:center">${String(colorEn).replace(/</g, '&lt;')}</td>
          <td style="background:${bg};padding:7px 10px;border:1px solid #e2e8f0;font-size:11px;color:#475569;text-align:center">${String(optionEn).replace(/</g, '&lt;')}</td>
          <td style="background:${bg};padding:7px 10px;border:1px solid #e2e8f0;font-size:11px;color:#7c3aed;text-align:right;font-family:monospace">${fmt(price)}</td>
          <td style="background:${bg};padding:7px 10px;border:1px solid #e2e8f0;font-size:11px;color:#1e293b;text-align:center;font-family:monospace;font-weight:bold">${fmt(qty)}</td>
          <td style="background:${bg};padding:7px 10px;border:1px solid #e2e8f0;font-size:11px;color:#ea580c;text-align:right;font-family:monospace;font-weight:bold">${fmt(lineTotal)}</td>
        </tr>`;
      }).join('');

      const html = `
        <div style="padding:24px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:ltr;background:#fff;color:#1e293b;width:1100px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #7c3aed;padding-bottom:14px;margin-bottom:18px">
            <div>
              <h1 style="margin:0 0 4px;font-size:24px;color:#0f172a">${String(titleEn).replace(/</g, '&lt;')}</h1>
              <div style="font-size:12px;color:#64748b">Export Date: ${dateStr} &nbsp;|&nbsp; ${items.length} item${items.length === 1 ? '' : 's'}</div>
            </div>
            <div style="text-align:right;font-size:11px;color:#94a3b8">Levonis · Purchase Draft</div>
          </div>

          <table style="border-collapse:collapse;width:100%;direction:ltr">
            <thead>
              <tr>
                ${['#','Product','Color','Option','Price','Quantity','Total'].map(h => `<th style="background:#7c3aed;color:#fff;padding:10px;border:1px solid #6d28d9;font-size:12px;white-space:nowrap">${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="5" style="background:#f1f5f9;padding:10px;border:1px solid #cbd5e1;font-weight:bold;font-size:12px;text-align:right">Grand Total</td>
                <td style="background:#f1f5f9;padding:10px;border:1px solid #cbd5e1;font-weight:bold;font-size:12px;text-align:center;font-family:monospace">${fmt(totalQty)}</td>
                <td style="background:#fff7ed;padding:10px;border:1px solid #cbd5e1;font-weight:bold;font-size:13px;color:#ea580c;text-align:right;font-family:monospace">${fmt(totalSum)}</td>
              </tr>
            </tfoot>
          </table>

          <div style="margin-top:14px;text-align:center;font-size:10px;color:#94a3b8">© ${new Date().getFullYear()} Levonis — Auto-generated</div>
        </div>`;

      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-99999px;top:0;z-index:-1';
      container.innerHTML = html;
      document.body.appendChild(container);

      try {
        const canvas = await html2canvas(container.firstElementChild as HTMLElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 8;
        const usableW = pageW - margin * 2;
        const usableH = pageH - margin * 2;
        const scaleFactor = usableW / canvas.width;
        const fullH = canvas.height * scaleFactor;

        if (fullH <= usableH) {
          pdf.addImage(imgData, 'PNG', margin, margin, usableW, fullH);
        } else {
          const sliceH = Math.floor(usableH / scaleFactor);
          let srcY = 0;
          let pageIdx = 0;
          while (srcY < canvas.height) {
            if (pageIdx > 0) pdf.addPage();
            const cur = Math.min(sliceH, canvas.height - srcY);
            const sc = document.createElement('canvas');
            sc.width = canvas.width; sc.height = cur;
            sc.getContext('2d')!.drawImage(canvas, 0, srcY, canvas.width, cur, 0, 0, canvas.width, cur);
            pdf.addImage(sc.toDataURL('image/png'), 'PNG', margin, margin, usableW, cur * scaleFactor);
            srcY += cur; pageIdx++;
          }
        }
        const safeTitle = String(titleEn || 'draft').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
        pdf.save(`${safeTitle}-EN-${new Date().toISOString().slice(0, 10)}.pdf`);
        toast.success('Draft exported as English PDF');
      } finally {
        document.body.removeChild(container);
      }
    } catch (e) {
      console.error('Draft EN PDF export error:', e);
      toast.error('Failed to export English PDF');
    }
  };

  // ====== COMPUTED ======
  const pendingShipments = useMemo(() => shipments.filter((s) => s.status === 'pending'), [shipments]);
  const mergedShipments = useMemo(() => shipments.filter((s) => s.status === 'merged'), [shipments]);
  const activeDrafts = useMemo(() => drafts.filter((d: any) => d.status === 'draft'), [drafts]);

  const totalInventoryCost = useMemo(() =>
  products.reduce((sum, p) => sum + (Number(p.cost_price) || 0) * (Number(p.direct_stock) || 0), 0), [products]);

  const totalRevenue = useMemo(() =>
  orders.reduce((sum, o) => sum + (Number(o.subtotal) || 0), 0), [orders]);

  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalStock = products.reduce((s, p) => s + (Number(p.direct_stock) || 0), 0);
    const lowStock = products.filter((p) => {const s = Number(p.direct_stock) || 0;return s > 0 && s <= LOW_STOCK_THRESHOLD;}).length;
    const outOfStock = products.filter((p) => (Number(p.direct_stock) || 0) <= 0).length;
    const avgUnitCost = totalStock > 0 ? Math.round(totalInventoryCost / totalStock) : 0;
    return { totalProducts, totalStock, lowStock, outOfStock, avgUnitCost };
  }, [products, totalInventoryCost]);

  const pendingShipmentsByProduct = useMemo(() => {
    const map: Record<string, {qty: number;cost: number;}> = {};
    pendingShipments.forEach((s) => {
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
    return products.filter((p) => {
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
    const map: Record<string, {name: string;stock: number;value: number;}> = {};
    products.forEach((p) => {
      const cat = (p as any).categories?.name_ar || 'غير مصنف';
      if (!map[cat]) map[cat] = { name: cat, stock: 0, value: 0 };
      map[cat].stock += Number(p.direct_stock) || 0;
      map[cat].value += (Number(p.cost_price) || 0) * (Number(p.direct_stock) || 0);
    });
    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [products]);

  const lowStockProducts = useMemo(() =>
  products.filter((p) => {const s = Number(p.direct_stock) || 0;return s > 0 && s <= LOW_STOCK_THRESHOLD;}).
  sort((a, b) => (Number(a.direct_stock) || 0) - (Number(b.direct_stock) || 0)), [products]);

  const movementsTrend = useMemo(() => {
    const map: Record<string, {month: string;inbound: number;outbound: number;}> = {};
    movements.forEach((m) => {
      const month = format(new Date(m.created_at), 'yyyy-MM');
      if (!map[month]) map[month] = { month, inbound: 0, outbound: 0 };
      if (m.movement_type === 'inbound') map[month].inbound += m.quantity;else
      map[month].outbound += m.quantity;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).map((d) => ({
      ...d, month: format(new Date(d.month + '-01'), 'MMM yyyy', { locale: ar })
    }));
  }, [movements]);

  const getStockBadge = (stock: number) => {
    if (stock <= 0) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">نفذ</Badge>;
    if (stock <= LOW_STOCK_THRESHOLD) return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">منخفض</Badge>;
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">متوفر</Badge>;
  };

  // Product variant info for inventory section
  const getProductVariants = (product: any) => {
    try {
      const colors = typeof product.colors === 'string' ? JSON.parse(product.colors) : product.colors;
      if (!Array.isArray(colors) || colors.length === 0) return null;
      return colors;
    } catch {return null;}
  };

  if (authLoading || productsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(225 30% 6%), hsl(235 25% 10%), hsl(225 30% 6%))' }}>
        <div className="w-full max-w-4xl px-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3,4].map(i=><div key={i} className="rounded-lg border border-white/10 p-4 bg-white/5"><div className="h-3 w-16 rounded bg-white/10 animate-pulse mb-2" /><div className="h-6 w-20 rounded bg-white/10 animate-pulse" /></div>)}</div>
          <div className="rounded-lg border border-white/10 overflow-hidden bg-white/5"><div className="p-3 flex gap-4">{[1,2,3,4,5].map(i=><div key={i} className="h-4 flex-1 rounded bg-white/10 animate-pulse" />)}</div>{[1,2,3,4].map(i=><div key={i} className="p-3 flex gap-4 border-t border-white/5">{[1,2,3,4,5].map(j=><div key={j} className="h-4 flex-1 rounded bg-white/10 animate-pulse" />)}</div>)}</div>
        </div>
      </div>);
  }

  return (
    <div className="min-h-screen relative bg-background border-background" dir="rtl" style={{ background: 'linear-gradient(135deg, hsl(225 30% 6%), hsl(235 25% 10%), hsl(225 30% 6%))' }}>
      {/* Ambient gradient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.05]" style={{ background: `radial-gradient(circle, ${NEON.cyan}, transparent 70%)` }} />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.04]" style={{ background: `radial-gradient(circle, ${NEON.purple}, transparent 70%)` }} />
        <div className="absolute top-[40%] left-[30%] w-[400px] h-[400px] rounded-full opacity-[0.03]" style={{ background: `radial-gradient(circle, ${NEON.blue}, transparent 70%)` }} />
      </div>

      {/* Floating Glass Sidebar */}
      <motion.aside
        className="fixed top-4 right-4 bottom-4 z-50 rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
        animate={{ width: sidebarOpen ? 220 : 64 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
        
        <div className="p-3 border-b border-white/[0.05] flex items-center gap-3">
          <button onClick={() => navigate(ADMIN_ROUTES.financials)} className="p-2 rounded-xl hover:bg-white/10 transition-colors shrink-0">
            <ArrowRight className="h-4 w-4 text-white/50" />
          </button>
          <AnimatePresence>
            {sidebarOpen &&
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm font-bold text-white/70 whitespace-nowrap">
                إدارة المخزون
              </motion.span>
            }
          </AnimatePresence>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            const count = item.id === 'shipments' ? pendingShipments.length : item.id === 'drafts' ? activeDrafts.length : 0;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 relative group ${isActive ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}`}>
                
                {isActive &&
                <motion.div layoutId="sidebar-active" className="absolute inset-0 rounded-xl border"
                style={{ borderColor: `${item.color}30`, background: `linear-gradient(135deg, ${item.color}10, transparent)` }} />
                }
                <div className="relative z-10 shrink-0">
                  <item.icon className="h-5 w-5" style={{ color: isActive ? item.color : 'rgba(255,255,255,0.4)' }} />
                  {count > 0 &&
                  <span className="absolute -top-1.5 -left-1.5 min-w-[14px] h-3.5 px-1 rounded-full text-[8px] font-bold flex items-center justify-center text-white" style={{ background: item.color }}>{count}</span>
                  }
                </div>
                <AnimatePresence>
                  {sidebarOpen &&
                  <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                  className="relative z-10 text-xs whitespace-nowrap" style={{ color: isActive ? item.color : 'rgba(255,255,255,0.5)' }}>
                      {item.label}
                    </motion.span>
                  }
                </AnimatePresence>
              </button>);

          })}
        </nav>

        <div className="p-3 border-t border-white/[0.05]">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-full p-2 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center">
            {sidebarOpen ? <ChevronRight className="h-4 w-4 text-white/40" /> : <ChevronLeft className="h-4 w-4 text-white/40" />}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="relative z-10 transition-all duration-300 bg-[sidebar-primary-foreground] bg-background bg-gray-950" style={{ marginRight: sidebarOpen ? 236 : 80, padding: '24px' }}>
        <AnimatePresence mode="wait">
          <motion.div key={activeSection} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>

            {/* ===== DASHBOARD ===== */}
            {activeSection === 'dashboard' &&
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
                    <h3 className="text-sm font-semibold text-white/70 mb-4">المخزون حسب الفئة</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={categoryChartData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis type="number" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                          <YAxis dataKey="name" type="category" width={80} stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                          <Tooltip contentStyle={{ background: 'rgba(10,10,25,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, backdropFilter: 'blur(20px)' }} />
                          <Bar dataKey="stock" fill={NEON.cyan} radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </GlassCard>

                  <GlassCard className="p-5">
                    <h3 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" style={{ color: NEON.amber }} /> تنبيهات المخزون المنخفض
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
                      {lowStockProducts.length === 0 ?
                    <p className="text-white/30 text-xs text-center py-8">لا توجد تنبيهات</p> :
                    lowStockProducts.slice(0, 10).map((p) =>
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-amber-500/20 transition-all">
                          <div className="flex items-center gap-3">
                            {p.image_url && <img src={p.image_url} className="w-8 h-8 rounded-lg object-cover" alt="" />}
                            <span className="text-xs text-white/60 truncate max-w-[140px]">{p.name_ar}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {pendingShipmentsByProduct[p.id] && <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/20 text-[9px]">+{pendingShipmentsByProduct[p.id].qty} قادم</Badge>}
                            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-[10px] font-mono">{Number(p.direct_stock) || 0}</Badge>
                          </div>
                        </div>
                    )}
                    </div>
                  </GlassCard>
                </div>

                <GlassCard className="p-5">
                  <h3 className="text-sm font-semibold text-white/70 mb-4">اتجاهات الحركات الشهرية</h3>
                  <div className="h-64">
                    {movementsTrend.length === 0 ?
                  <div className="flex items-center justify-center h-full text-white/20 text-xs">لا توجد بيانات كافية</div> :

                  <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={movementsTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="month" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                          <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                          <Tooltip contentStyle={{ background: 'rgba(10,10,25,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }} />
                          <Bar dataKey="inbound" name="وارد" fill={NEON.emerald} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="outbound" name="صادر" fill={NEON.red} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                  }
                  </div>
                </GlassCard>
              </div>
            }

            {/* ===== DRAFTS ===== */}
            {activeSection === 'drafts' &&
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white/85 flex items-center gap-2">
                    <FileText className="h-5 w-5" style={{ color: NEON.purple }} /> مسودات الشراء
                  </h2>
                  <Button onClick={() => { setEditingDraftId(null); setDraftTitle(''); setDraftItems([]); setDraftNotes(''); setShowDraftForm(true); }} className="text-white border"
                style={{ background: `linear-gradient(135deg, ${NEON.purple}25, ${NEON.purple}10)`, borderColor: `${NEON.purple}30` }}>
                    <Plus className="h-4 w-4 ml-1" /> مسودة جديدة
                  </Button>
                </div>

                {/* Draft Creation Form */}
                <AnimatePresence>
                  {showDraftForm &&
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                      <GlassCard className="p-6" style={{ borderColor: `${NEON.purple}18` }}>
                        <div className="flex items-center justify-between mb-5">
                          <h3 className="text-sm font-semibold text-white/75">{editingDraftId ? 'تعديل المسودة' : 'إنشاء مسودة شراء جديدة'}</h3>
                          <button onClick={() => {setShowDraftForm(false);setEditingDraftId(null);setDraftItems([]);setDraftTitle('');setDraftNotes('');}} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                            <X className="h-4 w-4 text-white/40" />
                          </button>
                        </div>

                        <div className="space-y-5">
                          <div>
                            <Label className="text-white/40 text-xs">عنوان المسودة</Label>
                            <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)}
                        className="bg-white/[0.04] border-white/10 text-white mt-1" placeholder="مثال: طلبية مارس 2026" />
                          </div>

                          {/* Add item form with smart search */}
                          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-3">
                            <p className="text-xs font-medium text-white/50">إضافة عنصر</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="md:col-span-2">
                                <Label className="text-white/35 text-[10px]">المنتج</Label>
                                <div className="mt-1">
                                  <ProductSearchDropdown
                                products={products}
                                value={draftItemForm.product_id}
                                onSelect={(p) => setDraftItemForm((f) => ({ ...f, product_id: p.id || '', colors: [], options: [], unit_cost: f.unit_cost > 0 ? f.unit_cost : (Number((p as any).cost_price) || 0) }))} />
                              
                                </div>
                              </div>

                              {/* Variant selectors - appear when product selected */}
                              <AnimatePresence>
                                {selectedDraftProduct &&
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="md:col-span-2">
                              
                                    <VariantSelector
                                product={selectedDraftProduct}
                                selectedColors={draftItemForm.colors}
                                selectedOptions={draftItemForm.options}
                                onColorsChange={(c) => setDraftItemForm((f) => ({ ...f, colors: c }))}
                                onOptionsChange={(o) => setDraftItemForm((f) => ({ ...f, options: o }))} />
                              
                                  </motion.div>
                            }
                              </AnimatePresence>

                              <div>
                                <Label className="text-white/35 text-[10px]">تكلفة الوحدة</Label>
                                <Input type="number" min={0} value={draftItemForm.unit_cost || ''} onChange={(e) => setDraftItemForm((f) => ({ ...f, unit_cost: Number(e.target.value) }))}
                            className="bg-white/[0.04] border-white/10 text-white font-mono mt-1 h-9 text-xs" placeholder="0" />
                              </div>

                              <div>
                                <Label className="text-white/35 text-[10px]">الكمية</Label>
                                <div className="flex gap-2 mt-1">
                                  <Input type="number" min={1} value={draftItemForm.quantity || ''} onChange={(e) => setDraftItemForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                              className="bg-white/[0.04] border-white/10 text-white font-mono h-9 text-xs flex-1" placeholder="0" />
                                  <Button size="sm" className="h-9 px-3 shrink-0 text-white" onClick={addItemToDraft}
                              disabled={!draftItemForm.product_id || draftItemForm.quantity <= 0 || draftItemForm.unit_cost <= 0}
                              style={{ background: `linear-gradient(135deg, ${NEON.purple}35, ${NEON.purple}15)` }}>
                                    <Plus className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {draftItemForm.quantity > 0 && draftItemForm.unit_cost > 0 &&
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-white/35">
                                تكلفة الوحدة: <span className="font-mono font-bold" style={{ color: NEON.cyan }}>${(draftItemForm.quantity * draftItemForm.unit_cost).toLocaleString()}</span>
                              </motion.p>
                        }
                          </div>

                          {/* Items table */}
                          {draftItems.length > 0 &&
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                        <div className="flex justify-end">
                          <Button size="sm" variant="outline" onClick={exportDraftItemsCsv} className="h-8 gap-1.5 text-xs bg-white/[0.04] border-white/10 text-white/70 hover:bg-white/[0.08]">
                            <Download className="h-3.5 w-3.5" />
                            تصدير CSV
                          </Button>
                        </div>
                        <div ref={draftTableScrollRef} className="rounded-xl border border-white/[0.05] overflow-x-auto">
                              <Table className="min-w-[1100px]">
                                <TableHeader>
                                  <TableRow className="border-white/[0.05] hover:bg-transparent">
                                    <TableHead className="text-white/40 text-[10px] text-right min-w-[140px]">المنتج</TableHead>
                                    <TableHead className="text-white/40 text-[10px] text-center w-28">اللون</TableHead>
                                    <TableHead className="text-white/40 text-[10px] text-center w-28">الخيار</TableHead>
                                    <TableHead className="text-white/40 text-[10px] text-center w-32">تكلفة الوحدة ($)</TableHead>
                                    <TableHead className="text-white/40 text-[10px] text-center w-32">الشحن</TableHead>
                                    <TableHead className="text-white/40 text-[10px] text-center w-32">الربح</TableHead>
                                    <TableHead className="text-white/40 text-[10px] text-center w-24">الكمية</TableHead>
                                    <TableHead className="text-white/40 text-[10px] text-center w-32">المجموع ($)</TableHead>
                                    <TableHead className="w-16 min-w-16 bg-background/95 text-center text-[10px] text-white/40">حذف</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {draftItems.map((item, i) =>
                            <TableRow key={i} className="border-white/[0.04] hover:bg-white/[0.02]">
                                      <TableCell className="text-xs text-white/65 text-right">{item.product_name}</TableCell>
                                      <TableCell className="text-center">
                                        {(() => {
                                          const variants = getDraftProductVariants(item.product_id);
                                          if (variants.colors.length > 0) {
                                            return (
                                              <Select value={item.color || 'none'} onValueChange={(val) => setDraftItems(prev => prev.map((it, idx) => idx === i ? { ...it, color: val === 'none' ? '' : val, option: '' } : it))}>
                                                <SelectTrigger className="h-7 w-full text-xs bg-white/5 border-white/10 text-white/70"><SelectValue placeholder="—" /></SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="none">بدون لون</SelectItem>
                                                  {variants.colors.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                                </SelectContent>
                                              </Select>
                                            );
                                          }
                                          return <span className="text-muted-foreground text-xs block">—</span>;
                                        })()}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {(() => {
                                          const variants = getDraftProductVariants(item.product_id, item.color || undefined);
                                          if (variants.options.length > 0) {
                                            return (
                                              <Select value={item.option || 'none'} onValueChange={(val) => setDraftItems(prev => prev.map((it, idx) => idx === i ? { ...it, option: val === 'none' ? '' : val } : it))}>
                                                <SelectTrigger className="h-7 w-full text-xs bg-white/5 border-white/10 text-white/70"><SelectValue placeholder="—" /></SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="none">بدون خيار</SelectItem>
                                                  {variants.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                                                </SelectContent>
                                              </Select>
                                            );
                                          }
                                          return <span className="text-muted-foreground text-xs block">—</span>;
                                        })()}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Input type="number" min={0} value={item.unit_cost} onChange={(e) => { const val = Number(e.target.value) || 0; setDraftItems(prev => prev.map((it, idx) => idx === i ? { ...it, unit_cost: val, line_total: it.quantity * val } : it)); }} className="h-7 w-full text-xs font-mono bg-white/5 border-white/10 text-center" style={{ color: NEON.cyan }} />
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Input type="number" min={0} value={item.shipping_cost || 0} onChange={(e) => { const val = Number(e.target.value) || 0; setDraftItems(prev => prev.map((it, idx) => idx === i ? { ...it, shipping_cost: val } : it)); }} className="h-7 w-full text-xs font-mono bg-white/5 border-white/10 text-white/70 text-center" />
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Input type="number" min={0} value={item.commission || 0} onChange={(e) => { const val = Number(e.target.value) || 0; setDraftItems(prev => prev.map((it, idx) => idx === i ? { ...it, commission: val } : it)); }} className="h-7 w-full text-xs font-mono bg-white/5 border-white/10 text-white/70 text-center" />
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Input type="number" min={1} value={item.quantity} onChange={(e) => { const val = Math.max(1, Number(e.target.value) || 1); setDraftItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: val, line_total: val * it.unit_cost } : it)); }} className="h-7 w-full text-xs font-mono bg-white/5 border-white/10 text-white/70 text-center" />
                                      </TableCell>
                                      <TableCell className="text-xs font-mono font-bold text-center" style={{ color: NEON.purple }}>
                                        ${(item.line_total || 0).toLocaleString()}
                                      </TableCell>
                                      <TableCell className="w-16 min-w-16 bg-background/95 text-center">
                                        <button type="button" aria-label="حذف" onClick={() => removeItemFromDraft(i)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-destructive/25 bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20">
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </TableCell>
                                    </TableRow>
                            )}
                                </TableBody>
                                {(() => {
                                  const tQty = draftItems.reduce((s, i) => s + (i.quantity || 0), 0);
                                  const tUnit = draftItems.reduce((s, i) => s + (i.unit_cost || 0) * (i.quantity || 0), 0);
                                  const tShip = draftItems.reduce((s, i) => s + (i.shipping_cost || 0) * (i.quantity || 0), 0);
                                  const tComm = draftItems.reduce((s, i) => s + (i.commission || 0) * (i.quantity || 0), 0);
                                  const tLine = draftItems.reduce((s, i) => s + (i.line_total || 0), 0);
                                  return (
                                    <TableFooter className="bg-white/[0.03]">
                                      <TableRow className="border-white/[0.08] hover:bg-transparent">
                                        <TableCell className="text-[10px] text-white/55 text-right font-bold">الإجمالي</TableCell>
                                        <TableCell />
                                        <TableCell />
                                        <TableCell className="text-[10px] font-mono font-bold text-center" style={{ color: NEON.cyan }}>${tUnit.toLocaleString()}</TableCell>
                                        <TableCell className="text-[10px] font-mono font-bold text-center text-white/70">{formatPrice(tShip)}</TableCell>
                                        <TableCell className="text-[10px] font-mono font-bold text-center" style={{ color: NEON.emerald }}>{formatPrice(tComm)}</TableCell>
                                        <TableCell className="text-[10px] font-mono font-bold text-center text-white/70">{tQty}</TableCell>
                                        <TableCell className="text-[10px] font-mono font-bold text-center" style={{ color: NEON.purple }}>${tLine.toLocaleString()}</TableCell>
                                        <TableCell className="w-16 min-w-16 bg-background/95" />
                                      </TableRow>
                                    </TableFooter>
                                  );
                                })()}
                              </Table>
                            </div>
                            </motion.div>
                      }

                          {/* Grand total */}
                          <div className="flex items-center justify-between pt-2">
                            <div className="space-y-1">
                              <p className="text-[10px] text-white/30">إجمالي المسودة</p>
                              <p className="text-lg font-bold font-mono" style={{ color: NEON.purple }}>{formatPrice(draftGrandTotal)}</p>
                              <p className="text-[10px] text-white/20">{draftItems.length} عنصر · {draftItems.reduce((s, i) => s + i.quantity, 0)} وحدة</p>
                            </div>
                            <div className="space-y-2">
                              <Textarea value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)}
                          className="bg-white/[0.04] border-white/10 text-white/70 resize-none text-xs w-64" rows={2} placeholder="ملاحظات (اختياري)..." />
                              <Button className="w-full text-white"
                          style={{ background: `linear-gradient(135deg, ${NEON.purple}35, ${NEON.purple}15)`, borderColor: `${NEON.purple}30` }}
                          disabled={draftItems.length === 0 || createDraftMutation.isPending}
                          onClick={() => createDraftMutation.mutate()}>
                                {createDraftMutation.isPending ? 'جاري...' : editingDraftId ? 'تحديث المسودة' : 'حفظ المسودة'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </GlassCard>
                    </motion.div>
                }
                </AnimatePresence>

                {/* Existing Drafts */}
                <div className="space-y-4">
                  {draftsLoading ?
                <div className="text-center py-12 text-white/25 text-xs">جاري التحميل...</div> :
                drafts.length === 0 ?
                <GlassCard className="p-12 text-center">
                      <FileText className="h-10 w-10 mx-auto mb-3" style={{ color: `${NEON.purple}30` }} />
                      <p className="text-white/30 text-xs">لا توجد مسودات بعد</p>
                    </GlassCard> :
                drafts.map((draft: any) => {
                  const items = (draft.items || []) as DraftItem[];
                  const isConverted = draft.status === 'converted';
                   return (
                     <GlassCard key={draft.id} className={`p-5 ${isConverted ? 'opacity-50' : ''}`}>
                         <div className="flex items-start justify-between mb-4">
                           <button
                             type="button"
                             onClick={() => toggleDraftCollapse(draft.id)}
                             className="flex items-start gap-2 text-right flex-1 min-w-0 hover:opacity-80 transition-opacity"
                             aria-expanded={!collapsedDrafts[draft.id]}
                           >
                             {collapsedDrafts[draft.id] ? (
                               <ChevronLeft className="h-4 w-4 text-white/40 mt-0.5 shrink-0" />
                             ) : (
                               <ChevronDown className="h-4 w-4 text-white/40 mt-0.5 shrink-0" />
                             )}
                             <div className="min-w-0">
                               <div className="flex items-center gap-2 flex-wrap">
                                 <h3 className="text-sm font-semibold text-white/75 truncate">{draft.title || 'مسودة بدون عنوان'}</h3>
                                 <Badge className={isConverted ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[9px]' : 'bg-purple-500/15 text-purple-400 border-purple-500/20 text-[9px]'}>
                                   {isConverted ? 'تم التحويل' : 'مسودة'}
                                 </Badge>
                                 {collapsedDrafts[draft.id] && (
                                   <span className="text-[10px] text-white/40 font-mono">
                                     {items.length} عنصر · {formatPrice(Number(draft.total_value) || 0)}
                                   </span>
                                 )}
                               </div>
                               <p className="text-[10px] text-white/30 mt-1">{format(new Date(draft.created_at), 'dd/MM/yyyy HH:mm', { locale: ar })}</p>
                             </div>
                           </button>
                           <div className="flex items-center gap-2">
                                 <Button size="sm" className="h-7 text-[10px] px-3 text-white border"
                             style={{ background: `linear-gradient(135deg, ${NEON.purple}25, ${NEON.purple}10)`, borderColor: `${NEON.purple}30` }}
                             onClick={() => {
                               const items = (draft.items || []) as DraftItem[];
                               setEditingDraftId(draft.id);
                               setDraftTitle(draft.title || '');
                               setDraftItems(items);
                               setDraftNotes(draft.notes || '');
                               setShowDraftForm(true);
                             }}>
                                   <Pencil className="h-3 w-3 ml-1" /> تعديل
                                 </Button>
                              {!isConverted &&
                                  <Button size="sm" className="h-7 text-[10px] px-3 text-white border"
                              style={{ background: `linear-gradient(135deg, ${NEON.blue}25, ${NEON.blue}10)`, borderColor: `${NEON.blue}30` }}
                              disabled={convertDraftMutation.isPending}
                              onClick={() => convertDraftMutation.mutate(draft)}>
                                    <Send className="h-3 w-3 ml-1" /> تحويل لشحنة
                                  </Button>
                              }
                                  <Button size="sm" className="h-7 text-[10px] px-3 text-white border"
                              style={{ background: `linear-gradient(135deg, ${NEON.emerald}25, ${NEON.emerald}10)`, borderColor: `${NEON.emerald}30` }}
                              onClick={() => exportDraftPdf(draft)}>
                                    <Download className="h-3 w-3 ml-1" /> PDF
                                  </Button>
                                  <Button size="sm" className="h-7 text-[10px] px-3 text-white border"
                              style={{ background: `linear-gradient(135deg, ${NEON.blue}25, ${NEON.blue}10)`, borderColor: `${NEON.blue}30` }}
                              onClick={() => exportDraftPdfEn(draft)}>
                                    <Download className="h-3 w-3 ml-1" /> PDF (EN)
                                  </Button>
                                 <button onClick={() => deleteDraftMutation.mutate(draft.id)} className="p-1.5 rounded-lg hover:bg-red-500/15 transition-colors">
                                   <Trash2 className="h-3.5 w-3.5 text-red-400/50" />
                                 </button>
                           </div>
                         </div>

                         {!collapsedDrafts[draft.id] && (<>
                         <div className="space-y-1.5">
                           {items.map((item: DraftItem, i: number) =>
                         <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] text-xs">
                               <div className="flex items-center gap-3">
                                 <span className="text-white/60">{item.product_name}</span>
                                 {item.color && item.color !== 'none' && <span className="text-white/25">• {item.color}</span>}
                                 {item.option && item.option !== 'none' && <span className="text-white/25">• {item.option}</span>}
                               </div>
                               <div className="flex items-center gap-4 font-mono">
                                 <span className="text-white/30">{item.quantity}×</span>
                                 <span className="text-white/40">{formatPrice(item.unit_cost)}</span>
                                 <span className="font-bold" style={{ color: NEON.purple }}>{formatPrice(item.line_total)}</span>
                               </div>
                             </div>
                         )}
                         </div>

                         <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center justify-between">
                           <span className="text-[10px] text-white/30">{items.length} عنصر · {items.reduce((s: number, i: DraftItem) => s + i.quantity, 0)} وحدة</span>
                           <span className="text-sm font-bold font-mono" style={{ color: NEON.purple }}>{formatPrice(Number(draft.total_value) || 0)}</span>
                         </div>
                         </>)}
                       </GlassCard>);

                 })}
                </div>
              </div>
            }

            {/* ===== SHIPMENTS ===== */}
            {activeSection === 'shipments' &&
            <div className="space-y-6">
                <h2 className="text-lg font-bold text-white/85 flex items-center gap-2">
                  <Truck className="h-5 w-5" style={{ color: NEON.blue }} /> الشحنات المستقبلية
                  {pendingShipments.length > 0 && <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-[10px]">{pendingShipments.length} معلقة</Badge>}
                </h2>

                {pendingShipments.length === 0 ?
              <GlassCard className="p-12 text-center">
                    <Truck className="h-10 w-10 mx-auto mb-3" style={{ color: `${NEON.blue}25` }} />
                    <p className="text-white/30 text-xs">لا توجد شحنات معلقة</p>
                    <p className="text-[10px] text-white/20 mt-1">قم بتحويل مسودة شراء لإنشاء شحنة</p>
                  </GlassCard> :

              <div className="space-y-4">
                    {pendingShipments.map((s) => {
                  const items = ((s as any).items || []) as DraftItem[];
                  const totalQty = items.length > 0 ? items.reduce((sum: number, i: DraftItem) => sum + i.quantity, 0) : s.quantity;
                  const totalCost = Number(s.total_cost);
                  return (
                    <GlassCard key={s.id} className="p-5">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <p className="text-xs text-white/70">{s.note || 'شحنة بدون وصف'}</p>
                              <p className="text-[10px] text-white/30 mt-1">{format(new Date(s.created_at), 'dd/MM/yyyy HH:mm', { locale: ar })}</p>
                            </div>
                            <div className="text-left">
                              <p className="text-xs font-mono font-bold text-white/70">{totalQty} وحدة</p>
                              <p className="text-xs font-mono" style={{ color: NEON.cyan }}>{formatPrice(totalCost)}</p>
                              <p className="text-[10px] font-mono text-white/30">الوحدة: {totalQty > 0 ? formatPrice(Math.round(totalCost / totalQty)) : '—'}</p>
                            </div>
                          </div>

                          {items.length > 0 &&
                      <div className="space-y-1.5 mb-4">
                              {items.map((item: DraftItem, i: number) =>
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] text-[11px]">
                                  <div className="flex items-center gap-2">
                                    <span className="text-white/50">{item.product_name}</span>
                                    {item.color && item.color !== 'none' && <span className="text-white/20">• {item.color}</span>}
                                    {item.option && item.option !== 'none' && <span className="text-white/20">• {item.option}</span>}
                                  </div>
                                  <span className="font-mono text-white/40">{item.quantity}×</span>
                                </div>
                        )}
                            </div>
                      }

                          <div className="flex gap-2">
                            <Button className="flex-1 text-white border h-9 text-xs"
                        style={{ background: `linear-gradient(135deg, ${NEON.emerald}25, ${NEON.emerald}10)`, borderColor: `${NEON.emerald}30` }}
                        disabled={mergeShipmentMutation.isPending || revertShipmentToDraftMutation.isPending}
                        onClick={() => mergeShipmentMutation.mutate(s)}>
                              <CheckCircle2 className="h-3.5 w-3.5 ml-1" /> تم الاستلام — إضافة للمخزون
                            </Button>
                            <Button className="text-white border h-9 text-xs px-3"
                        style={{ background: `linear-gradient(135deg, ${NEON.amber}25, ${NEON.amber}10)`, borderColor: `${NEON.amber}30` }}
                        disabled={revertShipmentToDraftMutation.isPending || mergeShipmentMutation.isPending}
                        onClick={() => revertShipmentToDraftMutation.mutate(s)}>
                              <Undo2 className="h-3.5 w-3.5 ml-1" /> إرجاع لمسودة
                            </Button>
                          </div>
                        </GlassCard>);

                })}
                  </div>
              }

                {mergedShipments.length > 0 &&
              <GlassCard className="p-5">
                    <h3 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" style={{ color: NEON.emerald }} /> الشحنات المستلمة
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
                      {mergedShipments.map((s) =>
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-lg" style={{ background: `${NEON.emerald}10` }}>
                              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: NEON.emerald }} />
                            </div>
                            <div>
                              <p className="text-xs text-white/50">{s.note || 'شحنة'}</p>
                              <p className="text-[10px] text-white/25">{s.merged_at ? format(new Date(s.merged_at), 'dd/MM/yyyy HH:mm') : ''}</p>
                            </div>
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-mono text-white/40">+{s.quantity} وحدة</p>
                            <p className="text-[10px] font-mono text-white/25">{formatPrice(Number(s.total_cost))}</p>
                          </div>
                        </div>
                  )}
                    </div>
                  </GlassCard>
              }
              </div>
            }

            {/* ===== LIVE INVENTORY ===== */}
            {activeSection === 'inventory' &&
            <div className="space-y-4">
                <h2 className="text-lg font-bold text-white/85 flex items-center gap-2">
                  <Package className="h-5 w-5" style={{ color: NEON.emerald }} /> المخزون المباشر
                </h2>

                <GlassCard className="p-4">
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
                      <Input placeholder="بحث عن منتج..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10 bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/30" />
                    </div>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-full md:w-48 bg-white/[0.04] border-white/10 text-white/60">
                        <SelectValue placeholder="الفئة" />
                      </SelectTrigger>
                      <SelectContent className="bg-[hsl(230,25%,12%)] border-white/10 backdrop-blur-2xl">
                        <SelectItem value="all">جميع الفئات</SelectItem>
                        {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name_ar}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={stockStatusFilter} onValueChange={setStockStatusFilter}>
                      <SelectTrigger className="w-full md:w-40 bg-white/[0.04] border-white/10 text-white/60">
                        <SelectValue placeholder="الحالة" />
                      </SelectTrigger>
                      <SelectContent className="bg-[hsl(230,25%,12%)] border-white/10 backdrop-blur-2xl">
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
                  <div ref={productsTableScrollRef} className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/[0.05] hover:bg-transparent">
                          <TableHead className="text-white/40 text-xs">المنتج</TableHead>
                          <TableHead className="text-white/40 text-xs">الفئة</TableHead>
                          <TableHead className="text-white/40 text-xs">السعر</TableHead>
                          <TableHead className="text-white/40 text-xs">التكلفة</TableHead>
                          <TableHead className="text-white/40 text-xs">المخزون</TableHead>
                          <TableHead className="text-white/40 text-xs">الحالة</TableHead>
                          <TableHead className="text-white/40 text-xs">المتغيرات</TableHead>
                          <TableHead className="text-white/40 text-xs">شحنات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProducts.length === 0 ?
                      <TableRow><TableCell colSpan={8} className="text-center text-white/30 py-12 text-xs">لا توجد منتجات</TableCell></TableRow> :
                      filteredProducts.map((p) => {
                        const directStock = Number(p.direct_stock) || 0;
                        const costPrice = Number(p.cost_price) || 0;
                        const incoming = pendingShipmentsByProduct[p.id];
                        const variants = getProductVariants(p);
                        const isExpanded = expandedProductId === p.id;

                        return (
                          <TableRow key={p.id} className="border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  {p.image_url && <img src={p.image_url} className="w-9 h-9 rounded-lg object-cover border border-white/10" alt="" />}
                                  <span className="text-xs text-white/75 truncate max-w-[180px]">{p.name_ar}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-white/40">{(p as any).categories?.name_ar || '-'}</TableCell>
                              <TableCell className="text-xs text-white/50 font-mono">{formatPrice(p.price)}</TableCell>
                              <TableCell className="text-xs text-white/40 font-mono">{costPrice > 0 ? formatPrice(costPrice) : '-'}</TableCell>
                              <TableCell>
                                <Input type="number" defaultValue={directStock} className="w-20 h-8 text-xs bg-white/[0.04] border-white/10 text-white font-mono text-center"
                              onBlur={(e) => {
                                const val = Number(e.target.value);
                                if (val !== directStock) updateStockMutation.mutate({ productId: p.id, value: val });
                              }} />
                              </TableCell>
                              <TableCell>{getStockBadge(directStock)}</TableCell>
                              <TableCell>
                                {variants ?
                              <button
                                onClick={() => setExpandedProductId(isExpanded ? null : p.id)}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] border transition-all
                                      ${isExpanded ? 'bg-cyan-500/10 border-cyan-500/25 text-cyan-400' : 'bg-white/[0.03] border-white/[0.06] text-white/35 hover:border-white/15'}`}>
                                
                                    <Palette className="h-3 w-3" />
                                    {variants.length} لون
                                  </button> :

                              <span className="text-white/15 text-[10px]">—</span>
                              }
                              </TableCell>
                              <TableCell>
                                {incoming ?
                              <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/15 text-[10px]">
                                    <Truck className="h-3 w-3 ml-1" /> +{incoming.qty}
                                  </Badge> :

                              <span className="text-white/15 text-[10px]">—</span>
                              }
                              </TableCell>
                            </TableRow>);

                      })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Expanded variant details */}
                  <AnimatePresence>
                    {expandedProductId && (() => {
                    const p = products.find((pr) => pr.id === expandedProductId);
                    const variants = p ? getProductVariants(p) : null;
                    if (!variants) return null;

                    const getColorHint = (name: string): string => {
                      const map: Record<string, string> = {
                        'أحمر': '#ef4444', 'أزرق': '#3b82f6', 'أخضر': '#22c55e', 'أصفر': '#eab308',
                        'أسود': '#1e1e1e', 'أبيض': '#e5e5e5', 'بنفسجي': '#a855f7', 'وردي': '#ec4899',
                        'برتقالي': '#f97316', 'رمادي': '#6b7280', 'سماوي': '#06b6d4',
                        'red': '#ef4444', 'blue': '#3b82f6', 'green': '#22c55e', 'black': '#1e1e1e',
                        'white': '#e5e5e5', 'purple': '#a855f7', 'pink': '#ec4899', 'orange': '#f97316'
                      };
                      const lower = name.toLowerCase();
                      for (const [key, val] of Object.entries(map)) if (lower.includes(key)) return val;
                      return NEON.cyan;
                    };

                    return (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-white/[0.04] p-4">
                        
                          <div className="flex items-center gap-2 mb-3">
                            <Palette className="h-3.5 w-3.5" style={{ color: NEON.cyan }} />
                            <span className="text-xs text-white/50 font-medium">متغيرات: {p?.name_ar}</span>
                            <button onClick={() => setExpandedProductId(null)} className="mr-auto p-1 rounded hover:bg-white/10">
                              <X className="h-3 w-3 text-white/30" />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {variants.map((c: any, i: number) => {
                            const name = c.name || c.color || `color-${i}`;
                            const hint = getColorHint(name);
                            const optStocks = c.option_stocks && typeof c.option_stocks === 'object' && !Array.isArray(c.option_stocks) ? c.option_stocks : null;
                            const optionsArr: { name: string; stock: any }[] = optStocks
                              ? Object.entries(optStocks).map(([k, v]) => ({ name: k === '_default' ? '—' : k, stock: v }))
                              : (Array.isArray(c.options) ? c.options.map((o: any) => ({ name: o.name || o.option, stock: o.stock_quantity ?? o.stock })) : []);
                            return (
                              <div key={i} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] min-w-[140px]"
                              style={{ borderColor: `${hint}25` }}>
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="w-3 h-3 rounded-full border border-white/15" style={{ background: hint, boxShadow: `0 0 8px ${hint}40` }} />
                                    <span className="text-[11px] text-white/60 font-medium">{name}</span>
                                  </div>
                                  {optionsArr.length > 0 &&
                                <div className="space-y-0.5 mt-1">
                                      {optionsArr.map((o, j: number) =>
                                  <div key={j} className="flex items-center justify-between text-[10px] gap-2">
                                          <span className="text-white/35">{o.name}</span>
                                          <span className="text-white/60 font-mono">{o.stock ?? '—'}</span>
                                        </div>
                                  )}
                                    </div>
                                }
                                </div>);

                          })}
                          </div>
                        </motion.div>);

                  })()}
                  </AnimatePresence>

                  <div className="p-3 border-t border-white/[0.04] text-[10px] text-white/20">
                    عدد النتائج: {filteredProducts.length} من {products.length}
                  </div>
                </GlassCard>
              </div>
            }

          </motion.div>
        </AnimatePresence>
      </main>
    </div>);

}