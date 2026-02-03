import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Package, Truck, X, Ticket, MapPin, Loader2, CheckCircle, Clock, Ship, Trophy, Gift, Box, ArrowUpRight } from "lucide-react";
import OptimizedImage from "@/components/OptimizedImage";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";
import { useState } from "react";

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  pending: { label: 'في المخزن', color: 'text-blue-600', bgColor: 'bg-blue-500/10 border-blue-500/20', icon: Package },
  shipping_requested: { label: 'طلب الشحن', color: 'text-amber-600', bgColor: 'bg-amber-500/10 border-amber-500/20', icon: Clock },
  shipped: { label: 'تم الشحن', color: 'text-orange-600', bgColor: 'bg-orange-500/10 border-orange-500/20', icon: Ship },
  delivered: { label: 'تم التسليم', color: 'text-green-600', bgColor: 'bg-green-500/10 border-green-500/20', icon: CheckCircle },
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
    mutationFn: async (purchaseId: string) => {
      const defaultAddress = userAddresses?.find(a => a.is_default) || userAddresses?.[0];
      if (!defaultAddress) throw new Error('يرجى إضافة عنوان للشحن أولاً');

      const { error } = await supabase
        .from('product_offer_purchases')
        .update({ purchase_status: 'shipping_requested', shipping_requested_at: new Date().toISOString() })
        .eq('id', purchaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-offer-purchases'] });
      toast.success('تم تقديم طلب الشحن بنجاح!');
      setShippingDialogOpen(false);
      setSelectedItem(null);
    },
    onError: (error: any) => toast.error(error.message || 'حدث خطأ'),
  });

  const requestPrizeShippingMutation = useMutation({
    mutationFn: async (prizeId: string) => {
      const defaultAddress = userAddresses?.find(a => a.is_default) || userAddresses?.[0];
      if (!defaultAddress) throw new Error('يرجى إضافة عنوان للشحن أولاً');

      const { error } = await supabase
        .from('competition_prizes')
        .update({ status: 'shipping_requested', shipping_requested_at: new Date().toISOString() })
        .eq('id', prizeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-competition-prizes'] });
      toast.success('تم تقديم طلب الشحن بنجاح!');
      setShippingDialogOpen(false);
      setSelectedItem(null);
    },
    onError: (error: any) => toast.error(error.message || 'حدث خطأ'),
  });

  const transformToStorageItems = (): StorageItem[] => {
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
  };

  const handleRequestShipping = (item: StorageItem) => {
    if (item.source === 'offer') {
      requestOfferShippingMutation.mutate(item.id);
    } else {
      requestPrizeShippingMutation.mutate(item.id);
    }
  };

  const isLoading = isLoadingOffers || isLoadingPrizes;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center mb-4">
          <Package className="h-10 w-10 text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground font-medium">سجّل الدخول لعرض مخزنك</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  const allItems = transformToStorageItems();

  if (allItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center mb-4">
          <Box className="h-12 w-12 text-muted-foreground/40" />
        </div>
        <p className="font-semibold text-lg">مخزنك فارغ</p>
        <p className="text-sm text-muted-foreground mt-1 text-center max-w-xs">
          جوائز المسابقات والمنتجات المشتراة ستظهر هنا
        </p>
      </div>
    );
  }

  const pendingItems = allItems.filter(p => p.status === 'pending');
  const processingItems = allItems.filter(p => ['shipping_requested', 'shipped'].includes(p.status));
  const deliveredItems = allItems.filter(p => p.status === 'delivered');

  const renderItemCard = (item: StorageItem) => {
    const config = statusConfig[item.status] || statusConfig.pending;
    const StatusIcon = config.icon;
    
    return (
      <Card 
        key={item.id} 
        className={`cursor-pointer hover:shadow-lg transition-all duration-300 border ${config.bgColor}`}
        onClick={() => setSelectedItem(item)}
      >
        <CardContent className="p-3">
          <div className="flex gap-3">
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-muted/50 shadow-inner">
              <OptimizedImage
                src={item.image_url || '/placeholder.svg'}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm line-clamp-1">{item.title}</p>
                <Badge variant="outline" className={`shrink-0 gap-1 text-[10px] px-1.5 py-0.5 ${config.color} ${config.bgColor}`}>
                  <StatusIcon className="h-3 w-3" />
                  {config.label}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 mt-1.5">
                {item.source === 'competition' ? (
                  <Badge variant="secondary" className="text-[9px] gap-0.5 bg-amber-500/10 text-amber-700 border-0">
                    <Trophy className="h-2.5 w-2.5" />
                    جائزة
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[9px] gap-0.5 bg-primary/10 text-primary border-0">
                    <Gift className="h-2.5 w-2.5" />
                    عرض
                  </Badge>
                )}
                {item.quantity > 1 && (
                  <span className="text-[10px] text-muted-foreground">×{item.quantity}</span>
                )}
              </div>
              
              {item.gift_tickets_awarded && item.gift_tickets_awarded > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-primary mt-1">
                  <Ticket className="h-3 w-3" />
                  +{item.gift_tickets_awarded} تذكرة
                </div>
              )}
              
              {item.status === 'pending' && (
                <Button 
                  size="sm" 
                  className="mt-2 h-7 text-xs rounded-lg gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedItem(item);
                    setShippingDialogOpen(true);
                  }}
                >
                  <Truck className="h-3 w-3" />
                  طلب الشحن
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSection = (title: string, items: StorageItem[], Icon: any, iconColor: string) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-6 h-6 rounded-lg ${iconColor} flex items-center justify-center`}>
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>
          <h3 className="text-sm font-bold">{title}</h3>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
        <div className="space-y-2">
          {items.map(renderItemCard)}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {renderSection('في المخزن', pendingItems, Package, 'bg-blue-500')}
        {renderSection('قيد المعالجة', processingItems, Truck, 'bg-amber-500')}
        {renderSection('تم التسليم', deliveredItems, CheckCircle, 'bg-green-500')}
      </div>

      {/* Item Detail Sheet */}
      <Sheet open={!!selectedItem && !shippingDialogOpen} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent side="bottom" className="h-[75vh] rounded-t-3xl px-0 pb-0">
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-muted-foreground/20" />
          
          <SheetHeader className="sr-only">
            <SheetTitle>تفاصيل العنصر</SheetTitle>
          </SheetHeader>
          
          {selectedItem && (
            <div className="h-full flex flex-col">
              {/* Image */}
              <div className="relative aspect-video bg-muted/20 shrink-0">
                <OptimizedImage
                  src={selectedItem.image_url || '/placeholder.svg'}
                  alt={selectedItem.title}
                  className="w-full h-full object-cover"
                />
                <SheetClose asChild>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="absolute top-4 right-4 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </SheetClose>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-5 py-5">
                <h2 className="text-lg font-bold mb-3">{selectedItem.title}</h2>
                
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {(() => {
                    const config = statusConfig[selectedItem.status] || statusConfig.pending;
                    const StatusIcon = config.icon;
                    return (
                      <Badge variant="outline" className={`gap-1 ${config.color} ${config.bgColor}`}>
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    );
                  })()}
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
                </div>

                {/* Details */}
                <Card className="mb-4 bg-muted/30">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">الكمية</span>
                      <span className="font-medium">{selectedItem.quantity}</span>
                    </div>
                    {selectedItem.total_price !== undefined && (
                      <div className="flex justify-between text-sm border-t pt-2">
                        <span className="text-muted-foreground">المجموع</span>
                        <span className="font-bold text-primary">{selectedItem.total_price?.toLocaleString()} د.ع</span>
                      </div>
                    )}
                    {selectedItem.gift_tickets_awarded && selectedItem.gift_tickets_awarded > 0 && (
                      <div className="flex justify-between text-sm text-primary">
                        <span>التذاكر المكتسبة</span>
                        <span className="flex items-center gap-1 font-medium">
                          <Ticket className="h-3.5 w-3.5" />
                          {selectedItem.gift_tickets_awarded}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Timeline */}
                <Card className="mb-4 bg-muted/30">
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-3 text-sm">سجل العنصر</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{selectedItem.source === 'competition' ? 'تم الفوز' : 'تم الشراء'}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(selectedItem.created_at), 'dd MMM yyyy', { locale: ar })}
                          </p>
                        </div>
                      </div>
                      
                      {selectedItem.shipping_requested_at && (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                            <Clock className="h-4 w-4 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">طلب الشحن</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(selectedItem.shipping_requested_at), 'dd MMM yyyy', { locale: ar })}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {selectedItem.shipped_at && (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                            <Truck className="h-4 w-4 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">تم الشحن</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(selectedItem.shipped_at), 'dd MMM yyyy', { locale: ar })}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {selectedItem.delivered_at && (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">تم التسليم</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(selectedItem.delivered_at), 'dd MMM yyyy', { locale: ar })}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {selectedItem.status === 'pending' && (
                  <Button 
                    className="w-full h-12 rounded-2xl text-base font-bold"
                    size="lg"
                    onClick={() => setShippingDialogOpen(true)}
                  >
                    <Truck className="h-5 w-5 ml-2" />
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
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد طلب الشحن</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>هل تريد طلب شحن <strong>{selectedItem?.title}</strong>؟</p>
                
                {userAddresses && userAddresses.length > 0 ? (
                  <Card className="bg-muted/50">
                    <CardContent className="p-3 flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">عنوان الشحن</p>
                        <p className="text-xs text-muted-foreground">
                          {userAddresses[0].area}, {userAddresses[0].neighborhood}, {userAddresses[0].governorate}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-amber-500/30 bg-amber-500/5">
                    <CardContent className="p-3 text-center">
                      <p className="text-sm text-amber-700">
                        يرجى إضافة عنوان للشحن من إعدادات الحساب
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              onClick={() => selectedItem && handleRequestShipping(selectedItem)}
              disabled={(requestOfferShippingMutation.isPending || requestPrizeShippingMutation.isPending) || !userAddresses || userAddresses.length === 0}
            >
              {(requestOfferShippingMutation.isPending || requestPrizeShippingMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              )}
              تأكيد الطلب
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
