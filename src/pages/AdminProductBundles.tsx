import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout, { AdminCard, AdminCardContent, AdminLoading, AdminEmptyState } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Package, X, Search, Upload, ImageIcon, AlertTriangle } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BundleItem {
  id?: string;
  product_id: string;
  selected_color?: string;
  selected_option_id?: string;
  quantity: number;
  product_name?: string;
  product_image?: string;
  color_label?: string;
  option_label?: string;
  // stock helpers
  available_stock?: number;
}

interface BundleForm {
  title_ar: string;
  title_en: string;
  description_ar: string;
  image_url: string;
  bundle_price: number;
  original_price: number;
  is_active: boolean;
  items: BundleItem[];
}

const emptyForm: BundleForm = {
  title_ar: '', title_en: '', description_ar: '', image_url: '',
  bundle_price: 0, original_price: 0, is_active: true, items: [],
};

/** Get available stock for a product+color+option combo */
function getAvailableStock(product: any, colorName?: string, optionId?: string): number {
  const colors = Array.isArray(product.colors) ? product.colors : [];

  // No colors → use direct_stock
  if (colors.length === 0) {
    return product.direct_stock != null ? Number(product.direct_stock) : 0;
  }

  if (!colorName) {
    // Sum all stock across all direct-sale colors
    let total = 0;
    for (const c of colors) {
      if (c?.available_for_direct_sale === false) continue;
      const stocks = c?.option_stocks;
      if (stocks && typeof stocks === 'object') {
        total += Object.values(stocks).reduce<number>((s, v) => s + Math.max(0, Number(v)), 0);
      } else if (c?.stock_quantity != null) {
        total += Math.max(0, Number(c.stock_quantity));
      }
    }
    return total;
  }

  const color = colors.find((c: any) => c.color === colorName || c.name === colorName);
  if (!color) return 0;

  const stocks = color.option_stocks;
  if (stocks && typeof stocks === 'object') {
    if (optionId && stocks[optionId] != null) {
      return Math.max(0, Number(stocks[optionId]));
    }
    return Object.values(stocks).reduce((s: number, v: any) => s + Math.max(0, Number(v)), 0);
  }

  return color.stock_quantity != null ? Math.max(0, Number(color.stock_quantity)) : 0;
}

const AdminProductBundles = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BundleForm>(emptyForm);
  const [productSearch, setProductSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      .select('*, products:product_id(name_ar, image_url, images, colors, direct_stock), product_options:selected_option_id(name_ar)')
      .eq('bundle_id', bundleId);
    if (error) throw error;
    return (data || []).map((item: any) => {
      const stock = getAvailableStock(item.products, item.selected_color || undefined, item.selected_option_id || undefined);
      return {
        id: item.id,
        product_id: item.product_id,
        selected_color: item.selected_color,
        selected_option_id: item.selected_option_id,
        quantity: item.quantity,
        product_name: item.products?.name_ar || '',
        product_image: item.products?.image_url || item.products?.images?.[0] || '',
        option_label: item.product_options?.name_ar || '',
        available_stock: stock,
      };
    });
  };

  // Fetch products for search
  const { data: products } = useQuery({
    queryKey: ['admin-products-for-bundles', productSearch],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id, name_ar, image_url, images, colors, direct_sale_price, price, direct_stock')
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

  // Fetch options for products in the bundle
  const productIdsInBundle = form.items.map(i => i.product_id);
  const { data: allProductOptions } = useQuery({
    queryKey: ['product-options-for-bundle', productIdsInBundle],
    queryFn: async () => {
      if (productIdsInBundle.length === 0) return [];
      const { data, error } = await supabase
        .from('product_options')
        .select('id, name_ar, product_id')
        .in('product_id', productIdsInBundle);
      if (error) throw error;
      return data;
    },
    enabled: productIdsInBundle.length > 0,
  });

  // Image upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `bundle-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('bundle-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('bundle-images').getPublicUrl(fileName);
      setForm(f => ({ ...f, image_url: urlData.publicUrl }));
      toast.success('تم رفع الصورة');
    } catch (err: any) {
      toast.error(err.message || 'فشل رفع الصورة');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
        updated_at: new Date().toISOString(),
      };

      let bundleId = editingId;
      if (editingId) {
        const { error } = await supabase.from('product_bundles').update(bundleData).eq('id', editingId);
        if (error) throw error;
        await supabase.from('bundle_items').delete().eq('bundle_id', editingId);
      } else {
        const { data: newBundle, error } = await supabase.from('product_bundles').insert(bundleData).select('id').single();
        if (error) throw error;
        bundleId = newBundle.id;
      }

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
      items,
    });
    setDialogOpen(true);
  };

  const addProductToBundle = (product: any) => {
    const stock = getAvailableStock(product);
    setForm(prev => ({
      ...prev,
      items: [...prev.items, {
        product_id: product.id,
        quantity: 1,
        product_name: product.name_ar,
        product_image: product.image_url || product.images?.[0] || '',
        available_stock: stock,
      }],
    }));
  };

  const removeItemFromBundle = (index: number) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateItem = (index: number, field: keyof BundleItem, value: any) => {
    setForm(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };

      // Recalculate stock when color or option changes
      if (field === 'selected_color' || field === 'selected_option_id') {
        const product = products?.find((p: any) => p.id === newItems[index].product_id);
        if (product) {
          newItems[index].available_stock = getAvailableStock(
            product,
            newItems[index].selected_color || undefined,
            newItems[index].selected_option_id || undefined
          );
        }
      }

      return { ...prev, items: newItems };
    });
  };

  // Get colors for a product
  const getProductColors = (productId: string) => {
    const product = products?.find((p: any) => p.id === productId);
    const colors = Array.isArray(product?.colors) ? product.colors : [];
    return colors.filter((c: any) => c?.available_for_direct_sale !== false);
  };

  // Get options for a product
  const getProductOptions = (productId: string) => {
    return (allProductOptions || []).filter((o: any) => o.product_id === productId);
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

            {/* Image Upload */}
            <div>
              <Label>صورة البندل</Label>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
              {form.image_url ? (
                <div className="relative mt-2 w-full h-40 rounded-lg overflow-hidden border border-border bg-muted">
                  <img src={form.image_url} className="w-full h-full object-cover" alt="صورة البندل" />
                  <div className="absolute top-2 left-2 flex gap-1">
                    <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      <Upload className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => setForm(f => ({ ...f, image_url: '' }))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="mt-2 border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <p className="text-sm text-muted-foreground">جارٍ الرفع...</p>
                  ) : (
                    <>
                      <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">اضغط لرفع صورة</p>
                    </>
                  )}
                </div>
              )}
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

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>فعال</Label>
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
              <div className="space-y-3 mt-3">
                {form.items.map((item, idx) => {
                  const colors = getProductColors(item.product_id);
                  const options = getProductOptions(item.product_id);
                  const stockInsufficient = item.available_stock != null && item.available_stock < item.quantity;

                  return (
                    <div key={idx} className={`p-3 border rounded-lg ${stockInsufficient ? 'border-destructive/50 bg-destructive/5' : 'bg-muted/30'}`}>
                      <div className="flex items-center gap-2">
                        {item.product_image && <img src={item.product_image} className="w-10 h-10 rounded object-cover shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.product_name || item.product_id}</p>
                          {item.available_stock != null && (
                            <p className={`text-xs ${stockInsufficient ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                              المخزون: {item.available_stock}
                              {stockInsufficient && ' ⚠️ أقل من الكمية المطلوبة'}
                            </p>
                          )}
                        </div>
                        <Button size="icon" variant="ghost" className="shrink-0" onClick={() => removeItemFromBundle(idx)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {/* Color selector */}
                        {colors.length > 0 ? (
                          <Select
                            value={item.selected_color || '_none'}
                            onValueChange={v => updateItem(idx, 'selected_color', v === '_none' ? '' : v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="اللون" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">بدون لون</SelectItem>
                              {colors.map((c: any, ci: number) => (
                                <SelectItem key={ci} value={c.color || c.name || `color-${ci}`}>
                                  {c.color || c.name || `لون ${ci + 1}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="text-xs text-muted-foreground flex items-center">بدون ألوان</div>
                        )}

                        {/* Option selector */}
                        {options.length > 0 ? (
                          <Select
                            value={item.selected_option_id || '_none'}
                            onValueChange={v => updateItem(idx, 'selected_option_id', v === '_none' ? '' : v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="الخيار" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">بدون خيار</SelectItem>
                              {options.map((o: any) => (
                                <SelectItem key={o.id} value={o.id}>{o.name_ar}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="text-xs text-muted-foreground flex items-center">بدون خيارات</div>
                        )}

                        {/* Quantity */}
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                          className="h-8 text-xs"
                          placeholder="الكمية"
                        />
                      </div>

                      {stockInsufficient && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          <span>المخزون ({item.available_stock}) أقل من الكمية المطلوبة ({item.quantity}) - سيظهر البندل كـ "انتهى العرض"</span>
                        </div>
                      )}
                    </div>
                  );
                })}
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
