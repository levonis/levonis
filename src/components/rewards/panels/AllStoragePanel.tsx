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
import { Package, Truck, X, Ticket, MapPin, Loader2, CheckCircle, Clock, Ship, Trophy, Gift, Box, ChevronLeft } from "lucide-react";
import OptimizedImage from "@/components/OptimizedImage";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";
import { useState, useMemo } from "react";

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any; step: number }> = {
  pending: { label: 'في المخزن', color: 'text-blue-600', bgColor: 'bg-blue-500/10', icon: Package, step: 1 },
  shipping_requested: { label: 'طلب الشحن', color: 'text-amber-600', bgColor: 'bg-amber-500/10', icon: Clock, step: 2 },
  shipped: { label: 'تم الشحن', color: 'text-orange-600', bgColor: 'bg-orange-500/10', icon: Ship, step: 3 },
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

interface GroupedItem {
  key: string;
  title: string;
  image_url: string | null;
  items: StorageItem[];
  totalQuantity: number;
  status: string;
  source: 'offer' | 'competition';
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
      toast.success('تم تقديم طلب الشحن بنجاح!');
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
      toast.success('تم تقديم طلب الشحن بنجاح!');
      setShippingDialogOpen(false);
      setBulkShippingDialogOpen(false);
      setSelectedItem(null);
      setSelectedIds(new Set());
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

  // Group similar items by title and status
  const groupedItems = useMemo(() => {
    const items = transformToStorageItems();
    const groups: Record<string, GroupedItem> = {};
    
    items.forEach(item => {
      const key = `${item.title}-${item.status}-${item.source}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          title: item.title,
          image_url: item.image_url,
          items: [],
          totalQuantity: 0,
          status: item.status,
          source: item.source,
        };
      }
      groups[key].items.push(item);
      groups[key].totalQuantity += item.quantity;
    });
    
    return Object.values(groups);
  }, [offerPurchases, competitionPrizes]);

  const handleRequestShipping = (item: StorageItem) => {
    if (item.source === 'offer') {
      requestOfferShippingMutation.mutate([item.id]);
    } else {
      requestPrizeShippingMutation.mutate([item.id]);
    }
  };

  const handleBulkShipping = () => {
    const selectedItems = transformToStorageItems().filter(item => selectedIds.has(item.id));
    const offerIds = selectedItems.filter(i => i.source === 'offer').map(i => i.id);
    const prizeIds = selectedItems.filter(i => i.source === 'competition').map(i => i.id);
    
    if (offerIds.length > 0) requestOfferShippingMutation.mutate(offerIds);
    if (prizeIds.length > 0) requestPrizeShippingMutation.mutate(prizeIds);
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = (items: StorageItem[]) => {
    const pendingItems = items.filter(i => i.status === 'pending');
    const allSelected = pendingItems.every(item => selectedIds.has(item.id));
    
    if (allSelected) {
      const newSet = new Set(selectedIds);
      pendingItems.forEach(item => newSet.delete(item.id));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      pendingItems.forEach(item => newSet.add(item.id));
      setSelectedIds(newSet);
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
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
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
  
  const pendingGroups = groupedItems.filter(g => g.status === 'pending');
  const processingGroups = groupedItems.filter(g => ['shipping_requested', 'shipped'].includes(g.status));
  const deliveredGroups = groupedItems.filter(g => g.status === 'delivered');

  const renderGroupCard = (group: GroupedItem) => {
    const config = statusConfig[group.status] || statusConfig.pending;
    const StatusIcon = config.icon;
    const canSelect = group.status === 'pending';
    const allGroupSelected = group.items.every(item => selectedIds.has(item.id));
    const someSelected = group.items.some(item => selectedIds.has(item.id));
    
    return (
      <Card 
        key={group.key} 
        className={`overflow-hidden transition-all duration-300 border-0 shadow-sm hover:shadow-lg rounded-2xl ${
          someSelected ? 'ring-2 ring-primary/50' : ''
        }`}
      >
        <CardContent className="p-0">
          <div className="flex gap-3 p-3">
            {/* Selection Checkbox */}
            {canSelect && (
              <div className="flex items-center justify-center shrink-0">
                <Checkbox 
                  checked={allGroupSelected}
                  onCheckedChange={() => {
                    const newSet = new Set(selectedIds);
                    if (allGroupSelected) {
                      group.items.forEach(item => newSet.delete(item.id));
                    } else {
                      group.items.forEach(item => newSet.add(item.id));
                    }
                    setSelectedIds(newSet);
                  }}
                  className="h-5 w-5 rounded-md border-2"
                />
              </div>
            )}
            
            {/* Image */}
            <div 
              className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-muted/50 cursor-pointer"
              onClick={() => setSelectedItem(group.items[0])}
            >
              <OptimizedImage
                src={group.image_url || '/placeholder.svg'}
                alt={group.title}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0" onClick={() => setSelectedItem(group.items[0])}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-bold text-sm line-clamp-1">{group.title}</p>
                <ChevronLeft className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status Badge */}
                <Badge variant="outline" className={`gap-1 text-[10px] px-2 py-0.5 ${config.color} ${config.bgColor} border-0`}>
                  <StatusIcon className="h-3 w-3" />
                  {config.label}
                </Badge>
                
                {/* Source Badge */}
                {group.source === 'competition' ? (
                  <Badge variant="secondary" className="text-[10px] gap-0.5 bg-amber-500/10 text-amber-700 border-0 px-2 py-0.5">
                    <Trophy className="h-2.5 w-2.5" />
                    جائزة
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] gap-0.5 bg-primary/10 text-primary border-0 px-2 py-0.5">
                    <Gift className="h-2.5 w-2.5" />
                    عرض
                  </Badge>
                )}
                
                {/* Quantity */}
                {group.totalQuantity > 1 && (
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                    ×{group.totalQuantity}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* Progress Bar for Processing Items */}
          {['shipping_requested', 'shipped'].includes(group.status) && (
            <div className="px-3 pb-3">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4].map((step) => (
                  <div 
                    key={step}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      step <= config.step ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
                <span>مخزن</span>
                <span>طلب</span>
                <span>شحن</span>
                <span>تسليم</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderSection = (title: string, groups: GroupedItem[], items: StorageItem[], Icon: any, iconBg: string) => {
    if (groups.length === 0) return null;
    const canSelectAll = items.some(i => i.status === 'pending');
    const allSelected = items.filter(i => i.status === 'pending').every(item => selectedIds.has(item.id));
    
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <h3 className="text-sm font-bold">{title}</h3>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          </div>
          
          {canSelectAll && items.filter(i => i.status === 'pending').length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => toggleSelectAll(items)}
            >
              {allSelected ? 'إلغاء الكل' : 'تحديد الكل'}
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {groups.map(renderGroupCard)}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Bulk Action Bar - Fixed */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-50">
          <Card className="bg-primary text-primary-foreground shadow-2xl border-0 rounded-2xl">
            <CardContent className="p-3 flex items-center justify-between">
              <span className="font-bold text-sm">
                تم تحديد {selectedIds.size} عنصر
              </span>
              <Button 
                variant="secondary" 
                size="sm"
                className="rounded-xl font-bold"
                onClick={() => setBulkShippingDialogOpen(true)}
              >
                <Truck className="h-4 w-4 ml-2" />
                طلب الشحن
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-6 pb-24">
        {renderSection('في المخزن', pendingGroups, pendingItems, Package, 'bg-blue-500')}
        {renderSection('قيد المعالجة', processingGroups, processingItems, Truck, 'bg-amber-500')}
        {renderSection('تم التسليم', deliveredGroups, deliveredItems, CheckCircle, 'bg-green-500')}
      </div>

      {/* Item Detail Sheet */}
      <Sheet open={!!selectedItem && !shippingDialogOpen} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-[2rem] px-0 pb-0 border-t-0 bg-background">
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-muted-foreground/30" />
          
          <SheetHeader className="sr-only">
            <SheetTitle>تفاصيل العنصر</SheetTitle>
          </SheetHeader>
          
          {selectedItem && (
            <div className="h-full flex flex-col">
              {/* Image */}
              <div className="relative aspect-video bg-muted shrink-0">
                <OptimizedImage
                  src={selectedItem.image_url || '/placeholder.svg'}
                  alt={selectedItem.title}
                  className="w-full h-full object-cover"
                />
                <SheetClose asChild>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="absolute top-4 right-4 h-11 w-11 rounded-2xl bg-white/90 backdrop-blur-sm shadow-xl border-0"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </SheetClose>
                
                {/* Status Overlay */}
                <div className="absolute bottom-4 left-4 right-4">
                  {(() => {
                    const config = statusConfig[selectedItem.status] || statusConfig.pending;
                    return (
                      <div className={`${config.bgColor} backdrop-blur-sm rounded-2xl p-3`}>
                        <div className="flex items-center gap-3">
                          {[1, 2, 3, 4].map((step) => (
                            <div 
                              key={step}
                              className={`h-1.5 flex-1 rounded-full transition-colors ${
                                step <= config.step ? 'bg-primary' : 'bg-muted'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                          <span className={config.step >= 1 ? 'text-primary font-medium' : ''}>مخزن</span>
                          <span className={config.step >= 2 ? 'text-primary font-medium' : ''}>طلب</span>
                          <span className={config.step >= 3 ? 'text-primary font-medium' : ''}>شحن</span>
                          <span className={config.step >= 4 ? 'text-primary font-medium' : ''}>تسليم</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-5 py-5">
                <h2 className="text-xl font-black mb-3">{selectedItem.title}</h2>
                
                <div className="flex items-center gap-2 mb-5 flex-wrap">
                  {(() => {
                    const config = statusConfig[selectedItem.status] || statusConfig.pending;
                    const StatusIcon = config.icon;
                    return (
                      <Badge variant="outline" className={`gap-1 ${config.color} ${config.bgColor} border-0 px-3 py-1`}>
                        <StatusIcon className="h-4 w-4" />
                        {config.label}
                      </Badge>
                    );
                  })()}
                  {selectedItem.source === 'competition' ? (
                    <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-700 border-0 px-3 py-1">
                      <Trophy className="h-4 w-4" />
                      جائزة مسابقة
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-0 px-3 py-1">
                      <Gift className="h-4 w-4" />
                      عرض
                    </Badge>
                  )}
                </div>

                {/* Details Card */}
                <Card className="mb-4 bg-muted/30 border-0 rounded-2xl">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">الكمية</span>
                      <span className="font-bold">{selectedItem.quantity}</span>
                    </div>
                    {selectedItem.total_price !== undefined && (
                      <div className="flex justify-between text-sm pt-2 border-t">
                        <span className="text-muted-foreground">المجموع</span>
                        <span className="font-black text-primary">{selectedItem.total_price?.toLocaleString()} د.ع</span>
                      </div>
                    )}
                    {selectedItem.gift_tickets_awarded && selectedItem.gift_tickets_awarded > 0 && (
                      <div className="flex justify-between text-sm text-primary">
                        <span>التذاكر المكتسبة</span>
                        <span className="flex items-center gap-1 font-bold">
                          <Ticket className="h-4 w-4" />
                          {selectedItem.gift_tickets_awarded}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Timeline */}
                <Card className="mb-4 bg-muted/30 border-0 rounded-2xl">
                  <CardContent className="p-4">
                    <h4 className="font-bold mb-4">سجل العنصر</h4>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{selectedItem.source === 'competition' ? 'تم الفوز' : 'تم الشراء'}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(selectedItem.created_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                          </p>
                        </div>
                      </div>
                      
                      {selectedItem.shipping_requested_at && (
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                            <Clock className="h-5 w-5 text-amber-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">طلب الشحن</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(selectedItem.shipping_requested_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {selectedItem.shipped_at && (
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                            <Truck className="h-5 w-5 text-orange-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">تم الشحن</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(selectedItem.shipped_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {selectedItem.delivered_at && (
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">تم التسليم</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(selectedItem.delivered_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {selectedItem.status === 'pending' && (
                  <Button 
                    className="w-full h-14 rounded-2xl text-base font-black shadow-xl shadow-primary/30"
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

      {/* Single Shipping Dialog */}
      <AlertDialog open={shippingDialogOpen} onOpenChange={setShippingDialogOpen}>
        <AlertDialogContent className="rounded-3xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">تأكيد طلب الشحن</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p className="text-center">هل تريد طلب شحن <strong className="text-foreground">{selectedItem?.title}</strong>؟</p>
                
                {userAddresses && userAddresses.length > 0 ? (
                  <Card className="bg-muted/30 border-0 rounded-2xl">
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">عنوان الشحن</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {userAddresses[0].area}, {userAddresses[0].neighborhood}, {userAddresses[0].governorate}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-amber-500/30 bg-amber-500/10 rounded-2xl">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-amber-700 font-medium">
                        يرجى إضافة عنوان للشحن من إعدادات الحساب
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl flex-1">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl flex-1"
              onClick={() => selectedItem && handleRequestShipping(selectedItem)}
              disabled={(requestOfferShippingMutation.isPending || requestPrizeShippingMutation.isPending) || !userAddresses || userAddresses.length === 0}
            >
              {(requestOfferShippingMutation.isPending || requestPrizeShippingMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              )}
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Shipping Dialog */}
      <AlertDialog open={bulkShippingDialogOpen} onOpenChange={setBulkShippingDialogOpen}>
        <AlertDialogContent className="rounded-3xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">طلب شحن مجمع</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p className="text-center">
                  هل تريد طلب شحن <strong className="text-foreground">{selectedIds.size} عنصر</strong> معاً؟
                </p>
                
                {userAddresses && userAddresses.length > 0 ? (
                  <Card className="bg-muted/30 border-0 rounded-2xl">
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">عنوان الشحن</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {userAddresses[0].area}, {userAddresses[0].neighborhood}, {userAddresses[0].governorate}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-amber-500/30 bg-amber-500/10 rounded-2xl">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-amber-700 font-medium">
                        يرجى إضافة عنوان للشحن من إعدادات الحساب
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl flex-1">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl flex-1"
              onClick={handleBulkShipping}
              disabled={(requestOfferShippingMutation.isPending || requestPrizeShippingMutation.isPending) || !userAddresses || userAddresses.length === 0}
            >
              {(requestOfferShippingMutation.isPending || requestPrizeShippingMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              )}
              تأكيد الشحن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
