import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Package, Truck, CheckCircle, Clock, ShoppingBag, Gift, Store, Loader2, ArrowRight, ChevronDown, ChevronUp, Minus, Plus, PackageCheck, PackageX } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import OptimizedImage from "@/components/OptimizedImage";
import ShipmentTrackingTimeline from "@/components/ShipmentTrackingTimeline";

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
  shipped_at: string | null;
  shipment_request_id: string | null;
  updated_at: string;
  created_at: string;
}

interface AggregatedProduct {
  key: string;
  product_name: string;
  product_name_ar: string;
  product_image: string | null;
  product_price: number;
  currency: string;
  totalQuantity: number;
  availableForOrder: number;
  items: PurchasedProduct[];
  latestStatus: string;
  latestUpdate: string;
}

const statusLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  not_ordered: { label: 'لم يُطلب', color: 'bg-gray-500', icon: <Clock className="h-3 w-3" /> },
  ordered: { label: 'تم الطلب', color: 'bg-blue-500', icon: <ShoppingBag className="h-3 w-3" /> },
  shipped: { label: 'تم الشحن', color: 'bg-orange-500', icon: <Truck className="h-3 w-3" /> },
  delivered: { label: 'تم التوصيل', color: 'bg-green-500', icon: <CheckCircle className="h-3 w-3" /> },
  cancelled: { label: 'ملغي', color: 'bg-red-500', icon: <PackageX className="h-3 w-3" /> },
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
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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

  // Fetch shipment requests for tracking
  const { data: shipmentRequests } = useQuery({
    queryKey: ['my-shipment-requests', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('shipment_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
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
        queryClient.invalidateQueries({ queryKey: ['my-shipment-requests'] });
        setSelectedQuantities({});
        setShowRequestDialog(false);
      } else {
        toast.error(data.error);
      }
    },
    onError: (error) => {
      toast.error('حدث خطأ: ' + error.message);
    }
  });

  // Aggregate products by name and image
  const aggregatedProducts = useMemo(() => {
    if (!products) return [];
    
    const grouped: Record<string, AggregatedProduct> = {};
    
    products.forEach(product => {
      const key = `${product.product_name_ar}-${product.product_image || 'no-image'}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          key,
          product_name: product.product_name,
          product_name_ar: product.product_name_ar,
          product_image: product.product_image,
          product_price: product.product_price,
          currency: product.currency,
          totalQuantity: 0,
          availableForOrder: 0,
          items: [],
          latestStatus: product.order_status,
          latestUpdate: product.updated_at || product.purchased_at,
        };
      }
      
      grouped[key].totalQuantity++;
      grouped[key].items.push(product);
      
      if (product.order_status === 'not_ordered' && !product.listed_in_marketplace) {
        grouped[key].availableForOrder++;
      }
      
      // Update latest status based on most recent item
      const currentDate = new Date(product.updated_at || product.purchased_at);
      const latestDate = new Date(grouped[key].latestUpdate);
      if (currentDate > latestDate) {
        grouped[key].latestStatus = product.order_status;
        grouped[key].latestUpdate = product.updated_at || product.purchased_at;
      }
    });
    
    return Object.values(grouped).sort((a, b) => 
      new Date(b.latestUpdate).getTime() - new Date(a.latestUpdate).getTime()
    );
  }, [products]);

  // Filter aggregated products by status
  const filteredProducts = useMemo(() => {
    if (activeTab === 'all') return aggregatedProducts;
    return aggregatedProducts.filter(group => 
      group.items.some(item => item.order_status === activeTab)
    );
  }, [aggregatedProducts, activeTab]);

  // Total available for order
  const totalAvailableForOrder = useMemo(() => {
    return aggregatedProducts.reduce((sum, g) => sum + g.availableForOrder, 0);
  }, [aggregatedProducts]);

  // Total selected items
  const totalSelected = useMemo(() => {
    return Object.values(selectedQuantities).reduce((sum, q) => sum + q, 0);
  }, [selectedQuantities]);

  // Get selected product IDs for the request
  const getSelectedProductIds = () => {
    const ids: string[] = [];
    
    Object.entries(selectedQuantities).forEach(([key, quantity]) => {
      const group = aggregatedProducts.find(g => g.key === key);
      if (group) {
        const availableItems = group.items.filter(
          item => item.order_status === 'not_ordered' && !item.listed_in_marketplace
        );
        ids.push(...availableItems.slice(0, quantity).map(item => item.id));
      }
    });
    
    return ids;
  };

  // Update quantity for a group
  const updateQuantity = (key: string, delta: number) => {
    const group = aggregatedProducts.find(g => g.key === key);
    if (!group) return;
    
    setSelectedQuantities(prev => {
      const current = prev[key] || 0;
      const newQty = Math.max(0, Math.min(current + delta, group.availableForOrder));
      
      if (newQty === 0) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: newQty };
    });
  };

  // Toggle group expansion
  const toggleExpand = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Select all
  const selectAll = () => {
    const newQuantities: Record<string, number> = {};
    aggregatedProducts.forEach(group => {
      if (group.availableForOrder > 0) {
        newQuantities[group.key] = group.availableForOrder;
      }
    });
    setSelectedQuantities(newQuantities);
  };

  // Handle list in marketplace
  const handleListInMarketplace = (product: PurchasedProduct) => {
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
              <Badge variant="secondary" className="text-xs">
                {products?.length || 0} منتج
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6">
        {/* Bulk Actions */}
        {totalAvailableForOrder > 0 && (
          <Card className="mb-4 border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      if (totalSelected === totalAvailableForOrder) {
                        setSelectedQuantities({});
                      } else {
                        selectAll();
                      }
                    }}
                  >
                    {totalSelected === totalAvailableForOrder ? 'إلغاء التحديد' : `تحديد الكل (${totalAvailableForOrder})`}
                  </Button>
                  {totalSelected > 0 && (
                    <Badge variant="secondary">{totalSelected} محدد</Badge>
                  )}
                </div>
                <Button 
                  size="sm"
                  disabled={totalSelected === 0 || requestDeliveryMutation.isPending}
                  onClick={() => setShowRequestDialog(true)}
                  className="gap-1"
                >
                  {requestDeliveryMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Truck className="h-4 w-4" />
                  )}
                  طلب التوصيل ({totalSelected})
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
                    تصفح العروض
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredProducts.map((group) => (
                  <Collapsible 
                    key={group.key} 
                    open={expandedGroups.has(group.key)}
                    onOpenChange={() => toggleExpand(group.key)}
                  >
                    <Card className="overflow-hidden">
                      <div className="flex gap-4 p-4">
                        {/* Product Image */}
                        <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-secondary">
                          {group.product_image ? (
                            <OptimizedImage
                              src={group.product_image}
                              alt={group.product_name_ar}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          <Badge className="absolute -top-1 -right-1 text-xs px-1.5 py-0.5">
                            {group.totalQuantity}
                          </Badge>
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm line-clamp-2 mb-1">
                            {group.product_name_ar}
                          </h3>
                          
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={`${statusLabels[group.latestStatus].color} text-white text-xs gap-1`}>
                              {statusLabels[group.latestStatus].icon}
                              {statusLabels[group.latestStatus].label}
                            </Badge>
                            <span className="text-sm font-medium text-primary">
                              {group.product_price.toLocaleString()} {group.currency}
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground">
                            آخر تحديث: {format(new Date(group.latestUpdate), 'dd MMM yyyy', { locale: ar })}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col items-end gap-2">
                          {group.availableForOrder > 0 && (
                            <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQuantity(group.key, -1);
                                }}
                                disabled={(selectedQuantities[group.key] || 0) === 0}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center text-sm font-medium">
                                {selectedQuantities[group.key] || 0}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQuantity(group.key, 1);
                                }}
                                disabled={(selectedQuantities[group.key] || 0) >= group.availableForOrder}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-1 text-xs">
                              التفاصيل
                              {expandedGroups.has(group.key) ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      <CollapsibleContent>
                        <div className="border-t px-4 py-3 bg-muted/30">
                          <p className="text-xs text-muted-foreground mb-3">
                            {group.totalQuantity} وحدة • {group.availableForOrder} متاح للتوصيل
                          </p>

                          {/* Show tracking timeline if any item is ordered */}
                          {group.items.some(item => item.order_status !== 'not_ordered' && item.shipment_request_id) && (
                            <div className="mb-4">
                              <ShipmentTrackingTimeline 
                                shipmentRequest={shipmentRequests?.find(
                                  sr => sr.id === group.items.find(i => i.shipment_request_id)?.shipment_request_id
                                )}
                              />
                            </div>
                          )}

                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {group.items.map((item) => (
                              <div 
                                key={item.id} 
                                className="flex items-center justify-between p-2 bg-background rounded-lg text-sm"
                              >
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs gap-1">
                                    {sourceLabels[item.source_type].icon}
                                    {sourceLabels[item.source_type].label}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(item.purchased_at), 'dd/MM/yyyy', { locale: ar })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className={`${statusLabels[item.order_status].color} text-white text-xs`}>
                                    {statusLabels[item.order_status].label}
                                  </Badge>
                                  {item.order_status === 'not_ordered' && !item.listed_in_marketplace && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs gap-1"
                                      onClick={() => handleListInMarketplace(item)}
                                    >
                                      <Store className="h-3 w-3" />
                                      بيع
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
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
              <PackageCheck className="h-5 w-5 text-primary" />
              تأكيد طلب التوصيل
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right space-y-3">
              <p>ستقوم بطلب توصيل <span className="font-bold text-foreground">{totalSelected} منتج</span></p>
              
              <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
                {Object.entries(selectedQuantities).map(([key, qty]) => {
                  const group = aggregatedProducts.find(g => g.key === key);
                  if (!group || qty === 0) return null;
                  return (
                    <div key={key} className="flex justify-between">
                      <span className="line-clamp-1">{group.product_name_ar}</span>
                      <Badge variant="secondary">{qty} قطعة</Badge>
                    </div>
                  );
                })}
              </div>
              
              <p className="text-sm text-muted-foreground">
                سيتم التواصل معك لتأكيد العنوان وتفاصيل الشحن.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction
              onClick={() => requestDeliveryMutation.mutate(getSelectedProductIds())}
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
