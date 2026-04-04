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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, AlertTriangle, TrendingUp, ArrowDownCircle,
  Search, BarChart3, Boxes, DollarSign, ArrowRight, Truck,
  Plus, CheckCircle2, Clock, ShoppingCart, FileText, ChevronLeft,
  ChevronRight, Trash2, X, Send, Palette, Settings2, Pencil, Undo2 } from
'lucide-react';
import { ADMIN_ROUTES } from '@/config/adminConfig';
import { useNavigate } from 'react-router-dom';
import { formatPrice } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

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
  line_total: number;
}

interface DraftItemFormState {
  product_id: string;
  colors: string[];
  options: string[];
  quantity: number;
  unit_cost: number;
}

// ====== GLASS COMPONENTS ======
const GlassCard = ({ children, className = '', style }: {children: React.ReactNode;className?: string;style?: React.CSSProperties;}) =>
<div className={`relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300 hover:border-white/[0.12] ${className}`} style={style}>
    {children}
  </div>;


const StatCard3D = ({ icon: Icon, label, value, color, sub }: {icon: any;label: string;value: string | number;color: string;sub?: string;}) =>
<motion.div whileHover={{ scale: 1.03, rotateY: 3 }} style={{ perspective: 1200 }}>
    <GlassCard className="p-5 group cursor-default overflow-hidden">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ background: `radial-gradient(circle at 30% 30%, ${color}08, transparent 60%)` }} />
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1">
          <p className="text-[11px] text-white/40 tracking-wide">{label}</p>
          <p className="text-xl font-bold text-white/90 tabular-nums">{value}</p>
          {sub && <p className="text-[10px] text-white/30">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-xl transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg"
      style={{ background: `linear-gradient(135deg, ${color}22, ${color}08)`, boxShadow: `0 4px 20px ${color}15` }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
      </div>
    </GlassCard>
  </motion.div>;


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
    if (!product?.colors) return [];
    try {
      const c = typeof product.colors === 'string' ? JSON.parse(product.colors) : product.colors;
      return Array.isArray(c) ? c : [];
    } catch {return [];}
  }, [product]);

  // Collect all unique options from all colors (handle both array and object formats)
  const allOptions = useMemo(() => {
    const optionSet = new Set<string>();
    productColors.forEach((c: any) => {
      // Handle options array
      if (Array.isArray(c.options)) {
        c.options.forEach((o: any) => {
          const name = o.name || o.option;
          if (name) optionSet.add(name);
        });
      }
      // Handle option_stocks object (key-value pairs like {"option_name": stock_qty})
      if (c.option_stocks && typeof c.option_stocks === 'object' && !Array.isArray(c.option_stocks)) {
        Object.keys(c.option_stocks).forEach((key) => optionSet.add(key));
      }
    });
    return Array.from(optionSet);
  }, [productColors]);

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
    const allNames = productColors.map((c: any) => c.name || c.color || '').filter(Boolean);
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
              const name = c.name || c.color || `color-${i}`;
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
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState('all');

  // Draft creation/edit state
  const [showDraftForm, setShowDraftForm] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [draftNotes, setDraftNotes] = useState('');
  const [draftItemForm, setDraftItemForm] = useState<DraftItemFormState>({ product_id: '', colors: [], options: [], quantity: 0, unit_cost: 0 });

  // Inventory variant expansion
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  // ====== DATA QUERIES ======
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['inventory-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name_ar, price, cost_price, direct_stock, image_url, category_id, colors, categories!products_category_id_fkey(id, name_ar)').order('name_ar');
      if (error) throw error;
      return data || [];
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
          notes: draftNotes
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

      const { error: shipErr } = await supabase.from('future_shipments').insert({
        product_id: firstProductId || null,
        quantity: totalQty,
        total_cost: totalCost,
        note: `مسودة: ${draft.title || ''}`,
        draft_id: draft.id,
        items: items as any
      });
      if (shipErr) throw shipErr;

      const { error: draftErr } = await supabase.from('purchase_drafts').update({
        status: 'converted',
        converted_at: new Date().toISOString()
      }).eq('id', draft.id);
      if (draftErr) throw draftErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-drafts'] });
      queryClient.invalidateQueries({ queryKey: ['future-shipments'] });
      toast.success('تم تحويل المسودة إلى شحنة معلقة');
    },
    onError: () => toast.error('خطأ في تحويل المسودة')
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
        title: `${shipment.note || 'شحنة مرتجعة'} (مرتجعة)`,
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
          const { data: product, error: fetchErr } = await supabase
            .from('products')
            .select('id, direct_stock, colors')
            .eq('id', pid)
            .single();
          if (fetchErr || !product) throw new Error('المنتج غير موجود: ' + pid);

          let colors = (product.colors || []) as any[];
          let directStockAdd = 0;

          for (const item of pItems) {
            const hasColor = item.color && item.color !== 'none' && item.color !== '';
            const hasOption = item.option && item.option !== 'none' && item.option !== '';

            if (hasColor && hasOption) {
              // Update option_stocks within the matching color
              const colorIdx = colors.findIndex((c: any) => c.color === item.color);
              if (colorIdx >= 0) {
                const optStocks = colors[colorIdx].option_stocks || {};
                optStocks[item.option] = (Number(optStocks[item.option]) || 0) + item.quantity;
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
              const colorIdx = colors.findIndex((c: any) => c.color === item.color);
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
            updateObj.direct_stock = (Number(product.direct_stock) || 0) + directStockAdd;
          }

          const { error: updErr } = await supabase.from('products').update(updateObj).eq('id', pid);
          if (updErr) throw updErr;
        }
      } else {
        // Legacy fallback for shipments without items array
        const product = products.find((p) => p.id === shipment.product_id);
        if (!product) throw new Error('المنتج غير موجود');
        const currentStock = Number(product.direct_stock) || 0;
        const { error } = await supabase.from('products').update({ direct_stock: currentStock + shipment.quantity }).eq('id', shipment.product_id);
        if (error) throw error;
        await supabase.from('inventory_movements').insert({
          product_id: shipment.product_id, movement_type: 'inbound', quantity: shipment.quantity, stock_field: 'direct_stock',
          note: `استلام شحنة: ${shipment.note || ''} (تكلفة: ${formatPrice(shipment.total_cost)})`
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
    onError: (err: any) => toast.error(err.message || 'خطأ في استلام الشحنة')
  });

  const updateStockMutation = useMutation({
    mutationFn: async ({ productId, value }: {productId: string;value: number;}) => {
      const { error } = await supabase.from('products').update({ direct_stock: value }).eq('id', productId);
      if (error) throw error;
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
    for (const color of colorsToAdd) {
      for (const option of optionsToAdd) {
        newItems.push({
          product_id: draftItemForm.product_id,
          product_name: product?.name_ar || '',
          color,
          option,
          quantity: draftItemForm.quantity,
          unit_cost: draftItemForm.unit_cost,
          line_total: draftItemForm.quantity * draftItemForm.unit_cost
        });
      }
    }
    setDraftItems((prev) => [...prev, ...newItems]);
    setDraftItemForm({ product_id: '', colors: [], options: [], quantity: 0, unit_cost: 0 });
  }, [draftItemForm, products]);

  const removeItemFromDraft = (index: number) => setDraftItems((prev) => prev.filter((_, i) => i !== index));
  const draftGrandTotal = useMemo(() => draftItems.reduce((s, i) => s + i.line_total, 0), [draftItems]);

  // Helper: get available colors and options for a product
  const getProductVariants = useCallback((productId: string, selectedColor?: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return { colors: [] as string[], options: [] as string[] };
    const colorsArr: any[] = Array.isArray(product.colors) ? product.colors : [];
    const colorNames = colorsArr.map((c: any) => c.color).filter(Boolean);
    let optionNames: string[] = [];
    if (selectedColor) {
      const colorObj = colorsArr.find((c: any) => c.color === selectedColor);
      if (colorObj?.option_stocks && typeof colorObj.option_stocks === 'object') {
        optionNames = Object.keys(colorObj.option_stocks);
      }
      if (colorObj?.options && Array.isArray(colorObj.options)) {
        optionNames = [...new Set([...optionNames, ...colorObj.options])];
      }
    } else {
      colorsArr.forEach((c: any) => {
        if (c.option_stocks && typeof c.option_stocks === 'object') {
          optionNames = [...new Set([...optionNames, ...Object.keys(c.option_stocks)])];
        }
        if (c.options && Array.isArray(c.options)) {
          optionNames = [...new Set([...optionNames, ...c.options])];
        }
      });
    }
    return { colors: colorNames, options: optionNames.filter(Boolean) };
  }, [products]);

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
        <div className="h-10 w-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${NEON.cyan} transparent ${NEON.cyan}33 transparent` }} />
      </div>);

  }

  return (
    <div className="min-h-screen relative" dir="rtl" style={{ background: 'linear-gradient(135deg, hsl(225 30% 6%), hsl(235 25% 10%), hsl(225 30% 6%))' }}>
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
      <main className="relative z-10 transition-all duration-300 bg-[sidebar-primary-foreground] bg-slate-950" style={{ marginRight: sidebarOpen ? 236 : 80, padding: '24px' }}>
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
                                onSelect={(p) => setDraftItemForm((f) => ({ ...f, product_id: p.id || '', colors: [], options: [] }))} />
                              
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
                                المجموع: <span className="font-mono font-bold" style={{ color: NEON.purple }}>{formatPrice(draftItemForm.quantity * draftItemForm.unit_cost)}</span>
                              </motion.p>
                        }
                          </div>

                          {/* Items table */}
                          {draftItems.length > 0 &&
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl overflow-hidden border border-white/[0.05]">
                              <Table>
                                <TableHeader>
                                  <TableRow className="border-white/[0.05] hover:bg-transparent">
                                    <TableHead className="text-white/40 text-[10px]">المنتج</TableHead>
                                    <TableHead className="text-white/40 text-[10px]">اللون</TableHead>
                                    <TableHead className="text-white/40 text-[10px]">الخيار</TableHead>
                                    <TableHead className="text-white/40 text-[10px]">تكلفة الوحدة</TableHead>
                                    <TableHead className="text-white/40 text-[10px]">الكمية</TableHead>
                                    <TableHead className="text-white/40 text-[10px]">المجموع</TableHead>
                                    <TableHead className="text-white/40 text-[10px] w-10"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {draftItems.map((item, i) =>
                            <TableRow key={i} className="border-white/[0.04] hover:bg-white/[0.02]">
                                      <TableCell className="text-xs text-white/65">{item.product_name}</TableCell>
                                      <TableCell>
                                        <Input value={item.color === 'none' ? '' : (item.color || '')} onChange={(e) => setDraftItems(prev => prev.map((it, idx) => idx === i ? { ...it, color: e.target.value || 'none' } : it))} placeholder="—" className="h-7 w-20 text-xs bg-white/5 border-white/10 text-white/70" />
                                      </TableCell>
                                      <TableCell>
                                        <Input value={item.option === 'none' ? '' : (item.option || '')} onChange={(e) => setDraftItems(prev => prev.map((it, idx) => idx === i ? { ...it, option: e.target.value || 'none' } : it))} placeholder="—" className="h-7 w-20 text-xs bg-white/5 border-white/10 text-white/70" />
                                      </TableCell>
                                      <TableCell>
                                        <Input type="number" min={0} value={item.unit_cost} onChange={(e) => { const val = Number(e.target.value) || 0; setDraftItems(prev => prev.map((it, idx) => idx === i ? { ...it, unit_cost: val, line_total: val * it.quantity } : it)); }} className="h-7 w-20 text-xs font-mono bg-white/5 border-white/10 text-white/70" />
                                      </TableCell>
                                      <TableCell>
                                        <Input type="number" min={1} value={item.quantity} onChange={(e) => { const val = Math.max(1, Number(e.target.value) || 1); setDraftItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: val, line_total: it.unit_cost * val } : it)); }} className="h-7 w-16 text-xs font-mono bg-white/5 border-white/10 text-white/70" />
                                      </TableCell>
                                      <TableCell className="text-xs font-mono font-bold" style={{ color: NEON.purple }}>{formatPrice(item.line_total)}</TableCell>
                                      <TableCell>
                                        <button onClick={() => removeItemFromDraft(i)} className="p-1 rounded hover:bg-red-500/20 transition-colors">
                                          <Trash2 className="h-3 w-3 text-red-400/60" />
                                        </button>
                                      </TableCell>
                                    </TableRow>
                            )}
                                </TableBody>
                              </Table>
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
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-white/75">{draft.title || 'مسودة بدون عنوان'}</h3>
                              <Badge className={isConverted ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[9px]' : 'bg-purple-500/15 text-purple-400 border-purple-500/20 text-[9px]'}>
                                {isConverted ? 'تم التحويل' : 'مسودة'}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-white/30 mt-1">{format(new Date(draft.created_at), 'dd/MM/yyyy HH:mm', { locale: ar })}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {!isConverted &&
                          <>
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
                                <Button size="sm" className="h-7 text-[10px] px-3 text-white border"
                            style={{ background: `linear-gradient(135deg, ${NEON.blue}25, ${NEON.blue}10)`, borderColor: `${NEON.blue}30` }}
                            disabled={convertDraftMutation.isPending}
                            onClick={() => convertDraftMutation.mutate(draft)}>
                                  <Send className="h-3 w-3 ml-1" /> تحويل لشحنة
                                </Button>
                                <button onClick={() => deleteDraftMutation.mutate(draft.id)} className="p-1.5 rounded-lg hover:bg-red-500/15 transition-colors">
                                  <Trash2 className="h-3.5 w-3.5 text-red-400/50" />
                                </button>
                              </>
                          }
                          </div>
                        </div>

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
                  <div className="overflow-x-auto">
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
                            const options = c.options || c.option_stocks || [];
                            return (
                              <div key={i} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] min-w-[120px]"
                              style={{ borderColor: `${hint}25` }}>
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="w-3 h-3 rounded-full border border-white/15" style={{ background: hint, boxShadow: `0 0 8px ${hint}40` }} />
                                    <span className="text-[11px] text-white/60 font-medium">{name}</span>
                                  </div>
                                  {options.length > 0 &&
                                <div className="space-y-0.5 mt-1">
                                      {options.map((o: any, j: number) =>
                                  <div key={j} className="flex items-center justify-between text-[10px]">
                                          <span className="text-white/35">{o.name || o.option}</span>
                                          <span className="text-white/25 font-mono">{o.stock_quantity ?? o.stock ?? '—'}</span>
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