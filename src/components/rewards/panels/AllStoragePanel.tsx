import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Package,
  Truck,
  Ticket,
  MapPin,
  Loader2,
  CheckCircle,
  Clock,
  Ship,
  Trophy,
  Gift,
  Box,
  Sparkles,
  ChevronDown,
  Calendar,
  AlertCircle,
  ShoppingCart,
} from "lucide-react";
import OptimizedImage from "@/components/OptimizedImage";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import {
  OFFER_PURCHASE_STATUSES,
  PRIZE_STATUSES,
  PURCHASED_PRODUCT_STATUSES,
  normalizeStorageStatus,
} from "@/lib/storageStatusConstants";
import { useLanguage } from "@/lib/i18n";

// Professional status configuration with semantic colors
type StatusEntry = { 
  label: string; 
  color: string; 
  bgColor: string; 
  borderColor: string; 
  icon: any; 
  step: number;
  gradient: string;
};

const getStatusConfig = (t: (key: any) => string): Record<string, StatusEntry> => ({
  pending: { 
    label: t('as_status_pending'), 
    color: 'text-blue-600 dark:text-blue-400', 
    bgColor: 'bg-blue-500/10', 
    borderColor: 'border-blue-500/20', 
    icon: Package, 
    step: 1,
    gradient: 'from-blue-500 to-blue-600'
  },
  shipping_requested: { 
    label: t('as_status_shipping_requested'), 
    color: 'text-amber-600 dark:text-amber-400', 
    bgColor: 'bg-amber-500/10', 
    borderColor: 'border-amber-500/20', 
    icon: Clock, 
    step: 2,
    gradient: 'from-amber-500 to-orange-500'
  },
  shipped: { 
    label: t('as_status_shipped'), 
    color: 'text-orange-600 dark:text-orange-400', 
    bgColor: 'bg-orange-500/10', 
    borderColor: 'border-orange-500/20', 
    icon: Ship, 
    step: 3,
    gradient: 'from-orange-500 to-red-500'
  },
  delivered: { 
    label: t('as_status_delivered'), 
    color: 'text-emerald-600 dark:text-emerald-400', 
    bgColor: 'bg-emerald-500/10', 
    borderColor: 'border-emerald-500/20', 
    icon: CheckCircle, 
    step: 4,
    gradient: 'from-emerald-500 to-green-600'
  },
});

interface StorageItem {
  id: string;
  title: string;
  image_url: string | null;
  quantity: number;
  status: string;
  source: 'offer' | 'competition' | 'purchased';
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
  const { t } = useLanguage();
  const statusConfig = useMemo(() => getStatusConfig(t), [t]);
  const { user, loading: authLoading } = useAuth();
  const { addOfferPurchaseToCart } = useCart();
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<StorageItem | null>(null);
  const [shippingDialogOpen, setShippingDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkShippingDialogOpen, setBulkShippingDialogOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('pending');

  // Fetch offer purchases
  const { data: offerPurchases, isLoading: isLoadingOffers } = useQuery({
    queryKey: ['storage-offer-purchases', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('product_offer_purchases')
        .select('*, product_offers(id, title_ar, image_url, images, description_ar, price, currency)')
        .eq('user_id', user.id)
        .in('purchase_status', [...OFFER_PURCHASE_STATUSES])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch competition prizes
  const { data: competitionPrizes, isLoading: isLoadingPrizes } = useQuery({
    queryKey: ['storage-competition-prizes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('competition_prizes')
        .select('*')
        .eq('user_id', user.id)
        .eq('prize_type', 'physical')
        .in('status', [...PRIZE_STATUSES])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch user purchased products (exclude offer-based ones to avoid duplicates with product_offer_purchases)
  const { data: purchasedProducts, isLoading: isLoadingPurchased } = useQuery({
    queryKey: ['storage-purchased-products', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_purchased_products')
        .select('*')
        .eq('user_id', user.id)
        .is('offer_id', null)
        .in('order_status', [...PURCHASED_PRODUCT_STATUSES])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch user addresses
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

  // Shipping mutations with better error handling
  const requestOfferShippingMutation = useMutation({
    mutationFn: async (purchaseIds: string[]) => {
      const defaultAddress = userAddresses?.find(a => a.is_default) || userAddresses?.[0];
      if (!defaultAddress) throw new Error(t('as_no_address'));

      const { data, error } = await supabase
        .from('product_offer_purchases')
        .update({ 
          purchase_status: 'shipping_requested', 
          shipping_requested_at: new Date().toISOString() 
        })
        .in('id', purchaseIds)
        .select();
      
      if (error) {
        console.error('Shipping request error:', error);
        throw new Error(t('as_shipping_failed', { message: error.message }));
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-offer-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['user-storage-count-page'] });
      toast.success(t('as_shipping_success'), {
        description: t('as_shipping_success_desc')
      });
      setShippingDialogOpen(false);
      setBulkShippingDialogOpen(false);
      setSelectedItem(null);
      setSelectedIds(new Set());
    },
    onError: (error: any) => {
      console.error('Mutation error:', error);
      toast.error(error.message || t('as_shipping_error'));
    },
  });

  const requestPrizeShippingMutation = useMutation({
    mutationFn: async (prizeIds: string[]) => {
      const defaultAddress = userAddresses?.find(a => a.is_default) || userAddresses?.[0];
      if (!defaultAddress) throw new Error(t('as_no_address'));

      const { data, error } = await supabase
        .from('competition_prizes')
        .update({ 
          status: 'shipping_requested', 
          shipping_requested_at: new Date().toISOString() 
        })
        .in('id', prizeIds)
        .select();
      
      if (error) {
        console.error('Prize shipping error:', error);
        throw new Error(t('as_shipping_failed', { message: error.message }));
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-competition-prizes'] });
      queryClient.invalidateQueries({ queryKey: ['user-storage-count-page'] });
      queryClient.invalidateQueries({ queryKey: ['user-storage-count'] });
      toast.success(t('as_shipping_success'), {
        description: t('as_shipping_success_desc')
      });
      setShippingDialogOpen(false);
      setBulkShippingDialogOpen(false);
      setSelectedItem(null);
      setSelectedIds(new Set());
    },
    onError: (error: any) => {
      console.error('Prize mutation error:', error);
      toast.error(error.message || t('as_shipping_error'));
    },
  });

  const requestPurchasedShippingMutation = useMutation({
    mutationFn: async (purchasedIds: string[]) => {
      const defaultAddress = userAddresses?.find(a => a.is_default) || userAddresses?.[0];
      if (!defaultAddress) throw new Error(t('as_no_address'));

      const { data, error } = await supabase
        .from('user_purchased_products')
        .update({ order_status: 'shipping_requested' })
        .in('id', purchasedIds)
        .select();
      
      if (error) throw new Error(t('as_shipping_failed', { message: error.message }));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-purchased-products'] });
      queryClient.invalidateQueries({ queryKey: ['user-storage-count-page'] });
      queryClient.invalidateQueries({ queryKey: ['user-storage-count'] });
      toast.success(t('as_shipping_success'));
      setShippingDialogOpen(false);
      setBulkShippingDialogOpen(false);
      setSelectedItem(null);
      setSelectedIds(new Set());
    },
    onError: (error: any) => {
      toast.error(error.message || t('as_shipping_error'));
    },
  });

  // Transform data to storage items
  const allItems = useMemo((): StorageItem[] => {
    const items: StorageItem[] = [];
    
    offerPurchases?.forEach((purchase: any) => {
      items.push({
        id: purchase.id,
        title: purchase.product_offers?.title_ar || t('as_default_product'),
        image_url: purchase.product_offers?.image_url,
        quantity: purchase.quantity,
        status: normalizeStorageStatus(purchase.purchase_status),
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
        status: normalizeStorageStatus(prize.status),
        source: 'competition',
        source_type: prize.source_type,
        created_at: prize.created_at,
        shipping_requested_at: prize.shipping_requested_at,
        shipped_at: prize.shipped_at,
        delivered_at: prize.delivered_at,
      });
    });

    purchasedProducts?.forEach((pp: any) => {
      items.push({
        id: pp.id,
        title: pp.product_name_ar || pp.product_name || t('as_default_product'),
        image_url: pp.product_image,
        quantity: 1,
        status: normalizeStorageStatus(pp.order_status),
        source: 'purchased',
        source_type: pp.source_type,
        created_at: pp.created_at,
        shipping_requested_at: null,
        shipped_at: pp.shipped_at,
        delivered_at: pp.delivered_at,
        unit_price: pp.product_price,
        total_price: pp.product_price,
        gift_tickets_awarded: pp.gift_tickets,
      });
    });
    
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return items;
  }, [offerPurchases, competitionPrizes, purchasedProducts]);

  // Group items by status
  const groupedByStatus = useMemo(() => ({
    pending: allItems.filter(i => i.status === 'pending'),
    processing: allItems.filter(i => ['shipping_requested', 'shipped'].includes(i.status)),
    delivered: allItems.filter(i => i.status === 'delivered'),
  }), [allItems]);

  const handleRequestShipping = (item: StorageItem) => {
    if (item.source === 'offer') {
      requestOfferShippingMutation.mutate([item.id]);
    } else if (item.source === 'purchased') {
      requestPurchasedShippingMutation.mutate([item.id]);
    } else {
      requestPrizeShippingMutation.mutate([item.id]);
    }
  };

  const handleBulkShipping = () => {
    const selectedItems = allItems.filter(item => selectedIds.has(item.id));
    const offerIds = selectedItems.filter(i => i.source === 'offer').map(i => i.id);
    const prizeIds = selectedItems.filter(i => i.source === 'competition').map(i => i.id);
    const purchasedIds = selectedItems.filter(i => i.source === 'purchased').map(i => i.id);
    
    if (offerIds.length > 0) requestOfferShippingMutation.mutate(offerIds);
    if (prizeIds.length > 0) requestPrizeShippingMutation.mutate(prizeIds);
    if (purchasedIds.length > 0) requestPurchasedShippingMutation.mutate(purchasedIds);
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

  const selectAllPending = () => {
    const pendingIds = groupedByStatus.pending.map(i => i.id);
    const allSelected = pendingIds.every(id => selectedIds.has(id));
    
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingIds));
    }
  };

  const isLoading = isLoadingOffers || isLoadingPrizes || isLoadingPurchased;
  const isPending = requestOfferShippingMutation.isPending || requestPrizeShippingMutation.isPending || requestPurchasedShippingMutation.isPending;

  if (!user || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        {authLoading ? (
          <div className="space-y-4 w-full">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="w-24 h-24 rounded-3xl bg-muted/50 flex items-center justify-center mb-5">
              <Package className="h-12 w-12 text-muted-foreground/40" />
            </div>
            <p className="text-muted-foreground font-semibold text-lg">{t('as_login_to_view')}</p>
          </>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (allItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-5 relative">
          <Box className="h-14 w-14 text-primary/40" />
          <Sparkles className="h-6 w-6 text-amber-500 absolute -top-1 -right-1" />
        </div>
        <p className="font-bold text-xl mb-2">{t('as_storage_empty')}</p>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          {t('as_storage_empty_desc')}
        </p>
      </div>
    );
  }

  // Render item card
  const renderItemCard = (item: StorageItem, showCheckbox: boolean = false) => {
    const config = statusConfig[item.status] || statusConfig.pending;
    const StatusIcon = config.icon;
    const isSelected = selectedIds.has(item.id);

    return (
      <Card 
        key={item.id}
        className={`group overflow-hidden transition-all duration-200 glass-tile ${
          isSelected ? 'ring-2 ring-primary' : ''
        }`}
      >
        <CardContent className="p-0">
          <div className="flex gap-3 p-3">
            {/* Selection Checkbox */}
            {showCheckbox && (
              <div className="flex items-center shrink-0">
                <Checkbox 
                  checked={isSelected}
                  onCheckedChange={() => toggleSelection(item.id)}
                  className="h-5 w-5 rounded-md"
                />
              </div>
            )}
            
            {/* Image */}
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-muted">
              <OptimizedImage
                src={item.image_url || '/placeholder.svg'}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h3 className="font-bold text-sm line-clamp-1">{item.title}</h3>
                {item.quantity > 1 && (
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    ×{item.quantity}
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status Badge */}
                <Badge 
                  variant="outline" 
                  className={`gap-1 text-[10px] px-2 py-0.5 ${config.color} ${config.bgColor} border-0 font-medium`}
                >
                  <StatusIcon className="h-3 w-3" />
                  {config.label}
                </Badge>
                
                {/* Source Badge */}
                {item.source === 'competition' ? (
                  <Badge className="text-[10px] gap-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 px-2 py-0.5">
                    <Trophy className="h-2.5 w-2.5" />
                    {t('as_badge_prize')}
                  </Badge>
                ) : (
                  <Badge className="text-[10px] gap-1 bg-gradient-to-r from-primary to-accent text-primary-foreground border-0 px-2 py-0.5">
                    <Gift className="h-2.5 w-2.5" />
                    {t('as_badge_offer')}
                  </Badge>
                )}
              </div>
              
              {/* Date */}
              <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(item.created_at), 'dd MMM yyyy', { locale: ar })}
              </p>
            </div>
            
            {/* Action Button */}
            {item.status === 'pending' && !showCheckbox && (
              <div className="flex items-center shrink-0">
                {item.source === 'offer' ? (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8 text-xs px-3 rounded-lg"
                    onClick={() => addOfferPurchaseToCart(item.id)}
                  >
                    <ShoppingCart className="h-3 w-3 ml-1" />
                    {t('as_add_to_cart')}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8 text-xs px-3 rounded-lg"
                    onClick={() => {
                      setSelectedItem(item);
                      setShippingDialogOpen(true);
                    }}
                  >
                    <Truck className="h-3 w-3 ml-1" />
                    {t('as_ship_btn')}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Progress Tracker for Processing Items */}
          {['shipping_requested', 'shipped'].includes(item.status) && (
            <div className="px-3 pb-3">
              <div className="bg-muted/50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  {[1, 2, 3, 4].map((step) => (
                    <div 
                      key={step}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        step <= config.step ? 'bg-primary' : 'bg-muted-foreground/20'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span className={config.step >= 1 ? 'text-primary font-semibold' : ''}>{t('as_step_request')}</span>
                  <span className={config.step >= 2 ? 'text-primary font-semibold' : ''}>{t('as_step_prepare')}</span>
                  <span className={config.step >= 3 ? 'text-primary font-semibold' : ''}>{t('as_step_ship')}</span>
                  <span className={config.step >= 4 ? 'text-primary font-semibold' : ''}>{t('as_step_deliver')}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render section
  const renderSection = (
    id: string,
    title: string,
    items: StorageItem[],
    Icon: any,
    gradient: string,
    showCheckbox: boolean = false
  ) => {
    if (items.length === 0) return null;
    
    const isExpanded = expandedSection === id;
    const pendingIds = items.filter(i => i.status === 'pending').map(i => i.id);
    const allSelected = pendingIds.length > 0 && pendingIds.every(id => selectedIds.has(id));

    return (
      <div className="space-y-3">
        {/* Section Header */}
        <button
          onClick={() => setExpandedSection(isExpanded ? null : id)}
          className="w-full flex items-center justify-between p-3 glass-tile glass-tile-interactive !rounded-xl"
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="text-right">
              <h3 className="font-bold text-sm">{title}</h3>
              <p className="text-xs text-muted-foreground">{t('as_items_count', { count: items.length })}</p>
            </div>
          </div>
          <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {/* Section Content */}
        {isExpanded && (
          <div className="space-y-2 pr-2">
            {/* Select All for Pending */}
            {showCheckbox && pendingIds.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-9 rounded-lg mb-2"
                onClick={selectAllPending}
              >
                {allSelected ? t('as_deselect_all') : t('as_select_all_count', { count: pendingIds.length })}
              </Button>
            )}
            
            {items.map(item => renderItemCard(item, showCheckbox && item.status === 'pending'))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-50">
          <Card className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-2xl border-0 rounded-2xl">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-bold text-sm">{t('as_selected_items', { count: selectedIds.size })}</span>
                  <p className="text-xs text-primary-foreground/70">{t('as_selected_for_shipping')}</p>
                </div>
              </div>
              <Button 
                variant="secondary" 
                size="sm"
                className="rounded-xl font-bold h-10 px-4"
                onClick={() => setBulkShippingDialogOpen(true)}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-1" />
                ) : (
                  <Truck className="h-4 w-4 ml-1" />
                )}
                {t('as_request_shipping')}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="space-y-4 pb-28">
        {renderSection('pending', t('as_section_pending'), groupedByStatus.pending, Package, 'from-blue-500 to-blue-600', true)}
        {renderSection('processing', t('as_section_processing'), groupedByStatus.processing, Truck, 'from-amber-500 to-orange-500')}
        {renderSection('delivered', t('as_section_delivered'), groupedByStatus.delivered, CheckCircle, 'from-emerald-500 to-green-600')}
      </div>

      {/* Single Item Shipping Dialog */}
      <Dialog open={shippingDialogOpen} onOpenChange={setShippingDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-bold">{t('as_confirm_shipping_title')}</DialogTitle>
            <DialogDescription className="text-center">
              {t('as_confirm_shipping_desc')} <strong className="text-foreground">{selectedItem?.title}</strong>?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {userAddresses && userAddresses.length > 0 ? (
              <Card className="bg-muted/50 border-0">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{t('as_shipping_address')}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {userAddresses[0].area}, {userAddresses[0].neighborhood}, {userAddresses[0].governorate}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-2 border-amber-500/30 bg-amber-500/10">
                <CardContent className="p-4 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-700 font-medium">
                    {t('as_add_address_warning')}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShippingDialogOpen(false)}
              className="flex-1 rounded-xl"
            >
              {t('as_cancel')}
            </Button>
            <Button 
              onClick={() => selectedItem && handleRequestShipping(selectedItem)}
              disabled={isPending || !userAddresses || userAddresses.length === 0}
              className="flex-1 rounded-xl"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              {t('as_confirm_shipping')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Shipping Dialog */}
      <Dialog open={bulkShippingDialogOpen} onOpenChange={setBulkShippingDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-bold">{t('as_bulk_shipping_title')}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="text-center p-6 bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl">
              <p className="text-4xl font-black text-primary">{selectedIds.size}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('as_items_selected_for_shipping')}</p>
            </div>
            
            {userAddresses && userAddresses.length > 0 ? (
              <Card className="bg-muted/50 border-0">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{t('as_shipping_address')}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {userAddresses[0].area}, {userAddresses[0].neighborhood}, {userAddresses[0].governorate}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-2 border-amber-500/30 bg-amber-500/10">
                <CardContent className="p-4 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-700 font-medium">
                    {t('as_add_address_warning')}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button 
              variant="outline" 
              onClick={() => setBulkShippingDialogOpen(false)}
              className="flex-1 rounded-xl"
            >
              {t('as_cancel')}
            </Button>
            <Button 
              onClick={handleBulkShipping}
              disabled={isPending || !userAddresses || userAddresses.length === 0}
              className="flex-1 rounded-xl"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              {t('as_confirm_shipping')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
