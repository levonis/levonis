import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Loader2, Search, Flag, FlagOff, RefreshCw, ImageOff, AlertTriangle, ExternalLink,
  Bug, Copy, ChevronDown, ChevronUp,
} from 'lucide-react';
import { mergeRetryColors } from '@/lib/mergeRetryColors';
import { normalizeVariantName, isSwatchUrl } from '@/lib/variantNameNormalize';
import { getColorSwatchStyle } from '@/lib/colorSwatch';
import { adminUpdateProduct } from '@/lib/adminMutations';

type ColorVariant = {
  name?: string;
  name_ar?: string;
  hex_code?: string | null;
  image_url?: string | null;
  available_for_pre_order?: boolean;
  available_for_direct_sale?: boolean;
  in_stock?: boolean;
};

type ProductRow = {
  id: string;
  slug: string;
  name_ar: string | null;
  name: string | null;
  image_url: string | null;
  images: string[] | null;
  colors: ColorVariant[] | null;
  taobao_url: string | null;
};

type FlagRow = {
  id: string;
  product_id: string;
  color_name: string;
  reason: string | null;
  resolved: boolean;
  created_at: string;
};

const AdminProductColorQa = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [flagDialog, setFlagDialog] = useState<{ open: boolean; colorName: string; reason: string }>(
    { open: false, colorName: '', reason: '' }
  );
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);

  // Search products by name/slug. Limit to 25 for snappy UI.
  const { data: products = [], isLoading: searchLoading } = useQuery({
    queryKey: ['qa-product-search', search],
    queryFn: async () => {
      const q = (supabase as any)
        .from('products_admin')
        .select('id, slug, name, name_ar, image_url, images, colors, taobao_url')
        .order('updated_at', { ascending: false })
        .limit(25);
      if (search.trim()) {
        const term = `%${search.trim()}%`;
        q.or(`name_ar.ilike.${term},name.ilike.${term},slug.ilike.${term}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as ProductRow[];
    },
  });

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || null,
    [products, selectedProductId]
  );

  // Flags for the currently selected product
  const { data: flags = [] } = useQuery({
    queryKey: ['qa-flags', selectedProductId],
    enabled: !!selectedProductId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_color_qa_flags')
        .select('*')
        .eq('product_id', selectedProductId!);
      if (error) throw error;
      return (data || []) as FlagRow[];
    },
  });

  // Aggregate counts of unresolved flags per product (for badges in the list)
  const { data: flagCounts = {} } = useQuery({
    queryKey: ['qa-flag-counts', products.map((p) => p.id).join(',')],
    enabled: products.length > 0,
    queryFn: async () => {
      const ids = products.map((p) => p.id);
      const { data, error } = await supabase
        .from('product_color_qa_flags')
        .select('product_id')
        .in('product_id', ids)
        .eq('resolved', false);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data || []) map[r.product_id] = (map[r.product_id] || 0) + 1;
      return map;
    },
  });

  const flagByName = useMemo(() => {
    const m = new Map<string, FlagRow>();
    for (const f of flags) m.set(f.color_name.toLowerCase().trim(), f);
    return m;
  }, [flags]);

  const upsertFlagMut = useMutation({
    mutationFn: async (vars: { colorName: string; reason: string }) => {
      if (!selectedProductId) throw new Error('No product selected');
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('product_color_qa_flags')
        .upsert(
          {
            product_id: selectedProductId,
            color_name: vars.colorName,
            reason: vars.reason || null,
            flagged_by: user?.id || null,
            resolved: false,
          },
          { onConflict: 'product_id,color_name' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم وضع علامة على اللون لإعادة الاستخراج');
      queryClient.invalidateQueries({ queryKey: ['qa-flags', selectedProductId] });
      queryClient.invalidateQueries({ queryKey: ['qa-flag-counts'] });
      setFlagDialog({ open: false, colorName: '', reason: '' });
    },
    onError: (e: any) => toast.error(e?.message || 'تعذّر حفظ العلامة'),
  });

  const resolveFlagMut = useMutation({
    mutationFn: async (flagId: string) => {
      const { error } = await supabase
        .from('product_color_qa_flags')
        .update({ resolved: true })
        .eq('id', flagId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم وضع العلامة كمُعالَجة');
      queryClient.invalidateQueries({ queryKey: ['qa-flags', selectedProductId] });
      queryClient.invalidateQueries({ queryKey: ['qa-flag-counts'] });
    },
    onError: (e: any) => toast.error(e?.message || 'تعذّر التحديث'),
  });

  const handleReextract = async (product: ProductRow) => {
    if (!product.taobao_url) {
      toast.error('لا يوجد رابط مصدر مخزَّن لهذا المنتج');
      return;
    }
    setRetryingId(product.id);
    try {
      const existingColors = (product.colors || []) as any[];
      const { data, error } = await supabase.functions.invoke('retry-extract-colors', {
        body: { url: product.taobao_url, existingColors },
      });
      if (error) throw error;
      if (!data?.addedColors?.length && data?.mode !== 'replace') {
        toast.info('لم يتم العثور على ألوان جديدة');
        return;
      }
      const { data: defaultsRow } = await supabase
        .from('default_settings')
        .select('setting_value')
        .eq('setting_key', 'product_defaults')
        .maybeSingle();
      const defaults: any = (defaultsRow?.setting_value as any) || {};
      const updated = mergeRetryColors({
        existingColors,
        addedColors: data.addedColors || [],
        mode: data.mode === 'replace' ? 'replace' : 'upsert',
        defaults,
      });
      await adminUpdateProduct(product.id, { colors: updated as any });

      // Auto-resolve all flags for this product after a successful re-extract
      await supabase
        .from('product_color_qa_flags')
        .update({ resolved: true })
        .eq('product_id', product.id)
        .eq('resolved', false);

      toast.success(
        data.mode === 'replace'
          ? `تم تحديث ${updated.length} لون`
          : `تم إضافة ${data.newColorsCount} لون جديد`
      );
      queryClient.invalidateQueries({ queryKey: ['qa-product-search'] });
      queryClient.invalidateQueries({ queryKey: ['qa-flags', product.id] });
      queryClient.invalidateQueries({ queryKey: ['qa-flag-counts'] });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'فشلت إعادة الاستخراج');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <AdminLayout title="فحص جودة ألوان المنتجات">
      <div className="container mx-auto p-4 space-y-4" dir="rtl">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Flag className="h-6 w-6 text-primary" />
              فحص جودة ألوان المنتجات
            </h1>
            <p className="text-sm text-muted-foreground">
              معاينة الألوان لكل منتج، ووضع علامة على أي لون لا يطابق صورته أو رمزه السداسي لإعادة استخراجه.
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث باسم المنتج أو الـ slug…"
                className="pr-10"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          {/* Product list */}
          <Card className="h-fit max-h-[75vh] overflow-auto">
            <CardHeader className="py-3">
              <CardTitle className="text-base">
                المنتجات {searchLoading && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-1">
              {products.length === 0 && !searchLoading && (
                <p className="text-xs text-muted-foreground p-3">لا توجد منتجات</p>
              )}
              {products.map((p) => {
                const count = flagCounts[p.id] || 0;
                const colorsLen = Array.isArray(p.colors) ? p.colors.length : 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProductId(p.id)}
                    className={`w-full text-right flex items-center gap-2 p-2 rounded-md border transition ${
                      selectedProductId === p.id
                        ? 'bg-primary/10 border-primary/40'
                        : 'bg-card hover:bg-muted border-transparent'
                    }`}
                  >
                    <div className="h-10 w-10 rounded-md bg-muted overflow-hidden flex-shrink-0">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageOff className="h-4 w-4 m-auto mt-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{p.name_ar || p.name || p.slug}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {colorsLen} لون
                      </div>
                    </div>
                    {count > 0 && (
                      <Badge variant="destructive" className="h-5 text-[10px]">{count}</Badge>
                    )}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Variant grid */}
          <div>
            {!selectedProduct ? (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  اختر منتجًا من القائمة لمعاينة ألوانه.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="py-3 flex-row items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">
                      {selectedProduct.name_ar || selectedProduct.name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground truncate">
                      /{selectedProduct.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedProduct.taobao_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={selectedProduct.taobao_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 ml-1" />
                          المصدر
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleReextract(selectedProduct)}
                      disabled={retryingId === selectedProduct.id || !selectedProduct.taobao_url}
                    >
                      {retryingId === selectedProduct.id ? (
                        <Loader2 className="h-3.5 w-3.5 ml-1 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 ml-1" />
                      )}
                      إعادة استخراج الكل
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  {(!selectedProduct.colors || selectedProduct.colors.length === 0) ? (
                    <p className="text-sm text-muted-foreground p-4 text-center">
                      لا توجد ألوان مخزَّنة لهذا المنتج.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {selectedProduct.colors.map((c, idx) => {
                        const name = c.name || c.name_ar || `لون ${idx + 1}`;
                        const flag = flagByName.get(name.toLowerCase().trim());
                        const isFlagged = !!flag && !flag.resolved;
                        return (
                          <div
                            key={`${name}-${idx}`}
                            className={`rounded-lg border overflow-hidden bg-card ${
                              isFlagged ? 'ring-2 ring-destructive' : ''
                            }`}
                          >
                            <div className="aspect-square bg-muted relative">
                              {c.image_url ? (
                                <img
                                  src={c.image_url}
                                  alt={name}
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                  <ImageOff className="h-6 w-6 text-muted-foreground" />
                                </div>
                              )}
                              {isFlagged && (
                                <Badge
                                  variant="destructive"
                                  className="absolute top-1 right-1 text-[10px] gap-1"
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  محتاج إعادة
                                </Badge>
                              )}
                            </div>
                            <div className="p-2 space-y-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div
                                  className="h-4 w-4 rounded border flex-shrink-0"
                                  style={c.hex_code ? getColorSwatchStyle(c.hex_code) : { background: 'transparent' }}
                                  title={c.hex_code || 'لا يوجد hex'}
                                />
                                <div className="text-xs truncate" title={name}>{name}</div>
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {c.hex_code || '—'}
                              </div>
                              {flag?.reason && (
                                <p className="text-[10px] text-destructive break-words line-clamp-2">
                                  {flag.reason}
                                </p>
                              )}
                              {isFlagged ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full h-7 text-[11px]"
                                  onClick={() => resolveFlagMut.mutate(flag!.id)}
                                  disabled={resolveFlagMut.isPending}
                                >
                                  <FlagOff className="h-3 w-3 ml-1" />
                                  إلغاء العلامة
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full h-7 text-[11px]"
                                  onClick={() =>
                                    setFlagDialog({ open: true, colorName: name, reason: '' })
                                  }
                                >
                                  <Flag className="h-3 w-3 ml-1" />
                                  وضع علامة
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Debug panel */}
                  {selectedProduct.colors && selectedProduct.colors.length > 0 && (
                    <div className="mt-4 border rounded-lg bg-muted/30">
                      <button
                        type="button"
                        onClick={() => setDebugOpen((v) => !v)}
                        className="w-full flex items-center justify-between gap-2 p-2.5 text-xs font-medium hover:bg-muted/60 transition rounded-t-lg"
                      >
                        <span className="flex items-center gap-1.5">
                          <Bug className="h-3.5 w-3.5 text-primary" />
                          لوحة تصحيح الألوان (Debug)
                          <Badge variant="secondary" className="h-4 text-[10px]">
                            {selectedProduct.colors.length}
                          </Badge>
                          {(() => {
                            const swatchCount = selectedProduct.colors!.filter((c) =>
                              isSwatchUrl(c.image_url)
                            ).length;
                            return swatchCount > 0 ? (
                              <Badge variant="destructive" className="h-4 text-[10px]">
                                {swatchCount} swatch fallback
                              </Badge>
                            ) : null;
                          })()}
                        </span>
                        {debugOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                      {debugOpen && (
                        <div className="p-2 overflow-x-auto">
                          <table className="w-full text-[11px] font-mono">
                            <thead>
                              <tr className="text-muted-foreground border-b">
                                <th className="text-right p-1.5 font-normal">#</th>
                                <th className="text-right p-1.5 font-normal">Raw name</th>
                                <th className="text-right p-1.5 font-normal">Normalized key</th>
                                <th className="text-right p-1.5 font-normal">Hex</th>
                                <th className="text-right p-1.5 font-normal">Image URL</th>
                                <th className="text-right p-1.5 font-normal">Source</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedProduct.colors.map((c, idx) => {
                                const raw = c.name || c.name_ar || '';
                                const key = normalizeVariantName(raw);
                                const swatch = isSwatchUrl(c.image_url);
                                const url = c.image_url || '';
                                return (
                                  <tr key={`dbg-${idx}`} className="border-b border-border/40 hover:bg-muted/40">
                                    <td className="p-1.5 text-muted-foreground">{idx + 1}</td>
                                    <td className="p-1.5 break-all">{raw || <span className="text-muted-foreground">—</span>}</td>
                                    <td className="p-1.5 break-all text-primary">{key || <span className="text-muted-foreground">—</span>}</td>
                                    <td className="p-1.5">
                                      <div className="flex items-center gap-1">
                                        <span
                                          className="inline-block h-3 w-3 rounded border"
                                          style={c.hex_code ? getColorSwatchStyle(c.hex_code) : { background: 'transparent' }}
                                        />
                                        <span>{c.hex_code || '—'}</span>
                                      </div>
                                    </td>
                                    <td className="p-1.5 max-w-[260px]">
                                      {url ? (
                                        <div className="flex items-center gap-1">
                                          <a
                                            href={url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="truncate inline-block max-w-[210px] underline text-primary"
                                            title={url}
                                          >
                                            {url}
                                          </a>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              navigator.clipboard.writeText(url);
                                              toast.success('تم النسخ');
                                            }}
                                            className="text-muted-foreground hover:text-foreground"
                                            title="نسخ"
                                          >
                                            <Copy className="h-3 w-3" />
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </td>
                                    <td className="p-1.5">
                                      {!url ? (
                                        <Badge variant="outline" className="h-4 text-[9px]">none</Badge>
                                      ) : swatch ? (
                                        <Badge variant="destructive" className="h-4 text-[9px]">swatch fallback</Badge>
                                      ) : (
                                        <Badge variant="secondary" className="h-4 text-[9px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                                          main image
                                        </Badge>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <Dialog
          open={flagDialog.open}
          onOpenChange={(o) => setFlagDialog((s) => ({ ...s, open: o }))}
        >
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>وضع علامة على «{flagDialog.colorName}»</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">سبب المشكلة (اختياري)</label>
              <Textarea
                value={flagDialog.reason}
                onChange={(e) =>
                  setFlagDialog((s) => ({ ...s, reason: e.target.value }))
                }
                placeholder="مثال: الصورة لا تطابق اللون / الـ hex خاطئ / مفقود…"
                rows={3}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setFlagDialog({ open: false, colorName: '', reason: '' })}
              >
                إلغاء
              </Button>
              <Button
                onClick={() =>
                  upsertFlagMut.mutate({
                    colorName: flagDialog.colorName,
                    reason: flagDialog.reason,
                  })
                }
                disabled={upsertFlagMut.isPending}
              >
                {upsertFlagMut.isPending && <Loader2 className="h-3.5 w-3.5 ml-1 animate-spin" />}
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminProductColorQa;
