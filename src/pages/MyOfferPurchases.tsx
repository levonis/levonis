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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Truck, CheckCircle, Clock, ShoppingBag, Gift, Store, Loader2, ArrowRight, ChevronDown, ChevronUp, History, AlertCircle, MapPin, FileText } from "lucide-react";
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
  shipped_at: string | null;
  delivered_at: string | null;
  shipment_request_id: string | null;
}

interface GroupedProduct {
  key: string;
  product_name_ar: string;
  product_image: string | null;
  product_price: number;
  currency: string;
  items: PurchasedProduct[];
  totalQuantity: number;
  notOrderedCount: number;
  orderedCount: number;
  shippedCount: number;
  deliveredCount: number;
  latestUpdate: string;
}

interface ShipmentRequest {
  id: string;
  status: string;
  tracking_number: string | null;
  shipping_address: string | null;
  phone_number: string | null;
  admin_notes: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

const statusLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  not_ordered: { label: 'لم يُطلب', color: 'bg-gray-500', icon: <Clock className="h-3 w-3" /> },
  ordered: { label: 'تم الطلب', color: 'bg-blue-500', icon: <ShoppingBag className="h-3 w-3" /> },
  shipped: { label: 'تم الشحن', color: 'bg-orange-500', icon: <Truck className="h-3 w-3" /> },
  delivered: { label: 'تم التوصيل', color: 'bg-green-500', icon: <CheckCircle className="h-3 w-3" /> },
  cancelled: { label: 'ملغي', color: 'bg-red-500', icon: <AlertCircle className="h-3 w-3" /> },
  pending: { label: 'قيد الانتظار', color: 'bg-amber-500', icon: <Clock className="h-3 w-3" /> },
  processing: { label: 'قيد المعالجة', color: 'bg-blue-500', icon: <Package className="h-3 w-3" /> },
};

const sourceLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  purchase: { label: 'مشتري', icon: <ShoppingBag className="h-3 w-3" /> },
  prize: { label: 'جائزة', icon: <Gift className="h-3 w-3" /> },
  gift: { label: 'هدية', icon: <Gift className="h-3 w-3" /> },
};

export default function MyOfferPurchases() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showTrackingDialog, setShowTrackingDialog] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<ShipmentRequest | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

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

  // Fetch shipment requests
  const { data: shipments } = useQuery({
    queryKey: ['my-shipment-requests', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('shipment_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ShipmentRequest[];
    },
    enabled: !!user,
  });

  // Group products by product_name_ar (since we may not have product_id)
  const groupedProducts = useMemo(() => {
    if (!products) return [];
    
    const groups: Record<string, GroupedProduct> = {};
    
    products.forEach(product => {
      const key = product.product_name_ar || product.product_name || product.id;
      
      if (!groups[key]) {
        groups[key] = {
          key,
          product_name_ar: product.product_name_ar,
          product_image: product.product_image,
          product_price: product.product_price,
          currency: product.currency,
          items: [],
          totalQuantity: 0,
          notOrderedCount: 0,
          orderedCount: 0,
          shippedCount: 0,
          deliveredCount: 0,
          latestUpdate: product.purchased_at,
        };
      }
      
      groups[key].items.push(product);
      groups[key].totalQuantity++;
      
      switch (product.order_status) {
        case 'not_ordered': groups[key].notOrderedCount++; break;
        case 'ordered': groups[key].orderedCount++; break;
        case 'shipped': groups[key].shippedCount++; break;
        case 'delivered': groups[key].deliveredCount++; break;
      }
      
      // Track latest update
      const updateDate = product.delivered_at || product.shipped_at || product.ordered_at || product.purchased_at;
      if (updateDate > groups[key].latestUpdate) {
        groups[key].latestUpdate = updateDate;
      }
    });
    
    return Object.values(groups).sort((a, b) => 
      new Date(b.latestUpdate).getTime() - new Date(a.latestUpdate).getTime()
    );
  }, [products]);

  // Filter groups by status
  const filteredGroups = useMemo(() => {
    if (activeTab === 'all') return groupedProducts;
    return groupedProducts.filter(g => {
      switch (activeTab) {
        case 'not_ordered': return g.notOrderedCount > 0;
        case 'ordered': return g.orderedCount > 0;
        case 'shipped': return g.shippedCount > 0;
        case 'delivered': return g.deliveredCount > 0;
        default: return true;
      }
    });
  }, [groupedProducts, activeTab]);

  // Calculate total available for order
  const totalAvailableForOrder = useMemo(() => {
    return products?.filter(p => p.order_status === 'not_ordered' && !p.listed_in_marketplace).length || 0;
  }, [products]);

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
        setSelectedItems({});
        setShowRequestDialog(false);
      } else {
        toast.error(data.error);
      }
    },
    onError: (error) => {
      toast.error('حدث خطأ: ' + error.message);
    }
  });

  // Get selected product IDs based on quantity selection
  const getSelectedProductIds = (): string[] => {
    const ids: string[] = [];
    
    Object.entries(selectedItems).forEach(([groupKey, quantity]) => {
      const group = groupedProducts.find(g => g.key === groupKey);
      if (group) {
        const availableItems = group.items.filter(
          i => i.order_status === 'not_ordered' && !i.listed_in_marketplace
        );
        for (let i = 0; i < Math.min(quantity, availableItems.length); i++) {
          ids.push(availableItems[i].id);
        }
      }
    });
    
    return ids;
  };

  const totalSelectedCount = Object.values(selectedItems).reduce((a, b) => a + b, 0);

  // Toggle group expansion
  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Update quantity selection
  const updateQuantity = (groupKey: string, quantity: number) => {
    if (quantity <= 0) {
      setSelectedItems(prev => {
        const next = { ...prev };
        delete next[groupKey];
        return next;
      });
    } else {
      setSelectedItems(prev => ({ ...prev, [groupKey]: quantity }));
    }
  };

  // View shipment tracking
  const viewShipmentTracking = (shipmentId: string) => {
    const shipment = shipments?.find(s => s.id === shipmentId);
    if (shipment) {
      setSelectedShipment(shipment);
      setShowTrackingDialog(true);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6 text-center">
          <p className="text-muted-foreground mb-4">يجب تسجيل الدخول لعرض مشترياتك</p>
          <Button onClick={() => navigate('/auth')}>تسجيل الدخول</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background w-full overflow-x-hidden" dir="rtl">
      {/* Header */}
      <div className="sticky top-16 z-40 bg-card/95 backdrop-blur border-b w-full">
        <div className="container mx-auto px-4 py-3 max-w-4xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold">مشترياتي</h1>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-4xl w-full">
        {/* Bulk Actions */}
        {totalAvailableForOrder > 0 && (
          <Card className="mb-4 border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {totalAvailableForOrder} منتج متاح للشحن
                  </span>
                  {totalSelectedCount > 0 && (
                    <Badge variant="secondary">{totalSelectedCount} محدد</Badge>
                  )}
                </div>
                <Button 
                  size="sm"
                  disabled={totalSelectedCount === 0 || requestDeliveryMutation.isPending}
                  onClick={() => setShowRequestDialog(true)}
                  className="gap-1"
                >
                  {requestDeliveryMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Truck className="h-4 w-4" />
                  )}
                  طلب الشحن ({totalSelectedCount})
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shipment Requests Summary */}
        {shipments && shipments.length > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                طلبات الشحن
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="w-full">
                <div className="flex gap-2 pb-2">
                  {shipments.slice(0, 5).map(shipment => (
                    <Button
                      key={shipment.id}
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1"
                      onClick={() => viewShipmentTracking(shipment.id)}
                    >
                      <Badge className={`${statusLabels[shipment.status]?.color || 'bg-gray-500'} text-white`}>
                        {statusLabels[shipment.status]?.label}
                      </Badge>
                      <span className="text-xs">{statusLabels[shipment.status]?.label}</span>
                      {shipment.tracking_number && (
                        <MapPin className="h-3 w-3 text-primary" />
                      )}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
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
            ) : filteredGroups.length === 0 ? (
              <Card className="text-center py-8">
                <CardContent className="pt-6">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">لا توجد منتجات</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => navigate('/product-offers')}
                  >
                    تصفح العروض
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredGroups.map((group) => {
                  const isExpanded = expandedGroups.includes(group.key);
                  const availableCount = group.notOrderedCount;
                  const selectedQty = selectedItems[group.key] || 0;

                  return (
                    <Card key={group.key} className="overflow-hidden">
                      <Collapsible open={isExpanded} onOpenChange={() => toggleGroup(group.key)}>
                        <div className="p-3 flex items-center gap-3">
                          {/* Product Image */}
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-secondary shrink-0">
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
                          </div>

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm line-clamp-1">{group.product_name_ar}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              الكمية: {group.totalQuantity} | 
                              {group.product_price.toLocaleString()} {group.currency}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {group.notOrderedCount > 0 && (
                                <Badge variant="outline" className="text-[10px] py-0">
                                  {group.notOrderedCount} لم يُطلب
                                </Badge>
                              )}
                              {group.orderedCount > 0 && (
                                <Badge className="bg-blue-500 text-white text-[10px] py-0">
                                  {group.orderedCount} مطلوب
                                </Badge>
                              )}
                              {group.shippedCount > 0 && (
                                <Badge className="bg-orange-500 text-white text-[10px] py-0">
                                  {group.shippedCount} شُحن
                                </Badge>
                              )}
                              {group.deliveredCount > 0 && (
                                <Badge className="bg-green-500 text-white text-[10px] py-0">
                                  {group.deliveredCount} وصل
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Quantity Selector (for not_ordered) */}
                          {availableCount > 0 && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQuantity(group.key, selectedQty - 1);
                                }}
                                disabled={selectedQty === 0}
                              >
                                -
                              </Button>
                              <Input
                                type="number"
                                min={0}
                                max={availableCount}
                                value={selectedQty}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  updateQuantity(group.key, Math.min(val, availableCount));
                                }}
                                className="w-12 h-7 text-center text-sm p-0"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQuantity(group.key, Math.min(selectedQty + 1, availableCount));
                                }}
                                disabled={selectedQty >= availableCount}
                              >
                                +
                              </Button>
                            </div>
                          )}

                          {/* Expand Button */}
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </CollapsibleTrigger>
                        </div>

                        {/* Expanded Details */}
                        <CollapsibleContent>
                          <div className="border-t px-3 py-2 bg-secondary/30 space-y-2">
                            <p className="text-xs text-muted-foreground mb-2">تفاصيل المشتريات:</p>
                            {group.items.map((item) => (
                              <div 
                                key={item.id} 
                                className="flex items-center justify-between p-2 bg-background rounded-lg"
                              >
                                <div className="flex items-center gap-2">
                                  <Badge className={`${statusLabels[item.order_status].color} text-white gap-1`}>
                                    {statusLabels[item.order_status].icon}
                                    {statusLabels[item.order_status].label}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px]">
                                    {sourceLabels[item.source_type]?.label}
                                  </Badge>
                                </div>
                                <div className="text-left">
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(item.purchased_at), 'dd MMM yyyy', { locale: ar })}
                                  </p>
                                  {item.shipment_request_id && (
                                    <Button
                                      variant="link"
                                      size="sm"
                                      className="text-xs h-auto p-0"
                                      onClick={() => viewShipmentTracking(item.shipment_request_id!)}
                                    >
                                      <MapPin className="h-3 w-3 ml-1" />
                                      تتبع الشحنة
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Footer />

      {/* Request Delivery Dialog */}
      <AlertDialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              طلب شحن المنتجات
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              <p className="mb-3">سيتم طلب شحن <span className="font-bold">{totalSelectedCount} منتج</span>.</p>
              <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
                {Object.entries(selectedItems).map(([groupKey, qty]) => {
                  const group = groupedProducts.find(g => g.key === groupKey);
                  return group ? (
                    <div key={groupKey} className="flex justify-between text-sm">
                      <span className="line-clamp-1">{group.product_name_ar}</span>
                      <span className="font-medium">×{qty}</span>
                    </div>
                  ) : null;
                })}
              </div>
              <p className="text-sm mt-3 text-muted-foreground">
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

      {/* Shipment Tracking Dialog */}
      <Dialog open={showTrackingDialog} onOpenChange={setShowTrackingDialog}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              تتبع الشحنة
            </DialogTitle>
            <DialogDescription>
              متابعة حالة طلب الشحن
            </DialogDescription>
          </DialogHeader>
          
          {selectedShipment && (
            <div className="space-y-4">
              {/* Status Badge */}
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <span>الحالة الحالية:</span>
                <Badge className={`${statusLabels[selectedShipment.status]?.color || 'bg-gray-500'} text-white gap-1`}>
                  {statusLabels[selectedShipment.status]?.icon}
                  {statusLabels[selectedShipment.status]?.label}
                </Badge>
              </div>

              {/* Tracking Number */}
              {selectedShipment.tracking_number && (
                <div className="p-3 bg-primary/10 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">رقم التتبع:</p>
                  <p className="font-mono font-bold">{selectedShipment.tracking_number}</p>
                </div>
              )}

              {/* Timeline */}
              <div className="relative space-y-4 pr-6">
                <div className="absolute right-2 top-2 bottom-2 w-0.5 bg-border" />
                
                {/* Created/Pending */}
                <div className="relative flex items-start gap-3">
                  <div className="absolute right-0 w-4 h-4 rounded-full border-2 bg-primary border-primary" />
                  <div className="mr-4">
                    <p className="text-sm font-medium">تم الطلب</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(selectedShipment.created_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                    </p>
                  </div>
                </div>

                {/* Shipped */}
                <div className="relative flex items-start gap-3">
                  <div className={`absolute right-0 w-4 h-4 rounded-full border-2 ${
                    selectedShipment.shipped_at ? 'bg-orange-500 border-orange-500' : 'bg-background border-muted-foreground'
                  }`} />
                  <div className="mr-4">
                    <p className={`text-sm font-medium ${selectedShipment.shipped_at ? '' : 'text-muted-foreground'}`}>
                      تم الشحن
                    </p>
                    {selectedShipment.shipped_at && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(selectedShipment.shipped_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Delivered */}
                <div className="relative flex items-start gap-3">
                  <div className={`absolute right-0 w-4 h-4 rounded-full border-2 ${
                    selectedShipment.delivered_at ? 'bg-green-500 border-green-500' : 'bg-background border-muted-foreground'
                  }`} />
                  <div className="mr-4">
                    <p className={`text-sm font-medium ${selectedShipment.delivered_at ? '' : 'text-muted-foreground'}`}>
                      تم التوصيل
                    </p>
                    {selectedShipment.delivered_at && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(selectedShipment.delivered_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowTrackingDialog(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
