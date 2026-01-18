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
import { Package, Truck, X, Calendar, Ticket, MapPin, Loader2, CheckCircle, Clock, Ship } from "lucide-react";
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

export default function AllStoragePanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [shippingDialogOpen, setShippingDialogOpen] = useState(false);

  const { data: purchases, isLoading } = useQuery({
    queryKey: ['all-storage-panel', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('product_offer_purchases')
        .select('*, product_offers(id, title_ar, image_url, images, description_ar, price, currency)')
        .eq('user_id', user.id)
        .in('purchase_status', ['pending', 'purchased', 'shipping_requested', 'shipped', 'delivered'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
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

  const requestShippingMutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ['all-storage-panel'] });
      toast.success('تم تقديم طلب الشحن بنجاح! سيتم التواصل معك قريباً');
      setShippingDialogOpen(false);
      setSelectedPurchase(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

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

  if (!purchases || purchases.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <p className="font-medium text-lg">مخزنك فارغ</p>
          <p className="text-sm text-muted-foreground mt-2">
            اشترِ باقات التذاكر وستظهر هنا في انتظار طلب الشحن
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group by status - include 'purchased' as pending
  const pendingPurchases = purchases.filter(p => ['pending', 'purchased'].includes(p.purchase_status));
  const processingPurchases = purchases.filter(p => ['shipping_requested', 'shipped'].includes(p.purchase_status));
  const deliveredPurchases = purchases.filter(p => p.purchase_status === 'delivered');

  return (
    <>
      <div className="space-y-6">
        {/* Pending (In Storage) */}
        {pendingPurchases.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-semibold">في المخزن ({pendingPurchases.length})</h3>
            </div>
            {pendingPurchases.map((purchase: any) => (
              <Card 
                key={purchase.id} 
                className="cursor-pointer hover:shadow-md transition-shadow border-blue-200"
                onClick={() => setSelectedPurchase(purchase)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-muted">
                      <OptimizedImage
                        src={purchase.product_offers?.image_url || '/placeholder.svg'}
                        alt={purchase.product_offers?.title_ar || ''}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium line-clamp-1">
                          {purchase.product_offers?.title_ar}
                        </p>
                        {getStatusBadge(purchase.purchase_status)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span>الكمية: {purchase.quantity}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(purchase.created_at), 'dd MMM yyyy', { locale: ar })}
                        </span>
                      </div>
                      {purchase.gift_tickets_awarded > 0 && (
                        <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                          <Ticket className="h-3 w-3" />
                          حصلت على {purchase.gift_tickets_awarded} تذكرة
                        </div>
                      )}
                      
                      <Button 
                        size="sm" 
                        className="mt-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPurchase(purchase);
                          setShippingDialogOpen(true);
                        }}
                      >
                        <Truck className="h-3.5 w-3.5 ml-1" />
                        طلب الشحن
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Processing (Shipping Requested / Shipped) */}
        {processingPurchases.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-orange-500" />
              <h3 className="text-sm font-semibold">قيد المعالجة ({processingPurchases.length})</h3>
            </div>
            {processingPurchases.map((purchase: any) => (
              <Card 
                key={purchase.id} 
                className="cursor-pointer hover:shadow-md transition-shadow border-orange-200"
                onClick={() => setSelectedPurchase(purchase)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-muted">
                      <OptimizedImage
                        src={purchase.product_offers?.image_url || '/placeholder.svg'}
                        alt={purchase.product_offers?.title_ar || ''}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium line-clamp-1">
                          {purchase.product_offers?.title_ar}
                        </p>
                        {getStatusBadge(purchase.purchase_status)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span>الكمية: {purchase.quantity}</span>
                      </div>
                      {purchase.shipping_requested_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          طلب الشحن: {format(new Date(purchase.shipping_requested_at), 'dd MMM yyyy', { locale: ar })}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delivered */}
        {deliveredPurchases.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <h3 className="text-sm font-semibold">تم التسليم ({deliveredPurchases.length})</h3>
            </div>
            {deliveredPurchases.map((purchase: any) => (
              <Card 
                key={purchase.id} 
                className="opacity-75 border-green-200"
                onClick={() => setSelectedPurchase(purchase)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-muted">
                      <OptimizedImage
                        src={purchase.product_offers?.image_url || '/placeholder.svg'}
                        alt={purchase.product_offers?.title_ar || ''}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm line-clamp-1">
                          {purchase.product_offers?.title_ar}
                        </p>
                        {getStatusBadge(purchase.purchase_status)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        الكمية: {purchase.quantity} • 
                        {purchase.delivered_at && format(new Date(purchase.delivered_at), ' dd MMM yyyy', { locale: ar })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Purchase Detail Sheet */}
      <Sheet open={!!selectedPurchase && !shippingDialogOpen} onOpenChange={(open) => !open && setSelectedPurchase(null)}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl px-0 pb-0">
          <SheetHeader className="sticky top-0 z-10 bg-background px-4 pb-3 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base">تفاصيل الطلب</SheetTitle>
              <SheetClose asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>
          </SheetHeader>
          
          {selectedPurchase && (
            <div className="overflow-y-auto h-full px-4 py-4 pb-24">
              {/* Product Image */}
              <div className="aspect-video rounded-xl overflow-hidden mb-4 bg-muted">
                <OptimizedImage
                  src={selectedPurchase.product_offers?.image_url || '/placeholder.svg'}
                  alt={selectedPurchase.product_offers?.title_ar || ''}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Product Info */}
              <h2 className="text-lg font-bold mb-2">{selectedPurchase.product_offers?.title_ar}</h2>
              
              <div className="mb-4">
                {getStatusBadge(selectedPurchase.purchase_status)}
              </div>

              {/* Details Card */}
              <Card className="mb-4">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">الكمية</span>
                    <span className="font-medium">{selectedPurchase.quantity}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">سعر الوحدة</span>
                    <span className="font-medium">{selectedPurchase.unit_price?.toLocaleString()} د.ع</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="text-muted-foreground">المجموع</span>
                    <span className="font-bold text-primary">{selectedPurchase.total_price?.toLocaleString()} د.ع</span>
                  </div>
                  {selectedPurchase.gift_tickets_awarded > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>التذاكر المكتسبة</span>
                      <span className="flex items-center gap-1">
                        <Ticket className="h-3 w-3" />
                        {selectedPurchase.gift_tickets_awarded}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Timeline */}
              <Card className="mb-4">
                <CardContent className="p-4">
                  <h4 className="font-medium mb-3 text-sm">سجل الطلب</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">تم الشراء</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(selectedPurchase.created_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                        </p>
                      </div>
                    </div>
                    
                    {selectedPurchase.shipping_requested_at && (
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                          <Clock className="h-3 w-3 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">طلب الشحن</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(selectedPurchase.shipping_requested_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {selectedPurchase.shipped_at && (
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                          <Truck className="h-3 w-3 text-orange-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">تم الشحن</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(selectedPurchase.shipped_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {selectedPurchase.delivered_at && (
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">تم التسليم</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(selectedPurchase.delivered_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Request Shipping Button (if pending) */}
              {selectedPurchase.purchase_status === 'pending' && (
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
                هل تريد طلب شحن <strong>{selectedPurchase?.product_offers?.title_ar}</strong>؟
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
              onClick={() => selectedPurchase && requestShippingMutation.mutate(selectedPurchase.id)}
              disabled={requestShippingMutation.isPending || !userAddresses || userAddresses.length === 0}
            >
              {requestShippingMutation.isPending ? (
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
