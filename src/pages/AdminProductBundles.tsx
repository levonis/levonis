import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShippingSettings } from '@/hooks/useShippingCalculator';
import AdminLayout, { AdminCard, AdminCardContent, AdminLoading, AdminEmptyState } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Package, X, Search, Upload, ImageIcon, AlertTriangle, Layers, Loader2 } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

type BundleSaleType = 'direct' | 'preorder-air' | 'preorder-sea';

interface BundleItem {
  id?: string;
  product_id: string;
  selected_color?: string;
  selected_option_id?: string;
  quantity: number;
  product_name?: string;
  product_image?: string;
  color_image?: string;
  option_label?: string;
  available_stock?: number;
  unit_price?: number;
}

interface BundleForm {
  title_ar: string;
  title_en: string;
  description_ar: string;
  image_url: string;
  images: string[];
  bundle_price: number;
  original_price: number;
  is_active: boolean;
  sale_type: BundleSaleType;
  items: BundleItem[];
}

const emptyForm: BundleForm = {
  title_ar: '', title_en: '', description_ar: '', image_url: '', images: [],
  bundle_price: 0, original_price: 0, is_active: true, sale_type: 'direct', items: [],
};

function getAvailableStock(product: any, colorName?: string, optionId?: string): number {
  const colors = Array.isArray(product?.colors) ? product.colors : [];
  if (colors.length === 0) {
    return product?.direct_stock != null ? Number(product.direct_stock) : 0;
  }
  if (!colorName) {
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
    if (optionId && stocks[optionId] != null) return Math.max(0, Number(stocks[optionId]));
    return Object.values(stocks).reduce<number>((s, v) => s + Math.max(0, Number(v)), 0);
  }
  return color.stock_quantity != null ? Math.max(0, Number(color.stock_quantity)) : 0;
}

/** Get preorder stock for a product */
function getPreorderStock(product: any): number {
  return product?.pre_order_stock != null ? Number(product.pre_order_stock) : 999;
}

/** Calculate unit price based on sale type */
function calcItemPrice(product: any, optionId: string | undefined, saleType: BundleSaleType, usdToIqd: number, options?: any[]): number {
  const opt = optionId && options ? options.find((o: any) => o.id === optionId) : null;
  const adj = opt?.price_adjustment || 0;
  const adjIqd = Math.round(adj * usdToIqd);

  if (saleType === 'direct') {
    const base = product.direct_sale_price || product.price || 0;
    return base + adjIqd;
  } else if (saleType === 'preorder-air') {
    const base = product.air_price || product.price || 0;
    return base + adjIqd;
  } else {
    // sea
    const base = product.sea_price || product.price || 0;
    return base + adjIqd;
  }
}

async function mergeImages(imageUrls: string[]): Promise<string> {
  const urls = [...new Set(imageUrls.filter(Boolean))];
  if (urls.length === 0) throw new Error('لا توجد صور للدمج');
  if (urls.length === 1) return urls[0];

  const SIZE = 800;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const count = Math.min(urls.length, 9);
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const cellW = SIZE / cols;
  const cellH = SIZE / rows;
  const padding = 8;

  const loadImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });

  const images = await Promise.allSettled(urls.slice(0, 9).map(loadImage));

  images.forEach((result, i) => {
    if (result.status !== 'fulfilled') return;
    const img = result.value;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellW + padding;
    const y = row * cellH + padding;
    const w = cellW - padding * 2;
    const h = cellH - padding * 2;

    ctx.fillStyle = '#ffffff';
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();

    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (img.width - sw) / 2;
    const sy = (img.height - sh) / 2;

    ctx.save();
    roundRect(ctx, x, y, w, h, 12);
    ctx.clip();
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    ctx.restore();
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas toBlob failed')), 'image/jpeg', 0.85);
  });

  const fileName = `bundle-collage-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from('bundle-images')
    .upload(fileName, blob, { cacheControl: '3600', contentType: 'image/jpeg' });
  if (error) throw error;

  const { data } = supabase.storage.from('bundle-images').getPublicUrl(fileName);
  return data.publicUrl;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const SALE_TYPE_LABELS: Record<BundleSaleType, string> = {
  'direct': 'بيع مباشر',
  'preorder-air': 'طلب مسبق (جوي)',
  'preorder-sea': 'طلب مسبق (بحري)',
};

const AdminProductBundles = () => {
  const queryClient = useQueryClient();
  const { data: shippingSettings } = useShippingSettings();
  const usdToIqd = shippingSettings?.usd_to_iqd_rate || 1300;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BundleForm>(emptyForm);
  const [productSearch, setProductSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [merging, setMerging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectProductDialog, setSelectProductDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [itemQuantity, setItemQuantity] = useState(1);

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

  const fetchBundleItems = async (bundleId: string, saleType: BundleSaleType) => {
    const { data, error } = await supabase
      .from('bundle_items')
      .select('*, products:product_id(name_ar, image_url, images, colors, direct_stock, direct_sale_price, price, air_price, sea_price, pre_order_stock), product_options:selected_option_id(name_ar, price_adjustment)')
      .eq('bundle_id', bundleId);
    if (error) throw error;
    return (data || []).map((item: any) => {
      const colors = Array.isArray(item.products?.colors) ? item.products.colors : [];
      const colorObj = item.selected_color ? colors.find((c: any) => (c.color || c.name) === item.selected_color) : null;
      const stock = saleType === 'direct'
        ? getAvailableStock(item.products, item.selected_color || undefined, item.selected_option_id || undefined)
        : getPreorderStock(item.products);
      const unitPrice = calcItemPrice(item.products, item.selected_option_id, saleType, usdToIqd, item.product_options ? [item.product_options] : []);
      return {
        id: item.id,
        product_id: item.product_id,
        selected_color: item.selected_color,
        selected_option_id: item.selected_option_id,
        quantity: item.quantity,
        product_name: item.products?.name_ar || '',
        product_image: item.products?.image_url || item.products?.images?.[0] || '',
        color_image: colorObj?.image || '',
        option_label: item.product_options?.name_ar || '',
        available_stock: stock,
        unit_price: unitPrice,
      };
    });
  };

  const { data: products } = useQuery({
    queryKey: ['admin-products-for-bundles', productSearch],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id, name_ar, image_url, images, colors, direct_sale_price, price, air_price, sea_price, direct_stock, pre_order_stock')
        .order('name_ar');
      if (productSearch) query = query.ilike('name_ar', `%${productSearch}%`);
      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data;
    },
    enabled: dialogOpen,
  });

  const { data: pickerOptions } = useQuery({
    queryKey: ['product-options-for-picker', selectedProduct?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_options')
        .select('id, name_ar, price_adjustment')
        .eq('product_id', selectedProduct!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProduct?.id,
  });

  const productIdsInBundle = [...new Set(form.items.map(i => i.product_id))];
  const { data: allProductOptions } = useQuery({
    queryKey: ['product-options-for-bundle', productIdsInBundle],
    queryFn: async () => {
      if (productIdsInBundle.length === 0) return [];
      const { data, error } = await supabase
        .from('product_options')
        .select('id, name_ar, product_id, price_adjustment')
        .in('product_id', productIdsInBundle);
      if (error) throw error;
      return data;
    },
    enabled: productIdsInBundle.length > 0,
  });

  // Auto-calculate original_price from items
  useEffect(() => {
    if (form.items.length === 0) return;
    const total = form.items.reduce((sum, item) => sum + (item.unit_price || 0) * item.quantity, 0);
    if (total > 0) {
      setForm(f => ({ ...f, original_price: total }));
    }
  }, [form.items]);

  // Auto-collect color/option images into images array
  useEffect(() => {
    const colorImages = form.items
      .map(item => item.color_image)
      .filter(Boolean) as string[];
    const unique = [...new Set(colorImages)];
    setForm(f => ({ ...f, images: unique }));
  }, [form.items]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `bundle-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('bundle-images').upload(fileName, file, { cacheControl: '3600', upsert: false });
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

  const handleMergeImages = useCallback(async () => {
    const imageUrls = form.items.map(item => item.color_image || item.product_image || '').filter(Boolean);
    if (imageUrls.length === 0) { toast.error('لا توجد صور للمنتجات'); return; }
    setMerging(true);
    try {
      const url = await mergeImages(imageUrls);
      setForm(f => ({ ...f, image_url: url }));
      toast.success('تم دمج الصور وتعيينها كصورة البندل');
    } catch (err: any) {
      toast.error(err.message || 'فشل دمج الصور');
    } finally {
      setMerging(false);
    }
  }, [form.items]);

  const saveMutation = useMutation({
    mutationFn: async (data: BundleForm) => {
      const bundleData: any = {
        title_ar: data.title_ar,
        title_en: data.title_en || null,
        description_ar: data.description_ar || null,
        image_url: data.image_url || null,
        images: data.images || [],
        bundle_price: data.bundle_price,
        original_price: data.original_price,
        sale_type: data.sale_type,
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
    const saleType = (bundle.sale_type || 'direct') as BundleSaleType;
    const items = await fetchBundleItems(bundle.id, saleType);
    setForm({
      title_ar: bundle.title_ar,
      title_en: bundle.title_en || '',
      description_ar: bundle.description_ar || '',
      image_url: bundle.image_url || '',
      images: bundle.images || [],
      bundle_price: bundle.bundle_price,
      original_price: bundle.original_price,
      is_active: bundle.is_active,
      sale_type: saleType,
      items,
    });
    setDialogOpen(true);
  };

  const openProductPicker = (product: any) => {
    setSelectedProduct(product);
    setSelectedColors([]);
    setSelectedOptionIds([]);
    setItemQuantity(1);
    setSelectProductDialog(true);
    setProductSearch('');
  };

  const confirmAddProduct = () => {
    if (!selectedProduct) return;
    const colors = Array.isArray(selectedProduct.colors) ? selectedProduct.colors : [];
    const directColors = colors.filter((c: any) => c?.available_for_direct_sale !== false);
    const options = pickerOptions || [];

    const newItems: BundleItem[] = [];
    const baseImg = selectedProduct.image_url || selectedProduct.images?.[0] || '';

    const getStock = (colorName?: string, optId?: string) => {
      if (form.sale_type === 'direct') return getAvailableStock(selectedProduct, colorName, optId);
      return getPreorderStock(selectedProduct);
    };

    const getPrice = (optId?: string) => calcItemPrice(selectedProduct, optId, form.sale_type, usdToIqd, options);

    if (selectedColors.length === 0 && selectedOptionIds.length === 0) {
      newItems.push({
        product_id: selectedProduct.id,
        quantity: itemQuantity,
        product_name: selectedProduct.name_ar,
        product_image: baseImg,
        available_stock: getStock(),
        unit_price: getPrice(),
      });
    } else if (selectedColors.length > 0 && selectedOptionIds.length > 0) {
      for (const colorName of selectedColors) {
        const colorObj = directColors.find((c: any) => (c.color || c.name) === colorName);
        for (const optId of selectedOptionIds) {
          const opt = options.find((o: any) => o.id === optId);
          newItems.push({
            product_id: selectedProduct.id,
            selected_color: colorName,
            selected_option_id: optId,
            quantity: itemQuantity,
            product_name: selectedProduct.name_ar,
            product_image: baseImg,
            color_image: colorObj?.image || '',
            option_label: opt?.name_ar || '',
            available_stock: getStock(colorName, optId),
            unit_price: getPrice(optId),
          });
        }
      }
    } else if (selectedColors.length > 0) {
      for (const colorName of selectedColors) {
        const colorObj = directColors.find((c: any) => (c.color || c.name) === colorName);
        newItems.push({
          product_id: selectedProduct.id,
          selected_color: colorName,
          quantity: itemQuantity,
          product_name: selectedProduct.name_ar,
          product_image: baseImg,
          color_image: colorObj?.image || '',
          available_stock: getStock(colorName),
          unit_price: getPrice(),
        });
      }
    } else {
      for (const optId of selectedOptionIds) {
        const opt = options.find((o: any) => o.id === optId);
        newItems.push({
          product_id: selectedProduct.id,
          selected_option_id: optId,
          quantity: itemQuantity,
          product_name: selectedProduct.name_ar,
          product_image: baseImg,
          option_label: opt?.name_ar || '',
          available_stock: getStock(undefined, optId),
          unit_price: getPrice(optId),
        });
      }
    }

    setForm(prev => ({ ...prev, items: [...prev.items, ...newItems] }));
    setSelectProductDialog(false);
    setSelectedProduct(null);
    toast.success(`تم إضافة ${newItems.length} عنصر للبندل`);
  };

  const removeItemFromBundle = (index: number) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const toggleColor = (colorName: string) => {
    setSelectedColors(prev => prev.includes(colorName) ? prev.filter(c => c !== colorName) : [...prev, colorName]);
  };

  const toggleOption = (optId: string) => {
    setSelectedOptionIds(prev => prev.includes(optId) ? prev.filter(o => o !== optId) : [...prev, optId]);
  };

  const getOptionLabel = (optionId: string) => {
    return allProductOptions?.find((o: any) => o.id === optionId)?.name_ar || '';
  };

  // Recalculate prices when sale_type changes
  const handleSaleTypeChange = (newType: BundleSaleType) => {
    // Re-fetch prices would require product data, simplify by clearing items
    // Actually, we can approximate by just updating the form and letting the user re-add
    setForm(f => ({ ...f, sale_type: newType }));
    if (form.items.length > 0) {
      toast.info('يرجى إعادة إضافة المنتجات لتحديث الأسعار حسب نوع البيع الجديد');
    }
  };

  const discount = form.original_price > 0
    ? Math.round(((form.original_price - form.bundle_price) / form.original_price) * 100) : 0;

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
                    <TableHead className="text-right">النوع</TableHead>
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
                          <Badge variant="outline" className="text-xs">
                            {SALE_TYPE_LABELS[(b.sale_type || 'direct') as BundleSaleType]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-primary">{formatPrice(b.bundle_price)}</span>
                          {b.original_price > 0 && <span className="text-xs text-muted-foreground line-through mr-2">{formatPrice(b.original_price)}</span>}
                        </TableCell>
                        <TableCell>
                          {disc > 0 && <Badge variant="secondary">{disc}%</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={b.is_active ? "default" : "secondary"}>{b.is_active ? 'فعال' : 'معطل'}</Badge>
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
            {/* Sale Type Selection */}
            <div>
              <Label className="mb-2 block font-bold">نوع البيع</Label>
              <RadioGroup
                value={form.sale_type}
                onValueChange={(v) => handleSaleTypeChange(v as BundleSaleType)}
                className="flex flex-wrap gap-3"
                dir="rtl"
              >
                {Object.entries(SALE_TYPE_LABELS).map(([value, label]) => (
                  <label
                    key={value}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${form.sale_type === value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                  >
                    <RadioGroupItem value={value} />
                    <span className="text-sm font-medium">{label}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

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

            {/* Image Upload + Merge */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>صورة البندل الأساسية (مدموجة)</Label>
                {form.items.length >= 2 && (
                  <Button
                    size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={handleMergeImages} disabled={merging}
                  >
                    {merging ? <Loader2 className="h-3 w-3 animate-spin" /> : <Layers className="h-3 w-3" />}
                    {merging ? 'جارٍ الدمج...' : 'دمج صور المنتجات'}
                  </Button>
                )}
              </div>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
              {form.image_url ? (
                <div className="relative w-full h-40 rounded-lg overflow-hidden border border-border bg-muted">
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
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                  {uploading ? <p className="text-sm text-muted-foreground">جارٍ الرفع...</p> : (
                    <>
                      <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">اضغط لرفع صورة أو استخدم "دمج صور المنتجات"</p>
                    </>
                  )}
                </div>
              )}
              {/* Color images preview */}
              {form.images.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">صور الألوان/الخيارات (تُعرض كصور إضافية):</p>
                  <div className="flex gap-1 flex-wrap">
                    {form.images.map((img, i) => (
                      <img key={i} src={img} className="w-12 h-12 rounded object-cover border border-border" />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="flex items-center gap-1">
                  السعر الأصلي (د.ع)
                  {form.items.length > 0 && <span className="text-[10px] text-muted-foreground">(تلقائي)</span>}
                </Label>
                <Input
                  type="number" value={form.original_price}
                  onChange={e => setForm(f => ({ ...f, original_price: Number(e.target.value) }))}
                  className="bg-muted/50"
                />
                {form.items.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    محسوب: {form.items.reduce((s, i) => s + (i.unit_price || 0) * i.quantity, 0).toLocaleString()} د.ع
                  </p>
                )}
              </div>
              <div>
                <Label>سعر البندل (د.ع)</Label>
                <Input type="number" value={form.bundle_price} onChange={e => setForm(f => ({ ...f, bundle_price: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>الخصم</Label>
                <div className="h-10 flex items-center">
                  <Badge variant="secondary" className="text-lg">{discount > 0 ? `${discount}%` : '0%'}</Badge>
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

              <div className="flex gap-2 mt-2">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="ابحث عن منتج لإضافته..." className="pr-9" />
                </div>
              </div>

              {productSearch && products && products.length > 0 && (
                <div className="border rounded-lg mt-2 max-h-40 overflow-y-auto">
                  {products.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer" onClick={() => openProductPicker(p)}>
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
                {form.items.map((item, idx) => {
                  const stockInsufficient = form.sale_type === 'direct' && item.available_stock != null && item.available_stock < item.quantity;
                  return (
                    <div key={idx} className={`flex items-center gap-2 p-2 border rounded-lg ${stockInsufficient ? 'border-destructive/50 bg-destructive/5' : 'bg-muted/30'}`}>
                      <img src={item.color_image || item.product_image || ''} className="w-10 h-10 rounded object-cover shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.product_name}</p>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {item.selected_color && <Badge variant="outline" className="text-[10px] h-5">{item.selected_color}</Badge>}
                          {item.selected_option_id && <Badge variant="outline" className="text-[10px] h-5">{item.option_label || getOptionLabel(item.selected_option_id)}</Badge>}
                          <Badge variant="outline" className="text-[10px] h-5">×{item.quantity}</Badge>
                          {item.unit_price != null && item.unit_price > 0 && (
                            <Badge variant="outline" className="text-[10px] h-5 text-primary">{(item.unit_price * item.quantity).toLocaleString()} د.ع</Badge>
                          )}
                          {form.sale_type === 'direct' && item.available_stock != null && (
                            <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground">
                              مخزون: {item.available_stock}
                            </Badge>
                          )}
                        </div>
                        {stockInsufficient && (
                          <p className="text-[10px] text-destructive flex items-center gap-0.5 mt-0.5">
                            <AlertTriangle className="h-3 w-3" />
                            المخزون ({item.available_stock}) أقل من المطلوب
                          </p>
                        )}
                      </div>
                      <Button size="icon" variant="ghost" className="shrink-0 h-7 w-7" onClick={() => removeItemFromBundle(idx)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
                {form.items.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">ابحث عن منتج أعلاه لإضافته للبندل</p>
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

      {/* Product Color/Option Picker Dialog */}
      <Dialog open={selectProductDialog} onOpenChange={setSelectProductDialog}>
        <DialogContent dir="rtl" className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedProduct?.image_url && <img src={selectedProduct.image_url} className="w-8 h-8 rounded object-cover" />}
              إضافة: {selectedProduct?.name_ar}
            </DialogTitle>
          </DialogHeader>

          {selectedProduct && (() => {
            const colors = (Array.isArray(selectedProduct.colors) ? selectedProduct.colors : [])
              .filter((c: any) => c?.available_for_direct_sale !== false);
            const options = pickerOptions || [];

            return (
              <div className="space-y-4">
                {colors.length > 0 && (
                  <div>
                    <Label className="mb-2 block">الألوان (اختر واحد أو أكثر)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {colors.map((c: any, ci: number) => {
                        const colorName = c.color || c.name || `color-${ci}`;
                        const isChecked = selectedColors.includes(colorName);
                        const stock = form.sale_type === 'direct' ? getAvailableStock(selectedProduct, colorName) : null;
                        return (
                          <label
                            key={ci}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${isChecked ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                          >
                            <Checkbox checked={isChecked} onCheckedChange={() => toggleColor(colorName)} />
                            {c.image && <img src={c.image} className="w-8 h-8 rounded object-cover" />}
                            <div className="flex-1 min-w-0">
                              <span className="text-sm block truncate">{colorName}</span>
                              {stock != null && (
                                <span className={`text-[10px] ${stock > 0 ? 'text-muted-foreground' : 'text-destructive'}`}>
                                  مخزون: {stock}
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {options.length > 0 && (
                  <div>
                    <Label className="mb-2 block">الخيارات (اختر واحد أو أكثر)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {options.map((o: any) => {
                        const isChecked = selectedOptionIds.includes(o.id);
                        return (
                          <label
                            key={o.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${isChecked ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                          >
                            <Checkbox checked={isChecked} onCheckedChange={() => toggleOption(o.id)} />
                            <span className="text-sm">{o.name_ar}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <Label>الكمية لكل عنصر</Label>
                  <Input type="number" min={1} value={itemQuantity} onChange={e => setItemQuantity(Math.max(1, Number(e.target.value)))} className="mt-1" />
                </div>

                {(selectedColors.length > 0 || selectedOptionIds.length > 0) && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <p className="text-muted-foreground">
                      سيتم إضافة <strong className="text-foreground">
                        {Math.max(1, selectedColors.length) * Math.max(1, selectedOptionIds.length)}
                      </strong> عنصر للبندل
                    </p>
                  </div>
                )}

                <Button className="w-full" onClick={confirmAddProduct}>
                  <Plus className="h-4 w-4 ml-2" />
                  إضافة للبندل
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminProductBundles;
