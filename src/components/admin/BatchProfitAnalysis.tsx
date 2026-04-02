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
import { Plus, Package, TrendingUp, Trash2, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface BatchProfitAnalysisProps {
  deliveredDirectOrders: any[];
  usdToIqdRate: number;
}

const calcItemRevenueExcludingDelivery = (item: any): number => {
  if (typeof item.total_price === 'number' && item.total_price > 0) return item.total_price;
  return (item.unit_price || 0) * (item.quantity || 1);
};

const BatchProfitAnalysis = ({ deliveredDirectOrders, usdToIqdRate }: BatchProfitAnalysisProps) => {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [form, setForm] = useState({
    product_id: '' as string,
    product_name_ar: '',
    batch_quantity: 0,
    batch_cost: 0,
    notes: '',
  });

  // Fetch batches
  const { data: batches = [] } = useQuery({
    queryKey: ['product-batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_batches')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Search products for picker
  const { data: searchResults = [] } = useQuery({
    queryKey: ['batch-product-search', productSearch],
    queryFn: async () => {
      if (!productSearch.trim()) return [];
      const { data } = await supabase
        .from('products')
        .select('id, name_ar, image_url')
        .ilike('name_ar', `%${productSearch}%`)
        .limit(10);
      return data || [];
    },
    enabled: productSearch.length >= 2,
  });

  const addBatchMutation = useMutation({
    mutationFn: async (formData: typeof form) => {
      const { error } = await supabase.from('product_batches').insert({
        product_id: formData.product_id || null,
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
      setForm({ product_id: '', product_name_ar: '', batch_quantity: 0, batch_cost: 0, notes: '' });
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

  // Build sold data per batch (matching by product_id)
  const batchAnalysis = useMemo(() => {
    return batches.map((batch: any) => {
      // Find all order items for this product in delivered direct orders
      const soldItems: { username: string; quantity: number; revenue: number; orderNumber: string; date: string }[] = [];
      let totalSoldQty = 0;
      let totalRevenue = 0;

      deliveredDirectOrders.forEach((order: any) => {
        order.order_items?.forEach((item: any) => {
          const matchById = batch.product_id && item.product_id === batch.product_id;
          const matchByName = !batch.product_id && (item.product_name_ar === batch.product_name_ar || item.product_name === batch.product_name_ar);
          
          if (matchById || matchByName) {
            const qty = item.quantity || 1;
            const revenue = calcItemRevenueExcludingDelivery(item);
            totalSoldQty += qty;
            totalRevenue += revenue;
            
            const username = order.profile?.full_name || order.profile?.username || 'غير معروف';
            soldItems.push({
              username,
              quantity: qty,
              revenue,
              orderNumber: order.order_number,
              date: order.created_at,
            });
          }
        });
      });

      const profit = totalRevenue - Number(batch.batch_cost);
      const costPerUnit = batch.batch_quantity > 0 ? Number(batch.batch_cost) / batch.batch_quantity : 0;
      const remainingQty = batch.batch_quantity - totalSoldQty;

      return {
        ...batch,
        soldItems,
        totalSoldQty,
        totalRevenue,
        profit,
        costPerUnit,
        remainingQty,
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
                <Label>البحث عن منتج</Label>
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="ابحث عن المنتج..."
                />
                {searchResults.length > 0 && (
                  <div className="border rounded-md mt-1 max-h-40 overflow-y-auto">
                    {searchResults.map((p: any) => (
                      <button
                        key={p.id}
                        className="w-full text-right p-2 hover:bg-muted/50 flex items-center gap-2 text-sm"
                        onClick={() => {
                          setForm({ ...form, product_id: p.id, product_name_ar: p.name_ar });
                          setProductSearch('');
                        }}
                      >
                        {p.image_url && <img src={p.image_url} className="w-8 h-8 rounded object-cover" alt="" />}
                        <span>{p.name_ar}</span>
                      </button>
                    ))}
                  </div>
                )}
                {form.product_name_ar && (
                  <Badge variant="secondary" className="mt-2">{form.product_name_ar}</Badge>
                )}
              </div>
              {!form.product_id && (
                <div>
                  <Label>أو أدخل اسم المنتج يدوياً</Label>
                  <Input
                    value={form.product_name_ar}
                    onChange={(e) => setForm({ ...form, product_name_ar: e.target.value })}
                    placeholder="اسم المنتج"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>الكمية المستلمة</Label>
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

      {/* Batches list */}
      {batchAnalysis.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            لا توجد وجبات بعد. قم بإضافة وجبة لبدء تحليل الأرباح.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {batchAnalysis.map((batch: any) => {
            const isExpanded = expandedBatchId === batch.id;
            const profitColor = batch.profit >= 0 ? 'text-green-600' : 'text-destructive';
            const progressPercent = batch.batch_quantity > 0 
              ? Math.min((batch.totalRevenue / Number(batch.batch_cost)) * 100, 100) 
              : 0;

            return (
              <Card key={batch.id} className="overflow-hidden">
                <CardContent className="p-0">
                  {/* Batch header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-bold">{batch.product_name_ar}</h4>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(batch.created_at), 'dd/MM/yyyy', { locale: ar })}
                            {batch.notes && ` • ${batch.notes}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف الوجبة</AlertDialogTitle>
                              <AlertDialogDescription>هل أنت متأكد من حذف وجبة {batch.product_name_ar}؟</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground"
                                onClick={() => deleteBatchMutation.mutate(batch.id)}
                              >
                                حذف
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="bg-muted/50 rounded-lg p-2 text-center">
                        <p className="text-xs text-muted-foreground">الكمية المستلمة</p>
                        <p className="font-bold">{batch.batch_quantity}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2 text-center">
                        <p className="text-xs text-muted-foreground">التكلفة الإجمالية</p>
                        <p className="font-bold text-red-500">{formatPrice(Number(batch.batch_cost))}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2 text-center">
                        <p className="text-xs text-muted-foreground">القطع المباعة</p>
                        <p className="font-bold text-blue-600">{batch.totalSoldQty}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2 text-center">
                        <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
                        <p className="font-bold text-green-600">{formatPrice(batch.totalRevenue)}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2 text-center">
                        <p className="text-xs text-muted-foreground">الربح</p>
                        <p className={`font-bold ${profitColor}`}>{formatPrice(batch.profit)}</p>
                      </div>
                    </div>

                    {/* Progress bar - how close to breaking even */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>تقدم استرداد التكلفة</span>
                        <span>{Math.round(progressPercent)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${progressPercent >= 100 ? 'bg-green-500' : 'bg-primary'}`}
                          style={{ width: `${Math.min(progressPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Expanded: sold items per customer */}
                  {isExpanded && (
                    <div className="border-t px-4 pb-4">
                      <div className="flex items-center gap-2 py-3">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">تفاصيل المبيعات ({batch.soldItems.length} طلب)</span>
                      </div>
                      {batch.soldItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">لم يتم بيع أي قطعة بعد</p>
                      ) : (
                        <div className="rounded-lg border overflow-x-auto">
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
                              {batch.soldItems.map((item: any, idx: number) => (
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
                              {/* Totals row */}
                              <TableRow className="bg-muted/30 font-bold">
                                <TableCell colSpan={2}>المجموع</TableCell>
                                <TableCell>{batch.totalSoldQty}</TableCell>
                                <TableCell className="text-green-600">{formatPrice(batch.totalRevenue)}</TableCell>
                                <TableCell />
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {/* Summary */}
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-lg border p-3 text-center">
                          <p className="text-xs text-muted-foreground">تكلفة القطعة الواحدة</p>
                          <p className="font-bold">{formatPrice(Math.round(batch.costPerUnit))}</p>
                        </div>
                        <div className="rounded-lg border p-3 text-center">
                          <p className="text-xs text-muted-foreground">المتبقي في المخزن</p>
                          <p className={`font-bold ${batch.remainingQty > 0 ? 'text-blue-600' : 'text-muted-foreground'}`}>
                            {Math.max(0, batch.remainingQty)} قطعة
                          </p>
                        </div>
                        <div className="rounded-lg border p-3 text-center">
                          <p className="text-xs text-muted-foreground">المبلغ المتبقي للربح</p>
                          <p className={`font-bold ${batch.profit >= 0 ? 'text-green-600' : 'text-orange-500'}`}>
                            {batch.profit < 0 ? formatPrice(Math.abs(batch.profit)) + ' متبقي' : 'تم تحقيق الربح ✓'}
                          </p>
                        </div>
                        <div className="rounded-lg border p-3 text-center">
                          <p className="text-xs text-muted-foreground">صافي الربح</p>
                          <p className={`font-bold text-lg ${profitColor}`}>{formatPrice(batch.profit)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BatchProfitAnalysis;
