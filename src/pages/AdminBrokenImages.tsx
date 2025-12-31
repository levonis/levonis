import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { ImageIcon, Loader2, RefreshCw, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import AdminLayout, { AdminSection, AdminStatsGrid, AdminStatCard, AdminLoading, AdminEmptyState, AdminCard, AdminCardHeader, AdminCardContent } from '@/components/admin/AdminLayout';

interface ProductWithImageStatus {
  id: string;
  name_ar: string;
  name: string;
  price: number;
  image_url: string | null;
  images: string[] | null;
  category_name?: string;
  mainImageStatus: 'checking' | 'ok' | 'broken' | 'missing';
  galleryStatus: { url: string; status: 'checking' | 'ok' | 'broken' }[];
}

const AdminBrokenImages = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [products, setProducts] = useState<ProductWithImageStatus[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [reExtractingId, setReExtractingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
      toast.error('ليس لديك صلاحية الوصول');
    }
  }, [user, isAdmin, authLoading, navigate]);

  const { data: allProducts, isLoading } = useQuery({
    queryKey: ['admin-products-for-scan'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ar, name, price, image_url, images, categories(name_ar)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const checkImageUrl = (url: string): Promise<'ok' | 'broken'> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve('ok');
      img.onerror = () => resolve('broken');
      img.src = url;
      setTimeout(() => resolve('broken'), 10000);
    });
  };

  const startScan = async () => {
    if (!allProducts || allProducts.length === 0) {
      toast.error('لا توجد منتجات للفحص');
      return;
    }

    setScanning(true);
    setScanProgress(0);
    
    const productsWithStatus: ProductWithImageStatus[] = [];
    
    for (let i = 0; i < allProducts.length; i++) {
      const product = allProducts[i];
      const productStatus: ProductWithImageStatus = {
        id: product.id,
        name_ar: product.name_ar,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        images: product.images,
        category_name: (product as any).categories?.name_ar,
        mainImageStatus: 'checking',
        galleryStatus: []
      };

      if (!product.image_url) {
        productStatus.mainImageStatus = 'missing';
      } else {
        productStatus.mainImageStatus = await checkImageUrl(product.image_url);
      }

      if (product.images && Array.isArray(product.images)) {
        for (const imgUrl of product.images) {
          const status = await checkImageUrl(imgUrl);
          productStatus.galleryStatus.push({ url: imgUrl, status });
        }
      }

      productsWithStatus.push(productStatus);
      setScanProgress(Math.round(((i + 1) / allProducts.length) * 100));
    }

    const problemProducts = productsWithStatus.filter(p => 
      p.mainImageStatus === 'broken' || 
      p.mainImageStatus === 'missing' ||
      p.galleryStatus.some(g => g.status === 'broken')
    );

    setProducts(problemProducts);
    setScanning(false);
    
    if (problemProducts.length === 0) {
      toast.success('جميع صور المنتجات سليمة!');
    } else {
      toast.warning(`تم اكتشاف ${problemProducts.length} منتج بصور مفقودة أو تالفة`);
    }
  };

  const handleReExtractImages = async (product: ProductWithImageStatus) => {
    const productUrl = prompt('أدخل رابط المنتج الأصلي لإعادة استخراج الصور:');
    if (!productUrl || !productUrl.trim()) {
      return;
    }

    setReExtractingId(product.id);
    try {
      const response = await supabase.functions.invoke('extract-product-info', {
        body: { url: productUrl.trim() }
      });

      if (response.error) {
        throw new Error(response.error.message || 'فشل في استخراج الصور');
      }

      const { productInfo } = response.data;
      
      if (!productInfo || !productInfo.images || productInfo.images.length === 0) {
        throw new Error('لم يتم العثور على صور للمنتج');
      }

      const newImages = productInfo.images;
      const { error: updateError } = await supabase
        .from('products')
        .update({
          images: newImages,
          image_url: newImages[0] || product.image_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id);

      if (updateError) throw updateError;

      setProducts(prev => prev.filter(p => p.id !== product.id));
      
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products-for-scan'] });

      toast.success(`تم تحديث صور المنتج بنجاح! (${newImages.length} صور)`);
    } catch (error) {
      console.error('Error re-extracting images:', error);
      toast.error(error instanceof Error ? error.message : 'حدث خطأ أثناء استخراج الصور');
    } finally {
      setReExtractingId(null);
    }
  };

  const brokenCount = products.filter(p => p.mainImageStatus === 'broken' || p.galleryStatus.some(g => g.status === 'broken')).length;
  const missingCount = products.filter(p => p.mainImageStatus === 'missing').length;

  if (authLoading || isLoading) {
    return (
      <AdminLayout title="فحص الصور المفقودة" icon={<ImageIcon className="h-5 w-5" />}>
        <AdminLoading />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="فحص الصور المفقودة"
      icon={<ImageIcon className="h-5 w-5" />}
      description="اكتشاف وإصلاح صور المنتجات التالفة"
      actions={
        <Button onClick={startScan} disabled={scanning} className="admin-btn-primary gap-2">
          {scanning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {scanning ? 'جاري الفحص...' : 'بدء الفحص'}
        </Button>
      }
    >
      {/* Progress */}
      {scanning && (
        <AdminCard className="mb-6">
          <AdminCardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>جاري فحص الصور...</span>
                <span>{scanProgress}%</span>
              </div>
              <Progress value={scanProgress} className="h-2" />
            </div>
          </AdminCardContent>
        </AdminCard>
      )}

      {/* Stats */}
      {products.length > 0 && (
        <AdminStatsGrid>
          <AdminStatCard
            icon={<XCircle className="h-5 w-5" />}
            value={brokenCount}
            label="صور تالفة"
            colorClass="text-red-600"
            bgClass="bg-red-500/10"
          />
          <AdminStatCard
            icon={<AlertTriangle className="h-5 w-5" />}
            value={missingCount}
            label="صور مفقودة"
            colorClass="text-yellow-600"
            bgClass="bg-yellow-500/10"
          />
          <AdminStatCard
            icon={<ImageIcon className="h-5 w-5" />}
            value={products.length}
            label="منتج يحتاج إصلاح"
            colorClass="text-primary"
            bgClass="bg-primary/10"
          />
        </AdminStatsGrid>
      )}

      {/* Results */}
      {!scanning && products.length === 0 && allProducts && allProducts.length > 0 && (
        <AdminEmptyState
          icon={<CheckCircle2 className="h-12 w-12 text-green-500" />}
          title="جميع الصور سليمة"
          description="اضغط على 'بدء الفحص' للتحقق من صور المنتجات"
        />
      )}

      {products.length > 0 && (
        <AdminSection className="mt-6">
          <AdminCard>
            <AdminCardHeader 
              title="المنتجات ذات الصور المشكلة"
              icon={<AlertTriangle className="h-5 w-5" />}
              description="انقر على زر إعادة الاستخراج لتحديث صور المنتج من الرابط الأصلي"
            />
            <AdminCardContent noPadding>
              <div className="admin-table-wrapper">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الصورة</TableHead>
                      <TableHead>الاسم</TableHead>
                      <TableHead>القسم</TableHead>
                      <TableHead>السعر</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead className="text-left">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                            {product.image_url ? (
                              <img 
                                src={product.image_url} 
                                alt={product.name_ar}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <ImageIcon className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{product.name_ar}</TableCell>
                        <TableCell>{product.category_name || '-'}</TableCell>
                        <TableCell>{formatPrice(Number(product.price))} د.ع</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {product.mainImageStatus === 'missing' && (
                              <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                الصورة الرئيسية مفقودة
                              </Badge>
                            )}
                            {product.mainImageStatus === 'broken' && (
                              <Badge variant="destructive">
                                الصورة الرئيسية تالفة
                              </Badge>
                            )}
                            {product.galleryStatus.filter(g => g.status === 'broken').length > 0 && (
                              <Badge variant="outline" className="text-destructive border-destructive">
                                {product.galleryStatus.filter(g => g.status === 'broken').length} صور معرض تالفة
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-left">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReExtractImages(product)}
                            disabled={reExtractingId === product.id}
                            className="gap-2"
                          >
                            {reExtractingId === product.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                            إعادة استخراج
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </AdminCardContent>
          </AdminCard>
        </AdminSection>
      )}
    </AdminLayout>
  );
};

export default AdminBrokenImages;
