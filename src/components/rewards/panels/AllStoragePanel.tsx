import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Package, Truck, X, Ticket, MapPin, Loader2, CheckCircle, Clock, Ship, Trophy, Gift, Box } from "lucide-react";
import OptimizedImage from "@/components/OptimizedImage";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";
import { useState, useMemo } from "react";

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any; step: number }> = {
  pending: { label: 'في المخزن', color: 'text-blue-600', bgColor: 'bg-blue-500/10', icon: Package, step: 1 },
  shipping_requested: { label: 'طلب شحن', color: 'text-amber-600', bgColor: 'bg-amber-500/10', icon: Clock, step: 2 },
  shipped: { label: 'قيد التوصيل', color: 'text-orange-600', bgColor: 'bg-orange-500/10', icon: Ship, step: 3 },
  delivered: { label: 'تم التسليم', color: 'text-green-600', bgColor: 'bg-green-500/10', icon: CheckCircle, step: 4 },
};

interface StorageItem {
  id: string;
  title: string;
  image_url: string | null;
  quantity: number;
  status: string;
  source: 'offer' | 'competition';
  source_type?: string;
  created_at: string;
  shipping_requested_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  unit_price?: number;
  total_price?: number;
  gift_tickets_awarded?: number;
}

export default function AllStoragePanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<StorageItem | null>(null);
  const [shippingDialogOpen, setShippingDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkShippingDialogOpen, setBulkShippingDialogOpen] = useState(false);

  const { data: offerPurchases, isLoading: isLoadingOffers } = useQuery({
    queryKey: ['storage-offer-purchases', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('product_offer_purchases')
        .select('*, product_offers(id, title_ar, image_url, images, description_ar, price, currency)')
        .eq('user_id', user.id)
        .in('purchase_status', ['pending', 'purchased', 'shipping_requested', 'shipped', 'delivered'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const { data: competitionPrizes, isLoading: isLoadingPrizes } = useQuery({
    queryKey: ['storage-competition-prizes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('competition_prizes')
        .select('*')
        .eq('user_id', user.id)
        .eq('prize_type', 'physical')
        .in('status', ['pending', 'shipping_requested', 'shipped', 'delivered'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
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
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const requestOfferShippingMutation = useMutation({
    mutationFn: async (purchaseIds: string[]) => {
      const defaultAddress = userAddresses?.find(a => a.is_default) || userAddresses?.[0];
      if (!defaultAddress) throw new Error('يرجى إضافة عنوان للشحن أولاً');

      const { error } = await supabase
        .from('product_offer_purchases')
        .update({ purchase_status: 'shipping_requested', shipping_requested_at: new Date().toISOString() })
        .in('id', purchaseIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-offer-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['user-storage-count-page'] });
      toast.success('تم تقديم طلب الشحن!');
      setShippingDialogOpen(false);
      setBulkShippingDialogOpen(false);
      setSelectedItem(null);
      setSelectedIds(new Set());
    },
    onError: (error: any) => toast.error(error.message || 'حدث خطأ'),
  });

  const requestPrizeShippingMutation = useMutation({
    mutationFn: async (prizeIds: string[]) => {
      const defaultAddress = userAddresses?.find(a => a.is_default) || userAddresses?.[0];
      if (!defaultAddress) throw new Error('يرجى إضافة عنوان للشحن أولاً');

      const { error } = await supabase
        .from('competition_prizes')
        .update({ status: 'shipping_requested', shipping_requested_at: new Date().toISOString() })
        .in('id', prizeIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-competition-prizes'] });
      queryClient.invalidateQueries({ queryKey: ['user-storage-count-page'] });
      toast.success('تم تقديم طلب الشحن!');
      setShippingDialogOpen(false);
      setBulkShippingDialogOpen(false);
      setSelectedItem(null);
      setSelectedIds(new Set());
    },
    onError: (error: any) => toast.error(error.message || 'حدث خطأ'),
  });

  const allItems = useMemo((): StorageItem[] => {
    const items: StorageItem[] = [];
    
    offerPurchases?.forEach((purchase: any) => {
      items.push({
        id: purchase.id,
        title: purchase.product_offers?.title_ar || 'منتج',
        image_url: purchase.product_offers?.image_url,
        quantity: purchase.quantity,
        status: purchase.purchase_status === 'purchased' ? 'pending' : purchase.purchase_status,
        source: 'offer',
        created_at: purchase.created_at,
        shipping_requested_at: purchase.shipping_requested_at,
        shipped_at: purchase.shipped_at,
        delivered_at: purchase.delivered_at,
        unit_price: purchase.unit_price,
        total_price: purchase.total_price,
        gift_tickets_awarded: purchase.gift_tickets_awarded,
      });
    });
    
    competitionPrizes?.forEach((prize: any) => {
      items.push({
        id: prize.id,
        title: prize.prize_name_ar,
        image_url: prize.prize_image_url,
        quantity: 1,
        status: prize.status,
        source: 'competition',
        source_type: prize.source_type,
        created_at: prize.created_at,
        shipping_requested_at: prize.shipping_requested_at,
        shipped_at: prize.shipped_at,
        delivered_at: prize.delivered_at,
      });
    });
    
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return items;
  }, [offerPurchases, competitionPrizes]);

  const handleRequestShipping = (item: StorageItem) => {
    if (item.source === 'offer') {
      requestOfferShippingMutation.mutate([item.id]);
    } else {
      requestPrizeShippingMutation.mutate([item.id]);
    }
  };

  const handleBulkShipping = () => {
    const selectedItems = allItems.filter(item => selectedIds.has(item.id));
    const offerIds = selectedItems.filter(i => i.source === 'offer').map(i => i.id);
    const prizeIds = selectedItems.filter(i => i.source === 'competition').map(i => i.id);
    
    if (offerIds.length > 0) requestOfferShippingMutation.mutate(offerIds);
    if (prizeIds.length > 0) requestPrizeShippingMutation.mutate(prizeIds);
  };

  const toggleSelectAll = () => {
    const pendingItems = allItems.filter(i => i.status === 'pending');
    const allSelected = pendingItems.every(item => selectedIds.has(item.id));
    
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingItems.map(i => i.id)));
    }
  };

  const isLoading = isLoadingOffers || isLoadingPrizes;
  const pendingItems = allItems.filter(p => p.status === 'pending');
  const processingItems = allItems.filter(p => ['shipping_requested', 'shipped'].includes(p.status));
  const deliveredItems = allItems.filter(p => p.status === 'delivered');
  const allPendingSelected = pendingItems.length > 0 && pendingItems.every(item => selectedIds.has(item.id));

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Package className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground text-sm">سجّل الدخول لعرض مخزنك</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (allItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Box className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="font-semibold">مخزنك فارغ</p>
        <p className="text-xs text-muted-foreground mt-1">منتجاتك وجوائزك ستظهر هنا</p>
      </div>
    );
  }

  const renderItemCard = (item: StorageItem) => {
    const config = statusConfig[item.status] || statusConfig.pending;
    const StatusIcon = config.icon;
    const canSelect = item.status === 'pending';
    const isSelected = selectedIds.has(item.id);
    
    return (
      <Card 
        key={item.id} 
        className={`overflow-hidden transition-all duration-200 border rounded-xl ${
          isSelected ? 'border-primary ring-1 ring-primary/30' : 'border-border/50'
        }`}
      >
        <CardContent className="p-2">
          <div className="flex gap-2">
            {/* Checkbox */}
            {canSelect && (
              <div className="flex items-center shrink-0">
                <Checkbox 
                  checked={isSelected}
                  onCheckedChange={() => {
                    const newSet = new Set(selectedIds);
                    if (isSelected) newSet.delete(item.id);
                    else newSet.add(item.id);
                    setSelectedIds(newSet);
                  }}
                  className="h-4 w-4"
                />
              </div>
            )}
            
            {/* Image */}
            <div 
              className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-muted cursor-pointer"
              onClick={() => setSelectedItem(item)}
            >
              <OptimizedImage
                src={item.image_url || '/placeholder.svg'}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Info */}
            <div className="flex-1 min-w-0" onClick={() => setSelectedItem(item)}>
              <p className="font-semibold text-xs line-clamp-1 mb-1">{item.title}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className={`gap-0.5 text-[9px] px-1.5 py-0 h-4 ${config.color} ${config.bgColor} border-0`}>
                  <StatusIcon className="h-2.5 w-2.5" />
                  {config.label}
                </Badge>
                {item.source === 'competition' ? (
                  <Badge variant="secondary" className="text-[9px] gap-0.5 bg-amber-500/10 text-amber-700 border-0 px-1.5 py-0 h-4">
                    <Trophy className="h-2 w-2" />
                    جائزة
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[9px] gap-0.5 bg-primary/10 text-primary border-0 px-1.5 py-0 h-4">
                    <Gift className="h-2 w-2" />
                    عرض
                  </Badge>
                )}
                {item.quantity > 1 && (
                  <span className="text-[9px] text-muted-foreground">×{item.quantity}</span>
                )}
              </div>
            </div>
            
            {/* Action */}
            {item.status === 'pending' && (
              <Button 
                size="sm" 
                variant="outline"
                className="h-8 px-2 text-[10px] rounded-lg shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedItem(item);
                  setShippingDialogOpen(true);
                }}
              >
                <Truck className="h-3 w-3 ml-1" />
                شحن
              </Button>
            )}
          </div>
          
          {/* Progress for processing items */}
          {['shipping_requested', 'shipped'].includes(item.status) && (
            <div className="mt-2 pt-2 border-t border-border/50">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4].map((step) => (
                  <div 
                    key={step}
                    className={`h-1 flex-1 rounded-full ${step <= config.step ? 'bg-primary' : 'bg-muted'}`}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderSection = (title: string, items: StorageItem[], Icon: any, iconBg: string) => {
    if (items.length === 0) return null;
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-lg ${iconBg} flex items-center justify-center`}>
            <Icon className="h-3 w-3 text-white" />
          </div>
          <h3 className="text-xs font-bold">{title}</h3>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {items.length}
          </span>
        </div>
        <div className="space-y-1.5">
          {items.map(renderItemCard)}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Select All Header */}
      {pendingItems.length > 1 && (
        <div className="flex items-center justify-between mb-3 p-2 bg-muted/30 rounded-xl">
          <div className="flex items-center gap-2">
            <Checkbox 
              checked={allPendingSelected}
              onCheckedChange={toggleSelectAll}
              className="h-4 w-4"
            />
            <span className="text-xs">تحديد الكل ({pendingItems.length})</span>
          </div>
          {selectedIds.size > 0 && (
            <Button 
              size="sm" 
              className="h-7 text-xs rounded-lg"
              onClick={() => setBulkShippingDialogOpen(true)}
            >
              <Truck className="h-3 w-3 ml-1" />
              شحن ({selectedIds.size})
            </Button>
          )}
        </div>
      )}

      <div className="space-y-4">
        {renderSection('في المخزن', pendingItems, Package, 'bg-blue-500')}
        {renderSection('قيد المعالجة', processingItems, Truck, 'bg-amber-500')}
        {renderSection('تم التسليم', deliveredItems, CheckCircle, 'bg-green-500')}
      </div>

      {/* Item Detail Sheet */}
      <Sheet open={!!selectedItem && !shippingDialogOpen} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl p-0 border-t-0 bg-background overflow-hidden">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-muted-foreground/30 z-10" />
          
          <SheetHeader className="sr-only">
            <SheetTitle>تفاصيل العنصر</SheetTitle>
          </SheetHeader>
          
          {selectedItem && (
            <div className="h-full flex flex-col">
              {/* Image */}
              <div className="relative aspect-video bg-muted shrink-0">
                <img
                  src={selectedItem.image_url || '/placeholder.svg'}
                  alt={selectedItem.title}
                  className="w-full h-full object-contain bg-muted"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder.svg';
                  }}
                />
                <SheetClose asChild>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="absolute top-3 right-3 h-9 w-9 rounded-xl bg-background/80 backdrop-blur-sm border-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </SheetClose>
                
                {/* Status Badge */}
                {(() => {
                  const config = statusConfig[selectedItem.status] || statusConfig.pending;
                  const StatusIcon = config.icon;
                  return (
                    <Badge className={`absolute top-3 left-3 gap-1 ${config.bgColor} ${config.color} border-0`}>
                      <StatusIcon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                  );
                })()}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <h2 className="text-lg font-bold mb-3">{selectedItem.title}</h2>
                
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {selectedItem.source === 'competition' ? (
                    <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-700 border-0">
                      <Trophy className="h-3 w-3" />
                      جائزة مسابقة
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-0">
                      <Gift className="h-3 w-3" />
                      عرض
                    </Badge>
                  )}
                  <Badge variant="outline">الكمية: {selectedItem.quantity}</Badge>
                </div>

                {/* Order Progress */}
                <Card className="mb-4 bg-muted/30 border-0 rounded-xl">
                  <CardContent className="p-3">
                    <h4 className="font-bold text-sm mb-3">حالة الطلب</h4>
                    <div className="flex items-center gap-1 mb-2">
                      {[1, 2, 3, 4].map((step) => {
                        const config = statusConfig[selectedItem.status] || statusConfig.pending;
                        return (
                          <div 
                            key={step}
                            className={`h-2 flex-1 rounded-full transition-colors ${step <= config.step ? 'bg-primary' : 'bg-muted'}`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>مخزن</span>
                      <span>طلب</span>
                      <span>شحن</span>
                      <span>تسليم</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Details */}
                <Card className="mb-4 bg-muted/30 border-0 rounded-xl">
                  <CardContent className="p-3 space-y-2">
                    {selectedItem.total_price !== undefined && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">السعر</span>
                        <span className="font-bold text-primary">{selectedItem.total_price?.toLocaleString()} د.ع</span>
                      </div>
                    )}
                    {selectedItem.gift_tickets_awarded && selectedItem.gift_tickets_awarded > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">التذاكر</span>
                        <span className="flex items-center gap-1 font-bold text-primary">
                          <Ticket className="h-3 w-3" />
                          {selectedItem.gift_tickets_awarded}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span className="text-muted-foreground">التاريخ</span>
                      <span className="text-xs">
                        {format(new Date(selectedItem.created_at), 'dd MMM yyyy', { locale: ar })}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {selectedItem.status === 'pending' && (
                  <Button 
                    className="w-full h-11 rounded-xl font-bold"
                    onClick={() => setShippingDialogOpen(true)}
                  >
                    <Truck className="h-4 w-4 ml-2" />
                    طلب الشحن
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Shipping Dialog */}
      <AlertDialog open={shippingDialogOpen} onOpenChange={setShippingDialogOpen}>
        <AlertDialogContent className="rounded-2xl max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">تأكيد الشحن</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-center text-sm">شحن <strong className="text-foreground">{selectedItem?.title}</strong></p>
                
                {userAddresses && userAddresses.length > 0 ? (
                  <Card className="bg-muted/30 border-0 rounded-xl">
                    <CardContent className="p-3 flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium">العنوان</p>
                        <p className="text-[10px] text-muted-foreground">
                          {userAddresses[0].area}, {userAddresses[0].governorate}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-amber-500/30 bg-amber-500/10 rounded-xl">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-amber-700">أضف عنوان شحن أولاً</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-lg flex-1">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg flex-1"
              onClick={() => selectedItem && handleRequestShipping(selectedItem)}
              disabled={(requestOfferShippingMutation.isPending || requestPrizeShippingMutation.isPending) || !userAddresses?.length}
            >
              {(requestOfferShippingMutation.isPending || requestPrizeShippingMutation.isPending) && (
                <Loader2 className="h-3 w-3 animate-spin ml-1" />
              )}
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Shipping Dialog */}
      <AlertDialog open={bulkShippingDialogOpen} onOpenChange={setBulkShippingDialogOpen}>
        <AlertDialogContent className="rounded-2xl max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">شحن مجمع</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-center text-sm">
                  شحن <strong className="text-foreground">{selectedIds.size} عنصر</strong> معاً
                </p>
                
                {userAddresses && userAddresses.length > 0 ? (
                  <Card className="bg-muted/30 border-0 rounded-xl">
                    <CardContent className="p-3 flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium">العنوان</p>
                        <p className="text-[10px] text-muted-foreground">
                          {userAddresses[0].area}, {userAddresses[0].governorate}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-amber-500/30 bg-amber-500/10 rounded-xl">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-amber-700">أضف عنوان شحن أولاً</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-lg flex-1">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg flex-1"
              onClick={handleBulkShipping}
              disabled={(requestOfferShippingMutation.isPending || requestPrizeShippingMutation.isPending) || !userAddresses?.length}
            >
              {(requestOfferShippingMutation.isPending || requestPrizeShippingMutation.isPending) && (
                <Loader2 className="h-3 w-3 animate-spin ml-1" />
              )}
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
