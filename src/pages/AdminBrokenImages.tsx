import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { ArrowRight, ImageIcon, Loader2, RefreshCw, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

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
      // Timeout after 10 seconds
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

      // Check main image
      if (!product.image_url) {
        productStatus.mainImageStatus = 'missing';
      } else {
        productStatus.mainImageStatus = await checkImageUrl(product.image_url);
      }

      // Check gallery images
      if (product.images && Array.isArray(product.images)) {
        for (const imgUrl of product.images) {
          const status = await checkImageUrl(imgUrl);
          productStatus.galleryStatus.push({ url: imgUrl, status });
        }
      }

      productsWithStatus.push(productStatus);
      setScanProgress(Math.round(((i + 1) / allProducts.length) * 100));
    }

    // Filter to only show products with issues
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

      // Remove from list after successful update
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowRight className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">فحص الصور المفقودة</h1>
              <p className="text-muted-foreground text-sm mt-1">اكتشاف وإصلاح صور المنتجات التالفة</p>
            </div>
          </div>
          
          <Button 
            onClick={startScan} 
            disabled={scanning}
            className="gap-2"
          >
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {scanning ? 'جاري الفحص...' : 'بدء الفحص'}
          </Button>
        </div>

        {/* Progress */}
        {scanning && (
          <Card className="mb-6 border-primary/20">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>جاري فحص الصور...</span>
                  <span>{scanProgress}%</span>
                </div>
                <Progress value={scanProgress} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        {products.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-destructive/10">
                    <XCircle className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-destructive">{brokenCount}</p>
                    <p className="text-sm text-muted-foreground">صور تالفة</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-warning/10">
                    <AlertTriangle className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-600">{missingCount}</p>
                    <p className="text-sm text-muted-foreground">صور مفقودة</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <ImageIcon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">{products.length}</p>
                    <p className="text-sm text-muted-foreground">منتج يحتاج إصلاح</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results */}
        {!scanning && products.length === 0 && allProducts && allProducts.length > 0 && (
          <Card className="border-primary/20">
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">جميع الصور سليمة</h3>
              <p className="text-muted-foreground">اضغط على "بدء الفحص" للتحقق من صور المنتجات</p>
            </CardContent>
          </Card>
        )}

        {products.length > 0 && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                المنتجات ذات الصور المشكلة
              </CardTitle>
              <CardDescription>
                انقر على زر إعادة الاستخراج لتحديث صور المنتج من الرابط الأصلي
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الصورة الحالية</TableHead>
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminBrokenImages;
