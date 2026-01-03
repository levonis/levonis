import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Package, Loader2, Truck, CheckCircle2, Clock, ShoppingBag, ChevronDown, ChevronUp, MapPin, Phone, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import OptimizedImage from "@/components/OptimizedImage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PurchasedProduct {
  id: string;
  product_name: string;
  product_name_ar: string;
  product_image: string | null;
  product_price: number;
  currency: string;
  source_type: string;
  order_status: string;
  purchased_at: string;
  gift_tickets: number;
  shipment_request_id: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
}

interface GroupedProduct {
  key: string;
  product_name: string;
  product_name_ar: string;
  product_image: string | null;
  currency: string;
  items: PurchasedProduct[];
  totalCount: number;
  availableCount: number;
  pendingCount: number;
  shippedCount: number;
  deliveredCount: number;
}

interface ShipmentRequest {
  id: string;
  status: string;
  shipping_address: string | null;
  governorate: string | null;
  phone_number: string | null;
  tracking_number: string | null;
  created_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
  admin_notes: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  not_ordered: { 
    label: "لم يُطلب", 
    color: "bg-amber-100 text-amber-800 border-amber-200", 
    icon: <Clock className="h-3 w-3" /> 
  },
  ordered: { 
    label: "قيد المعالجة", 
    color: "bg-blue-100 text-blue-800 border-blue-200", 
    icon: <Clock className="h-3 w-3" /> 
  },
  shipped: { 
    label: "تم الشحن", 
    color: "bg-purple-100 text-purple-800 border-purple-200", 
    icon: <Truck className="h-3 w-3" /> 
  },
  delivered: { 
    label: "تم التوصيل", 
    color: "bg-green-100 text-green-800 border-green-200", 
    icon: <CheckCircle2 className="h-3 w-3" /> 
  },
};

interface MyPurchasedProductsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MyPurchasedProductsPanel({ isOpen, onClose }: MyPurchasedProductsPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showTrackingDialog, setShowTrackingDialog] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<ShipmentRequest | null>(null);

  const { data: purchasedProducts, isLoading } = useQuery({
    queryKey: ['my-purchased-products-panel', user?.id],
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
    enabled: !!user && isOpen,
  });

  const { data: userAddresses } = useQuery({
    queryKey: ['user-addresses', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user && isOpen,
  });

  // Group products by name
  const groupedProducts = useMemo<GroupedProduct[]>(() => {
    if (!purchasedProducts) return [];
    
    const groups = new Map<string, GroupedProduct>();
    
    purchasedProducts.forEach(product => {
      const key = product.product_name_ar || product.product_name;
      
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          product_name: product.product_name,
          product_name_ar: product.product_name_ar,
          product_image: product.product_image,
          currency: product.currency,
          items: [],
          totalCount: 0,
          availableCount: 0,
          pendingCount: 0,
          shippedCount: 0,
          deliveredCount: 0,
        });
      }
      
      const group = groups.get(key)!;
      group.items.push(product);
      group.totalCount++;
      
      switch (product.order_status) {
        case 'not_ordered':
          group.availableCount++;
          break;
        case 'ordered':
          group.pendingCount++;
          break;
        case 'shipped':
          group.shippedCount++;
          break;
        case 'delivered':
          group.deliveredCount++;
          break;
      }
    });
    
    return Array.from(groups.values());
  }, [purchasedProducts]);

  const requestShipmentMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      const { data, error } = await supabase.rpc('request_offer_shipment', {
        p_purchase_ids: productIds,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast.success(data.message || 'تم طلب الشحن بنجاح!');
        queryClient.invalidateQueries({ queryKey: ['my-purchased-products-panel'] });
        queryClient.invalidateQueries({ queryKey: ['my-purchased-products'] });
        setSelectedQuantities({});
        setShowConfirmDialog(false);
      } else {
        toast.error(data.error || 'حدث خطأ');
      }
    },
    onError: (error) => toast.error('خطأ: ' + error.message),
  });

  const toggleGroup = (key: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedGroups(newExpanded);
  };

  const updateQuantity = (key: string, value: number, maxAvailable: number) => {
    const clampedValue = Math.max(0, Math.min(value, maxAvailable));
    setSelectedQuantities(prev => ({
      ...prev,
      [key]: clampedValue,
    }));
  };

  const getSelectedProductIds = (): string[] => {
    const ids: string[] = [];
    groupedProducts.forEach(group => {
      const quantity = selectedQuantities[group.key] || 0;
      const availableItems = group.items.filter(item => item.order_status === 'not_ordered');
      for (let i = 0; i < Math.min(quantity, availableItems.length); i++) {
        ids.push(availableItems[i].id);
      }
    });
    return ids;
  };

  const totalSelectedCount = Object.values(selectedQuantities).reduce((sum, q) => sum + q, 0);

  const handleRequestShipment = () => {
    const productIds = getSelectedProductIds();
    if (productIds.length === 0) {
      toast.error('يرجى اختيار منتج واحد على الأقل');
      return;
    }
    setShowConfirmDialog(true);
  };

  const fetchShipmentDetails = async (shipmentId: string) => {
    const { data, error } = await supabase
      .from('shipment_requests')
      .select('*')
      .eq('id', shipmentId)
      .single();
    
    if (error) {
      toast.error('تعذر جلب تفاصيل الشحن');
      return;
    }
    
    setSelectedShipment(data);
    setShowTrackingDialog(true);
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.not_ordered;
    return (
      <Badge variant="outline" className={`gap-1 text-[10px] px-1.5 py-0.5 ${config.color}`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const defaultAddress = userAddresses?.find(a => a.is_default) || userAddresses?.[0];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-[95vw] max-w-[600px] h-[90vh] max-h-[800px] p-0 flex flex-col" dir="rtl">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Package className="h-5 w-5 text-primary" />
              مشترياتي
            </DialogTitle>
            <DialogDescription className="text-xs">
              المنتجات التي اشتريتها من العروض والمسابقات
            </DialogDescription>
          </DialogHeader>

          {/* Address Info */}
          {defaultAddress && (
            <div className="px-4 py-2 bg-primary/5 border-b shrink-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{defaultAddress.governorate} - {defaultAddress.area}</span>
                <span className="mx-1">|</span>
                <Phone className="h-3 w-3" />
                <span>{defaultAddress.phone_number}</span>
              </div>
            </div>
          )}

          {/* Bulk Actions */}
          {groupedProducts.some(g => g.availableCount > 0) && (
            <div className="px-4 py-2 bg-secondary/30 border-b shrink-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  محدد للشحن: {totalSelectedCount} منتج
                </span>
                <Button
                  size="sm"
                  onClick={handleRequestShipment}
                  disabled={totalSelectedCount === 0 || requestShipmentMutation.isPending}
                  className="gap-1 h-7 text-xs"
                >
                  {requestShipmentMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Truck className="h-3 w-3" />
                  )}
                  طلب شحن ({totalSelectedCount})
                </Button>
              </div>
            </div>
          )}

          {/* Products List - Grouped */}
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-4 py-2 space-y-2">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : groupedProducts.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground mb-2">لا توجد مشتريات بعد</p>
                  <p className="text-xs text-muted-foreground">
                    اشترِ من العروض للحصول على منتجات وتذاكر هدية!
                  </p>
                </div>
              ) : (
                groupedProducts.map((group) => (
                  <Collapsible
                    key={group.key}
                    open={expandedGroups.has(group.key)}
                    onOpenChange={() => toggleGroup(group.key)}
                  >
                    <div className="border rounded-lg overflow-hidden bg-card">
                      {/* Group Header - clickable to select all */}
                      <div 
                        className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-secondary/50 transition-colors ${
                          (selectedQuantities[group.key] || 0) === group.availableCount && group.availableCount > 0 
                            ? 'bg-primary/10 border-r-2 border-primary' 
                            : ''
                        }`}
                        onClick={() => {
                          if (group.availableCount > 0) {
                            const currentQty = selectedQuantities[group.key] || 0;
                            // Toggle: if all selected, deselect all; otherwise select all
                            updateQuantity(group.key, currentQty === group.availableCount ? 0 : group.availableCount, group.availableCount);
                          }
                        }}
                      >
                        {/* Product Image */}
                        <div className="w-14 h-14 rounded-md overflow-hidden bg-secondary shrink-0">
                          {group.product_image ? (
                            <OptimizedImage
                              src={group.product_image}
                              alt={group.product_name_ar}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {group.product_name_ar || group.product_name}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <Badge variant="secondary" className="text-[10px]">
                              الكل: {group.totalCount}
                            </Badge>
                            {group.availableCount > 0 && (
                              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700">
                                متاح: {group.availableCount}
                              </Badge>
                            )}
                            {group.pendingCount > 0 && (
                              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">
                                قيد الشحن: {group.pendingCount}
                              </Badge>
                            )}
                            {group.shippedCount > 0 && (
                              <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700">
                                شُحن: {group.shippedCount}
                              </Badge>
                            )}
                            {group.deliveredCount > 0 && (
                              <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700">
                                تم التوصيل: {group.deliveredCount}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Quantity Selector for Available Items */}
                        {group.availableCount > 0 && (
                          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Label className="text-xs sr-only">الكمية</Label>
                            <Input
                              type="number"
                              min={0}
                              max={group.availableCount}
                              value={selectedQuantities[group.key] || ''}
                              placeholder=""
                              onChange={(e) => updateQuantity(group.key, parseInt(e.target.value) || 0, group.availableCount)}
                              className="w-16 h-8 text-center text-sm"
                            />
                            <span className="text-xs text-muted-foreground">/ {group.availableCount}</span>
                          </div>
                        )}

                        {/* Expand Button */}
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {expandedGroups.has(group.key) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </div>

                      {/* Expanded Details */}
                      <CollapsibleContent>
                        <div className="border-t divide-y">
                          {group.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between px-4 py-2 text-xs bg-muted/20">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">
                                  {format(new Date(item.purchased_at), 'dd/MM/yyyy', { locale: ar })}
                                </span>
                                {getStatusBadge(item.order_status)}
                              </div>
                              {item.shipment_request_id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs gap-1"
                                  onClick={() => fetchShipmentDetails(item.shipment_request_id!)}
                                >
                                  <Eye className="h-3 w-3" />
                                  تتبع
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="px-4 py-3 border-t bg-secondary/20 shrink-0">
            <Button variant="outline" onClick={onClose} className="w-full h-9">
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Shipment Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد طلب الشحن</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>هل تريد طلب شحن {totalSelectedCount} منتج؟</p>
              {defaultAddress && (
                <div className="mt-3 p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium mb-1">عنوان التوصيل:</p>
                  <p>{defaultAddress.governorate} - {defaultAddress.area}</p>
                  <p>{defaultAddress.nearest_landmark}</p>
                  <p>هاتف: {defaultAddress.phone_number}</p>
                </div>
              )}
              {!defaultAddress && (
                <p className="text-amber-600 text-sm">
                  ⚠️ لم يتم تحديد عنوان افتراضي. يرجى إضافة عنوان من صفحة العناوين.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction
              onClick={() => requestShipmentMutation.mutate(getSelectedProductIds())}
              disabled={requestShipmentMutation.isPending}
            >
              {requestShipmentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : null}
              تأكيد الشحن
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
              <Truck className="h-5 w-5" />
              تتبع الشحنة
            </DialogTitle>
          </DialogHeader>
          
          {selectedShipment && (
            <div className="space-y-4">
              {/* Timeline */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">تم إنشاء الطلب</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(selectedShipment.created_at), 'dd/MM/yyyy - HH:mm', { locale: ar })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    selectedShipment.status !== 'pending' ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    {selectedShipment.status !== 'pending' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">تم الشحن</p>
                    {selectedShipment.shipped_at ? (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(selectedShipment.shipped_at), 'dd/MM/yyyy - HH:mm', { locale: ar })}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">في الانتظار</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    selectedShipment.status === 'delivered' ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    {selectedShipment.status === 'delivered' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">تم التوصيل</p>
                    {selectedShipment.delivered_at ? (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(selectedShipment.delivered_at), 'dd/MM/yyyy - HH:mm', { locale: ar })}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">في الانتظار</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Tracking Number */}
              {selectedShipment.tracking_number && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">رقم التتبع</p>
                  <p className="font-mono text-sm font-medium">{selectedShipment.tracking_number}</p>
                </div>
              )}

              {/* Address */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">عنوان التوصيل</p>
                <p className="text-sm">{selectedShipment.governorate} - {selectedShipment.shipping_address}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}