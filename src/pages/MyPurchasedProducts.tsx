import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Truck, CheckCircle, Clock, ShoppingBag, Gift, Store, Loader2, ArrowRight, History, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import OptimizedImage from "@/components/OptimizedImage";

interface PurchasedProduct {
  id: string;
  user_id: string;
  product_id: string | null;
  competition_id: string | null;
  product_name: string;
  product_name_ar: string;
  product_image: string | null;
  product_price: number;
  gift_tickets: number;
  source_type: 'purchase' | 'prize' | 'gift';
  order_status: 'not_ordered' | 'ordered' | 'shipped' | 'delivered' | 'cancelled';
  order_id: string | null;
  listed_in_marketplace: boolean;
  marketplace_listing_id: string | null;
  currency: string;
  purchased_at: string;
  ordered_at: string | null;
  delivered_at: string | null;
}

const statusLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  not_ordered: { label: 'لم يُطلب', color: 'bg-gray-500', icon: <Clock className="h-3 w-3" /> },
  ordered: { label: 'تم الطلب', color: 'bg-blue-500', icon: <ShoppingBag className="h-3 w-3" /> },
  shipped: { label: 'تم الشحن', color: 'bg-orange-500', icon: <Truck className="h-3 w-3" /> },
  delivered: { label: 'تم التوصيل', color: 'bg-green-500', icon: <CheckCircle className="h-3 w-3" /> },
  cancelled: { label: 'ملغي', color: 'bg-red-500', icon: <AlertCircle className="h-3 w-3" /> },
};

const sourceLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  purchase: { label: 'مشتري', icon: <ShoppingBag className="h-3 w-3" /> },
  prize: { label: 'جائزة', icon: <Gift className="h-3 w-3" /> },
  gift: { label: 'هدية', icon: <Gift className="h-3 w-3" /> },
};

export default function MyPurchasedProducts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showListDialog, setShowListDialog] = useState(false);
  const [productToList, setProductToList] = useState<PurchasedProduct | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  // Fetch user's purchased products
  const { data: products, isLoading } = useQuery({
    queryKey: ['my-purchased-products', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_purchased_products')
        .select('*')
        .eq('user_id', user.id)
        .order('purchased_at', { ascending: false });
      
      if (error) throw error;
      return data as PurchasedProduct[];
    },
    enabled: !!user,
  });

  // Request delivery mutation
  const requestDeliveryMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      const { data, error } = await supabase.rpc('request_product_delivery', {
        p_product_ids: productIds
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast.success(data.message);
        queryClient.invalidateQueries({ queryKey: ['my-purchased-products'] });
        setSelectedProducts([]);
        setShowRequestDialog(false);
      } else {
        toast.error(data.error);
      }
    },
    onError: (error) => {
      toast.error('حدث خطأ: ' + error.message);
    }
  });

  // Filter products by status
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (activeTab === 'all') return products;
    return products.filter(p => p.order_status === activeTab);
  }, [products, activeTab]);

  // Products available for ordering
  const availableForOrder = useMemo(() => {
    return products?.filter(p => p.order_status === 'not_ordered' && !p.listed_in_marketplace) || [];
  }, [products]);

  // Toggle product selection
  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // Select all available products
  const selectAll = () => {
    setSelectedProducts(availableForOrder.map(p => p.id));
  };

  // Handle list in marketplace
  const handleListInMarketplace = (product: PurchasedProduct) => {
    // Navigate to marketplace with product info
    navigate('/marketplace', { 
      state: { 
        prefillListing: {
          title: product.product_name,
          title_ar: product.product_name_ar,
          images: product.product_image ? [product.product_image] : [],
          price: product.product_price,
          sourceProductId: product.id
        }
      }
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6 text-center">
          <p className="text-muted-foreground mb-4">يجب تسجيل الدخول لعرض منتجاتك</p>
          <Button onClick={() => navigate('/auth')}>تسجيل الدخول</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold">منتجاتي</h1>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6">
        {/* Bulk Actions */}
        {availableForOrder.length > 0 && (
          <Card className="mb-4 border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={selectedProducts.length === availableForOrder.length && availableForOrder.length > 0}
                      onCheckedChange={() => {
                        if (selectedProducts.length === availableForOrder.length) {
                          setSelectedProducts([]);
                        } else {
                          selectAll();
                        }
                      }}
                    />
                    <span className="text-sm">تحديد الكل ({availableForOrder.length})</span>
                  </div>
                  {selectedProducts.length > 0 && (
                    <Badge variant="secondary">{selectedProducts.length} محدد</Badge>
                  )}
                </div>
                <Button 
                  size="sm"
                  disabled={selectedProducts.length === 0 || requestDeliveryMutation.isPending}
                  onClick={() => setShowRequestDialog(true)}
                  className="gap-1"
                >
                  {requestDeliveryMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Truck className="h-4 w-4" />
                  )}
                  طلب التوصيل ({selectedProducts.length})
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-5 mb-4">
            <TabsTrigger value="all" className="text-xs">الكل</TabsTrigger>
            <TabsTrigger value="not_ordered" className="text-xs">لم يُطلب</TabsTrigger>
            <TabsTrigger value="ordered" className="text-xs">مطلوب</TabsTrigger>
            <TabsTrigger value="shipped" className="text-xs">شُحن</TabsTrigger>
            <TabsTrigger value="delivered" className="text-xs">وصل</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <Card className="text-center py-8">
                <CardContent className="pt-6">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">لا توجد منتجات</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => navigate('/competitions')}
                  >
                    تصفح المنتجات
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((product) => (
                  <Card key={product.id} className="overflow-hidden">
                    <div className="relative">
                      {product.product_image ? (
                        <OptimizedImage
                          src={product.product_image}
                          alt={product.product_name_ar}
                          className="w-full h-40 object-cover"
                        />
                      ) : (
                        <div className="w-full h-40 bg-secondary flex items-center justify-center">
                          <Package className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      
                      {/* Status Badge */}
                      <Badge className={`absolute top-2 right-2 ${statusLabels[product.order_status].color} text-white gap-1`}>
                        {statusLabels[product.order_status].icon}
                        {statusLabels[product.order_status].label}
                      </Badge>
                      
                      {/* Source Badge */}
                      <Badge variant="secondary" className="absolute top-2 left-2 gap-1">
                        {sourceLabels[product.source_type].icon}
                        {sourceLabels[product.source_type].label}
                      </Badge>

                      {/* Selection Checkbox */}
                      {product.order_status === 'not_ordered' && !product.listed_in_marketplace && (
                        <div className="absolute bottom-2 right-2">
                          <Checkbox 
                            checked={selectedProducts.includes(product.id)}
                            onCheckedChange={() => toggleProductSelection(product.id)}
                            className="bg-background/80"
                          />
                        </div>
                      )}
                    </div>

                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm mb-1 line-clamp-2">{product.product_name_ar}</h3>
                      
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-bold text-primary">
                          {product.product_price.toLocaleString()} {product.currency}
                        </span>
                        {product.gift_tickets > 0 && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Gift className="h-3 w-3" />
                            {product.gift_tickets} تذكرة هدية
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(product.purchased_at), 'dd MMM yyyy', { locale: ar })}
                      </p>

                      {/* Actions */}
                      <div className="flex gap-2 mt-3">
                        {product.order_status === 'not_ordered' && !product.listed_in_marketplace && (
                          <>
                            <Button 
                              size="sm" 
                              className="flex-1 gap-1"
                              onClick={() => {
                                setSelectedProducts([product.id]);
                                setShowRequestDialog(true);
                              }}
                            >
                              <Truck className="h-3 w-3" />
                              طلب
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="gap-1"
                              onClick={() => handleListInMarketplace(product)}
                            >
                              <Store className="h-3 w-3" />
                              بيع
                            </Button>
                          </>
                        )}
                        {product.listed_in_marketplace && (
                          <Badge variant="secondary" className="w-full justify-center">
                            معروض في السوق
                          </Badge>
                        )}
                        {product.order_status !== 'not_ordered' && !product.listed_in_marketplace && (
                          <Badge variant="outline" className="w-full justify-center">
                            {product.ordered_at && `طُلب: ${format(new Date(product.ordered_at), 'dd MMM', { locale: ar })}`}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Footer />

      {/* Request Delivery Dialog */}
      <AlertDialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              طلب توصيل المنتجات
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              سيتم تسجيل طلب توصيل لـ <span className="font-bold">{selectedProducts.length} منتج</span>.
              <br />
              <span className="text-sm">سيتم التواصل معك لتأكيد العنوان وتفاصيل الشحن.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction
              onClick={() => requestDeliveryMutation.mutate(selectedProducts)}
              disabled={requestDeliveryMutation.isPending}
            >
              {requestDeliveryMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : null}
              تأكيد الطلب
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
