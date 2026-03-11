import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout, { AdminCard, AdminCardHeader, AdminCardContent, AdminLoading, AdminEmptyState } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Package, X, Search } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BundleItem {
  id?: string;
  product_id: string;
  selected_color?: string;
  selected_option_id?: string;
  quantity: number;
  // UI helpers
  product_name?: string;
  product_image?: string;
  color_label?: string;
  option_label?: string;
}

interface BundleForm {
  title_ar: string;
  title_en: string;
  description_ar: string;
  image_url: string;
  bundle_price: number;
  original_price: number;
  is_active: boolean;
  display_order: number;
  items: BundleItem[];
}

const emptyForm: BundleForm = {
  title_ar: '', title_en: '', description_ar: '', image_url: '',
  bundle_price: 0, original_price: 0, is_active: true, display_order: 0, items: [],
};

const AdminProductBundles = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BundleForm>(emptyForm);
  const [productSearch, setProductSearch] = useState('');

  // Fetch bundles
  const { data: bundles, isLoading } = useQuery({
    queryKey: ['admin-product-bundles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_bundles')
        .select('*')
        .order('display_order');
      if (error) throw error;
      return data;
    },
  });

  // Fetch bundle items when editing
  const fetchBundleItems = async (bundleId: string) => {
    const { data, error } = await supabase
      .from('bundle_items')
      .select('*, products:product_id(name_ar, image_url, images), product_options:selected_option_id(name_ar)')
      .eq('bundle_id', bundleId);
    if (error) throw error;
    return (data || []).map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      selected_color: item.selected_color,
      selected_option_id: item.selected_option_id,
      quantity: item.quantity,
      product_name: item.products?.name_ar || '',
      product_image: item.products?.image_url || item.products?.images?.[0] || '',
      option_label: item.product_options?.name_ar || '',
    }));
  };

  // Fetch products for search
  const { data: products } = useQuery({
    queryKey: ['admin-products-for-bundles', productSearch],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id, name_ar, image_url, images, colors, direct_sale_price, price')
        .order('name_ar');
      if (productSearch) {
        query = query.ilike('name_ar', `%${productSearch}%`);
      }
      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data;
    },
    enabled: dialogOpen,
  });

  // Fetch options for a product
  const [selectedProductForOptions, setSelectedProductForOptions] = useState<string | null>(null);
  const { data: productOptions } = useQuery({
    queryKey: ['product-options-for-bundle', selectedProductForOptions],
    queryFn: async () => {
      if (!selectedProductForOptions) return [];
      const { data, error } = await supabase
        .from('product_options')
        .select('id, name_ar')
        .eq('product_id', selectedProductForOptions);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedProductForOptions,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: BundleForm) => {
      const bundleData = {
        title_ar: data.title_ar,
        title_en: data.title_en || null,
        description_ar: data.description_ar || null,
        image_url: data.image_url || null,
        bundle_price: data.bundle_price,
        original_price: data.original_price,
        is_active: data.is_active,
        display_order: data.display_order,
        updated_at: new Date().toISOString(),
      };

      let bundleId = editingId;
      if (editingId) {
        const { error } = await supabase.from('product_bundles').update(bundleData).eq('id', editingId);
        if (error) throw error;
        // Delete old items and re-insert
        await supabase.from('bundle_items').delete().eq('bundle_id', editingId);
      } else {
        const { data: newBundle, error } = await supabase.from('product_bundles').insert(bundleData).select('id').single();
        if (error) throw error;
        bundleId = newBundle.id;
      }

      // Insert items
      if (data.items.length > 0 && bundleId) {
        const itemsToInsert = data.items.map(item => ({
          bundle_id: bundleId!,
          product_id: item.product_id,
          selected_color: item.selected_color || null,
          selected_option_id: item.selected_option_id || null,
          quantity: item.quantity,
        }));
        const { error: itemsError } = await supabase.from('bundle_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-product-bundles'] });
      toast.success(editingId ? 'تم تحديث البندل' : 'تم إنشاء البندل');
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (err: any) => toast.error(err.message || 'حدث خطأ'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_bundles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-product-bundles'] });
      toast.success('تم حذف البندل');
    },
  });

  const handleEdit = async (bundle: any) => {
    setEditingId(bundle.id);
    const items = await fetchBundleItems(bundle.id);
    setForm({
      title_ar: bundle.title_ar,
      title_en: bundle.title_en || '',
      description_ar: bundle.description_ar || '',
      image_url: bundle.image_url || '',
      bundle_price: bundle.bundle_price,
      original_price: bundle.original_price,
      is_active: bundle.is_active,
      display_order: bundle.display_order,
      items,
    });
    setDialogOpen(true);
  };

  const addProductToBundle = (product: any) => {
    const colors = Array.isArray(product.colors) ? product.colors : [];
    setForm(prev => ({
      ...prev,
      items: [...prev.items, {
        product_id: product.id,
        quantity: 1,
        product_name: product.name_ar,
        product_image: product.image_url || product.images?.[0] || '',
      }],
    }));
    setSelectedProductForOptions(product.id);
  };

  const removeItemFromBundle = (index: number) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateItem = (index: number, field: keyof BundleItem, value: any) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item),
    }));
  };

  const discount = form.original_price > 0
    ? Math.round(((form.original_price - form.bundle_price) / form.original_price) * 100)
    : 0;

  return (
    <AdminLayout title="إدارة البندلات" icon={<Package className="h-5 w-5" />} description="إنشاء وإدارة باقات المنتجات بأسعار مخفضة">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 ml-2" />
            إنشاء بندل جديد
          </Button>
        </div>

        {isLoading ? <AdminLoading /> : !bundles?.length ? (
          <AdminEmptyState icon={<Package className="h-12 w-12" />} title="لا توجد بندلات" description="أنشئ أول بندل للمنتجات" />
        ) : (
          <AdminCard>
            <AdminCardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">العنوان</TableHead>
                    <TableHead className="text-right">السعر</TableHead>
                    <TableHead className="text-right">الخصم</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bundles.map((b: any) => {
                    const disc = b.original_price > 0 ? Math.round(((b.original_price - b.bundle_price) / b.original_price) * 100) : 0;
                    return (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {b.image_url && <img src={b.image_url} className="w-10 h-10 rounded object-cover" />}
                            <span className="font-medium">{b.title_ar}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-bold text-primary">{formatPrice(b.bundle_price)}</span>
                            {b.original_price > 0 && (
                              <span className="text-xs text-muted-foreground line-through mr-2">{formatPrice(b.original_price)}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {disc > 0 && <Badge variant="secondary" className="bg-green-500/10 text-green-600">{disc}%</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={b.is_active ? "default" : "secondary"}>
                            {b.is_active ? 'فعال' : 'معطل'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(b)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(b.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </AdminCardContent>
          </AdminCard>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'تعديل البندل' : 'إنشاء بندل جديد'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>العنوان (عربي) *</Label>
                <Input value={form.title_ar} onChange={e => setForm(f => ({ ...f, title_ar: e.target.value }))} />
              </div>
              <div>
                <Label>العنوان (إنجليزي)</Label>
                <Input value={form.title_en} onChange={e => setForm(f => ({ ...f, title_en: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label>الوصف</Label>
              <Textarea value={form.description_ar} onChange={e => setForm(f => ({ ...f, description_ar: e.target.value }))} />
            </div>

            <div>
              <Label>رابط الصورة</Label>
              <Input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>السعر الأصلي (د.ع)</Label>
                <Input type="number" value={form.original_price} onChange={e => setForm(f => ({ ...f, original_price: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>سعر البندل (د.ع)</Label>
                <Input type="number" value={form.bundle_price} onChange={e => setForm(f => ({ ...f, bundle_price: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>الخصم</Label>
                <div className="h-10 flex items-center">
                  <Badge variant="secondary" className="bg-green-500/10 text-green-600 text-lg">
                    {discount > 0 ? `${discount}%` : '0%'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ترتيب العرض</Label>
                <Input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: Number(e.target.value) }))} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label>فعال</Label>
              </div>
            </div>

            {/* Bundle Items */}
            <div className="border-t pt-4">
              <Label className="text-base font-bold">منتجات البندل</Label>

              {/* Search products */}
              <div className="flex gap-2 mt-2">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder="ابحث عن منتج..."
                    className="pr-9"
                  />
                </div>
              </div>

              {/* Product search results */}
              {productSearch && products && products.length > 0 && (
                <div className="border rounded-lg mt-2 max-h-40 overflow-y-auto">
                  {products.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer" onClick={() => { addProductToBundle(p); setProductSearch(''); }}>
                      <div className="flex items-center gap-2">
                        {(p.image_url || p.images?.[0]) && <img src={p.image_url || p.images?.[0]} className="w-8 h-8 rounded object-cover" />}
                        <span className="text-sm">{p.name_ar}</span>
                      </div>
                      <Plus className="h-4 w-4 text-primary" />
                    </div>
                  ))}
                </div>
              )}

              {/* Current items */}
              <div className="space-y-2 mt-3">
                {form.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30">
                    {item.product_image && <img src={item.product_image} className="w-10 h-10 rounded object-cover" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name || item.product_id}</p>
                      <div className="flex gap-2 mt-1">
                        <Input
                          type="text"
                          placeholder="اللون (اختياري)"
                          value={item.selected_color || ''}
                          onChange={e => updateItem(idx, 'selected_color', e.target.value)}
                          className="h-7 text-xs w-24"
                        />
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                          className="h-7 text-xs w-16"
                        />
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="shrink-0" onClick={() => removeItemFromBundle(idx)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {form.items.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">لم يتم إضافة منتجات بعد</p>
                )}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.title_ar || form.items.length === 0 || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'جارٍ الحفظ...' : editingId ? 'تحديث البندل' : 'إنشاء البندل'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminProductBundles;
