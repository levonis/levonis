import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useCart } from '@/hooks/useCart';
import { Loader2, ShoppingCart, ArrowRight, Package, Shield, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

const ProductDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [selectedImage, setSelectedImage] = useState(0);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name_ar, name)')
        .eq('slug', slug)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) throw new Error('Product not found');
      return data;
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">المنتج غير موجود</h2>
          <Button onClick={() => navigate('/')}>العودة للرئيسية</Button>
        </div>
      </div>
    );
  }

  const hasSale = product.original_price && Number(product.original_price) > Number(product.price);
  const savings = hasSale ? Number(product.original_price) - Number(product.price) : 0;
  
  const productImages = product.images && product.images.length > 0 
    ? product.images 
    : product.image_url 
      ? [product.image_url] 
      : [];
  
  const currency = product.currency || 'ريال';

  const handleAddToCart = () => {
    addToCart(product.id);
    toast.success('تم إضافة المنتج إلى السلة');
  };

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm relative overflow-hidden">
      {/* Decorative elements */}
      <div className="fixed top-20 right-20 w-64 h-64 pointer-events-none opacity-10 animate-float">
        <div className="w-full h-full" style={{ 
          background: 'var(--gradient-radial-gold)',
          clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
          filter: 'blur(30px)'
        }} />
      </div>

      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <button 
            onClick={() => navigate('/')}
            className="hover:text-primary transition-colors"
          >
            الرئيسية
          </button>
          <span>/</span>
          <button 
            onClick={() => navigate('/products')}
            className="hover:text-primary transition-colors"
          >
            المنتجات
          </button>
          <span>/</span>
          <span className="text-foreground">{product.name_ar}</span>
        </div>

        {/* Product Details */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Image Section */}
          <div className="relative">
            <div className="glass-effect rounded-2xl p-6 border border-border/50 card-premium">
              {productImages.length > 0 ? (
                <div className="space-y-4">
                  {/* Main Image */}
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-card/50">
                    <img 
                      src={productImages[selectedImage]} 
                      alt={`${product.name_ar} - صورة ${selectedImage + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {hasSale && (
                      <Badge 
                        className="absolute top-4 left-4 bg-primary text-primary-foreground text-lg px-4 py-2"
                      >
                        خصم {Math.round((savings / Number(product.original_price!)) * 100)}%
                      </Badge>
                    )}
                    {!product.in_stock && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                        <Badge variant="destructive" className="text-lg px-6 py-2">
                          غير متوفر
                        </Badge>
                      </div>
                    )}
                  </div>
                  
                  {/* Thumbnails */}
                  {productImages.length > 1 && (
                    <div className="grid grid-cols-4 gap-2">
                      {productImages.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedImage(idx)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            selectedImage === idx 
                              ? 'border-primary ring-2 ring-primary/20' 
                              : 'border-border/30 hover:border-primary/50'
                          }`}
                        >
                          <img 
                            src={img} 
                            alt={`${product.name_ar} - صورة مصغرة ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative aspect-square rounded-xl overflow-hidden bg-card/50">
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-24 h-24 text-muted-foreground/30" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Details Section */}
          <div className="flex flex-col gap-6">
            <div className="glass-effect rounded-2xl p-6 border border-border/50">
              {/* Category Badge */}
              {product.categories && (
                <Badge variant="outline" className="mb-4">
                  {(product as any).categories.name_ar}
                </Badge>
              )}

              <h1 className="text-4xl font-black text-gradient-gold mb-4">
                {product.name_ar}
              </h1>
              
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                {product.description_ar || 'لا يوجد وصف متوفر'}
              </p>

              {/* Price Section */}
              <div className="border-t border-border/30 pt-6 mb-6">
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-5xl font-black text-primary">
                    {Number(product.price).toFixed(2)}
                  </span>
                  <span className="text-2xl text-muted-foreground">{currency}</span>
                </div>
                
                {hasSale && (
                  <div className="flex items-center gap-3">
                    <span className="text-2xl line-through text-muted-foreground/60">
                      {Number(product.original_price).toFixed(2)} {currency}
                    </span>
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      وفر {savings.toFixed(2)} {currency}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button 
                  size="lg"
                  className="flex-1 bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90 text-lg h-14"
                  onClick={handleAddToCart}
                  disabled={!product.in_stock}
                >
                  <ShoppingCart className="ml-2 h-5 w-5" />
                  {product.in_stock ? 'أضف إلى السلة' : 'غير متوفر'}
                </Button>
                
                <Button 
                  size="lg"
                  variant="outline"
                  className="h-14 px-6"
                  onClick={() => navigate(-1)}
                >
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Features */}
            <div className="glass-effect rounded-2xl p-6 border border-border/50">
              <h3 className="text-xl font-bold text-foreground mb-4">المميزات</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground">ضمان رسمي</h4>
                    <p className="text-sm text-muted-foreground">جميع منتجاتنا بضمان الوكيل المعتمد</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Truck className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground">توصيل سريع</h4>
                    <p className="text-sm text-muted-foreground">خدمة توصيل سريعة لجميع المحافظات</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground">منتج أصلي</h4>
                    <p className="text-sm text-muted-foreground">جميع منتجاتنا أصلية 100%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        {(product.description || product.name) && (
          <div className="glass-effect rounded-2xl p-6 border border-border/50 mb-8">
            <h3 className="text-2xl font-bold text-primary mb-4">معلومات إضافية</h3>
            <div className="prose prose-invert max-w-none">
              <p className="text-muted-foreground leading-relaxed">
                {product.description || product.description_ar}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ProductDetail;
