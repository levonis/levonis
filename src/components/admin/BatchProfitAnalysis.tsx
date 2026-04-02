import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Package, Trash2, ChevronDown, ChevronUp, Users, AlertTriangle, Pencil, Check, X } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface BatchProfitAnalysisProps {
  deliveredDirectOrders: any[];
  usdToIqdRate: number;
}

interface SoldItem {
  username: string;
  quantity: number;
  revenue: number;
  orderNumber: string;
  date: string;
}

const calcItemRevenue = (item: any): number => {
  if (typeof item.total_price === 'number' && item.total_price > 0) return item.total_price;
  return (item.unit_price || 0) * (item.quantity || 1);
};

const BatchProfitAnalysis = ({ deliveredDirectOrders, usdToIqdRate }: BatchProfitAnalysisProps) => {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ batch_quantity: number; batch_cost: number }>({ batch_quantity: 0, batch_cost: 0 });
  const [productSearch, setProductSearch] = useState('');
  const [searchType, setSearchType] = useState<'product' | 'bundle'>('product');
  const [form, setForm] = useState({
    product_id: '' as string,
    bundle_id: '' as string,
    product_name_ar: '',
    batch_quantity: 0,
    batch_cost: 0,
    notes: '',
  });

  // Fetch batches ordered by creation date ascending (oldest first for sequential counting)
  const { data: batches = [] } = useQuery({
    queryKey: ['product-batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_batches')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch current stock for products that have batches
  const batchProductIds = useMemo(() => {
    return [...new Set(batches.filter((b: any) => b.product_id).map((b: any) => b.product_id))];
  }, [batches]);

  const { data: productStocks = {} } = useQuery({
    queryKey: ['batch-product-stocks', batchProductIds],
    queryFn: async () => {
      if (batchProductIds.length === 0) return {};
      const { data } = await supabase
        .from('products')
        .select('id, direct_stock, colors')
        .in('id', batchProductIds);
      if (!data) return {};
      const map: Record<string, number> = {};
      data.forEach((p: any) => {
        const colors = Array.isArray(p.colors) ? p.colors : [];
        if (colors.length === 0) {
          map[p.id] = p.direct_stock != null ? Number(p.direct_stock) : 0;
        } else {
          // Sum only colors that are available for direct sale
          let total = 0;
          colors.forEach((c: any) => {
            if (c.available_for_direct_sale === false) return;
            if (c.option_stocks && typeof c.option_stocks === 'object') {
              Object.values(c.option_stocks).forEach((v: any) => { total += Number(v) || 0; });
            } else {
              total += Number(c.direct_stock) || 0;
            }
          });
          map[p.id] = total;
        }
      });
      return map;
    },
    enabled: batchProductIds.length > 0,
  });

  // Search products/bundles for picker
  const { data: searchResults = [] } = useQuery({
    queryKey: ['batch-product-search', productSearch, searchType],
    queryFn: async () => {
      if (!productSearch.trim()) return [];
      if (searchType === 'bundle') {
        const { data } = await supabase
          .from('product_bundles')
          .select('id, title_ar, image_url')
          .ilike('title_ar', `%${productSearch}%`)
          .limit(10);
        return (data || []).map((b: any) => ({ id: b.id, name_ar: b.title_ar, image_url: b.image_url, _type: 'bundle' }));
      }
      const { data } = await supabase
        .from('products')
        .select('id, name_ar, image_url')
        .ilike('name_ar', `%${productSearch}%`)
        .limit(10);
      return (data || []).map((p: any) => ({ ...p, _type: 'product' }));
    },
    enabled: productSearch.length >= 2,
  });

  const addBatchMutation = useMutation({
    mutationFn: async (formData: typeof form) => {
      const { error } = await supabase.from('product_batches').insert({
        product_id: formData.product_id || null,
        bundle_id: formData.bundle_id || null,
        product_name_ar: formData.product_name_ar,
        batch_quantity: formData.batch_quantity,
        batch_cost: formData.batch_cost,
        notes: formData.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-batches'] });
      toast.success('تم إضافة الوجبة بنجاح');
      setIsAddOpen(false);
      setForm({ product_id: '', bundle_id: '', product_name_ar: '', batch_quantity: 0, batch_cost: 0, notes: '' });
      setProductSearch('');
    },
    onError: () => toast.error('حدث خطأ أثناء الإضافة'),
  });

  const deleteBatchMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_batches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-batches'] });
      toast.success('تم حذف الوجبة');
    },
    onError: () => toast.error('حدث خطأ أثناء الحذف'),
  });

  const updateBatchMutation = useMutation({
    mutationFn: async ({ id, batch_quantity, batch_cost }: { id: string; batch_quantity: number; batch_cost: number }) => {
      const { error } = await supabase.from('product_batches').update({ batch_quantity, batch_cost }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-batches'] });
      toast.success('تم تحديث الوجبة');
      setEditingBatchId(null);
    },
    onError: () => toast.error('حدث خطأ أثناء التحديث'),
  });

  // Build analysis: group batches by product/bundle, distribute sold items sequentially
  const productGroups = useMemo(() => {
    // 1. Collect all sold items per product_id AND per bundle_id from delivered direct orders
    const soldByEntity: Record<string, SoldItem[]> = {};
    
    deliveredDirectOrders.forEach((order: any) => {
      order.order_items?.forEach((item: any) => {
        // Track by bundle_id if present, otherwise by product_id
        const key = item.bundle_id ? `bundle_${item.bundle_id}` : (item.product_id ? item.product_id : null);
        if (!key) return;
        if (!soldByEntity[key]) soldByEntity[key] = [];
        soldByEntity[key].push({
          username: order.profile?.full_name || order.profile?.username || 'غير معروف',
          quantity: item.quantity || 1,
          revenue: calcItemRevenue(item),
          orderNumber: order.order_number,
          date: order.created_at,
        });
      });
    });

    // Sort sold items by date ascending for sequential distribution
    Object.values(soldByEntity).forEach(items => {
      items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });

    // 2. Group batches by product_id or bundle_id (ordered by created_at ascending already)
    const groupMap: Record<string, { productId: string; bundleId: string; productName: string; isBundle: boolean; batches: any[] }> = {};
    
    batches.forEach((batch: any) => {
      const key = batch.bundle_id ? `bundle_${batch.bundle_id}` : (batch.product_id || `manual_${batch.product_name_ar}`);
      if (!groupMap[key]) {
        groupMap[key] = {
          productId: batch.product_id || '',
          bundleId: batch.bundle_id || '',
          productName: batch.product_name_ar,
          isBundle: !!batch.bundle_id,
          batches: [],
        };
      }
      groupMap[key].batches.push(batch);
    });

    // 3. For each product group, distribute sold items sequentially across batches
    return Object.entries(groupMap).map(([key, group]) => {
      const entityKey = group.bundleId ? `bundle_${group.bundleId}` : group.productId;
      const allSold = soldByEntity[entityKey] || [];
      const totalSoldQty = allSold.reduce((s, i) => s + i.quantity, 0);
      const totalBatchQty = group.batches.reduce((s: number, b: any) => s + b.batch_quantity, 0);
      const totalBatchCost = group.batches.reduce((s: number, b: any) => s + Number(b.batch_cost), 0);
      
      const hasStockError = totalSoldQty > totalBatchQty;

      let remainingSoldQty = totalSoldQty;
      let remainingSoldItems = [...allSold];
      
      const batchesWithData = group.batches.map((batch: any, batchIndex: number) => {
        const batchQty = batch.batch_quantity;
        const soldInBatch = Math.min(remainingSoldQty, batchQty);
        remainingSoldQty = Math.max(0, remainingSoldQty - batchQty);
        
        const batchSoldItems: SoldItem[] = [];
        let qtyToFill = soldInBatch;
        
        while (qtyToFill > 0 && remainingSoldItems.length > 0) {
          const item = remainingSoldItems[0];
          if (item.quantity <= qtyToFill) {
            batchSoldItems.push(item);
            qtyToFill -= item.quantity;
            remainingSoldItems.shift();
          } else {
            batchSoldItems.push({ ...item, quantity: qtyToFill, revenue: (item.revenue / item.quantity) * qtyToFill });
            remainingSoldItems[0] = { ...item, quantity: item.quantity - qtyToFill, revenue: item.revenue - (item.revenue / item.quantity) * qtyToFill };
            qtyToFill = 0;
          }
        }

        const batchRevenue = batchSoldItems.reduce((s, i) => s + i.revenue, 0);
        const batchCost = Number(batch.batch_cost);
        const profit = batchRevenue - batchCost;
        const costPerUnit = batchQty > 0 ? batchCost / batchQty : 0;
        const remainingInBatch = batchQty - soldInBatch;
        const isComplete = soldInBatch >= batchQty;
        const progressPercent = batchCost > 0 ? Math.min((batchRevenue / batchCost) * 100, 150) : 0;

        return {
          ...batch,
          soldInBatch,
          batchSoldItems,
          batchRevenue,
          profit,
          costPerUnit,
          remainingInBatch,
          isComplete,
          progressPercent,
        };
      });

      return {
        key,
        productId: group.productId,
        bundleId: group.bundleId,
        isBundle: group.isBundle,
        productName: group.productName,
        batches: batchesWithData,
        totalSoldQty,
        totalBatchQty,
        totalBatchCost,
        totalRevenue: allSold.reduce((s, i) => s + i.revenue, 0),
        hasStockError,
        overflowQty: hasStockError ? totalSoldQty - totalBatchQty : 0,
      };
    });
  }, [batches, deliveredDirectOrders]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          تحليل أرباح الوجبات
        </h3>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> إضافة وجبة</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader><DialogTitle>إضافة وجبة جديدة</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <div className="flex gap-2 mb-2">
                  <Button size="sm" variant={searchType === 'product' ? 'default' : 'outline'} onClick={() => { setSearchType('product'); setProductSearch(''); }}>منتج</Button>
                  <Button size="sm" variant={searchType === 'bundle' ? 'default' : 'outline'} onClick={() => { setSearchType('bundle'); setProductSearch(''); }}>بندل</Button>
                </div>
                <Label>{searchType === 'bundle' ? 'البحث عن بندل' : 'البحث عن منتج'}</Label>
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder={searchType === 'bundle' ? 'ابحث عن البندل...' : 'ابحث عن المنتج (بغض النظر عن اللون والخيار)...'}
                />
                {searchResults.length > 0 && (
                  <div className="border rounded-md mt-1 max-h-40 overflow-y-auto">
                    {searchResults.map((p: any) => (
                      <button
                        key={p.id}
                        className="w-full text-right p-2 hover:bg-muted/50 flex items-center gap-2 text-sm"
                        onClick={() => {
                          if (p._type === 'bundle') {
                            setForm({ ...form, product_id: '', bundle_id: p.id, product_name_ar: p.name_ar });
                          } else {
                            setForm({ ...form, product_id: p.id, bundle_id: '', product_name_ar: p.name_ar });
                          }
                          setProductSearch('');
                        }}
                      >
                        {p.image_url && <img src={p.image_url} className="w-8 h-8 rounded object-cover" alt="" />}
                        <span>{p.name_ar}</span>
                        {p._type === 'bundle' && <Badge variant="outline" className="text-[10px]">بندل</Badge>}
                      </button>
                    ))}
                  </div>
                )}
                {form.product_name_ar && (
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={form.bundle_id ? 'default' : 'secondary'}>
                      {form.bundle_id ? '📦 ' : ''}{form.product_name_ar}
                    </Badge>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setForm({ ...form, product_id: '', bundle_id: '', product_name_ar: '' })}>تغيير</Button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>عدد القطع المستلمة</Label>
                  <Input
                    type="number"
                    value={form.batch_quantity || ''}
                    onChange={(e) => setForm({ ...form, batch_quantity: parseInt(e.target.value) || 0 })}
                    placeholder="250"
                  />
                </div>
                <div>
                  <Label>التكلفة الإجمالية (د.ع)</Label>
                  <Input
                    type="number"
                    value={form.batch_cost || ''}
                    onChange={(e) => setForm({ ...form, batch_cost: parseFloat(e.target.value) || 0 })}
                    placeholder="3605000"
                  />
                </div>
              </div>
              <div>
                <Label>ملاحظات</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="ملاحظات إضافية..."
                  rows={2}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  if (!form.product_name_ar) { toast.error('يرجى تحديد المنتج'); return; }
                  if (!form.batch_quantity) { toast.error('يرجى إدخال الكمية'); return; }
                  addBatchMutation.mutate(form);
                }}
                disabled={addBatchMutation.isPending}
              >
                {addBatchMutation.isPending ? 'جاري الإضافة...' : 'إضافة الوجبة'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Product groups */}
      {productGroups.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            لا توجد وجبات بعد. قم بإضافة وجبة لبدء تحليل الأرباح.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {productGroups.map((group) => (
            <Card key={group.key} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Product header */}
                <div className="p-4 border-b bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">{group.productName}</h4>
                        <p className="text-xs text-muted-foreground">
                          {group.batches.length} وجبة • إجمالي {group.totalBatchQty} قطعة • مباع {group.totalSoldQty} قطعة
                          {group.productId && productStocks[group.productId] !== undefined && (
                            <span> • المخزون الحالي: <span className="font-bold text-foreground">{productStocks[group.productId]}</span> قطعة</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {group.hasStockError && (
                      <Badge variant="destructive" className="gap-1 animate-pulse">
                        <AlertTriangle className="h-3 w-3" />
                        خطأ في المخزون! ({group.overflowQty} قطعة زائدة)
                      </Badge>
                    )}
                  </div>

                  {/* Product-level summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                    <div className="bg-background rounded-lg p-2 text-center border">
                      <p className="text-xs text-muted-foreground">إجمالي التكلفة</p>
                      <p className="font-bold text-destructive">{formatPrice(group.totalBatchCost)}</p>
                    </div>
                    <div className="bg-background rounded-lg p-2 text-center border">
                      <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
                      <p className="font-bold text-green-600">{formatPrice(group.totalRevenue)}</p>
                    </div>
                    <div className="bg-background rounded-lg p-2 text-center border">
                      <p className="text-xs text-muted-foreground">صافي الربح الكلي</p>
                      <p className={`font-bold ${group.totalRevenue - group.totalBatchCost >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {formatPrice(group.totalRevenue - group.totalBatchCost)}
                      </p>
                    </div>
                    <div className="bg-background rounded-lg p-2 text-center border">
                      <p className="text-xs text-muted-foreground">المتبقي</p>
                      <p className={`font-bold ${group.totalBatchQty - group.totalSoldQty > 0 ? 'text-blue-600' : 'text-muted-foreground'}`}>
                        {Math.max(0, group.totalBatchQty - group.totalSoldQty)} قطعة
                      </p>
                    </div>
                  </div>
                </div>

                {/* Individual batches */}
                <div className="divide-y">
                  {group.batches.map((batch: any, batchIdx: number) => {
                    const isExpanded = expandedBatchId === batch.id;
                    const profitColor = batch.profit >= 0 ? 'text-green-600' : 'text-destructive';

                    return (
                      <div key={batch.id}>
                        <div
                          className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={batch.isComplete ? 'default' : 'outline'} className="text-xs">
                                وجبة {batchIdx + 1}
                              </Badge>
                              {batch.isComplete && (
                                <Badge variant="secondary" className="text-xs">مكتملة ✓</Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(batch.created_at), 'dd/MM/yyyy', { locale: ar })}
                              </span>
                              {batch.notes && (
                                <span className="text-xs text-muted-foreground">• {batch.notes}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (editingBatchId === batch.id) {
                                    setEditingBatchId(null);
                                  } else {
                                    setEditingBatchId(batch.id);
                                    setEditForm({ batch_quantity: batch.batch_quantity, batch_cost: Number(batch.batch_cost) });
                                  }
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(e) => e.stopPropagation()}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>حذف الوجبة</AlertDialogTitle>
                                    <AlertDialogDescription>هل أنت متأكد من حذف الوجبة {batchIdx + 1} لـ {batch.product_name_ar}؟</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteBatchMutation.mutate(batch.id)}>حذف</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </div>
                          </div>

                          {/* Inline edit form */}
                          {editingBatchId === batch.id && (
                            <div className="flex items-end gap-3 mb-3 p-3 rounded-lg bg-muted/40 border" onClick={(e) => e.stopPropagation()}>
                              <div className="flex-1">
                                <Label className="text-xs">عدد القطع</Label>
                                <Input
                                  type="number"
                                  value={editForm.batch_quantity || ''}
                                  onChange={(e) => setEditForm({ ...editForm, batch_quantity: parseInt(e.target.value) || 0 })}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="flex-1">
                                <Label className="text-xs">التكلفة (د.ع)</Label>
                                <Input
                                  type="number"
                                  value={editForm.batch_cost || ''}
                                  onChange={(e) => setEditForm({ ...editForm, batch_cost: parseFloat(e.target.value) || 0 })}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <Button
                                size="sm"
                                className="h-8 gap-1"
                                disabled={updateBatchMutation.isPending}
                                onClick={() => updateBatchMutation.mutate({ id: batch.id, ...editForm })}
                              >
                                <Check className="h-3.5 w-3.5" />
                                حفظ
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8"
                                onClick={() => setEditingBatchId(null)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}

                          {/* Batch stats */}
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-sm">
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">الكمية</p>
                              <p className="font-bold">{batch.batch_quantity}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">التكلفة</p>
                              <p className="font-bold text-destructive">{formatPrice(Number(batch.batch_cost))}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">المباع</p>
                              <p className="font-bold text-blue-600">{batch.soldInBatch} / {batch.batch_quantity}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">الإيرادات</p>
                              <p className="font-bold text-green-600">{formatPrice(batch.batchRevenue)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">تكلفة/قطعة</p>
                              <p className="font-bold">{formatPrice(Math.round(batch.costPerUnit))}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">الربح</p>
                              <p className={`font-bold ${profitColor}`}>{formatPrice(batch.profit)}</p>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-2">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>{batch.soldInBatch} / {batch.batch_quantity} قطعة مباعة</span>
                              <span>{Math.round(Math.min(batch.progressPercent, 100))}% استرداد التكلفة</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${batch.progressPercent >= 100 ? 'bg-green-500' : 'bg-primary'}`}
                                style={{ width: `${Math.min(batch.progressPercent, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Expanded: sold items */}
                        {isExpanded && (
                          <div className="border-t px-4 pb-4 bg-muted/10">
                            <div className="flex items-center gap-2 py-3">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">تفاصيل مبيعات الوجبة ({batch.batchSoldItems.length} طلب)</span>
                            </div>
                            {batch.batchSoldItems.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">لم يتم بيع أي قطعة من هذه الوجبة بعد</p>
                            ) : (
                              <div className="rounded-lg border overflow-x-auto bg-background">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-right">رقم الطلب</TableHead>
                                      <TableHead className="text-right">المستخدم</TableHead>
                                      <TableHead className="text-right">الكمية</TableHead>
                                      <TableHead className="text-right">المبلغ (بدون توصيل)</TableHead>
                                      <TableHead className="text-right">التاريخ</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {batch.batchSoldItems.map((item: any, idx: number) => (
                                      <TableRow key={idx}>
                                        <TableCell className="font-mono text-sm">{item.orderNumber}</TableCell>
                                        <TableCell className="font-medium">{item.username}</TableCell>
                                        <TableCell>{item.quantity}</TableCell>
                                        <TableCell className="text-green-600">{formatPrice(item.revenue)}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                          {format(new Date(item.date), 'dd/MM/yyyy', { locale: ar })}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                    <TableRow className="bg-muted/30 font-bold">
                                      <TableCell colSpan={2}>المجموع</TableCell>
                                      <TableCell>{batch.soldInBatch}</TableCell>
                                      <TableCell className="text-green-600">{formatPrice(batch.batchRevenue)}</TableCell>
                                      <TableCell />
                                    </TableRow>
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BatchProfitAnalysis;
