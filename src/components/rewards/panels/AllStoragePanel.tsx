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
import { Package, Truck, X, Calendar, Ticket, MapPin, Loader2, CheckCircle, Clock, Ship, Trophy, Gift } from "lucide-react";
import OptimizedImage from "@/components/OptimizedImage";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";
import { useState } from "react";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'في المخزن', color: 'bg-blue-500', icon: Package },
  shipping_requested: { label: 'طلب الشحن', color: 'bg-amber-500', icon: Clock },
  shipped: { label: 'تم الشحن', color: 'bg-orange-500', icon: Ship },
  delivered: { label: 'تم التسليم', color: 'bg-green-500', icon: CheckCircle },
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

  // Fetch product offer purchases
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

  // Fetch competition prizes (physical items only, not tickets or better_luck)
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

  // Request shipping mutation for offers
  const requestOfferShippingMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      const defaultAddress = userAddresses?.find(a => a.is_default) || userAddresses?.[0];
      
      if (!defaultAddress) {
        throw new Error('يرجى إضافة عنوان للشحن أولاً');
      }

      const { error } = await supabase
        .from('product_offer_purchases')
        .update({ 
          purchase_status: 'shipping_requested',
          shipping_requested_at: new Date().toISOString()
        })
        .eq('id', purchaseId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-offer-purchases'] });
      toast.success('تم تقديم طلب الشحن بنجاح! سيتم التواصل معك قريباً');
      setShippingDialogOpen(false);
      setSelectedItem(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  // Request shipping mutation for prizes
  const requestPrizeShippingMutation = useMutation({
    mutationFn: async (prizeId: string) => {
      const defaultAddress = userAddresses?.find(a => a.is_default) || userAddresses?.[0];
      
      if (!defaultAddress) {
        throw new Error('يرجى إضافة عنوان للشحن أولاً');
      }

      const { error } = await supabase
        .from('competition_prizes')
        .update({ 
          status: 'shipping_requested',
          shipping_requested_at: new Date().toISOString()
        })
        .eq('id', prizeId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-competition-prizes'] });
      toast.success('تم تقديم طلب الشحن بنجاح! سيتم التواصل معك قريباً');
      setShippingDialogOpen(false);
      setSelectedItem(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  // Transform data to unified format
  const transformToStorageItems = (): StorageItem[] => {
    const items: StorageItem[] = [];
    
    // Transform offer purchases
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
    
    // Transform competition prizes
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
    
    // Sort by created_at desc
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return items;
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} text-white gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getSourceBadge = (item: StorageItem) => {
    if (item.source === 'competition') {
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 gap-1">
          <Trophy className="h-3 w-3" />
          جائزة مسابقة
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50 gap-1">
        <Gift className="h-3 w-3" />
        عرض
      </Badge>
    );
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
      <Card>
        <CardContent className="p-6 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">سجّل الدخول لعرض مخزنك</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const allItems = transformToStorageItems();

  if (allItems.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <p className="font-medium text-lg">مخزنك فارغ</p>
          <p className="text-sm text-muted-foreground mt-2">
            جوائز المسابقات والمنتجات المشتراة ستظهر هنا
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group by status
  const pendingItems = allItems.filter(p => p.status === 'pending');
  const processingItems = allItems.filter(p => ['shipping_requested', 'shipped'].includes(p.status));
  const deliveredItems = allItems.filter(p => p.status === 'delivered');

  const renderItemCard = (item: StorageItem, borderColor: string) => (
    <Card 
      key={item.id} 
      className={`cursor-pointer hover:shadow-md transition-shadow ${borderColor}`}
      onClick={() => setSelectedItem(item)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-muted">
            <OptimizedImage
              src={item.image_url || '/placeholder.svg'}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <p className="font-medium line-clamp-1">{item.title}</p>
              {getStatusBadge(item.status)}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {getSourceBadge(item)}
              {item.quantity > 1 && (
                <span className="text-xs text-muted-foreground">الكمية: {item.quantity}</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(item.created_at), 'dd MMM yyyy', { locale: ar })}
              </span>
            </div>
            {item.gift_tickets_awarded && item.gift_tickets_awarded > 0 && (
              <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                <Ticket className="h-3 w-3" />
                حصلت على {item.gift_tickets_awarded} تذكرة
              </div>
            )}
            
            {item.status === 'pending' && (
              <Button 
                size="sm" 
                className="mt-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedItem(item);
                  setShippingDialogOpen(true);
                }}
              >
                <Truck className="h-3.5 w-3.5 ml-1" />
                طلب الشحن
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <div className="space-y-6">
        {/* Pending (In Storage) */}
        {pendingItems.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-semibold">في المخزن ({pendingItems.length})</h3>
            </div>
            {pendingItems.map((item) => renderItemCard(item, 'border-blue-200'))}
          </div>
        )}

        {/* Processing (Shipping Requested / Shipped) */}
        {processingItems.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-orange-500" />
              <h3 className="text-sm font-semibold">قيد المعالجة ({processingItems.length})</h3>
            </div>
            {processingItems.map((item) => renderItemCard(item, 'border-orange-200'))}
          </div>
        )}

        {/* Delivered */}
        {deliveredItems.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <h3 className="text-sm font-semibold">تم التسليم ({deliveredItems.length})</h3>
            </div>
            {deliveredItems.map((item) => (
              <Card 
                key={item.id} 
                className="opacity-75 border-green-200 cursor-pointer"
                onClick={() => setSelectedItem(item)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-muted">
                      <OptimizedImage
                        src={item.image_url || '/placeholder.svg'}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <p className="font-medium text-sm line-clamp-1">{item.title}</p>
                        {getStatusBadge(item.status)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {getSourceBadge(item)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.delivered_at && format(new Date(item.delivered_at), 'dd MMM yyyy', { locale: ar })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Item Detail Sheet */}
      <Sheet open={!!selectedItem && !shippingDialogOpen} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl px-0 pb-0">
          <SheetHeader className="sticky top-0 z-10 bg-background px-4 pb-3 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base">تفاصيل العنصر</SheetTitle>
              <SheetClose asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>
          </SheetHeader>
          
          {selectedItem && (
            <div className="overflow-y-auto h-full px-4 py-4 pb-24">
              {/* Item Image */}
              <div className="aspect-video rounded-xl overflow-hidden mb-4 bg-muted">
                <OptimizedImage
                  src={selectedItem.image_url || '/placeholder.svg'}
                  alt={selectedItem.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Item Info */}
              <h2 className="text-lg font-bold mb-2">{selectedItem.title}</h2>
              
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {getStatusBadge(selectedItem.status)}
                {getSourceBadge(selectedItem)}
              </div>

              {/* Details Card */}
              <Card className="mb-4">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">الكمية</span>
                    <span className="font-medium">{selectedItem.quantity}</span>
                  </div>
                  {selectedItem.unit_price !== undefined && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">سعر الوحدة</span>
                      <span className="font-medium">{selectedItem.unit_price?.toLocaleString()} د.ع</span>
                    </div>
                  )}
                  {selectedItem.total_price !== undefined && (
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-muted-foreground">المجموع</span>
                      <span className="font-bold text-primary">{selectedItem.total_price?.toLocaleString()} د.ع</span>
                    </div>
                  )}
                  {selectedItem.gift_tickets_awarded && selectedItem.gift_tickets_awarded > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>التذاكر المكتسبة</span>
                      <span className="flex items-center gap-1">
                        <Ticket className="h-3 w-3" />
                        {selectedItem.gift_tickets_awarded}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Timeline */}
              <Card className="mb-4">
                <CardContent className="p-4">
                  <h4 className="font-medium mb-3 text-sm">سجل العنصر</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {selectedItem.source === 'competition' ? 'تم الفوز' : 'تم الشراء'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(selectedItem.created_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                        </p>
                      </div>
                    </div>
                    
                    {selectedItem.shipping_requested_at && (
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                          <Clock className="h-3 w-3 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">طلب الشحن</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(selectedItem.shipping_requested_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {selectedItem.shipped_at && (
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                          <Truck className="h-3 w-3 text-orange-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">تم الشحن</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(selectedItem.shipped_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {selectedItem.delivered_at && (
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">تم التسليم</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(selectedItem.delivered_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Request Shipping Button (if pending) */}
              {selectedItem.status === 'pending' && (
                <Button 
                  className="w-full"
                  size="lg"
                  onClick={() => setShippingDialogOpen(true)}
                >
                  <Truck className="h-4 w-4 ml-2" />
                  طلب الشحن
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Shipping Request Dialog */}
      <AlertDialog open={shippingDialogOpen} onOpenChange={setShippingDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد طلب الشحن</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                هل تريد طلب شحن <strong>{selectedItem?.title}</strong>؟
              </p>
              
              {userAddresses && userAddresses.length > 0 ? (
                <Card className="mt-3">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">عنوان الشحن</p>
                        <p className="text-xs text-muted-foreground">
                          {userAddresses[0].area}, {userAddresses[0].neighborhood}, {userAddresses[0].governorate}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="mt-3 border-amber-300 bg-amber-50">
                  <CardContent className="p-3 text-center">
                    <p className="text-sm text-amber-700">
                      يرجى إضافة عنوان للشحن من إعدادات الحساب أولاً
                    </p>
                  </CardContent>
                </Card>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedItem && handleRequestShipping(selectedItem)}
              disabled={(requestOfferShippingMutation.isPending || requestPrizeShippingMutation.isPending) || !userAddresses || userAddresses.length === 0}
            >
              {(requestOfferShippingMutation.isPending || requestPrizeShippingMutation.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : null}
              تأكيد الطلب
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
